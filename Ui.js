// Ui.js
// DOM rendering + modal. No game logic decisions beyond displaying state.

export function bindUiElements() {
  const el = {
    screenMenu: document.getElementById("ScreenMenu"),
    screenGame: document.getElementById("ScreenGame"),

    storyList: document.getElementById("StoryList"),
    selectedStoryMeta: document.getElementById("SelectedStoryMeta"),
    btnRefreshStories: document.getElementById("BtnRefreshStories"),
    btnStartSelected: document.getElementById("BtnStartSelected"),

    btnOpenSaves: document.getElementById("BtnOpenSaves"),
    btnBackToMenu: document.getElementById("BtnBackToMenu"),

    gameStoryTitle: document.getElementById("GameStoryTitle"),
    gameNodeId: document.getElementById("GameNodeId"),
    statPills: document.getElementById("StatPills"),
    gameText: document.getElementById("GameText"),
    choiceList: document.getElementById("ChoiceList"),
    btnSaveQuick: document.getElementById("BtnSaveQuick"),
    btnOpenInventory: document.getElementById("BtnOpenInventory"),
    inventoryBar: document.getElementById("InventoryBar"),

    modalOverlay: document.getElementById("ModalOverlay"),
    modalTitle: document.getElementById("ModalTitle"),
    modalBody: document.getElementById("ModalBody"),
    modalActions: document.getElementById("ModalActions"),
    btnCloseModal: document.getElementById("BtnCloseModal")
  };

  return el;
}

export function showScreen(el, which) {
  const onMenu = which === "menu";
  el.screenMenu.hidden = !onMenu;
  el.screenGame.hidden = onMenu;

  el.btnBackToMenu.hidden = onMenu;
}

export function renderStoryList(el, stories, selectedId) {
  el.storyList.innerHTML = "";

  if (!Array.isArray(stories) || stories.length === 0) {
    el.storyList.innerHTML = `<div class="Hint">No stories found. Check ./content/Stories.json</div>`;
    return;
  }

  for (const s of stories) {
    const item = document.createElement("div");
    item.className = "StoryItem";
    item.setAttribute("role", "listitem");
    item.setAttribute("tabindex", "0");
    item.dataset.storyId = s.id;
    item.setAttribute("aria-selected", String(s.id === selectedId));

    item.innerHTML = `
      <div class="StoryTitle">${escapeHtml(s.title || s.id)}</div>
      <div class="StoryDesc">${escapeHtml(s.description || "")}</div>
      <div class="Hint">File: <code>${escapeHtml(s.path || "")}</code></div>
    `;

    el.storyList.appendChild(item);
  }
}

export function setSelectedStoryMeta(el, story) {
  if (!story) {
    el.selectedStoryMeta.textContent = "Select a story to begin.";
    return;
  }
  el.selectedStoryMeta.textContent = `${story.title} • ${story.description || "Ready"}`;
}

export function renderGame(el, story, state, node, choiceViewModels) {
  el.gameStoryTitle.textContent = state.storyTitle || "Story";
  el.gameNodeId.textContent = `Node: ${state.nodeId}`;

  // Stats pills
  el.statPills.innerHTML = "";
  for (const key of ["WISDOM","ENDURANCE","AGILITY","LUCK","TIMING","HEALTH"]) {
    const pill = document.createElement("div");
    pill.className = "Pill";
    pill.textContent = `${key}:${Number(state.stats?.[key] ?? 0)}`;
    el.statPills.appendChild(pill);
  }

  el.gameText.textContent = node?.text ?? "(Missing node text)";

  el.choiceList.innerHTML = "";
  for (let i = 0; i < choiceViewModels.length; i++) {
    const c = choiceViewModels[i];
    const btn = document.createElement("button");
    btn.className = "ChoiceBtn";
    btn.type = "button";
    btn.dataset.choiceIndex = String(i);
    btn.disabled = !c.available;

    btn.textContent = c.available ? c.text : `${c.text} — ${c.reason}`;
    el.choiceList.appendChild(btn);
  }

  // Inventory bar (collapsed by default)
  el.inventoryBar.hidden = true;
}

export function renderInventory(el, state) {
  const lines = [];
  lines.push(`weapon: ${state.inventory?.weapon ?? "none"}`);
  lines.push(`armor: ${state.inventory?.armor ?? "none"}`);
  lines.push(`special: ${state.inventory?.special ?? "none"}`);
  const consumables = state.inventory?.consumables ?? [];
  lines.push(`consumables: ${consumables.length ? consumables.join(", ") : "none"}`);

  el.inventoryBar.innerHTML = lines.map(l => `<div class="InventoryLine">${escapeHtml(l)}</div>`).join("");
}

export function openModal(el, { title, bodyHtml, actions = [] }) {
  el.modalTitle.textContent = title || "Notice";
  el.modalBody.innerHTML = bodyHtml || "";
  el.modalActions.innerHTML = "";

  for (const a of actions) {
    const b = document.createElement("button");
    b.className = `Btn ${a.variant === "ghost" ? "BtnGhost" : ""}`;
    b.type = "button";
    b.textContent = a.text;
    b.addEventListener("click", () => a.onClick?.());
    el.modalActions.appendChild(b);
  }

  el.modalOverlay.hidden = false;
}

export function closeModal(el) {
  el.modalOverlay.hidden = true;
  el.modalBody.innerHTML = "";
  el.modalActions.innerHTML = "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}