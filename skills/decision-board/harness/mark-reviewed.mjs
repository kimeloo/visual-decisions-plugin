// Record that the agent reviewed pages. The tab shows "reviewed"; if the page or its answers change afterwards it shows "modified since review".
// Usage: node <skill>/harness/mark-reviewed.mjs <work dir> [p1.html p2.html ...]   (no files = every page in pages.json)
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { markReviewed } from './status.mjs';

const [dir, ...rest] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: node mark-reviewed.mjs <work dir> [p1.html ...]');
  process.exit(1);
}
const workDir = resolve(dir);
let files = rest;
if (!files.length) {
  const config = JSON.parse(await readFile(join(workDir, 'public', 'pages.json'), 'utf8'));
  files = config.pages.map((p) => p.href.replace(/^\//, ''));
}
await markReviewed(workDir, files);
console.log(`Marked reviewed: ${files.join(', ')}`);
