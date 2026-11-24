// Static check of built pages with a one-line summary (no browser). Light/dark and console errors are not covered: look at one page by eye.
// Usage: node <skill>/harness/verify.mjs <work dir>
// Checks: common CSS/JS wiring, duplicate decision keys, keys ending in `note`, keys not starting with the file name, control names without a dot, default-checked radios, fewer than 2 options, inline defer scripts, /api responses if the server is up
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const workDir = resolve(process.argv[2] ?? process.cwd());
const publicDir = join(workDir, 'public');
const config = JSON.parse(await readFile(join(publicDir, 'pages.json'), 'utf8').catch(() => '{}'));
const discuss = JSON.parse(await readFile(join(workDir, 'discuss.config.json'), 'utf8').catch(() => '{}'));

const problems = [];
const summary = [];
const allKeys = new Set();
for (const page of config.pages ?? []) {
  const file = page.href.replace(/^\//, '');
  const html = await readFile(join(publicDir, file), 'utf8').catch(() => null);
  if (html === null) {
    problems.push(`${file}: file missing (listed only in pages.json)`);
    continue;
  }
  const fail = (text) => problems.push(`${file}: ${text}`);
  if (!html.includes('/common.css') || !/<script[^>]*src="\/common\.js"/.test(html)) fail('common.css or common.js not linked');
  if (/<script\b(?![^>]*\bsrc=)[^>]*\bdefer\b/.test(html)) fail('inline <script defer> is not deferred');

  const decisions = [...html.matchAll(/<section[^>]*class="decision[^"]*"[^>]*data-key="([^"]+)"/g)].map((m) => m[1]);
  for (const key of decisions) {
    if (allKeys.has(key)) fail(`duplicate decision key: ${key}`);
    allKeys.add(key);
    if (key.endsWith('.note')) fail(`decision key ends in note (collides with the memo box name): ${key}`);
    if (!key.startsWith(`${file.replace(/\.html$/, '')}.`)) fail(`decision key does not start with the file name (needed for review state): ${key}`);
  }

  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  const noDot = inputs.filter((tag) => !/name="[^"]*\.[^"]*"/.test(tag));
  if (noDot.length) fail(`${noDot.length} control(s) without a dot in the name (not saved)`);
  const checkedRadios = inputs.filter((tag) => /type="radio"/.test(tag) && /\bchecked\b/.test(tag));
  if (checkedRadios.length) fail(`${checkedRadios.length} default-checked radio(s)`);
  const shortOpts = (html.match(/<d-opt\b/g) ?? []).length;
  const radios = inputs.filter((tag) => /type="radio"/.test(tag)).length;
  if (decisions.length && shortOpts + radios < 2) fail('fewer than 2 options');

  summary.push(`${file} ${decisions.length} decisions (${shortOpts + radios} options)`);
}

// If the server is up, only check responses (answers.json is not touched)
const origin = `http://${discuss.host ?? '127.0.0.1'}:${process.env.PORT ?? discuss.port ?? 5190}`;
let server = 'server down (not checked)';
try {
  const codes = await Promise.all(['/api/answers', '/api/status', ...(config.pages ?? []).map((p) => p.href)].map((path) => fetch(origin + path).then((r) => r.status)));
  server = codes.every((c) => c === 200) ? `server ${origin} OK` : `server responses abnormal (${codes.join(',')})`;
  if (!codes.every((c) => c === 200)) problems.push(server);
} catch {
  // the server may not be running
}

console.log(`${problems.length ? 'FAIL' : 'OK'} · ${summary.join(' · ')} · ${server}`);
for (const text of problems) console.log(`- ${text}`);
process.exit(problems.length ? 1 : 0);
