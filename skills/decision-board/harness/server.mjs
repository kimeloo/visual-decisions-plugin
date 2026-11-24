// decision-board harness server: static files + answer saving (answers.json). No dependencies (Node 18+).
// Usage: node <skill>/harness/server.mjs <work dir>
// Work dir: public/ (pages), discuss.config.json (optional config), answers.json (created by the server), reviews.json (created by mark-reviewed.mjs)
// POST /api/answers?defaults=a,b : keys a and b are written only if absent (checklist defaults); other keys always overwrite
// GET /api/status: per-page answered count and review state (common.js uses it for the nav bar and review banner)
// Config: { "port": 5190, "host": "127.0.0.1", "mounts": { "/shots/": "../screenshots", "/vendor/echarts.js": "/abs/echarts.min.js" } }
//   mounts paths are relative to the work dir or absolute. A prefix ending in '/' is a folder, otherwise a single file.
// Files missing from the work dir's public/ (common.css, common.js, index.html) are served from this harness's public/.
import { createServer } from 'node:http';
import { readFile, writeFile, stat, rename } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageStates } from './status.mjs';

const harnessPublic = join(dirname(fileURLToPath(import.meta.url)), 'public');
const workDir = resolve(process.argv[2] ?? process.cwd());
const config = await readFile(join(workDir, 'discuss.config.json'), 'utf8')
  .then((text) => JSON.parse(text))
  .catch(() => ({}));
const port = Number(process.env.PORT ?? config.port ?? 5190);
const host = config.host ?? '127.0.0.1';
const answersFile = join(workDir, 'answers.json');

const mounts = Object.entries(config.mounts ?? {}).map(([prefix, path]) => [prefix, [isAbsolute(path) ? path : join(workDir, path)]]);
mounts.push(['/', [join(workDir, 'public'), harnessPublic]]);
// longest prefix first
mounts.sort((a, b) => b[0].length - a[0].length);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

async function readAnswers() {
  try {
    return JSON.parse(await readFile(answersFile, 'utf8'));
  } catch {
    return {};
  }
}

// overlapping saves are merged one after another
let queue = Promise.resolve();
// keys in `onlyIfAbsent` (unsaved checklist defaults) are written only when the server has no value yet
function saveAnswers(patch, onlyIfAbsent = new Set()) {
  const job = queue.then(async () => {
    const existing = await readAnswers();
    const applied = Object.fromEntries(Object.entries(patch).filter(([key]) => !(onlyIfAbsent.has(key) && key in existing)));
    const merged = { ...existing, ...applied, _savedAt: new Date().toISOString() };
    const tmp = `${answersFile}.tmp`;
    await writeFile(tmp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    await rename(tmp, answersFile);
    return merged;
  });
  queue = job.catch(() => {});
  return job;
}

/** File candidates for a URL (earlier wins). Paths escaping the folder are dropped */
function candidates(urlPath) {
  for (const [prefix, bases] of mounts) {
    const isDir = prefix.endsWith('/');
    if (isDir ? !urlPath.startsWith(prefix) : urlPath !== prefix) continue;
    if (!isDir) return bases;
    const rest = decodeURIComponent(urlPath.slice(prefix.length));
    return bases
      .map((base) => {
        const target = normalize(join(base, rest));
        const root = normalize(base.endsWith(sep) ? base : base + sep);
        return target === normalize(base) || target.startsWith(root) ? target : null;
      })
      .filter(Boolean);
  }
  return [];
}

async function findFile(urlPath) {
  for (const candidate of candidates(urlPath)) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
    if (info?.isDirectory()) {
      const index = join(candidate, 'index.html');
      if ((await stat(index).catch(() => null))?.isFile()) return index;
    }
  }
  return null;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname === '/api/answers') {
      if (req.method === 'GET') return send(res, 200, JSON.stringify(await readAnswers()), types['.json']);
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const patch = JSON.parse(body || '{}');
        if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return send(res, 400, 'object expected');
        const defaults = new Set((url.searchParams.get('defaults') ?? '').split(',').filter(Boolean));
        const merged = await saveAnswers(patch, defaults);
        return send(res, 200, JSON.stringify({ ok: true, savedAt: merged._savedAt }), types['.json']);
      }
      return send(res, 405, 'method not allowed');
    }
    if (url.pathname === '/api/status') return send(res, 200, JSON.stringify(await pageStates(workDir)), types['.json']);
    const file = await findFile(url.pathname);
    if (!file) return send(res, 404, 'not found');
    return send(res, 200, await readFile(file), types[extname(file).toLowerCase()] ?? 'application/octet-stream');
  } catch (error) {
    return send(res, 500, String(error));
  }
});

server.listen(port, host, () => {
  console.log(`decision-board ready http://${host}:${port}/  (work dir ${workDir})`);
});
