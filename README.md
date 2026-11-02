# Shopsmith Mark V Guide

A personal, interactive tutorial for a 2003 Shopsmith Mark V with the Planer and Belt Sander special-purpose tools.

**Live site:** https://sfc-gh-dfreriks.github.io/shopsmith-guide/

## What's in it

- **Step-by-step guide:** machine anatomy, the speed chart, the five modes (table saw, disc sander, horizontal boring, drill press, lathe), the planer and belt sander, and alignment and maintenance. Every step cites the Shopsmith manual page it came from, e.g. `[520S Owner's Manual p.23]`.
- **Saved checklists:** tick off steps as you go. Progress is stored in your browser.
- **Parts catalog:** search parts by name, part number, or what they look like.
- **Identify a part:** take a photo on your phone and get the matching catalog part, how to mount it, how to use it, and a link to the guide section.

## Photo identification

### Option 1: Snowflake Part ID app (recommended)

The site's **Identify** page links to a Streamlit in Snowflake app. You sign in with Snowflake, take a photo, and Cortex `AI_COMPLETE` (model `claude-sonnet-4-5`) matches it against the catalog in `SHOPSMITH_GUIDE.APP.PARTS`. Photos are stored on an encrypted stage. No API key is needed.

- App code: `streamlit/streamlit_app.py`
- Snowflake setup: `streamlit/setup.sql`
- If you change `data/parts.json`, reload the `PARTS` table (see `setup.sql`).

### Option 2: your own AI key

The page can also call an AI provider straight from your browser with **your own API key**.

1. Open **Settings** on the site.
2. Pick Anthropic (Claude), OpenAI, or Google Gemini, then paste an API key.
3. The key is stored only in that browser's localStorage. It is never committed or sent anywhere except the provider you picked.

Set a spending limit on the key. Each identification is one image request.

On a phone, use your browser's "Add to Home Screen" to open it like an app.

## Editing

| What | Where |
|---|---|
| Guide pages | `content/*.md` (Markdown; `- [ ]` lines become saved checkboxes) |
| Section order/names | `content/sections.json` |
| Parts catalog (also the AI's grounding list) | `data/parts.json` |
| App logic / styles | `assets/app.js`, `assets/style.css` |

To preview locally, run `python3 -m http.server` in this folder, then open the printed URL.

## Source manuals

The guide summarizes Shopsmith owner's manuals and reference guides. The manuals themselves are Shopsmith's copyrighted material, so they are **not** in this repo; the `docs/` folder is git-ignored. Get official manuals from Shopsmith. Always follow your manual and the safety labels on your machine.
