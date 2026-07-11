# How Sync Works

## Why P2P was replaced

The previous Trystero P2P sync **only worked when both phones were online at the same time**. If your wife opened the link while you were offline, she got an empty list. That is a limitation of peer-to-peer — there is no server to store data.

## Current solution: Supabase cloud (free)

```
  Phone 1 ──→  ☁️ Supabase (free cloud)  ←── Phone 2
  Phone 3 ──→         ↑
  Maid    ──→    shared basket + members
```

| Feature | How it works |
|---|---|
| **Add item** | Saved to cloud instantly |
| **Join from link** | Downloads existing basket from cloud |
| **New family member** | Registered in cloud, visible to owner |
| **Auto sync** | Every 12 seconds + realtime push |
| **Manual sync** | **Sync now** button in Family tab |
| **Offline** | Cached on device; syncs when back online |

## Setup required (one time)

See **[SUPABASE-SETUP.md](SUPABASE-SETUP.md)** — 5 minutes, ₹0 forever.

Without Supabase config, the app works on **one device only**.

## Manual sync

Use **🔄 Sync now** in the **Family** tab when:
- Family member just joined
- List looks outdated
- Header dot is red (error)
- After fixing Supabase config

## Error handling

| Error | What happens |
|---|---|
| Cloud unreachable | Toast: "Save failed — tap Sync now" |
| Sync fails | Red dot + error text in Family tab |
| Item saved locally | Pushed to cloud on next successful sync |

---

*See also: [SUPABASE-SETUP.md](SUPABASE-SETUP.md) · [DEPLOY.md](DEPLOY.md)*
