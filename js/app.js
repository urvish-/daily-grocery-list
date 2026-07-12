(function () {
  "use strict";

  const USER_KEY = "groceryUser";
  const MEMBER_ID_KEY = "groceryMemberId";
  const HOUSEHOLD_ID_KEY = "groceryHouseholdId";
  const ROLE_KEY = "groceryRole";

  let catalog = { categories: [] };
  let listItems = [];
  let members = [];
  let householdMeta = null;
  let userName = "";
  let memberId = "";
  let householdId = "";
  let userRole = "";
  let activePanel = "list";
  let activeCategoryId = null;
  let searchQuery = "";
  let sheetProduct = null;
  let sheetQty = 0;
  let syncEnabled = true;
  let syncStatus = { ok: true, syncing: false, time: null, error: null, cloud: false };
  let deferredInstallPrompt = null;
  let unsubscribeItems = null;
  let unsubscribeMembers = null;
  let unsubscribeMeta = null;

  const $ = (sel) => document.querySelector(sel);

  function isAppInstalled() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isIOSChrome() {
    return isIOS() && /CriOS/i.test(navigator.userAgent);
  }

  function isIOSNonSafari() {
    return isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
  }

  function isIOSSafari() {
    return isIOS() && !isIOSNonSafari();
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function updateInstallButton() {
    const btn = $("#installBtn");
    if (!btn) return;
    if (isAppInstalled()) {
      btn.classList.add("hidden");
      return;
    }
    btn.classList.remove("hidden");
  }

  function showInstallModal() {
    $("#installModal").classList.remove("hidden");
    const chromeOnIOS = isIOSNonSafari();
    $("#installIOSChrome").classList.toggle("hidden", !chromeOnIOS);
    $("#installIOS").classList.toggle("hidden", !isIOSSafari());
    $("#installAndroid").classList.toggle("hidden", !isAndroid() || isIOS());
    $("#installDesktop").classList.toggle("hidden", isIOS() || isAndroid());
  }

  function showIOSChromeBanner() {
    if (isIOSNonSafari() && !isAppInstalled()) {
      $("#iosChromeBanner").classList.remove("hidden");
    }
  }

  function copyLinkForSafari() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(function () {
      showToast("Link copied! Open Safari → paste in address bar");
    }).catch(function () {
      showToast("Copy this URL: " + url);
    });
  }

  function hideInstallModal() {
    $("#installModal").classList.add("hidden");
  }

  async function handleInstallClick() {
    if (isAppInstalled()) {
      showToast("App already installed on home screen");
      return;
    }
    if (isIOSNonSafari()) {
      showInstallModal();
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (outcome === "accepted") {
        showToast("App installed!");
        updateInstallButton();
      }
      return;
    }
    showInstallModal();
  }

  function setupInstallPrompt() {
    updateInstallButton();
    showIOSChromeBanner();
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      updateInstallButton();
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      updateInstallButton();
      showToast("App installed on home screen!");
    });
  }

  // ── Local identity ──

  function loadIdentity() {
    userName = localStorage.getItem(USER_KEY) || "";
    memberId = localStorage.getItem(MEMBER_ID_KEY) || "";
    householdId = localStorage.getItem(HOUSEHOLD_ID_KEY) || "";
    userRole = localStorage.getItem(ROLE_KEY) || "";

    if (!memberId) {
      memberId = GrocerySync.genId("m");
      localStorage.setItem(MEMBER_ID_KEY, memberId);
    }
  }

  function saveIdentity() {
    localStorage.setItem(USER_KEY, userName);
    localStorage.setItem(MEMBER_ID_KEY, memberId);
    localStorage.setItem(HOUSEHOLD_ID_KEY, householdId);
    localStorage.setItem(ROLE_KEY, userRole);
  }

  function getShareUrl() {
    const base = window.location.origin + window.location.pathname;
    return base + "?home=" + encodeURIComponent(householdId);
  }

  function parseHomeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("home") || "";
  }

  function clearHomeParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete("home");
    window.history.replaceState({}, "", url.pathname + url.search);
  }

  // ── Catalog ──

  async function loadCatalog() {
    if (window.GROCERY_CATALOG?.categories?.length) {
      catalog = window.GROCERY_CATALOG;
    } else {
      try {
        const res = await fetch("data/default-catalog.json");
        if (!res.ok) throw new Error("fetch failed");
        catalog = await res.json();
      } catch {
        catalog = { categories: [] };
        return false;
      }
    }
    if (!activeCategoryId && catalog.categories.length) {
      activeCategoryId = catalog.categories[0].id;
    }
    return true;
  }

  function findProduct(productId) {
    for (const cat of catalog.categories) {
      const p = cat.products.find((x) => x.id === productId);
      if (p) return { ...p, categoryId: cat.id, categoryName: cat.name, categoryColor: cat.color };
    }
    return null;
  }

  function findCategory(id) {
    return catalog.categories.find((c) => c.id === id);
  }

  function formatQty(qty, unit) {
    if (unit === "kg" || unit === "liter") {
      return qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2).replace(/\.?0+$/, "");
    }
    if (unit === "dozen" && qty % 1 !== 0) return qty.toFixed(1);
    return Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/\.?0+$/, "");
  }

  function qtyLabel(qty, unit) {
    const n = formatQty(qty, unit);
    const labels = {
      kg: "kg", g: "g", liter: "L", ml: "ml",
      count: "pcs", pack: "pack", bunch: "bunch",
      dozen: "dz", pair: "pair", roll: "roll", box: "box"
    };
    return `${n} ${labels[unit] || unit}`;
  }

  function roundQty(qty) {
    return Math.round(qty * 1000) / 1000;
  }

  function pendingItems() {
    return listItems.filter((i) => i.status === "pending");
  }

  function getListItemForProduct(productId) {
    return listItems.find((i) => i.productId === productId && i.status === "pending");
  }

  function isOwner() {
    return userRole === "owner";
  }

  // ── Sync ──

  function startSync() {
    if (!householdId) return;

    if (unsubscribeItems) unsubscribeItems();
    if (unsubscribeMembers) unsubscribeMembers();
    if (unsubscribeMeta) unsubscribeMeta();

    unsubscribeItems = GrocerySync.listenItems(householdId, (items) => {
      listItems = items.filter((i) => i.status === "pending");
      render();
    });

    unsubscribeMembers = GrocerySync.listenMembers(householdId, (m) => {
      members = m.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
      renderFamilyPanel();
    });

    unsubscribeMeta = GrocerySync.listenHouseholdMeta(householdId, (meta) => {
      householdMeta = meta;
      renderHeader();
      renderFamilyPanel();
    });

    GrocerySync.onSyncStatusChange((s) => {
      syncStatus = s;
      renderHeader();
      renderFamilyPanel();
    });
    syncStatus = GrocerySync.getSyncStatus();

    GrocerySync.startAutoSync(householdId, memberId);
    setTimeout(() => GrocerySync.syncNow(householdId, memberId).catch(() => {}), 500);
  }

  async function manualSync() {
    if (!householdId) {
      showToast("Create or join a home first");
      return;
    }
    const btn = $("#syncNowBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Syncing…";
    }
    const result = await GrocerySync.syncNow(householdId, memberId);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🔄 Sync now";
    }
    if (result.ok) showToast("Synced via pub/sub ✓");
    else showToast("Sync failed: " + (result.error || "check internet"));
    render();
  }

  async function persistItem(item) {
    if (syncEnabled && householdId) {
      try {
        await GrocerySync.setItem(householdId, item, memberId);
      } catch (e) {
        showToast("Save failed — tap Sync now in Family tab");
        throw e;
      }
    }
  }

  async function deleteItem(itemId) {
    if (syncEnabled && householdId) {
      try {
        await GrocerySync.removeItem(householdId, itemId, memberId);
      } catch (e) {
        showToast("Update failed — tap Sync now in Family tab");
        throw e;
      }
    } else {
      listItems = listItems.filter((i) => i.id !== itemId);
      render();
    }
  }

  // ── List operations ──

  async function addOrUpdateItem(product, qty) {
    if (!householdId) {
      showToast("Create or join a home first (Family tab)");
      return;
    }
    const existing = getListItemForProduct(product.id);
    if (existing) {
      existing.qty = roundQty(existing.qty + qty);
      if (existing.qty <= 0) {
        await deleteItem(existing.id);
        showToast(`${product.name} removed`);
        return;
      }
      await persistItem(existing);
    } else if (qty > 0) {
      const item = {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        icon: product.icon,
        categoryId: product.categoryId,
        qty: roundQty(qty),
        unit: product.unit,
        status: "pending",
        addedBy: userName,
        addedAt: new Date().toISOString()
      };
      await persistItem(item);
    }
    showToast(`${product.name} — ${qtyLabel(roundQty(qty), product.unit)} added`);
  }

  async function adjustItemQty(itemId, delta, step) {
    const item = listItems.find((i) => i.id === itemId);
    if (!item) return;
    item.qty = roundQty(item.qty + delta * step);
    if (item.qty <= 0) {
      await deleteItem(itemId);
      showToast(`${item.name} removed`);
      return;
    }
    await persistItem(item);
    showToast(`${item.name} updated`);
  }

  async function markPurchased(itemId) {
    const item = listItems.find((i) => i.id === itemId);
    if (!item) return;

    const el = document.querySelector(`[data-item-id="${itemId}"]`);
    const finish = async () => {
      try {
        await deleteItem(itemId);
        showToast(`${item.name} purchased ✓`);
      } catch {
        showToast("Could not sync purchase — tap Sync now");
      }
    };

    if (el) {
      el.classList.add("purchased-anim");
      setTimeout(finish, 350);
    } else {
      await finish();
    }
  }

  // ── Household setup ──

  async function createHousehold(homeName, name) {
    userName = name;
    userRole = "owner";
    householdId = await GrocerySync.createHousehold(homeName, name, memberId);
    saveIdentity();
    clearHomeParam();
    startSync();
    hideSetupModal();
    render();
    $("#syncInfo").classList.remove("hidden");
    showToast("Home created! Share link with family.");
  }

  async function joinHousehold(hId, name) {
    userName = name;
    await GrocerySync.joinHousehold(hId, name, memberId);
    householdId = hId;
    const home = await GrocerySync.getHousehold(hId);
    const me = home?.members?.[memberId];
    userRole = me?.role || "member";
    saveIdentity();
    clearHomeParam();
    startSync();
    hideSetupModal();
    render();
    $("#syncInfo").classList.remove("hidden");
    showToast("Joined household!");
  }

  // ── Sheet ──

  function openSheet(productId) {
    const product = findProduct(productId);
    if (!product) return;
    sheetProduct = product;
    sheetQty = product.defaultQty;
    renderSheet();
    $("#sheetOverlay").classList.remove("hidden");
  }

  function closeSheet() {
    $("#sheetOverlay").classList.add("hidden");
    sheetProduct = null;
  }

  function renderSheet() {
    if (!sheetProduct) return;
    const cat = findCategory(sheetProduct.categoryId);
    $("#sheetIcon").textContent = sheetProduct.icon;
    $("#sheetIcon").style.background = (cat?.color || "#e8f5e9") + "33";
    $("#sheetName").textContent = sheetProduct.name;
    $("#sheetCategory").textContent = sheetProduct.categoryName;
    $("#sheetQty").textContent = qtyLabel(sheetQty, sheetProduct.unit);
  }

  function sheetAdjust(delta) {
    if (!sheetProduct) return;
    sheetQty = roundQty(sheetQty + delta * sheetProduct.step);
    if (sheetQty < sheetProduct.step) sheetQty = sheetProduct.step;
    renderSheet();
  }

  function sheetConfirm() {
    if (!sheetProduct) return;
    addOrUpdateItem(sheetProduct, sheetQty);
    closeSheet();
  }

  // ── Toast ──

  let toastTimer = null;
  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ── Render ──

  function renderHeader() {
    $("#userBadge").textContent = userName || "Set name";
    const homeLabel = householdMeta?.name || (householdId ? "Shared Home" : "");
    $("#householdLabel").textContent = homeLabel;
    $("#householdLabel").classList.toggle("hidden", !homeLabel);

    const count = pendingItems().length;
    $("#listCount").textContent = count;
    const badge = $("#navBadge");
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }

    const syncDot = $("#syncStatus");
    if (syncDot) {
      let cls = "offline";
      let title = "Not in a household";
      if (householdId) {
        if (!syncStatus.cloud) {
          cls = "waiting";
          title = "Connecting to pub/sub broker…";
        } else if (syncStatus.error) {
          cls = "error";
          title = "Sync error: " + syncStatus.error;
        } else if (syncStatus.syncing) {
          cls = "waiting";
          title = "Syncing…";
        } else {
          cls = "online";
          title = syncStatus.time
            ? "Pub/sub sync OK · " + new Date(syncStatus.time).toLocaleTimeString()
            : "Pub/sub sync active";
        }
      }
      syncDot.className = "sync-dot " + cls;
      syncDot.title = title;
    }
  }

  function renderListPanel() {
    const items = pendingItems();
    const container = $("#listItems");
    const empty = $("#listEmpty");

    if (!items.length) {
      container.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");
    container.innerHTML = items.map((item) => {
      const cat = findCategory(item.categoryId);
      const step = findProduct(item.productId)?.step || 1;
      return `
        <div class="list-item" data-item-id="${item.id}">
          <div class="item-icon" style="background:${(cat?.color || "#4caf50")}22">${item.icon}</div>
          <div class="item-info">
            <div class="item-name">${esc(item.name)}</div>
            <div class="item-meta">${qtyLabel(item.qty, item.unit)} · ${esc(item.addedBy || "Someone")}</div>
          </div>
          <div class="qty-stepper">
            <button class="qty-btn" data-action="dec" data-id="${item.id}" data-step="${step}">−</button>
            <span class="qty-value">${qtyLabel(item.qty, item.unit)}</span>
            <button class="qty-btn" data-action="inc" data-id="${item.id}" data-step="${step}">+</button>
          </div>
          <button class="buy-btn" data-action="buy" data-id="${item.id}">✓</button>
        </div>`;
    }).join("");
  }

  function renderCatalogPanel() {
    const chips = $("#categoryChips");
    const grid = $("#productGrid");

    if (!catalog.categories.length) {
      chips.innerHTML = "";
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Catalog not loaded.</p></div>`;
      return;
    }

    chips.innerHTML = catalog.categories.map((cat) => `
      <button class="category-chip${cat.id === activeCategoryId ? " active" : ""}" data-category="${cat.id}">
        <span class="chip-icon">${cat.icon}</span>${esc(cat.name)}
      </button>`).join("");

    let products = [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = catalog.categories.flatMap((c) =>
        c.products.map((p) => ({ ...p, categoryId: c.id, categoryName: c.name }))
      ).filter((p) => p.name.toLowerCase().includes(q));
    } else {
      const cat = findCategory(activeCategoryId) || catalog.categories[0];
      if (cat && !activeCategoryId) activeCategoryId = cat.id;
      products = cat ? cat.products : [];
    }

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No products found.</p></div>`;
      return;
    }

    grid.innerHTML = products.map((p) => {
      const inList = getListItemForProduct(p.id);
      return `
        <div class="product-card${inList ? " in-list" : ""}" data-product="${p.id}">
          <div class="product-card-icon">${p.icon}</div>
          <div class="product-card-name">${esc(p.name)}</div>
          ${inList ? `<div class="in-list-badge">${qtyLabel(inList.qty, inList.unit)}</div>` : ""}
        </div>`;
    }).join("");
  }

  function renderFamilyPanel() {
    const shareUrl = householdId ? getShareUrl() : "";
    $("#shareLinkInput").value = shareUrl;

    const membersSection = $("#membersSection");
    const membersList = $("#membersList");

    if (!householdId) {
      membersSection.classList.add("hidden");
      return;
    }

    if (isOwner()) {
      membersSection.classList.remove("hidden");
      membersList.innerHTML = members.map((m) => `
        <div class="member-row">
          <div class="member-avatar">${esc(m.name.charAt(0).toUpperCase())}</div>
          <div class="member-info">
            <div class="member-name">${esc(m.name)}${m.id === memberId ? " (you)" : ""}</div>
            <div class="member-meta">${m.role === "owner" ? "Owner · Creator" : "Member"} · joined ${formatDate(m.joinedAt)}</div>
          </div>
          ${m.role === "owner" ? '<span class="member-badge">👑</span>' : ""}
        </div>`).join("") || `<p class="text-muted">No members yet.</p>`;
    } else {
      membersSection.classList.add("hidden");
    }

    $("#familyHomeName").textContent = householdMeta?.name || "Shared Home";
    $("#memberCount").textContent = members.length ? `${members.length} member${members.length > 1 ? "s" : ""}` : "";

    const syncLabel = $("#syncStatusLabel");
    if (syncLabel) {
      if (!GrocerySync.isCloudReady()) {
        syncLabel.textContent = "Connecting to MQTT pub/sub broker…";
        syncLabel.className = "sync-status-label";
      } else if (syncStatus.error) {
        syncLabel.textContent = "❌ " + syncStatus.error;
        syncLabel.className = "sync-status-label error";
      } else if (syncStatus.syncing) {
        syncLabel.textContent = "Syncing…";
        syncLabel.className = "sync-status-label";
      } else if (syncStatus.time) {
        syncLabel.textContent = "✓ Last synced " + new Date(syncStatus.time).toLocaleTimeString();
        syncLabel.className = "sync-status-label ok";
      } else {
        syncLabel.textContent = "Auto-sync via MQTT pub/sub (real-time)";
        syncLabel.className = "sync-status-label";
      }
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function renderPanels() {
    $("#listPanel").classList.toggle("hidden", activePanel !== "list");
    $("#catalogPanel").classList.toggle("hidden", activePanel !== "catalog");
    $("#familyPanel").classList.toggle("hidden", activePanel !== "family");
    $("#navList").classList.toggle("active", activePanel === "list");
    $("#navCatalog").classList.toggle("active", activePanel === "catalog");
    $("#navFamily").classList.toggle("active", activePanel === "family");
  }

  function render() {
    renderHeader();
    renderListPanel();
    renderCatalogPanel();
    renderFamilyPanel();
    renderPanels();
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  // ── Modals ──

  function showNameModal() {
    $("#nameModal").classList.remove("hidden");
    $("#nameInput").value = userName;
    $("#nameInput").focus();
  }

  function hideNameModal() {
    $("#nameModal").classList.add("hidden");
  }

  function confirmName() {
    const name = $("#nameInput").value.trim();
    if (!name) { $("#nameInput").focus(); return; }
    userName = name;
    saveIdentity();
    hideNameModal();
    if (syncEnabled && householdId) {
      GrocerySync.joinHousehold(householdId, name, memberId).catch(() => {});
    }
    render();
  }

  function showSetupModal(mode) {
    $("#setupModal").classList.remove("hidden");
    $("#setupChoice").classList.add("hidden");
    $("#setupCreate").classList.toggle("hidden", mode !== "create");
    $("#setupJoin").classList.toggle("hidden", mode !== "join");
    if (mode === "join") {
      const fromUrl = parseHomeFromUrl();
      if (fromUrl) $("#joinCodeInput").value = fromUrl;
    }
  }

  function showSetupChoice() {
    $("#setupModal").classList.remove("hidden");
    $("#setupChoice").classList.remove("hidden");
    $("#setupCreate").classList.add("hidden");
    $("#setupJoin").classList.add("hidden");
  }

  function hideSetupModal() {
    $("#setupModal").classList.add("hidden");
  }

  async function handleCreateHome() {
    const homeName = $("#createHomeName").value.trim() || "My Home";
    const name = $("#createUserName").value.trim();
    if (!name) { $("#createUserName").focus(); return; }
    try {
      await createHousehold(homeName, name);
    } catch (e) {
      showToast("Could not create home: " + (e.message || "try again"));
    }
  }

  async function handleJoinHome() {
    const code = $("#joinCodeInput").value.trim().replace(/^.*home=/, "").split("&")[0];
    const name = $("#joinUserName").value.trim();
    if (!code) { $("#joinCodeInput").focus(); return; }
    if (!name) { $("#joinUserName").focus(); return; }
    try {
      await joinHousehold(code, name);
    } catch (e) {
      showToast("Could not join: " + (e.message || "check link & cloud setup"));
    }
  }

  function copyShareLink() {
    const input = $("#shareLinkInput");
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      showToast("Link copied! Send to family on WhatsApp.");
    }).catch(() => {
      input.select();
      document.execCommand("copy");
      showToast("Link copied!");
    });
  }

  async function shareViaNative() {
    const url = getShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join our Grocery List",
          text: "Add items to our shared household grocery list:",
          url
        });
      } catch { /* cancelled */ }
    } else {
      copyShareLink();
    }
  }

  // ── Events ──

  function bindEvents() {
    $("#navList").addEventListener("click", () => {
      hideSetupModal();
      activePanel = "list";
      render();
    });
    $("#navCatalog").addEventListener("click", () => {
      hideSetupModal();
      activePanel = "catalog";
      render();
    });
    $("#navFamily").addEventListener("click", () => {
      hideSetupModal();
      activePanel = "family";
      render();
    });

    $("#userBadge").addEventListener("click", showNameModal);
    $("#nameConfirm").addEventListener("click", confirmName);
    $("#nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmName(); });

    $("#searchBox").addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderCatalogPanel();
    });

    $("#categoryChips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-category]");
      if (!chip) return;
      activeCategoryId = chip.dataset.category;
      searchQuery = "";
      $("#searchBox").value = "";
      renderCatalogPanel();
    });

    $("#productGrid").addEventListener("click", (e) => {
      const card = e.target.closest("[data-product]");
      if (card) openSheet(card.dataset.product);
    });

    $("#listItems").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;
      const step = parseFloat(btn.dataset.step) || 1;
      if (action === "inc") adjustItemQty(id, 1, step);
      else if (action === "dec") adjustItemQty(id, -1, step);
      else if (action === "buy") markPurchased(id);
    });

    $("#sheetMinus").addEventListener("click", () => sheetAdjust(-1));
    $("#sheetPlus").addEventListener("click", () => sheetAdjust(1));
    $("#sheetAdd").addEventListener("click", sheetConfirm);
    $("#sheetCancel").addEventListener("click", closeSheet);
    $("#sheetOverlay").addEventListener("click", (e) => {
      if (e.target === $("#sheetOverlay")) closeSheet();
    });

    $("#copyLinkBtn").addEventListener("click", copyShareLink);
    $("#shareLinkBtn").addEventListener("click", shareViaNative);
    $("#syncNowBtn").addEventListener("click", manualSync);
    $("#createHomeBtn").addEventListener("click", handleCreateHome);
    $("#joinHomeBtn").addEventListener("click", handleJoinHome);
    $("#showCreateBtn").addEventListener("click", () => showSetupModal("create"));
    $("#showJoinBtn").addEventListener("click", () => showSetupModal("join"));
    $("#skipSetupBtn").addEventListener("click", () => {
      hideSetupModal();
      activePanel = "catalog";
      render();
      showToast("Browse products — create home from Family tab to save list");
    });
    $("#skipJoinBtn").addEventListener("click", () => {
      hideSetupModal();
      activePanel = "catalog";
      render();
    });

    $("#installBtn").addEventListener("click", handleInstallClick);
    $("#iosSafariHelpBtn").addEventListener("click", showInstallModal);
    $("#copySafariLinkBtn").addEventListener("click", copyLinkForSafari);
    $("#installModalClose").addEventListener("click", hideInstallModal);
    $("#installModal").addEventListener("click", (e) => {
      if (e.target === $("#installModal")) hideInstallModal();
    });
  }

  // ── Init ──

  async function init() {
    loadIdentity();
    bindEvents();
    setupInstallPrompt();
    await loadCatalog();

    if (!GrocerySync.isConfigured()) {
      $("#cloudWarning").classList.remove("hidden");
    }

    const urlHome = parseHomeFromUrl();

    if (householdId) {
      try {
        const home = await GrocerySync.getHousehold(householdId);
        if (home) {
          const me = home.members?.[memberId];
          if (me) userRole = me.role;
          startSync();
        } else if (!urlHome) {
          householdId = "";
          saveIdentity();
        }
      } catch {
        showToast("Sync connection failed");
      }
    }

    if (householdId) {
      $("#syncInfo").classList.remove("hidden");
    }

    render();
    updateInstallButton();

    if (urlHome && urlHome !== householdId) {
      showSetupModal("join");
    } else if (!householdId) {
      showSetupModal("create");
    } else if (!userName) {
      showNameModal();
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  function boot() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
