// Storage.js
// Save/load only. No DOM. No fetch.

const KEY_PREFIX = "VerseCraft.SaveSlot.";
const META_PREFIX = "VerseCraft.SaveMeta.";

export function listSaveSlots(maxSlots = 3) {
  const slots = [];
  for (let i = 1; i <= maxSlots; i++) {
    const metaRaw = localStorage.getItem(`${META_PREFIX}${i}`);
    const meta = metaRaw ? safeJsonParse(metaRaw) : null;
    slots.push({ slot: i, meta });
  }
  return slots;
}

export function saveToSlot(slot, gameState) {
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

export function loadFromSlot(slot) {
  const raw = localStorage.getItem(`${KEY_PREFIX}${slot}`);
  if (!raw) return null;
  return safeJsonParse(raw);
}

export function clearSlot(slot) {
  localStorage.removeItem(`${KEY_PREFIX}${slot}`);
  localStorage.removeItem(`${META_PREFIX}${slot}`);
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}