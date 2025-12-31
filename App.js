/* VerseCraft — Clean Foundation (v0.0.5)
   Scope for v0.0.5:
   - Fix story URL resolution (pack-relative) and remain backward-safe for older absolute-like paths
   - Minimal single-slot save/load (versioned) + Continue Story button
   - Debug panel via ?debug=1
   - No save slots, no schema locking, no extra systems
*/

(() => {
  "use strict";

  const ENGINE_VERSION = "0.0.5";
  const CONTENT_ROOT = "./content/";
  const CATALOG_URL = CONTENT_ROOT + "Catalog.json";
  const SAVE_KEY = "versecraft.save.v1";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const el = {
    pillbox: $("pillbox"),
    pillMode: $("pillMode"),
    pillContext: $("pillContext"),

    // screens
    screens: {
      menu: $("screen-menu"),
      settings: $("screen-settings"),
      catalog: $("screen-catalog"),
      stories: $("screen-stories"),
      game: $("screen-game"),
    },

    // menu buttons
    btnLoadNew: $("btnLoadNew"),
    btnContinue: $("btnContinue"),
    btnSettings: $("btnSettings"),

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
    gameTitle: $("gameTitle"),
    gameSectionLabel: $("gameSectionLabel"),
    gameText: $("gameText"),
    gameChoices: $("gameChoices"),

    // debug
    debugPanel: $("debugPanel"),
    debugBody: $("debugBody"),
    btnDebugClose: $("btnDebugClose"),

    // modal
    modalBackdrop: $("modalBackdrop"),
    modalTitle: $("modalTitle"),
    modalText: $("modalText"),
    btnModalClose: $("btnModalClose"),
  };

  // ---------- Debug ----------
  const DEBUG = new URLSearchParams(location.search).get("debug") === "1";

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

  function setScreen(name) {
    Object.values(el.screens).forEach(s => s.classList.remove("active"));
    const target = el.screens[name];
    if (target) target.classList.add("active");
    currentScreen = name;
    setPillboxScreen(name);
    log(`Screen → ${name}`);
  }

  function pulsePillbox() {
    el.pillbox.classList.remove("pulse");
    // force reflow
    void el.pillbox.offsetWidth;
    el.pillbox.classList.add("pulse");
  }

  function setPillboxScreen(screenName) {
    el.pillMode.textContent = `Screen: ${capitalize(screenName)}`;
    el.pillContext.textContent = "—";
    pulsePillbox();
  }

  function setPillboxStory(title, sectionId) {
    el.pillMode.textContent = `${title} · §${sectionId}`;
    el.pillContext.textContent = "—";
    pulsePillbox();
  }

  // ---------- Helpers ----------
  function capitalize(s) {
    return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
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
  const state = {
    catalog: null,
    selectedPack: null,
    selectedPackUrl: null,
    packBaseUrl: null,
    selectedStoryMeta: null,
    storyUrl: null,
    storyData: null,
    sectionId: null,

    save: null,
  };

  // ---------- Save / Load ----------
  function updateContinueButton() {
    const has = Boolean(state.save && state.save.storyUrl && state.save.sectionId);
    el.btnContinue.disabled = !has;
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

      // Try to recover title if missing
      state.selectedStoryMeta = state.selectedStoryMeta || { storyId: s.storyId, title: s.storyTitle };

      setScreen("game");
      renderGame();
      setPillboxStory(s.storyTitle || storyData.title || "Story", state.sectionId);
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

  function renderGame() {
    const title = state.selectedStoryMeta?.title || state.storyData?.title || "Story";
    el.gameTitle.textContent = title;
    el.gameSectionLabel.textContent = `§${state.sectionId || "—"}`;

    const sec = getSection(state.storyData, state.sectionId);
    if (!sec) {
      el.gameText.textContent = "Section not found.";
      clearNode(el.gameChoices);
      return;
    }

    el.gameText.textContent = sec.text || sec.body || sec.content || "(No text)";
    clearNode(el.gameChoices);

    const choices = sec.choices || sec.Choices || [];
    if (!Array.isArray(choices) || choices.length === 0) {
      const end = document.createElement("div");
      end.className = "card";
      end.textContent = "End of demo (no choices).";
      el.gameChoices.appendChild(end);
      return;
    }

    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = c.text || c.label || "Continue";
      btn.addEventListener("click", () => {
        const next = c.to ?? c.goto ?? c.goTo ?? c.next ?? c.target;
        if (!next) {
          showModal("Choice Error", "Choice is missing a destination (to/goto/goTo/next/target).");
          return;
        }
        state.sectionId = String(next);
        setPillboxStory(title, state.sectionId);
        renderGame();
        writeSave();
      });
      el.gameChoices.appendChild(btn);
    });
  }

  // ---------- Flows ----------
  async function loadCatalog() {
    log("Loading Catalog.json…");
    try {
      state.catalog = await fetchJson(CATALOG_URL);
      renderCatalog();
      setScreen("catalog");
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
      setScreen("stories");
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

      setScreen("game");
      setPillboxStory(storyMeta.title || state.storyData.title || "Story", state.sectionId);
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
    el.btnContinue.addEventListener("click", continueFromSave);
    el.btnSettings.addEventListener("click", () => setScreen("settings"));

    // settings
    el.btnSettingsBack.addEventListener("click", () => setScreen("menu"));
    el.btnClearSave.addEventListener("click", () => {
      clearSave();
      showModal("Save Cleared", "Your saved game has been cleared.");
    });

    // catalog
    el.btnCatalogBack.addEventListener("click", () => setScreen("menu"));
    el.btnCatalogReload.addEventListener("click", () => {
      log("Catalog reload");
      loadCatalog();
    });

    // stories
    el.btnStoriesBack.addEventListener("click", () => setScreen("catalog"));

    // game
    el.btnGameBack.addEventListener("click", () => setScreen("stories"));
    el.btnGameMenu.addEventListener("click", () => setScreen("menu"));

    // debug
    el.btnDebugClose.addEventListener("click", () => setDebugOpen(false));

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
    updateContinueButton();
    updateSettingsSaveStatus();

    if (DEBUG) setDebugOpen(true);
  }

  function init() {
    wireUi();
    initSettings();

    log(`Engine v${ENGINE_VERSION}`);
    // Stay on menu at boot; Continue is enabled if a valid save exists
    setScreen("menu");
  }

  // boot
  init();

})();