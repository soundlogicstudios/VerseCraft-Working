
function ensureGameCharacterButton() {
  if (document.getElementById("gameCharacterBtn")) return;
  const topbar = document.querySelector("#screen-game .topbar");
  if (!topbar) return;
  const btn = document.createElement("button");
  btn.id = "gameCharacterBtn";
  btn.className = "btn btn-utility";
  btn.textContent = "Character";
  btn.addEventListener("click", () => openCharacterScreen());
  const menuBtn = document.getElementById("gameMenuBtn");
  if (menuBtn && menuBtn.parentNode === topbar) {
    topbar.insertBefore(btn, menuBtn);
  } else {
    topbar.appendChild(btn);
  }
}

/* VerseCraft — Clean Foundation (v0.0.5)
   Scope for v0.0.5:
   - Fix story URL resolution (pack-relative) and remain backward-safe for older absolute-like paths
   - Minimal single-slot save/load (versioned) + Continue Story button
   - Debug panel via ?debug=1
   - No save slots, no schema locking, no extra systems
*/

(() => {
  "use strict";

  const ENGINE_VERSION = "0.1.62";
  const CONTENT_ROOT = "./content/";
  

  // Menu background art (lowercase, canonical)
    const MENU_SKIN_SAVE_URL = "./backgrounds/ui/VerseCraft_Menu_save.webp";
    const MENU_SKIN_NOSAVE_URL = "./backgrounds/ui/VerseCraft_Menu_nosave.webp";
const CATALOG_URL = CONTENT_ROOT + "Catalog.json";
  const SAVE_KEY = "versecraft.save.v1";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const el = {
    orientationOverlay: $("orientationOverlay"),

    // screens
    screens: {
      menu: $("screen-menu"),
      settings: $("screen-settings"),
      catalog: $("screen-catalog"),
      stories: $("screen-stories"),
      game: $("screen-game"),
      character: $("screen-character"),
    },

    // menu buttons
    btnLoadNew: $("btnLoadNew"),
    btnContinue: $("btnContinue"),
    btnSettings: $("btnSettings"),

    // Menu skin affordances
    continueDisabledMask: $("continueDisabledMask"),

    // settings
    btnSettingsBack: $("btnSettingsBack"),
    settingsDebug: $("settingsDebug"),
    settingsContentRoot: $("settingsContentRoot"),
    settingsCatalogPath: $("settingsCatalogPath"),
    settingsSaveStatus: $("settingsSaveStatus"),
    btnClearSave: $("btnClearSave"),

    // catalog
    btnCatalogBack: $("btnCatalogBack"),
    btnCatalogReload: $("btnCatalogReload"),
    catalogList: $("catalogList"),

    // stories
    btnStoriesBack: $("btnStoriesBack"),
    storiesPackLabel: $("storiesPackLabel"),
    storiesList: $("storiesList"),

    // game
    btnGameBack: $("btnGameBack"),
    btnGameMenu: $("btnGameMenu"),
    btnGameCharacter: $("btnGameCharacter"),
    gameTitle: $("gameTitle"),
    gameSectionLabel: $("gameSectionLabel"),
    gameText: $("gameText"),
    gameEcho: $("gameEcho"),
    gameChoices: $("gameChoices"),

    // character
    btnCharacterBack: $("btnCharacterBack"),
    btnCharacterMenu: $("btnCharacterMenu"),
    charStoryLabel: $("charStoryLabel"),
    charHpLabel: $("charHpLabel"),
    charHpFill: $("charHpFill"),
    charXp: $("charXp"),
    charCurrency: $("charCurrency"),
    slotLabelWeapon: $("slotLabelWeapon"),
    slotLabelArmor: $("slotLabelArmor"),
    slotLabelSpecial: $("slotLabelSpecial"),
    charEquipWeapon: $("charEquipWeapon"),
    charEquipArmor: $("charEquipArmor"),
    charEquipSpecial: $("charEquipSpecial"),
    charInventoryList: $("charInventoryList"),
    charFlagsList: $("charFlagsList"),

    // debug
    debugPanel: $("debugPanel"),
    debugBody: $("debugBody"),
    btnDebugClose: $("btnDebugClose"),
    btnDebugSnapshot: $("btnDebugSnapshot"),
    btnDebugCopy: $("btnDebugCopy"),
    btnDebugToggle: $("btnDebugToggle"),

    // modal
    modalBackdrop: $("modalBackdrop"),
    modalTitle: $("modalTitle"),
    modalText: $("modalText"),
    btnModalClose: $("btnModalClose"),
  };

  // Root scroller (internal app scroll container)
  el.screensRoot = document.querySelector(".screens");

  
// ---------- Orientation Policy (Portrait-First) ----------
// VerseCraft menu skins are calibrated for portrait. In landscape we show a lightweight
// overlay and disable interactions to prevent hitbox drift during iOS Safari rotations.
const LANDSCAPE_CLASS = "vc-landscape";
function applyOrientationPolicy() {
  const isLandscape = window.innerWidth > window.innerHeight;
  document.body.classList.toggle(LANDSCAPE_CLASS, isLandscape);
  if (el.orientationOverlay) el.orientationOverlay.hidden = !isLandscape;
}
// Run once now, and on any viewport changes.
applyOrientationPolicy();
window.addEventListener("resize", applyOrientationPolicy, { passive: true });
window.addEventListener("orientationchange", () => setTimeout(applyOrientationPolicy, 80), { passive: true });

// ---------- Debug ----------
  const DEBUG = (() => {
  try {
    const sp = new URLSearchParams(location.search || "");
    if (sp.get("debug") === "1") return true;
    // Back-compat: allow #debug=1 (some share flows drop query strings)
    const h = String(location.hash || "");
    if (h.includes("debug=1")) return true;
  } catch {}
  return false;
})();

  function log(msg) {
    if (!DEBUG) return;
    const ts = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.className = "debug-line";
    line.innerHTML = `<span class="debug-ts">[${ts}]</span>${escapeHtml(msg)}`;
    el.debugBody.prepend(line);
  }

  function setDebugOpen(isOpen) {
    if (!DEBUG) return;
    el.debugPanel.classList.toggle("open", isOpen);
    if (el.btnDebugToggle) {
      el.btnDebugToggle.setAttribute("aria-pressed", isOpen ? "true" : "false");
    }
  }

  function toggleDebug() {
    if (!DEBUG) return;
    const isOpen = el.debugPanel.classList.contains("open");
    setDebugOpen(!isOpen);
  }

  
// ---------- Debug Hardening (Phase 2) ----------
// Capture unexpected errors and promise rejections into the debug log
// without impacting normal gameplay (only active when ?debug=1).
function installDebugErrorHooks() {
  if (!DEBUG) return;
  try {
    window.addEventListener("error", (e) => {
      const msg = e?.message || "Unknown error";
      const src = e?.filename ? ` @ ${e.filename}:${e.lineno || 0}:${e.colno || 0}` : "";
      log(`⚠️ JS Error: ${msg}${src}`);
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e?.reason;
      const msg = reason?.message || String(reason || "Unhandled rejection");
      log(`⚠️ Promise Rejection: ${msg}`);
    });
  } catch {
    // Never crash the app due to debug hooks.
  }
}

function getDebugSnapshotText() {
  const vv = window.visualViewport;
  const lines = [];
  lines.push("=== Snapshot ===");
  lines.push(`URL: ${location.href}`);
  lines.push(`Screen: ${currentScreen}`);
  lines.push(`Engine: v${ENGINE_VERSION}`);
  lines.push(`Body classes: ${(document.body && document.body.className) || "(none)"}`);
  lines.push(`UA: ${navigator.userAgent}`);
  lines.push(`DPR: ${window.devicePixelRatio || 1}`);
  lines.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
  if (vv) {
    lines.push(`VisualViewport: ${Math.round(vv.width)}x${Math.round(vv.height)} offset(${Math.round(vv.offsetLeft)} , ${Math.round(vv.offsetTop)}) scale(${vv.scale || 1})`);
  } else {
    lines.push("VisualViewport: (not supported)");
  }
  if (el?.screensRoot) {
    lines.push(`App scrollTop: ${Math.round(el.screensRoot.scrollTop || 0)}`);
  }
  if (state?.packBaseUrl) lines.push(`Pack base: ${state.packBaseUrl}`);
  if (state?.selectedPackUrl) lines.push(`Pack.json: ${state.selectedPackUrl}`);
  if (state?.storyUrl) lines.push(`Story URL: ${state.storyUrl}`);
  if (state?.selectedStoryMeta?.cover?.path) lines.push(`Cover path: ${state.selectedStoryMeta.cover.path}`);
  lines.push("================");
  return lines.join("\n");
}

function logDebugSnapshot() {
  if (!DEBUG) return;
  const snap = getDebugSnapshotText().split("\n");
  snap.forEach((l) => log(l));
}

async function copyDebugToClipboard() {
  if (!DEBUG) return;
  try {
    const snap = getDebugSnapshotText();
    const bodyText = (el.debugBody && el.debugBody.innerText) ? el.debugBody.innerText.trim() : "";
    const payload = [snap, bodyText].filter(Boolean).join("\n\n");
    // Prefer Clipboard API (requires user gesture; this is a button click).
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(payload);
      log("✅ Debug copied to clipboard");
      return;
    }
    // Fallback: temporary textarea
    const ta = document.createElement("textarea");
    ta.value = payload;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    log("✅ Debug copied (fallback)");
  } catch (e) {
    log(`Copy failed: ${String(e?.message || e)}`);
  }
}

// ---------- Modal ----------
  function showModal(title, text) {
    el.modalTitle.textContent = title || "Notice";
    el.modalText.textContent = text || "";
    el.modalBackdrop.hidden = false;
  }

  function hideModal() {
    el.modalBackdrop.hidden = true;
  }

  // ---------- Screen + Pillbox ----------
  let currentScreen = "menu";

  // ---------- Phase 4: Navigation Hardening ----------
  // Simple screen stack so "Back" always returns to the correct context.
  const nav = {
    stack: [],
    // When a game is launched, remember where it came from ("stories" vs "menu/continue").
    gameOrigin: "menu",
  };

  function stackToString() {
    try { return "[" + nav.stack.join("→") + "]"; } catch { return "[]"; }
  }

  function navTo(screen, reason, opts = {}) {
    const next = String(screen || "");
    if (!next) return;

    // Reset stack (used for "Menu" jumps and Continue).
    if (opts.reset) {
      nav.stack = Array.isArray(opts.seed) ? opts.seed.slice(0) : [];
    }

    // Push current screen unless this is a back/replace navigation.
    const replace = !!opts.replace;
    const isBack = !!opts.isBack;
    if (!replace && !isBack && currentScreen && currentScreen !== next) {
      nav.stack.push(currentScreen);
      // Bound stack to prevent runaway growth.
      if (nav.stack.length > 32) nav.stack = nav.stack.slice(nav.stack.length - 32);
    }

    setScreen(next);
    log(`NAV: ${currentScreen} ← ${reason || "navTo"} stack=${stackToString()}`);
  }

  function navBack(fallback, reason) {
    const dest = nav.stack.pop() || fallback || "menu";
    setScreen(dest);
    log(`NAV BACK: ${dest} ← ${reason || "back"} stack=${stackToString()}`);
  }


  // ---------- Global Scroll Lock (Phase 2.2) ----------
  // Goal: prevent iOS Safari rubber-band / page scroll on ALL screens (body locked),
  // while allowing scrolling inside intended in-app containers.
  const SCROLL_LOCK_CLASS = "vc-scroll-locked";
  const MENU_ACTIVE_CLASS = "vc-menu-active";
  const MENU_PREP_CLASS = "vc-menu-prep";

  function setGlobalScrollLock(locked) {
    const body = document.body;
    if (!body) return;

    const isLocked = body.classList.contains(SCROLL_LOCK_CLASS);
    if (locked && !isLocked) {
      body.classList.add(SCROLL_LOCK_CLASS);
      body.style.top = "0px";
    } else if (!locked && isLocked) {
      body.classList.remove(SCROLL_LOCK_CLASS);
      body.style.top = "";
    }
  }

  function isAllowedScrollTarget(target) {
    if (!target || target === document) return false;
    const node = target.nodeType === 1 ? target : target.parentElement;

    // Always allow scroll inside debug log body.
    if (node && node.closest && node.closest("#debugBody")) return true;

    // Allow scroll inside the main app scroller when NOT on menu.
    if (node && node.closest && node.closest(".screens")) {
      return !document.body.classList.contains(MENU_ACTIVE_CLASS);
    }

    // Allow story text area scroll if it becomes scrollable (game text card).
    if (node && node.closest && node.closest("#gameText")) return true;

    return false;
  }

  // Block touch-driven page scroll when body is locked, except inside allowed scrollers.
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!(document.body && document.body.classList.contains(SCROLL_LOCK_CLASS))) return;
      if (isAllowedScrollTarget(e.target)) return;
      e.preventDefault();
    },
    { passive: false }
  );

  // Also block wheel scroll from trying to move the page (desktop Safari/macOS).
  document.addEventListener(
    "wheel",
    (e) => {
      if (!(document.body && document.body.classList.contains(SCROLL_LOCK_CLASS))) return;
      if (isAllowedScrollTarget(e.target)) return;
      e.preventDefault();
    },
    { passive: false }
  );


  function setScreen(name) {
    // Hide current screen
    Object.values(el.screens).forEach(s => s.classList.remove("active"));

    // Mark screen
    const target = el.screens[name];
    if (target) target.classList.add("active");
    currentScreen = name;


    // Clear any pending echo UI when leaving the game screen.
    if (name !== "game") clearEcho();
    // Global scroll lock ONLY while Menu is active (prevents rubber-band/parallax on the skin)
    // All other screens scroll within the .screens scroller.
    setGlobalScrollLock(name === "menu");

    // Menu return snap fix: re-apply visual viewport vars and hide menu layer for 1 frame
    const body = document.body;
    if (body) {
      body.classList.toggle(MENU_ACTIVE_CLASS, name === "menu");
    }

    if (name === "menu") {
      // Reset in-app scroller so menu always starts at the top (prevents left/right "snap" artifacts).
      if (el.screensRoot) el.screensRoot.scrollTop = 0;

      if (body) body.classList.add(MENU_PREP_CLASS);
      if (typeof window.__vcApplyVV === "function") window.__vcApplyVV();

      // Reveal after layout has settled.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (body) body.classList.remove(MENU_PREP_CLASS);
        });
      });
    } else {
      if (body) body.classList.remove(MENU_PREP_CLASS);
    }

    log(`Screen → ${name}`);
  }

  // Prevent iOS double-tap zoom / odd long-press gestures on the menu skin.
  // (We already disable user-scalable, but iOS can still try to zoom some elements.)
  document.addEventListener(
    "dblclick",
    (e) => {
      if (currentScreen !== "menu") return;
      e.preventDefault();
    },
    { passive: false }
  );

  // ---------- Helpers ----------
  function capitalize(s) {
    return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }

  
  function setAriaDisabled(node, isDisabled) {
    if (!node) return;
    node.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    // Ensure we never rely on native disabled behavior (iOS Safari consistency)
    if (node.hasAttribute("disabled")) node.removeAttribute("disabled");
  }

  function isAriaDisabled(node) {
    return !!node && node.getAttribute("aria-disabled") === "true";
  }

  // ---------- Phase 5B: Systems Layer (Resources / Inventory / Flags) ----------
  function getModule() {
    return state.storyData?.module || null;
  }

  function getPrimaryResourceDef() {
    const m = getModule();
    const pr = m?.primaryResource || null;
    if (!pr || typeof pr !== "object") return { name: "HP", min: 0, max: 15, failureSectionId: null };
    return {
      name: String(pr.name || "HP"),
      min: Number.isFinite(pr.min) ? Number(pr.min) : 0,
      max: Number.isFinite(pr.max) ? Number(pr.max) : 15,
      failureSectionId: pr.failureSectionId ? String(pr.failureSectionId) : null,
    };
  }

  function ensureRunState(fromSave) {
    if (state.run) return state.run;

    const pr = getPrimaryResourceDef();
    const max = pr.max;
    const init = {
      resources: {
        [pr.name]: {
          name: pr.name,
          min: pr.min,
          max: pr.max,
          cur: pr.max,
        },
      },
      xp: 0,
      flags: {},
      inventory: {
        items: [], // [{ category, id, name, qty, value, use, equipSlot }]
        equipped: { weapon: null, armor: null, special: null },
      },
    };

    // Hydrate from save if present
    if (fromSave && typeof fromSave === "object") {
      try {
        if (fromSave.resources && typeof fromSave.resources === "object") init.resources = fromSave.resources;
        if (Number.isFinite(fromSave.xp)) init.xp = Number(fromSave.xp);
        if (fromSave.flags && typeof fromSave.flags === "object") init.flags = fromSave.flags;
        if (fromSave.inventory && typeof fromSave.inventory === "object") init.inventory = fromSave.inventory;
      } catch {}
    }

    state.run = init;
    
  function applyStoryLoadoutOnce() {
    const m = getModule();
    const loadout = m?.loadout || null;
    if (!loadout || typeof loadout !== "object") return;

    // If we already have any inventory, don't re-seed.
    if (Array.isArray(state.run.inventory.items) && state.run.inventory.items.length > 0) return;

    const slots = ["weapon", "armor", "special"];
    slots.forEach((slot) => {
      const it = loadout[slot];
      if (!it || typeof it !== "object") return;

      const cat = String(it.category || (slot === "weapon" ? "weapons" : slot));
      const item = normalizeItem(cat, { id: it.id, name: it.name, qty: 1, equipSlot: slot });
      state.run.inventory.items.push(item);
      state.run.inventory.equipped[slot] = item.id;
    });
  }

return state.run;
  }

  function findCatalogItem(category, id) {
    const m = getModule();
    const cat = m?.itemCatalog || null;
    if (!cat || !category || !id) return null;
    const list = cat[category];
    if (!Array.isArray(list)) return null;
    return list.find((it) => String(it.id) === String(id)) || null;
  }

  function normalizeItem(category, data) {
    const id = String(data?.id || "");
    const name = String(data?.name || data?.title || id || "Item");
    const qty = Number.isFinite(data?.qty) ? Number(data.qty) : 1;
    const value = Number.isFinite(data?.value) ? Number(data.value) : undefined;
    const use = data?.use || undefined;
    const equipSlot = data?.equipSlot || undefined;
    return { category: String(category || "items"), id, name, qty, value, use, equipSlot };
  }

  function getInvIndex(category, id) {
    return state.run.inventory.items.findIndex((it) => it && it.category === category && it.id === id);
  }

  function addItem(payload) {
    const cat = String(payload?.category || "items");
    const base = normalizeItem(cat, payload);
    const idx = getInvIndex(base.category, base.id);
    if (idx >= 0) {
      state.run.inventory.items[idx].qty = (Number(state.run.inventory.items[idx].qty) || 0) + (base.qty || 1);
    } else {
      state.run.inventory.items.push(base);
    }

    // Auto-equip into slot if the payload indicates equipSlot and that slot is empty.
    if (base.equipSlot && state.run.inventory.equipped && !state.run.inventory.equipped[base.equipSlot]) {
      state.run.inventory.equipped[base.equipSlot] = base.id;
    }

    emitEcho(`+ ${base.name}`, false);
  }

  function removeItem(payload) {
    const cat = String(payload?.category || "items");
    const id = String(payload?.id || "");
    const qty = Number.isFinite(payload?.qty) ? Number(payload.qty) : 1;
    if (!cat || !id) return false;

    const idx = getInvIndex(cat, id);
    if (idx < 0) {
      log(`INV WARN: removeItem missing ${cat}:${id}`);
      return false;
    }
    const cur = Number(state.run.inventory.items[idx].qty) || 0;
    const next = Math.max(0, cur - qty);
    state.run.inventory.items[idx].qty = next;
    if (next <= 0) state.run.inventory.items.splice(idx, 1);

    // If this was equipped, unequip.
    const eq = state.run.inventory.equipped || {};
    Object.keys(eq).forEach((slot) => {
      if (eq[slot] === id) eq[slot] = null;
    });

    emitEcho(`- ${id}`, false);
    return true;
  }

  function hasItem(req) {
    // req can be {category,id} or string id (category defaults to items)
    if (!req) return false;
    if (typeof req === "string") {
      return state.run.inventory.items.some((it) => it.id === req && (Number(it.qty) || 0) > 0);
    }
    const cat = String(req.category || "items");
    const id = String(req.id || "");
    if (!id) return false;
    return state.run.inventory.items.some((it) => it.category === cat && it.id === id && (Number(it.qty) || 0) > 0);
  }

  function setFlag(flagName, value = true) {
    if (!flagName) return;
    state.run.flags[String(flagName)] = !!value;
    emitEcho(`Flag: ${String(flagName)} = ${value ? "On" : "Off"}`, false);
  }

  function applyHpDelta(delta) {
    const pr = getPrimaryResourceDef();
    const r = state.run.resources?.[pr.name];
    if (!r) return;

    const prev = Number(r.cur) || 0;
    const next = Math.max(r.min, Math.min(r.max, prev + delta));
    r.cur = next;

    if (delta !== 0) {
      const sign = delta > 0 ? "+" : "";
      emitEcho(`${pr.name} ${sign}${delta} (${next}/${r.max})`, false);
    }

    // Death check
    if (next <= r.min && pr.failureSectionId) {
      log(`RESOURCE: ${pr.name} reached ${next} → failover to ${pr.failureSectionId}`);
      state.sectionId = pr.failureSectionId;
      emitEcho("Run ended: Resource depleted.", true);
    }
  }

  function applyXpDelta(delta) {
    if (!Number.isFinite(delta) || delta === 0) return;
    state.run.xp = (Number(state.run.xp) || 0) + Number(delta);
    const sign = delta > 0 ? "+" : "";
    emitEcho(`XP ${sign}${delta} (${state.run.xp})`, false);
  }

  function applyEffects(effects) {
    if (!effects) return;

    // Object form: { hp: -3, xp: 2 }
    if (!Array.isArray(effects) && typeof effects === "object") {
      if (Number.isFinite(effects.hp)) applyHpDelta(Number(effects.hp));
      if (Number.isFinite(effects.xp)) applyXpDelta(Number(effects.xp));
      return;
    }

    // Array form: [{hp:-3},{setFlag:"X"},{addItem:{...}}]
    if (!Array.isArray(effects)) return;

    effects.forEach((e) => {
      if (!e || typeof e !== "object") return;

      if (Number.isFinite(e.hp)) applyHpDelta(Number(e.hp));
      if (Number.isFinite(e.xp)) applyXpDelta(Number(e.xp));

      if (typeof e.setFlag === "string") setFlag(e.setFlag, true);
      if (typeof e.clearFlag === "string") setFlag(e.clearFlag, false);

      if (e.addItem && typeof e.addItem === "object") addItem(e.addItem);
      if (e.removeItem && typeof e.removeItem === "object") removeItem(e.removeItem);
    });
  }

  
  function choiceMeetsRequires(choice) {
    const req = choice?.requires;
    if (!req) return true;

    // supports: requires.flag, requires.notFlag, requires.hasItem
    if (req.flag) {
      const f = String(req.flag);
      if (!state.run.flags[f]) return false;
    }
    if (req.notFlag) {
      const f = String(req.notFlag);
      if (state.run.flags[f]) return false;
    }
    if (req.hasItem) {
      if (!hasItem(req.hasItem)) return false;
    }
    return true;
  }

  function choiceShouldRender(choice) {
    const req = choice?.requires;
    if (!req) return true;
    const ok = choiceMeetsRequires(choice);
    if (ok) return true;

    // Default tutorial policy: gated choices are hidden unless explicitly requested.
    // (Additive contract: requires.showIfMissing === true makes it visible-but-disabled.)
    if (req && req.showIfMissing === true) return true;
    return false;
  }

function buildHud() {
    // Inject a lightweight HUD above game text (no HTML changes required)
    const node = el.gameText?.parentElement;
    if (!node) return null;
    let hud = document.getElementById("gameHud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "gameHud";
      hud.className = "vc-hud";
      node.insertBefore(hud, el.gameText);
    }
    return hud;
  }

  function renderHud() {
    const hud = buildHud();
    if (!hud || !state.run) return;

    const pr = getPrimaryResourceDef();
    const r = state.run.resources?.[pr.name];
    if (!r) return;

    hud.innerHTML = "";
    const row = document.createElement("div");
    row.className = "vc-hud-row";

    const label = document.createElement("div");
    label.className = "vc-hud-label";
    label.textContent = `${pr.name}: ${r.cur}/${r.max}`;

    const meter = document.createElement("div");
    meter.className = "vc-meter";
    const fill = document.createElement("div");
    fill.className = "vc-meter-fill";
    const pct = r.max > 0 ? Math.round((Number(r.cur) / Number(r.max)) * 100) : 0;
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    meter.appendChild(fill);

    row.appendChild(label);
    row.appendChild(meter);
    hud.appendChild(row);
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function safeJsonParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function cacheBuster(url) {
    const u = new URL(url, location.href);
    u.searchParams.set("_", String(Date.now()));
    return u.toString();
  }

  async function fetchJson(url) {
    const res = await fetch(cacheBuster(url), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url, location.href).pathname}`);
    return await res.json();
  }

  function semverToParts(v) {
    const m = String(v || "").match(/(\d+)\.(\d+)\.(\d+)/);
    if (!m) return [0,0,0];
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function isVersionNewer(a, b) {
    // true if a > b
    const A = semverToParts(a);
    const B = semverToParts(b);
    for (let i=0; i<3; i++) {
      if (A[i] > B[i]) return true;
      if (A[i] < B[i]) return false;
    }
    return false;
  }

  // ---------- State ----------

// ---------- Phase 5C: Creator-defined labels & slots ----------
// Slots are story-defined. Backward-safe:
// - module.slots: [{ key, label }]  (preferred)
// - module.slotLabels: { slotKey: "Label" }
// - module.loadout keys: { slotKey: {...} } (fallback)
// If none, defaults to 3 generic slots.
function getSlotDefs(storyData) {
  const m = storyData?.module || {};
  const slots = [];

  if (Array.isArray(m.slots) && m.slots.length) {
    m.slots.forEach(s => {
      if (!s) return;
      const key = String(s.key || "").trim();
      if (!key) return;
      slots.push({ key, label: String(s.label || key) });
    });
  } else if (m.slotLabels && typeof m.slotLabels === "object") {
    Object.keys(m.slotLabels).forEach(key => {
      slots.push({ key: String(key), label: String(m.slotLabels[key] || key) });
    });
  } else if (m.loadout && typeof m.loadout === "object" && !Array.isArray(m.loadout)) {
    Object.keys(m.loadout).forEach(key => {
      slots.push({ key: String(key), label: String(key) });
    });
  }


  // Optional slot art map: module.slotArt { slotKey: "url" }
  const artMap = (m.slotArt && typeof m.slotArt === "object") ? m.slotArt : null;
  if (artMap) {
    for (let i = 0; i < slots.length; i++) {
      const k = slots[i].key;
      if (slots[i].art == null && artMap[k]) slots[i].art = String(artMap[k]);
    }
  }

  if (!slots.length) {
    return [
      { key: "slot1", label: "Slot 1" },
      { key: "slot2", label: "Slot 2" },
      { key: "slot3", label: "Slot 3" },
    ];
  }

  // Keep stable ordering if story provides it; otherwise sort common keys last-resort
  return slots.map(s => ({...s, art: s.art || null}));
}

function getPrimaryResourceDef(storyData) {
  const pr = storyData?.module?.primaryResource || null;
  if (!pr) return { key: "hp", label: "HP", min: 0, max: 15, failureSectionId: null };
  const key = String(pr.key || "hp");
  const label = String(pr.label || pr.name || pr.title || key.toUpperCase());
  const min = (pr.min != null) ? Number(pr.min) : 0;
  const max = (pr.max != null) ? Number(pr.max) : 15;
  const failureSectionId = pr.failureSectionId || pr.failTo || pr.deathSectionId || null;
  return { key, label, min, max, failureSectionId };
}

function getScalarLabel(storyData, key, fallbackLabel) {
  const m = storyData?.module || {};
  // Optional: module.scalars: [{key,label}]
  if (Array.isArray(m.scalars)) {
    const hit = m.scalars.find(s => s && s.key === key);
    if (hit && hit.label) return String(hit.label);
  }
  // Optional simple overrides
  if (key === "xp" && m.xpLabel) return String(m.xpLabel);
  if (key === "currency" && m.currencyLabel) return String(m.currencyLabel);
  return fallbackLabel;
}


function getCharacterPortraitUrl(storyData) {
  const m = storyData?.module || {};
  // Preferred: module.characterPortraitUrl
  if (m.characterPortraitUrl) return String(m.characterPortraitUrl);
  // Alternate: module.portraitUrl
  if (m.portraitUrl) return String(m.portraitUrl);
  // Optional: module.characterPortrait (string)
  if (m.characterPortrait && typeof m.characterPortrait === "string") return String(m.characterPortrait);
  return null;
}

function getItemIconUrl(storyData, itemId) {
  const cat = storyData?.itemCatalog?.[itemId] || null;
  if (!cat) return null;
  return cat.iconUrl || cat.icon || cat.image || null;
}



// ---------- Phase 5B: Story Loadout (once per run) ----------
// World of Lorecraft defines module.loadout as a SLOT MAP:
// { weapon:{id,...}, armor:{id,...}, special:{id,...} }
// Backward-safe: also accepts an array loadout.
function applyStoryLoadoutOnce(storyData) {
  if (!storyData || !storyData.module) return;
  if (state.run && state.run.loadoutApplied) return;

  const module = storyData.module;

  // Ensure run containers exist
  state.run = state.run || {};
  state.run.flags = state.run.flags || {};
  state.run.inventory = state.run.inventory || { items: [], equipped: { weapon: null, armor: null, special: null } };

  // Primary resource: HP (min/max meter)
  const pr = module.primaryResource || null;
  if (pr && pr.max != null) {
    // Only initialize if absent (continue/save restore should preserve)
    if (state.run.hp == null) state.run.hp = Number(pr.max);
    if (state.run.hpMax == null) state.run.hpMax = Number(pr.max);
    log(`INIT HP → ${state.run.hp}/${state.run.hpMax}`);
  }

  function upsertItem(id, category, qty, title) {
    if (!id) return;
    const items = state.run.inventory.items;
    const found = items.find(x => x && x.id === id);
    if (found) {
      found.qty = Number(found.qty || 0) + Number(qty || 1);
      return;
    }
    items.push({
      id: String(id),
      category: String(category || "items"),
      title: title ? String(title) : null,
      qty: Number(qty || 1),
    });
  }

  // Normalize loadout into a list of entries with slot
  const raw = module.loadout || null;
  const entries = [];

  if (Array.isArray(raw)) {
    raw.forEach((it) => entries.push({ slot: null, item: it }));
  } else if (raw && typeof raw === "object") {
    // Slot map
    Object.keys(raw).forEach((slot) => entries.push({ slot, item: raw[slot] }));
  }

  // Apply loadout entries
  entries.forEach(({ slot, item }) => {
    if (!item) return;
    const id = item.id || item.itemId || item.key || item;
    const category = item.category || item.type || (slot ? String(slot) : "items");
    const title = item.name || item.title || null;
    const qty = item.qty || item.quantity || 1;

    upsertItem(id, category, qty, title);

    // Equip if this corresponds to a known slot key
    if (slot) {
      state.run.inventory.equipped = state.run.inventory.equipped || {};
      state.run.inventory.equipped[String(slot)] = String(id);
    }

    log(`LOADOUT + ${String(id)}${slot ? " (slot " + slot + ")" : ""}`);
  });

  state.run.loadoutApplied = true;
}


  
  // ==============================
  // Cosmetics (Themes) — Phase 1 Wiring
  // File: ./content/system/cosmetics.json  (lowercase)
  // Assets: /backgrounds/ui/ui_*.webp      (lowercase)
  // ==============================
  const COSMETICS_URL = CONTENT_ROOT + "system/cosmetics.json";

  const cosmeticsState = {
    loaded: false,
    catalog: null,
    activeThemeId: null,
  };

  function getStoredThemeId() {
    try { return localStorage.getItem("versecraft_active_theme_id") || null; }
    catch (_) { return null; }
  }

  function storeThemeId(id) {
    try { localStorage.setItem("versecraft_active_theme_id", id); }
    catch (_) {}
  }

  function applyThemeById(themeId) {
    if (!cosmeticsState.catalog) return false;
    const t = (cosmeticsState.catalog.themes || []).find(x => x.id === themeId);
    if (!t) return false;

    cosmeticsState.activeThemeId = t.id;

    const bg = (t.assets && t.assets.screenBackground) ? t.assets.screenBackground : null;
    if (bg) document.documentElement.style.setProperty("--vc-ui-bg-primary", `url("${bg}")`);

    const ov = (t.ui && t.ui.overlay) ? t.ui.overlay : null;
    if (ov && ov.type === "linear") {
      document.documentElement.style.setProperty("--vc-bg-overlay-from", ov.from || "rgba(0,0,0,0.25)");
      document.documentElement.style.setProperty("--vc-bg-overlay-to", ov.to || "rgba(0,0,0,0.45)");
      document.documentElement.style.setProperty("--vc-bg-overlay-vignette", "0");
    } else if (ov && ov.type === "vignette") {
      document.documentElement.style.setProperty("--vc-bg-overlay-vignette", String(ov.strength ?? 0.55));
    }

    const acc = (t.ui && t.ui.accent) ? t.ui.accent : null;
    if (acc && acc.primary) document.documentElement.style.setProperty("--vc-accent", acc.primary);

    storeThemeId(t.id);
    if (DEBUG) log(`[Cosmetics] Theme applied: ${t.displayName} (${t.id})`);
    return true;
  }

  async function loadCosmeticsCatalog() {
    try {
      const res = await fetch(COSMETICS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      cosmeticsState.catalog = data;
      cosmeticsState.loaded = true;

      const stored = getStoredThemeId();
      const defaults = data.defaults || {};
      const desired = stored || defaults.activeThemeId || "theme_parchment";
      applyThemeById(desired);

      initCosmeticsSettingsUi();
      return true;
    } catch (err) {
      if (DEBUG) log(`[Cosmetics] Failed to load cosmetics catalog: ${String(err)}`);
      return false;
    }
  }

  
  function getGlobalXp() {
    // Non-monetized for now. Stored for future unlock gating.
    const v = localStorage.getItem("versecraft_global_xp");
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function isThemeUnlocked(theme) {
    if (!theme || !theme.unlock || !theme.unlock.mode) return true;
    const mode = theme.unlock.mode;
    if (mode === "default") return true;
    if (mode === "xp") {
      const key = theme.unlock.currencyKey || "GLOBAL_XP";
      // Currently we only track GLOBAL_XP. Other keys can be added later.
      if (key !== "GLOBAL_XP") return false;
      const req = Number(theme.unlock.required || 0);
      return getGlobalXp() >= req;
    }
    if (mode === "flag") {
      const flag = String(theme.unlock.flag || "");
      if (!flag) return false;
      // Flags are run/story scoped; cosmetics are global. Reserved for future.
      return false;
    }
    return false;
  }

  function initCosmeticsSettingsUi() {
    const select = document.getElementById("cosmeticsThemeSelect");
    const status = document.getElementById("cosmeticsStatus");
    if (!select || !status || !cosmeticsState.catalog) return;

    const themes = cosmeticsState.catalog.themes || [];
    select.innerHTML = "";

    themes.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      const unlocked = isThemeUnlocked(t);
      opt.disabled = !unlocked;
      opt.textContent = unlocked ? (t.displayName || t.id) : `${t.displayName || t.id} (Locked)`;
      select.appendChild(opt);
    });

    const desired =
      cosmeticsState.activeThemeId ||
      (cosmeticsState.catalog.defaults && cosmeticsState.catalog.defaults.activeThemeId) ||
      "theme_parchment";

    // If desired is locked, fall back to first unlocked theme.
    const desiredTheme = themes.find(x => x.id === desired);
    const desiredUnlocked = isThemeUnlocked(desiredTheme);
    if (desiredUnlocked) {
      select.value = desired;
    } else {
      const firstUnlocked = themes.find(isThemeUnlocked);
      if (firstUnlocked) {
        cosmeticsState.activeThemeId = firstUnlocked.id;
        setStoredThemeId(firstUnlocked.id);
        select.value = firstUnlocked.id;
        applyThemeById(firstUnlocked.id);
      }
    }

    const updateStatus = () => {
      const active = themes.find(x => x.id === (cosmeticsState.activeThemeId || select.value));
      const name = active ? (active.displayName || active.id) : (cosmeticsState.activeThemeId || select.value);
      status.textContent = `Active: ${name}`;
    };

    updateStatus();

    select.addEventListener("change", () => {
      const t = themes.find(x => x.id === select.value);
      if (!isThemeUnlocked(t)) {
        // Strict access: no preview, no apply.
        select.value = cosmeticsState.activeThemeId || desired;
        updateStatus();
        return;
      }
      applyThemeById(select.value);
      cosmeticsState.activeThemeId = select.value;
      setStoredThemeId(select.value);
      updateStatus();
    });
  }


const state = {
    catalog: null,
    selectedPack: null,
    selectedPackUrl: null,
    packBaseUrl: null,
    selectedStoryMeta: null,
    storyUrl: null,
    storyData: null,
    sectionId: null,

    // Phase 5B: Run state (resources, inventory, flags)
    run: null,

    // Phase 5A: System Echo
    echoQueue: [],

    save: null,
  };

  // ---------- Save / Load ----------
  // ---------- Menu Skin State (v0.1.44) ----------
  function setMenuSkinBySaveState() {
    const hasSave = Boolean(state.save && state.save.storyUrl && state.save.sectionId);
    const url = hasSave ? MENU_SKIN_SAVE_URL : MENU_SKIN_NOSAVE_URL;
    document.documentElement.style.setProperty("--vc-menu-skin-url", `url("${url}")`);
    log(`Menu skin → ${hasSave ? "save" : "nosave"}`);
  }

  function updateContinueButton() {
    const has = Boolean(state.save && state.save.storyUrl && state.save.sectionId);
    // Disabled is communicated by text grading only; button remains pressable but inert.
    setAriaDisabled(el.btnContinue, !has);
    if (el.continueDisabledMask) {
      el.continueDisabledMask.classList.toggle("on", !has);
    }

    setMenuSkinBySaveState();
  }

  function updateSettingsSaveStatus() {
    if (!state.save) {
      el.settingsSaveStatus.textContent = "None";
      return;
    }
    const when = new Date(state.save.timestamp || Date.now()).toLocaleString();
    el.settingsSaveStatus.textContent = `${state.save.storyTitle || state.save.storyId || "Story"} · §${state.save.sectionId} (${when})`;
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
    state.save = null;
    updateContinueButton();
    updateSettingsSaveStatus();
    log("Save cleared");
  }

  function loadSaveFromStorage() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = safeJsonParse(raw);
    if (!data || typeof data !== "object") return null;

    // If the save claims a newer engine version than this build, ignore for safety.
    if (data.engineVersion && isVersionNewer(data.engineVersion, ENGINE_VERSION)) {
      return null;
    }
    if (!data.storyUrl || !data.sectionId) return null;
    return data;
  }

  function writeSave() {
    if (!state.storyUrl || !state.sectionId) return;
    const payload = {
      engineVersion: ENGINE_VERSION,
      storyId: state.selectedStoryMeta?.storyId || null,
      storyTitle: state.selectedStoryMeta?.title || state.storyData?.title || "Story",
      storyUrl: state.storyUrl,
      sectionId: state.sectionId,
      run: state.run,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      state.save = payload;
      updateContinueButton();
      updateSettingsSaveStatus();
      log(`Saved → ${payload.storyTitle} §${payload.sectionId}`);
    } catch (e) {
      log(`Save failed: ${String(e)}`);
    }
  }

  async function continueFromSave() {
    const s = state.save || loadSaveFromStorage();
    if (!s) {
      showModal("No Save Found", "There is no valid saved game to continue.");
      updateContinueButton();
      updateSettingsSaveStatus();
      return;
    }

    try {
      // Load story directly from saved URL
      const storyData = await fetchJson(s.storyUrl);
      state.storyData = storyData;
      state.storyUrl = s.storyUrl;
      state.sectionId = s.sectionId;

      // Restore systems for this run (backward-safe if missing)
      state.run = null;
      ensureRunState(s.run);
      applyStoryLoadoutOnce();

      // Try to recover title if missing
      state.selectedStoryMeta = state.selectedStoryMeta || { storyId: s.storyId, title: s.storyTitle };

      nav.gameOrigin = "stories";
      navTo("game", "startStory");
      renderGame();
      log("Continue OK");
    } catch (e) {
      clearSave();
      showModal("Continue Failed", `Couldn't load the saved story.\n\n${String(e.message || e)}`);
    }
  }

  // ---------- Catalog / Pack / Story resolution ----------
  function getPackPointer(packEntry) {
    if (!packEntry) return null;
    // v0.0.4+ expected top-level packJson/path/url; also allow nested manifest.path for backward safety
    return (
      packEntry.packJson ||
      packEntry.path ||
      packEntry.url ||
      packEntry.manifest?.path ||
      packEntry.manifest?.url ||
      null
    );
  }

  function deriveBaseFolder(url) {
    // url may be relative. Use URL() to normalize.
    const abs = new URL(url, location.href).toString();
    return abs.slice(0, abs.lastIndexOf("/") + 1);
  }

  function resolveStoryUrl(entryFile) {
    const raw = String(entryFile || "").trim();
    if (!raw) return null;

    // Absolute http(s)
    if (/^https?:\/\//i.test(raw)) return raw;

    // Root absolute
    if (raw.startsWith("/")) return new URL(raw, location.href).toString();

    // Backward-safe: old style that starts with "./content" or "content/"
    if (raw.startsWith("./content/") || raw.startsWith("content/")) {
      const cleaned = raw.replace(/^\.\//, "");
      return new URL(cleaned, location.href).toString();
    }

    // Backward-safe: if someone put "./packs/..." (relative to content root), keep from site root
    if (raw.startsWith("./packs/") || raw.startsWith("packs/")) {
      const cleaned = raw.replace(/^\.\//, "");
      return new URL(CONTENT_ROOT + cleaned.replace(/^content\//, ""), location.href).toString();
    }

    // Pack-relative (preferred)
    const rel = raw.replace(/^\.\//, "");
    if (!state.packBaseUrl) {
      // last resort: treat as site-root relative
      return new URL(rel, location.href).toString();
    }
    return new URL(rel, state.packBaseUrl).toString();
  }

  // ---------- Rendering ----------
  // ---------- Phase 5A: System Echo ----------
  // A lightweight, in-game "immediate echo" queue. Effects systems can emit echo lines
  // as state changes occur; echoes render between the story text and the choices.
    // ---------- Phase 5A: System Echo ----------
  // Immediate Echo events are emitted whenever the story or systems apply changes.
  // Default visibility: HIDDEN (player does not see unless explicitly marked visible).
  // Always logs to Debug.
  function emitEcho(msg, visible = false) {
    if (!msg) return;
    const line = String(msg);
    state.echoQueue.push({ text: line, visible: !!visible });
    log(`ECHO + ${line}${visible ? " (visible)" : ""}`);
  }

  function clearEcho() {
    state.echoQueue.length = 0;
    if (el.gameEcho) clearNode(el.gameEcho);
  }

  function renderEcho() {
    if (!el.gameEcho) return;
    clearNode(el.gameEcho);

    if (!Array.isArray(state.echoQueue) || state.echoQueue.length === 0) return;

    // Default visibility is hidden; only render visible echoes.
    const visible = state.echoQueue.filter((e) => e && e.visible);
    if (visible.length === 0) {
      // Still clear the queue so the next screen doesn't inherit hidden echoes.
      state.echoQueue.length = 0;
      return;
    }

    const card = document.createElement("div");
    card.className = "card echo-card";

    const title = document.createElement("div");
    title.className = "echo-title";
    title.textContent = "System Echo";
    card.appendChild(title);

    visible.forEach((e) => {
      const row = document.createElement("div");
      row.className = "echo-line";
      row.textContent = String(e.text || "");
      card.appendChild(row);
    });

    el.gameEcho.appendChild(card);
    log(`ECHO render (${visible.length} visible / ${state.echoQueue.length} total)`);

    // One-shot presentation: clear after render.
    state.echoQueue.length = 0;
  }


  function renderCatalog() {
    clearNode(el.catalogList);
    const packs = state.catalog?.packs || state.catalog?.Packs || [];
    if (!Array.isArray(packs) || packs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.textContent = "No packs found in Catalog.json.";
      el.catalogList.appendChild(empty);
      return;
    }

    packs.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card pack-card";
      const title = document.createElement("h3");
      title.textContent = p.title || p.id || "Pack";
      const desc = document.createElement("p");
      desc.textContent = p.description || "";
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = "Open Pack";
      btn.addEventListener("click", () => openPack(p));
      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      el.catalogList.appendChild(card);
    });
  }

  function renderStories() {
    clearNode(el.storiesList);
    const pack = state.selectedPack;
    const stories = pack?.stories || pack?.Stories || [];
    el.storiesPackLabel.textContent = `Pack: ${pack?.title || "—"}`;

    if (!Array.isArray(stories) || stories.length === 0) {
      const empty = document.createElement("div");
      empty.className = "card";
      empty.textContent = "No stories found in Pack.json.";
      el.storiesList.appendChild(empty);
      return;
    }

    stories.forEach((s) => {
      const card = document.createElement("div");
      card.className = "card story-card";

      const title = document.createElement("h3");
      title.textContent = s.title || s.storyId || "Story";
      const desc = document.createElement("p");
      desc.textContent = s.description || "";

      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = "Start";
      btn.addEventListener("click", () => startStory(s));

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      el.storiesList.appendChild(card);
    });
  }

  function getSection(storyData, sectionId) {
    if (!storyData) return null;

    // common shapes:
    // - { sections: { "1": {text, choices} } }
    // - { sections: [ {id, text, choices}, ... ] }
    // - { nodes: { ... } } etc.
    const idStr = String(sectionId);

    const sectionsObj = storyData.sections || storyData.Sections || storyData.nodes || storyData.Nodes;
    if (Array.isArray(sectionsObj)) {
      return sectionsObj.find(s => String(s.id ?? s.sectionId ?? s.key ?? "") === idStr) || null;
    }
    if (sectionsObj && typeof sectionsObj === "object") {
      return sectionsObj[idStr] || sectionsObj[Number(idStr)] || null;
    }

    // fallback: some demos store root-level map
    if (storyData[idStr]) return storyData[idStr];
    return null;
  }

  function getFirstSectionId(storyData) {
    if (!storyData) return "1";
    // allow explicit
    if (storyData.start) return String(storyData.start);
    if (storyData.startSection) return String(storyData.startSection);
    if (storyData.startSectionId) return String(storyData.startSectionId);
    // try first in object map
    const sectionsObj = storyData.sections || storyData.Sections || storyData.nodes || storyData.Nodes;
    if (sectionsObj && typeof sectionsObj === "object" && !Array.isArray(sectionsObj)) {
      const keys = Object.keys(sectionsObj);
      if (keys.length) {
        // sort numeric-ish keys
        keys.sort((a,b) => (Number(a) - Number(b)));
        return String(keys[0]);
      }
    }
    // array
    if (Array.isArray(sectionsObj) && sectionsObj.length) {
      return String(sectionsObj[0].id ?? sectionsObj[0].sectionId ?? "1");
    }
    return "1";
  }

  
  function getItemIndex() {
    const story = state.storyData;
    if (!story || !story.module) return null;
    if (story.__itemIndex) return story.__itemIndex;

    const idx = {};
    const cat = story.module.itemCatalog || {};
    Object.keys(cat).forEach((k) => {
      const arr = cat[k];
      if (!Array.isArray(arr)) return;
      arr.forEach((it) => {
        if (it && it.id) idx[String(it.id)] = it;
      });
    });

    story.__itemIndex = idx;
    return idx;
  }

  function getItemDef(id) {
    const idx = getItemIndex();
    return (idx && id) ? idx[String(id)] : null;
  }

  function getDisplayNameForItem(id) {
    const def = getItemDef(id);
    return def?.name || def?.title || String(id || "—");
  }

  function inferEquipSlot(id, itemObj) {
    const def = getItemDef(id);
    const slot = def?.equipSlot || itemObj?.equipSlot || null;
    if (slot === "weapon" || slot === "armor" || slot === "special") return slot;
    return null;
  }

  function useConsumable(id) {
    const def = getItemDef(id);
    if (!def || !def.use) return;

    // Spend 1
    removeItem({ id, qty: 1 });

    const u = def.use;
    if (u.type === "heal") {
      applyHpDelta(Number(u.amount || 0));
      emitEcho(`Used: ${def.name || id}`, true);
    } else if (u.type === "story" && u.tag) {
      setFlag(String(u.tag), true);
      emitEcho(`Used: ${def.name || id}`, true);
    } else {
      emitEcho(`Used: ${def.name || id}`, true);
    }

    saveRun("consumable.use");
    renderCharacterScreen();
    renderGame();
  }

  function equipItemToSlot(slot, id) {
    if (!slot || !id) return;
    state.run.inventory = state.run.inventory || { items: [], equipped: { weapon: null, armor: null, special: null } };
    state.run.inventory.equipped = state.run.inventory.equipped || { weapon: null, armor: null, special: null };
    state.run.inventory.equipped[slot] = String(id);
    emitEcho(`Equipped: ${getDisplayNameForItem(id)} → ${slot}`, true);
    saveRun("equip");
    renderCharacterScreen();
  }

  

function openCharacterScreen() {
  ensureCharacterScreenDom();
  // register screen in el.screens if needed
  el.screens.character = document.getElementById("screen-character") || el.screens.character;
  setScreen("character");
  renderCharacterScreen();
}

function renderCharacterScreen() {
  ensureCharacterScreenDom();

  const sd = state.storyData;
  const m = sd?.module || {};
  const slotDefs = getSlotDefs(sd);
  const pr = getPrimaryResourceDef(sd);
  const prKey = pr.key;
  const prLabel = pr.label;

  const prVal = (state.run && state.run[prKey] != null) ? Number(state.run[prKey]) : Number(state.run?.hp ?? pr.max);
  const prMax = (state.run && state.run[prKey + "Max"] != null) ? Number(state.run[prKey + "Max"]) : Number(state.run?.hpMax ?? pr.max);

  const xpKey = (m.xpKey) ? String(m.xpKey) : "xp";
  const xpLabel = getScalarLabel(sd, "xp", "XP");
  const xpVal = Number(state.run?.[xpKey] || 0);

  const curKey = (m.currencyKey) ? String(m.currencyKey) : "currency";
  const curLabel = getScalarLabel(sd, "currency", "Currency");
  const curVal = (state.run && state.run[curKey] != null) ? state.run[curKey] : "—";

  // Title/subtitle (creator-defined)
  const title = m.characterTitle || m.playerTitle || "Character";
  const subtitle = m.characterSubtitle || m.archetypeLabel || "";

  const titleEl = document.getElementById("charTitle");
  const subEl = document.getElementById("charSubtitle");
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;

  // Portrait
  const portraitUrl = getCharacterPortraitUrl(sd);
  const img = document.getElementById("charPortraitImg");
  if (img) {
    if (portraitUrl) {
      img.src = portraitUrl;
      img.style.display = "block";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
  }

  // Ensure run containers
  state.run = state.run || {};
  state.run.flags = state.run.flags || {};
  state.run.inventory = state.run.inventory || { items: [], equipped: {} };
  state.run.inventory.equipped = state.run.inventory.equipped || {};

  // Stats
  const statsEl = document.getElementById("charStats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="kv"><div class="k">${escapeHtml(prLabel)}</div><div class="v">${prVal}/${prMax}</div></div>
      <div class="kv"><div class="k">${escapeHtml(xpLabel)}</div><div class="v">${xpVal}</div></div>
      <div class="kv"><div class="k">${escapeHtml(curLabel)}</div><div class="v">${escapeHtml(String(curVal))}</div></div>
    `;
  }

  // Slot bar (3 across, WoW vibe)
  const slotBar = document.getElementById("charSlotBar");
  if (slotBar) {
    slotBar.innerHTML = "";
    slotDefs.slice(0, 3).forEach(def => {
      const equippedId = state.run.inventory.equipped[def.key] || null;
      const icon = equippedId ? getItemIconUrl(sd, equippedId) : (def.art || null);

      const slot = document.createElement("button");
      slot.className = "slot-btn";
      slot.type = "button";
      slot.setAttribute("data-slot", def.key);

      slot.innerHTML = `
        <div class="slot-icon">${icon ? `<img src="${escapeHtml(String(icon))}" alt=""/>` : ``}</div>
        <div class="slot-meta">
          <div class="slot-name">${escapeHtml(def.label)}</div>
          <div class="slot-eq">${escapeHtml(equippedId ? String(equippedId) : "—")}</div>
        </div>
      `;

      slot.addEventListener("click", () => {
        // If something equipped, allow quick unequip (tutorial-friendly)
        if (equippedId) {
          state.run.inventory.equipped[def.key] = null;
          emitEcho(`Unequipped: ${def.label}`, false);
          renderEcho();
          saveRun();
          renderCharacterScreen();
        }
      });

      slotBar.appendChild(slot);
    });
  }

  // Inventory list
  const invEl = document.getElementById("charInventory");
  if (invEl) {
    invEl.innerHTML = "";
    const items = Array.isArray(state.run.inventory.items) ? state.run.inventory.items : [];
    const catalog = sd?.itemCatalog || {};

    items
      .filter(it => it && Number(it.qty || 0) > 0)
      .forEach(it => {
        const cat = catalog[it.id] || {};
        const title2 = cat.title || cat.name || it.title || it.id;
        const icon2 = getItemIconUrl(sd, it.id);
        const equipSlot = cat.equipSlot || cat.slot || null;
        const isConsumable = (cat.category || it.category) === "consumables" || cat.type === "consumable" || cat.consumable === true;

        const card = document.createElement("div");
        card.className = "card item-card";

        const header = document.createElement("div");
        header.className = "item-head";
        header.innerHTML = `
          <div class="item-icon">${icon2 ? `<img src="${escapeHtml(String(icon2))}" alt=""/>` : ``}</div>
          <div class="item-info">
            <div class="item-title">${escapeHtml(title2)} <span class="item-qty">x${Number(it.qty||0)}</span></div>
            <div class="subtle">${escapeHtml(String(it.id))}</div>
          </div>
        `;

        const actions = document.createElement("div");
        actions.className = "item-actions";

        if (equipSlot) {
          const slotHit = slotDefs.find(s => s.key === String(equipSlot));
          if (slotHit) {
            const btn = document.createElement("button");
            btn.className = "btn btn-utility";
            btn.textContent = `Equip → ${slotHit.label}`;
            btn.addEventListener("click", () => {
              state.run.inventory.equipped[String(equipSlot)] = it.id;
              emitEcho(`Equipped: ${title2}`, false);
              renderEcho();
              saveRun();
              renderCharacterScreen();
            });
            actions.appendChild(btn);
          }
        }

        if (isConsumable) {
          const btn = document.createElement("button");
          btn.className = "btn btn-utility";
          btn.textContent = "Use";
          btn.addEventListener("click", () => {
            const onUse = cat.onUse || cat.effectsOnUse || null;
            if (onUse) applyEffects(onUse, { source: "consume", itemId: it.id });
            removeItem(it.id, 1);
            emitEcho(`Used: ${title2}`, true);
            renderEcho();
            saveRun();
            renderCharacterScreen();
          });
          actions.appendChild(btn);
        }

        card.appendChild(header);
        card.appendChild(actions);
        invEl.appendChild(card);
      });

    if (!invEl.children.length) invEl.innerHTML = `<div class="subtle">No items.</div>`;
  }

  // Flags
  const flagsEl = document.getElementById("charFlags");
  if (flagsEl) {
    const flags = state.run?.flags || {};
    const keys = Object.keys(flags).filter(k => flags[k]);
    flagsEl.innerHTML = keys.length ? keys.map(k => `<span class="flag-chip">${escapeHtml(k)}</span>`).join(" ") : `<div class="subtle">No flags.</div>`;
  }
}



function renderGame() {
  if (!state.storyData) return;
  if (typeof ensureGameCharacterButton === "function") ensureGameCharacterButton();
    clearEcho();
    // Ensure Phase 5B run-state exists (resources, inventory, flags)
    ensureRunState(state.save?.run);
    applyStoryLoadoutOnce();
    const title = state.selectedStoryMeta?.title || state.storyData?.title || "Story";
    el.gameTitle.textContent = title;
    renderHud();

    const sec = getSection(state.storyData, state.sectionId);
    // Section system text is tutorial guidance; show it as a visible System Echo.
    if (sec && sec.system) emitEcho(sec.system, true);

    if (!sec) {
      el.gameText.textContent = "Section not found.";
      clearNode(el.gameChoices);

    // Render any queued echoes before showing choices.
    renderEcho();
      return;
    }

    // Collect optional echo lines provided by the story section.
    // Story authors may provide: echo (string/array), echoes (array), or systemEcho (string/array).
    const rawEcho = sec.echo ?? sec.echoes ?? sec.systemEcho ?? null;
    if (typeof rawEcho === "string") emitEcho(rawEcho, true);
    else if (Array.isArray(rawEcho)) rawEcho.forEach((t) => emitEcho(t, true));

    el.gameText.textContent = sec.text || sec.body || sec.content || "(No text)";
    clearNode(el.gameChoices);

    const choices = sec.choices || sec.Choices || [];
    if (!Array.isArray(choices) || choices.length === 0) {
      const end = document.createElement("div");
      end.className = "card";
      end.textContent = "End of demo (no choices).";
      el.gameChoices.appendChild(end);
      renderEcho();
      return;
    }

    choices.forEach((c) => {
      if (!choiceShouldRender(c)) return;
      const allowed = choiceMeetsRequires(c);

      const btn = document.createElement("button");
      btn.className = "btn btn-story";
      btn.textContent = c.text || c.label || "Continue";
      if (!allowed) {
        setAriaDisabled(btn, true);
      }

      btn.addEventListener("click", () => {
        if (!allowed) {
          emitEcho("You lack the required item.", true);
          renderEcho();
          return;
        }

        // Apply choice effects (Phase 5B)
        applyEffects(c.effects);
        // If an effect ended the run (resource depleted), render failover now.
        const pr = getPrimaryResourceDef();
        if (pr.failureSectionId && String(state.sectionId) === String(pr.failureSectionId)) {
          renderGame();
          writeSave();
          return;
        }

        // Special navigation actions (used by some story JSONs)
        // Example: { label: "Return To Main Menu", toMenu: true }
        if (c.toMenu || c.returnToMenu || c.gotoMenu) {
          log(`CHOICE ACTION: toMenu (from §${state.sectionId})`);
          navTo("menu", "choice.toMenu", { reset: true, seed: ["menu"] });
          return;
        }
        if (c.toStories) {
          log(`CHOICE ACTION: toStories (from §${state.sectionId})`);
          navTo("stories", "choice.toStories");
          return;
        }
        if (c.toCatalog) {
          log(`CHOICE ACTION: toCatalog (from §${state.sectionId})`);
          navTo("catalog", "loadCatalog");
          return;
        }

        // Action aliases (some story JSONs may use action/type fields)
        const action = (c.action || c.type || c.nav || "").toString().toLowerCase();
        if (action === "menu" || action === "mainmenu") {
          log(`CHOICE ACTION: action=menu (from §${state.sectionId})`);
          navTo("menu", "choice.action.menu", { reset: true, seed: ["menu"] });
          return;
        }
        if (action === "stories") {
          log(`CHOICE ACTION: action=stories (from §${state.sectionId})`);
          navTo("stories", "choice.action.stories");
          return;
        }
        if (action === "catalog" || action === "packs") {
          log(`CHOICE ACTION: action=catalog (from §${state.sectionId})`);
          navTo("catalog", "choice.action.catalog");
          return;
        }

        // Heuristic fallback: if a choice has no destination but clearly names a nav intent,
        // route it instead of throwing a Choice Error. (Logged as a warning.)
        const labelText = (c.text || c.label || "").toString();
        if (!labelText) {
          // no-op
        } else if (/return\s+to\s+(main\s+)?menu/i.test(labelText)) {
          log(`CHOICE WARN: inferred toMenu from label "${labelText}" at §${state.sectionId}`);
          navTo("menu", "choice.infer.toMenu", { reset: true, seed: ["menu"] });
          return;
        } else if (/back\s+to\s+stories/i.test(labelText)) {
          log(`CHOICE WARN: inferred toStories from label "${labelText}" at §${state.sectionId}`);
          navTo("stories", "choice.infer.toStories");
          return;
        } else if (/back\s+to\s+(catalog|packs)/i.test(labelText)) {
          log(`CHOICE WARN: inferred toCatalog from label "${labelText}" at §${state.sectionId}`);
          navTo("catalog", "choice.infer.toCatalog");
          return;
        }

        const next = c.to ?? c.goto ?? c.goTo ?? c.next ?? c.target;
        if (!next) {
          const label = c.text || c.label || "(no label)";
          log(`CHOICE ERROR: missing destination on "${label}" at §${state.sectionId}`);
          showModal("Choice Error", "Choice is missing a destination (to/goto/goTo/next/target) or a nav action (toMenu/toStories/toCatalog).");
          return;
        }
        state.sectionId = String(next);
        renderGame();
        writeSave();
      });
      el.gameChoices.appendChild(btn);
    });

    // Present visible System Echo (Option A) after building the choice list.
    renderEcho();
  }

  // ---------- Flows ----------
  async function loadCatalog() {
    log("Loading Catalog.json…");
    try {
      state.catalog = await fetchJson(CATALOG_URL);
      renderCatalog();
      navTo("catalog", "loadCatalog");
    } catch (e) {
      showModal("Failed to load Catalog.json", String(e.message || e));
    }
  }

  async function openPack(packEntry) {
    const ptr = getPackPointer(packEntry);
    if (!ptr) {
      showModal("Failed to load Pack.json", "Error: Pack entry missing path/packJson/url");
      return;
    }

    try {
      state.selectedPackUrl = ptr;
      state.packBaseUrl = deriveBaseFolder(ptr);
      log(`Pack base = ${state.packBaseUrl}`);
      state.selectedPack = await fetchJson(ptr);
      navTo("stories", "openPack");
      renderStories();
    } catch (e) {
      showModal("Failed to load Pack.json", String(e.message || e));
    }
  }

  async function startStory(storyMeta) {
    try {
      state.selectedStoryMeta = storyMeta;
      const entry = storyMeta.entryFile || storyMeta.path || storyMeta.url;
      const resolved = resolveStoryUrl(entry);
      if (!resolved) throw new Error("Story entry missing entryFile/path/url");
      state.storyUrl = resolved;

      log(`Story URL = ${resolved}`);
      state.storyData = await fetchJson(resolved);
      state.sectionId = getFirstSectionId(state.storyData);

      // Initialize systems for a new run
      state.run = null;
      ensureRunState(null);
      applyStoryLoadoutOnce();

      nav.gameOrigin = "stories";
      navTo("game", "startStory");
      renderGame();

      // write an initial save immediately on start
      writeSave();
    } catch (e) {
      showModal("Failed to load Story JSON", String(e.message || e));
    }
  }

  // ---------- Wiring ----------
  function wireUi() {
    // menu
    el.btnLoadNew.addEventListener("click", loadCatalog);
    el.btnContinue.addEventListener("click", () => {
      if (isAriaDisabled(el.btnContinue)) return;
      continueFromSave();
    });
    el.btnSettings.addEventListener("click", () => navTo("settings", "menu.settings"));

    // settings
    el.btnSettingsBack.addEventListener("click", () => navBack("menu", "settings.back"));
    el.btnClearSave.addEventListener("click", () => {
      const hadSave = !!localStorage.getItem(SAVE_KEY);
      if (!hadSave) {
        showModal("No Save Found", "There is no saved game to clear.");
        return;
      }
      clearSave();
      showModal("Save Cleared", "Your saved game has been cleared.");
    });

    // catalog
    el.btnCatalogBack.addEventListener("click", () => navBack("menu", "catalog.back"));
    el.btnCatalogReload.addEventListener("click", () => {
      log("Catalog reload");
      loadCatalog();
    });

    // stories
    el.btnStoriesBack.addEventListener("click", () => navBack("catalog", "stories.back"));

    // game
    el.btnGameBack.addEventListener("click", () => {
      // Prefer returning to Stories if the game was launched from a pack.
      const fallback = (nav.gameOrigin === "stories") ? "stories" : "menu";
      navBack(fallback, "game.back");
    });
    el.btnGameMenu.addEventListener("click", () => navTo("menu", "game.menu", { reset: true, seed: ["menu"] }));
    el.btnGameCharacter.addEventListener("click", () => {
      navTo("character", "game.character");
      renderCharacterScreen();
    });

    el.btnCharacterBack.addEventListener("click", () => {
      navBack("game", "character.back");
      renderGame();
    });
    el.btnCharacterMenu.addEventListener("click", () => navTo("menu", "character.menu", { reset: true, seed: ["menu"] }));

    // debug
    el.btnDebugClose.addEventListener("click", () => setDebugOpen(false));
    if (el.btnDebugSnapshot) el.btnDebugSnapshot.addEventListener("click", logDebugSnapshot);
    if (el.btnDebugCopy) el.btnDebugCopy.addEventListener("click", copyDebugToClipboard);
    if (el.btnDebugToggle) {
      el.btnDebugToggle.addEventListener("click", toggleDebug);
    }

    // modal
    el.btnModalClose.addEventListener("click", hideModal);
    el.modalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.modalBackdrop) hideModal();
    });

  }

  function initSettings() {
    el.settingsDebug.textContent = DEBUG ? "On" : "Off";
    el.settingsContentRoot.textContent = CONTENT_ROOT;
    el.settingsCatalogPath.textContent = CATALOG_URL;

    state.save = loadSaveFromStorage();
    
    setMenuSkinBySaveState();
updateContinueButton();
    updateSettingsSaveStatus();

    if (el.btnDebugToggle) {
      el.btnDebugToggle.classList.toggle("on", DEBUG);
    }
    if (DEBUG) setDebugOpen(true);
  }

  
  // ---------- Menu Skin Preload (v0.1.15) ----------
  const MENU_SKIN_URL = "./backgrounds/ui/VerseCraft-Menu_v1.png";
  function preloadMenuSkin() {
    try {
      const img = new Image();
      img.onload = () => log(`Menu skin loaded: ${MENU_SKIN_URL}`);
      img.onerror = () => log(`Menu skin FAILED: ${MENU_SKIN_URL}`);
      img.src = cacheBuster(MENU_SKIN_URL);
    } catch (e) {
      log(`Menu skin preload error: ${String(e)}`);
    }
  }

  // Visual viewport alignment (iOS Safari): keeps fixed layers and hitboxes aligned
  // with the *visual* viewport when browser chrome expands/collapses.
  function setupVisualViewportVars() {
    const root = document.documentElement;
    const vv = window.visualViewport;

    function apply() {
      if (!vv) {
        root.style.setProperty("--vv-top", "0px");
        root.style.setProperty("--vv-left", "0px");
        root.style.setProperty("--vv-width", window.innerWidth + "px");
        root.style.setProperty("--vv-height", window.innerHeight + "px");
        return;
      }
      root.style.setProperty("--vv-top", (vv.offsetTop || 0) + "px");
      root.style.setProperty("--vv-left", (vv.offsetLeft || 0) + "px");
      root.style.setProperty("--vv-width", vv.width + "px");
      root.style.setProperty("--vv-height", vv.height + "px");
    }

    // Expose for menu snap-fix re-measure.
    window.__vcApplyVV = apply;

    apply();

    if (vv) {
      vv.addEventListener("resize", apply);
      vv.addEventListener("scroll", apply);
    }
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", () => setTimeout(apply, 60));
  }

  // Gesture guards (iOS Safari): prevent pinch/zoom and rubber-band interactions
  // from shifting the fixed menu skin when the Menu screen is active.
  function setupMenuGestureGuards() {
    const shouldBlock = () =>
      document.body && document.body.classList.contains(SCROLL_LOCK_CLASS);

    // Block iOS "gesture" events (Safari) when menu is locked.
    ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
      document.addEventListener(
        type,
        (e) => {
          if (shouldBlock()) e.preventDefault();
        },
        { passive: false }
      );
    });

    // Block double-tap zoom patterns by preventing default on rapid taps.
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        if (!shouldBlock()) return;
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

function init() {
    // Start unlocked; setScreen("menu") below will apply the Menu-only lock.
    setGlobalScrollLock(false);
    setupVisualViewportVars();
    setupMenuGestureGuards();
    wireUi();
    initSettings();
    // Cosmetics: load theme catalog
    loadCosmeticsCatalog();
    installDebugErrorHooks();

    log(`Engine v${ENGINE_VERSION}`);
    logDebugSnapshot();
    preloadMenuSkin();
    // Stay on menu at boot; Continue is enabled if a valid save exists
    navTo("menu", "choice.toMenu", { reset: true, seed: ["menu"] });
  }

  // boot
  init();

})()
