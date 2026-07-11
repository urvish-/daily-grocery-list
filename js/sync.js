/**
 * Grocery sync — works immediately (localStorage).
 * Upgrades to free P2P via Trystero when CDN is available.
 */
(function () {
  "use strict";

  const APP_ID = "daily-grocery-list-v1";
  const rooms = new Map();
  let peerCountCb = null;
  let joinRoomFn = null;

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

  function getLocalMembers(householdId) {
    const obj = loadJSON(lsKey(householdId, "members"), {});
    return Object.entries(obj).map(function (entry) {
      return Object.assign({ id: entry[0] }, entry[1]);
    });
  }

  function saveLocalMember(householdId, member) {
    const obj = loadJSON(lsKey(householdId, "members"), {});
    obj[member.id] = {
      name: member.name,
      role: member.role,
      joinedAt: member.joinedAt
    };
    saveJSON(lsKey(householdId, "members"), obj);
  }

  function mergeItems(local, remote) {
    const map = new Map();
    local.forEach(function (item) { map.set(item.id, item); });
    remote.forEach(function (item) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
        return;
      }
      if (item.productId === existing.productId) {
        const newer = new Date(item.addedAt) >= new Date(existing.addedAt) ? item : existing;
        map.set(item.id, Object.assign({}, newer, {
          qty: Math.max(item.qty || 0, existing.qty || 0)
        }));
      } else {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values()).filter(function (i) { return i.status === "pending"; });
  }

  function mergeMembers(local, remote) {
    const map = new Map(local.map(function (m) { return [m.id, m]; }));
    remote.forEach(function (m) {
      if (!map.has(m.id)) map.set(m.id, m);
      else map.set(m.id, Object.assign({}, map.get(m.id), { name: m.name || map.get(m.id).name }));
    });
    return Array.from(map.values());
  }

  function createLocalRoom(householdId) {
    const state = {
      householdId: householdId,
      itemCbs: [],
      memberCbs: [],
      metaCbs: [],
      peerCount: 0,
      p2p: false,
      sendFull: function () {},
      sendUpsert: function () {},
      sendRemove: function () {},
      sendMember: function () {},
      sendMeta: function () {},
      sendRequest: function () {}
    };

    function notifyItems() {
      const items = getLocalItems(householdId);
      state.itemCbs.forEach(function (cb) { cb(items); });
    }

    function notifyMembers() {
      const members = getLocalMembers(householdId);
      state.memberCbs.forEach(function (cb) { cb(members); });
    }

    function notifyMeta() {
      const meta = getLocalMeta(householdId);
      if (meta) state.metaCbs.forEach(function (cb) { cb(meta); });
    }

    state.notifyItems = notifyItems;
    state.notifyMembers = notifyMembers;
    state.notifyMeta = notifyMeta;
    rooms.set(householdId, state);
    return state;
  }

  function wireP2P(householdId, state) {
    if (!joinRoomFn || state.p2p) return;

    try {
      const room = joinRoomFn({ appId: APP_ID }, householdId);
      const actions = {
        full: room.makeAction("full"),
        upsert: room.makeAction("upsert"),
        remove: room.makeAction("remove"),
        member: room.makeAction("member"),
        meta: room.makeAction("meta"),
        request: room.makeAction("request")
      };

      state.sendFull = actions.full[0];
      state.sendUpsert = actions.upsert[0];
      state.sendRemove = actions.remove[0];
      state.sendMember = actions.member[0];
      state.sendMeta = actions.meta[0];
      state.sendRequest = actions.request[0];
      state.p2p = true;

      function broadcastFull() {
        state.sendFull({
          items: getLocalItems(householdId),
          members: getLocalMembers(householdId),
          meta: getLocalMeta(householdId)
        });
      }

      actions.full[1](function (payload) {
        if (!payload) return;
        if (payload.items) {
          saveLocalItems(householdId, mergeItems(getLocalItems(householdId), payload.items));
          state.notifyItems();
        }
        if (payload.members) {
          mergeMembers(getLocalMembers(householdId), payload.members).forEach(function (m) {
            saveLocalMember(householdId, m);
          });
          state.notifyMembers();
        }
        if (payload.meta && !getLocalMeta(householdId)) {
          saveLocalMeta(householdId, payload.meta);
          state.notifyMeta();
        }
      });

      actions.upsert[1](function (item) {
        if (!item || !item.id) return;
        const items = getLocalItems(householdId);
        const idx = items.findIndex(function (i) { return i.id === item.id; });
        if (idx >= 0) items[idx] = item;
        else items.push(item);
        saveLocalItems(householdId, items.filter(function (i) { return i.status === "pending"; }));
        state.notifyItems();
      });

      actions.remove[1](function (itemId) {
        if (!itemId) return;
        saveLocalItems(householdId, getLocalItems(householdId).filter(function (i) { return i.id !== itemId; }));
        state.notifyItems();
      });

      actions.member[1](function (member) {
        if (!member || !member.id) return;
        saveLocalMember(householdId, member);
        state.notifyMembers();
      });

      actions.meta[1](function (meta) {
        if (!meta) return;
        if (!getLocalMeta(householdId)) {
          saveLocalMeta(householdId, meta);
          state.notifyMeta();
        }
      });

      actions.request[1](function () { broadcastFull(); });

      room.onPeerJoin(function () {
        state.peerCount = room.getPeerIds().length;
        if (peerCountCb) peerCountCb(state.peerCount);
        broadcastFull();
        const meta = getLocalMeta(householdId);
        if (meta) state.sendMeta(meta);
      });

      room.onPeerLeave(function () {
        state.peerCount = room.getPeerIds().length;
        if (peerCountCb) peerCountCb(state.peerCount);
      });

      setTimeout(function () {
        state.sendRequest(null);
        state.peerCount = room.getPeerIds().length;
        if (peerCountCb) peerCountCb(state.peerCount);
      }, 800);
    } catch (e) {
      console.warn("P2P setup failed:", e);
    }
  }

  function getRoom(householdId) {
    if (rooms.has(householdId)) {
      wireP2P(householdId, rooms.get(householdId));
      return rooms.get(householdId);
    }
    const state = createLocalRoom(householdId);
    wireP2P(householdId, state);
    return state;
  }

  const GrocerySync = {
    isConfigured: function () { return true; },
    init: function () { return true; },
    genId: genId,

    onPeerCountChange: function (cb) {
      peerCountCb = cb;
    },

    getPeerCount: function (householdId) {
      const s = rooms.get(householdId);
      return s ? s.peerCount : 0;
    },

    createHousehold: function (homeName, ownerName, ownerMemberId) {
      const householdId = genId("h");
      const now = new Date().toISOString();
      const meta = { name: homeName || "My Home", createdBy: ownerMemberId, createdAt: now };
      const member = { id: ownerMemberId, name: ownerName, role: "owner", joinedAt: now };

      saveLocalMeta(householdId, meta);
      saveLocalMember(householdId, member);
      saveLocalItems(householdId, []);

      const state = getRoom(householdId);
      state.sendMeta(meta);
      state.sendMember(member);
      state.notifyItems();
      state.notifyMembers();
      state.notifyMeta();

      return Promise.resolve(householdId);
    },

    joinHousehold: function (householdId, memberName, memberId) {
      const now = new Date().toISOString();
      const existing = getLocalMembers(householdId).find(function (m) { return m.id === memberId; });
      const member = {
        id: memberId,
        name: memberName,
        role: existing ? existing.role : "member",
        joinedAt: existing ? existing.joinedAt : now
      };

      saveLocalMember(householdId, member);
      const state = getRoom(householdId);
      state.sendMember(member);
      state.sendRequest(null);
      state.notifyMembers();

      return Promise.resolve(householdId);
    },

    getHousehold: function (householdId) {
      const meta = getLocalMeta(householdId);
      const membersObj = loadJSON(lsKey(householdId, "members"), {});
      if (!meta && !Object.keys(membersObj).length) return Promise.resolve(null);
      return Promise.resolve({
        name: meta && meta.name,
        createdBy: meta && meta.createdBy,
        createdAt: meta && meta.createdAt,
        members: membersObj
      });
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

    setItem: function (householdId, item) {
      const items = getLocalItems(householdId);
      const idx = items.findIndex(function (i) { return i.id === item.id; });
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      const pending = items.filter(function (i) { return i.status === "pending"; });
      saveLocalItems(householdId, pending);

      const state = getRoom(householdId);
      state.sendUpsert(item);
      state.itemCbs.forEach(function (cb) { cb(pending); });
      return Promise.resolve();
    },

    removeItem: function (householdId, itemId) {
      const items = getLocalItems(householdId).filter(function (i) { return i.id !== itemId; });
      saveLocalItems(householdId, items);

      const state = getRoom(householdId);
      state.sendRemove(itemId);
      state.itemCbs.forEach(function (cb) { cb(items); });
      return Promise.resolve();
    },

    removeAllListeners: function () {
      rooms.clear();
    }
  };

  window.GrocerySync = GrocerySync;

  // Load P2P library in background (optional upgrade)
  import("https://esm.sh/trystero@0.21.6/torrent")
    .then(function (mod) {
      joinRoomFn = mod.joinRoom;
      rooms.forEach(function (state, id) { wireP2P(id, state); });
    })
    .catch(function () {
      console.info("P2P unavailable — using local sync on this device");
    });
})();
