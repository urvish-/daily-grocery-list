# Daily Grocery List — Project Whitepaper

> A simple, shareable, installable household shopping list for families who forget to communicate what is running out.

---

## Quick Start

| Step | Action |
|---|---|
| 1 | Push to GitHub → Deploy on Netlify — **[docs/DEPLOY.md](docs/DEPLOY.md)** |
| 2 | Create home → share link with family |
| 3 | **No Firebase/Supabase setup** — uses MQTT pub/sub automatically |

Sync explained: **[docs/SYNC.md](docs/SYNC.md)**

### Deploy to Netlify (after GitHub push)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/daily-grocery-list)

Replace `YOUR_USERNAME` in the link with your GitHub username after pushing the repo.

---

## 1. Problem Statement

In multi-member households, daily essentials—groceries, vegetables, milk products, stationery, and other routine items—often run out without anyone noticing in time. Different people use items at different times (morning milk, evening vegetables, office stationery, etc.), but there is no single place to record "we need this."

Common pain points:

| Pain Point | Example |
|---|---|
| **Silent depletion** | Last person finishes milk; no one tells the buyer |
| **Duplicate purchases** | Two people buy the same item on the same day |
| **Forgotten items** | Buyer goes to store without a consolidated list |
| **No accountability** | Unclear who added what or who bought what |
| **Communication gap** | Maid, spouse, children, and other members use different channels (WhatsApp, verbal) inconsistently |

---

## 2. Idea Overview

Build a **single-page web application** (one HTML file + JavaScript + JSON data) that:

1. Ships with a **default catalog** of everyday household products grouped by category
2. Lets **any household member** add items to a shared "to buy" list with quantity/weight
3. Lets the **shopper mark items as purchased**, which clears them from the active list
4. **Notifies** other members when something is added or purchased
5. Can be **installed on mobile** like a native app (Add to Home Screen / PWA)
6. Can be **shared** with maid, spouse, and family via a link or shared sync

### Why this idea works

- **Low friction**: One tap to add "2 kg tomatoes" beats sending a WhatsApp message that gets buried
- **Shared mental model**: Everyone sees the same live list before going to the store
- **Routine-friendly**: Default products mean you rarely type from scratch
- **Mobile-first**: Most additions happen in the kitchen, not at a desk

### Key design principle

> Keep it as simple as a paper list on the fridge—but always in everyone's pocket, always up to date.

---

## 3. Objectives

### Primary objectives

| # | Objective | Success criteria |
|---|---|---|
| O1 | **Eliminate missed items** | Running-out items appear on the list within minutes of being noticed |
| O2 | **Enable multi-member input** | Maid, spouse, and family can all add items without asking permission |
| O3 | **Support quantity by product type** | Count for eggs, weight for vegetables, liters for milk, packs for stationery |
| O4 | **Clear purchase workflow** | Shopper marks bought → item leaves active list → others are notified |
| O5 | **Zero app-store dependency** | Works as a bookmarked or installable web page on Android and iOS |

### Secondary objectives

| # | Objective | Success criteria |
|---|---|---|
| O6 | **Offline usability** | List readable and editable without internet; syncs when back online |
| O7 | **Low maintenance** | No server admin; free or near-free hosting |
| O8 | **Privacy** | Household data visible only to invited members |
| O9 | **Customization** | Household can edit default product catalog over time |

### Non-goals (out of scope for v1)

- Price comparison or store integration
- Recipe planning or meal calendars
- Inventory tracking with expiry dates
- Payment or delivery ordering
- Complex user roles and permissions

---

## 4. Scope

### In scope — Version 1 (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│  DAILY GROCERY LIST — MVP SCOPE                             │
├─────────────────────────────────────────────────────────────┤
│  ✓ Single-page HTML + CSS + JavaScript                      │
│  ✓ Default product catalog (JSON)                           │
│  ✓ Categories: Groceries, Vegetables, Milk, Stationery,     │
│    Household, Personal care, Other                          │
│  ✓ Add to list with quantity + unit                         │
│  ✓ Active list view (what to buy)                           │
│  ✓ Mark as purchased → remove from list                     │
│  ✓ Show who added / who purchased (name tag)                │
│  ✓ PWA install support (manifest + service worker)          │
│  ✓ Basic notifications (item added / purchased)             │
│  ✓ Shared household sync (one list per home)                │
│  ✓ Mobile-responsive UI                                     │
└─────────────────────────────────────────────────────────────┘
```

### In scope — Version 2 (enhancements)

- Recurring / staple items that auto-suggest when low
- Voice input ("add 1 liter milk")
- Hindi / regional language labels
- Weekly purchase history
- Multiple lists (e.g., "Big Bazaar run" vs "Local sabzi wala")
- Dark mode

### Out of scope

- Native Android/iOS apps (Play Store / App Store)
- Barcode scanning
- Multi-household SaaS platform
- AI-based consumption prediction

---

## 5. Solution Approach

### 5.1 Architecture — Single Page Application (SPA)

```
┌──────────────────────────────────────────────────────────────┐
│                     index.html (single file)                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │   UI Layer │  │ App Logic  │  │  Data Layer            │ │
│  │  (HTML/CSS)│  │ (JavaScript│  │  default-catalog.json  │ │
│  │            │  │            │  │  + sync adapter        │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Mobile browser      Service Worker         Cloud sync
   (installable PWA)   (offline + push)       (optional backend)
```

**Technology stack (minimal, no build step required for MVP):**

| Layer | Choice | Rationale |
|---|---|---|
| Markup | HTML5 | Universal, no compile step |
| Styling | CSS3 (mobile-first) | Fast, lightweight |
| Logic | Vanilla JavaScript (ES6+) | No framework lock-in; easy to share one file |
| Default data | Embedded JSON or `catalog.json` | Easy to edit household staples |
| Local cache | `localStorage` / IndexedDB | Offline read/write |
| Install | Web App Manifest + Service Worker | "Add to Home Screen" on mobile |
| Sync (recommended) | Firebase Realtime DB or Supabase | Free tier, real-time multi-user |
| Hosting | GitHub Pages / Netlify / Cloudflare Pages | Free HTTPS URL to share |
| Notifications | Web Push API (via service worker) | Alert when list changes |

### 5.2 Default Product Catalog Structure

Products are grouped by category. Each product defines its default unit so the UI shows the right input (count vs weight vs volume).

```json
{
  "categories": [
    {
      "id": "vegetables",
      "name": "Vegetables",
      "icon": "🥬",
      "defaultUnit": "kg",
      "products": [
        { "id": "tomato", "name": "Tomato", "unit": "kg", "defaultQty": 1 },
        { "id": "onion", "name": "Onion", "unit": "kg", "defaultQty": 2 },
        { "id": "potato", "name": "Potato", "unit": "kg", "defaultQty": 2 }
      ]
    },
    {
      "id": "milk",
      "name": "Milk & Dairy",
      "icon": "🥛",
      "defaultUnit": "liter",
      "products": [
        { "id": "milk-packet", "name": "Milk (packet)", "unit": "liter", "defaultQty": 1 },
        { "id": "curd", "name": "Curd", "unit": "kg", "defaultQty": 0.5 },
        { "id": "paneer", "name": "Paneer", "unit": "g", "defaultQty": 200 }
      ]
    },
    {
      "id": "groceries",
      "name": "Groceries",
      "icon": "🛒",
      "defaultUnit": "pack",
      "products": [
        { "id": "rice", "name": "Rice", "unit": "kg", "defaultQty": 5 },
        { "id": "atta", "name": "Atta (flour)", "unit": "kg", "defaultQty": 5 },
        { "id": "oil", "name": "Cooking oil", "unit": "liter", "defaultQty": 1 }
      ]
    },
    {
      "id": "stationery",
      "name": "Stationery",
      "icon": "✏️",
      "defaultUnit": "count",
      "products": [
        { "id": "notebook", "name": "Notebook", "unit": "count", "defaultQty": 1 },
        { "id": "pen", "name": "Pen", "unit": "count", "defaultQty": 2 }
      ]
    }
  ]
}
```

**Supported units:**

| Unit type | Used for | Example |
|---|---|---|
| `count` | Eggs, pens, soap bars | 12 eggs, 2 pens |
| `kg` | Vegetables, rice, atta | 2 kg onion |
| `g` | Paneer, spices | 200 g paneer |
| `liter` | Milk, oil, juice | 1 L milk |
| `pack` | Biscuits, tissue, detergent | 1 pack |

### 5.3 Active List Data Model

Each item on the shopping list tracks state and attribution:

```json
{
  "listId": "home-sharma-2026",
  "items": [
    {
      "id": "uuid-001",
      "productId": "tomato",
      "name": "Tomato",
      "category": "vegetables",
      "quantity": 2,
      "unit": "kg",
      "status": "pending",
      "addedBy": "Priya",
      "addedAt": "2026-07-12T08:30:00+05:30",
      "purchasedBy": null,
      "purchasedAt": null
    }
  ]
}
```

**Item lifecycle:**

```
  [Default catalog] ──tap/add──▶ [Pending on list]
                                        │
                          mark purchased │
                                        ▼
                              [Purchased → archived]
                                        │
                              notify household │
                                        ▼
                              removed from active list
```

### 5.4 User Flows

#### Flow A — Add an item (any member)

1. Open app (installed or browser)
2. Browse category or search product name
3. Tap product → adjust quantity/unit if needed
4. Tap **Add to list**
5. Other members receive notification: *"Priya added 2 kg Tomato"*

#### Flow B — Purchase an item (shopper)

1. Open app at store
2. See consolidated **To Buy** list grouped by category
3. Tap checkbox or swipe to **Mark purchased**
4. Item disappears from active list
5. Others notified: *"Ravi purchased 2 kg Tomato"*

#### Flow C — First-time household setup

1. One member opens the hosted URL
2. Enters household name and their display name
3. App generates a **share link** (same URL + household ID)
4. Share link via WhatsApp with maid, spouse, kids
5. Each person opens link, enters their name, joins the same list

### 5.5 Sharing & Sync Strategy

Pure local HTML cannot sync across phones by itself. Three tiers:

| Tier | Approach | Pros | Cons | Recommended for |
|---|---|---|---|---|
| **A — Local only** | Single device, export/import JSON | Zero cost, zero setup | No real-time sharing | Solo testing |
| **B — Cloud sync** | Firebase / Supabase free tier | Real-time, multi-user, free | Needs Google account setup once | **Production (recommended)** |
| **C — Manual share** | WhatsApp export of list snapshot | No backend | Not live; manual merge | Backup fallback |

**Recommended: Tier B** — One free Firebase/Supabase project per household. All members connect to the same `householdId`. Changes propagate in under 1 second.

### 5.6 Mobile Installation (PWA)

Progressive Web App features enable install without app stores:

| Feature | File | Purpose |
|---|---|---|
| Web manifest | `manifest.json` | App name, icon, theme color, standalone display |
| Service worker | `sw.js` | Offline cache, background sync, push notifications |
| HTTPS hosting | GitHub Pages / Netlify | Required for service worker and install |

**Install steps for family members:**

- **Android (Chrome):** Open URL → Menu → *Add to Home screen*
- **iOS (Safari):** Open URL → Share → *Add to Home Screen*

After install, the app opens full-screen like a native app with a home screen icon.

### 5.7 Notifications

| Event | Notification text | Recipient |
|---|---|---|
| Item added | "Priya added 2 kg Tomato" | All members except adder |
| Item purchased | "Ravi bought 2 kg Tomato ✓" | All members |
| List cleared | "Shopping complete for today" | All members |

Implementation: Web Push via service worker. User grants notification permission once on first open.

### 5.8 UI Layout (single screen)

```
┌─────────────────────────────────────┐
│  🏠 Sharma Household    [👤 Ravi ▾]  │
├─────────────────────────────────────┤
│  🔍 Search products...              │
├─────────────────────────────────────┤
│  TO BUY (4)                         │
│  ┌───────────────────────────────┐  │
│  │ ☐ 2 kg Tomato      — Priya   │  │
│  │ ☐ 1 L Milk         — Maid    │  │
│  │ ☐ 1 pack Tissue    — Kids    │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  ADD FROM CATALOG                   │
│  [🥬 Veg] [🥛 Milk] [🛒 Grocery]   │
│  [✏️ Stationery] [🧴 Other]        │
│                                     │
│  Tomato  Onion  Potato  ...         │
│  [+ Add custom item]                │
├─────────────────────────────────────┤
│  📋 Share link  |  ⚙ Settings      │
└─────────────────────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1 — Static prototype (Week 1) ✅

- [x] Single `index.html` with CSS/JS
- [x] Default catalog JSON (70+ common Indian household items)
- [x] Add / remove / mark purchased (localStorage as JSON)
- [x] Mobile-responsive layout with category icons
- [x] +/- quantity steppers (250g, 0.5kg, count, etc.)
- [ ] Works offline on one device (needs local server or deploy for catalog load)

**Deliverable:** Usable list on one phone; validate UX with family.

#### Run Phase 1 locally

```bash
# From project folder — Python (built-in on most systems)
python -m http.server 8080

# Or with Node.js
npx serve .
```

Open **http://localhost:8080** on your phone (same Wi-Fi) or desktop browser.

#### How to use

1. Enter your name on first open (stored on device)
2. Tap **Add Items** → pick a category → tap a product
3. Use **− / +** to set quantity (steps: 250g for paneer, 0.25kg for vegetables, etc.)
4. Tap **Add to List**
5. On **To Buy** tab: adjust qty with −/+ or tap **✓** when purchased

#### Data storage (Phase 1)

| Data | Location | Format |
|---|---|---|
| Product catalog | `data/default-catalog.json` + `data/catalog.js` | Static JSON / JS |
| Active shopping list | Browser `localStorage` key `groceryList` | JSON array |
| User display name | Browser `localStorage` key `groceryUser` | String |

**List item fields:** `id`, `productId`, `name`, `icon`, `categoryId`, `qty`, `unit`, `status`, `addedBy`, `addedAt`

**Catalog product fields:** `id`, `name`, `icon`, `unit`, `step`, `defaultQty`

#### Categories included

| Category | Items | Example units |
|---|---|---|
| Vegetables | 15 | kg, bunch, g |
| Fruits | 10 | kg, dozen, count |
| Groceries | 15 | kg, liter, pack, g |
| Milk Products | 8 | liter, kg, g, ml |
| Washing | 6 | kg, liter, ml |
| Bathroom & Sanitary | 11 | count, ml, pack, roll |
| Hosiery | 6 | pair, count |

### Phase 2 — Multi-user sync (Week 2) ✅

- [x] **MQTT pub/sub sync** (WebSocket — no Firebase/Supabase/API keys)
- [x] Retained messages — join from new device gets latest basket
- [x] Real-time push on every change
- [x] **Manual Sync now** button
- [x] Member name on add/purchase events
- [x] Owner sees family members list
- [x] Family tab with copy/share link
- [x] PWA manifest + service worker + icons
- [x] Netlify one-click deploy config
- [x] **₹0 cost — no Firebase, no account for sync**

**Deliverable:** Maid, spouse, and family on same live list — completely free.

#### Setup & deploy

Full guide: **[docs/DEPLOY.md](docs/DEPLOY.md)**

How pub/sub sync works: **[docs/SYNC.md](docs/SYNC.md)**

#### Install as app

Home screen install guide: **[docs/INSTALL-APP.md](docs/INSTALL-APP.md)**

### Phase 3 — Notifications (Week 3)

- [x] `manifest.json` + app icons
- [x] Service worker for offline cache
- [ ] Web push notifications (item added / purchased)
- [x] Deploy to Netlify (free HTTPS URL)

**Deliverable:** Installable app with push alerts (notifications pending).

### Phase 4 — Polish (Week 4+)

- [ ] Custom product add/edit
- [ ] Purchase history (last 7 days)
- [ ] Hindi labels
- [ ] Category icons and dark mode

---

## 7. Hosting & Cost Estimate

| Item | Cost |
|---|---|
| **Netlify** | HTTPS hosting | Free |
| **MQTT broker** | Pub/sub real-time sync | Free |
| Domain name (optional) | Custom URL | ~₹500–800/year |
| **Total** | | **₹0/month** |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Maid has basic phone / no smartphone | Cannot use app | Provide printed QR + one family member relays; or simple WhatsApp fallback export |
| Internet outage at home | Cannot sync | Service worker caches list; changes queue and sync when online |
| Notification permission denied | No alerts | In-app badge count on app icon; optional daily WhatsApp summary |
| Duplicate entries | Cluttered list | Merge same product: increment quantity instead of new row |
| Someone marks wrong item purchased | Item lost from list | 5-second undo toast; purchase history log |

---

## 9. Success Metrics

After 30 days of household use:

| Metric | Target |
|---|---|
| Items added before running out completely | > 80% |
| Store trips with zero forgotten items | > 90% |
| Active household members using app weekly | ≥ 3 |
| Duplicate purchases per week | < 1 |
| Time to add an item | < 10 seconds |

---

## 10. Recommendation

**Proceed with this idea.** It solves a real, daily friction point with minimal technology. The MVP can be built as a single HTML page in a few days, deployed for free, and shared instantly.

**Suggested next step:** Build Phase 1 (local prototype) with a pre-loaded Indian household catalog, test with your family for one week, then add cloud sync in Phase 2.

---

## 11. Repository Structure

```
daily-grocery-list/
├── README.md
├── index.html
├── manifest.json
├── sw.js
├── netlify.toml
├── css/app.css
├── js/
│   ├── app.js                ← main app logic
│   ├── sync.js               ← MQTT pub/sub sync
│   └── mqtt-config.js        ← broker URL (optional)
├── data/
│   ├── default-catalog.json
│   └── catalog.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── docs/
    ├── DEPLOY.md             ← GitHub + Netlify
    ├── SUPABASE-SETUP.md     ← Free cloud sync (required)
    ├── SYNC.md               ← How sync works
    └── INSTALL-APP.md        ← Add to home screen
```

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **PWA** | Progressive Web App — website installable like a native app |
| **Catalog** | Master list of products your household commonly buys |
| **Active list** | Items currently needed (status: pending) |
| **Household ID** | Unique key linking all family members to one shared list |
| **Unit** | Measure type: count, kg, g, liter, pack |

---

*Document version: 2.1 · Free P2P sync · Status: Ready to deploy*
