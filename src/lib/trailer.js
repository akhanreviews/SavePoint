/**
 * Trailer source resolution, in priority order:
 *   1. trailer.local      → native <video>
 *   2. trailer.steamAppId → Steam HLS stream via hls.js (the default)
 *   3. trailer.youtubeId  → click-to-play YouTube facade
 */
function resolveSource(game, trailers) {
  const t = game.trailer ?? {};
  if (t.local) return { kind: 'local', src: t.local };
  const steam = t.steamAppId ? trailers[t.steamAppId] : null;
  if (steam?.hls) return { kind: 'steam', ...steam };
  if (t.youtubeId) return { kind: 'youtube', id: t.youtubeId };
  return null;
}

const SOURCE_LABEL = {
  steam: 'Steam trailer',
  youtube: 'YouTube trailer',
  local: 'Local video',
};

export function createTrailerPane(game, trailers) {
  const wrap = document.createElement('div');
  wrap.className = 'trailer reveal';

  const source = resolveSource(game, trailers);
  const label = document.createElement('span');
  label.className = 'trailer-source';
  const rec = document.createElement('i');
  rec.className = 'trailer-rec';
  label.append(rec, document.createTextNode(source ? SOURCE_LABEL[source.kind] : 'No trailer configured'));
  wrap.appendChild(label);

  ['tl', 'tr', 'bl', 'br'].forEach((corner) => {
    const c = document.createElement('i');
    c.className = `tf-corner tf-${corner}`;
    wrap.appendChild(c);
  });

  let mounted = false;
  let video = null;
  let facade = null;

  function mountVideo(attach) {
    video = document.createElement('video');
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (source.poster) video.poster = source.poster;
    attach(video);
    wrap.appendChild(video);
  }

  function mount() {
    if (source.kind === 'local') {
      mountVideo((v) => (v.src = source.src));
    } else if (source.kind === 'steam') {
      mountVideo((v) => {
        if (v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = source.hls; // Safari plays HLS natively
        } else {
          // hls.js is heavy; load it only when a Steam trailer first plays
          import('hls.js').then(({ default: Hls }) => {
            if (!Hls.isSupported()) return;
            const hls = new Hls({ maxBufferLength: 20 });
            hls.loadSource(source.hls);
            hls.attachMedia(v);
            v.play().catch(() => {});
          });
        }
      });
    } else if (source.kind === 'youtube') {
      facade = document.createElement('button');
      facade.type = 'button';
      facade.className = 'yt-facade';
      facade.setAttribute('aria-label', `Play ${game.title} trailer`);
      facade.style.backgroundImage = `url(https://i.ytimg.com/vi/${source.id}/hqdefault.jpg)`;
      const glyph = document.createElement('span');
      glyph.className = 'play-glyph';
      facade.appendChild(glyph);
      facade.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0`;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.title = `${game.title} trailer`;
        wrap.appendChild(iframe);
        facade.style.display = 'none';
      });
      wrap.appendChild(facade);
    }
  }

  return {
    el: wrap,
    activate() {
      if (!source) return;
      if (!mounted) {
        mount();
        mounted = true;
      }
      video?.play().catch(() => {});
    },
    deactivate() {
      video?.pause();
      // Tear the YouTube iframe down so audio stops; the facade returns.
      const iframe = wrap.querySelector('iframe');
      if (iframe) {
        iframe.remove();
        if (facade) facade.style.display = '';
      }
    },
  };
}
