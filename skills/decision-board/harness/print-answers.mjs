// Print saved answers in page order: chosen value (option label) per decision, checklists, memos, unanswered decisions.
// Each page header also shows its review state (see mark-reviewed.mjs): which answer keys changed since you reviewed it.
// Usage: node <skill>/harness/print-answers.mjs <work dir> [--json] [--changed]   (--changed = only pages that are not reviewed or changed since review)
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pageStates } from './status.mjs';

const args = process.argv.slice(2);
const workDir = resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const asJson = args.includes('--json');
const onlyChanged = args.includes('--changed');
const reviews = new Map((await pageStates(workDir)).pages.map((p) => [p.file, p.review]));
const when = (iso) => new Date(iso).toLocaleString('sv-SE').slice(0, 16);
function reviewText(review) {
  if (!review) return '';
  const since = review.at ? when(review.at) : '';
  if (review.state === 'none') return 'not reviewed';
  if (review.state === 'ok') return `reviewed ${since}`;
  const parts = [];
  if (review.state !== 'answers') parts.push('page edited');
  if (review.state !== 'page') parts.push(`answers changed${review.changed?.length ? `: ${review.changed.join(', ')}` : ''}`);
  return `since review ${since} - ${parts.join('; ')}`;
}
const publicDir = join(workDir, 'public');
const answers = JSON.parse(await readFile(join(workDir, 'answers.json'), 'utf8').catch(() => '{}'));
const config = JSON.parse(await readFile(join(publicDir, 'pages.json'), 'utf8').catch(() => '{}'));

const pageFiles = (config.pages ?? []).map((p) => p.href.replace(/^\//, ''));
for (const file of await readdir(publicDir).catch(() => [])) {
  if (file.endsWith('.html') && file !== 'index.html' && !pageFiles.includes(file)) pageFiles.push(file);
}

const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** <d-opt> short tag: title of the option whose v matches, searched from where the name (decision key / sub-question data-name) starts to the next name */
function shortTagLabel(html, name, value) {
  const start = html.search(new RegExp(`data-(?:key|name)="${escapeRe(name)}"`));
  if (start < 0) return '';
  const rest = html.slice(start + 1);
  const next = rest.search(/data-(?:key|name)="/);
  const scope = next < 0 ? rest : rest.slice(0, next);
  for (const m of scope.matchAll(/<d-opt\b([^>]*)>/g)) {
    if (m[1].match(/\bv="([^"]*)"/)?.[1] === value) return strip(m[1].match(/\btitle="([^"]*)"/)?.[1] ?? '').slice(0, 80);
  }
  return '';
}

/** Find the text right after the control (option name), excluding recommend/tag chips and descriptions */
function labelOf(html, name, value) {
  const re = new RegExp(`<input[^>]*name="${escapeRe(name)}"[^>]*value="${escapeRe(value)}"[^>]*>([\\s\\S]*?)(?:<span class="(?:rec|tag)|</span>|</label>)`);
  const alt = new RegExp(`<input[^>]*value="${escapeRe(value)}"[^>]*name="${escapeRe(name)}"[^>]*>([\\s\\S]*?)(?:<span class="(?:rec|tag)|</span>|</label>)`);
  const m = html.match(re) ?? html.match(alt);
  return m ? strip(m[1]).slice(0, 80) : shortTagLabel(html, name, value);
}

const report = [];
const seen = new Set();
for (const file of pageFiles) {
  const html = await readFile(join(publicDir, file), 'utf8').catch(() => null);
  if (html === null) continue;
  const title = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? file);
  const names = [...new Set([...html.matchAll(/name="([^"]+\.[^"]+)"/g)].map((m) => m[1]))];
  const keys = [...html.matchAll(/<section[^>]*class="decision[^"]*"[^>]*data-key="([^"]+)"([^>]*)>/g)].map((m) => ({
    key: m[1],
    memoOnly: /data-memo="only"/.test(m[2]),
  }));
  const rows = [];
  // Memo boxes (<key>.note) are added by the harness so they are not in the HTML; derive them from decision keys. <d-opt> radio names are not in the HTML either; fill them from decision keys.
  for (const { key, memoOnly } of keys) {
    if (!memoOnly && !names.includes(key)) names.push(key);
    if (!names.includes(`${key}.note`)) names.push(`${key}.note`);
  }
  for (const name of names) {
    seen.add(name);
    const value = answers[name];
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) rows.push({ name, value });
    else rows.push({ name, value, label: name.endsWith('.note') ? undefined : labelOf(html, name, value) });
  }
  const missing = keys.filter((k) => !k.memoOnly && (answers[k.key] === undefined || answers[k.key] === '')).map((k) => k.key);
  report.push({ file, title, rows, missing, review: reviews.get(file) });
}
const shown = onlyChanged ? report.filter((p) => p.review && p.review.state !== 'ok') : report;
const orphans = Object.keys(answers).filter((k) => !k.startsWith('_') && !seen.has(k) && answers[k] !== '');

if (asJson) {
  console.log(JSON.stringify({ savedAt: answers._savedAt, pages: shown, orphans: Object.fromEntries(orphans.map((k) => [k, answers[k]])) }, null, 2));
} else {
  console.log(`Last saved: ${answers._savedAt ?? '-'}`);
  for (const page of shown) {
    console.log(`\n## ${page.title} (${page.file})${page.review ? ` [${reviewText(page.review)}]` : ''}`);
    for (const row of page.rows) {
      if (row.name.endsWith('.note')) console.log(`- ${row.name}: ${row.value.replace(/\n/g, '\n    ')}`);
      else if (Array.isArray(row.value)) console.log(`- ${row.name} [${row.value.length}]: ${row.value.join(', ') || '(none)'}`);
      else console.log(`- ${row.name} = ${row.value}${row.label ? `  (${row.label})` : ''}`);
    }
    if (page.missing.length) console.log(`- unanswered: ${page.missing.join(', ')}`);
  }
  if (orphans.length) {
    console.log('\n## Keys not on any page (answers of removed decisions)');
    for (const k of orphans) console.log(`- ${k} = ${JSON.stringify(answers[k])}`);
  }
}
