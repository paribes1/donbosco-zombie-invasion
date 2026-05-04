const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const portArg = process.argv.find((arg) => arg.indexOf('--port=') === 0);
const port = Number(process.env.PORT || (portArg ? portArg.split('=')[1] : 8080));

const audioExts = new Set(['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus', '.webm', '.weba', '.mp4', '.aif', '.aiff', '.caf', '.wma', '.mid', '.midi']);
const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.svg']);
const musicGroups = ['menu', 'wave', 'boss'];
const sfxGroups = ['pistol', 'shotgun', 'knife', 'hit', 'death', 'hurt', 'reload', 'boss-roar', 'win', 'pickup'];
const spriteGroups = ['player', 'zombie', 'boss'];

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  '.weba': 'audio/webm',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.caf': 'audio/x-caf',
  '.wma': 'audio/x-ms-wma',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi'
};

function collectFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(full, exts));
    else if (entry.isFile() && exts.has(path.extname(entry.name).toLowerCase())) {
      output.push('../' + path.relative(root, full).replace(/\\/g, '/'));
    }
  }
  return output.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function createManifest() {
  const assets = path.join(root, 'assets');
  const manifest = { music: {}, sfx: {}, sprites: {} };
  for (const group of musicGroups) {
    manifest.music[group] = collectFiles(path.join(assets, 'music', group), audioExts);
  }
  for (const group of sfxGroups) {
    manifest.sfx[group] = collectFiles(path.join(assets, 'sfx', group), audioExts);
  }
  for (const group of spriteGroups) {
    manifest.sprites[group] = collectFiles(path.join(assets, 'sprites', group), imageExts);
  }
  return manifest;
}

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/don_bosco_zombie_invasion2.html';

  if (pathname === '/assets/manifest.json') {
    send(res, 200, JSON.stringify(createManifest(), null, 2), types['.json']);
    return;
  }
  if (pathname === '/assets/manifest.js') {
    send(res, 200, 'window.DBZ_ASSET_MANIFEST = ' + JSON.stringify(createManifest(), null, 2) + ';', types['.js']);
    return;
  }

  const file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(serveStatic).listen(port, () => {
  console.log(`Don Bosco Zombie Invasion running at http://localhost:${port}/`);
});
