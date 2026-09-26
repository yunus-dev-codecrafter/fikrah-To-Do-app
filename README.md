# Fikra To-Do

A modern, responsive daily To-Do List app with Arabic & English support, persistent task completion, and automatic daily reset at midnight.

Private by design — no account, no backend, no tracking. Tasks stay in your browser.

## Features

- **Modern Glassmorphic UI/UX**: Soft radiant ambient lighting, clean card elevation, crisp typography (`Plus Jakarta Sans` & `Amiri`).
- **Dark & Light Mode**: Instant theme switching with radiant warm sun (`☀️`) in dark mode and moon (`🌙`) in light mode, with single-active display.
- **Audio & Haptic Feedback**: Synthesized Web Audio cues on completion, unchecking, and celebration fanfare, with dedicated mute toggle (`🔊` / `🔇`).
- **Screen Stay-Awake (Wake Lock API)**: Keeps mobile and desktop screens awake while using the app or revising Qur'an (`🖥️`).
- **Collapsible Smart Reminders Card**: Minimalistic collapsible card with live permission status pill (`Turn on 🔔`, `Active ✓`, `Blocked ⚠`) and smooth accordion expansion.
- **Auto-Dismissing PWA Install Banner**: Disappears completely when the app is already installed or standalone, with no forced popups.
- **Confetti Celebration**: Canvas particle fireworks upon completing all daily tasks.
- **Dynamic Productivity Stats**: Real-time progress bar, percentage, greeting messages, and breakdown pills (Total, Active, Done).
- **Task Filters & Real-time Search**: Quick filter tabs (`All`, `Active`, `Completed`) and instant search input for today's tasks.
- **Category Tags**: Tag tasks with optional categories (`📖 Deen`, `💼 Work`, `📚 Study`, `🌱 Personal`, `General`).
- **Qur'an Revision Planner (604 Pages)**: Daily Mushaf revision tracker with quick presets (Juz 30, Juz 1, Al-Kahf, +10 pages), jump-to-page, mark all, and collapsible view.
- **Add tasks (button or `Enter`)**, edit inline, mark complete / unmark, delete
- **Empty-input guard, 500-char limit**, order preserved
- **Optional per-task reminder time** (native time picker, mobile-friendly)
- **Reminder notifications** via Notification API + persistent Service Worker notifications (EN/AR body)
- **Friendly permission flow**: reminders enabled only via "Enable Reminders", never on load; denied/unsupported states degrade gracefully
- **Reminder states**: upcoming / due / completed / overdue (overdue highlighted, completed never notifies)
- **Notification tap** opens/focuses the app at the relevant task (`?task=<id>` deep-link + highlight)
- **App icon badge count** where supported (Badging API, progressive enhancement)
- **Installable PWA**: `manifest.json`, `display: standalone`, icons 192/512 + maskable, offline-cached core files (`sw.js` cache v4)
- **Completion persists** across refresh / close / reopen
- **Daily reset at midnight**: calendar-bound, resets automatically past midnight without needing manual reload
- **Accessible & Mobile-First**: Semantic HTML, visible focus rings, keyboard shortcuts (`/` to focus task input, `Esc` to cancel), 44px+ touch targets
- **Secure rendering**: User text inserted safely via `textContent` only, never `innerHTML`

## Technologies

Only HTML, CSS, and vanilla JavaScript. Zero dependencies.

```
index.html  — semantic layout, form (+time input), install/reminder cards, summary, list
style.css   — mobile-first premium minimal theme (CSS variables)
script.js   — task ops, storage, date/reset logic, rendering, reminders, install, events
manifest.json — PWA name, icons, colors, display: standalone, start_url/scope
sw.js       — offline cache + notificationclick focus/deep-link
icons/      — icon.svg source, icon-192/512.png, maskable-512.png, apple-touch-icon, favicon
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

Key: `fikra-todo-v1` (same key as Phase One — old tasks migrate in place)

```json
{
  "date": "2026-09-26",
  "tasks": [
    { "id": "uuid", "text": "Study JavaScript", "date": "2026-09-26", "time": "19:00", "completed": false, "createdAt": 1727..., "order": 0, "reminderTriggered": false }
  ]
}
```

- `time`: `"HH:MM"` 24h or `null` (optional). `date`: owning calendar day. `reminderTriggered`: set once notified/completed so reminders never double-fire.
- Old entries without `time/date/reminderTriggered` are normalized on load (`time: null`, `date: <stored date>`), never dropped.
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

## PWA: install + offline

- `manifest.json`: `name "Fikra To-Do"`, `short_name "Fikra"`, `display: standalone`, `start_url/scope "./"`, `theme_color #0f766e`, `background_color #f4f5f4`, icons 192/512 (`any`) + 512 (`maskable`).
- Install card appears only when `beforeinstallprompt` fires and the app isn't already `display-mode: standalone` (or iOS `navigator.standalone`); `appinstalled` hides it permanently. Unsupported browsers get manual fallback text (menu ⋮ → Install app / Add to Home screen). The site always works as a normal website.
- `sw.js` caches core files (`index.html`, `style.css`, `script.js`, `manifest.json`, icons) cache-first, same-origin GET only; navigations fall back to cached `index.html` offline. Old caches purged on activate.
- Service worker requires `http://localhost` or HTTPS — use `npx serve .` / `python -m http.server 8000`, not `file://`.

## Reminders: how they work + honest limitation

- Each task may carry an optional `time` (`<input type="time">`). Scheduler checks on load, add/edit/toggle, every ~20s, and on `visibilitychange`/`focus`.
- When a task's `date === today`, `time <= now`, `!completed`, `!reminderTriggered` → mark triggered, persist, and show a **persistent Service Worker notification** (`registration.showNotification`, `tag: fikra-<id>`, `data.taskId`), with AR/EN body (`🔔 حان وقت: …` / `🔔 It's time: …`).
- Tapping the notification focuses/opens the app at `?task=<id>` with a highlight pulse. Badge count via `navigator.setAppBadge()` where supported.
- **Limitation (by design):** browsers do not guarantee exact background delivery at arbitrary times when the page/PWA is fully closed (no native alarm API on the web). Reminders are most reliable while the app or installed PWA is open or recently used. The in-app reliability note states this rather than promising native-grade scheduling.
- Midnight reset retires the whole day's list; per-task `date` binding guarantees yesterday's reminders never refire.

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

See Technologies above. Separation in `script.js`: date/time utils, storage + migration, task ops, rendering, reminders, install, events.

## Testing checklist (PWA + reminders)

- Install: manifest valid, icons load, install prompt shows once, installed launch is standalone, no repeat prompt when installed.
- Offline: airplane-mode reload renders list; installed app opens without internet.
- Notifications: grant → task due in 1 min notifies (EN + AR); completed never notifies; denied shows disabled state; unsupported degrades.
- Date: midnight rollover starts a fresh list; yesterday's reminders never fire; per-task dates stay bound.
- Responsive: small/large phones, tablet, laptop, desktop; no console errors.

## Future possibilities

Accounts, cloud sync, categories, recurring tasks, stats, multi-language UI toggle, custom themes / dark mode, premium features. Architecture (date-keyed state, CSS variables, `STRINGS`) keeps these easy without implementing them now.
