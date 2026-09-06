# Meldrift v1.2 Beta

Meldrift is a personal project for organizing ideas on a visual board.

## Concept

Ideas do not always begin in a clear order. Meldrift allows memos, images, tables, diagrams, and drawings to be placed freely before their contents are organized into a Markdown document.

![Meldrift screenshot1](screenshot/IMG_1161.jpeg)
![Meldrift screenshot2](screenshot/IMG_1162.jpeg)

## Features

- Create and manage multiple boards.
- Write rich text memo cards.
- Add image, Mermaid, and table cards.
- Move, resize, and change the layer order of cards.
- Draw with a mouse, touch input, or Apple Pencil.
- Search memos and navigate through them in order.
- [New] Reorder memos by dragging, which sets both the navigation sequence and the Markdown output order.
- Zoom and pan across the board.
- [New] Pinch to zoom on touch devices.
- Compile board contents into Markdown and download the result.
- Use an AI assistant to create, edit, delete, and arrange cards after reviewing its proposed changes.


## Structure

Meldrift is an npm workspace monorepo.

- `apps/free`: browser-storage edition served from `/`
- `apps/plus`: database-backed edition served from `/plus`
- `packages/core`: framework-free rules and schemas shared by both editions
- `packages/ui`: React components and hooks shared by both editions
- `packages/ai`: the assistant body shared by both editions

The Plus edition defines the primary feature set and documentation. The Free edition provides a lightweight version without external database or image-storage services. Whatever differs between the editions — image storage, board persistence, edition-specific assistant wording — stays inside each app.

## Development

Meldrift is currently under development.
