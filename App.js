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
  var selectedStoryId = null;
  var selectedStoryNameEl = $("selectedStoryName");
  var startBtn = $("btnStart");
  var gameTitle = $("gameTitle");

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

  function setSelectedStory(id, name) {
    selectedStoryId = id;
    selectedStoryNameEl.textContent = name || "None";
    startBtn.disabled = !selectedStoryId;
  }

  function handleAction(action, el) {
    if (action === "home") { showScreen("menu"); return; }
    if (action === "stories") { showScreen("stories"); return; }
    if (action === "settings") { showScreen("settings"); return; }

    if (action === "select-story") {
      setSelectedStory(el.getAttribute("data-story-id"), "Example Story");
      return;
    }

    if (action === "start") {
      if (!selectedStoryId) return;
      gameTitle.textContent = "Started: " + selectedStoryNameEl.textContent;
      showScreen("game");
      return;
    }
  }

  function wireButtons() {
    var all = document.querySelectorAll("button[data-action]");
    for (var i = 0; i < all.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          var action = btn.getAttribute("data-action");
          handleAction(action, btn);
        }, { passive: false });
      })(all[i]);
    }
  }

  function init() {
    wireButtons();
    showScreen("menu");
    setSelectedStory(null, null);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();