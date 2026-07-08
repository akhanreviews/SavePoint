/**
 * Right-hand 3D pane: a <model-viewer> that auto-rotates and accepts
 * mouse/touch orbiting. The GLB is only requested when the slide first
 * becomes active; if no file exists at the configured path yet, a
 * "drop your model here" state shows instead — so the user can add
 * models later without touching any code.
 */
export function createModelPane(game) {
  const col = document.createElement('div');
  col.className = 'model-col reveal';

  const empty = document.createElement('div');
  empty.className = 'model-empty';
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = game.character.name;
  const how = document.createElement('span');
  how.className = 'how';
  how.textContent = `drop ${game.slug}.glb into public/assets/models/`;
  empty.append(who, how);

  const viewer = document.createElement('model-viewer');
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('auto-rotate', '');
  viewer.setAttribute('rotation-per-second', '28deg');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('shadow-intensity', '0.9');
  viewer.setAttribute('exposure', '1.05');
  viewer.setAttribute('alt', `3D model of ${game.character.name}`);
  viewer.style.display = 'none';

  const caption = document.createElement('span');
  caption.className = 'model-caption';
  caption.textContent = `${game.character.name} — drag to rotate`;

  col.append(empty, viewer, caption);

  viewer.addEventListener('error', () => {
    viewer.style.display = 'none';
    empty.style.display = '';
  });

  let requested = false;
  let loaded = false;

  return {
    el: col,
    async activate() {
      viewer.setAttribute('auto-rotate', '');
      if (loaded) {
        viewer.style.display = '';
        empty.style.display = 'none';
        return;
      }
      if (requested) return;
      requested = true;
      try {
        const res = await fetch(game.model, { method: 'HEAD' });
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && !type.includes('text/html')) {
          viewer.src = game.model;
          loaded = true;
          viewer.style.display = '';
          empty.style.display = 'none';
        }
      } catch {
        /* keep the empty state */
      }
    },
    deactivate() {
      viewer.removeAttribute('auto-rotate');
      if (loaded) {
        viewer.removeAttribute('src');
        loaded = false;
      }
      requested = false;
      viewer.style.display = 'none';
      empty.style.display = '';
    },
  };
}
