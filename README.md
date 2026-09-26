# Fikra To-Do

A modern, responsive daily To-Do List app with Arabic & English support, persistent task completion, and automatic daily reset at midnight.

Private by design — no account, no backend, no tracking. Tasks stay in your browser.

## Features

- Add tasks (button or `Enter`), edit inline, mark complete / unmark, delete
- Empty-input guard, 500-char limit, order preserved
- Completion persists across refresh / close / reopen
- Daily summary: `X of Y tasks completed` + progress bar + subtle all-done state
- Empty-state message when no tasks
- Accessible: semantic HTML, labels, keyboard (Enter to save, Esc to cancel edit), visible focus, 44px touch targets, completion not color-only (✓ + strikethrough)
- Mobile-first responsive: phones → tablets → desktop, no horizontal scroll, Arabic wraps safely
- Secure rendering: user text inserted via `textContent` only, never `innerHTML`

## Technologies

Only HTML, CSS, and vanilla JavaScript. Zero dependencies.

```
index.html  — semantic layout, form, summary, list
style.css   — mobile-first premium minimal theme (CSS variables)
script.js   — task ops, storage, date/reset logic, rendering, events
```

## How the daily reset works

The app is bound to the user's **local calendar day**, not a 24-hour timer.

- Date key: `getLocalDateKey(new Date())` → `"2026-09-26"` (local year/month/day).
- On load: if `stored.date !== today`, the old day's list is retired and a fresh `{ date: today, tasks: [] }` begins.
- While open past midnight: a 30s `setInterval` + `visibilitychange` + `window.focus` re-checks the date and re-renders automatically — no manual refresh needed.
- Refreshing on the same day never resets; completion state is preserved.

To test without waiting for midnight, set in DevTools Console before reload:

```js
localStorage.setItem('fikra-todo-v1', JSON.stringify({ date: '2000-01-01', tasks: [] }));
```

or simulate another day at runtime:

```js
window.__fikraDateOverride = '2099-01-01'; // then trigger focus/reload
```

## How localStorage is used

Key: `fikra-todo-v1`

```json
{
  "date": "2026-09-26",
  "tasks": [
    { "id": "uuid", "text": "حفظ سورة البقرة", "completed": false, "createdAt": 1727..., "order": 0 }
  ]
}
```

- Graceful on corrupted JSON, missing fields, or malformed entries (drops bad items, never crashes).
- If storage is unavailable/quota-exceeded, falls back to in-memory with a non-blocking warning.
- No unnecessary data stored; no external transmission.

## Arabic / English support

- UI default is LTR English; every task input and task text uses `dir="auto"` so English, Arabic (`حفظ سورة البقرة`), mixed (`قراءة 10 صفحات من الكتاب`), emojis, and Arabic punctuation render with correct direction.
- System font stack includes Arabic-safe fonts; `overflow-wrap: anywhere` prevents clipping on small screens.
- All UI strings centralized in `STRINGS` in `script.js` for future localization.

Example tasks:

- `Read Qur'an`
- `حفظ سورة البقرة`
- `Learn JavaScript`
- `قراءة 10 صفحات من الكتاب 📚`

## How to run locally

No build step. Either:

1. Double-click `index.html`, or
2. Serve (recommended for consistent behavior):
   ```powershell
   npx serve .
   # or
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` (or `:3000`).

## Project structure

See Technologies above. Separation in `script.js`: date utils, storage, task ops, rendering, events.

## Future possibilities

Accounts, cloud sync, categories, reminders, recurring tasks, stats, multi-language UI toggle, custom themes / dark mode, premium features. Architecture (date-keyed state, CSS variables, `STRINGS`) keeps these easy without implementing them now.
