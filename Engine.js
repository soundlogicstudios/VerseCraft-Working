// Engine.js
// Pure game logic: validates story, manages state transitions.
// No DOM access. No storage. No fetch.

export const ENGINE_VERSION = "1.0.2";
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

  // Optional item catalog validation (soft)
  if (story.items != null && typeof story.items !== "object") {
    errors.push("items must be an object keyed by item id (if present).");
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
    }
  }

  return { ok: errors.length === 0, errors };
}

export function createNewGameState(story) {
  return {
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
}

export function getCurrentNode(story, state) {
  return story.nodes[state.nodeId] || null;
}

export function isChoiceAvailable(state, choice) {
  if (!choice?.require) return { ok: true };
  const r = choice.require;

  if (r.statGte && typeof r.statGte === "object") {
    for (const [k, v] of Object.entries(r.statGte)) {
      const cur = Number(state.stats?.[k] ?? 0);
      if (cur < Number(v)) return { ok: false, reason: `Requires ${k} ≥ ${v}` };
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
  return { ok: true };
}

export function applyEffects(state, effects = [], story = null) {
  // Same as before + equip/unequip now enforce catalog allowedSlots (if story provided).
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

    } else if (e.op === "giveItem") {
      if (typeof e.id === "string") {
        if (!Array.isArray(next.inventory.items)) next.inventory.items = [];
        next.inventory.items.push(e.id);
      }

    } else if (e.op === "equip") {
      const slot = e.slot;
      const id = e.id;
      if (typeof slot === "string" && SLOT_KEYS.has(slot) && typeof id === "string") {
        equipFromItemsPool(next, slot, id, story);
      }

    } else if (e.op === "unequip") {
      const slot = e.slot;
      if (typeof slot === "string" && SLOT_KEYS.has(slot)) {
        unequipToItemsPool(next, slot);
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

  const availability = isChoiceAvailable(state, choice);
  if (!availability.ok) return { ok: false, error: availability.reason || "Choice not available." };

  let next = structuredClone(state);
  next.visited[next.nodeId] = (next.visited[next.nodeId] ?? 0) + 1;

  if (Array.isArray(choice.effects) && choice.effects.length) {
    next = applyEffects(next, choice.effects, story);
  }

  next.nodeId = choice.to;
  next.updatedAt = Date.now();

  return { ok: true, state: next };
}

// ---------- helpers ----------

function getAllOwnedItemIds(state) {
  const inv = state.inventory || {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  const cons = Array.isArray(inv.consumables) ? inv.consumables : [];
  return [inv.weapon, inv.armor, inv.special, ...items, ...cons].filter(Boolean);
}

function getAllowedSlotsForItem(story, id) {
  const def = story?.items?.[id];
  if (!def || typeof def !== "object") return null; // unknown item => UI may still show, engine will treat as not equipable if strict
  if (!Array.isArray(def.allowedSlots)) return [];
  return def.allowedSlots.filter(s => SLOT_KEYS.has(s));
}

function equipFromItemsPool(state, slot, id, story) {
  const inv = state.inventory;
  if (!inv) return;
  if (!Array.isArray(inv.items)) inv.items = [];

  const idx = inv.items.indexOf(id);
  if (idx === -1) return;

  // Enforce allowedSlots if catalog exists for this item
  const allowed = getAllowedSlotsForItem(story, id);
  if (allowed !== null && !allowed.includes(slot)) {
    return; // not allowed in this slot
  }

  const prev = inv[slot];
  if (prev) inv.items.push(prev);

  inv.items.splice(idx, 1);
  inv[slot] = id;
}

function unequipToItemsPool(state, slot) {
  const inv = state.inventory;
  if (!inv) return;

  const cur = inv[slot];
  if (!cur) return;

  if (!Array.isArray(inv.items)) inv.items = [];
  inv.items.push(cur);
  inv[slot] = null;
}