/**
 * Cloud sync via Supabase (free tier) + localStorage cache.
 * Reliable cross-device sync — works when family joins hours later.
 */
(function () {
  "use strict";

  const rooms = new Map();
  let supabase = null;
  let syncStatusCb = null;
  let pollTimer = null;
  let lastSyncTime = null;
  let lastSyncError = null;
  let syncing = false;

  function genId(prefix) {
    return prefix + Math.random().toString(36).slice(2, 10);
  }

  function lsKey(householdId, key) {
    return "grocery_" + key + "_" + householdId;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getLocalItems(householdId) {
    return loadJSON(lsKey(householdId, "items"), []);
  }

  function saveLocalItems(householdId, items) {
    saveJSON(lsKey(householdId, "items"), items);
  }

  function getLocalMeta(householdId) {
    return loadJSON(lsKey(householdId, "meta"), null);
  }

  function saveLocalMeta(householdId, meta) {
    saveJSON(lsKey(householdId, "meta"), meta);
  }

  function getLocalMembersMap(householdId) {
    return loadJSON(lsKey(householdId, "members"), {});
  }

  function getLocalMembers(householdId) {
    const obj = getLocalMembersMap(householdId);
    return Object.entries(obj).map(function (e) {
      return Object.assign({ id: e[0] }, e[1]);
    });
  }

  function saveLocalMember(householdId, member) {
    const obj = getLocalMembersMap(householdId);
    obj[member.id] = {
      name: member.name,
      role: member.role,
      joinedAt: member.joinedAt
    };
    saveJSON(lsKey(householdId, "members"), obj);
  }

  function mergeItems(local, remote) {
    const map = new Map();
    (local || []).forEach(function (item) { map.set(item.id, item); });
    (remote || []).forEach(function (item) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
        return;
      }
      if (item.productId === existing.productId) {
        const newer = new Date(item.addedAt || 0) >= new Date(existing.addedAt || 0) ? item : existing;
        map.set(item.id, Object.assign({}, newer, {
          qty: Math.max(item.qty || 0, existing.qty || 0)
        }));
      } else {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values()).filter(function (i) { return i.status === "pending"; });
  }

  function mergeMembersMap(local, remote) {
    const out = Object.assign({}, local || {});
    Object.entries(remote || {}).forEach(function (entry) {
      const id = entry[0];
      const remoteM = entry[1];
      if (!out[id]) out[id] = remoteM;
      else out[id] = Object.assign({}, out[id], { name: remoteM.name || out[id].name });
    });
    return out;
  }

  function notifyStatus(ok, error) {
    lastSyncTime = ok ? Date.now() : lastSyncTime;
    lastSyncError = ok ? null : (error || lastSyncError);
    if (syncStatusCb) {
      syncStatusCb({
        ok: ok,
        syncing: syncing,
        time: lastSyncTime,
        error: lastSyncError,
        cloud: isCloudReady()
      });
    }
  }

  function isCloudReady() {
    return !!supabase;
  }

  function isConfigured() {
    return window.SUPABASE_URL &&
      window.SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
      window.SUPABASE_ANON_KEY &&
      window.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  }

  function init() {
    if (!isConfigured()) return false;
    if (typeof window.supabase === "undefined") return false;
    try {
      supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      return true;
    } catch (e) {
      console.error("Supabase init failed:", e);
      return false;
    }
  }

  function getRoom(householdId) {
    if (!rooms.has(householdId)) {
      rooms.set(householdId, {
        householdId: householdId,
        itemCbs: [],
        memberCbs: [],
        metaCbs: [],
        channel: null
      });
    }
    return rooms.get(householdId);
  }

  function notifyAll(householdId) {
    const state = getRoom(householdId);
    const items = getLocalItems(householdId);
    const members = getLocalMembers(householdId);
    const meta = getLocalMeta(householdId);
    state.itemCbs.forEach(function (cb) { cb(items); });
    state.memberCbs.forEach(function (cb) { cb(members); });
    if (meta) state.metaCbs.forEach(function (cb) { cb(meta); });
  }

  function applyCloudRow(householdId, row) {
    if (!row) return false;
    let changed = false;

    if (row.meta && Object.keys(row.meta).length) {
      saveLocalMeta(householdId, row.meta);
      changed = true;
    }
    if (row.members && Object.keys(row.members).length) {
      saveJSON(lsKey(householdId, "members"), mergeMembersMap(getLocalMembersMap(householdId), row.members));
      changed = true;
    }
    if (Array.isArray(row.items)) {
      saveLocalItems(householdId, mergeItems(getLocalItems(householdId), row.items));
      changed = true;
    }
    return changed;
  }

  async function fetchCloud(householdId) {
    if (!supabase) return null;
    const res = await supabase.from("households").select("*").eq("id", householdId).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async function pushCloud(householdId) {
    if (!supabase) return;
    const payload = {
      id: householdId,
      meta: getLocalMeta(householdId) || {},
      members: getLocalMembersMap(householdId),
      items: getLocalItems(householdId),
      updated_at: new Date().toISOString()
    };
    const res = await supabase.from("households").upsert(payload, { onConflict: "id" });
    if (res.error) throw new Error(res.error.message);
  }

  async function syncNow(householdId) {
    if (!householdId) return { ok: false, error: "No household" };
    if (!supabase) return { ok: false, error: "Cloud not configured — see docs/SUPABASE-SETUP.md" };

    syncing = true;
    notifyStatus(true);

    try {
      const cloud = await fetchCloud(householdId);
      if (cloud) applyCloudRow(householdId, cloud);
      await pushCloud(householdId);
      notifyAll(householdId);
      notifyStatus(true);
      return { ok: true };
    } catch (e) {
      notifyStatus(false, e.message || "Sync failed");
      return { ok: false, error: e.message || "Sync failed" };
    } finally {
      syncing = false;
      notifyStatus(!lastSyncError);
    }
  }

  function startAutoSync(householdId) {
    stopAutoSync();
    if (!supabase || !householdId) return;

    const state = getRoom(householdId);

    if (state.channel) {
      supabase.removeChannel(state.channel);
    }

    state.channel = supabase
      .channel("household:" + householdId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: "id=eq." + householdId },
        function (payload) {
          if (payload.new) {
            applyCloudRow(householdId, payload.new);
            notifyAll(householdId);
            notifyStatus(true);
          }
        }
      )
      .subscribe(function (status) {
        if (status === "CHANNEL_ERROR") notifyStatus(false, "Realtime connection error");
      });

    pollTimer = setInterval(function () {
      syncNow(householdId).catch(function () {});
    }, 12000);

    document.addEventListener("visibilitychange", onVisible);

    function onVisible() {
      if (document.visibilityState === "visible" && householdId) {
        syncNow(householdId).catch(function () {});
      }
    }

    state.onVisible = onVisible;
  }

  function stopAutoSync() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    rooms.forEach(function (state) {
      if (state.onVisible) {
        document.removeEventListener("visibilitychange", state.onVisible);
      }
      if (state.channel && supabase) {
        supabase.removeChannel(state.channel);
        state.channel = null;
      }
    });
  }

  const GrocerySync = {
    isConfigured: isConfigured,
    init: init,
    genId: genId,
    isCloudReady: isCloudReady,

    onSyncStatusChange: function (cb) {
      syncStatusCb = cb;
    },

    getSyncStatus: function () {
      return { ok: !lastSyncError, syncing: syncing, time: lastSyncTime, error: lastSyncError, cloud: isCloudReady() };
    },

    syncNow: syncNow,
    startAutoSync: startAutoSync,
    stopAutoSync: stopAutoSync,

    createHousehold: async function (homeName, ownerName, ownerMemberId) {
      const householdId = genId("h");
      const now = new Date().toISOString();
      const meta = { name: homeName || "My Home", createdBy: ownerMemberId, createdAt: now };
      const member = { id: ownerMemberId, name: ownerName, role: "owner", joinedAt: now };

      saveLocalMeta(householdId, meta);
      saveLocalMember(householdId, member);
      saveLocalItems(householdId, []);

      getRoom(householdId);
      notifyAll(householdId);

      if (supabase) {
        const result = await syncNow(householdId);
        if (!result.ok) throw new Error(result.error);
        startAutoSync(householdId);
      }

      return householdId;
    },

    joinHousehold: async function (householdId, memberName, memberId) {
      if (supabase) {
        const cloud = await fetchCloud(householdId);
        if (cloud) applyCloudRow(householdId, cloud);
      }

      const now = new Date().toISOString();
      const existing = getLocalMembers(householdId).find(function (m) { return m.id === memberId; });
      const member = {
        id: memberId,
        name: memberName,
        role: existing ? existing.role : "member",
        joinedAt: existing ? existing.joinedAt : now
      };

      saveLocalMember(householdId, member);
      getRoom(householdId);
      notifyAll(householdId);

      if (supabase) {
        const result = await syncNow(householdId);
        if (!result.ok) throw new Error(result.error);
        startAutoSync(householdId);
      }

      return householdId;
    },

    getHousehold: async function (householdId) {
      if (supabase) {
        try {
          const cloud = await fetchCloud(householdId);
          if (cloud) applyCloudRow(householdId, cloud);
        } catch (e) {
          console.warn("Cloud fetch failed:", e);
        }
      }

      const meta = getLocalMeta(householdId);
      const membersObj = getLocalMembersMap(householdId);
      if (!meta && !Object.keys(membersObj).length) return null;

      return {
        name: meta && meta.name,
        createdBy: meta && meta.createdBy,
        createdAt: meta && meta.createdAt,
        members: membersObj
      };
    },

    listenItems: function (householdId, callback) {
      const state = getRoom(householdId);
      state.itemCbs.push(callback);
      callback(getLocalItems(householdId));
      return function () {
        state.itemCbs = state.itemCbs.filter(function (cb) { return cb !== callback; });
      };
    },

    listenMembers: function (householdId, callback) {
      const state = getRoom(householdId);
      state.memberCbs.push(callback);
      callback(getLocalMembers(householdId));
      return function () {
        state.memberCbs = state.memberCbs.filter(function (cb) { return cb !== callback; });
      };
    },

    listenHouseholdMeta: function (householdId, callback) {
      const state = getRoom(householdId);
      state.metaCbs.push(callback);
      const meta = getLocalMeta(householdId);
      if (meta) callback(meta);
      return function () {
        state.metaCbs = state.metaCbs.filter(function (cb) { return cb !== callback; });
      };
    },

    setItem: async function (householdId, item) {
      const items = getLocalItems(householdId);
      const idx = items.findIndex(function (i) { return i.id === item.id; });
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      const pending = items.filter(function (i) { return i.status === "pending"; });
      saveLocalItems(householdId, pending);

      const state = getRoom(householdId);
      state.itemCbs.forEach(function (cb) { cb(pending); });

      if (supabase) {
        try {
          await pushCloud(householdId);
          notifyStatus(true);
        } catch (e) {
          notifyStatus(false, e.message);
          throw e;
        }
      }
    },

    removeItem: async function (householdId, itemId) {
      const items = getLocalItems(householdId).filter(function (i) { return i.id !== itemId; });
      saveLocalItems(householdId, items);

      const state = getRoom(householdId);
      state.itemCbs.forEach(function (cb) { cb(items); });

      if (supabase) {
        try {
          await pushCloud(householdId);
          notifyStatus(true);
        } catch (e) {
          notifyStatus(false, e.message);
          throw e;
        }
      }
    },

    removeAllListeners: function () {
      stopAutoSync();
      rooms.clear();
    }
  };

  init();
  window.GrocerySync = GrocerySync;
})();
