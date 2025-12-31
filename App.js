/* VerseCraft Clean Foundation - App.js (CANON)
   - PillText Contract + Subtle Mode Switch Animation
   - Debug channel via ?debug=1
   - Mobile-first, iOS Safari safe
*/

(() => {
  "use strict";

  // ---------------------------
  // Config
  // ---------------------------
  const APP_VERSION = "0.0.2";
  const DEBUG_ENABLED = new URLSearchParams(window.location.search).has("debug");

  // ---------------------------
  // State
  // ---------------------------
  const State = {
    screen: "Menu", // Menu | Catalog | Packs | Stories | Game | Settings | Debug
    debug: {
      enabled: DEBUG_ENABLED,
      lines: [],
      maxLines: 120
    },
    pill: {
      mode: "screen",
      screen: "Menu"
      // storyTitle, sectionId, chapter optional
    }
  };

  // ---------------------------
  // DOM helpers
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  function safeText(el, text) {
    if (!el) return;
    el.textContent = String(text ?? "");
  }

  // ---------------------------
  // Debug
  // ---------------------------
  function debugLog(message, data) {
    if (!State.debug.enabled) return;

    const time = new Date();
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    const ss = String(time.getSeconds()).padStart(2, "0");

    let line = `[${hh}:${mm}:${ss}] ${String(message ?? "")}`;
    if (data !== undefined) {
      try {
        const json = JSON.stringify(data);
        line += ` ${json}`;
      } catch {
        line += " [unserializable]";
      }
    }

    State.debug.lines.push(line);
    if (State.debug.lines.length > State.debug.maxLines) {
      State.debug.lines.splice(0, State.debug.lines.length - State.debug.maxLines);
    }

    renderDebug();
  }

  function renderDebug() {
    const panel = $("debugPanel");
    const pre = $("debugLog");
    if (!panel || !pre) return;

    panel.style.display = State.debug.enabled ? "block" : "none";
    if (!State.debug.enabled) return;

    pre.textContent = State.debug.lines.join("\n");
  }

  function setDebugEnabled(on) {
    State.debug.enabled = !!on;
    debugLog("Debug toggled", { enabled: State.debug.enabled });
    renderDebug();
  }

  // ---------------------------
  // PillText Contract
  // ---------------------------
  // Canon state contract:
  // { mode: "screen", screen: "Menu" | "Catalog" | "Packs" | "Stories" | "Game" | "Settings" | "Debug" }
  // { mode: "story", storyTitle: string, sectionId: number (1..999), chapter?: number (1..99) }
  //
  // Display formats:
  // Screen: {ScreenName}
  // {StoryTitle} · §{NNN}
  // {StoryTitle} · Ch {N} · §{NNN}
  //
  // Total pill text target <= 28 chars (truncate StoryTitle only).

  function sanitizeTitle(s) {
    return String(s ?? "")
      .replace(/\s+/g, " ")
      .replace(/[\r\n\t]+/g, " ")
      .trim();
  }

  function clampPill(text, maxLen) {
    if (text.length <= maxLen) return text;

    const sep = " · ";
    const i = text.indexOf(sep);
    if (i <= 0) return text.slice(0, maxLen - 1) + "…";

    const title = text.slice(0, i);
    const suffix = text.slice(i);

    const allowedTitleLen = Math.max(6, maxLen - suffix.length - 1); // keep at least 6 chars of title
    const truncatedTitle = title.slice(0, allowedTitleLen) + "…";
    return truncatedTitle + suffix;
  }

  function renderPillText(pillState) {
    if (!pillState || pillState.mode === "screen") {
      const screenName = String(pillState?.screen ?? "Menu");
      return `Screen: ${screenName}`;
    }

    // story mode
    const title = sanitizeTitle(pillState.storyTitle);
    const section = String(Number(pillState.sectionId || 1)).padStart(3, "0");

    if (pillState.chapter && Number.isInteger(pillState.chapter)) {
      return clampPill(`${title} · Ch ${pillState.chapter} · §${section}`, 28);
    }

    return clampPill(`${title} · §${section}`, 28);
  }

  // Subtle swap animation:
  // - add .is-swapping (fade out + translate -2px + slight blur)
  // - after 180ms swap text + classes, remove .is-swapping (fade in)
  function setPill(nextPillState) {
    State.pill = { ...nextPillState };

    const pillWrap = $("pill");
    const pillText = $("pillText");
    if (!pillWrap || !pillText) return;

    const nextText = renderPillText(State.pill);

    // If reduced motion, swap instantly.
    const prefersReducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      safeText(pillText, nextText);
      pillWrap.classList.toggle("is-story", State.pill.mode === "story");
      pillWrap.classList.remove("is-swapping");
      debugLog("Pill set (reduced motion)", State.pill);
      return;
    }

    pillWrap.classList.add("is-swapping");

    window.setTimeout(() => {
      safeText(pillText, nextText);
      pillWrap.classList.toggle("is-story", State.pill.mode === "story");
      pillWrap.classList.remove("is-swapping");
      debugLog("Pill set", State.pill);
    }, 180);
  }

  // ---------------------------
  // Screen Router (minimal baseline)
  // ---------------------------
  function setScreen(name) {
    State.screen = name;

    // Update pill to SCREEN mode for non-game screens
    if (name !== "Game") {
      setPill({ mode: "screen", screen: name });
    }

    // Toggle screen sections
    const screens = ["Menu", "Catalog", "Packs", "Stories", "Game", "Settings", "Debug"];
    for (const s of screens) {
      const el = $(`screen${s}`);
      if (el) el.style.display = (s === name) ? "block" : "none";
    }

    // Update top right "Menu" button visibility
    const menuBtn = $("btnTopMenu");
    if (menuBtn) {
      menuBtn.style.visibility = (name === "Menu") ? "hidden" : "visible";
    }

    debugLog("Screen changed", { screen: name });
  }

  // ---------------------------
  // Button actions (baseline)
  // ---------------------------
  function onLoadNewStory() {
    // In the verified pipeline, this will load content/Catalog.json.
    // Keeping this button flow stable.
    setScreen("Catalog");
    debugLog("Load New Story tapped");
  }

  function onContinueStory() {
    debugLog("Continue Story tapped (disabled baseline)");
  }

  function onSettings() {
    setScreen("Settings");
    debugLog("Settings tapped");
  }

  function onMenu() {
    setScreen("Menu");
    debugLog("Menu tapped");
  }

  // Demo-only helper to show pill switching to story mode (for animation validation)
  // Can be removed later, but harmless and useful for debugging.
  function onEnterGameDemo() {
    setScreen("Game");

    // Switch pill to STORY mode
    setPill({
      mode: "story",
      storyTitle: "Starter Sample",
      sectionId: 14
    });

    // Display some placeholder game text
    const title = $("gameTitle");
    const body = $("gameBody");
    safeText(title, "Game (Demo)");
    safeText(body, "This is a demo screen to validate the PillText story mode swap. The real engine will render story sections here.");

    debugLog("Entered Game demo");
  }

  // ---------------------------
  // Wiring
  // ---------------------------
  function wireButton(id, handler) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handler();
    }, { passive: false });
  }

  function init() {
    // Footer version
    const foot = $("footerVersion");
    if (foot) safeText(foot, `VerseCraft v${APP_VERSION} • GitHub Pages • iOS Safari baseline`);

    // Initial pill and screen
    setPill({ mode: "screen", screen: "Menu" });
    setScreen("Menu");

    // Wire top menu button
    wireButton("btnTopMenu", onMenu);

    // Wire menu buttons
    wireButton("btnLoadNewStory", onLoadNewStory);
    wireButton("btnContinueStory", onContinueStory);
    wireButton("btnSettings", onSettings);

    // Wire catalog demo controls
    wireButton("btnCatalogBack", onMenu);
    wireButton("btnCatalogEnterGameDemo", onEnterGameDemo);

    // Wire settings
    wireButton("btnSettingsBack", onMenu);

    // Debug panel toggle UI
    const debugToggle = $("debugToggle");
    if (debugToggle) {
      debugToggle.checked = State.debug.enabled;
      debugToggle.addEventListener("change", () => setDebugEnabled(debugToggle.checked));
    }
    renderDebug();

    debugLog("App initialized", { version: APP_VERSION, debug: State.debug.enabled });
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();