# Install as App — Home Screen Guide

Install **Daily Grocery List** on your phone or desktop for one-tap access — no app store needed.

---

## Android (Chrome)

1. Open your grocery list URL in **Chrome** (must be HTTPS — use Netlify link)
2. Tap the **⋮** menu (top right)
3. Tap **Add to Home screen** or **Install app**
4. Confirm name → **Add**
5. App icon appears on home screen — opens full screen like a native app

### Alternative (Android)

- Chrome may show a banner: **"Add Daily Grocery List to Home screen"** — tap **Install**

---

## iPhone / iPad — IMPORTANT: Use Safari, NOT Chrome

**Apple does not allow installing web apps from Chrome on iPhone.** This is an Apple restriction, not a bug in this app. Chrome on iOS cannot add apps to the home screen.

### If you use Chrome on iPhone

1. Tap **Install** in the app (or the orange banner) → **Copy link for Safari**
2. Open the **Safari** app (blue compass icon)
3. Paste the link in Safari's address bar and go
4. In Safari, tap **Install** (top right)
5. Tap Share ⬆️ (bottom) → **Add to Home Screen** → **Add**

### If you use Safari on iPhone

1. Open the grocery list URL in **Safari**
2. Tap **Install** (top right) for step-by-step help, or:
3. Tap **Share** ⬆️ (bottom center)
4. Scroll → **Add to Home Screen**
5. Tap **Add**

> **Tip:** After installing from Safari, open the app from your home screen icon — not from Chrome.

---

## Desktop — Windows (Chrome / Edge)

1. Open your Netlify URL in Chrome or Edge
2. Look for the **install icon** (⊕ or computer) in the address bar
3. Click **Install** → **Install Daily Grocery List**
4. App opens in its own window; pin to taskbar for quick access

### Edge

- **Settings** menu → **Apps** → **Install this site as an app**

---

## Desktop — Mac (Chrome / Safari)

### Chrome
1. Address bar → install icon → **Install**

### Safari (macOS Sonoma+)
1. **File** → **Add to Dock**

---

## Verify install worked

After installing, check:

- [ ] App opens without browser address bar (standalone mode)
- [ ] Green grocery icon on home screen / taskbar
- [ ] List syncs when you add items (green dot in header = live sync)
- [ ] Works after closing and reopening from icon

---

## Tips for family members

| Who | What to do |
|---|---|
| **Owner (you)** | Install app → Create home → Share link on WhatsApp |
| **Wife / husband** | Open WhatsApp link → Join → Install to home screen |
| **Maid** | Same link → Enter name "Maid" → Install on her phone |
| **Kids** | Share link → Join with their name |

### WhatsApp message template

```
🛒 Our shared grocery list — add items when something runs out:
https://YOUR-SITE.netlify.app/?home=hYOURCODE

1. Open link
2. Enter your name
3. Add to Home Screen for quick access
```

---

## Uninstall

| Platform | Steps |
|---|---|
| **Android** | Long-press icon → Uninstall / Remove |
| **iPhone** | Long-press icon → Remove App |
| **Desktop** | Right-click app icon → Uninstall |

Your data stays in Firebase until the household is deleted.

---

## Offline use

After first visit, the app caches catalog and UI via service worker. List is saved on your device. **Live sync with family requires the app to be open** on at least two devices — see [SYNC.md](SYNC.md).

---

*See also: [DEPLOY.md](DEPLOY.md) for hosting setup*
