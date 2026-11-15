# Keyboard Shortcuts

All available keyboard shortcuts in **Meldrift Free Edition** are listed below.

> Single-key canvas shortcuts (`1`, `2`, `m`, `i`, `t`, `d`) are active only when no card editor, text input, menu, or modal dialog is focused.

## Global & Dialogs

| Shortcut | Action | Notes |
| --- | --- | --- |
| `Ctrl + Shift + P` / `Cmd + Shift + P` | Open Help modal | Works globally, including while editing a memo |
| `Esc` | Close active dialog or menu | Closes Help, About, Markdown Preview, or Help quick actions |

## Canvas Modes & Card Creation

| Key | Action | Notes |
| --- | --- | --- |
| `1` | Toggle Selection mode | Press again to return to Panning mode |
| `2` | Toggle Freehand Drawing mode | Press again to return to Panning mode |
| `m` | Create a Memo card | Disabled while drawing or multi-selecting |
| `i` | Open Image upload picker | Disabled while drawing or multi-selecting |
| `t` | Create a Table card | Disabled while drawing or multi-selecting |
| `d` | Create a Mermaid diagram card | Disabled while drawing or multi-selecting |

## Memo Markdown Editor

Active when editing inside a Memo card.

### Inline Formatting

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Bold | `Cmd + B` | `Ctrl + B` |
| Italic | `Cmd + I` | `Ctrl + I` |
| Underline | `Cmd + U` | `Ctrl + U` |
| Insert / Edit Link | `Cmd + K` | `Ctrl + K` |
| Highlight | `Cmd + Shift + H` | `Ctrl + Shift + H` |
| Inline Code | ``Cmd + Shift + ` `` or ``Ctrl + ` `` | ``Ctrl + Shift + ` `` |
| Strikethrough | ``Ctrl + Shift + ` `` | `Alt + Shift + 5` |
| Clear Formatting | `Cmd + \` | `Ctrl + \` |
| Undo (Editor) | `Cmd + Z` | `Ctrl + Z` |

### Headings, Lists & Blocks

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Heading 1 – 6 | `Ctrl + 1`..`6` or `Cmd + Option + 1`..`6` | `Ctrl + Alt + 1`..`6` |
| Paragraph | `Ctrl + 0` or `Cmd + Option + 0` | `Ctrl + Alt + 0` |
| Increase / Decrease Heading | `Cmd + =` / `Cmd + -` | `Ctrl + =` / `Ctrl + -` |
| Blockquote | `Cmd + Option + Q` | `Ctrl + Shift + Q` |
| Code Block | `Cmd + Option + C` | `Ctrl + Shift + K` |
| Ordered List | `Cmd + Option + O` | `Ctrl + Shift + [` |
| Bullet List | `Cmd + Option + U` | `Ctrl + Shift + ]` |
| Task List | `Cmd + Option + X` | `Ctrl + Shift + X` |
| Horizontal Rule | `Cmd + Option + -` | `Ctrl + Shift + -` |
| Indent / Outdent List | `Tab` / `Shift + Tab` (`Cmd + ]` / `[`) | `Tab` / `Shift + Tab` (`Ctrl + ]` / `[`) |
| Soft Line Break | `Shift + Enter` | `Shift + Enter` |
| Exit Quote / Code / Delimiter | `Esc` | `Esc` |

## Table Card Grid

Active when editing a Table card.

| Shortcut | Action |
| --- | --- |
| `Arrow Keys` | Move focus across cells (`Cmd/Ctrl` jumps to edge, `Shift` extends range) |
| `Tab` / `Shift + Tab` | Move to next / previous cell (commits current cell edit) |
| `Home` / `End` | Jump to start / end of row (`Cmd/Ctrl` jumps to first / last cell) |
| `Enter` or `F2` | Edit focused cell; `Enter` commits edit and moves down |
| `Alt + Enter` | Insert newline inside a table cell |
| `Esc` | Cancel cell edit or collapse selection |
| `Delete` / `Backspace` | Clear selected cells |
| `Cmd + A` / `Ctrl + A` | Select all cells |
| `Cmd/Ctrl + C` / `X` / `V` | Copy, cut, and paste cells (TSV format) |
