alert("APP.BUNDLE.JS EXECUTING");
// Ui.js
// DOM + rendering only. No game logic, no storage, no fetch.

export function bindUiElements() {
  const el = {
    // Screens
    screenMenu: document.getElementById("ScreenMenu"),
    screenGame: document.getElementById("ScreenGame"),

    // Top bar
    btnOpenSaves: document.getElementById("BtnOpenSaves"),
    btnBackToMenu: document.getElementById("BtnBackToMenu"),

    // Menu
    btnRefreshStories: document.getElementById("BtnRefreshStories"),
    storyList: document.getElementById("StoryList"),
    selectedStoryTitle: document.getElementById("SelectedStoryTitle"),
    selectedStoryDesc: document.getElementById("SelectedStoryDesc"),
    btnStartSelected: document.getElementById("BtnStartSelected"),

    // Game header / HUD
    hudPanel: document.getElementById("HudPanel"),
    hudToggle: document.getElementById("HudToggle"),
    hudMedia: document.getElementById("HudMedia"),
    hudStats: document.getElementById("HudStats"),
    hudVitals: document.getElementById("HudVitals"),

    // Game body
    gameTitle: document.getElementById("GameTitle"),
    gameNode: document.getElementById("GameNode"),
    storyText: document.getElementById("StoryText"),
    choiceList: document.getElementById("ChoiceList"),

    // Bottom actions
    btnSaveQuick: document.getElementById("BtnSaveQuick"),
    btnOpenInventory: document.getElementById("BtnOpenInventory"),

    // Inventory panel
    inventoryBar: document.getElementById("InventoryBar"),

    // Modal
    modalOverlay: document.getElementById("ModalOverlay"),
    modalTitle: document.getElementById("ModalTitle"),
    modalBody: document.getElementById("ModalBody"),
    modalActions: document.getElementById("ModalActions"),
    btnCloseModal: document.getElementById("BtnCloseModal")
  };

  // HUD collapse toggle (UI only)
  if (el.hudToggle && el.hudPanel) {
    el.hudToggle.addEventListener("click", () => {
      el.hudPanel.classList.toggle("HudCollapsed");
      el.hudToggle.textContent = el.hudPanel.classList.contains("HudCollapsed") ? "Expand" : "Minimize";
    });
  }

  return el;
}

export function showScreen(el, which) {
  const showMenu = which === "menu";
  el.screenMenu.hidden = !showMenu;
  el.screenGame.hidden = showMenu;
}

export function renderStoryList(el, stories, selectedId) {
  el.storyList.innerHTML = stories.map(s => {
    const selected = s.id === selectedId ? " StoryItemSelected" : "";
    return `
      <div class="StoryItem${selected}" tabindex="0" role="button" data-story-id="${escapeHtmlAttr(s.id)}">
        <div class="StoryItemTitle">${escapeHtml(s.title)}</div>
        <div class="StoryItemDesc">${escapeHtml(s.description || "")}</div>
        <div class="StoryItemFile">File: <code>${escapeHtml(s.path)}</code></div>
      </div>
    `;
  }).join("");
}

export function setSelectedStoryMeta(el, story) {
  if (!story) {
    el.selectedStoryTitle.textContent = "Select A Story";
    el.selectedStoryDesc.textContent = "Choose a story from the library.";
    return;
  }
  el.selectedStoryTitle.textContent = story.title || "Untitled";
  el.selectedStoryDesc.textContent = story.description || "";
}

export function renderGame(el, story, state, node, choiceVMs) {
  // Title / node id
  el.gameTitle.textContent = story?.meta?.title || "Story";
  el.gameNode.textContent = `Node: ${state?.nodeId || "?"}`;

  // HUD: media placeholder + stats initials + vitals strip
  renderHud(el, story, state);

  // Narration text (preserves newlines)
  el.storyText.innerHTML = (node?.text ? escapeHtml(node.text).replaceAll("\n", "<br>") : "");

  // Choices
  el.choiceList.innerHTML = (choiceVMs || []).map((c, i) => {
    const disabled = c.available ? "" : " disabled";
    const hint = c.available ? "" : ` <span class="ChoiceHint">— ${escapeHtml(c.reason || "Locked")}</span>`;
    return `
      <button class="ChoiceBtn" type="button" data-choice-index="${i}"${disabled}>
        ${escapeHtml(c.text)}${hint}
      </button>
    `;
  }).join("");
}

function renderHud(el, story, state) {
  // 1) Media placeholder (future image/video)
  if (el.hudMedia) {
    el.hudMedia.innerHTML = `
      <div class="MediaPlaceholder">
        <div class="MediaTitle">Media</div>
        <div class="MediaHint">Future image/video goes here. Tap Minimize to focus on narration.</div>
      </div>
    `;
  }

  // 2) Stats pills: initials only (W,E,A,L,T,H)
  // Health is still a stat; HP/Credits/etc live in resources.
  const stats = state?.stats || {};
  const statKeys = ["WISDOM", "ENDURANCE", "AGILITY", "LUCK", "TIMING", "HEALTH"];
  const statInitial = (k) => k === "HEALTH" ? "H" : k[0];

  if (el.hudStats) {
    el.hudStats.innerHTML = `
      <div class="HudRow">
        ${statKeys.map(k => `
          <div class="Pill MiniPill" title="${escapeHtml(k)}">
            <span class="PillKey">${escapeHtml(statInitial(k))}</span>
            <span class="PillVal">${escapeHtml(stats[k] ?? 0)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  // 3) Vitals strip: show story resources (HP, Credits, etc) in compact pills
  const resources = (state?.resources && typeof state.resources === "object")
    ? Object.entries(state.resources)
    : [];

  if (el.hudVitals) {
    if (!resources.length) {
      el.hudVitals.innerHTML = "";
    } else {
      el.hudVitals.innerHTML = `
        <div class="HudRow">
          ${resources.map(([key, r]) => {
            const label = (typeof r?.label === "string" && r.label.trim()) ? r.label.trim() : key;
            const cur = Number.isFinite(Number(r?.current)) ? Number(r.current) : 0;
            const max = Number.isFinite(Number(r?.max)) ? Number(r.max) : 0;

            // Short label for mobile: "Hit Points" -> "HP", "Credits" -> "Cr"
            const short = shortLabel(label);

            return `
              <div class="Pill MiniPill" title="${escapeHtml(label)}">
                <span class="PillKey">${escapeHtml(short)}</span>
                <span class="PillVal">${escapeHtml(cur)}/${escapeHtml(max)}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // Inventory panel: add avatar placeholder + keep gear there
  // (Inventory rendering is handled by App.js in your build. This HUD just stays minimal.)
}

export function openModal(el, { title, bodyHtml, actions }) {
  el.modalTitle.textContent = title || "Modal";
  el.modalBody.innerHTML = bodyHtml || "";
  el.modalActions.innerHTML = "";

  (actions || []).forEach(a => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = a.variant === "ghost" ? "Btn BtnGhost" : "Btn";
    btn.textContent = a.text || "OK";
    btn.addEventListener("click", () => a.onClick?.());
    el.modalActions.appendChild(btn);
  });

  el.modalOverlay.hidden = false;
}

export function closeModal(el) {
  el.modalOverlay.hidden = true;
  el.modalTitle.textContent = "";
  el.modalBody.innerHTML = "";
  el.modalActions.innerHTML = "";
}

function shortLabel(label) {
  const t = label.trim().toLowerCase();
  if (t === "hit points") return "HP";
  if (t === "credits") return "Cr";
  if (t === "reputation") return "Rep";
  if (t === "phase") return "Ph";
  if (t.length <= 3) return label; // already short
  // fallback: first 2 letters capitalized
  return label.slice(0, 2).toUpperCase();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("`", "");
}
