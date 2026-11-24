// Create the work folder: public/pages.json, public/p1.html (skeleton), discuss.config.json. Existing files are left untouched.
// Usage: node <skill>/harness/init.mjs <work dir> [--port 5190]
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const templates = join(here, '..', 'templates');
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('Usage: node init.mjs <work dir> [--port 5190]');
  process.exit(1);
}
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : undefined;
const workDir = resolve(dir);
const exists = (path) => stat(path).then(() => true, () => false);

await mkdir(join(workDir, 'public'), { recursive: true });
const made = [];
for (const [from, to] of [
  ['pages.json', 'public/pages.json'],
  ['p1.html', 'public/p1.html'],
  ['discuss.config.json', 'discuss.config.json'],
]) {
  const target = join(workDir, to);
  if (await exists(target)) continue;
  await copyFile(join(templates, from), target);
  made.push(to);
}
if (port) {
  const configPath = join(workDir, 'discuss.config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.port = port;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

console.log(`Work dir: ${workDir}`);
console.log(made.length ? `Created: ${made.join(', ')}` : 'Nothing created (all files exist)');
console.log(`Server: node "${join(here, 'server.mjs')}" "${workDir}"`);
console.log(`Answers: node "${join(here, 'print-answers.mjs')}" "${workDir}"`);
