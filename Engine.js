// Engine.js
// Pure game logic: validates story, manages state transitions.
// No DOM access. No storage. No fetch.

export const ENGINE_VERSION = "1.1.0";
export const STORY_SCHEMA_VERSION = 1;

const SLOT_KEYS = new Set(["weapon", "armor", "special"]);

export function validateStory(story) {
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

export function createNewGameState(story) {
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

export function getCurrentNode(story, state) {
  return story.nodes[state.nodeId] || null;
}

export function isChoiceAvailable(story, state, choice) {
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

export function applyEffects(story, state, effects = []) {
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

export function choose(story, state, choiceIndex) {
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
export function sanitizeStateForStory(story, state) {
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
}