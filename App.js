/* VerseCraft — Clean Foundation (Canon)
   Goal of this build: restore proper screen hiding/showing + styling + pillbox + debug panel.
   No new features. No saves. No schema locking.
*/
(() => {
  'use strict';

  const VERSION = '0.0.4';
  const CONTENT_ROOT = './content';
  const CATALOG_URL = `${CONTENT_ROOT}/Catalog.json`;

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(window.location.search);

  const DEBUG_ENABLED = qs.get('debug') === '1';

  // Minimal, safe logger (also feeds debug panel when enabled)
  const debug = {
    panel: null,
    body: null,
    enabled: DEBUG_ENABLED,
    lines: [],
    log(...args) {
      const stamp = new Date().toLocaleTimeString();
      const msg = args.map(a => {
        try { return typeof a === 'string' ? a : JSON.stringify(a); }
        catch { return String(a); }
      }).join(' ');
      const line = `[${stamp}] ${msg}`;
      this.lines.push(line);
      if (this.lines.length > 400) this.lines.shift();
      if (this.enabled && this.body) this.body.textContent = this.lines.join('\n');
      // Always mirror to console for devtools
      console.log('[VerseCraft]', ...args);
    },
    clear() {
      this.lines = [];
      if (this.enabled && this.body) this.body.textContent = '';
      console.clear();
    },
    mount() {
      if (!this.enabled) return;

      const host = $('debugPanelHost');
      if (!host) return;

      const panel = document.createElement('div');
      panel.className = 'debug-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Debug panel');

      const head = document.createElement('div');
      head.className = 'debug-head';

      const title = document.createElement('div');
      title.className = 'debug-title';
      title.textContent = `Debug • v${VERSION}`;

      const actions = document.createElement('div');
      actions.className = 'debug-actions';

      const btnClear = document.createElement('button');
      btnClear.type = 'button';
      btnClear.textContent = 'Clear';
      btnClear.addEventListener('click', () => this.clear());

      const btnHide = document.createElement('button');
      btnHide.type = 'button';
      btnHide.textContent = 'Hide';
      btnHide.addEventListener('click', () => panel.style.display = 'none');

      actions.appendChild(btnClear);
      actions.appendChild(btnHide);

      head.appendChild(title);
      head.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'debug-body';

      panel.appendChild(head);
      panel.appendChild(body);

      host.appendChild(panel);

      this.panel = panel;
      this.body = body;
      this.log('Debug enabled via ?debug=1');
    }
  };

  function pulsePillbox() {
    const pill = $('pillbox');
    if (!pill) return;
    pill.classList.remove('pulse');
    // force reflow to restart animation
    void pill.offsetWidth;
    pill.classList.add('pulse');
  }

  // ---------- Screen system ----------
  const screens = {
    menu: 'menuScreen',
    catalog: 'catalogScreen',
    stories: 'storySelectScreen',
    game: 'gameScreen',
    settings: 'settingsScreen',
  };

  let currentScreen = 'menu';

  function showScreen(screenKey) {
    if (!screens[screenKey]) {
      debug.log('showScreen: unknown key', screenKey);
      return;
    }

    // Remove active from all
    Object.values(screens).forEach(id => {
      const el = $(id);
      if (el) el.classList.remove('active');
    });

    // Add active to target
    const target = $(screens[screenKey]);
    if (target) target.classList.add('active');

    currentScreen = screenKey;
    setPillboxMode();

    debug.log('Screen =>', screenKey);
  }

  // ---------- Pillbox ----------
  let pillModeText = 'Screen: Menu';
  let pillContextText = '—';

  function setPillbox(modeText, contextText) {
    const modeEl = $('pillMode');
    const ctxEl = $('pillContext');
    if (modeEl) modeEl.textContent = modeText;
    if (ctxEl) ctxEl.textContent = contextText;

    const changed = (modeText !== pillModeText) || (contextText !== pillContextText);
    pillModeText = modeText;
    pillContextText = contextText;
    if (changed) pulsePillbox();
  }

  function setPillboxMode() {
    if (currentScreen === 'game') {
      // handled by story renderer
      return;
    }
    const pretty = currentScreen.charAt(0).toUpperCase() + currentScreen.slice(1);
    setPillbox(`Screen: ${pretty}`, '—');
  }

  // ---------- Content pipeline ----------
  let catalogData = null;
  let selectedPack = null;
  let selectedStory = null;
  let storyData = null;

  function cacheBusted(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(VERSION)}&t=${Date.now()}`;
  }

  async function fetchJson(url) {
    debug.log('fetch', url);
    const res = await fetch(cacheBusted(url), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  }

  // Best-effort normalization (without enforcing schema yet)
  function normalizeCatalog(raw) {
    const packs = raw?.packs || raw?.Packs || raw?.catalog?.packs || [];
    return { packs: Array.isArray(packs) ? packs : [] };
  }

  function normalizePack(raw) {
    // Accept Pack.json with various shapes
    const title = raw?.title || raw?.Title || raw?.name || raw?.Name || 'Pack';
    let stories = raw?.stories || raw?.Stories || [];
    if (!Array.isArray(stories) && raw?.content?.stories) stories = raw.content.stories;
    return { title, stories: Array.isArray(stories) ? stories : [] };
  }

  function normalizeStory(raw) {
    // Expected: { title, start, sections: { "1": {...} } } or array sections
    const title = raw?.title || raw?.Title || 'Story';
    const start = raw?.start || raw?.Start || raw?.startSection || '1';

    let sections = raw?.sections || raw?.Sections || raw?.nodes || raw?.Nodes || raw?.content?.sections;
    let map = {};

    if (Array.isArray(sections)) {
      for (const s of sections) {
        const id = String(s.id ?? s.key ?? s.section ?? s.Section ?? '');
        if (!id) continue;
        map[id] = s;
      }
    } else if (sections && typeof sections === 'object') {
      map = sections;
    }

    return { title, start: String(start), sections: map };
  }

  function renderCatalogList() {
    const list = $('catalogList');
    if (!list) return;

    list.innerHTML = '';

    const packs = catalogData?.packs ?? [];
    if (!packs.length) {
      list.innerHTML = `<div class="item-card"><div class="item-title">No packs found</div><div class="item-desc">Check ./content/Catalog.json and your file paths.</div></div>`;
      return;
    }

    packs.forEach((p, idx) => {
      const title = p.title || p.Title || p.name || p.Name || `Pack ${idx + 1}`;
      const desc = p.description || p.Description || '';
      const card = document.createElement('div');
      card.className = 'item-card';

      const h = document.createElement('div');
      h.className = 'item-title';
      h.textContent = title;

      const d = document.createElement('div');
      d.className = 'item-desc';
      d.textContent = desc || 'Tap to open this pack.';

      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Open Pack';
      btn.addEventListener('click', () => openPack(p));

      card.appendChild(h);
      card.appendChild(d);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  function computePackJsonUrl(packEntry) {
    // Allow:
    // - packEntry.path: "./content/packs/starter" (folder) -> add "/Pack.json"
    // - packEntry.packJson: "./content/packs/starter/Pack.json"
    // - packEntry.url: direct json url
    const direct = packEntry.packJson || packEntry.PackJson || packEntry.url || packEntry.Url;
    if (direct) return direct;

    const path = packEntry.path || packEntry.Path || packEntry.folder || packEntry.Folder;
    if (!path) throw new Error('Pack entry missing path/packJson/url');
    return path.endsWith('.json') ? path : `${path.replace(/\/$/, '')}/Pack.json`;
  }

  function computeStoryJsonUrl(packEntry, storyEntry) {
    // Prefer explicit url/file
    const direct = storyEntry.url || storyEntry.Url || storyEntry.file || storyEntry.File || storyEntry.path || storyEntry.Path;
    if (direct) {
      // If it's relative (no leading ./ or /), treat as within pack stories folder
      if (/^(https?:)?\/\//.test(direct) || direct.startsWith('/') || direct.startsWith('./')) return direct;
      // else: relative to pack folder
    }

    const packFolder = (packEntry.path || packEntry.Path || '').replace(/\/$/, '');
    const storiesFolder = packEntry.storiesPath || packEntry.StoriesPath || `${packFolder}/stories`;

    if (direct) return `${storiesFolder}/${direct}`;
    // Fallback: id.json
    const id = String(storyEntry.id || storyEntry.Id || 'story');
    return `${storiesFolder}/${id}.json`;
  }

  async function loadCatalog() {
    try {
      catalogData = normalizeCatalog(await fetchJson(CATALOG_URL));
      debug.log('Catalog packs:', catalogData.packs.length);
      renderCatalogList();
      showScreen('catalog');
    } catch (err) {
      debug.log('Catalog load error:', String(err));
      alert(`Failed to load Catalog.json\n\n${err}`);
    }
  }

  async function openPack(packEntry) {
    try {
      selectedPack = packEntry;
      const url = computePackJsonUrl(packEntry);
      const pack = normalizePack(await fetchJson(url));
      selectedPack._resolvedTitle = pack.title;
      selectedPack._stories = pack.stories;

      $('storiesSubtitle').textContent = `Pack: ${pack.title}`;
      renderStoriesList(packEntry, pack.stories, pack.title);
      showScreen('stories');
    } catch (err) {
      debug.log('Pack load error:', String(err));
      alert(`Failed to load Pack.json\n\n${err}`);
    }
  }

  function renderStoriesList(packEntry, stories, packTitle) {
    const list = $('storiesList');
    if (!list) return;
    list.innerHTML = '';

    if (!stories?.length) {
      list.innerHTML = `<div class="item-card"><div class="item-title">No stories found</div><div class="item-desc">Check Pack.json → stories array.</div></div>`;
      return;
    }

    stories.forEach((s, idx) => {
      const title = s.title || s.Title || s.name || s.Name || `Story ${idx + 1}`;
      const desc = s.description || s.Description || '';

      const card = document.createElement('div');
      card.className = 'item-card';

      const h = document.createElement('div');
      h.className = 'item-title';
      h.textContent = title;

      const d = document.createElement('div');
      d.className = 'item-desc';
      d.textContent = desc || `From ${packTitle}`;

      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Start';
      btn.addEventListener('click', () => startStory(packEntry, s));

      card.appendChild(h);
      card.appendChild(d);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  // ---------- Story runtime (minimal) ----------
  function getSection(id) {
    return storyData?.sections?.[String(id)] || null;
  }

  function sectionLabel(id) {
    const n = String(id);
    return `§${n}`;
  }

  function setStoryPillbox(storyTitle, sectionId) {
    setPillbox(`${storyTitle} · ${sectionLabel(sectionId)}`, 'Story Mode');
  }

  function renderSection(sectionId) {
    const s = getSection(sectionId);
    if (!s) {
      debug.log('Missing section', sectionId);
      $('gameText').textContent = `Missing section: ${sectionId}`;
      $('choices').innerHTML = '';
      setStoryPillbox(storyData?.title || 'Story', sectionId);
      return;
    }

    const title = storyData.title || selectedStory?.title || 'Story';
    $('gameTitle').textContent = title;
    $('gameSectionLabel').textContent = sectionLabel(sectionId);

    const text = s.text || s.Text || s.body || s.Body || s.content || '';
    $('gameText').textContent = String(text);

    const choices = s.choices || s.Choices || [];
    const choiceHost = $('choices');
    choiceHost.innerHTML = '';

    if (!Array.isArray(choices) || choices.length === 0) {
      const end = document.createElement('div');
      end.className = 'item-card';
      end.innerHTML = `<div class="item-title">End</div><div class="item-desc">No choices provided for this section.</div>`;
      choiceHost.appendChild(end);
    } else {
      for (const c of choices) {
        const label = c.text || c.Text || c.label || c.Label || 'Continue';
        const to = c.to || c.To || c.goto || c.Goto || c.target || c.Target;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = label;

        btn.addEventListener('click', () => {
          if (!to) return;
          debug.log('Choice =>', to);
          renderSection(String(to));
        });

        choiceHost.appendChild(btn);
      }
    }

    setStoryPillbox(title, sectionId);
  }

  async function startStory(packEntry, storyEntry) {
    try {
      selectedStory = storyEntry;
      const url = computeStoryJsonUrl(packEntry, storyEntry);
      storyData = normalizeStory(await fetchJson(url));
      debug.log('Story loaded:', storyData.title, 'sections:', Object.keys(storyData.sections).length);

      showScreen('game');
      renderSection(storyData.start);
    } catch (err) {
      debug.log('Story load error:', String(err));
      alert(`Failed to load Story JSON\n\n${err}`);
    }
  }

  // ---------- Wiring ----------
  function bindButton(id, handler) {
    const el = $(id);
    if (!el) { debug.log('Missing button', id); return; }
    el.addEventListener('click', handler);
  }

  function init() {
    // Footer version
    const fv = $('footerVersion');
    if (fv) fv.textContent = `v${VERSION}`;

    // Settings debug state
    const ds = $('debugState');
    if (ds) ds.textContent = DEBUG_ENABLED ? 'On' : 'Off';

    debug.mount();
    debug.log('Init', { VERSION, DEBUG_ENABLED });

    // Prevent the “stacked screens” regression even if CSS fails:
    // We still enforce active screen in JS.
    showScreen('menu');

    bindButton('btnLoadCatalog', loadCatalog);
    bindButton('btnReloadCatalog', loadCatalog);
    bindButton('btnBackToMenuFromCatalog', () => showScreen('menu'));
    bindButton('btnBackToCatalog', () => showScreen('catalog'));
    bindButton('btnExitToMenu', () => showScreen('menu'));
    bindButton('btnSettings', () => showScreen('settings'));
    bindButton('btnBackToMenuFromSettings', () => showScreen('menu'));

    // Disabled button should do nothing
    const cont = $('btnContinue');
    if (cont) cont.addEventListener('click', () => debug.log('Continue disabled (no saves yet)'));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
