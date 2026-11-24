# Reading answers, recording, finishing

Read this after the user says they answered (steps 8-9).

## Read and record

- Read with `node <skill>/harness/print-answers.mjs <work dir>`. If long memos are truncated, add `--json`.
- Right after reading a page, run `node <skill>/harness/mark-reviewed.mjs <work dir> <pN.html>`. If the user later changes answers, that tab shows "modified since review" for them, and each page header in `print-answers` shows the same plus the changed keys (`[since review 2026-11-22 12:30 - answers changed: p1.x, p1.y.note]`). Use `print-answers.mjs <work dir> --changed` to see only pages that are unreviewed or changed since review, so you do not re-read the rest. The user does not need to tell you.
- Memos are instructions. Answer questions inside memos; write decisions born from memos down separately.
- Move results into the project's decision record (if any) right away: chosen option, compared options, what memos decided, what to ask again. Correct anything you told the user wrongly earlier.
- Re-ask on the next numbered page (e.g. "N. 남은 질문") when:
  - answers conflict,
  - the answer says "I'll decide after seeing a picture",
  - applying answers raises a new question.
- If the user reverses a decision or another decision makes it moot, do not delete its section. Add `<div class="notice">` with the reason and the class `superseded` on the section.

## Finish

- Once all decisions are recorded and the user agrees, stop the service. Keep the work folder as a local record or delete it as the user prefers.
