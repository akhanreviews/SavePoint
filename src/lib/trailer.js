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

export function createTrailerPane(game, trailers, { onAudioStateChange } = {}) {
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
  let youtubeIframe = null;
  let hls = null;

  const emitNativeAudioState = () => {
    if (!video) return;
    onAudioStateChange?.({
      audible: !video.paused && !video.muted && video.volume > 0,
      control: {
        mute() {
          if (video) video.muted = true;
        },
      },
    });
  };

  function mountVideo(attach) {
    video = document.createElement('video');
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (source.poster) video.poster = source.poster;
    ['volumechange', 'play', 'pause', 'ended'].forEach((type) => {
      video.addEventListener(type, emitNativeAudioState);
    });
    attach(video);
    wrap.appendChild(video);
  }

  function unmountVideo() {
    if (!video) return;
    onAudioStateChange?.({ audible: false });
    hls?.destroy();
    hls = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    video = null;
    mounted = false;
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
            if (!video || video !== v || !Hls.isSupported()) return;
            hls = new Hls({ maxBufferLength: 20 });
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
        youtubeIframe = iframe;
        iframe.src = `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&enablejsapi=1`;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.title = `${game.title} trailer`;
        wrap.appendChild(iframe);
        facade.style.display = 'none';
        onAudioStateChange?.({
          audible: true,
          control: {
            mute() {
              youtubeIframe?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'mute', args: [] }),
                '*'
              );
            },
          },
        });
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
      if (source?.kind === 'local' || source?.kind === 'steam') {
        unmountVideo();
      }
      // Tear the YouTube iframe down so audio stops; the facade returns.
      const iframe = wrap.querySelector('iframe');
      if (iframe) {
        onAudioStateChange?.({ audible: false });
        iframe.remove();
        youtubeIframe = null;
        if (facade) facade.style.display = '';
      }
    },
  };
}
