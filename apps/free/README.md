# Meldrift Free Edition

Meldrift Free Edition is the local, single-board edition of Meldrift, a personal project for organizing ideas on a visual board.

## Concept

Ideas do not always begin in a clear order. Meldrift allows memos, images, tables, diagrams, and drawings to be placed freely before their contents are organized into a Markdown document.

![Meldrift screenshot 1](https://github.com/Kim-kyuho/Meldrift/blob/main/public/IMG_1161.jpeg)
![Meldrift screenshot 2](https://github.com/Kim-kyuho/Meldrift/blob/main/public/IMG_1162.jpeg)

## Features

- Open a single board directly without an account or board list.
- Write rich-text memo cards.
- Add local image, Mermaid, and table cards.
- Move, resize, and change the layer order of cards.
- Draw on the board with a mouse, touch input, or Apple Pencil.
- Search memos and navigate through them in order.
- Zoom and pan across the board.
- Compile board contents into Markdown, preview local images from browser storage, and download one ZIP containing the Markdown file and referenced PNG images.
- Store the board and compressed image data in a browser-local SQLite file.
- Export and import the complete board as a portable `meldrift-free.sqlite` file.
- Use an optional AI assistant to create, edit, delete, and arrange cards after reviewing its proposed changes.
- Reset only Meldrift Free Edition data without clearing unrelated browser storage.

## Free Edition

This edition does not use sign-in, a board list, a server database, or cloud file storage. The board opens immediately and its SQLite file is stored in the current browser profile and site origin through IndexedDB.

Data is not synchronized across browsers, devices, localhost, or deployed domains. Export the board before clearing site data or moving to another environment, then use Import to restore it.

The multi-board edition is available in the [Meldrift Plus repository](https://github.com/Kim-kyuho/Meldrift-plus).

## Run locally

Requires Node.js 20 or newer and a current browser with WebAssembly, Web Workers, and IndexedDB.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The browser creates its private SQLite database on first use.

## AI assistant

The optional assistant can create memo, table, and Mermaid cards and propose changes to cards already on the board. Nothing is saved until the proposal is accepted. It does not generate images; image cards use files selected from the local device.

The assistant remains disabled unless both server environment variables are configured:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_API_KEY` | yes | Google Gemini API key |
| `AI_PASSWORD` | yes | Password that unlocks the assistant |
| `GEMINI_MODEL` | no | Pins the chat model; the built-in list remains as fallback |

For local development, copy the example file and fill it in:

```bash
cp .env.example .env.local
```

## Deploy to Vercel

Use the Next.js framework preset and the repository root as the Root Directory. No database or storage environment variable is required. Add `AI_API_KEY` and `AI_PASSWORD` only when enabling the assistant.

```bash
vercel --prod
```

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Meldrift Free Edition is currently under development.
