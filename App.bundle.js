document.title = "VC BUNDLE LOADED";
alert("APP.BUNDLE.JS EXECUTING");
// Ui.js
// DOM + rendering only. No game logic, no storage, no fetch.

 function bindUiElements() {
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

 function showScreen(el, which) {
  const showMenu = which === "menu";
  el.screenMenu.hidden = !showMenu;
  el.screenGame.hidden = showMenu;
}

 function renderStoryList(el, stories, selectedId) {
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

 function setSelectedStoryMeta(el, story) {
  if (!story) {
    el.selectedStoryTitle.textContent = "Select A Story";
    el.selectedStoryDesc.textContent = "Choose a story from the library.";
    return;
  }
  el.selectedStoryTitle.textContent = story.title || "Untitled";
  el.selectedStoryDesc.textContent = story.description || "";
}

 function renderGame(el, story, state, node, choiceVMs) {
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

 function openModal(el, { title, bodyHtml, actions }) {
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

 function closeModal(el) {
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
// Content.js
// Fetch + load story index and story files. No DOM.

 async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  return await res.json();
}

 async function loadStoryIndex() {
  // Root-deploy safe: relative path
  return await fetchJson("./content/Stories.json");
}

 async function loadStoryFile(path) {
  // Path comes from index (relative)
  return await fetchJson(path);
}// Engine.js
// Pure game logic: validates story, manages state transitions.
// No DOM access. No storage. No fetch.

 const ENGINE_VERSION = "1.1.0";
 const STORY_SCHEMA_VERSION = 1;

const SLOT_KEYS = new Set(["weapon", "armor", "special"]);

 function validateStory(story) {
  const errors = [];

  if (!story || typeof story !== "object") errors.push("Story must be an object.");
  if (story?.schemaVersion !== STORY_SCHEMA_VERSION) errors.push(`schemaVersion must be ${STORY_SCHEMA_VERSION}.`);
  if (!story?.meta?.id || typeof story.meta.id !== "string") errors.push("meta.id must be a string.");
  if (!story?.meta?.title || typeof story.meta.title !== "string") errors.push("meta.title must be a string.");
  if (!story?.start || typeof story.start !== "string") errors.push("start must be a string node id.");

  const nodes = story?.nodes;
  if (!nodes || typeof nodes !== "object") errors.push("nodes must be an object keyed by node id.");

  if (nodes && typeof nodes === "object") {
    if (story.start && !nodes[story.start]) errors.push(`start node '${story.start}' not found in nodes.`);

    for (const [nodeId, node] of Object.entries(nodes)) {
      if (!node || typeof node !== "object") {
        errors.push(`Node '${nodeId}' must be an object.`);
        continue;
      }
      if (typeof node.text !== "string") errors.push(`Node '${nodeId}'.text must be a string.`);
      if (node.choices != null && !Array.isArray(node.choices)) errors.push(`Node '${nodeId}'.choices must be an array.`);

      if (Array.isArray(node.choices)) {
        node.choices.forEach((c, idx) => {
          if (!c || typeof c !== "object") return errors.push(`Node '${nodeId}' choice[${idx}] must be an object.`);
          if (typeof c.text !== "string") errors.push(`Node '${nodeId}' choice[${idx}].text must be a string.`);
          if (typeof c.to !== "string") errors.push(`Node '${nodeId}' choice[${idx}].to must be a string node id.`);
          if (c.to && nodes && !nodes[c.to]) errors.push(`Node '${nodeId}' choice[${idx}] points to missing node '${c.to}'.`);

          if (c.require && typeof c.require !== "object") errors.push(`Node '${nodeId}' choice[${idx}].require must be an object.`);
          if (c.effects && !Array.isArray(c.effects)) errors.push(`Node '${nodeId}' choice[${idx}].effects must be an array.`);
        });
      }
    }
  }

  // Optional item catalog
  if (story.items != null && (typeof story.items !== "object" || Array.isArray(story.items))) {
    errors.push("items must be an object keyed by item id (or omitted).");
  } else if (story.items && typeof story.items === "object") {
    for (const [id, def] of Object.entries(story.items)) {
      if (!def || typeof def !== "object") {
        errors.push(`items['${id}'] must be an object.`);
        continue;
      }
      if (def.allowedSlots != null && !Array.isArray(def.allowedSlots)) {
        errors.push(`items['${id}'].allowedSlots must be an array (if present).`);
      }
      if (Array.isArray(def.allowedSlots)) {
        for (const s of def.allowedSlots) {
          if (!SLOT_KEYS.has(s)) errors.push(`items['${id}'].allowedSlots contains invalid slot '${s}'.`);
        }
      }
      if (def.onEquip != null && !Array.isArray(def.onEquip)) errors.push(`items['${id}'].onEquip must be an array (if present).`);
      if (def.onUnequip != null && !Array.isArray(def.onUnequip)) errors.push(`items['${id}'].onUnequip must be an array (if present).`);
    }
  }

  // Optional resources defaults
  if (story.resources != null && (typeof story.resources !== "object" || Array.isArray(story.resources))) {
    errors.push("resources must be an object keyed by resource key (or omitted).");
  }

  // Optional loadout
  if (story.loadout != null && (typeof story.loadout !== "object" || Array.isArray(story.loadout))) {
    errors.push("loadout must be an object (or omitted).");
  }

  return { ok: errors.length === 0, errors };
}

 function createNewGameState(story) {
  const state = {
    engineVersion: ENGINE_VERSION,
    schemaVersion: STORY_SCHEMA_VERSION,
    storyId: story.meta.id,
    storyTitle: story.meta.title,
    nodeId: story.start,
    stats: {
      WISDOM: 1,
      ENDURANCE: 1,
      AGILITY: 1,
      LUCK: 1,
      TIMING: 1,
      HEALTH: 10
    },
    // Story-defined resources (HP, Reputation, Credits, Phase, etc.)
    resources: {},
    inventory: {
      weapon: null,
      armor: null,
      special: null,
      consumables: [],
      items: []
    },
    flags: {},
    visited: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Initialize resources from story.resources (defaults)
  if (story.resources && typeof story.resources === "object") {
    for (const [k, def] of Object.entries(story.resources)) {
      const label = typeof def?.label === "string" ? def.label : k;
      const max = Number.isFinite(Number(def?.max)) ? Number(def.max) : 0;
      const current = Number.isFinite(Number(def?.current)) ? Number(def.current) : max;
      state.resources[k] = {
        label,
        max,
        current: clamp(current, 0, max)
      };
    }
  }

  // Apply loadout (items, consumables, equip, resources)
  const loadout = story.loadout && typeof story.loadout === "object" ? story.loadout : null;

  if (loadout?.items && Array.isArray(loadout.items)) {
    state.inventory.items.push(...loadout.items.filter(x => typeof x === "string"));
  }
  if (loadout?.consumables && Array.isArray(loadout.consumables)) {
    state.inventory.consumables.push(...loadout.consumables.filter(x => typeof x === "string"));
  }
  if (loadout?.equip && typeof loadout.equip === "object") {
    // Equip by moving from items pool if present; otherwise equip directly (starter “feels powerful”)
    for (const [slot, id] of Object.entries(loadout.equip)) {
      if (!SLOT_KEYS.has(slot)) continue;
      if (typeof id !== "string") continue;

      // If item exists in pool, use normal equip flow to keep state consistent
      if (state.inventory.items.includes(id)) {
        equipFromItemsPool(story, state, slot, id, { applyItemEffects: true });
      } else {
        // Direct equip: still enforce slot legality if item is defined
        const ok = canEquipToSlot(story, id, slot);
        if (ok.ok) {
          state.inventory[slot] = id;
          applyItemEffects(story, state, id, "onEquip");
        }
      }
    }
  }
  if (loadout?.resources && typeof loadout.resources === "object") {
    for (const [key, patch] of Object.entries(loadout.resources)) {
      if (!state.resources[key]) continue;
      if (patch && typeof patch === "object") {
        if (Number.isFinite(Number(patch.max))) state.resources[key].max = Number(patch.max);
        if (Number.isFinite(Number(patch.current))) state.resources[key].current = Number(patch.current);
        state.resources[key].current = clamp(state.resources[key].current, 0, state.resources[key].max);
        if (typeof patch.label === "string") state.resources[key].label = patch.label;
      }
    }
  }

  state.updatedAt = Date.now();
  return state;
}

 function getCurrentNode(story, state) {
  return story.nodes[state.nodeId] || null;
}
 function isChoiceAvailable(story, state, choice) {
  if (!choice?.require) return { ok: true };
  const r = choice.require;

  if (r.statGte && typeof r.statGte === "object") {
    for (const [k, v] of Object.entries(r.statGte)) {
      const cur = Number(state.stats?.[k] ?? 0);
      if (cur < Number(v)) return { ok: false, reason: `Requires ${k} ≥ ${v}` };
    }
  }

  if (r.resourceGte && typeof r.resourceGte === "object") {
    for (const [k, v] of Object.entries(r.resourceGte)) {
      const cur = Number(state.resources?.[k]?.current ?? 0);
      if (cur < Number(v)) {
        const label = state.resources?.[k]?.label ?? k;
        return { ok: false, reason: `Requires ${label} ≥ ${v}` };
      }
    }
  }

  if (r.resourceLte && typeof r.resourceLte === "object") {
    for (const [k, v] of Object.entries(r.resourceLte)) {
      const cur = Number(state.resources?.[k]?.current ?? 0);
      if (cur > Number(v)) {
        const label = state.resources?.[k]?.label ?? k;
        return { ok: false, reason: `Requires ${label} ≤ ${v}` };
      }
    }
  }

  if (Array.isArray(r.hasFlag)) {
    for (const f of r.hasFlag) {
      if (!state.flags?.[f]) return { ok: false, reason: `Requires flag: ${f}` };
    }
  }

  if (Array.isArray(r.hasItem)) {
    const ids = new Set(getAllOwnedItemIds(state));
    for (const itemId of r.hasItem) {
      if (!ids.has(itemId)) return { ok: false, reason: `Requires item: ${itemId}` };
    }
  }

  if (Array.isArray(r.hasConsumable)) {
    const cons = new Set(Array.isArray(state.inventory?.consumables) ? state.inventory.consumables : []);
    for (const id of r.hasConsumable) {
      if (!cons.has(id)) return { ok: false, reason: `Requires consumable: ${id}` };
    }
  }

  return { ok: true };
}

 function applyEffects(story, state, effects = []) {
  // Supported ops:
  // statAdd, flagSet
  // giveItem, giveConsumable, consumeConsumable
  // equip, unequip
  // resourceAdd, resourceSet, resourceMaxAdd
  //
  // Unknown ops are ignored.
  const next = structuredClone(state);

  for (const e of effects) {
    if (!e || typeof e !== "object") continue;

    if (e.op === "statAdd") {
      const key = e.key;
      const val = Number(e.value ?? 0);
      if (key && Number.isFinite(val)) {
        const cur = Number(next.stats?.[key] ?? 0);
        next.stats[key] = cur + val;
      }

    } else if (e.op === "flagSet") {
      if (typeof e.key === "string") next.flags[e.key] = Boolean(e.value);

    } else if (e.op === "giveConsumable") {
      if (typeof e.id === "string") {
        if (!Array.isArray(next.inventory.consumables)) next.inventory.consumables = [];
        next.inventory.consumables.push(e.id);
      }

    } else if (e.op === "consumeConsumable") {
      if (typeof e.id === "string") {
        if (!Array.isArray(next.inventory.consumables)) next.inventory.consumables = [];
        const idx = next.inventory.consumables.indexOf(e.id);
        if (idx !== -1) next.inventory.consumables.splice(idx, 1);
      }

    } else if (e.op === "giveItem") {
      if (typeof e.id === "string") {
        if (!Array.isArray(next.inventory.items)) next.inventory.items = [];
        next.inventory.items.push(e.id);
      }

    } else if (e.op === "equip") {
      const slot = e.slot;
      const id = e.id;
      if (typeof slot === "string" && SLOT_KEYS.has(slot) && typeof id === "string") {
        const res = equipFromItemsPool(story, next, slot, id, { applyItemEffects: true });
        if (!res.ok) next.flags.__LAST_EQUIP_ERROR__ = res.error;
        else delete next.flags.__LAST_EQUIP_ERROR__;
      }

    } else if (e.op === "unequip") {
      const slot = e.slot;
      if (typeof slot === "string" && SLOT_KEYS.has(slot)) {
        unequipToItemsPool(story, next, slot, { applyItemEffects: true });
      }

    } else if (e.op === "resourceAdd") {
      const key = e.key;
      const val = Number(e.value ?? 0);
      if (typeof key === "string" && Number.isFinite(val)) {
        ensureResource(next, key);
        next.resources[key].current = clamp(next.resources[key].current + val, 0, next.resources[key].max);
      }

    } else if (e.op === "resourceSet") {
      const key = e.key;
      const val = Number(e.value ?? 0);
      if (typeof key === "string" && Number.isFinite(val)) {
        ensureResource(next, key);
        next.resources[key].current = clamp(val, 0, next.resources[key].max);
      }

    } else if (e.op === "resourceMaxAdd") {
      const key = e.key;
      const val = Number(e.value ?? 0);
      if (typeof key === "string" && Number.isFinite(val)) {
        ensureResource(next, key);
        next.resources[key].max = Math.max(0, next.resources[key].max + val);
        next.resources[key].current = clamp(next.resources[key].current, 0, next.resources[key].max);
      }
    }
  }

  next.updatedAt = Date.now();
  return next;
}

 function choose(story, state, choiceIndex) {
  const node = getCurrentNode(story, state);
  if (!node) return { ok: false, error: "Current node not found." };

  const choices = Array.isArray(node.choices) ? node.choices : [];
  const choice = choices[choiceIndex];
  if (!choice) return { ok: false, error: "Choice not found." };

  const availability = isChoiceAvailable(story, state, choice);
  if (!availability.ok) return { ok: false, error: availability.reason || "Choice not available." };

  let next = structuredClone(state);
  next.visited[next.nodeId] = (next.visited[next.nodeId] ?? 0) + 1;

  if (Array.isArray(choice.effects) && choice.effects.length) {
    next = applyEffects(story, next, choice.effects);
  }

  next.nodeId = choice.to;
  next.updatedAt = Date.now();

  return { ok: true, state: next };
}

// --- Save safety: strip foreign items on load (prevents story contamination) ---
 function sanitizeStateForStory(story, state) {
  const next = structuredClone(state);
  if (!next.inventory) return next;

  const catalog = story?.items && typeof story.items === "object" ? story.items : null;
  if (!catalog) return next; // If no catalog, don't delete anything (V1-safe)

  const isKnown = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog, id);

  // Unequip invalid
  for (const slot of ["weapon", "armor", "special"]) {
    const cur = next.inventory[slot];
    if (cur && !isKnown(cur)) next.inventory[slot] = null;
  }

  // Remove invalid pool items
  if (Array.isArray(next.inventory.items)) {
    next.inventory.items = next.inventory.items.filter(isKnown);
  }

  // Consumables are left alone for now (can be made strict later)
  next.updatedAt = Date.now();
  return next;
}

// ---------- helpers ----------

function ensureResource(state, key) {
  if (!state.resources || typeof state.resources !== "object") state.resources = {};
  if (!state.resources[key]) {
    state.resources[key] = { label: key, current: 0, max: 0 };
  }
  if (!Number.isFinite(Number(state.resources[key].current))) state.resources[key].current = 0;
  if (!Number.isFinite(Number(state.resources[key].max))) state.resources[key].max = 0;
  if (typeof state.resources[key].label !== "string") state.resources[key].label = key;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function getAllOwnedItemIds(state) {
  const inv = state.inventory || {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  const cons = Array.isArray(inv.consumables) ? inv.consumables : [];
  return [inv.weapon, inv.armor, inv.special, ...items, ...cons].filter(Boolean);
}

function getItemDef(story, id) {
  const def = story?.items?.[id];
  return (def && typeof def === "object") ? def : null;
}

function canEquipToSlot(story, id, slot) {
  const def = getItemDef(story, id);

  // If item isn't defined, treat as not-equipable under strict catalog stories
  if (!def) return { ok: false, error: `Unknown item '${id}'.` };

  const allowed = def.allowedSlots;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return { ok: false, error: `Item '${id}' is not equipable.` };
  }

  if (!allowed.includes(slot)) {
    return { ok: false, error: `Item '${id}' cannot be equipped to ${slot}.` };
  }

  return { ok: true };
}

function applyItemEffects(story, state, itemId, which) {
  const def = getItemDef(story, itemId);
  const effects = def?.[which];
  if (!Array.isArray(effects) || effects.length === 0) return state;
  return applyEffects(story, state, effects);
}

function equipFromItemsPool(story, state, slot, id, opts = {}) {
  const inv = state.inventory;
  if (!inv) return { ok: false, error: "Inventory missing." };
  if (!Array.isArray(inv.items)) inv.items = [];

  const idx = inv.items.indexOf(id);
  if (idx === -1) return { ok: false, error: `You don't have '${id}' in your gear.` };

  const ok = canEquipToSlot(story, id, slot);
  if (!ok.ok) return ok;

  // If slot occupied, unequip old one back to pool (and apply onUnequip)
  const prev = inv[slot];
  if (prev) {
    inv.items.push(prev);
    if (opts.applyItemEffects) {
      const after = applyItemEffects(story, state, prev, "onUnequip");
      Object.assign(state, after);
    }
  }

  // Remove from pool and equip
  inv.items.splice(idx, 1);
  inv[slot] = id;

  if (opts.applyItemEffects) {
    const after = applyItemEffects(story, state, id, "onEquip");
    Object.assign(state, after);
  }

  return { ok: true };
}

function unequipToItemsPool(story, state, slot, opts = {}) {
  const inv = state.inventory;
  if (!inv) return;

  const cur = inv[slot];
  if (!cur) return;

  if (!Array.isArray(inv.items)) inv.items = [];
  inv.items.push(cur);
  inv[slot] = null;

  if (opts.applyItemEffects) {
    const after = applyItemEffects(story, state, cur, "onUnequip");
    Object.assign(state, after);
  }
}// Storage.js
// Save/load only. No DOM. No fetch.

const KEY_PREFIX = "VerseCraft.SaveSlot.";
const META_PREFIX = "VerseCraft.SaveMeta.";

 function listSaveSlots(maxSlots = 3) {
  const slots = [];
  for (let i = 1; i <= maxSlots; i++) {
    const metaRaw = localStorage.getItem(`${META_PREFIX}${i}`);
    const meta = metaRaw ? safeJsonParse(metaRaw) : null;
    slots.push({ slot: i, meta });
  }
  return slots;
}

function saveToSlot(slot, gameState) {
  const payload = JSON.stringify(gameState);
  localStorage.setItem(`${KEY_PREFIX}${slot}`, payload);

  const meta = {
    slot,
    storyId: gameState.storyId,
    storyTitle: gameState.storyTitle,
    nodeId: gameState.nodeId,
    updatedAt: gameState.updatedAt ?? Date.now()
  };
  localStorage.setItem(`${META_PREFIX}${slot}`, JSON.stringify(meta));
  return meta;
}

 function loadFromSlot(slot) {
  const raw = localStorage.getItem(`${KEY_PREFIX}${slot}`);
  if (!raw) return null;
  return safeJsonParse(raw);
}

 clearSlot(slot) {
  localStorage.removeItem(`${KEY_PREFIX}${slot}`);
  localStorage.removeItem(`${META_PREFIX}${slot}`);
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}alert("APP.JS EXECUTING — TOP OF FILE");// App.js
// Boot + routing + event wiring. UI glue only.

 {
  bindUiElements,
  showScreen,
  renderStoryList,
  setSelectedStoryMeta,
  renderGame,
  openModal,
  closeModal
} from "./Ui.js";

 { loadStoryIndex, loadStoryFile } from "./Content.js";
{
  validateStory,
  createNewGameState,
  getCurrentNode,
  isChoiceAvailable,
  choose,
  applyEffects,
  sanitizeStateForStory
} from "./Engine.js";
 { listSaveSlots, saveToSlot, loadFromSlot, clearSlot } from "./Storage.js";

const el = bindUiElements();

const app = {
  stories: [],
  selectedStoryId: null,
  selectedStory: null,
  story: null,
  state: null,
  maxSaveSlots: 3
};
// =====================
// DEBUG CONSOLE (iOS)
// =====================
(function installDebugPanel() {
  if (window.__VC_DEBUG__) return;
  window.__VC_DEBUG__ = true;

  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 40%;
    overflow: auto;
    background: rgba(0,0,0,0.85);
    color: #0f0;
    font: 12px monospace;
    padding: 6px;
    z-index: 99999;
  `;
  panel.id = "VC_DEBUG_PANEL";
  panel.innerHTML = "<div><strong>VerseCraft DEBUG</strong></div>";
  document.body.appendChild(panel);
alert("DEBUG PANEL INSTALLED");

  window.VC_LOG = (msg) => {
    const line = document.createElement("div");
    line.textContent = msg;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  };

  VC_LOG("DEBUG PANEL MOUNTED");
})();boot().catch(err => fatal(err));

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
 {
  
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

  // Install capture-phase listeners for iOS Safari
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