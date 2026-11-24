# Markup examples (rare blocks)

Base skeleton: `templates/p1.html`. Use these only when needed. Rules: [page-contract.md](page-contract.md). Text inside examples is page text (write it in the user's language).

## Sub-question

Name is `<key>.<sub>`. The radio name comes from `data-name`.

```html
<div class="sub" data-name="p1.example.detail">
  <h3>Sub-question</h3>
  <div class="options">
    <d-opt v="A" title="Shown"></d-opt>
    <d-opt v="B" title="Hidden"></d-opt>
  </div>
</div>
```

## Checklist

Pick many items at once: checkboxes with the same `name` (saved as an array). Defaults use `checked`.

```html
<section class="decision" data-key="p1.items">
  <h2>Items</h2>
  <div class="ref">Checked items are applied. Uncheck only what to skip.</div>
  <div class="bulk"><button type="button" data-check-all="p1.items">Select all</button><button type="button" data-check-none="p1.items">Clear all</button></div>
  <div class="checklist">
    <label><input type="checkbox" name="p1.items" value="ITEM-1" checked /><span><b>ITEM-1</b> description · current → new · <code>file.ts:12</code></span></label>
  </div>
</section>
```

## Screenshot crop

`data-crop="x,y,w,h"` (source pixels), `data-scale`, `data-src-dark` if a dark image exists. Connect folders via `mounts` in `discuss.config.json`.

```html
<div class="shots">
  <figure><div class="crop" data-src="/shots/before.png" data-crop="0,0,600,120" data-scale="1"></div><figcaption>Current</figcaption></figure>
  <figure><div class="crop" data-src="/shots/reference.png" data-crop="0,0,600,120" data-scale="1"></div><figcaption>Reference</figcaption></figure>
</div>
```

## Memo-only decision

```html
<section class="decision" data-key="p1.other" data-memo="only"><h2>Anything else</h2></section>
```

## Mockup styling

Put mockup-only classes in the page `<style>` and draw every option with the same content and size. Do not use harness frame variables (`--d-*`) inside mockups. To use project tokens, connect the css via `mounts` and load it in `<head>` (e.g. `<link rel="stylesheet" href="/theme/tokens.css">`). If a mockup is drawn by script, put it in a page-specific file with `defer`.
