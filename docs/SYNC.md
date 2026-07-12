# How Sync Works — MQTT Pub/Sub

No Firebase. No Supabase. No API keys. No account signup.

---

## Architecture

```
  Phone 1 (Owner)  ──publish──▶  📡 MQTT Broker  ◀──subscribe──  Phone 2 (Wife)
       │                              │                              │
       └──────── subscribe ◀── retained message ──▶ publish ────────┘
```

| Component | Technology |
|---|---|
| **Protocol** | MQTT over WebSocket (pub/sub) |
| **Library** | [MQTT.js](https://github.com/mqttjs/MQTT.js) (open source) |
| **Broker** | Free public broker (EMQX) — configured in `js/mqtt-config.js` |
| **Persistence** | MQTT **retained messages** — last basket saved on broker topic |
| **Local cache** | Browser `localStorage` on each device |

---

## How pub/sub works for your family

1. **Owner creates home** → app publishes full basket + members to topic `daily-grocery/v1/households/{homeId}` with **retain=true**
2. **Owner adds tomato** → publishes updated JSON → all subscribed phones receive instantly
3. **Wife opens share link** (even hours later):
   - Subscribes to same topic
   - Broker delivers **retained message** with current basket
   - She adds herself as member → publishes updated state
4. **Owner sees** new member in Family tab via pub/sub push

---

## Manual sync

**Family tab → Sync now** re-publishes current local state to the broker.

Use when:
- List looks outdated on another phone
- Header dot is red/yellow
- After joining from share link

---

## Configuration (optional)

Default broker works out of the box. To change broker, edit `js/mqtt-config.js`:

```javascript
window.MQTT_CONFIG = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  topicPrefix: "daily-grocery/v1/households/"
};
```

---

## Limitations (honest)

| Limitation | Detail |
|---|---|
| Public broker | Fine for family use; household ID in URL is the secret |
| Broker uptime | Public brokers can be slow; tap **Sync now** if needed |
| Not end-to-end encrypted | OK for grocery lists; don't use for sensitive data |
| Retained message size | Keep lists reasonable (< 100 items) |

---

## vs Firebase / Supabase

| | MQTT pub/sub | Firebase / Supabase |
|---|---|---|
| Cost | ₹0 | ₹0 (free tier) |
| Account setup | **None** | Required |
| API keys | **None** | Required |
| Join later | ✅ Retained messages | ✅ Database |
| Real-time | ✅ Pub/sub push | ✅ Realtime DB |

---

*See also: [DEPLOY.md](DEPLOY.md) · [INSTALL-APP.md](INSTALL-APP.md)*
