const el = {
  screens: {}
};

function setScreen(name) {
  Object.values(el.screens).forEach(s => s.classList.remove('active'));
  el.screens[name].classList.add('active');
}

function initScreens() {
  el.screens.menu = document.getElementById('screen-menu');
  el.screens.library = document.getElementById('screen-library');
}

function renderLibrary() {
  const root = document.querySelector('.library-root');
  root.innerHTML = '';

  const stories = [
    { title: 'World of Lorecraft', preview: 'content/packs/founders/covers/world_of_lorecraft.webp' },
    { title: 'Crimson Seagull', preview: 'content/packs/founders/covers/crimson_seagull.webp' },
    { title: 'Oregon Trail', preview: 'content/packs/founders/covers/oregon_trail.webp' }
  ];

  stories.forEach(s => {
    const row = document.createElement('div');
    row.className = 'library-row';

    const preview = document.createElement('div');
    preview.className = 'library-preview';
    const img = document.createElement('img');
    img.src = s.preview;
    preview.appendChild(img);

    const frame = document.createElement('div');
    frame.className = 'library-frame';

    const title = document.createElement('div');
    title.className = 'library-title';
    title.textContent = s.title;

    row.appendChild(preview);
    row.appendChild(frame);
    row.appendChild(title);

    root.appendChild(row);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initScreens();
  renderLibrary();
  setScreen('library');
});
