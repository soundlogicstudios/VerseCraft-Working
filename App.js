(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  // Screens
  var screens = {
    menu: $("screenMenu"),
    stories: $("screenStories"),
    game: $("screenGame"),
    settings: $("screenSettings")
  };

  var uiStatus = $("uiStatus");

  // Stories UI
  var storyListEl = $("storyList");
  var selectedStoryId = null;
  var selectedStoryTitle = null;
  var selectedStoryFile = null;

  var selectedStoryNameEl = $("selectedStoryName");
  var startBtn = $("btnStart");

  // Game UI
  var gameTitle = $("gameTitle");
  var gameBody = $("gameBody");

  // Runtime story state
  var activeStory = null;
  var activeNodeId = null;

  // Loaded content state (Catalog/Packs)
  var activeCatalog = null;
  var activePack = null;

  // ------------------------
  // UI helpers
  // ------------------------
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

  // ------------------------
  // Canon button wiring (iOS reliable)
  // Every button[data-action] gets its own click listener at init.
  // For dynamic content, we wire newly-rendered buttons and mark them as wired.
  // ------------------------
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

  // ------------------------
  // Safety helpers
  // ------------------------
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

  // ------------------------
  // Actions
  // ------------------------
  function handleAction(action, el) {
    if (action === "home") { showScreen("menu"); return; }
    if (action === "stories") { showScreen("stories"); return; }
    if (action === "settings") { showScreen("settings"); return; }

    if (action === "select-story") {
      var sid = el.getAttribute("data-story-id") || null;
      var title = el.getAttribute("data-story-title") || "Untitled Story";
      var file = el.getAttribute("data-story-file") || null;
      setSelectedStory(sid, title, file);
      return;
    }

    if (action === "start") {
      if (!selectedStoryId) return;

      showScreen("game");
      setGameText(
        "Loading: " + (selectedStoryTitle || "Unknown Story"),
        "Loading story file…"
      );

      loadSelectedStoryFile();
      return;
    }

    if (action === "choose") {
      var to = el.getAttribute("data-to") || null;
      if (!to) return;
      if (!activeStory) return;
      renderNode(to);
      return;
    }
  }

  // ------------------------
  // Catalog & Pack loading (formalized)
  // ------------------------
  // Catalog v1:
  // { schema:"versecraft.catalog.v1", packs:[{packId,title,manifest:{type,path/url}}] }
  function normalizeCatalog(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (!payload.packs || !Array.isArray(payload.packs)) return null;
    return payload;
  }

  // Pack v1:
  // { schema:"versecraft.pack.v1", packId, stories:[{storyId,title,entryFile,description}] }
  function normalizePack(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (!payload.stories || !Array.isArray(payload.stories)) return null;
    return payload;
  }

  function resolveManifestPath(manifest) {
    if (!manifest) return null;
    var t = safeText(manifest.type || "");
    if (t === "local") return safeText(manifest.path || "");
    if (t === "remote") return safeText(manifest.url || "");
    // tolerant
    if (manifest.path) return safeText(manifest.path);
    if (manifest.url) return safeText(manifest.url);
    return null;
  }

  function pickDefaultPack(catalog) {
    // Prefer starter if present, else first.
    if (!catalog || !Array.isArray(catalog.packs) || !catalog.packs.length) return null;

    for (var i = 0; i < catalog.packs.length; i++) {
      if (catalog.packs[i] && catalog.packs[i].packId === "starter") return catalog.packs[i];
    }
    return catalog.packs[0] || null;
  }

  function renderStoriesFromPack(pack) {
    if (!storyListEl) return;
    if (!pack || !Array.isArray(pack.stories) || !pack.stories.length) return;

    var html = "";
    for (var i = 0; i < pack.stories.length; i++) {
      var s = pack.stories[i] || {};
      var id = safeText(s.storyId || s.id || ("story-" + (i + 1)));
      var title = safeText(s.title || "Untitled Story");
      var meta = safeText(s.description || s.subtitle || s.blurb || "");
      var file = safeText(s.entryFile || s.file || "");

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

    // Reset selection when list changes
    setSelectedStory(null, null, null);
  }

  function loadCatalogThenPack() {
    // Canon path (case-sensitive)
    var catalogUrl = "./content/Catalog.json";

    fetch(catalogUrl, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var cat = normalizeCatalog(json);
        if (!cat) throw new Error("Bad catalog");
        activeCatalog = cat;

        var packEntry = pickDefaultPack(cat);
        if (!packEntry) throw new Error("No packs");
        var packUrl = resolveManifestPath(packEntry.manifest);
        if (!packUrl) throw new Error("No manifest");

        return fetch(packUrl, { cache: "no-store" });
      })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var pack = normalizePack(json);
        if (!pack) throw new Error("Bad pack");
        activePack = pack;

        renderStoriesFromPack(pack);
      })
      .catch(function () {
        // Safe fallback: keep whatever is already in the list (placeholder),
        // and ensure existing buttons are wired.
        wireButtonsWithin(storyListEl);

        // Optional backward-compat fallback: try legacy Stories.json if present.
        // This allows safe cleanup AFTER you confirm the new pipeline works.
        tryLoadLegacyStoriesIndex();
      });
  }

  // ------------------------
  // Legacy fallback (temporary safety net)
  // ------------------------
  function normalizeLegacyStoriesPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.stories)) return payload.stories;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function renderLegacyStories(stories) {
    if (!storyListEl) return;
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
    setSelectedStory(null, null, null);
  }

  function tryLoadLegacyStoriesIndex() {
    var url = "./content/Stories.json";
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var stories = normalizeLegacyStoriesPayload(json);
        renderLegacyStories(stories);
      })
      .catch(function () {
        // Leave as-is.
      });
  }

  // ------------------------
  // Story loading + node/choices rendering (Phase 3C)
  // ------------------------
  function getNodeById(story, nodeId) {
    if (!story) return null;

    // nodes as object map
    if (story.nodes && typeof story.nodes === "object" && !Array.isArray(story.nodes)) {
      return story.nodes[nodeId] || null;
    }

    // nodes as array
    if (Array.isArray(story.nodes)) {
      for (var i = 0; i < story.nodes.length; i++) {
        var n = story.nodes[i];
        if (n && n.id === nodeId) return n;
      }
    }

    return null;
  }

  function getStoryTitle(story) {
    if (story && story.title) return safeText(story.title);
    return safeText(selectedStoryTitle || "Story");
  }

  function getStartId(story) {
    if (story && story.start) return safeText(story.start);
    return "start";
  }

  function renderNode(nodeId) {
    if (!activeStory) return;

    var node = getNodeById(activeStory, nodeId);
    activeNodeId = nodeId;

    var title = getStoryTitle(activeStory);
    var header = "Started: " + title;

    if (!node) {
      setGameText(
        header,
        "Missing node: <code>" + escapeHtml(nodeId) + "</code>"
      );
      return;
    }

    var text = node.text ? safeText(node.text) : "";
    var html = "";

    if (text) {
      html += escapeHtml(text).replace(/\n/g, "<br>");
    } else {
      html += "<span class=\"vc-p vc-p--muted\">No text for this node.</span>";
    }

    var choices = Array.isArray(node.choices) ? node.choices : [];
    if (choices.length) {
      html += "<div class=\"vc-divider\" role=\"separator\" aria-hidden=\"true\"></div>";
      html += "<div class=\"vc-stack\" aria-label=\"Choices\">";

      for (var i = 0; i < choices.length; i++) {
        var c = choices[i] || {};
        var cText = safeText(c.text || ("Choice " + (i + 1)));
        var to = safeText(c.to || "");

        var disabledAttr = to ? "" : " disabled";
        var disabledClass = to ? "" : " vc-btn--disabled";

        html += ""
          + "<button class=\"vc-btn" + disabledClass + "\" type=\"button\""
          + " data-action=\"choose\""
          + " data-to=\"" + escapeAttr(to) + "\""
          + disabledAttr + ">"
          + escapeHtml(cText)
          + "</button>";
      }

      html += "</div>";
    }

    setGameText(header, html);
    wireButtonsWithin(gameBody);
  }

  function loadSelectedStoryFile() {
    activeStory = null;
    activeNodeId = null;

    if (!selectedStoryFile) {
      setGameText(
        "Started: " + (selectedStoryTitle || "Unknown Story"),
        "No story file was provided for this selection."
      );
      return;
    }

    fetch(selectedStoryFile, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (story) {
        activeStory = story || {};
        var startId = getStartId(activeStory);
        renderNode(startId);
      })
      .catch(function () {
        setGameText(
          "Started: " + (selectedStoryTitle || "Unknown Story"),
          "Could not load story file: <code>" + escapeHtml(selectedStoryFile) + "</code>"
        );
      });
  }

  // ------------------------
  // Init
  // ------------------------
  function init() {
    wireButtonsWithin(document);
    showScreen("menu");
    setSelectedStory(null, null, null);

    // New pipeline: Catalog -> Pack -> Stories
    loadCatalogThenPack();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();