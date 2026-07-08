import { createArtifactFx } from './artifact.js';

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Builds the left rail: one hero node + one logo node per game, a
 * connector track, a gold fill, and the traveling pulse. `update(p)`
 * moves the pulse continuously with scroll so the shine flows through
 * the gap between logos; `setActive(i)` ignites a node's gold ring.
 */
export function createRail(railEl, items, onSelect) {
  const line = document.createElement('div');
  line.className = 'rail-line';
  const fill = document.createElement('div');
  fill.className = 'rail-line-fill';
  line.appendChild(fill);

  const pulse = document.createElement('div');
  pulse.className = 'rail-pulse';

  const nodesWrap = document.createElement('div');
  nodesWrap.className = 'rail-nodes';

  const tips = [];
  const fxs = [];

  const nodes = items.map((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'rail-node' + (item.logo ? '' : ' rail-node--hero');
    btn.type = 'button';
    btn.setAttribute('aria-label', item.hiddenLabel ?? item.label);
    let fx = null;
    if (item.logo) {
      const img = document.createElement('img');
      img.src = item.logo;
      img.alt = '';
      btn.appendChild(img);
      const mystery = document.createElement('span');
      mystery.className = 'mystery';
      mystery.textContent = '?';
      btn.appendChild(mystery);
      btn.classList.add('is-secret');
      fx = createArtifactFx(btn, img);
    } else {
      const d = document.createElement('span');
      d.className = 'diamond';
      btn.appendChild(d);
    }
    const tip = document.createElement('span');
    tip.className = 'rail-tip';
    tip.textContent = item.hiddenLabel ?? item.label;
    btn.appendChild(tip);
    btn.addEventListener('click', () => onSelect(i));
    nodesWrap.appendChild(btn);
    tips.push(tip);
    fxs.push(fx);
    return btn;
  });

  railEl.append(line, pulse, nodesWrap);

  let centers = [];
  let lineTop = 0;

  function measure() {
    centers = nodes.map((n) => n.offsetTop + nodesWrap.offsetTop + n.offsetHeight / 2);
    lineTop = line.offsetTop;
  }
  measure();
  window.addEventListener('resize', measure);

  let revealed = items.map(() => false);
  let booted = false;

  return {
    update(progress) {
      const seg = progress * (items.length - 1);
      const i = Math.min(Math.floor(seg), items.length - 2);
      const t = seg - i;
      const y = lerp(centers[i], centers[i + 1], t);
      pulse.style.top = `${y}px`;
      // Fully visible mid-gap, melts into the node glow at either end.
      pulse.style.opacity = Math.sin(t * Math.PI).toFixed(3);
      fill.style.height = `${Math.max(0, y - lineTop)}px`;
    },
    setActive(index) {
      nodes.forEach((n, i) => {
        n.classList.toggle('is-active', i === index);
        n.classList.toggle('is-past', i < index);

        const fx = fxs[i];
        if (!fx) return;
        const show = i <= index;
        if (show === revealed[i]) return;
        revealed[i] = show;
        if (show) {
          n.classList.remove('is-secret');
          tips[i].textContent = items[i].label;
          n.setAttribute('aria-label', items[i].label);
          fx.reveal({ instant: !booted });
        } else {
          tips[i].textContent = items[i].hiddenLabel ?? items[i].label;
          n.setAttribute('aria-label', items[i].hiddenLabel ?? items[i].label);
          fx.hide({ instant: !booted, onDone: () => n.classList.add('is-secret') });
        }
      });
      booted = true;
    },
    measure,
  };
}
