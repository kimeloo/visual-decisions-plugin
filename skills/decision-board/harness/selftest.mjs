// Smoke test of the harness itself. Run it after editing anything under harness/ or templates/.
// Creates a temp work folder, starts the server on a free port, then checks save -> status -> review -> change detection -> verify -> print-answers. Cleans up.
// Usage: node <skill>/harness/selftest.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const failures = [];
let checks = 0;
const check = (name, ok, detail = '') => {
  checks++;
  if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ''}`);
};

const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const workDir = await mkdtemp(join(tmpdir(), 'decision-board-selftest-'));
const origin = `http://127.0.0.1:${port}`;
const node = (script, ...args) => execFileSync(process.execPath, [join(here, script), workDir, ...args], { env: { ...process.env, PORT: String(port) }, encoding: 'utf8' });
const json = (path, init) => fetch(origin + path, init).then((r) => r.json());
const post = (body) => json('/api/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const reviewState = async () => (await json('/api/status')).pages[0].review.state;

let server;
try {
  node('init.mjs', '--port', String(port));
  server = spawn(process.execPath, [join(here, 'server.mjs'), workDir], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${origin}/api/answers`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  check('verify passes on the fresh template', node('verify.mjs').startsWith('OK'));

  let status = (await json('/api/status')).pages[0];
  check('status counts decisions', status.total === 1 && status.answered === 0);
  check('status starts unreviewed', status.review.state === 'none');

  await post({ 'p1.example': 'B', 'p1.example.note': 'memo text' });
  status = (await json('/api/status')).pages[0];
  check('answer is counted', status.answered === 1);

  await fetch(`${origin}/api/answers?defaults=p1.keep,p1.fresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 'p1.keep': ['a'] }) });
  await fetch(`${origin}/api/answers?defaults=p1.keep,p1.fresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ 'p1.keep': ['b'], 'p1.fresh': ['x'] }) });
  const afterDefaults = await json('/api/answers');
  check('defaults= writes absent keys only', JSON.stringify(afterDefaults['p1.keep']) === '["a"]' && JSON.stringify(afterDefaults['p1.fresh']) === '["x"]');
  check('status exposes pageHash', typeof (await json('/api/status')).pages[0].pageHash === 'string');

  const printed = node('print-answers.mjs');
  check('print-answers shows the option title', printed.includes('p1.example = B') && printed.includes('둘째 안'));
  check('print-answers shows the memo', printed.includes('p1.example.note: memo text'));
  check('print-answers shows not reviewed', printed.includes('[not reviewed]'));

  node('mark-reviewed.mjs', 'p1.html');
  check('review recorded', (await reviewState()) === 'ok');
  await post({ 'p1.example.note': 'changed' });
  check('answer change detected', (await reviewState()) === 'answers');
  const changedOut = node('print-answers.mjs', '--changed');
  check('print-answers --changed lists the changed key', changedOut.includes('answers changed: p1.example.note'), changedOut.split('\n').find((l) => l.startsWith('##')));
  node('mark-reviewed.mjs', 'p1.html');
  const pagePath = join(workDir, 'public', 'p1.html');
  await writeFile(pagePath, `${await readFile(pagePath, 'utf8')}\n<!-- edit -->\n`);
  check('page change detected', (await reviewState()) === 'page');

  await writeFile(pagePath, `${await readFile(pagePath, 'utf8')}<input type="radio" name="p1.example" value="Z" checked>\n`);
  let flagged = false;
  try {
    node('verify.mjs');
  } catch {
    flagged = true;
  }
  check('verify flags a default-checked radio', flagged);
} catch (error) {
  failures.push(`crashed: ${error.message}`);
} finally {
  server?.kill();
  await rm(workDir, { recursive: true, force: true });
}

console.log(failures.length ? `FAIL · ${failures.length}/${checks} checks failed` : `OK · ${checks} checks passed`);
for (const text of failures) console.log(`- ${text}`);
process.exit(failures.length ? 1 : 0);
