# Deploy to Netlify (Free)

No database setup. Sync uses **MQTT pub/sub** over a free public broker — zero configuration.

---

## Cost: ₹0

| Service | Purpose | Cost |
|---|---|---|
| **GitHub** | Code hosting | Free |
| **Netlify** | HTTPS website | Free |
| **MQTT broker** | Pub/sub sync (EMQX public) | Free |

---

## Deploy steps

### 1. Push to GitHub

```bash
git add .
git commit -m "MQTT pub/sub family sync"
git push origin main
```

### 2. Netlify

1. [app.netlify.com](https://app.netlify.com) → **Import from GitHub**
2. Select repo → Publish directory: `.`
3. Deploy

### 3. Test sync (2 phones or incognito tabs)

**Tab 1 — Owner:**
1. Create home → add items
2. Copy share link from Family tab

**Tab 2 — Family member:**
1. Open share link
2. Join with name
3. Should see owner's items ✓

Tap **Sync now** on either device if needed.

---

## Requirements

- **HTTPS** — Netlify provides this (required for WebSocket/MQTT in browser)
- **Internet** — for pub/sub broker connection

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Sync dot yellow | Wait 2 sec for broker connection, or tap Sync now |
| Sync dot red | Check internet; refresh page |
| Joiner empty list | Owner must add items first; owner taps Sync now; joiner taps Sync now |
| Works locally not on Netlify | Must use HTTPS URL (not file://) |

---

*See also: [SYNC.md](SYNC.md)*
