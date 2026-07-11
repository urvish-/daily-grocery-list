# Free Cloud Sync Setup (Supabase — ₹0 forever)

Family sync **requires** a free cloud database. The old P2P approach only worked when both phones were online at the same time — that's why sync failed.

**Supabase free tier:**
- ₹0 / month
- No credit card required
- 500 MB storage (enough for thousands of households)
- Real-time sync across all family devices

Setup takes **5 minutes**, one time only.

---

## Step 1 — Create free Supabase account

1. Go to [supabase.com](https://supabase.com) → **Start your project**
2. Sign up with GitHub or email (free)
3. **New project**:
   - Name: `daily-grocery-list`
   - Database password: choose a strong password (save it — you won't need it often)
   - Region: **Southeast Asia (Singapore)** or closest to you
4. Click **Create new project** → wait ~2 minutes

---

## Step 2 — Create database table

1. In Supabase dashboard → **SQL Editor** → **New query**
2. Copy entire contents of `supabase/schema.sql` from this repo
3. Click **Run**

You should see: `Success. No rows returned`

---

## Step 3 — Copy API keys

1. **Project Settings** (gear icon) → **API**
2. Copy these two values:

| Field | Example |
|---|---|
| **Project URL** | `https://abcdefgh.supabase.co` |
| **anon public** key | `eyJhbGciOiJIUzI1NiIs...` (long string) |

3. Open `js/supabase-config.js` in this project:

```javascript
window.SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGci...your-anon-key...";
```

4. Save the file

---

## Step 4 — Deploy

Push to GitHub → Netlify auto-redeploys.

Or test locally:
```bash
python -m http.server 8080
```

---

## Step 5 — Test sync (2 phones or 2 browser tabs)

### Phone 1 (Owner)
1. Open app → **Create new home** → name + your name
2. **Add Items** → add "2 kg Tomato"
3. **Family** tab → copy share link

### Phone 2 (Family member)
1. Open share link in **incognito/private** window (simulates new device)
2. **Join household** → enter name
3. Should see **2 kg Tomato** in To Buy list ✓
4. Should appear in owner's **Family members** list ✓

### Manual sync test
- Add item on phone 1
- On phone 2 → **Family** → **Sync now**
- Item should appear within 1 second

---

## Sync status indicators

| Header dot | Meaning |
|---|---|
| 🟢 Green | Cloud sync working |
| 🟡 Yellow | Syncing or cloud not configured |
| 🔴 Red | Error — check config or internet |

**Family tab** shows last sync time and any error message.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Orange banner "Cloud sync not configured" | Fill in `js/supabase-config.js` and redeploy |
| "relation households does not exist" | Run `supabase/schema.sql` in SQL Editor |
| Joiner sees empty list | Owner must add items AFTER cloud setup; tap **Sync now** on both devices |
| "Invalid API key" | Double-check anon key (not service_role key) |
| Sync error on Netlify | Ensure `supabase-config.js` is committed and deployed |
| Realtime not updating | Manual **Sync now** still works; check Realtime enabled in Supabase |

---

## Is Supabase really free?

Yes. Free tier includes:
- 500 MB database
- 50,000 monthly active users
- Unlimited API requests for normal household use

You will **never be charged** unless you manually upgrade to Pro.

Firebase Spark is also free — but Supabase is simpler for this app.

---

*See also: [DEPLOY.md](DEPLOY.md) · [SYNC.md](SYNC.md)*
