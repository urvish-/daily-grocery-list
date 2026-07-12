/**
 * Real-time sync via MQTT pub/sub (WebSocket).
 * - No Firebase / Supabase / API keys
 * - Retained messages: new family members get latest basket on join
 * - Manual + auto publish on changes
 */
(function () {
  "use strict";

  const rooms = new Map();
  let syncStatusCb = null;
  let lastSyncTime = null;
  let lastSyncError = null;
  let syncing = false;
  let mqttReady = typeof mqtt !== "undefined";

  function cfg() {
    return window.MQTT_CONFIG || {};
  }

  function topicFor(householdId) {
    return (cfg().topicPrefix || "daily-grocery/v1/households/") + householdId;
  }

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
    if (ok) lastSyncTime = Date.now();
    if (ok) lastSyncError = null;
    else if (error) lastSyncError = error;
    if (syncStatusCb) {
      syncStatusCb({
        ok: !lastSyncError,
        syncing: syncing,
        time: lastSyncTime,
        error: lastSyncError,
        cloud: isConnected()
      });
    }
  }

  function isConfigured() {
    return mqttReady && !!cfg().brokerUrl;
  }

  function isConnected() {
    let any = false;
    rooms.forEach(function (r) { if (r.connected) any = true; });
    return any;
  }

  function init() {
    mqttReady = typeof mqtt !== "undefined";
    return mqttReady && !!cfg().brokerUrl;
  }

  function buildPayload(householdId, updatedBy) {
    return {
      meta: getLocalMeta(householdId) || {},
      members: getLocalMembersMap(householdId),
      items: getLocalItems(householdId),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null
    };
  }

  function applyPayload(householdId, data) {
    if (!data) return false;
    if (data.meta && Object.keys(data.meta).length) saveLocalMeta(householdId, data.meta);
    if (data.members) saveJSON(lsKey(householdId, "members"), mergeMembersMap(getLocalMembersMap(householdId), data.members));
    if (Array.isArray(data.items)) saveLocalItems(householdId, mergeItems(getLocalItems(householdId), data.items));
    return true;
  }

  function notifyAll(householdId) {
    const state = rooms.get(householdId);
    if (!state) return;
    const items = getLocalItems(householdId);
    const members = getLocalMembers(householdId);
    const meta = getLocalMeta(householdId);
    state.itemCbs.forEach(function (cb) { cb(items); });
    state.memberCbs.forEach(function (cb) { cb(members); });
    if (meta) state.metaCbs.forEach(function (cb) { cb(meta); });
  }

  function connectRoom(householdId, memberId) {
    if (rooms.has(householdId) && rooms.get(householdId).client) {
      return rooms.get(householdId);
    }

    const state = rooms.get(householdId) || {
      householdId: householdId,
      itemCbs: [],
      memberCbs: [],
      metaCbs: [],
      client: null,
      connected: false,
      memberId: memberId,
      lastSentAt: null
    };

    if (!mqttReady) {
      rooms.set(householdId, state);
      notifyStatus(false, "MQTT library not loaded");
      return state;
    }

    const clientId = "grocery_" + (memberId || genId("m")) + "_" + Math.random().toString(36).slice(2, 6);
    const client = mqtt.connect(cfg().brokerUrl, {
      clientId: clientId,
      clean: true,
      reconnectPeriod: 4000,
      connectTimeout: 10000
    });

    state.client = client;
    state.memberId = memberId;

    client.on("connect", function () {
      state.connected = true;
      notifyStatus(true);
      client.subscribe(topicFor(householdId), { qos: 1 }, function (err) {
        if (err) notifyStatus(false, "Subscribe failed: " + err.message);
        else publishState(householdId, memberId, true);
      });
    });

    client.on("message", function (topic, message) {
      try {
        const data = JSON.parse(message.toString());
        if (data.updated_by === memberId && data.updated_at === state.lastSentAt) return;
        applyPayload(householdId, data);
        notifyAll(householdId);
        notifyStatus(true);
      } catch (e) {
        console.warn("Bad MQTT message:", e);
      }
    });

    client.on("error", function (err) {
      notifyStatus(false, err.message || "MQTT error");
    });

    client.on("offline", function () {
      state.connected = false;
      notifyStatus(false, "Broker offline — tap Sync now");
    });

    client.on("reconnect", function () {
      notifyStatus(true);
    });

    rooms.set(householdId, state);
    return state;
  }

  function publishState(householdId, memberId, silent) {
    const state = rooms.get(householdId);
    if (!state || !state.client || !state.connected) {
      if (!silent) notifyStatus(false, "Not connected to pub/sub broker");
      return Promise.resolve({ ok: false, error: "Not connected" });
    }

    syncing = true;
    notifyStatus(true);

    const payload = buildPayload(householdId, memberId);
    state.lastSentAt = payload.updated_at;

    return new Promise(function (resolve) {
      state.client.publish(
        topicFor(householdId),
        JSON.stringify(payload),
        { qos: 1, retain: true },
        function (err) {
          syncing = false;
          if (err) {
            notifyStatus(false, err.message);
            resolve({ ok: false, error: err.message });
          } else {
            notifyStatus(true);
            resolve({ ok: true });
          }
        }
      );
    });
  }

  async function syncNow(householdId, memberId) {
    if (!householdId) return { ok: false, error: "No household" };
    const state = rooms.get(householdId);
    if (!state || !state.connected) {
      connectRoom(householdId, memberId);
      await new Promise(function (r) { setTimeout(r, 1500); });
    }
    return publishState(householdId, memberId || (state && state.memberId));
  }

  function startAutoSync(householdId, memberId) {
    connectRoom(householdId, memberId);
  }

  function stopAutoSync() {
    rooms.forEach(function (state) {
      if (state.client) {
        try { state.client.end(true); } catch (e) { /* ignore */ }
      }
    });
    rooms.clear();
  }

  function getRoom(householdId, memberId) {
    if (!rooms.has(householdId)) {
      rooms.set(householdId, {
        householdId: householdId,
        itemCbs: [],
        memberCbs: [],
        metaCbs: [],
        client: null,
        connected: false,
        memberId: memberId
      });
    }
    return rooms.get(householdId);
  }

  const GrocerySync = {
    isConfigured: isConfigured,
    init: init,
    genId: genId,
    isCloudReady: isConnected,

    onSyncStatusChange: function (cb) { syncStatusCb = cb; },

    getSyncStatus: function () {
      return { ok: !lastSyncError, syncing: syncing, time: lastSyncTime, error: lastSyncError, cloud: isConnected() };
    },

    syncNow: syncNow,
    startAutoSync: startAutoSync,
    stopAutoSync: stopAutoSync,

    createHousehold: async function (homeName, ownerName, ownerMemberId) {
      const householdId = genId("h");
      const now = new Date().toISOString();
      saveLocalMeta(householdId, { name: homeName || "My Home", createdBy: ownerMemberId, createdAt: now });
      saveLocalMember(householdId, { id: ownerMemberId, name: ownerName, role: "owner", joinedAt: now });
      saveLocalItems(householdId, []);

      getRoom(householdId, ownerMemberId);
      notifyAll(householdId);
      startAutoSync(householdId, ownerMemberId);
      await new Promise(function (r) { setTimeout(r, 1200); });
      await publishState(householdId, ownerMemberId);
      return householdId;
    },

    joinHousehold: async function (householdId, memberName, memberId) {
      getRoom(householdId, memberId);
      startAutoSync(householdId, memberId);
      await new Promise(function (r) { setTimeout(r, 1800); });

      const now = new Date().toISOString();
      const existing = getLocalMembers(householdId).find(function (m) { return m.id === memberId; });
      saveLocalMember(householdId, {
        id: memberId,
        name: memberName,
        role: existing ? existing.role : "member",
        joinedAt: existing ? existing.joinedAt : now
      });

      notifyAll(householdId);
      await publishState(householdId, memberId);
      return householdId;
    },

    getHousehold: async function (householdId) {
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

    setItem: async function (householdId, item, memberId) {
      const items = getLocalItems(householdId);
      const idx = items.findIndex(function (i) { return i.id === item.id; });
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      const pending = items.filter(function (i) { return i.status === "pending"; });
      saveLocalItems(householdId, pending);

      const state = getRoom(householdId);
      state.itemCbs.forEach(function (cb) { cb(pending); });

      const mid = memberId || state.memberId;
      const result = await publishState(householdId, mid);
      if (!result.ok) throw new Error(result.error);
    },

    removeItem: async function (householdId, itemId, memberId) {
      const items = getLocalItems(householdId).filter(function (i) { return i.id !== itemId; });
      saveLocalItems(householdId, items);

      const state = getRoom(householdId);
      state.itemCbs.forEach(function (cb) { cb(items); });

      const mid = memberId || state.memberId;
      const result = await publishState(householdId, mid);
      if (!result.ok) throw new Error(result.error);
    },

    removeAllListeners: stopAutoSync
  };

  init();
  window.GrocerySync = GrocerySync;
})();
