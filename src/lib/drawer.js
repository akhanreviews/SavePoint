import { createModelPane } from './viewer.js';

let modelViewerLoaded = null;
function ensureModelViewer() {
  // model-viewer (three.js) is heavy; load it only when a drawer first opens.
  if (!modelViewerLoaded) modelViewerLoaded = import('@google/model-viewer');
  return modelViewerLoaded;
}

/**
 * Single shared right-edge overlay drawer for the 3D model panes. Panes are
 * created lazily (first open per game) and cached so re-opening is instant;
 * the page behind never shifts — the drawer sits on top as a fixed panel.
 */
export function createDrawer() {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';

  const panel = document.createElement('div');
  panel.className = 'drawer-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.tabIndex = -1;

  const header = document.createElement('div');
  header.className = 'drawer-header';
  const title = document.createElement('span');
  title.className = 'drawer-title';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'drawer-close';
  closeBtn.setAttribute('aria-label', 'Close 3D model panel');
  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'drawer-body';

  panel.append(header, body);
  overlay.append(panel);
  document.body.appendChild(overlay);

  const panes = new Map();
  let currentTrigger = null;
  let isOpen = false;

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    currentTrigger?.setAttribute('aria-expanded', 'false');
    currentTrigger?.focus();
    currentTrigger = null;
  }

  function openFor(game, triggerBtn) {
    ensureModelViewer();

    panel.style.setProperty('--primary', game.theme.primary);
    panel.style.setProperty('--accent', game.theme.accent);
    panel.style.setProperty('--bg', game.theme.bg);
    panel.style.setProperty('--text', game.theme.text);
    title.textContent = `${game.title} — 3D model`;

    let pane = panes.get(game.slug);
    if (!pane) {
      pane = createModelPane(game);
      panes.set(game.slug, pane);
      body.appendChild(pane.el);
    }
    body.querySelectorAll(':scope > *').forEach((child) => {
      child.style.display = child === pane.el ? '' : 'none';
    });
    pane.activate();

    isOpen = true;
    currentTrigger = triggerBtn;
    triggerBtn?.setAttribute('aria-expanded', 'true');
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    panel.focus();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });

  return { openFor, close };
}
