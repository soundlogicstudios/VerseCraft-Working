// App.js
// Boot + routing + event wiring. UI glue only.

import {
  bindUiElements,
  showScreen,
  renderStoryList,
  setSelectedStoryMeta,
  renderGame,
  openModal,
  closeModal
} from "./Ui.js";

import { loadStoryIndex, loadStoryFile } from "./Content.js";
import {
  validateStory,
  createNewGameState,
  getCurrentNode,
  isChoiceAvailable,
  choose,
  applyEffects,
  sanitizeStateForStory
} from "./Engine.js";
import { listSaveSlots, saveToSlot, loadFromSlot, clearSlot } from "./Storage.js";

const el = bindUiElements();

const app = {
  stories: [],
  selectedStoryId: null,
  selectedStory: null,
  story: null,
  state: null,
  maxSaveSlots: 3
};

boot().catch(err => fatal(err));

async function boot() {
  wireEvents();
  showScreen(el, "menu");
  await refreshStoryIndex();
}

function wireEvents() {
  el.btnRefreshStories.addEventListener("click", async () => {
    await refreshStoryIndex();
  });

  el.storyList.addEventListener("click", (e) => {
    const item = e.target.closest(".StoryItem");
    if (!item) return;
    selectStory(item.dataset.storyId);
  });

  el.storyList.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const item = e.target.closest(".StoryItem");
    if (!item) return;
    selectStory(item.dataset.storyId);
  });

  el.btnStartSelected.addEventListener("click", async () => {
    if (!app.selectedStory) return;
    await startSelectedStory();
  });

  el.btnBackToMenu.addEventListener("click", () => {
    app.story = null;
    app.state = null;
    showScreen(el, "menu");
  });

  el.choiceList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-choice-index]");
    if (!btn) return;
    onChoose(Number(btn.dataset.choiceIndex));
  });

  el.btnSaveQuick.addEventListener("click", () => {
    if (!app.state) return;
    const meta = saveToSlot(1, app.state);
    toast(`Saved to Slot ${meta.slot}`);
  });

  el.btnOpenInventory.addEventListener("click", () => {
    if (!app.state) return;
    el.inventoryBar.hidden = !el.inventoryBar.hidden;
    if (!el.inventoryBar.hidden) renderInventoryPanel();
  });

  el.btnOpenSaves.addEventListener("click", () => openSavesModal());

  el.btnCloseModal.addEventListener("click", () => closeModal(el));
  el.modalOverlay.addEventListener("click", (e) => { if (e.target === el.modalOverlay) closeModal(el); });
// iOS Safari reliability: capture-phase fallback for modal taps.
// Place this directly AFTER the block where you wire:
// - el.btnOpenSaves.addEventListener(...)
// - el.btnCloseModal.addEventListener(...)
// - el.modalOverlay.addEventListener(...)
(function installModalTapFallback() {
  // prevent double-install if init runs more than once
  if (el._modalTapFallbackInstalled) return;
  el._modalTapFallbackInstalled = true;

  const onTapCapture = (e) => {
    // Only care if modal overlay is currently visible
    if (!el.modalOverlay || el.modalOverlay.hidden) return;

    const t = e.target;

    // Close button (id matches your index.html: BtnCloseModal)
    if (t && t.closest && t.closest("#BtnCloseModal")) {
      e.preventDefault();
      e.stopPropagation();
      closeModal(el);
      return;
    }

    // Tap on overlay background itself (not inside the modal card)
    if (t === el.modalOverlay) {
      e.preventDefault();
      e.stopPropagation();
      closeModal(el);
      return;
    }
  };

  // Capture phase beats other handlers that might stop propagation.
  document.addEventListener("pointerup", onTapCapture, { capture: true });
  document.addEventListener("touchend", onTapCapture, { capture: true });
  document.addEventListener("click", onTapCapture, { capture: true });
})();
}

async function refreshStoryIndex() {
  el.btnStartSelected.disabled = true;
  setSelectedStoryMeta(el, null);

  try {
    const index = await loadStoryIndex();
    if (!index || !Array.isArray(index.stories)) throw new Error("Stories.json must contain { stories: [...] }");

    app.stories = index.stories.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      path: s.path
    }));

    if (!app.selectedStoryId && app.stories.length) app.selectedStoryId = app.stories[0].id;

    app.selectedStory = app.stories.find(s => s.id === app.selectedStoryId) ?? null;
    renderStoryList(el, app.stories, app.selectedStoryId);
    setSelectedStoryMeta(el, app.selectedStory);
    el.btnStartSelected.disabled = !app.selectedStory;

  } catch (err) {
    openModal(el, {
      title: "Story Index Error",
      bodyHtml: `<div class="Hint">${escapeHtml(err.message)}</div>
                <div class="Hint">Check <code>./content/Stories.json</code> exists and is valid JSON.</div>`,
      actions: [{ text: "Close", variant: "ghost", onClick: () => closeModal(el) }]
    });
  }
}

function selectStory(storyId) {
  app.selectedStoryId = storyId;
  app.selectedStory = app.stories.find(s => s.id === storyId) ?? null;

  renderStoryList(el, app.stories, app.selectedStoryId);
  setSelectedStoryMeta(el, app.selectedStory);
  el.btnStartSelected.disabled = !app.selectedStory;
}

async function startSelectedStory() {
  try {
    const story = await loadStoryFile(app.selectedStory.path);
    const v = validateStory(story);
    if (!v.ok) {
      openModal(el, {
        title: "Story Validation Failed",
        bodyHtml: `<div class="Hint">This story file does not match the required contract:</div>
                  <ul>${v.errors.map(e => `<li class="Hint">${escapeHtml(e)}</li>`).join("")}</ul>`,
        actions: [{ text: "Close", variant: "ghost", onClick: () => closeModal(el) }]
      });
      return;
    }

    app.story = story;
    app.state = createNewGameState(story);

    showScreen(el, "game");
    renderCurrent();

  } catch (err) {
    openModal(el, {
      title: "Load Story Error",
      bodyHtml: `<div class="Hint">${escapeHtml(err.message)}</div>
                <div class="Hint">Path: <code>${escapeHtml(app.selectedStory?.path ?? "")}</code></div>`,
      actions: [{ text: "Close", variant: "ghost", onClick: () => closeModal(el) }]
    });
  }
}

function renderCurrent() {
  const node = getCurrentNode(app.story, app.state);
  if (!node) {
    openModal(el, {
      title: "Runtime Error",
      bodyHtml: `<div class="Hint">Node not found: <code>${escapeHtml(app.state.nodeId)}</code></div>`,
      actions: [{ text: "Menu", onClick: () => { closeModal(el); showScreen(el, "menu"); } }]
    });
    return;
  }

  const choices = Array.isArray(node.choices) ? node.choices : [];
  const choiceVMs = choices.map(c => {
    const a = isChoiceAvailable(app.story, app.state, c);
    return { text: c.text, available: a.ok, reason: a.reason || "Locked" };
  });

  renderGame(el, app.story, app.state, node, choiceVMs);

  if (!el.inventoryBar.hidden) renderInventoryPanel();
}

function onChoose(index) {
  const result = choose(app.story, app.state, index);
  if (!result.ok) {
    toast(result.error || "Cannot choose that.");
    return;
  }
  app.state = result.state;
  renderCurrent();
}

function renderInventoryPanel() {
  const labels = (app.story && typeof app.story.equipmentLabels === "object") ? app.story.equipmentLabels : {};
  const labelFor = (key, fallback) => {
    const v = labels?.[key];
    return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
  };

  const weaponLabel = labelFor("weapon", "Weapon");
  const armorLabel = labelFor("armor", "Armor");
  const specialLabel = labelFor("special", "Special Item");
  const itemsLabel = labelFor("items", "Gear");
  const consumablesLabel = labelFor("consumables", "Supplies");
  const resourcesLabel = labelFor("resources", "Status");

  const inv = app.state?.inventory ?? {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  const consumables = Array.isArray(inv.consumables) ? inv.consumables : [];

  const resources = (app.state?.resources && typeof app.state.resources === "object")
    ? Object.entries(app.state.resources)
    : [];

  const resLines = resources.length
    ? resources.map(([k, r]) => {
        const label = typeof r?.label === "string" ? r.label : k;
        const cur = Number.isFinite(Number(r?.current)) ? Number(r.current) : 0;
        const max = Number.isFinite(Number(r?.max)) ? Number(r.max) : 0;
        return `<div class="InventoryLine">${escapeHtml(label)}: <strong>${escapeHtml(cur)}</strong> / ${escapeHtml(max)}</div>`;
      }).join("")
    : `<div class="Hint">No resources defined.</div>`;

  el.inventoryBar.innerHTML = `
    <div class="InventoryLine"><strong>${escapeHtml(resourcesLabel)}</strong></div>
    ${resLines}
    <div class="Divider"></div>

    <div class="InventoryLine"><strong>${escapeHtml(weaponLabel)}</strong>: ${escapeHtml(inv.weapon ?? "none")}</div>
    <div style="display:flex; gap:10px; margin:6px 0 10px">
      <button class="Btn BtnGhost" type="button" data-equip-slot="weapon">Equip</button>
      <button class="Btn BtnGhost" type="button" data-unequip-slot="weapon" ${inv.weapon ? "" : "disabled"}>Unequip</button>
    </div>

    <div class="InventoryLine"><strong>${escapeHtml(armorLabel)}</strong>: ${escapeHtml(inv.armor ?? "none")}</div>
    <div style="display:flex; gap:10px; margin:6px 0 10px">
      <button class="Btn BtnGhost" type="button" data-equip-slot="armor">Equip</button>
      <button class="Btn BtnGhost" type="button" data-unequip-slot="armor" ${inv.armor ? "" : "disabled"}>Unequip</button>
    </div>

    <div class="InventoryLine"><strong>${escapeHtml(specialLabel)}</strong>: ${escapeHtml(inv.special ?? "none")}</div>
    <div style="display:flex; gap:10px; margin:6px 0 12px">
      <button class="Btn BtnGhost" type="button" data-equip-slot="special">Equip</button>
      <button class="Btn BtnGhost" type="button" data-unequip-slot="special" ${inv.special ? "" : "disabled"}>Unequip</button>
    </div>

    <div class="Divider"></div>

    <div class="InventoryLine"><strong>${escapeHtml(itemsLabel)}</strong>: ${escapeHtml(items.length ? items.join(", ") : "none")}</div>
    <div class="InventoryLine" style="margin-top:8px"><strong>${escapeHtml(consumablesLabel)}</strong>: ${escapeHtml(consumables.length ? consumables.join(", ") : "none")}</div>
  `;

  el.inventoryBar.querySelectorAll("button[data-equip-slot]").forEach(btn => {
    btn.addEventListener("click", () => openEquipPicker(btn.dataset.equipSlot));
  });

  el.inventoryBar.querySelectorAll("button[data-unequip-slot]").forEach(btn => {
    btn.addEventListener("click", () => {
      const slot = btn.dataset.unequipSlot;
      app.state = applyEffects(app.story, app.state, [{ op: "unequip", slot }]);
      renderCurrent();
    });
  });
}

function openEquipPicker(slot) {
  const inv = app.state?.inventory ?? {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  if (!items.length) return toast("No gear available to equip.");

  // Filter items by allowedSlots in catalog (prevents cross-contamination of slots)
  const filtered = items.filter(id => {
    const def = app.story?.items?.[id];
    return def && Array.isArray(def.allowedSlots) && def.allowedSlots.includes(slot);
  });

  if (!filtered.length) return toast("No items fit that slot.");

  const labels = (app.story && typeof app.story.equipmentLabels === "object") ? app.story.equipmentLabels : {};
  const slotLabel =
    slot === "weapon" ? (labels.weapon || "Weapon")
    : slot === "armor" ? (labels.armor || "Armor")
    : (labels.special || "Special Item");

  const list = filtered.map(id => {
    const name = app.story?.items?.[id]?.name;
    const label = (typeof name === "string" && name.trim()) ? name.trim() : id;
    return `<button class="ChoiceBtn" type="button" data-equip-id="${escapeHtmlAttr(id)}">${escapeHtml(label)}</button>`;
  }).join("");

  openModal(el, {
    title: `Equip to ${slotLabel}`,
    bodyHtml: `<div class="Hint">Choose gear to equip:</div>
               <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px">${list}</div>`,
    actions: [{ text: "Cancel", variant: "ghost", onClick: () => closeModal(el) }]
  });

  el.modalBody.querySelectorAll("button[data-equip-id]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.equipId;
      closeModal(el);
      app.state = applyEffects(app.story, app.state, [{ op: "equip", slot, id }]);
      if (app.state.flags?.__LAST_EQUIP_ERROR__) toast(app.state.flags.__LAST_EQUIP_ERROR__);
      renderCurrent();
    });
  });
}

function openSavesModal() {
  const slots = listSaveSlots(app.maxSaveSlots);

  const rows = slots.map(s => {
    const meta = s.meta;
    if (!meta) {
      return `
        <div class="Card" style="margin:10px 0; box-shadow:none">
          <div class="Row">
            <div>
              <div class="Label">Slot ${s.slot}</div>
              <div class="Hint">Empty</div>
            </div>
            <div style="display:flex; gap:10px">
              <button class="Btn BtnGhost" data-save="slot" data-slot="${s.slot}">Save</button>
              <button class="Btn BtnGhost" disabled>Load</button>
              <button class="Btn BtnGhost" disabled>Clear</button>
            </div>
          </div>
        </div>
      `;
    }

    const when = new Date(meta.updatedAt).toLocaleString();
    return `
      <div class="Card" style="margin:10px 0; box-shadow:none">
        <div class="Row">
          <div>
            <div class="Label">Slot ${s.slot}</div>
            <div class="Hint">${escapeHtml(meta.storyTitle)} • Node ${escapeHtml(meta.nodeId)}</div>
            <div class="Hint">${escapeHtml(when)}</div>
          </div>
          <div style="display:flex; gap:10px">
            <button class="Btn BtnGhost" data-save="slot" data-slot="${s.slot}">Save</button>
            <button class="Btn BtnGhost" data-load="slot" data-slot="${s.slot}">Load</button>
            <button class="Btn BtnGhost" data-clear="slot" data-slot="${s.slot}">Clear</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  openModal(el, {
    title: "Save Slots",
    bodyHtml: `<div class="Hint">Slots are stored in localStorage on this device/browser.</div>${rows}`,
    actions: [{ text: "Close", variant: "ghost", onClick: () => closeModal(el) }]
  });

  el.modalBody.querySelectorAll("button[data-save]").forEach(b => {
    b.addEventListener("click", () => {
      const slot = Number(b.dataset.slot);
      if (!app.state) return toast("No active game to save.");
      saveToSlot(slot, app.state);
      toast(`Saved to Slot ${slot}`);
      closeModal(el);
    });
  });

  el.modalBody.querySelectorAll("button[data-load]").forEach(b => {
    b.addEventListener("click", () => {
      const slot = Number(b.dataset.slot);
      const loaded = loadFromSlot(slot);
      if (!loaded) return toast("That slot is empty.");
      loadSaveFlow(loaded).catch(err => fatal(err));
    });
  });

  el.modalBody.querySelectorAll("button[data-clear]").forEach(b => {
    b.addEventListener("click", () => {
      const slot = Number(b.dataset.slot);
      clearSlot(slot);
      toast(`Cleared Slot ${slot}`);
      closeModal(el);
    });
  });
}

async function loadSaveFlow(loadedState) {
  closeModal(el);

  const storyInfo = app.stories.find(s => s.id === loadedState.storyId);
  if (!storyInfo) {
    toast("Save references a story not in Stories.json.");
    return;
  }

  const story = await loadStoryFile(storyInfo.path);
  const v = validateStory(story);
  if (!v.ok) {
    toast("Story validation failed for save story.");
    return;
  }

  app.story = story;
  app.state = sanitizeStateForStory(story, loadedState);

  showScreen(el, "game");
  renderCurrent();
  toast("Loaded save.");
}

function toast(msg) {
  openModal(el, {
    title: "Notice",
    bodyHtml: `<div class="Hint">${escapeHtml(msg)}</div>`,
    actions: [{ text: "OK", onClick: () => closeModal(el) }]
  });
}

function fatal(err) {
  openModal(el, {
    title: "Fatal Error",
    bodyHtml: `<div class="Hint">${escapeHtml(err?.message || String(err))}</div>`,
    actions: [{ text: "Reload", onClick: () => location.reload() }]
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("`", "");
}