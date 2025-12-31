/* VerseCraft — Menu Skin Stabilization & iOS Scroll Fix
   Stabilized from visual baseline v0.1.15 (reconstructed build)
   Version: v0.1.20

   Key Intent:
   - Hard lock body/html to prevent iOS rubber-band/white-gap scroll.
   - Allow scroll ONLY in intentional scroll regions (.contentScroll, .debugBody).
   - Menu background is fixed to viewport (no independent scroll).
   - Menu hitboxes anchored to viewport with % coordinates (stable across resize).
   - Debug panel is layout-isolated and always reopenable (floating button).
*/

(() => {
  'use strict';

  const VERSION = 'v0.1.20';
  const SAVE_KEY = 'versecraft_save_v1';
  const UI_KEY = 'versecraft_ui_v1';
  const CATALOG_URL = './content/Catalog.json';

  /** -----------------------------
   *  iOS Scroll / Rubber-band Lock
   *  -----------------------------
   *  We lock the viewport at the body level and prevent default touchmove,
   *  except for approved scroll containers.
   */
  const ALLOW_SCROLL_SELECTORS = [
    '.contentScroll',
    '.debugBody',
  ];

  function isInAllowedScrollArea(target) {
    if (!target) return false;
    for (const sel of ALLOW_SCROLL_SELECTORS) {
      const el = target.closest(sel);
      if (el) return true;
    }
    return false;
  }

  function installTouchGuards() {
    // Prevent the page from scrolling/bouncing on iOS.
    document.addEventListener('touchmove', (e) => {
      if (isInAllowedScrollArea(e.target)) return;
      e.preventDefault();
    }, { passive: false });

    // Prevent double-tap scroll jitter.
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 260) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  function installViewportFixes() {
    // Ensure 100vh matches visible viewport on iOS address bar changes.
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh, { passive: true });
    window.addEventListener('orientationchange', setVh, { passive: true });
  }

  /** -----------------------------
   *  DOM Helpers
   *  ----------------------------- */
  const $ = (sel) => document.querySelector(sel);

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('isHidden', !!hidden);
  }

  function setAriaDisabled(btn, disabled) {
    if (!btn) return;
    btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    btn.classList.toggle('isDisabled', !!disabled);
    if (disabled) btn.setAttribute('tabindex', '-1');
    else btn.removeAttribute('tabindex');
  }

  /** -----------------------------
   *  Screen Manager
   *  ----------------------------- */
  const screens = {
    menu: $('#screen-menu'),
    library: $('#screen-library'),
    game: $('#screen-game'),
    settings: $('#screen-settings'),
  };

  let activeScreen = 'menu';

  function showScreen(name) {
    if (!screens[name]) return;
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('isActive', key === name);
    }
    activeScreen = name;
    updateDebug();
  }

  /** -----------------------------
   *  MenuSkin v1 Hitboxes
   *  -----------------------------
   *  Hitboxes are positioned as percentages of the viewport.
   *  Adjust these numbers to match the background art.
   *
   *  NOTE: This file reconstructs the baseline. If your v0.1.15
   *  hitbox config differs, copy your exact % values here.
   */
  const MENU_HITBOXES = {
    // Values: left/top/width/height in percentage of viewport (0–100).
    load:      { left: 14.0, top: 58.0, width: 72.0, height: 9.5 },
    continue:  { left: 14.0, top: 69.5, width: 72.0, height: 9.5 },
    settings:  { left: 14.0, top: 81.0, width: 72.0, height: 9.5 },
    debug:     { left: 82.0, top: 8.0,  width: 14.0, height: 7.5 }, // small hidden debug area (optional)
  };

  function applyMenuHitboxes() {
    const layer = $('#menuHitboxLayer');
    if (!layer) return;

    const buttons = layer.querySelectorAll('.menuHitbox');
    buttons.forEach((btn) => {
      const key = btn.getAttribute('data-hitbox');
      const hb = MENU_HITBOXES[key];
      if (!hb) return;

      btn.style.left = `${hb.left}vw`;
      btn.style.top = `${hb.top}vh`;
      btn.style.width = `${hb.width}vw`;
      btn.style.height = `${hb.height}vh`;
    });
  }

  /** -----------------------------
   *  Catalog / Pack / Story Loading
   *  ----------------------------- */
  let catalog = null;
  let currentStory = null;
  let currentNodeId = null;

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
    return await res.json();
  }

  async function loadCatalog() {
    $('#libraryStatus').textContent = 'Loading catalog…';
    $('#libraryList').innerHTML = '';
    try {
      catalog = await fetchJson(CATALOG_URL);
      renderLibrary(catalog);
      $('#libraryStatus').textContent = '';
    } catch (err) {
      $('#libraryStatus').textContent = `Catalog load error: ${String(err.message || err)}`;
    }
    updateDebug();
  }

  function renderLibrary(cat) {
    const list = $('#libraryList');
    if (!list) return;

    const packs = Array.isArray(cat?.packs) ? cat.packs : [];
    if (!packs.length) {
      $('#libraryStatus').textContent = 'No packs found in Catalog.json.';
      return;
    }

    for (const pack of packs) {
      const card = document.createElement('div');
      card.className = 'card';

      const title = document.createElement('div');
      title.className = 'cardTitle';
      title.textContent = pack.title || pack.id || 'Pack';
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'cardMeta';
      meta.textContent = pack.path || '';
      card.appendChild(meta);

      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Open Pack';
      btn.addEventListener('click', async () => {
        await openPack(pack);
      });
      card.appendChild(document.createElement('div')).style.height = '10px';
      card.appendChild(btn);

      list.appendChild(card);
    }
  }

  async function openPack(pack) {
    $('#libraryStatus').textContent = 'Loading pack…';
    $('#libraryList').innerHTML = '';
    try {
      const packUrl = pack.path;
      const packJson = await fetchJson(packUrl);
      renderPackStories(pack, packJson);
      $('#libraryStatus').textContent = '';
    } catch (err) {
      $('#libraryStatus').textContent = `Pack load error: ${String(err.message || err)}`;
    }
    updateDebug();
  }

  function renderPackStories(packRef, packJson) {
    const list = $('#libraryList');
    if (!list) return;

    const stories = Array.isArray(packJson?.stories) ? packJson.stories : [];
    if (!stories.length) {
      $('#libraryStatus').textContent = 'No stories found in Pack.json.';
      return;
    }

    const header = document.createElement('div');
    header.className = 'statusText';
    header.textContent = packJson.title ? `Pack: ${packJson.title}` : 'Pack Stories';
    list.appendChild(header);

    for (const story of stories) {
      const card = document.createElement('div');
      card.className = 'card';

      const title = document.createElement('div');
      title.className = 'cardTitle';
      title.textContent = story.title || story.id || 'Story';
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'cardMeta';
      meta.textContent = story.file || '';
      card.appendChild(meta);

      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.type = 'button';
      btn.textContent = 'Start';
      btn.addEventListener('click', async () => {
        await startStoryFromFile(packRef, story, packJson);
      });

      card.appendChild(document.createElement('div')).style.height = '10px';
      card.appendChild(btn);
      list.appendChild(card);
    }
  }

  async function startStoryFromFile(packRef, storyRef, packJson) {
    try {
      const basePath = packRef?.path ? packRef.path.replace(/\/Pack\.json$/i, '') : '';
      const storyUrl = `${basePath}/${storyRef.file}`.replace(/\/\/+/g, '/');
      const storyJson = await fetchJson(storyUrl);
      startStory(storyJson, { storyUrl, packTitle: packJson?.title || packRef?.title || '', storyTitle: storyJson?.title || storyRef?.title || '' });
    } catch (err) {
      alert(`Story load error: ${String(err.message || err)}`);
    }
  }

  function startStory(storyJson, meta) {
    currentStory = { json: storyJson, meta };
    currentNodeId = storyJson.start || storyJson.startId || storyJson.startNode || 'start';
    $('#gameTitle').textContent = meta?.storyTitle || storyJson.title || 'Story';
    $('#footerStoryMeta').textContent = meta?.packTitle ? `${meta.packTitle}` : '—';
    renderNode();
    showScreen('game');
    // clear scroll position
    const sc = $('#gameScroll');
    if (sc) sc.scrollTop = 0;
    updateContinueState();
    updateDebug();
  }

  function getNode(nodeId) {
    const s = currentStory?.json;
    if (!s) return null;
    // Support two common shapes:
    // 1) { sections: { id: { text, choices } } }
    // 2) { nodes: { id: { text, choices } } }
    return (s.sections && s.sections[nodeId]) || (s.nodes && s.nodes[nodeId]) || null;
  }

  function normalizeChoices(node) {
    const raw = Array.isArray(node?.choices) ? node.choices : [];
    return raw.map((c) => ({
      text: c.text || c.label || 'Continue',
      to: c.to || c.target || c.goto || c.next || null,
      requires: c.requires || null,
    }));
  }

  function renderNode() {
    if (!currentStory || !currentNodeId) return;

    const node = getNode(currentNodeId);
    if (!node) {
      $('#storyBody').textContent = `Missing node: ${currentNodeId}`;
      $('#choiceList').innerHTML = '';
      return;
    }

    const text = node.text || node.body || '';
    $('#storyBody').textContent = text;

    const choices = normalizeChoices(node);
    const list = $('#choiceList');
    list.innerHTML = '';

    if (!choices.length) {
      const end = document.createElement('div');
      end.className = 'statusText';
      end.textContent = '— End —';
      list.appendChild(end);
      return;
    }

    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'btn primary choiceBtn';
      btn.type = 'button';
      btn.textContent = choice.text;

      btn.addEventListener('click', () => {
        if (!choice.to) return;
        currentNodeId = choice.to;
        renderNode();
        // keep choices visible without jumping the whole viewport
        const sc = $('#gameScroll');
        if (sc) sc.scrollTop = 0;
        updateDebug();
      });

      list.appendChild(btn);
    }
  }

  /** -----------------------------
   *  Save / Continue
   *  ----------------------------- */
  function getSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setSave(saveObj) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveObj));
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function canContinue() {
    const s = getSave();
    return !!(s && s.storyUrl && s.nodeId);
  }

  function updateContinueState() {
    const enabled = canContinue();
    setAriaDisabled($('#btnMenuContinue'), !enabled);
    setAriaDisabled($('#fallbackContinue'), !enabled);
  }

  function quickSave() {
    if (!currentStory || !currentNodeId) {
      $('#saveStatus').textContent = 'Nothing to save.';
      return;
    }
    const payload = {
      v: VERSION,
      savedAt: new Date().toISOString(),
      storyUrl: currentStory.meta?.storyUrl || null,
      storyTitle: currentStory.meta?.storyTitle || currentStory.json?.title || null,
      packTitle: currentStory.meta?.packTitle || null,
      nodeId: currentNodeId,
    };
    setSave(payload);
    $('#saveStatus').textContent = `Saved: ${payload.storyTitle || 'Story'} @ ${payload.nodeId}`;
    updateContinueState();
    updateDebug();
  }

  async function quickLoad() {
    const s = getSave();
    if (!s) {
      $('#saveStatus').textContent = 'No save found.';
      return;
    }
    try {
      const storyJson = await fetchJson(s.storyUrl);
      startStory(storyJson, { storyUrl: s.storyUrl, packTitle: s.packTitle || '', storyTitle: s.storyTitle || storyJson?.title || '' });
      currentNodeId = s.nodeId;
      renderNode();
      $('#saveStatus').textContent = `Loaded: ${s.storyTitle || 'Story'} @ ${s.nodeId}`;
      updateContinueState();
      updateDebug();
    } catch (err) {
      $('#saveStatus').textContent = `Load failed: ${String(err.message || err)}`;
    }
  }

  /** -----------------------------
   *  Debug / UI Preferences
   *  ----------------------------- */
  function getUiState() {
    try {
      const raw = localStorage.getItem(UI_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setUiState(patch) {
    const cur = getUiState();
    const next = { ...cur, ...patch };
    localStorage.setItem(UI_KEY, JSON.stringify(next));
    return next;
  }

  function updateDebug() {
    const dbg = $('#debugText');
    if (!dbg) return;

    const save = getSave();
    const ui = getUiState();

    const lines = [
      `VerseCraft ${VERSION}`,
      `ActiveScreen: ${activeScreen}`,
      ``,
      `MenuSkin: v1`,
      `HitboxOutline: ${ui.hitboxOutline ? 'ON' : 'OFF'}`,
      `FallbackButtons: ${ui.showFallback ? 'ON' : 'OFF'}`,
      ``,
      `CatalogUrl: ${CATALOG_URL}`,
      `CatalogLoaded: ${catalog ? 'YES' : 'NO'}`,
      ``,
      `CurrentStory: ${currentStory?.meta?.storyTitle || currentStory?.json?.title || '—'}`,
      `CurrentNode: ${currentNodeId || '—'}`,
      ``,
      `SavePresent: ${save ? 'YES' : 'NO'}`,
      save ? `SavedStory: ${save.storyTitle || '—'}` : '',
      save ? `SavedNode: ${save.nodeId || '—'}` : '',
      save ? `SavedAt: ${save.savedAt || '—'}` : '',
    ].filter(Boolean);

    dbg.textContent = lines.join('\n');
  }

  function applyUiPrefs() {
    const ui = getUiState();
    const layer = $('#menuHitboxLayer');
    const fallback = $('#menuFallback');

    if (layer) layer.classList.toggle('isOutlined', !!ui.hitboxOutline);
    if (fallback) fallback.classList.toggle('isHidden', !ui.showFallback);
  }

  /** -----------------------------
   *  Modal helpers
   *  ----------------------------- */
  function openSaveModal() {
    setHidden($('#modalShade'), false);
    setHidden($('#saveModal'), false);
    $('#saveStatus').textContent = canContinue() ? 'Save found. You can Quick Load.' : 'No save yet. Quick Save once you start a story.';
    updateDebug();
  }

  function closeSaveModal() {
    setHidden($('#modalShade'), true);
    setHidden($('#saveModal'), true);
  }

  /** -----------------------------
   *  Debug Panel toggle (always reopenable)
   *  ----------------------------- */
  function openDebugPanel() {
    setHidden($('#debugPanel'), false);
    updateDebug();
  }
  function closeDebugPanel() {
    setHidden($('#debugPanel'), true);
  }

  /** -----------------------------
   *  Wiring
   *  ----------------------------- */
  function wireMenu() {
    // Hitbox buttons
    $('#btnMenuLoad').addEventListener('click', () => { showScreen('library'); loadCatalog(); });
    $('#btnMenuContinue').addEventListener('click', async () => { openSaveModal(); });
    $('#btnMenuSettings').addEventListener('click', () => { showScreen('settings'); });
    $('#btnMenuDebug').addEventListener('click', () => { openDebugPanel(); });

    // Fallback buttons
    $('#fallbackLoad').addEventListener('click', () => { showScreen('library'); loadCatalog(); });
    $('#fallbackContinue').addEventListener('click', () => { openSaveModal(); });
    $('#fallbackSettings').addEventListener('click', () => { showScreen('settings'); });
    $('#fallbackDebug').addEventListener('click', () => { openDebugPanel(); });
  }

  function wireLibrary() {
    $('#btnBackFromLibrary').addEventListener('click', () => { showScreen('menu'); });
  }

  function wireGame() {
    $('#btnToMenu').addEventListener('click', () => { showScreen('menu'); });
    $('#btnOpenSave').addEventListener('click', () => { openSaveModal(); });
  }

  function wireSettings() {
    $('#btnBackFromSettings').addEventListener('click', () => { showScreen('menu'); });

    $('#btnToggleHitboxOutline').addEventListener('click', () => {
      const ui = getUiState();
      setUiState({ hitboxOutline: !ui.hitboxOutline });
      applyUiPrefs();
      updateDebug();
    });

    $('#btnToggleFallback').addEventListener('click', () => {
      const ui = getUiState();
      setUiState({ showFallback: !ui.showFallback });
      applyUiPrefs();
      updateDebug();
    });

    $('#btnClearSave').addEventListener('click', () => {
      clearSave();
      updateContinueState();
      alert('Save cleared.');
      updateDebug();
    });
  }

  function wireModal() {
    $('#btnCloseSave').addEventListener('click', closeSaveModal);
    $('#modalShade').addEventListener('click', closeSaveModal);
    $('#btnQuickSave').addEventListener('click', quickSave);
    $('#btnQuickLoad').addEventListener('click', quickLoad);
  }

  function wireDebug() {
    $('#debugFab').addEventListener('click', () => {
      const panel = $('#debugPanel');
      if (panel.classList.contains('isHidden')) openDebugPanel();
      else closeDebugPanel();
    });
    $('#btnCloseDebug').addEventListener('click', closeDebugPanel);
  }

  /** -----------------------------
   *  Init
   *  ----------------------------- */
  function init() {
    installViewportFixes();
    installTouchGuards();

    applyMenuHitboxes();
    applyUiPrefs();

    wireMenu();
    wireLibrary();
    wireGame();
    wireSettings();
    wireModal();
    wireDebug();

    updateContinueState();
    updateDebug();

    // Reapply hitboxes on resize/orientation (keeps alignment stable)
    window.addEventListener('resize', applyMenuHitboxes, { passive: true });
    window.addEventListener('orientationchange', applyMenuHitboxes, { passive: true });

    // Start on menu
    showScreen('menu');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
