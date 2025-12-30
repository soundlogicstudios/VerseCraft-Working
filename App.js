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
  var selectedStoryFile = null;

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

  function setSelectedStory(id, title, file) {
    selectedStoryId = id || null;
    selectedStoryTitle = title || null;
    selectedStoryFile = file || null;

    if (selectedStoryNameEl) selectedStoryNameEl.textContent = selectedStoryTitle || "None";
    if (startBtn) startBtn.disabled = !selectedStoryId;
  }

  function setGameText(titleText, bodyHtml) {
    if (gameTitle) gameTitle.textContent = titleText || "";
    if (gameBody) gameBody.innerHTML = bodyHtml || "";
  }

  // --- Action handler (canon pattern) ---
  function handleAction(action, el) {
    if (action === "home") { showScreen("menu"); return; }
    if (action === "stories") { showScreen("stories"); return; }
    if (action === "settings") { showScreen("settings"); return; }

    if (action === "select-story") {
      var sid = el.getAttribute("data-story-id") || null;
      var title = el.getAttribute("data-story-title") || "Example Story";
      var file = el.getAttribute("data-story-file") || null;
      setSelectedStory(sid, title, file);
      return;
    }

    if (action === "start") {
      if (!selectedStoryId) return;

      // Show Game screen immediately for responsiveness, then load story content.
      showScreen("game");
      setGameText(
        "Loading: " + (selectedStoryTitle || "Unknown Story"),
        "Loading story file…"
      );

      loadSelectedStoryFile();
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
  // Phase 3B contract:
  // Stories.json may be either:
  //   - { "stories": [ { id, title, description, file }, ... ] }
  //   - [ { id, title, description, file }, ... ]
  // Required fields per story:
  //   - id (string)
  //   - title (string)
  //   - file (string)  e.g. "./content/stories/example.json"
  //
  // Optional:
  //   - description/subtitle/blurb (string)
  function normalizeStoriesPayload(payload) {
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

  function escapeHtml(str) {
    return safeText(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
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
      var meta = safeText(s.subtitle || s.description || s.blurb || "");
      var file = safeText(s.file || s.path || s.url || "");

      html += ""
        + "<li class=\"vc-listItem\">"
        +   "<div class=\"vc-listItemTitle\">" + escapeHtml(title) + "</div>"
        +   "<div class=\"vc-listItemMeta\">" + escapeHtml(meta || "Available") + "</div>"
        +   "<button class=\"vc-btn vc-btn--small\" type=\"button\""
        +     " data-action=\"select-story\""
        +     " data-story-id=\"" + escapeAttr(id) + "\""
        +     " data-story-title=\"" + escapeAttr(title) + "\""
        +     " data-story-file=\"" + escapeAttr(file) + "\">"
        +     "Select"
        +   "</button>"
        + "</li>";
    }

    storyListEl.innerHTML = html;
    wireButtonsWithin(storyListEl);
  }

  function loadStoriesIndex() {
    // Keep a hard fallback to current placeholder if fetch fails.
    // IMPORTANT: GitHub Pages is case-sensitive; path must match exactly.
    var url = "./content/Stories.json";

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
        wireButtonsWithin(storyListEl);
      });
  }

  // --- Story file loading (Phase 3B) ---
  // Minimal story file contract supported right now:
  //   - title (string, optional)
  //   - start (string, optional; defaults to "start")
  //   - nodes (object map, optional) where nodes[nodeId] has:
  //       - text (string, optional)
  //
  // This phase only displays the starting node text (no choice rendering yet).
  function getStartNode(story) {
    if (!story) return null;

    var startId = story.start || "start";

    // Support: nodes as object map: { "start": {...}, ... }
    if (story.nodes && typeof story.nodes === "object" && !Array.isArray(story.nodes)) {
      return story.nodes[startId] || null;
    }

    // Support: nodes as array: [ { id: "start", ... }, ... ]
    if (Array.isArray(story.nodes)) {
      for (var i = 0; i < story.nodes.length; i++) {
        var n = story.nodes[i];
        if (n && n.id === startId) return n;
      }
    }

    return null;
  }

  function loadSelectedStoryFile() {
    if (!selectedStoryFile) {
      setGameText(
        "Started: " + (selectedStoryTitle || "Unknown Story"),
        "No <code>file</code> was provided for this story in <code>./content/Stories.json</code>."
      );
      return;
    }

    // Ensure relative paths still work on GitHub Pages.
    fetch(selectedStoryFile, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (story) {
        var title = safeText(story && story.title ? story.title : selectedStoryTitle || "Story");
        var startNode = getStartNode(story);

        if (startNode && startNode.text) {
          setGameText(
            "Started: " + title,
            escapeHtml(startNode.text).replace(/\n/g, "<br>")
          );
        } else {
          setGameText(
            "Started: " + title,
            "Story loaded. Next step: render nodes and choices."
          );
        }
      })
      .catch(function () {
        setGameText(
          "Started: " + (selectedStoryTitle || "Unknown Story"),
          "Could not load story file: <code>" + escapeHtml(selectedStoryFile) + "</code>"
        );
      });
  }

  function init() {
    wireButtonsWithin(document);
    showScreen("menu");
    setSelectedStory(null, null, null);
    loadStoriesIndex();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();