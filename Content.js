// Content.js
// Fetch + load story index and story files. No DOM.

export async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  return await res.json();
}

export async function loadStoryIndex() {
  // Root-deploy safe: relative path
  return await fetchJson("./content/Stories.json");
}

export async function loadStoryFile(path) {
  // Path comes from index (relative)
  return await fetchJson(path);
}