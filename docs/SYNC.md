# How Sync Works (Free — No Database)

This app uses **[Trystero](https://github.com/dmotz/trystero)** — an open-source JavaScript library for peer-to-peer sync. No Firebase, no paid cloud database.

---

## Why no database?

Traditional sync needs a server (Firebase, Supabase, etc.). Trystero connects family phones **directly** using WebRTC — the same technology used in video calls.

| | Firebase / Cloud DB | Trystero P2P (this app) |
|---|---|---|
| **Cost** | Free tier, then paid | **₹0 forever** |
| **Account needed** | Yes (Google) | **No** |
| **Setup** | Config keys, rules | **None** |
| **Sync speed** | Instant | Instant (when online) |
| **Offline** | Cached + sync later | Saved on each device |

---

## What you need to know

### 1. Share link = room key

```
https://your-app.netlify.app/?home=habc12345
                              └──── room code ────┘
```

Anyone with this link joins the same grocery list.

### 2. Real-time when online

When your wife adds "2 kg Tomato" and her app is open, you see it within seconds if your app is also open.

### 3. Saved on each phone

Each device keeps a local copy. If you're offline, you still see your last list. When you come back online with family, lists merge automatically.

### 4. Owner should open app first

When a new member joins:
- If the **owner** (or anyone with the current list) has the app open → new member gets the full list
- If everyone is offline → new member starts fresh until someone with data opens the app

**Best practice:** Owner opens app daily. Family members open when adding or shopping.

### 5. Sync status dot (header)

| Dot | Meaning |
|---|---|
| 🟢 Green | Family member(s) online — live sync |
| 🟡 Yellow | Connected to room, waiting for family |
| No dot | Not in a household yet |

---

## Privacy

- Data stays between family devices — no company server stores your grocery list
- Room code in URL is the only "password" — share only with family
- Uses free public WebRTC signaling (BitTorrent trackers) — only room metadata, not your list content

---

## Technical details

- **Library:** [Trystero](https://github.com/dmotz/trystero) (MIT license)
- **Transport:** WebRTC data channels via BitTorrent trackers
- **Local storage:** Browser `localStorage` per household
- **Merge:** Items merged by ID; same product quantities combined

---

## Limitations (honest)

| Limitation | Workaround |
|---|---|
| All family offline → no cross-device sync | Owner opens app once daily |
| No push notifications yet | Open app from home screen icon |
| Room code in URL is security | Don't share link publicly |

These are acceptable trade-offs for a **completely free** family grocery list with zero setup.

---

*See also: [DEPLOY.md](DEPLOY.md) · [INSTALL-APP.md](INSTALL-APP.md)*
