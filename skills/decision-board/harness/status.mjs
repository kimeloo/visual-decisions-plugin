// Computes per-page progress (answered count) and agent review state. Shared by server.mjs (/api/status) and mark-reviewed.mjs.
// Review records live in <work dir>/reviews.json: { "p1.html": { at, answersHash, pageHash, answers } } (answers = that page's answers at review time, used to list which keys changed)
// Modified since review = pageHash (page file) or answersHash (answers whose keys start with `<file name>.`) differs.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const sha = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);
const readJson = (file, fallback) => readFile(file, 'utf8').then(JSON.parse, () => fallback);
const hasAnswer = (value) => value !== undefined && value !== '';

/** Decision keys of a page. Memo-only decisions are excluded from progress counts by callers */
export function decisionKeys(html) {
  return [...html.matchAll(/<section[^>]*class="decision[^"]*"[^>]*data-key="([^"]+)"([^>]*)>/g)].map((m) => ({
    key: m[1],
    memoOnly: /data-memo="only"/.test(m[2]),
  }));
}

function snapshot(file, html, answers) {
  const prefix = `${file.replace(/\.html$/, '')}.`;
  const mine = Object.keys(answers)
    .filter((key) => key.startsWith(prefix))
    .sort()
    .map((key) => [key, answers[key]]);
  return { pageHash: sha(html), answersHash: sha(JSON.stringify(mine)), answers: Object.fromEntries(mine) };
}

/** state: none (not reviewed) | ok | answers (answers changed since review) | page (page changed since review) | both */
export async function pageStates(workDir) {
  const publicDir = join(workDir, 'public');
  const config = await readJson(join(publicDir, 'pages.json'), {});
  const answers = await readJson(join(workDir, 'answers.json'), {});
  const reviews = await readJson(join(workDir, 'reviews.json'), {});
  const pages = [];
  for (const page of config.pages ?? []) {
    const file = page.href.replace(/^\//, '');
    const html = await readFile(join(publicDir, file), 'utf8').catch(() => null);
    if (html === null) continue;
    const counted = decisionKeys(html).filter((d) => !d.memoOnly);
    const now = snapshot(file, html, answers);
    const review = reviews[file];
    let state = 'none';
    let changed = [];
    if (review) {
      const pageChanged = review.pageHash !== now.pageHash;
      const answersChanged = review.answersHash !== now.answersHash;
      state = pageChanged && answersChanged ? 'both' : pageChanged ? 'page' : answersChanged ? 'answers' : 'ok';
      if (answersChanged && review.answers) {
        const keys = new Set([...Object.keys(review.answers), ...Object.keys(now.answers)]);
        changed = [...keys].filter((key) => JSON.stringify(review.answers[key]) !== JSON.stringify(now.answers[key])).sort();
      }
    }
    pages.push({
      href: page.href,
      file,
      pageHash: now.pageHash,
      total: counted.length,
      answered: counted.filter((d) => hasAnswer(answers[d.key])).length,
      review: { state, at: review?.at ?? null, changed },
    });
  }
  return { pages };
}

/** Record the current state as reviewed */
export async function markReviewed(workDir, files) {
  const answers = await readJson(join(workDir, 'answers.json'), {});
  const reviews = await readJson(join(workDir, 'reviews.json'), {});
  for (const file of files) {
    const html = await readFile(join(workDir, 'public', file), 'utf8');
    reviews[file] = { at: new Date().toISOString(), ...snapshot(file, html, answers) };
  }
  const target = join(workDir, 'reviews.json');
  await writeFile(`${target}.tmp`, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
  await rename(`${target}.tmp`, target);
}
