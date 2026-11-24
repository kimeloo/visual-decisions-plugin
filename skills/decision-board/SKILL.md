---
name: decision-board
description: Use when the user asks to see something visually or as an artifact ("시각적으로 보여줘", "아티팩트로 보여줘", "그림으로/화면으로 보여줘", "show it visually"), or when several decisions (design, UI, policy, scope) need side-by-side comparison with mockups and the user picks in a local HTML page ("결정 보드", "선택지 비교 페이지", "html로 골라볼게", "목업 보고 고를게", "decision board"). Builds local pages served by a tiny Node server that saves answers to answers.json. Skip for 1-3 quick text-only questions.
version: 1.3.0
---

# decision-board

Builds a set of local HTML pages that ask the user many decisions at once and collects the answers. Each decision shows facts, screenshots and option mockups side by side; the user answers with radios, checkboxes and memos. The server saves answers to `answers.json` immediately. The harness (server, shared CSS/JS, answer scripts) knows nothing about content; the session that invokes this skill fills in the pages.

**Language:** everything the user sees (page text, option titles, notices, your announcement) is written in the user's language (Korean for this user). This file and `references/` are agent-only instructions. Literal Korean strings in them (e.g. "현재 유지", "반영 범위", `[추론]`) are page text to copy as-is.

## When to use

- The user asks to see something visually or as an artifact ("시각적으로 보여줘", "아티팩트로", "그림으로", "화면으로"), regardless of question count.
- 4+ decisions, or decisions that must be seen to be chosen (shape, layout, color, table structure, wording).
- Batching questions for when the user is away.
- Follow-up rounds: answers raise new questions (add the next numbered page).

If the user only wants to see something and nothing needs deciding, build pages with facts/mockups/screenshots and a memo-only box (`data-memo="only"`). If no visual form was requested, there are 1-3 questions and no picture is needed, do not use this skill; ask directly.

## Files

`<skill>` is `${CLAUDE_SKILL_DIR}` (the folder containing this SKILL.md).

```
<skill>/harness/server.mjs          static files + /api/answers (save) + /api/status (per-tab progress/review state). No dependencies
<skill>/harness/init.mjs            create work folder (copies templates, never overwrites)
<skill>/harness/print-answers.mjs   print answers in page order
<skill>/harness/mark-reviewed.mjs   record pages you reviewed (tab shows "reviewed"; shows "modified since review" once changed)
<skill>/harness/verify.mjs          static check of built pages, one-line summary
<skill>/harness/selftest.mjs        smoke test of the harness itself (run after editing harness/ or templates/)
<skill>/harness/public/             common.css, common.js, index.html
<skill>/templates/                  pages.json, p1.html (one-decision skeleton), discuss.config.json
<skill>/references/                 page-contract.md, markup-examples.md, answers-and-records.md (read only at the step that names them)
```

## Steps

### 1. Work folder

- Pick a folder git does not track inside the project (e.g. `.local/<topic>/decisions/`). Confirm it is gitignored; otherwise use an OS temp dir. Never commit answers or pages.
- `node <skill>/harness/init.mjs <work dir> --port <free port>`

### 2. Gather facts (before any page)

- Per decision collect: current value, reference value (original / reference screen / doc), evidence location (file:line), and what is affected if it changes. Split wide scope across read-only subagents.
- Code-only judgments can be wrong. Measure when cheap (pixel measurement, render with the real library, contrast calculation, API response). Mark unverified claims `[추론]`.
- If using screenshots, connect their folder via `mounts` in `discuss.config.json`. Decide crop coordinates by looking at the image yourself.

### 3. Design decisions and pages

- One topic per page, 4-7 decisions. The last page is "반영 범위" (units to ship, order, overlap with other work).
- Keys: decision `p<N>.<key>`, sub-question `p<N>.<key>.<sub>`. `p<N>` equals the file name `pN.html`; never end a key with `note`. Option values are `A`, `B`, `C`... A control name must contain a dot to be saved.
- Options:
  - Include "현재 유지" for comparison.
  - No default selection (`checked`). Only checklists may have defaults.
  - Mark the one you recommend with the recommend chip (`rec`). Other labels (e.g. "기준과 같음") use `tag`.
- Option descriptions: what changes, impact/risk, effects elsewhere (other systems, documented rules). If an option breaks a rule, name the rule.
- Mockups:
  - Same content and size for every option.
  - Use the project's real values (load token CSS via mounts) and make them correct in light and dark.
  - A mockup reproducing a reference screen uses its exact values (hex etc.).
- Checklists: for long "restore or change" lists, use one checkbox list with the same `name` and bulk-select buttons.

### 4. Build pages

- **Read `references/page-contract.md` first.** Copy `templates/p1.html` (one-decision skeleton), fill it, and add the page to `public/pages.json`. Rare blocks (checklist, screenshot, sub-question): `references/markup-examples.md`.
- With several pages, give each page to a subagent in parallel.
  - Hand over common rules, facts and per-page content in one document, plus the path of `page-contract.md`.
  - Each agent writes only its own `pN.*` files. Only the main session edits shared files (`pages.json`, harness files).
  - If research contradicts a document, the agent writes it in the page's facts block and in its report.

### 5. Server

- Run as a long-lived named service, surviving session changes if possible: `node <skill>/harness/server.mjs <work dir>`
- On Windows with a WSL shell `node` may be missing; use `node.exe`.
- If the server dies, restart it. Answers live in files and are not lost.

### 6. Verify (before telling the user)

- `node <skill>/harness/verify.mjs <work dir>` checks decision keys, control names, default-checked radios, wiring and server responses in one go. Fix on FAIL.
- Browser check, decided per session (ask the user if unclear; B can be better for risky UI changes):
  - **A. The user checks.** Add a checklist decision (`pN.check`, checkbox list) of every UI item you could not verify yourself and ask them to tick what they confirmed; unticked items are what to fix.
  - **B. You check.** Open one page with your own browser tool (own tab; never the user's system browser; close only tabs you opened): light, dark and every other toggle; console errors 0; screenshot crop failures (`.crop-box.broken`) 0.
- Test saving: back up `answers.json`, pick one option, confirm it was saved, restore the backup.

### 7. Announce

- Give the address, a page table (page, what to decide), and facts to know before choosing (including corrections of earlier code-only judgments), briefly.
- Tell the user memos are free-form; tabs fill green as they answer; each tab shows whether you reviewed it. When they say they are done, process only that page. Answers may be collected page by page.

### 8-9. Read answers, record, finish

When the user says they answered, **read `references/answers-and-records.md`** and follow it (read with `print-answers.mjs`, log review with `mark-reviewed.mjs`, memos are instructions, record decisions, re-ask on the next page, clean up).
