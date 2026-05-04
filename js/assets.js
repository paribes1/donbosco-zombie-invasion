(function () {
  'use strict';

  const ASSET_BASE = '../assets/';
  const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm', 'weba', 'mp4', 'aif', 'aiff', 'caf', 'wma', 'mid', 'midi'];
  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'];
  const KNOWN = {
    music: ['menu', 'wave', 'boss'],
    sfx: ['pistol', 'shotgun', 'knife', 'hit', 'death', 'hurt', 'reload', 'boss-roar', 'win', 'pickup'],
    sprites: ['player', 'zombie', 'boss']
  };

  const state = {
    ready: false,
    callbacks: [],
    manifest: emptyManifest(),
    spriteImages: {},
    music: null,
    musicScene: null,
    desiredMusicScene: null,
    musicVolume: 0.44,
    sfxVolume: 0.72
  };

  function emptyManifest() {
    return {
      music: { menu: [], wave: [], boss: [] },
      sfx: {
        pistol: [], shotgun: [], knife: [], hit: [], death: [],
        hurt: [], reload: [], 'boss-roar': [], win: [], pickup: []
      },
      sprites: { player: [], zombie: [], boss: [] }
    };
  }

  function extensionOf(url) {
    const clean = String(url || '').split('#')[0].split('?')[0];
    const dot = clean.lastIndexOf('.');
    return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
  }

  function hasPlayableExt(url, kind) {
    const ext = extensionOf(url);
    return (kind === 'audio' ? AUDIO_EXTS : IMAGE_EXTS).indexOf(ext) >= 0;
  }

  function naturalSort(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  function normalizeUrl(raw, category, group) {
    if (!raw || typeof raw !== 'string') return null;
    const value = raw.replace(/\\/g, '/').trim();
    if (/^(data:|blob:|https?:|file:)/i.test(value)) return value;
    if (value.indexOf('../') === 0 || value.indexOf('./') === 0) return value;
    if (value.indexOf('/assets/') === 0) return '..' + value;
    if (value.indexOf('assets/') === 0) return '../' + value;
    return ASSET_BASE + category + '/' + group + '/' + value.replace(/^\/+/, '');
  }

  function ensureGroup(target, category, group) {
    if (!target[category]) target[category] = {};
    if (!target[category][group]) target[category][group] = [];
  }

  function addFiles(target, category, group, files, kind) {
    ensureGroup(target, category, group);
    const list = Array.isArray(files) ? files : [];
    for (let i = 0; i < list.length; i++) {
      const url = normalizeUrl(list[i], category, group);
      if (url && hasPlayableExt(url, kind) && target[category][group].indexOf(url) < 0) {
        target[category][group].push(url);
      }
    }
    target[category][group].sort(naturalSort);
  }

  function mergeManifest(base, raw) {
    const next = base || emptyManifest();
    raw = raw || {};

    for (let c = 0; c < Object.keys(KNOWN).length; c++) {
      const category = Object.keys(KNOWN)[c];
      const groups = Object.keys(Object.assign({}, next[category], raw[category]));
      for (let i = 0; i < KNOWN[category].length; i++) ensureGroup(next, category, KNOWN[category][i]);
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const kind = category === 'sprites' ? 'image' : 'audio';
        addFiles(next, category, group, raw[category] && raw[category][group], kind);
      }
    }

    rebuildSpriteImages();
    return next;
  }

  function rebuildSpriteImages() {
    state.spriteImages = {};
    const sprites = state.manifest.sprites || {};
    Object.keys(sprites).forEach(function (character) {
      state.spriteImages[character] = sprites[character].map(function (src) {
        const img = new Image();
        img.src = src;
        return { src: src, img: img };
      });
    });
  }

  function choose(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function getFiles(category, group) {
    const bucket = state.manifest[category] && state.manifest[category][group];
    return Array.isArray(bucket) ? bucket : [];
  }

  function stopMusic() {
    if (!state.music) return;
    state.music.pause();
    state.music.currentTime = 0;
    state.music = null;
    state.musicScene = null;
  }

  function playMusic(scene) {
    scene = scene || 'wave';
    state.desiredMusicScene = scene;
    const files = getFiles('music', scene);
    if (!files.length) return false;
    if (state.music && state.musicScene === scene && !state.music.paused) return true;

    stopMusic();
    const audio = new Audio(choose(files));
    audio.loop = true;
    audio.volume = state.musicVolume;
    audio.preload = 'auto';
    audio.addEventListener('error', function () {
      stopMusic();
    }, { once: true });
    state.music = audio;
    state.musicScene = scene;

    const result = audio.play();
    if (result && result.catch) result.catch(function () {});
    return true;
  }

  function playSfx(type, volume) {
    const files = getFiles('sfx', type);
    if (!files.length) return false;
    const audio = new Audio(choose(files));
    audio.volume = Math.max(0, Math.min(1, volume == null ? state.sfxVolume : volume));
    audio.preload = 'auto';
    const result = audio.play();
    if (result && result.catch) result.catch(function () {});
    return true;
  }

  function readyFrames(character) {
    const frames = state.spriteImages[character] || [];
    return frames.filter(function (frame) {
      return frame.img.complete && frame.img.naturalWidth > 0 && frame.img.naturalHeight > 0;
    });
  }

  function drawHealthBar(ctx, x, y, width, pct) {
    pct = Math.max(0, Math.min(1, pct));
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - width / 2, y, width, 4);
    ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff2222';
    ctx.fillRect(x - width / 2, y, width * pct, 4);
  }

  function drawCharacterSprite(ctx, character, opts) {
    opts = opts || {};
    const frames = readyFrames(character);
    if (!frames.length) return false;

    const height = opts.height || (character === 'boss' ? 86 : character === 'player' ? 44 : 36);
    const frameSource = opts.moving === false ? 0 : Math.floor((opts.frameCount || 0) / (opts.speed || 7));
    const selected = frames[Math.abs(frameSource + (opts.frameOffset || 0)) % frames.length].img;
    const width = height * (selected.naturalWidth / selected.naturalHeight);
    const x = opts.x || 0;
    const y = opts.y || 0;
    const anchorY = opts.anchorY == null ? 0.62 : opts.anchorY;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = opts.shadow || 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(0, height * 0.36, height * 0.34, height * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    if (opts.flipX) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(selected, -width / 2, -height * anchorY, width, height);
    ctx.restore();

    if (opts.label) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(x - 30, y - height * 0.74, 60, 14);
      ctx.fillStyle = '#ff2222';
      ctx.font = '11px VT323,monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.label, x, y - height * 0.74 + 7);
    }
    if (typeof opts.hpPct === 'number' && !opts.hideHealth) {
      drawHealthBar(ctx, x, y - height * 0.68, opts.healthWidth || 28, opts.hpPct);
    }
    return true;
  }

  function parseDirectoryLinks(html, dirUrl, kind) {
    const links = [];
    let doc = null;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return links;
    }
    const base = new URL(dirUrl, document.baseURI);
    doc.querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href');
      if (!href || href === '../' || href.indexOf('?') === 0) return;
      let url;
      try {
        url = new URL(href, base).href;
      } catch (e) {
        return;
      }
      if (hasPlayableExt(url, kind)) links.push(url);
    });
    return links.sort(naturalSort);
  }

  async function scanDirectory(category, group, kind) {
    const dirUrl = ASSET_BASE + category + '/' + group + '/';
    try {
      const res = await fetch(dirUrl, { cache: 'no-store' });
      if (!res.ok) return [];
      return parseDirectoryLinks(await res.text(), dirUrl, kind);
    } catch (e) {
      return [];
    }
  }

  async function scanKnownFolders() {
    const found = emptyManifest();
    const tasks = [];
    KNOWN.music.forEach(function (group) {
      tasks.push(scanDirectory('music', group, 'audio').then(function (files) {
        addFiles(found, 'music', group, files, 'audio');
      }));
    });
    KNOWN.sfx.forEach(function (group) {
      tasks.push(scanDirectory('sfx', group, 'audio').then(function (files) {
        addFiles(found, 'sfx', group, files, 'audio');
      }));
    });
    KNOWN.sprites.forEach(function (group) {
      tasks.push(scanDirectory('sprites', group, 'image').then(function (files) {
        addFiles(found, 'sprites', group, files, 'image');
      }));
    });
    await Promise.all(tasks);
    return found;
  }

  async function loadJsonManifest() {
    try {
      const res = await fetch(ASSET_BASE + 'manifest.json?cache=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function finishReady() {
    state.ready = true;
    window.DBZAssets.ready = true;
    const callbacks = state.callbacks.splice(0);
    callbacks.forEach(function (cb) { cb(); });
    if (state.desiredMusicScene && !state.music) playMusic(state.desiredMusicScene);
  }

  async function init() {
    state.manifest = mergeManifest(emptyManifest(), window.DBZ_ASSET_MANIFEST || {});
    const jsonManifest = await loadJsonManifest();
    if (jsonManifest) state.manifest = mergeManifest(state.manifest, jsonManifest);
    state.manifest = mergeManifest(state.manifest, await scanKnownFolders());
    finishReady();
  }

  window.DBZAssets = {
    ready: false,
    whenReady: function (cb) {
      if (state.ready) cb();
      else state.callbacks.push(cb);
    },
    refresh: init,
    playMusic: playMusic,
    stopMusic: stopMusic,
    playSfx: playSfx,
    drawCharacterSprite: drawCharacterSprite,
    getManifest: function () { return state.manifest; }
  };

  init();
})();
