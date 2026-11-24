# Page contract (what common.js reads)

Read when building pages (step 4). Markup examples for rare blocks (checklist, screenshots, sub-questions, memo-only, long form): [markup-examples.md](markup-examples.md).

- `<head>`: `<link rel="stylesheet" href="/common.css">`, `<script defer src="/common.js">`. Page scripts go in separate files with `defer` (an inline `<script defer>` is not deferred).
- File `pN.html` has decision keys starting with `pN.` (review state is computed per file).
- Decision: `<section class="decision" data-key="p1.key">` (attribute order `class` then `data-key`; `print-answers` and the server match in this order). Radios with the same name inside are the answer.
  - Never end a key with `note`; it collides with the memo box name `<key>.note`.
  - `data-memo="off"`: no memo box.
  - `data-memo="only"`: memo only, no answer (excluded from answered count). The memo box is named `<key>.note` and added by the harness.
- Options (short tag): `<d-opt v="A" title="Name" rec tag="label">description<d-mock>mockup</d-mock></d-opt>`. The radio name comes from the nearest `[data-name]` (sub-question) or the decision's `data-key`; override with `name="..."`. `rec` = recommend chip, `tag` = dashed chip. Description and mockup may be omitted.
  - The long markup still works: `<label class="option"><span class="head"><input type="radio" name="..." value="A"> A. Name <span class="rec">추천</span></span><span class="desc">...</span><div class="mock">...</div></label>`.
  - Wide mockups: `<div class="options col1">`.
- Other blocks: `.ref` (evidence line), `ul.facts`, `.risk`, `.sub` (sub-question group), `table.plain`, `.notice`, `.superseded`.
- Save rules:
  - Only controls whose name contains a dot are saved. Radio = string, checkboxes = array of checked values, text = string.
  - Only the changed control (a whole checkbox group) is saved, so two tabs on the same page do not overwrite each other's answers. Checklist defaults that were never saved are sent along as "write only if absent" (`POST /api/answers?defaults=a,b`), so they are saved the first time anything on that page changes.
- `pages.json`:
  - `pages`: the tabs. A tab fills green by answered ratio and is fully green when done. The server counts decisions from the page; do not write counts.
  - `toggles`: switches for `<html data-<attr>>`, remembered in `localStorage`.
  - `rootAttrs`: fixed attributes on `<html>`, e.g. `{"data-theme":"default"}`.
  - A `mode` (light/dark) toggle always exists.
- Layout: the nav bar is fixed and only the area below it scrolls (the page itself never scrolls), so overscroll cannot drag the nav bar.
- Added automatically by the harness: nav bar, left table of contents when there are 2+ decisions (a rail of "-" marks that expands to titles on hover; no color coding, a left icon shows state: green ✓ = answered, ✎ = memo only; it scrolls independently of the content), a collapsed "+ 메모 추가" memo per decision (open when it has content), and the review state under the title.
- Live updates: every 3 s the nav progress and review banner refresh on their own (inputs are never touched). If the page file changes, a notice offers "새로고침" instead of reloading automatically, so typed text and scroll are not lost.
- Review state: after `mark-reviewed.mjs`, a later change to the page file or to that page's answers shows "modified since review". Record each page you review as you go.
- JS (`window.discuss`): `onTheme(fn)` (re-draw on mode/toggle change; also called once on registration), `cssVar(name)`, `answers()` (to reflect other pages' answers in a mockup), `save()` (flush pending changes).
- The harness frame uses only `--d-*` variables. Inside mockups use project tokens or reference values.
- All page text is shown to the user: write it in the user's language.
