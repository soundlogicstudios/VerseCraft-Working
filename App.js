(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var screens = {
    menu: $("screenMenu"),
    stories: $("screenStories"),
    game: $("screenGame"),
    settings: $("screenSettings")
  };

  var uiStatus = $("uiStatus");

  var storyListEl = $("storyList");
  var selectedStoryId = null;
  var selectedStoryTitle = null;
  var selectedStoryNameEl = $("selectedStoryName");
  var startBtn = $("btnStart");
  var gameTitle = $("gameTitle");
  var gameBody = $("gameBody");

  // --- UI helpers ---
  function setStatus(label) {
    if (uiStatus) uiStatus.textContent = "Screen: " + label;
  }

  function showScreen(key) {
    Object.keys(screens).forEach(function (k) {
      var active = (k === key);
      screens[k].classList.toggle("is-active", active);
    });

    if (key === "menu") setStatus("Menu");
    else if (key === "stories") setStatus("Stories");
    else if (key === "game") setStatus("Game");
    else if (key === "settings") setStatus("Settings");
  }

  function setSelectedStory(id, title) {
    selectedStoryId = id || null;
    selectedStoryTitle = title || null;

    if (selectedStoryNameEl) selectedStoryNameEl.textContent = selectedStoryTitle || "None";
    if (startBtn) startBtn.disabled = !selectedStoryId;
  }

  // --- Action handler (canon pattern) ---
  function handleAction(action, el) {
    if (action === "home") { showScreen("menu"); return; }
    if (action === "stories") { showScreen("stories"); return; }
    if (action === "settings") { showScreen("settings"); return; }

    if (action === "select-story") {
      var sid = el.getAttribute("data-story-id") || null;
      var title = el.getAttribute("data-story-title") || "Example Story";
      setSelectedStory(sid, title);
      return;
    }

    if (action === "start") {
      if (!selectedStoryId) return;
      if (gameTitle) gameTitle.textContent = "Started: " + (selectedStoryTitle || "Unknown Story");
      if (gameBody) {
        gameBody.innerHTML = "Loaded from <strong>./content/Stories.json</strong>. Next step: load the selected story file.";
      }
      showScreen("game");
      return;
    }
  }

  // --- Button wiring (iOS reliable) ---
  // Canon rule: every button[data-action] gets its own click listener at init.
  // For dynamic story buttons, we also wire newly-added buttons after render.
  function wireButtonsWithin(root) {
    var scope = root || document;
    var all = scope.querySelectorAll("button[data-action]");
    for (var i = 0; i < all.length; i++) {
      var btn = all[i];
      if (btn.getAttribute("data-vc-wired") === "1") continue;
      btn.setAttribute("data-vc-wired", "1");

      (function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          var action = b.getAttribute("data-action");
          handleAction(action, b);
        }, { passive: false });
      })(btn);
    }
  }

  // --- Stories.json loading ---
  function normalizeStoriesPayload(payload) {
    // Accept either:
    // 1) { stories: [...] }
    // 2) [...]
    // 3) { items: [...] } (tolerant)
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.stories)) return payload.stories;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function safeText(x) {
    if (x === null || x === undefined) return "";
    return String(x);
  }

  function renderStories(stories) {
    if (!storyListEl) return;

    // Replace placeholder list only if we have at least one valid story
    if (!stories || !stories.length) return;

    var html = "";
    for (var i = 0; i < stories.length; i++) {
      var s = stories[i] || {};
      var id = safeText(s.id || s.storyId || s.key || ("story-" + (i + 1)));
      var title = safeText(s.title || s.name || "Untitled Story");
      var meta = safeText(s.subtitle || s.description || s.blurb || s.file || "");

      // Minimal card layout mirrors the placeholder structure.
      html += ""
        + "<li class=\"vc-listItem\">"
        +   "<div class=\"vc-listItemTitle\">" + escapeHtml(title) + "</div>"
        +   "<div class=\"vc-listItemMeta\">" + escapeHtml(meta || "Available") + "</div>"
        +   "<button class=\"vc-btn vc-btn--small\" type=\"button\""
        +     " data-action=\"select-story\""
        +     " data-story-id=\"" + escapeAttr(id) + "\""
        +     " data-story-title=\"" + escapeAttr(title) + "\">"
        +     "Select"
        +   "</button>"
        + "</li>";
    }

    storyListEl.innerHTML = html;

    // Wire the newly-created buttons explicitly (canon-safe)
    wireButtonsWithin(storyListEl);
  }

  function escapeHtml(str) {
    return safeText(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(str) {
    // Use same escaping; attributes are quoted.
    return escapeHtml(str);
  }

  function loadStoriesIndex() {
    // Keep a hard fallback to current placeholder if fetch fails.
    // IMPORTANT: GitHub Pages is case-sensitive; path must match exactly.
    var url = "./content/Stories.json";

    // Cache-bust can be added later if needed; keep stable for now.
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var stories = normalizeStoriesPayload(json);
        renderStories(stories);
      })
      .catch(function () {
        // Leave placeholder list as-is.
        // Still ensure any existing buttons are wired.
        wireButtonsWithin(storyListEl);
      });
  }

  function init() {
    wireButtonsWithin(document);
    showScreen("menu");
    setSelectedStory(null, null);
    loadStoriesIndex();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();