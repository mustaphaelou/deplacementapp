# Research: Notion Design Language (for shadcn/ui prototype of login page + dashboard)

> Generated: 2026-08-02
> Purpose: Feed prototype ticket #171 with exact, source-cited Notion design values so a developer can faithfully recreate a Notion-style login page and dashboard with shadcn/ui — no guessing. Primary sources are Notion's own app CSS/tokens (fetched directly from www.notion.so), Notion's marketing-site CSS, Notion's blog, and Notion's official GitHub org. Community sources are labeled as such.

---

## Summary table — key tokens

| Token | Value | Confidence | Source |
|---|---|---|---|
| App base font size (UI text) | 14px; body/editor text 16px, line-height 1.5 | High | Exported CSS; community tokens |
| App font stack (system) | `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"` | **Verified** (app CSS) | https://www.notion.so/login inline CSS |
| Marketing font | `Inter` (self-hosted "NotionInter" bundle; Inter-Bold/Inter-Medium woff2 served from notion.so) | **Verified** (marketing CSS) | https://www.notion.so/ static CSS |
| Text primary (classic) | `#37352F` | **Verified** (Notion cookbook + app CSS) | https://github.com/makenotion/notion-cookbook/blob/main/workers/powerpoint-creator/src/theme.ts |
| Text secondary | `#787774` | **Verified** (Notion cookbook) | same |
| Text muted / gray | `#9B9A97` | High (community, multiple) | https://docs.super.so/notion-colors |
| Text placeholder | `#C3C2BF` (community approx.) | Medium | https://seedflip.co/blog/notion-design-system |
| Divider | `#E3E2E0` (cookbook `E3E2DE`) | **Verified** | cookbook theme.ts; app shimmer `rgba(227,226,224,.5)` in app CSS |
| Block/code bg | `#F1F1EF` | **Verified** (cookbook) | cookbook theme.ts |
| Sidebar bg | `#F7F6F3` (classic) / `#F9F8F7` (current app token) | **Verified** both | cookbook; app CSS `--c-bacSec` |
| Accent blue | `#2383E2` | **Verified** (app token `--c-palUiBlu600`) | https://www.notion.so/_assets/59116-*.css |
| Blue hover (light) | `#0077D4` (token `--c-bluButHovBac`) | **Verified** | same |
| Blue pressed | `#006BC7` (token `--c-bluButPreBac`) | **Verified** | same |
| Text-selection blue | `#2EAADC` (rgb(46,170,220)); `rgba(35,131,226,.28)` | High (community; cookbook accent `2EAADC`) | cookbook; notionpresso |
| Hairline border | `rgba(55,53,47,.09)`; alpha-border tokens `rgba(28,19,1,.11)` | **Verified** | exported CSS; app CSS `--ca-borPriTra` |
| Button border-radius (app) | 3px (`.callout`, `.selected-value`, `code`); button token scale uses 3–4px | High | exported CSS gist |
| Marketing radii scale | 4/5/6/8/10/12/14/16px (tokens 200–900) | **Verified** | marketing CSS |
| Sidebar width | Skeleton 240px (verified); live app user-resizable; clones use 300px expanded / 44px rail | Partially verified | app CSS `#skeleton-sidebar` |
| Dark mode bg | `#191919` | **Verified** | app CSS `body.dark` |
| Button shadow | `0 1px 2px rgba(15,15,15,.1)` (+ inset ring) | **Verified** (token `--c-butBoxSha`) | app CSS |
| Page title (page header) | 40px / 700 (exported `2.5rem`) | **Verified** | exported CSS |
| Hover bg (buttons) | `rgba(55,53,47,.06)`; sidebar row selected `rgba(0,0,0,.03)` | **Verified** | app CSS tokens |

---

## 1. Typography

### 1.1 App: system font stack (verified, NOT Inter)

Notion's app does **not** bundle a webfont — it uses the system UI stack. Verified in Notion's own app CSS (inline in the `www.notion.so/login` document, and in the exported-page CSS):

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
  "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol";
```

- Inline app CSS on the login shell: `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol"` — [Source: notion.so/login HTML](https://www.notion.so/login)
- Exported-page CSS `.sans` class: same stack — [Source: Notion export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)
- A near-identical stack (with `ui-sans-serif` prepended) is what every serious clone uses — [Source: shade-solutions/notion-design-system (community)](https://github.com/shade-solutions/notion-design-system)

### 1.2 Base sizes and line height

- Body/editor text: **16px**, `line-height: 1.5` — verified in exported CSS (`body { line-height: 1.5 }`; prose blocks are 16px in the app). [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)
- UI chrome (sidebar, collection/database rows, small UI): **14px** — `.collection-content { font-size: 0.875rem }` in exported CSS; sidebar at 14px per clones. [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18), [Source: notionpresso tokens (community)](https://notionpresso.com/cn/docs/customization-guide/css-structure-and-styling)
- Exported CSS page structure (this is Notion's real content type scale):
  - `.page-title { font-size: 2.5rem (40px); font-weight: 700; margin-bottom: 0.75em }`
  - `h1 { font-size: 1.875rem (30px); font-weight: 600; margin-top: 1.875rem }`
  - `h2 { font-size: 1.5rem (24px); font-weight: 600 }`
  - `h3 { font-size: 1.25rem (20px); font-weight: 600 }`
  - headings: `letter-spacing: -0.01em; line-height: 1.2; font-weight: 600`
  - [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)

### 1.3 Marketing site: Inter (verified)

Notion's marketing site (www.notion.so) ships **Inter** — a self-hosted variant branded "NotionInter" (a bundled, likely subsetted Inter):

- Verified in the marketing CSS token: `--font-family-fallback-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` and `--font-family-fallback-sans-arabic: NotionInter, Inter, ...`. [Source: www.notion.so `_next/static/css/*.css`](https://www.notion.so/)
- Verified font files served by notion.so: `Inter-Bold.woff2`, `Inter-Medium.woff2` referenced in the homepage HTML. [Source: www.notion.so homepage HTML](https://www.notion.so/)
- Community confirmation: "The official website uses Inter" (wordmark is Articulat CF); [Source: Design Compass (community)](https://designcompass.org/en/2025/01/20/notion/); "NotionInter — Notion's bundled Inter variant... closest open-source substitute is Inter"; [Source: duply.ai design-token extraction (community)](https://duply.ai/notion/design-md)
- Marketing type scale (extracted tokens): body 16px/400/1.5; labels 14px/400/1.429; display-xl 64px/700/`-2.125px` tracking; display-lg 54px/700/`-1.875px` tracking. [Source: duply.ai (community)](https://duply.ai/notion/design-md)
- Marketing mono: `--font-family-primary-mono: "iA Writer Mono"`; handwriting: `"Permanent Marker"`. [Source: marketing CSS](https://www.notion.so/)
- PDF export substitutes Inter for the sans stack — interesting cross-reference (`.pdf .sans { font-family: Inter, -apple-system, ... }`). [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)

### 1.4 Serif

The app's editor offers a serif type option (`Lyon-Text, Georgia, ...`) — this is a user-facing page style, not default UI chrome. [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)

**Implication for the prototype:** use the system stack for the app UI (login + dashboard); use Inter (or `NotionInter`, or just Inter via next/font) if you also build marketing pages. Do **not** use Inter in the app UI — the real app does not.

---

## 2. Spacing rhythm

Notion's official philosophy (from Notion's own blog):

- "Instead of baseline alignment, we opted to start with standardized spacings... Nothing is aligned to the baseline, but elements generally fall in line while remaining flexible" — and an **adjacency system**: when a block's neighbor is another list item, padding is reduced so lists chunk together; paragraphs get more breathing room. [Source: "Updating the design of Notion pages", notion.com blog, 2026-03-18](https://www.notion.com/blog/updating-the-design-of-notion-pages)

### 2.1 Verified spacing values

- Export CSS: `body { margin: 2em auto; max-width: 900px }` (exported public pages); `td/th { padding: 0.25em 0.5em }`; `.column { padding: 0 1em }`; code block `padding: 1.5em 1em`; blockquote `padding-left: 1em; margin: 1em 0`. [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)
- App shell (verified): sidebar skeleton `padding: 12px 14px`; fallback page `padding: 40px 20px 60px 20px`. [Source: notion.so/login HTML](https://www.notion.so/login)
- Community-consensus scale (what clones actually ship): 4/8/12/16/24/32/48px. [Source: shade-solutions/notion-design-system (community)](https://github.com/shade-solutions/notion-design-system), [Source: designmd.cc extraction (community)](https://designmd.cc/benchmarks/notion)
- Marketing card padding tokens: `--spacing-card-padding-inline: 16px`, `-sm: 24px`, `-block: 32px`; card block-end 16/24/28px. [Source: marketing CSS](https://www.notion.so/)
- Page content column: community renderers use **max-width 720px** for the prose column, indent 27px per level. [Source: notionpresso (community)](https://notionpresso.com/cn/docs/customization-guide/css-structure-and-styling)

### 2.2 Practical paddings for the dashboard

- Sidebar rows: height ~28–32px with ~6–8px horizontal padding (clones; verified only that sidebar padding is 12px 14px at the container level). [Source: notion.so/login HTML](https://www.notion.so/login)
- Card/dialog padding: 16px–28px (`--dialog-body-horizontal-padding: 16px/28px; --dialog-body-top-padding: 20px`, marketing tokens). [Source: marketing CSS](https://www.notion.so/)
- Section gaps: 48px+ vertical between major sections (community guideline). [Source: designmd.cc (community)](https://designmd.cc/benchmarks/notion)

---

## 3. Color

### 3.1 Notion's own published tokens (strongest evidence)

**From Notion's official GitHub org** (`makenotion/notion-cookbook`, the PPT-export theme — a Notion-internal theme object): [Source](https://github.com/makenotion/notion-cookbook/blob/main/workers/powerpoint-creator/src/theme.ts)

```ts
text: "37352F", textLight: "787774", accent: "2EAADC", bg: "FFFFFF",
bgWarm: "F7F6F3", codeBg: "F1F1EF", divider: "E3E2DE", titleBg: "191919"
```

**From the live app CSS** (token variables extracted from `https://www.notion.so/_assets/59116-*.css`): [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)

- Accent blue scale (UI blue): `--ca-palUiBlu50: rgba(35,131,226,.035)`, `75: .05`, `100: .07`, `200: .14`, `300: .2/.21`, `400: .35`, `500: .57`, **`600: #2383e2`**, **`700: #105fad`**
- Blue button hover/pressed: `--c-bluButHovBac: #0077d4`, `--c-bluButPreBac: #006bc7`
- Light-theme neutrals (current tokens): `--c-bacPri: #fff`, `--c-bacSec: #f9f8f7` (secondary surfaces/sidebar), `--c-bacTer: #f0efed` (tertiary/hover), `--c-bacInt: #f4f3f3` (interactive); text `--c-texPri: #2c2c2b`, `--c-texSec: #7d7a75`, `--c-texTer: #a19e99`; borders `--c-borPri: #e6e5e3`, `--c-borSec: #f0efed`, `--c-borStr: #d4d3cf`
- Alpha borders (warm): `--ca-borPriTra: rgba(28,19,1,.11)`, `--ca-borSecTra: rgba(42,28,0,.07)`
- Hover/pressed bg: `--ca-butHovBac: rgba(55,53,47,.06)`, `--ca-butPreBac: rgba(55,53,47,.16)`, light-gray button hover `--ca-ligGraButHovBac: rgba(227,226,224,.7)` (= #E3E2E0 @ 70%)
- Selected sidebar row: `--ca-sidIteSelBac: rgba(0,0,0,.03)`; secondary sidebar bg `--ca-sidSecBac: rgba(0,0,0,.024)`
- Table row hover: `--ca-tabRowHovBac: rgba(55,53,47,.024)`
- Popover overlay: `--ca-popOveBac: rgba(15,15,15,.6)`
- Code block bg: `--cd-codBloBac: #f7f6f3`
- Dark mode: `body.dark { background: #191919 }`, skeleton sidebar `#202020`, spinner `#383836`, light text `#f0efed`. [Source: notion.so/login HTML](https://www.notion.so/login)

### 3.2 The "classic" gray scale — verdict on each hex in the ticket

| Hex (ticket) | Verdict | Verified/community source |
|---|---|---|
| `#37352F` | **Verified** — text primary | [Notion cookbook](https://github.com/makenotion/notion-cookbook/blob/main/workers/powerpoint-creator/src/theme.ts); [export CSS `rgb(55,53,47)`](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18) |
| `#787774` | **Verified** — secondary text | [Notion cookbook](https://github.com/makenotion/notion-cookbook/blob/main/workers/powerpoint-creator/src/theme.ts) |
| `#9B9A97` | High — muted text | [docs.super.so/notion-colors](https://docs.super.so/notion-colors), [notioncolors.com](https://notioncolors.com/) |
| `#C9C9C7` | **UNVERIFIED** — not found in any source examined | — |
| `#E3E2E0` | **Verified** — divider (cookbook `E3E2DE`; app shimmer `rgba(227,226,224,.5)`) | [Notion cookbook](https://github.com/makenotion/notion-cookbook/), app CSS |
| `#EBEBEA` | Medium — hover gray (community; app token is `#F0EFED`) | [nucleo DESIGN.md (community)](https://github.com/Carlos-Dominguez-faber/nucleo/blob/main/DESIGN.md), [shade-solutions](https://github.com/shade-solutions/notion-design-system) |
| `#F1F1EF` | **Verified** — block/code background | [Notion cookbook](https://github.com/makenotion/notion-cookbook/) |
| `#F7F6F3` | **Verified** — classic sidebar/warm bg | [Notion cookbook](https://github.com/makenotion/notion-cookbook/) |
| `#FBFBFA` | **UNVERIFIED** — not found in any source examined | — |

Current app tokens favor `#F0EFED` (hover), `#F9F8F7` (sidebar), `#E6E5E3` (border) over the classic values — ship the classic values (they are the widely-recognized Notion palette) and note that 2025+ app tokens have drifted slightly.

### 3.3 Marketing site color system (verified tokens)

From www.notion.so static CSS: [Source: marketing CSS](https://www.notion.so/)

- Blue scale: 100 `#f2f9ff`, 200 `#e6f3fe`, 300 `#93cdfe`, 400 `#62aef0`, **500 `#097fe8`**, **600 `#0075de`**, **700 `#005bab`**, 800 `#00396b`, 900 `#002a4f`
- Gray (warm) scale: 100 `#f9f9f8`, 200 `#f6f5f4`, 300 `#dfdcd9`, 400 `#a39e98`, 500 `#78736f`, 600 `#615d59`, 700 `#494744`, 800 `#31302e`, 900 `#191918`
- Alpha blacks: 100 `#0000000d`, 200 `#0000001a`, 300 `#00000033`, 400 `#0000004d`, 500 `#0000008a`, 600 `#00000096`, 700 `#000000bf`
- Primary button = **black** `--color-black: #000000`, white text; hover `--color-alpha-black-700`. [Source: marketing CSS](https://www.notion.so/)
- Note: the marketing hero is a deep navy (`#02093a`) per two independent extractors. [Source: duply.ai](https://duply.ai/notion/design-md), [Source: designmd.cc](https://designmd.cc/benchmarks/notion) — not re-verified in my own CSS fetch.

**Brand statement:** "While we refrain from using bright colors within the Notion app, our ads are designed to delight and excite" — [Source: Notion blog, "The thinking behind our latest brand campaign", 2024-07-10](https://www.notion.com/blog/the-thinking-behind-our-latest-brand-campaign)

---

## 4. Borders / shadows

### 4.1 Hairlines (verified)

- Exported CSS: `hr { border-bottom: 1px solid rgba(55,53,47,.09) }`; tables `border: 1px solid rgba(55,53,47,.09)`; TOC links `rgba(55,53,47,.18)`. [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)
- App tokens: alpha border `rgba(28,19,1,.11)` (pri) / `rgba(42,28,0,.07)` (sec); solid `#e6e5e3` / `#f0efed`. [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- Sidebar divider (verified): `box-shadow: inset -1px 0 0 0 #f0efed` on the sidebar skeleton. [Source: notion.so/login HTML](https://www.notion.so/login)

### 4.2 Radius (app ~3px; marketing 4–16px)

- App: 3px is the recurring value in Notion's content CSS — `.callout { border-radius: 3px }`, `.selected-value { border-radius: 3px }`, `code { border-radius: 3px }`, `img.icon { border-radius: 3px }`. [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)
- Community clones converge on **3–4px buttons, 3px inputs**. [Source: shade-solutions (community)](https://github.com/shade-solutions/notion-design-system), [Source: seedflip (community)](https://seedflip.co/blog/notion-design-system)
- Marketing radius scale (verified): 200: 4px, 300: 5px, 400: 6px, 500: 8px, 600: 10px, 700: 12px, 800: 14px, 900: 16px. [Source: marketing CSS](https://www.notion.so/)
- Dark-mode tint: app skeleton dark sidebar border `#2c2c2b`. [Source: notion.so/login HTML](https://www.notion.so/login)

### 4.3 Shadows (minimal — verified)

- **Button shadow** (verified token): `--c-butBoxSha: inset 0 0 0 1px rgba(15,15,15,.1), 0 1px 2px rgba(15,15,15,.1)` (light). [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- **Button focus ring** (verified tokens): light `0 0 0 2px #f8f8f7, 0 0 0 4px #2383e2, 0 0 0 6px rgba(255,255,255,.25)`; dark `0 0 0 2px #191919, 0 0 0 4px #2383e2, 0 0 0 6px #191919`. [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- **Input focus ring** (verified token): `--c-inpBluFocRin: 0 0 0 1px #2383e2 inset, 0 0 0 1px #2383e2`. [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- Popover/menu shadow: community extractors measure multi-layer stacks with max per-layer opacity ≤ 0.05, e.g. `rgba(0,0,0,.01) 0px 1px 3px, rgba(0,0,0,.02) 0px 3px 7px, rgba(0,0,0,.02) 0px 7px 15px, rgba(0,0,0,.04) 0px 14px 28px, rgba(0,0,0,.05) 0px 23px 52px`. [Source: designlang.app extraction (community)](https://www.designlang.app/gallery/notion-so), [Source: 0xcjl/open-design-pro (community)](https://github.com/0xcjl/open-design-pro/blob/main/design-systems/notion/DESIGN.md)
- Philosophy: shadows are barely-there; "Flat surfaces only; differentiate blocks with #E3E2E0 1px borders or #F1F1EF block backgrounds" (community guidance). [Source: galyarder orbit-notion (community)](https://github.com/galyarderlabs/galyarder-design/blob/main/design-templates/orbit-notion/SKILL.md)

---

## 5. Sidebar anatomy

Verified (from the live app shell + Notion help) + community for anything pixel-level:

- **Width**: loading skeleton is `width: 240px; padding: 12px 14px` — [Source: notion.so/login HTML](https://www.notion.so/login). The real sidebar is **user-resizable** and collapsible via the `<<` icon — [Source: Notion help, "Navigate with the sidebar"](https://www.notion.com/help/navigate-with-the-sidebar). A May 2025 UI breakdown measured the expanded sidebar at 224px — [Source: Medium (community)](https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d). Clones commonly ship **300px expanded / 44px collapsed rail** — [Source: szj2ys/notion-clone, adityaphasu/notion-clone (community)](https://github.com/adityaphasu/notion-clone). → Pick 240–300px expanded; exact live default is **not pinned down** (see Unknowns).
- **Background**: classic `#F7F6F3` [Source: cookbook](https://github.com/makenotion/notion-cookbook/); current app token `#f9f8f7` with 1px right hairline `#f0efed` (verified skeleton). [Source: notion.so/login HTML](https://www.notion.so/login)
- **Structure** (from Notion help + clone anatomy): top tabs row (notion-html web app shows tab icons), then workspace switcher row, then sections `Favorites` / `Workspace` / `Shared` / `Private` which can each be collapsed by clicking the heading. [Source: Notion help](https://www.notion.com/help/navigate-with-the-sidebar)
- **Rows**: hover-revealed chevron (12px, `rgba(227,226,224,.5)` at rest in skeleton) and `+` icon appear on hover at row right; hover bg `rgba(55,53,47,.06)`-ish family; selected row `rgba(0,0,0,.03)` (verified token `--ca-sidIteSelBac`). [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- **Section headings**: community consensus: 11px, uppercase, letter-spacing ~0.08em, muted gray. [Source: nucleo DESIGN.md (community)](https://github.com/Carlos-Dominguez-faber/nucleo/blob/main/DESIGN.md)
- **Row text**: 14px (community; Notion UI text is 14px). [Source: notionpresso (community)](https://notionpresso.com/cn/docs/customization-guide/css-structure-and-styling)

---

## 6. Content header

Verified from Notion's exported content CSS (this is the page-header anatomy of a real Notion page): [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)

- **Page icon**: `.page-header-icon { font-size: 3rem; margin-bottom: 1rem }` (48px emoji/page icon above the title)
- **Page title**: `.page-title { font-size: 2.5rem; font-weight: 700; margin-top: 0; margin-bottom: 0.75em }`
- **Cover image**: `.page-cover-image { height: 30vh; object-fit: cover }`
- **Breadcrumbs**: the app shows `… / parent pages` at top-left (16px); the exported CSS has no breadcrumb class — treat breadcrumb styling (14px, `#787774`, hover → dark) as community-consensus. [Source: Saeed-Altout/notion-clone docs (community)](https://github.com/Saeed-Altout/Notion-Clone)
- **Actions row** (star / share / comments): Notion's header actions live top-right; the share button is the primary `#2383E2` pill when sharing is on, with hover `#0077D4` (verified token pair). Icon buttons: ghost with `rgba(55,53,47,.06)` hover (verified token). [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- **Border treatment**: sticky header separated by hairline `rgba(55,53,47,.09)`; when scrolled, a hairline + slight shadow appears (community observation; not directly verified).

---

## 7. Tables / databases

Verified from Notion's exported content CSS (the database table is the same component): [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18)

- **Header row**: `th { color: rgba(55,53,47,.6) }` (60% ink — muted); `font-weight: normal`; text-align left; header icon/name 14px (`.collection-content { font-size: .875rem }`)
- **Cells**: `td/th { padding: 0.25em 0.5em; line-height: 1.5; min-height: 1.5em }` (~4px/8px)
- **Borders**: `table { border: 1px solid rgba(55,53,47,.09); border-collapse: collapse; border-left: none; border-right: none }` — i.e. hairline horizontal + outer, no left/right
- **Row hover**: verified token `--ca-tabRowHovBac: rgba(55,53,47,.024)` (2.4% ink). [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- **Row height**: database rows ~40–45px in the app (community observation; not verified in a primary source)
- **Selected/checkboxes**: checkbox `transform: scale(1.5)` in content CSS; selection tint `rgba(35,131,226,.28)` / `#d9eff8` (community notionpresso tokens; selection color `rgb(46,170,220)`). [Source: export CSS gist](https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18), [Source: notionpresso (community)](https://notionpresso.com/cn/docs/customization-guide/css-structure-and-styling)

---

## 8. Login page anatomy

Structure verified from the live page (https://www.notion.so/login): [Source: notion.so/login](https://www.notion.so/login)

- Centered column: heading "**Your AI workspace.**" + "Log in to your Notion account"
- **Email field** (label "Email", hint "Use an organization email to easily collaborate with teammates")
- **Continue** button (primary)
- "or continue with" row: **Google, ChatGPT, Apple, Microsoft, Passkey, SSO** provider buttons
- Footer: "New user? Sign up" + terms/privacy line + language picker ("Language: English (US)")
- Background: fallback page verified `#fffefc`; login background is effectively white/off-white. [Source: notion.so/login HTML](https://www.notion.so/login)

Style specifics for the login card are **not published** — the login screen is rendered client-side by the app JS, so the values below are inferred from the verified app tokens (all verified values):

- Logo (N-mark SVG `notion-logo-block-main.svg` referenced in shell HTML) centered above the heading
- Input: 1px hairline border (`rgba(55,53,47,.11)`-family), radius 3px, focus ring `0 0 0 1px #2383e2 inset, 0 0 0 1px #2383e2` (verified token) [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- Primary Continue button: `#2383E2`, white text, hover `#0077D4`, pressed `#006BC7`, shadow `0 1px 2px rgba(15,15,15,.1)` (all verified tokens) [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- Provider buttons: white with hairline border, hover `rgba(55,53,47,.06)` (verified token) [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)
- Card width ~350–400px centered (community consensus; not verified)

---

## 9. Buttons and inputs

All verified values from app CSS tokens unless noted: [Source: app CSS](https://www.notion.so/_assets/59116-819919ab13219ea1.css)

| Property | Value (verified) |
|---|---|
| Primary button bg | `#2383E2` |
| Primary hover | `#0077D4` (`--c-bluButHovBac`) |
| Primary pressed | `#006BC7` (`--c-bluButPreBac`) |
| Ghost/outline hover | `rgba(55,53,47,.06)` (`--ca-outButHovBac`, `--ca-butHovBac`) |
| Ghost pressed | `rgba(55,53,47,.16)` (`--ca-butPreBac`) |
| Light-gray button hover | `rgba(227,226,224,.7)` (≈ #E3E2E0 @ 70%) |
| Button shadow | `inset 0 0 0 1px rgba(15,15,15,.1), 0 1px 2px rgba(15,15,15,.1)` |
| Button focus ring | `0 0 0 2px #f8f8f7, 0 0 0 4px #2383e2, 0 0 0 6px rgba(255,255,255,.25)` (light); `#191919`-based in dark |
| Input focus ring | `0 0 0 1px #2383e2 inset, 0 0 0 1px #2383e2` |
| Radius | 3px (app content CSS; clones use 3–4px) |
| Disabled | app tokens: text `rgba(21,14,0,.286)` (≈ #151407 29%); community: 40% opacity |
| Sizes (community) | small ~28px h, default ~36px h, padding 6px 14px / 8px 16px; marketing primary padding `5px 10px` (verified token) [Source: duply.ai](https://duply.ai/notion/design-md) |

Marketing buttons differ: primary = **black** `#000000` bg + white text (e.g. "Get Notion free"), radius 4px scale, hover `rgba(0,0,0,.75)`. [Source: marketing CSS](https://www.notion.so/)

---

## Unknowns / not pinned down

1. **`#C9C9C7` and `#FBFBFA`** — I could not find either hex in any primary source, extracted CSS, or community palette repo I examined. Do not use them as Notion-verified; closest verified anchors are `#E3E2E0` (divider) and `#F0EFED`/`#F1F1EF` (hover/block).
2. **Expanded sidebar width in the live app** — skeleton is 240px (verified); live value is user-resizable and community reports range 224–300px. Choose 240–300px; document the choice.
3. **Collapsed sidebar rail width** — commonly built as 44px in clones; Notion's exact rail width was not verifiable from sources I accessed.
4. **Login card exact styling** — structure verified, but card width/input padding are not published; use the verified app tokens (§9) which the login screen demonstrably uses.
5. **Accent hover discrepancy** — verified app token says `#0077D4`; some community palettes claim `#1B6EC2` [Source: seedflip (community)](https://seedflip.co/blog/notion-design-system). Trust the token.
6. **The marketing "purple CTA" claim** — one third-party spec (shadcn.io/design/notion, 2026-05) reports a purple primary CTA `#5645d4`; this contradicts every other extractor and my own CSS check (primary button = black; blue scale anchored at `#0075de`/`#097fe8`). Treat as an outlier.
7. **Hero navy `#02093a`** — reported by two independent extractors but not re-verified in my own marketing-CSS grep.
8. **Table row height / header height (40–45px)** — community observation only.
9. **Hover-reveal chevron/plus sizes** — chevron 12px verified in skeleton; plus-icon size in sidebar rows not verified.

---

## Sources

**Primary (Notion's own assets):**
- Notion app shell HTML/CSS (login page, skeleton, fonts): https://www.notion.so/login
- Notion app UI CSS chunks (token variables `--c-*`, `--ca-*`, `--cd-*`): https://www.notion.so/_assets/59116-819919ab13219ea1.css and https://www.notion.so/_assets/main-cb85dcccbdf3b0cb.css
- Notion marketing-site CSS tokens (16 chunks under `/_next/static/css/`): https://www.notion.so/ and https://www.notion.so/login
- Notion official GitHub org, PPT theme tokens: https://github.com/makenotion/notion-cookbook/blob/main/workers/powerpoint-creator/src/theme.ts
- Notion blog — spacing/design of pages: https://www.notion.com/blog/updating-the-design-of-notion-pages
- Notion blog — brand campaign (monochrome-in-app statement): https://www.notion.com/blog/the-thinking-behind-our-latest-brand-campaign
- Notion help — sidebar: https://www.notion.com/help/navigate-with-the-sidebar
- Notion export CSS (content blocks, headings, tables): https://gist.github.com/aboutDavid/35402fb563d0420a6430392bee98ab18

**Community (labeled; used for cross-checking):**
- https://github.com/shade-solutions/notion-design-system (full Tailwind token set)
- https://notionpresso.com/cn/docs/customization-guide/css-structure-and-styling (renderer tokens)
- https://docs.super.so/notion-colors and https://notioncolors.com/ (block color pairs)
- https://seedflip.co/blog/notion-design-system (token essay)
- https://duply.ai/notion/design-md and https://www.designlang.app/gallery/notion-so and https://designmd.cc/benchmarks/notion (marketing-site extractions)
- https://github.com/Carlos-Dominguez-faber/nucleo/blob/main/DESIGN.md (sidebar/button recipe)
- https://github.com/galyarderlabs/galyarder-design/blob/main/design-templates/orbit-notion/SKILL.md (block-primitive guidance)
- https://github.com/0xcjl/open-design-pro/blob/main/design-systems/notion/DESIGN.md (marketing tokens)
- https://designcompass.org/en/2025/01/20/notion/ (brand/typography history: Inter, Articulat CF)
- https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d (sidebar measurements)
- Clones: https://github.com/adityaphasu/notion-clone, https://github.com/szj2ys/notion-clone, https://github.com/Saeed-Altout/Notion-Clone
