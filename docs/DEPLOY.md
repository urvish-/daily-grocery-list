# Deploy to Netlify (Free — No Database Needed)

Host the app for free on Netlify. Family sync uses **Trystero** (open-source P2P) — no Firebase, no Supabase, no paid backend.

---

## Cost: ₹0 forever

| Service | Purpose | Cost |
|---|---|---|
| **GitHub** | Code hosting | Free |
| **Netlify** | HTTPS website | Free |
| **Trystero** | Real-time sync between phones | Free (P2P, no server) |

No account signup required for sync — only for hosting (GitHub + Netlify).

---

## How sync works (no database)

```
  Your phone  ←—— WebRTC ——→  Wife's phone
       ↑                            ↑
       └———— WebRTC ————→  Maid's phone
```

- Share link contains a room code: `?home=habc12345`
- When family opens the app, phones connect directly
- Changes sync in real time when members are online
- List is also saved on each device (works offline on that phone)

> **Tip:** At least one family member (usually the owner) should open the app once so new joiners receive the current list.

---

## Step 1 — Push to GitHub

```bash
cd daily-grocery-list
git init
git add .
git commit -m "Free P2P family grocery list"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/daily-grocery-list.git
git push -u origin main
```

---

## Step 2 — Deploy to Netlify (1 click)

### Option A — Netlify dashboard

1. Go to [app.netlify.com](https://app.netlify.com/) → sign up free
2. **Add new site** → **Import an existing project** → **GitHub**
3. Select `daily-grocery-list`
4. Build settings:
   - **Build command:** (leave empty)
   - **Publish directory:** `.`
5. Click **Deploy site**
6. Done — live at `https://your-name.netlify.app`

### Option B — Deploy button

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/daily-grocery-list)

Replace `YOUR_USERNAME` with your GitHub username.

### Custom name (optional)

Netlify → **Site configuration** → **Domain management** → change site name to e.g. `sharma-grocery.netlify.app`

---

## Step 3 — Share with family

1. Open your Netlify URL on your phone
2. **Create new home** → enter home name + your name
3. Go to **Family** tab → **Share link** on WhatsApp
4. Family opens link → enters name → joins

---

## Redeploy after changes

Every `git push` to `main` auto-redeploys on Netlify.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| List not syncing | Both phones need app open; check green dot in header |
| New member sees empty list | Owner should open app first, then member reopens link |
| Sync dot is yellow | Normal — waiting for family to come online |
| Sync dot is green | Family member(s) online — live sync active |
| App not loading on Netlify | Publish directory must be `.` (root) |

---

## Local testing

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. Open same URL in another browser tab to simulate two family members.

> P2P sync works best over **HTTPS** (Netlify). Localhost works for basic testing.

---

*See also: [INSTALL-APP.md](INSTALL-APP.md) · [SYNC.md](SYNC.md)*
