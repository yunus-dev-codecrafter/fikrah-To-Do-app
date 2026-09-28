/* Fikra To-Do — Modern Redesign (2026 UI/UX)
   Sections:
   1. Constants & Strings
   2. Theme & Audio Engines
   3. Confetti Celebration
   4. Date & Time Utils
   5. Storage & State Management
   6. Task & Quran Operations
   7. Rendering (Tasks, Summary, Quran, Filters)
   8. Reminders & PWA Install
   9. Events & Keybindings
   10. Initialization & Test Seams
*/
(function () {
  "use strict";

  var STORAGE_KEY = "fikra-todo-v1";
  var INSTALL_SEEN_KEY = "fikra-pwa-install-dismissed";
  var THEME_KEY = "fikra-theme";
  var SOUND_KEY = "fikra-sound";
  var QURAN_COLLAPSED_KEY = "fikra-quran-collapsed";
  var MAX_TEXT_LENGTH = 500;
  var ROLLOVER_CHECK_MS = 30000;
  var REMINDER_CHECK_MS = 20000;
  var QURAN_MIN = 1;
  var QURAN_MAX = 604;

  // Centralized UI strings
  var STRINGS = {
    emptyTaskError: "Please type a task before adding.",
    invalidTimeError: "That time doesn't look valid — pick a time or leave it empty.",
    storageUnavailable: "Browser storage is unavailable — tasks will work for this session only.",
    summaryNone: "0 of 0 tasks completed",
    loadDateFallback: "Today",
    reminderOn: "Reminders active — you'll be notified at each task's time.",
    reminderOff: "Enable notifications to get reminded at each task's time.",
    reminderDenied: "Notifications blocked. Re-enable in site settings then try again.",
    reminderUnsupported: "This browser doesn't support notifications — tasks work normally.",
    reminderGranted: "Reminders enabled ✓",
    notifDuePrefixEn: "🔔 It's time:",
    notifDuePrefixAr: "🔔 حان وقت:",
    appName: "Fikra To-Do",
    quranEmptyError: "Enter a start and end page (1–604).",
    quranRangeError: "Pages must be between 1 and 604, with start ≤ end.",
    quranReplaceConfirm: "Replace today's revision plan? Completed pages for today will be cleared.",
    quranCompleteMsg: "Mā shā’ Allāh! Today's revision is complete 🌿",
    quranJumpError: "Enter a page number within today's plan to jump to it.",
    clearCompletedConfirm: "Clear all completed tasks from today's list?",
    quranMarkAllConfirm: "Mark all pages in today's revision as completed?",
    quranResetAllConfirm: "Reset completion for all pages in today's revision?"
  };

  // ---------- DOM Elements ----------
  var dateEl = document.getElementById("current-date");
  var formEl = document.getElementById("task-form");
  var inputEl = document.getElementById("task-input");
  var timeEl = document.getElementById("task-time");
  var durationEl = document.getElementById("task-duration");
  var errorEl = document.getElementById("form-error");
  var listEl = document.getElementById("task-list");
  var emptyStateEl = document.getElementById("empty-state");
  var summaryTextEl = document.getElementById("summary-text");
  var summaryPctEl = document.getElementById("summary-pct");
  var progressBarEl = document.getElementById("progress-bar");
  var progressFillEl = document.getElementById("progress-fill");
  var celebrationEl = document.getElementById("celebration");
  var storageWarningEl = document.getElementById("storage-warning");
  var installSectionEl = document.getElementById("pwa-install");
  var installBtn = document.getElementById("install-btn");
  var installDismissBtn = document.getElementById("install-dismiss");
  var installFallbackEl = document.getElementById("install-fallback");
  var reminderBtn = document.getElementById("reminder-btn");
  var reminderStatusEl = document.getElementById("reminder-status");
  var reminderCardEl = document.getElementById("reminder-card");
  var reminderToggleBar = document.getElementById("reminder-toggle-bar");
  var reminderCollapseBtn = document.getElementById("reminder-collapse-btn");
  var reminderPillStatus = document.getElementById("reminder-pill-status");
  var quranSectionEl = document.getElementById("quran-section");
  var quranFormEl = document.getElementById("quran-form");
  var quranStartEl = document.getElementById("quran-start");
  var quranEndEl = document.getElementById("quran-end");
  var quranErrorEl = document.getElementById("quran-error");
  var quranActiveEl = document.getElementById("quran-active");
  var quranRangeEl = document.getElementById("quran-range-label");
  var quranProgressLabelEl = document.getElementById("quran-progress-label");
  var quranProgressBarEl = document.getElementById("quran-progress-bar");
  var quranProgressFillEl = document.getElementById("quran-progress-fill");
  var quranGridEl = document.getElementById("quran-grid");
  var quranCompleteEl = document.getElementById("quran-complete");
  var quranClearBtn = document.getElementById("quran-clear");
  var quranJumpEl = document.getElementById("quran-jump");
  var quranJumpBtn = document.getElementById("quran-jump-btn");
  var quranCollapseBtn = document.getElementById("quran-collapse-btn");
  var quranToggleHeaderBtn = document.getElementById("quran-toggle-btn");
  var quranMarkAllBtn = document.getElementById("quran-mark-all-btn");
  var quranResetAllBtn = document.getElementById("quran-reset-all-btn");
  var themeToggleBtn = document.getElementById("theme-toggle");
  var soundToggleBtn = document.getElementById("sound-toggle");
  var wakelockToggleBtn = document.getElementById("wakelock-toggle");
  var greetingTextEl = document.getElementById("greeting-text");
  var statTotalEl = document.getElementById("stat-total-count");
  var statActiveEl = document.getElementById("stat-active-count");
  var statDoneEl = document.getElementById("stat-done-count");
  var taskCountBadgeEl = document.getElementById("task-count-badge");
  var filterTabsEl = document.querySelector(".filter-tabs");
  var searchBarWrapEl = document.getElementById("search-bar-wrap");
  var searchInputEl = document.getElementById("task-search-input");
  var searchClearBtn = document.getElementById("task-search-clear");
  var listFooterActionsEl = document.getElementById("list-footer-actions");
  var clearCompletedBtn = document.getElementById("clear-completed-btn");
  var composerCharCountEl = document.getElementById("composer-char-count");
  var categoryPillsContainer = document.querySelector(".category-pills-row");
  var recurringToggleBtn = document.getElementById("recurring-toggle-btn");
  var isRecurringActive = false;
  var DAILY_PLANNING_KEY = "fikra-daily-planning-prompts";

  // Filter & Search active state
  var currentFilter = "all"; // 'all' | 'active' | 'completed' | 'daily'
  var searchQuery = "";
  var selectedCategory = "";

  // ---------- Theme Management ----------
  var currentTheme = "system";
  try {
    currentTheme = window.localStorage.getItem(THEME_KEY) || "system";
  } catch (e) { currentTheme = "system"; }

  function applyTheme(theme) {
    currentTheme = theme;
    var html = document.documentElement;
    if (theme === "system") {
      var isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      html.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      html.setAttribute("data-theme", theme);
    }
    updateThemeIcon();
    try { window.localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function updateThemeIcon() {
    if (!themeToggleBtn) return;
    var html = document.documentElement;
    var activeTheme = html.getAttribute("data-theme");
    var sun = themeToggleBtn.querySelector(".icon-sun");
    var moon = themeToggleBtn.querySelector(".icon-moon");
    if (sun) sun.removeAttribute("hidden");
    if (moon) moon.removeAttribute("hidden");
    if (activeTheme === "dark") {
      themeToggleBtn.setAttribute("aria-label", "Switch to light theme");
      themeToggleBtn.title = "Current: Dark theme (click for Light)";
    } else {
      themeToggleBtn.setAttribute("aria-label", "Switch to dark theme");
      themeToggleBtn.title = "Current: Light theme (click for Dark)";
    }
  }

  function cycleTheme() {
    var html = document.documentElement;
    var currentActive = html.getAttribute("data-theme");
    if (currentActive === "dark") {
      applyTheme("light");
    } else {
      applyTheme("dark");
    }
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (currentTheme === "system") applyTheme("system");
    });
  }

  // ---------- Synthesized Web Audio Engine (0 dependencies) ----------
  var soundEnabled = true;
  try {
    var storedSound = window.localStorage.getItem(SOUND_KEY);
    if (storedSound !== null) soundEnabled = storedSound === "1";
  } catch (e) { soundEnabled = true; }

  var audioCtx = null;
  function getAudioContext() {
    if (typeof window === "undefined") return null;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioCtx) {
      try { audioCtx = new AudioContext(); } catch (e) { return null; }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playCheckSound() {
    if (!soundEnabled) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  function playUncheckSound() {
    if (!soundEnabled) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.1); // E4
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) {}
  }

  function playCelebrationFanfare() {
    if (!soundEnabled) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      var notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach(function (freq, i) {
        var start = now + (i * 0.08);
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch (e) {}
  }

  function updateSoundIcon() {
    if (!soundToggleBtn) return;
    soundToggleBtn.setAttribute("data-sound", soundEnabled ? "on" : "off");
    var onIcon = soundToggleBtn.querySelector(".icon-sound-on");
    var offIcon = soundToggleBtn.querySelector(".icon-sound-off");
    if (onIcon) onIcon.removeAttribute("hidden");
    if (offIcon) offIcon.removeAttribute("hidden");
    if (soundEnabled) {
      soundToggleBtn.title = "Sound: ON (click to mute)";
      soundToggleBtn.setAttribute("aria-label", "Mute audio");
    } else {
      soundToggleBtn.title = "Sound: MUTED (click to enable)";
      soundToggleBtn.setAttribute("aria-label", "Unmute audio");
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { window.localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0"); } catch (e) {}
    updateSoundIcon();
    if (soundEnabled) playCheckSound();
  }

  // ---------- Screen Wake Lock API (Keep mobile screen awake) ----------
  var WAKELOCK_KEY = "fikra-wakelock";
  var wakeLockSentinel = null;
  var wakeLockEnabled = true;
  try {
    var storedWake = window.localStorage.getItem(WAKELOCK_KEY);
    if (storedWake !== null) wakeLockEnabled = storedWake === "1";
  } catch (e) { wakeLockEnabled = true; }

  function wakeLockSupported() {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
  }

  function updateWakeLockUI() {
    if (!wakelockToggleBtn) return;
    wakelockToggleBtn.setAttribute("data-wakelock", wakeLockEnabled ? "on" : "off");
    var onIcon = wakelockToggleBtn.querySelector(".icon-wakelock-on");
    var offIcon = wakelockToggleBtn.querySelector(".icon-wakelock-off");
    if (onIcon) onIcon.removeAttribute("hidden");
    if (offIcon) offIcon.removeAttribute("hidden");
    if (wakeLockEnabled) {
      wakelockToggleBtn.title = wakeLockSupported()
        ? "Screen Stay-Awake: ON (Screen won't turn off while app is open)"
        : "Screen Stay-Awake: ON";
      wakelockToggleBtn.setAttribute("aria-label", "Turn off screen stay-awake");
    } else {
      wakelockToggleBtn.title = "Screen Stay-Awake: OFF (Screen will turn off normally)";
      wakelockToggleBtn.setAttribute("aria-label", "Turn on screen stay-awake");
    }
  }

  function requestWakeLock() {
    if (!wakeLockEnabled || !wakeLockSupported()) {
      updateWakeLockUI();
      return;
    }
    try {
      if (wakeLockSentinel && !wakeLockSentinel.released) return;
      navigator.wakeLock.request("screen").then(function (sentinel) {
        wakeLockSentinel = sentinel;
        sentinel.addEventListener("release", function () {
          wakeLockSentinel = null;
          updateWakeLockUI();
        });
        updateWakeLockUI();
      }).catch(function () {
        updateWakeLockUI();
      });
    } catch (e) {
      updateWakeLockUI();
    }
  }

  function releaseWakeLock() {
    if (wakeLockSentinel) {
      try { wakeLockSentinel.release(); } catch (e) {}
      wakeLockSentinel = null;
    }
    updateWakeLockUI();
  }

  function toggleWakeLock() {
    wakeLockEnabled = !wakeLockEnabled;
    try { window.localStorage.setItem(WAKELOCK_KEY, wakeLockEnabled ? "1" : "0"); } catch (e) {}
    if (wakeLockEnabled) {
      requestWakeLock();
      playCheckSound();
    } else {
      releaseWakeLock();
      playUncheckSound();
    }
    updateWakeLockUI();
  }

  // ---------- Confetti Celebration (Pure Canvas, 0 dependencies) ----------
  var confettiActive = false;
  function triggerConfetti() {
    var canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var width = canvas.width = window.innerWidth;
    var height = canvas.height = window.innerHeight;
    var particles = [];
    var colors = ["#0f766e", "#14b8a6", "#34d399", "#f59e0b", "#0ea5e9", "#f43f5e", "#a855f7"];
    var count = 65;

    for (var i = 0; i < count; i++) {
      particles.push({
        x: width * (0.3 + Math.random() * 0.4),
        y: height * 0.4,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    confettiActive = true;
    var startTime = Date.now();
    function animate() {
      if (!confettiActive) return;
      var elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, width, height);
      var alive = false;

      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98; // drag
        p.rotation += p.rSpeed;
        if (elapsed > 1200) {
          p.opacity -= 0.02;
        }
        if (p.opacity > 0 && p.y < height + 20) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive && elapsed < 3500) {
        requestAnimationFrame(animate);
      } else {
        confettiActive = false;
        ctx.clearRect(0, 0, width, height);
      }
    }
    requestAnimationFrame(animate);
  }

  // ---------- Date Utils ----------
  function getLocalDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function todayKey() {
    if (typeof window !== "undefined" && typeof window.__fikraDateOverride === "string" && window.__fikraDateOverride) {
      return window.__fikraDateOverride;
    }
    return getLocalDateKey(new Date());
  }

  function formatDisplayDate(now) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(now);
    } catch (e) {
      return STRINGS.loadDateFallback;
    }
  }

  // ---------- Time Utils ----------
  var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  function isValidTime(v) {
    return typeof v === "string" && TIME_RE.test(v);
  }
  function normalizeTime(v) {
    if (v === null || v === undefined || v === "") return null;
    return isValidTime(v) ? v : null;
  }
  function minutesOf(hhmm) {
    var p = hhmm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function nowMinutes(now) {
    return now.getHours() * 60 + now.getMinutes();
  }
  function containsArabic(s) {
    return /[\u0600-\u06FF]/.test(s || "");
  }
  function formatTime12(hhmm) {
    if (!isValidTime(hhmm)) return "";
    var h = parseInt(hhmm.slice(0, 2), 10);
    var m = hhmm.slice(3, 5);
    var suffix = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + suffix;
  }

  function parseDuration(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = parseInt(v, 10);
    return (Number.isInteger(n) && n > 0) ? n : null;
  }

  function formatDuration(mins) {
    if (!mins || mins <= 0) return "";
    if (mins < 60) return mins + "m";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (m === 30) return (h + 0.5) + "h";
    return m > 0 ? h + "h " + m + "m" : h + "h";
  }

  function minutesToHhmm(m) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60);
    var min = m % 60;
    return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
  }

  // ---------- Storage & State ----------
  var memoryFallback = null;
  var storageOK = true;

  function isValidTask(t) {
    if (!t || typeof t.id !== "string" || typeof t.text !== "string" ||
        typeof t.completed !== "boolean" || typeof t.createdAt !== "number" ||
        typeof t.order !== "number") {
      return false;
    }
    if (t.time !== undefined && t.time !== null && !isValidTime(t.time)) return false;
    if (t.date !== undefined && typeof t.date !== "string") return false;
    if (t.reminderTriggered !== undefined && typeof t.reminderTriggered !== "boolean") return false;
    if (t.recurring !== undefined && typeof t.recurring !== "boolean") return false;
    if (t.duration !== undefined && t.duration !== null && (!Number.isInteger(t.duration) || t.duration < 0)) return false;
    return true;
  }

  function blankState(dateKey) {
    return { date: dateKey, tasks: [], quran: null };
  }

  function isValidQuranPlan(q) {
    if (!q || typeof q !== "object") return false;
    if (typeof q.date !== "string" || !q.date) return false;
    if (!Number.isInteger(q.startPage) || !Number.isInteger(q.endPage)) return false;
    if (q.startPage < QURAN_MIN || q.endPage > QURAN_MAX) return false;
    if (q.startPage > q.endPage) return false;
    if (!Array.isArray(q.completed)) return false;
    if (typeof q.createdAt !== "number") return false;
    return true;
  }

  function sanitizeQuranPlan(q, dateKey) {
    if (!isValidQuranPlan(q)) return null;
    if (q.date !== dateKey) return null;
    var seen = {};
    var clean = [];
    for (var i = 0; i < q.completed.length; i++) {
      var p = q.completed[i];
      if (Number.isInteger(p) && p >= q.startPage && p <= q.endPage && !seen[p]) {
        seen[p] = true;
        clean.push(p);
      }
    }
    clean.sort(function (a, b) { return a - b; });
    return {
      date: q.date,
      startPage: q.startPage,
      endPage: q.endPage,
      completed: clean,
      createdAt: q.createdAt
    };
  }

  function loadState() {
    var key = todayKey();
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageOK = false;
      return blankState(key);
    }
    if (!raw) return blankState(key);
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.date !== "string" || !Array.isArray(parsed.tasks)) {
        return blankState(key);
      }
      var clean = parsed.tasks.filter(isValidTask).map(function (t) {
        return {
          id: t.id,
          text: t.text.slice(0, MAX_TEXT_LENGTH),
          date: (typeof t.date === "string" && t.date) || parsed.date || key,
          time: normalizeTime(t.time === undefined ? null : t.time),
          category: typeof t.category === "string" ? t.category : "",
          completed: t.completed,
          createdAt: t.createdAt,
          order: t.order,
          reminderTriggered: t.reminderTriggered === true,
          recurring: t.recurring === true,
          duration: (Number.isInteger(t.duration) && t.duration > 0) ? t.duration : null
        };
      });
      clean.sort(function (a, b) { return a.order - b.order; });
      var quran = sanitizeQuranPlan(parsed.quran === undefined ? null : parsed.quran, parsed.date);
      if (parsed.date !== key) {
        if (quran && quran.date !== parsed.date) quran = null;
        return { date: parsed.date, tasks: clean, quran: quran };
      }
      return { date: parsed.date, tasks: clean, quran: quran };
    } catch (e) {
      return blankState(key);
    }
  }

  function saveState(state) {
    if (memoryFallback !== null) {
      memoryFallback = state;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      storageOK = false;
      memoryFallback = state;
      showStorageWarning();
    }
  }

  function showStorageWarning() {
    if (!storageWarningEl) return;
    storageWarningEl.textContent = STRINGS.storageUnavailable;
    storageWarningEl.hidden = false;
  }

  var state = loadState();

  function ensureTodayFresh() {
    var key = todayKey();
    if (state.date !== key) {
      // Carry forward fixed daily recurring tasks into the new day
      var recurringTasks = state.tasks.filter(function (t) {
        return t.recurring === true;
      }).map(function (t, idx) {
        return {
          id: t.id,
          text: t.text,
          date: key,
          time: t.time,
          category: t.category,
          completed: false, // Reset completed status for fresh new day
          createdAt: t.createdAt,
          order: idx,
          reminderTriggered: false, // Re-armed for today's reminder
          recurring: true,
          duration: (Number.isInteger(t.duration) && t.duration > 0) ? t.duration : null
        };
      });

      state = {
        date: key,
        tasks: recurringTasks,
        quran: null
      };
      saveState(state);
      renderAll();
      return true;
    }
    return false;
  }

  function makeId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function nextOrder() {
    if (state.tasks.length === 0) return 0;
    var max = state.tasks[0].order;
    for (var i = 1; i < state.tasks.length; i++) {
      if (state.tasks[i].order > max) max = state.tasks[i].order;
    }
    return max + 1;
  }

  // ---------- Task Operations ----------
  function addTask(rawText, rawTime, rawCategory, isRecurring, rawDuration) {
    var text = (rawText || "").trim();
    if (!text) return { ok: false, error: STRINGS.emptyTaskError };
    var time = normalizeTime(rawTime === undefined ? (timeEl && timeEl.value ? timeEl.value : null) : rawTime);
    if (rawTime !== undefined && rawTime !== null && rawTime !== "" && time === null) {
      return { ok: false, error: STRINGS.invalidTimeError };
    }
    if (rawTime === undefined && timeEl && timeEl.value && !isValidTime(timeEl.value)) {
      return { ok: false, error: STRINGS.invalidTimeError };
    }
    text = text.slice(0, MAX_TEXT_LENGTH);
    var category = typeof rawCategory === "string" ? rawCategory : selectedCategory;
    var recurring = isRecurring !== undefined ? isRecurring === true : isRecurringActive;
    var duration = parseDuration(rawDuration === undefined ? (durationEl && durationEl.value ? durationEl.value : null) : rawDuration);

    state.tasks.push({
      id: makeId(),
      text: text,
      date: todayKey(),
      time: time,
      duration: duration,
      category: category,
      completed: false,
      createdAt: Date.now(),
      order: nextOrder(),
      reminderTriggered: false,
      recurring: recurring
    });
    saveState(state);
    renderTasks();
    renderSummary();
    checkDueReminders(new Date());
    return { ok: true };
  }

  function toggleTask(id) {
    var t = findTask(id);
    if (!t) return;
    t.completed = !t.completed;
    if (t.completed) {
      t.reminderTriggered = true;
      playCheckSound();
    } else {
      playUncheckSound();
      if (t.time && t.date === todayKey()) {
        try {
          var mins = minutesOf(t.time);
          if (nowMinutes(new Date()) < mins) t.reminderTriggered = false;
        } catch (e) {}
      }
    }
    saveState(state);
    renderTasks();
    renderSummary();
    checkDueReminders(new Date());
  }

  function toggleTaskRecurring(id) {
    var t = findTask(id);
    if (!t) return;
    t.recurring = !t.recurring;
    saveState(state);
    renderTasks();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    saveState(state);
    renderTasks();
    renderSummary();
    if (inputEl) inputEl.focus({ preventScroll: true });
  }

  function commitEdit(id, rawText, rawTime, rawCategory, rawRecurring, rawDuration) {
    var t = findTask(id);
    if (!t) return { ok: false };
    var text = (rawText || "").trim();
    if (!text) return { ok: false, error: STRINGS.emptyTaskError };

    var time = normalizeTime(rawTime === undefined ? t.time : rawTime);
    if (rawTime !== undefined && rawTime !== null && rawTime !== "" && time === null) {
      return { ok: false, error: STRINGS.invalidTimeError };
    }

    t.text = text.slice(0, MAX_TEXT_LENGTH);
    t.time = time;
    if (rawCategory !== undefined) {
      t.category = typeof rawCategory === "string" ? rawCategory : "";
    }
    if (rawRecurring !== undefined) {
      t.recurring = !!rawRecurring;
    }
    if (rawDuration !== undefined) {
      t.duration = parseDuration(rawDuration);
    }

    // If scheduled time was changed or updated for today, re-evaluate reminder status
    if (t.time && !t.completed && t.date === todayKey()) {
      try {
        var mins = minutesOf(t.time);
        if (nowMinutes(new Date()) < mins) {
          t.reminderTriggered = false;
        }
      } catch (e) {}
    }

    saveState(state);
    renderTasks();
    renderSummary();
    checkDueReminders(new Date());
    return { ok: true };
  }

  function clearCompletedTasks() {
    var hasCompleted = state.tasks.some(function (t) { return t.completed; });
    if (!hasCompleted) return;
    if (!window.confirm(STRINGS.clearCompletedConfirm)) return;
    // Clear completed one-off tasks while preserving fixed daily recurring tasks
    state.tasks = state.tasks.filter(function (t) { return !t.completed || t.recurring; });
    saveState(state);
    renderTasks();
    renderSummary();
  }

  function findTask(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === id) return state.tasks[i];
    }
    return null;
  }

  // ---------- Qur'an Operations ----------
  function parseQuranInput(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
         .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function validateQuranRange(startRaw, endRaw) {
    var start = parseQuranInput(startRaw);
    var end = parseQuranInput(endRaw);
    if (start === null || end === null) {
      return { ok: false, error: STRINGS.quranEmptyError };
    }
    if (start < QURAN_MIN || end < QURAN_MIN || start > QURAN_MAX || end > QURAN_MAX || start > end) {
      return { ok: false, error: STRINGS.quranRangeError };
    }
    return { ok: true, start: start, end: end };
  }

  function quranStats() {
    if (!state.quran) return { total: 0, done: 0, pct: 0 };
    var total = state.quran.endPage - state.quran.startPage + 1;
    var done = state.quran.completed.length;
    var pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total: total, done: done, pct: pct };
  }

  function createQuranPlan(start, end) {
    state.quran = {
      date: todayKey(),
      startPage: start,
      endPage: end,
      completed: [],
      createdAt: Date.now()
    };
    saveState(state);
    renderQuran();
  }

  function clearQuranPlan() {
    state.quran = null;
    saveState(state);
    renderQuran();
  }

  function toggleQuranPage(page) {
    if (!state.quran) return;
    if (!Number.isInteger(page) || page < state.quran.startPage || page > state.quran.endPage) return;
    var idx = state.quran.completed.indexOf(page);
    var wasCompleted = idx !== -1;
    if (!wasCompleted) {
      state.quran.completed.push(page);
      playCheckSound();
    } else {
      state.quran.completed.splice(idx, 1);
      playUncheckSound();
    }
    state.quran.completed.sort(function (a, b) { return a - b; });
    saveState(state);
    renderQuranStats();
    updateQuranButton(page);
    var s = quranStats();
    if (s.total > 0 && s.done === s.total && !wasCompleted) {
      playCelebrationFanfare();
      triggerConfetti();
    }
  }

  function markAllQuranPages() {
    if (!state.quran) return;
    if (!window.confirm(STRINGS.quranMarkAllConfirm)) return;
    var all = [];
    for (var p = state.quran.startPage; p <= state.quran.endPage; p++) {
      all.push(p);
    }
    state.quran.completed = all;
    saveState(state);
    renderQuran();
    playCelebrationFanfare();
    triggerConfetti();
  }

  function resetAllQuranPages() {
    if (!state.quran) return;
    if (!window.confirm(STRINGS.quranResetAllConfirm)) return;
    state.quran.completed = [];
    saveState(state);
    renderQuran();
  }

  // ---------- Reminder Helpers ----------
  function taskDeadlineMinutes(task) {
    var dur = (Number.isInteger(task.duration) && task.duration > 0) ? task.duration : 0;
    if (task.time) {
      return minutesOf(task.time) + dur;
    }
    if (dur > 0 && task.createdAt && task.date === todayKey()) {
      var d = new Date(task.createdAt);
      return d.getHours() * 60 + d.getMinutes() + dur;
    }
    return null;
  }

  function taskReminderState(task, now) {
    if (!task.time && (!task.duration || !task.createdAt)) return "none";
    if (task.completed) return "completed";
    if (task.date !== todayKey()) return "upcoming";

    now = now || new Date();
    var nm = nowMinutes(now);
    var dur = (Number.isInteger(task.duration) && task.duration > 0) ? task.duration : 0;

    if (task.time) {
      var startM = minutesOf(task.time);
      var endM = startM + dur;
      if (nm < startM) return "upcoming";
      if (nm <= endM) return dur > 0 ? "in-progress" : (task.reminderTriggered ? "overdue" : "due");
      return "overdue";
    }

    if (dur > 0 && task.createdAt) {
      var d = new Date(task.createdAt);
      var startM = d.getHours() * 60 + d.getMinutes();
      var endM = startM + dur;
      if (nm <= endM) return "in-progress";
      return "overdue";
    }

    return "none";
  }

  function isOverdue(task, now) {
    if (task.completed) return false;
    if (task.date !== todayKey()) return false;
    var deadline = taskDeadlineMinutes(task);
    if (deadline === null) return false;
    return nowMinutes(now || new Date()) > deadline;
  }

  // ---------- UI Rendering ----------
  function makeTimeChip(task) {
    var chip = document.createElement("span");
    chip.className = "task-time";
    chip.setAttribute("dir", "ltr");
    var st = taskReminderState(task, new Date());
    chip.setAttribute("data-state", st);

    var iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    iconSvg.setAttribute("width", "13");
    iconSvg.setAttribute("height", "13");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "none");
    iconSvg.setAttribute("stroke", "currentColor");
    iconSvg.setAttribute("stroke-width", "2.2");
    iconSvg.setAttribute("stroke-linecap", "round");
    iconSvg.setAttribute("stroke-linejoin", "round");
    iconSvg.setAttribute("aria-hidden", "true");
    var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "12"); c.setAttribute("cy", "12"); c.setAttribute("r", "10");
    var poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", "12 6 12 12 16 14");
    iconSvg.appendChild(c);
    iconSvg.appendChild(poly);

    var textSpan = document.createElement("span");
    var stateSuffix = "";
    if (st === "overdue") stateSuffix = " (Overdue)";
    else if (st === "in-progress") stateSuffix = " (In progress)";
    textSpan.textContent = formatTime12(task.time) + stateSuffix;

    chip.appendChild(iconSvg);
    chip.appendChild(textSpan);
    chip.setAttribute("aria-label", "Reminder at " + formatTime12(task.time) + ", " + st);
    return chip;
  }

  function makeDurationChip(task) {
    if (!task.duration || task.duration <= 0) return null;
    var chip = document.createElement("span");
    chip.className = "task-duration-chip";
    chip.setAttribute("dir", "ltr");
    var st = taskReminderState(task, new Date());
    chip.setAttribute("data-state", st);

    var iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    iconSvg.setAttribute("width", "12");
    iconSvg.setAttribute("height", "12");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "none");
    iconSvg.setAttribute("stroke", "currentColor");
    iconSvg.setAttribute("stroke-width", "2.2");
    iconSvg.setAttribute("stroke-linecap", "round");
    iconSvg.setAttribute("stroke-linejoin", "round");
    iconSvg.setAttribute("aria-hidden", "true");
    var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "12"); c.setAttribute("cy", "12"); c.setAttribute("r", "10");
    var poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", "12 6 12 12 14 10");
    iconSvg.appendChild(c);
    iconSvg.appendChild(poly);

    var textSpan = document.createElement("span");
    textSpan.textContent = formatDuration(task.duration);

    chip.appendChild(iconSvg);
    chip.appendChild(textSpan);
    var hoverTitle = "Duration: " + formatDuration(task.duration);
    if (task.time) {
      hoverTitle += " (until " + formatTime12(minutesToHhmm(minutesOf(task.time) + task.duration)) + ")";
    }
    chip.title = hoverTitle;
    chip.setAttribute("aria-label", hoverTitle);
    return chip;
  }

  function makeCategoryChip(category) {
    var chip = document.createElement("span");
    chip.className = "task-category-chip";
    var labels = {
      deen: "📖 Deen",
      work: "💼 Work",
      study: "📚 Study",
      personal: "🌱 Personal"
    };
    chip.textContent = labels[category] || category;
    return chip;
  }

  function renderAll() {
    renderDate();
    renderTasks();
    renderSummary();
    renderQuran();
  }

  function renderDate() {
    if (!dateEl) return;
    var now = new Date();
    dateEl.textContent = formatDisplayDate(now);
    dateEl.setAttribute("datetime", getLocalDateKey(now));
  }

  var previousCompletedAll = false;
  function renderSummary() {
    var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.completed; }).length;
    var active = total - done;

    if (statTotalEl) statTotalEl.textContent = String(total);
    if (statActiveEl) statActiveEl.textContent = String(active);
    if (statDoneEl) statDoneEl.textContent = String(done);
    if (taskCountBadgeEl) taskCountBadgeEl.textContent = String(total);

    if (total === 0) {
      if (summaryTextEl) summaryTextEl.textContent = STRINGS.summaryNone;
      if (greetingTextEl) greetingTextEl.textContent = "Start Fresh Today ✨";
    } else {
      if (summaryTextEl) summaryTextEl.textContent = done + " of " + total + " task" + (total === 1 ? "" : "s") + " completed";
      if (greetingTextEl) {
        if (done === total) {
          greetingTextEl.textContent = "Outstanding Achievement! 🎉";
        } else if (done >= Math.ceil(total / 2)) {
          greetingTextEl.textContent = "More than halfway there! 💪";
        } else {
          greetingTextEl.textContent = "Building Momentum 🚀";
        }
      }
    }

    var pct = total === 0 ? 0 : Math.round((done / total) * 100);
    if (summaryPctEl) summaryPctEl.textContent = pct + "%";
    if (progressFillEl) progressFillEl.style.width = pct + "%";
    if (progressBarEl) progressBarEl.setAttribute("aria-valuenow", String(pct));

    var allDone = total > 0 && done === total;
    if (celebrationEl) celebrationEl.hidden = !allDone;

    // Trigger celebration once when reaching 100%
    if (allDone && !previousCompletedAll && total > 0) {
      playCelebrationFanfare();
      triggerConfetti();
    }
    previousCompletedAll = allDone;

    // Show/hide list footer actions (e.g. Clear Completed)
    if (listFooterActionsEl) {
      listFooterActionsEl.hidden = done === 0;
    }
    // Show/hide search bar when more than 3 tasks exist
    if (searchBarWrapEl) {
      searchBarWrapEl.hidden = total < 3;
    }
  }

  function renderTasks() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    var filteredTasks = state.tasks.filter(function (t) {
      // 1. Filter Tab
      if (currentFilter === "active" && t.completed) return false;
      if (currentFilter === "completed" && !t.completed) return false;
      if (currentFilter === "daily" && !t.recurring) return false;
      // 2. Search Query
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        var match = t.text.toLowerCase().indexOf(q) !== -1;
        if (!match && t.category && t.category.toLowerCase().indexOf(q) !== -1) match = true;
        if (!match) return false;
      }
      return true;
    });

    var isEmpty = filteredTasks.length === 0;
    if (emptyStateEl) {
      emptyStateEl.style.display = isEmpty ? "flex" : "none";
      var emptyTitle = emptyStateEl.querySelector(".empty-title");
      var emptySub = emptyStateEl.querySelector(".empty-sub");
      if (emptyTitle && emptySub) {
        if (state.tasks.length === 0) {
          emptyTitle.textContent = "All clear for today";
          emptySub.textContent = "What's on your mind? Add your primary tasks above to build momentum.";
        } else if (searchQuery) {
          emptyTitle.textContent = "No matching tasks";
          emptySub.textContent = "Try searching for something else or clear the search query.";
        } else if (currentFilter === "completed") {
          emptyTitle.textContent = "No completed tasks yet";
          emptySub.textContent = "Check off tasks as you finish them today!";
        } else if (currentFilter === "active") {
          emptyTitle.textContent = "All tasks completed!";
          emptySub.textContent = "You've finished all your active tasks for today. Great job!";
        } else if (currentFilter === "daily") {
          emptyTitle.textContent = "No fixed daily activities";
          emptySub.textContent = "Enable 'Fixed Daily' when adding a task to keep it every day until deleted.";
        }
      }
    }

    filteredTasks.forEach(function (task) {
      var li = document.createElement("li");
      li.className = "task-item" + (task.completed ? " completed" : "") + (isOverdue(task, new Date()) ? " overdue" : "");
      li.dataset.id = task.id;

      // Completion toggle button
      var check = document.createElement("button");
      check.type = "button";
      check.className = "check-btn";
      check.setAttribute("aria-label", task.completed ? "Mark as not completed" : "Mark as completed");
      check.setAttribute("aria-pressed", task.completed ? "true" : "false");
      check.dataset.action = "toggle";
      var box = document.createElement("span");
      box.className = "check-box";
      box.setAttribute("aria-hidden", "true");
      box.textContent = task.completed ? "✓" : "";
      check.appendChild(box);

      // Task content
      var content = document.createElement("div");
      content.className = "task-content";
      var span = document.createElement("span");
      span.className = "task-text";
      span.setAttribute("dir", "auto");
      span.textContent = task.text;
      content.appendChild(span);

      // Meta chips row (category, reminder time, duration, recurring badge)
      if (task.time || task.category || task.recurring || task.duration) {
        var metaRow = document.createElement("div");
        metaRow.className = "task-meta-row";
        if (task.recurring) {
          var recBadge = document.createElement("button");
          recBadge.type = "button";
          recBadge.className = "task-recurring-badge";
          recBadge.dataset.action = "toggle-recurring";
          recBadge.title = "Fixed daily activity (repeats daily until deleted). Click to make one-off.";
          recBadge.setAttribute("aria-label", "Fixed daily activity. Click to make one-off.");
          recBadge.innerHTML = '<span class="recurring-spin" aria-hidden="true">🔄</span> <span>Daily</span>';
          metaRow.appendChild(recBadge);
        }
        if (task.category) metaRow.appendChild(makeCategoryChip(task.category));
        if (task.time) metaRow.appendChild(makeTimeChip(task));
        if (task.duration) {
          var durChip = makeDurationChip(task);
          if (durChip) metaRow.appendChild(durChip);
        }
        content.appendChild(metaRow);
      }

      // Actions (Edit, Delete with crisp SVGs)
      var actions = document.createElement("div");
      actions.className = "task-actions";

      if (!task.recurring) {
        var recBtn = document.createElement("button");
        recBtn.type = "button";
        recBtn.className = "icon-btn";
        recBtn.dataset.action = "toggle-recurring";
        recBtn.setAttribute("aria-label", "Set as fixed daily activity");
        recBtn.title = "Repeat daily";
        recBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
        actions.appendChild(recBtn);
      }

      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-btn";
      edit.dataset.action = "edit";
      edit.setAttribute("aria-label", "Edit task");
      edit.title = "Edit";
      edit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';

      var del = document.createElement("button");
      del.type = "button";
      del.className = "icon-btn danger";
      del.dataset.action = "delete";
      del.setAttribute("aria-label", "Delete task");
      del.title = "Delete";
      del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

      actions.appendChild(edit);
      actions.appendChild(del);

      li.appendChild(check);
      li.appendChild(content);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }

  function renderEditMode(li, task) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    state.tasks.forEach(function (t) {
      var row = document.createElement("li");
      row.className = "task-item" + (t.completed ? " completed" : "");
      row.dataset.id = t.id;

      if (t.id === task.id) {
        row.classList.add("edit-mode");

        var container = document.createElement("div");
        container.className = "task-edit-container";

        // 1. Main row: Name input
        var mainRow = document.createElement("div");
        mainRow.className = "edit-main-row";

        var editInput = document.createElement("input");
        editInput.type = "text";
        editInput.className = "edit-input";
        editInput.setAttribute("dir", "auto");
        editInput.setAttribute("aria-label", "Edit task text");
        editInput.maxLength = MAX_TEXT_LENGTH;
        editInput.value = t.text;
        editInput.placeholder = "What do you want to achieve?";
        mainRow.appendChild(editInput);
        container.appendChild(mainRow);

        // 2. Options row: Time picker, Category pills, and Fixed Daily toggle
        var optionsRow = document.createElement("div");
        optionsRow.className = "edit-options-row";

        // Time picker
        var timeWrapper = document.createElement("div");
        timeWrapper.className = "edit-time-wrapper";
        timeWrapper.title = "Reminder time (optional)";

        var timeIcon = document.createElement("span");
        timeIcon.className = "time-icon";
        timeIcon.setAttribute("aria-hidden", "true");
        timeIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        timeWrapper.appendChild(timeIcon);

        var timeInput = document.createElement("input");
        timeInput.type = "time";
        timeInput.className = "edit-time-input";
        timeInput.setAttribute("aria-label", "Reminder time (optional)");
        timeInput.value = t.time || "";
        timeWrapper.appendChild(timeInput);

        var clearTimeBtn = document.createElement("button");
        clearTimeBtn.type = "button";
        clearTimeBtn.className = "edit-time-clear-btn";
        clearTimeBtn.title = "Clear reminder time";
        clearTimeBtn.setAttribute("aria-label", "Clear reminder time");
        clearTimeBtn.textContent = "✕";
        clearTimeBtn.hidden = !t.time;
        timeWrapper.appendChild(clearTimeBtn);

        timeInput.addEventListener("input", function () {
          clearTimeBtn.hidden = !timeInput.value;
        });
        clearTimeBtn.addEventListener("click", function () {
          timeInput.value = "";
          clearTimeBtn.hidden = true;
          timeInput.focus();
        });

        optionsRow.appendChild(timeWrapper);

        // Duration picker in edit mode
        var durWrapper = document.createElement("div");
        durWrapper.className = "edit-duration-wrapper";
        durWrapper.title = "Duration before overdue (optional)";

        var durIcon = document.createElement("span");
        durIcon.className = "duration-icon";
        durIcon.setAttribute("aria-hidden", "true");
        durIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 10"></polyline></svg>';
        durWrapper.appendChild(durIcon);

        var durSelect = document.createElement("select");
        durSelect.className = "edit-duration-select";
        durSelect.setAttribute("aria-label", "Duration before overdue");

        var standardDurations = [
          { val: "", label: "Duration" },
          { val: "15", label: "15m" },
          { val: "25", label: "25m" },
          { val: "30", label: "30m" },
          { val: "45", label: "45m" },
          { val: "60", label: "1h" },
          { val: "90", label: "1.5h" },
          { val: "120", label: "2h" },
          { val: "180", label: "3h" }
        ];

        var currentDurVal = t.duration ? String(t.duration) : "";
        var matched = false;

        standardDurations.forEach(function (opt) {
          var optEl = document.createElement("option");
          optEl.value = opt.val;
          optEl.textContent = opt.label;
          if (opt.val === currentDurVal) {
            optEl.selected = true;
            matched = true;
          }
          durSelect.appendChild(optEl);
        });

        // If custom duration was already set and not in standard list, insert it
        if (currentDurVal && !matched) {
          var customOpt = document.createElement("option");
          customOpt.value = currentDurVal;
          customOpt.textContent = formatDuration(t.duration);
          customOpt.selected = true;
          durSelect.insertBefore(customOpt, durSelect.lastChild);
        }

        var customChoice = document.createElement("option");
        customChoice.value = "custom";
        customChoice.textContent = "Custom...";
        durSelect.appendChild(customChoice);

        durSelect.addEventListener("change", function () {
          if (durSelect.value === "custom") {
            var customVal = window.prompt("Enter duration in minutes (e.g. 50, 75, 120):", currentDurVal || "30");
            if (customVal !== null) {
              var parsed = parseInt(customVal.trim(), 10);
              if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
                var found = false;
                for (var i = 0; i < durSelect.options.length; i++) {
                  if (durSelect.options[i].value === String(parsed)) {
                    durSelect.selectedIndex = i;
                    found = true;
                    break;
                  }
                }
                if (!found) {
                  var newOpt = document.createElement("option");
                  newOpt.value = String(parsed);
                  newOpt.textContent = formatDuration(parsed);
                  durSelect.insertBefore(newOpt, durSelect.lastChild);
                  newOpt.selected = true;
                }
                return;
              }
            }
            durSelect.value = currentDurVal;
          }
        });

        durWrapper.appendChild(durSelect);
        optionsRow.appendChild(durWrapper);

        // Category selector pills
        var catWrapper = document.createElement("div");
        catWrapper.className = "edit-category-pills";
        catWrapper.setAttribute("role", "radiogroup");
        catWrapper.setAttribute("aria-label", "Task category");

        var currentEditCategory = t.category || "";
        var categories = [
          { key: "", label: "General" },
          { key: "deen", label: "📖 Deen" },
          { key: "work", label: "💼 Work" },
          { key: "study", label: "📚 Study" },
          { key: "personal", label: "🌱 Personal" }
        ];

        categories.forEach(function (cat) {
          var pill = document.createElement("button");
          pill.type = "button";
          pill.className = "cat-pill" + (currentEditCategory === cat.key ? " active" : "");
          pill.dataset.cat = cat.key;
          pill.textContent = cat.label;
          pill.addEventListener("click", function () {
            currentEditCategory = cat.key;
            catWrapper.querySelectorAll(".cat-pill").forEach(function (p) {
              p.classList.remove("active");
            });
            pill.classList.add("active");
          });
          catWrapper.appendChild(pill);
        });

        optionsRow.appendChild(catWrapper);

        // Fixed Daily Recurring toggle
        var currentEditRecurring = t.recurring === true;
        var recBtn = document.createElement("button");
        recBtn.type = "button";
        recBtn.className = "recurring-pill edit-recurring-btn" + (currentEditRecurring ? " active" : "");
        recBtn.setAttribute("aria-pressed", currentEditRecurring ? "true" : "false");
        recBtn.title = "Fixed daily activity (repeats every day until deleted)";
        recBtn.innerHTML = '<span class="recurring-icon" aria-hidden="true">🔄</span> <span>Fixed Daily</span>';
        recBtn.addEventListener("click", function () {
          currentEditRecurring = !currentEditRecurring;
          recBtn.classList.toggle("active", currentEditRecurring);
          recBtn.setAttribute("aria-pressed", currentEditRecurring ? "true" : "false");
        });

        optionsRow.appendChild(recBtn);
        container.appendChild(optionsRow);

        // 3. Actions row: Save Changes and Cancel buttons
        var actionsRow = document.createElement("div");
        actionsRow.className = "edit-actions-row";

        var cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "edit-cancel";
        cancelBtn.dataset.action = "cancel";
        cancelBtn.textContent = "Cancel";

        var saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "edit-save";
        saveBtn.dataset.action = "save";
        saveBtn.textContent = "Save Changes";

        actionsRow.appendChild(cancelBtn);
        actionsRow.appendChild(saveBtn);
        container.appendChild(actionsRow);

        row.appendChild(container);
        listEl.appendChild(row);

        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);

        function doSave() {
          var res = commitEdit(t.id, editInput.value, timeInput.value, currentEditCategory, currentEditRecurring, durSelect.value);
          if (!res.ok && res.error) {
            showError(res.error);
            editInput.focus();
          } else {
            hideError();
          }
        }

        saveBtn.addEventListener("click", doSave);
        cancelBtn.addEventListener("click", function () {
          hideError();
          renderTasks();
        });

        editInput.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            doSave();
          } else if (ev.key === "Escape") {
            hideError();
            renderTasks();
          }
        });
      } else {
        // Render normal task row while editing one item
        var check = document.createElement("button");
        check.type = "button";
        check.className = "check-btn";
        check.dataset.action = "toggle";
        var box = document.createElement("span");
        box.className = "check-box";
        box.textContent = t.completed ? "✓" : "";
        check.appendChild(box);

        var content = document.createElement("div");
        content.className = "task-content";
        var span = document.createElement("span");
        span.className = "task-text";
        span.setAttribute("dir", "auto");
        span.textContent = t.text;
        content.appendChild(span);
        if (t.time || t.category || t.recurring || t.duration) {
          var metaRow = document.createElement("div");
          metaRow.className = "task-meta-row";
          if (t.recurring) {
            var recBadge = document.createElement("button");
            recBadge.type = "button";
            recBadge.className = "task-recurring-badge";
            recBadge.dataset.action = "toggle-recurring";
            recBadge.title = "Fixed daily activity (repeats daily until deleted). Click to make one-off.";
            recBadge.setAttribute("aria-label", "Fixed daily activity. Click to make one-off.");
            recBadge.innerHTML = '<span class="recurring-spin" aria-hidden="true">🔄</span> <span>Daily</span>';
            metaRow.appendChild(recBadge);
          }
          if (t.category) metaRow.appendChild(makeCategoryChip(t.category));
          if (t.time) metaRow.appendChild(makeTimeChip(t));
          if (t.duration) {
            var durChip = makeDurationChip(t);
            if (durChip) metaRow.appendChild(durChip);
          }
          content.appendChild(metaRow);
        }

        row.appendChild(check);
        row.appendChild(content);
        listEl.appendChild(row);
      }
    });
    void li;
  }

  // ---------- Qur'an Rendering ----------
  function showQuranError(msg) {
    if (!quranErrorEl) return;
    quranErrorEl.textContent = msg;
    quranErrorEl.hidden = false;
  }
  function hideQuranError() {
    if (!quranErrorEl) return;
    quranErrorEl.textContent = "";
    quranErrorEl.hidden = true;
  }

  function renderQuran() {
    if (!quranFormEl || !quranActiveEl || !quranGridEl) return;
    var hasPlan = !!state.quran;
    quranFormEl.hidden = hasPlan;
    quranActiveEl.hidden = !hasPlan;
    if (quranClearBtn) quranClearBtn.hidden = !hasPlan;
    if (!hasPlan) {
      hideQuranError();
      return;
    }
    while (quranGridEl.firstChild) quranGridEl.removeChild(quranGridEl.firstChild);
    var doneSet = {};
    state.quran.completed.forEach(function (p) { doneSet[p] = true; });
    var frag = document.createDocumentFragment();
    for (var p = state.quran.startPage; p <= state.quran.endPage; p++) {
      frag.appendChild(makeQuranButton(p, !!doneSet[p]));
    }
    quranGridEl.appendChild(frag);
    renderQuranStats();
  }

  function makeQuranButton(page, completed) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quran-page" + (completed ? " completed" : "");
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-pressed", completed ? "true" : "false");
    btn.setAttribute("aria-label", "Mark page " + page + (completed ? " as not completed" : " as completed"));
    btn.dataset.page = String(page);

    var check = document.createElement("span");
    check.className = "quran-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = completed ? "✓" : "";

    var num = document.createElement("span");
    num.setAttribute("dir", "ltr");
    num.textContent = String(page);

    btn.appendChild(check);
    btn.appendChild(num);
    return btn;
  }

  function renderQuranStats() {
    if (!state.quran || !quranRangeEl) return;
    var s = quranStats();
    quranRangeEl.textContent = "Today's Revision · Pages " + state.quran.startPage + "–" + state.quran.endPage;
    if (quranProgressLabelEl) {
      quranProgressLabelEl.textContent = s.done + " / " + s.total + " pages (" + s.pct + "%)";
    }
    if (quranProgressFillEl) quranProgressFillEl.style.width = s.pct + "%";
    if (quranProgressBarEl) quranProgressBarEl.setAttribute("aria-valuenow", String(s.pct));
    if (quranCompleteEl) {
      var allDone = s.total > 0 && s.done === s.total;
      quranCompleteEl.hidden = !allDone;
      if (allDone) quranCompleteEl.textContent = STRINGS.quranCompleteMsg;
    }
    if (quranJumpEl) {
      quranJumpEl.min = String(state.quran.startPage);
      quranJumpEl.max = String(state.quran.endPage);
    }
  }

  function updateQuranButton(page) {
    if (!quranGridEl) return;
    var btn = quranGridEl.querySelector('button[data-page="' + String(page) + '"]');
    if (!btn || !state.quran) return;
    var completed = state.quran.completed.indexOf(page) !== -1;
    btn.classList.toggle("completed", completed);
    btn.setAttribute("aria-pressed", completed ? "true" : "false");
    btn.setAttribute("aria-label", "Mark page " + page + (completed ? " as not completed" : " as completed"));
    var check = btn.querySelector(".quran-check");
    if (check) check.textContent = completed ? "✓" : "";
  }

  function jumpToQuranPage(page) {
    if (!quranGridEl) return false;
    var btn = quranGridEl.querySelector('button[data-page="' + String(page) + '"]');
    if (!btn) return false;
    btn.scrollIntoView({ block: "center", behavior: "smooth" });
    btn.classList.add("task-flash");
    window.setTimeout(function () { btn.classList.remove("task-flash"); }, 1800);
    try { btn.focus({ preventScroll: true }); } catch (e) { try { btn.focus(); } catch (e2) {} }
    return true;
  }

  // ---------- Errors ----------
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
    if (inputEl) {
      inputEl.classList.remove("input-shake");
      void inputEl.offsetWidth;
      inputEl.classList.add("input-shake");
    }
  }
  function hideError() {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  // ---------- Reminders & Service Worker ----------
  function notificationsSupported() {
    return (typeof window !== "undefined" && ("Notification" in window)) ||
      (typeof navigator !== "undefined" && "setAppBadge" in navigator);
  }
  function permissionState() {
    try {
      if (typeof Notification === "undefined") return "unsupported";
      return Notification.permission || "default";
    } catch (e) {
      return "unsupported";
    }
  }

  function renderReminderBar() {
    if (!reminderBtn || !reminderStatusEl) return;
    var p = permissionState();
    var span = reminderBtn.querySelector("span");
    if (p === "unsupported") {
      reminderStatusEl.textContent = STRINGS.reminderUnsupported;
      reminderBtn.hidden = true;
      if (reminderPillStatus) {
        reminderPillStatus.textContent = "Unsupported";
        reminderPillStatus.className = "reminder-pill-status";
      }
    } else if (p === "granted") {
      reminderStatusEl.textContent = STRINGS.reminderOn;
      if (span) span.textContent = "Reminders on ✓";
      reminderBtn.disabled = true;
      if (reminderPillStatus) {
        reminderPillStatus.textContent = "Active ✓";
        reminderPillStatus.className = "reminder-pill-status active";
      }
    } else if (p === "denied") {
      reminderStatusEl.textContent = STRINGS.reminderDenied;
      if (span) span.textContent = "Try enabling again 🔔";
      reminderBtn.disabled = false;
      if (reminderPillStatus) {
        reminderPillStatus.textContent = "Blocked ⚠";
        reminderPillStatus.className = "reminder-pill-status blocked";
      }
    } else {
      reminderStatusEl.textContent = STRINGS.reminderOff;
      if (span) span.textContent = "Enable Reminders";
      reminderBtn.disabled = false;
      if (reminderPillStatus) {
        reminderPillStatus.textContent = "Turn on 🔔";
        reminderPillStatus.className = "reminder-pill-status";
      }
    }
  }

  function dueTasks(now) {
    var key = todayKey();
    var nm = nowMinutes(now);
    return state.tasks.filter(function (t) {
      return t.time && !t.completed && !t.reminderTriggered && t.date === key && minutesOf(t.time) <= nm;
    });
  }

  function notificationBody(task) {
    var prefix = containsArabic(task.text) ? STRINGS.notifDuePrefixAr : STRINGS.notifDuePrefixEn;
    return prefix + " " + task.text;
  }

  function fireNotification(task) {
    var title = STRINGS.appName;
    var body = notificationBody(task);
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              body: body,
              tag: "fikra-" + task.id,
              data: { taskId: task.id },
              icon: "icons/icon-192.png",
              badge: "icons/favicon-32.png"
            }).catch(function () {
              try { new Notification(title, { body: body, tag: "fikra-" + task.id }); } catch (e) {}
            });
          } else {
            try { new Notification(title, { body: body, tag: "fikra-" + task.id }); } catch (e) {}
          }
        }).catch(function () {
          try { new Notification(title, { body: body, tag: "fikra-" + task.id }); } catch (e) {}
        });
      } else {
        try { new Notification(title, { body: body }); } catch (e) {}
      }
    } catch (e) {}
  }

  function updateBadge() {
    try {
      var count = dueTasks(new Date()).length + state.tasks.filter(function (t) { return isOverdue(t, new Date()); }).length;
      if ("setAppBadge" in navigator) {
        if (count > 0) navigator.setAppBadge(count).catch(function () {});
        else if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(function () {});
      }
    } catch (e) {}
  }

  // ---------- Automatic 12:00 AM & 7:00 AM Daily Planning Reminders ----------
  function isRtlLocale() {
    try {
      return document.documentElement.lang === "ar" || document.documentElement.getAttribute("dir") === "rtl";
    } catch (e) {
      return false;
    }
  }

  function getDailyPlanningState() {
    var today = todayKey();
    var defaultState = { date: today, sent12am: false, sent7am: false };
    try {
      var raw = window.localStorage.getItem(DAILY_PLANNING_KEY);
      if (!raw) return defaultState;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.date !== today) return defaultState;
      return {
        date: today,
        sent12am: parsed.sent12am === true,
        sent7am: parsed.sent7am === true
      };
    } catch (e) {
      return defaultState;
    }
  }

  function saveDailyPlanningState(st) {
    try {
      window.localStorage.setItem(DAILY_PLANNING_KEY, JSON.stringify(st));
    } catch (e) {}
  }

  function firePlanningNotification(title, body) {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              body: body,
              tag: "fikra-daily-planning-" + Date.now(),
              icon: "icons/icon-192.png",
              badge: "icons/favicon-32.png"
            }).catch(function () {
              try { new Notification(title, { body: body, icon: "icons/icon-192.png" }); } catch (e) {}
            });
          } else {
            try { new Notification(title, { body: body, icon: "icons/icon-192.png" }); } catch (e) {}
          }
        }).catch(function () {
          try { new Notification(title, { body: body, icon: "icons/icon-192.png" }); } catch (e) {}
        });
      } else {
        try { new Notification(title, { body: body, icon: "icons/icon-192.png" }); } catch (e) {}
      }
    } catch (e) {}
  }

  function checkDailyPlanningPrompts(now) {
    now = now || new Date();
    if (permissionState() !== "granted") return;

    var h = now.getHours();
    var planState = getDailyPlanningState();
    var changed = false;

    // 12:00 AM Midnight Reset prompt (00:00 - 00:59)
    if (h === 0 && !planState.sent12am) {
      planState.sent12am = true;
      changed = true;
      firePlanningNotification(
        "🌙 " + STRINGS.appName + " · " + (isRtlLocale() ? "بداية يوم جديد" : "Midnight Reset"),
        isRtlLocale()
          ? "تم تجديد مهام اليوم! حدد مهامك وأهدافك لليوم الجديد."
          : "Midnight reset complete! Set your daily tasks and intentions in Fikra."
      );
    }

    // 7:00 AM Morning Focus prompt (07:00 - 09:59)
    if (h >= 7 && h < 10 && !planState.sent7am) {
      planState.sent7am = true;
      changed = true;
      firePlanningNotification(
        "☀️ " + STRINGS.appName + " · " + (isRtlLocale() ? "صباح الهمّة" : "Morning Focus"),
        isRtlLocale()
          ? "صباح الخير! حدد أهم مهامك لليوم في فكرة لبدء يومك بهمة ونشاط."
          : "Good morning! Set your focus tasks for today in Fikra to build momentum."
      );
    }

    if (changed) {
      saveDailyPlanningState(planState);
    }
  }

  function checkDueReminders(now) {
    now = now || new Date();
    if (ensureTodayFresh()) return;

    // Check automatic daily planning reminders (12:00 AM & 7:00 AM)
    checkDailyPlanningPrompts(now);

    if (permissionState() !== "granted") {
      renderTasks();
      return;
    }
    var due = dueTasks(now);
    if (due.length === 0) {
      updateBadge();
      return;
    }
    var changed = false;
    due.forEach(function (t) {
      t.reminderTriggered = true;
      changed = true;
      fireNotification(t);
    });
    if (changed) {
      saveState(state);
      renderTasks();
      updateBadge();
    }
  }

  function startReminderWatch() {
    window.setInterval(function () { checkDueReminders(new Date()); }, REMINDER_CHECK_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) checkDueReminders(new Date());
    });
    window.addEventListener("focus", function () { checkDueReminders(new Date()); });
  }

  function focusTask(taskId) {
    if (!taskId) return;
    var sel = 'li[data-id="' + taskId.replace(/"/g, "") + '"]';
    var row = listEl.querySelector(sel);
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.add("task-flash");
      window.setTimeout(function () { row.classList.remove("task-flash"); }, 2400);
    }
  }

  // ---------- PWA Install ----------
  var deferredPrompt = null;
  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: window-controls-overlay)").matches) return true;
      if (window.navigator.standalone === true) return true;
      if (document.referrer && document.referrer.indexOf("android-app://") !== -1) return true;
    } catch (e) {}
    return false;
  }
  function dismissedBefore() {
    try { return window.localStorage.getItem(INSTALL_SEEN_KEY) === "1"; } catch (e) { return true; }
  }
  function hideInstallCard() {
    if (installSectionEl) {
      installSectionEl.hidden = true;
      installSectionEl.style.display = "none";
    }
  }
  function showInstallCard() {
    if (installSectionEl && !isStandalone() && !dismissedBefore()) {
      installSectionEl.hidden = false;
      installSectionEl.style.display = "";
    }
  }
  function initInstall() {
    if (!installSectionEl) return;
    // Always hide if standalone (already installed app) or dismissed before
    if (isStandalone() || dismissedBefore()) {
      hideInstallCard();
      return;
    }
    // Check if browser detects it is already installed
    if (navigator.getInstalledRelatedApps) {
      navigator.getInstalledRelatedApps().then(function (apps) {
        if (apps && apps.length > 0) {
          hideInstallCard();
          try { window.localStorage.setItem(INSTALL_SEEN_KEY, "1"); } catch (e) {}
        }
      }).catch(function () {});
    }
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (!dismissedBefore() && !isStandalone()) {
        showInstallCard();
      }
      if (installFallbackEl) installFallbackEl.hidden = true;
      if (installBtn) installBtn.hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      hideInstallCard();
      try { window.localStorage.setItem(INSTALL_SEEN_KEY, "1"); } catch (e) {}
    });
  }

  // ---------- Collapsible Reminders Card ----------
  var REMINDER_COLLAPSED_KEY = "fikra-reminder-collapsed";
  function toggleReminderCollapse() {
    if (!reminderCardEl) return;
    var isCollapsed = reminderCardEl.classList.toggle("reminder-collapsed");
    try { window.localStorage.setItem(REMINDER_COLLAPSED_KEY, isCollapsed ? "1" : "0"); } catch (e) {}
    if (reminderToggleBar) {
      reminderToggleBar.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }
  }
  if (reminderToggleBar) {
    reminderToggleBar.addEventListener("click", function (ev) {
      if (ev.target.closest("#reminder-btn")) return;
      toggleReminderCollapse();
    });
    reminderToggleBar.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggleReminderCollapse();
      }
    });
  }
  if (reminderCollapseBtn) {
    reminderCollapseBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      toggleReminderCollapse();
    });
  }
  // Initialize reminder card collapsed state
  try {
    var storedReminderState = window.localStorage.getItem(REMINDER_COLLAPSED_KEY);
    if (storedReminderState === null || storedReminderState === "1") {
      if (reminderCardEl) {
        reminderCardEl.classList.add("reminder-collapsed");
        if (reminderToggleBar) reminderToggleBar.setAttribute("aria-expanded", "false");
      }
    } else {
      if (reminderCardEl) {
        reminderCardEl.classList.remove("reminder-collapsed");
        if (reminderToggleBar) reminderToggleBar.setAttribute("aria-expanded", "true");
      }
    }
  } catch (e) {}

  // ---------- Events & Keybindings ----------
  function toggleRecurringOption(explicitState) {
    if (explicitState !== undefined) {
      isRecurringActive = !!explicitState;
    } else {
      isRecurringActive = !isRecurringActive;
    }
    if (recurringToggleBtn) {
      recurringToggleBtn.classList.toggle("active", isRecurringActive);
      recurringToggleBtn.setAttribute("aria-pressed", isRecurringActive ? "true" : "false");
    }
  }

  if (recurringToggleBtn) {
    recurringToggleBtn.addEventListener("click", function () {
      toggleRecurringOption();
    });
  }

  if (formEl) {
    formEl.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ensureTodayFresh();
      var durVal = durationEl && durationEl.value ? durationEl.value : null;
      var res = addTask(inputEl ? inputEl.value : "", timeEl ? timeEl.value : null, selectedCategory, isRecurringActive, durVal);
      if (!res.ok) {
        showError(res.error);
        if (inputEl) inputEl.focus();
        return;
      }
      hideError();
      if (inputEl) inputEl.value = "";
      if (timeEl) timeEl.value = "";
      if (durationEl) durationEl.value = "";
      if (composerCharCountEl) composerCharCountEl.textContent = "";
      toggleRecurringOption(false);
      if (inputEl) inputEl.focus();
    });
  }

  if (durationEl) {
    durationEl.addEventListener("change", function () {
      if (durationEl.value === "custom") {
        var customVal = window.prompt("Enter duration in minutes (e.g. 50, 75, 120):", "30");
        if (customVal !== null) {
          var parsed = parseInt(customVal.trim(), 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
            var found = false;
            for (var i = 0; i < durationEl.options.length; i++) {
              if (durationEl.options[i].value === String(parsed)) {
                durationEl.selectedIndex = i;
                found = true;
                break;
              }
            }
            if (!found) {
              var newOpt = document.createElement("option");
              newOpt.value = String(parsed);
              newOpt.textContent = formatDuration(parsed);
              durationEl.insertBefore(newOpt, durationEl.lastChild);
              newOpt.selected = true;
            }
            return;
          }
        }
        durationEl.value = "";
      }
    });
  }

  if (inputEl) {
    inputEl.addEventListener("input", function () {
      var len = inputEl.value.length;
      if (composerCharCountEl) {
        composerCharCountEl.textContent = len > 350 ? len + " / " + MAX_TEXT_LENGTH : "";
      }
      if (!errorEl.hidden && inputEl.value.trim()) hideError();
    });
  }

  if (categoryPillsContainer) {
    categoryPillsContainer.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".cat-pill");
      if (!btn) return;
      var pills = categoryPillsContainer.querySelectorAll(".cat-pill");
      pills.forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      selectedCategory = btn.dataset.cat || "";
      if (inputEl) inputEl.focus();
    });
  }

  if (filterTabsEl) {
    filterTabsEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".filter-tab");
      if (!btn) return;
      var tabs = filterTabsEl.querySelectorAll(".filter-tab");
      tabs.forEach(function (t) {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentFilter = btn.dataset.filter || "all";
      renderTasks();
    });
  }

  if (searchInputEl) {
    searchInputEl.addEventListener("input", function () {
      searchQuery = (searchInputEl.value || "").trim();
      if (searchClearBtn) searchClearBtn.hidden = !searchQuery;
      renderTasks();
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", function () {
      if (searchInputEl) {
        searchInputEl.value = "";
        searchQuery = "";
        searchClearBtn.hidden = true;
        renderTasks();
        searchInputEl.focus();
      }
    });
  }

  if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", function () {
      clearCompletedTasks();
    });
  }

  if (listEl) {
    listEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button");
      if (!btn || !listEl.contains(btn)) return;
      var li = btn.closest("li[data-id]");
      if (!li) return;
      var id = li.dataset.id;
      var action = btn.dataset.action;

      ensureTodayFresh();

      if (action === "toggle") {
        toggleTask(id);
      } else if (action === "toggle-recurring") {
        toggleTaskRecurring(id);
      } else if (action === "delete") {
        deleteTask(id);
      } else if (action === "edit") {
        var task = findTask(id);
        if (task) renderEditMode(li, task);
      } else if (action === "save") {
        var field = li.querySelector(".edit-input");
        var timeField = li.querySelector(".edit-time-input");
        var durField = li.querySelector(".edit-duration-select");
        var activeCat = li.querySelector(".edit-category-pills .cat-pill.active");
        var recBtn = li.querySelector(".edit-recurring-btn");
        var res = commitEdit(
          id,
          field ? field.value : "",
          timeField ? timeField.value : null,
          activeCat ? activeCat.dataset.cat : "",
          recBtn ? recBtn.classList.contains("active") : false,
          durField ? durField.value : null
        );
        if (!res.ok && res.error) {
          showError(res.error);
          if (field) field.focus();
        } else {
          hideError();
        }
      } else if (action === "cancel") {
        hideError();
        renderTasks();
      }
    });
  }

  // Qur'an Events
  if (quranFormEl) {
    quranFormEl.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ensureTodayFresh();
      var res = validateQuranRange(quranStartEl ? quranStartEl.value : "", quranEndEl ? quranEndEl.value : "");
      if (!res.ok) {
        showQuranError(res.error);
        if (quranStartEl) quranStartEl.focus();
        return;
      }
      if (state.quran) {
        try {
          if (!window.confirm(STRINGS.quranReplaceConfirm)) return;
        } catch (e) { return; }
      }
      hideQuranError();
      createQuranPlan(res.start, res.end);
      if (quranStartEl) quranStartEl.value = "";
      if (quranEndEl) quranEndEl.value = "";
      if (quranJumpEl) quranJumpEl.value = "";
    });
    if (quranStartEl) quranStartEl.addEventListener("input", hideQuranError);
    if (quranEndEl) quranEndEl.addEventListener("input", hideQuranError);
  }

  // Quran Preset Buttons
  document.addEventListener("click", function (ev) {
    var presetBtn = ev.target.closest(".quran-preset-btn");
    if (!presetBtn) return;
    var start = presetBtn.dataset.start;
    var end = presetBtn.dataset.end;
    if (start && end && quranStartEl && quranEndEl) {
      quranStartEl.value = start;
      quranEndEl.value = end;
      hideQuranError();
      quranStartEl.focus();
    }
  });

  if (quranGridEl) {
    quranGridEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-page]");
      if (!btn || !quranGridEl.contains(btn)) return;
      ensureTodayFresh();
      if (!state.quran) return;
      var page = parseQuranInput(btn.dataset.page);
      if (page === null) return;
      toggleQuranPage(page);
    });
  }

  if (quranClearBtn) {
    quranClearBtn.addEventListener("click", function () {
      ensureTodayFresh();
      if (!state.quran) return;
      try {
        if (!window.confirm(STRINGS.quranReplaceConfirm)) return;
      } catch (e) { return; }
      clearQuranPlan();
      if (quranStartEl) quranStartEl.focus();
    });
  }

  function handleQuranJump() {
    ensureTodayFresh();
    if (!state.quran || !quranJumpEl) return;
    var page = parseQuranInput(quranJumpEl.value);
    if (page === null || page < state.quran.startPage || page > state.quran.endPage) {
      showQuranError(STRINGS.quranJumpError);
      if (quranJumpEl) quranJumpEl.focus();
      return;
    }
    hideQuranError();
    jumpToQuranPage(page);
  }
  if (quranJumpBtn) quranJumpBtn.addEventListener("click", handleQuranJump);
  if (quranJumpEl) {
    quranJumpEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        handleQuranJump();
      }
    });
    quranJumpEl.addEventListener("input", function () {
      if (quranErrorEl && !quranErrorEl.hidden) hideQuranError();
    });
  }

  if (quranMarkAllBtn) quranMarkAllBtn.addEventListener("click", markAllQuranPages);
  if (quranResetAllBtn) quranResetAllBtn.addEventListener("click", resetAllQuranPages);

  // Quran Section Collapse / Toggle
  function toggleQuranCollapse() {
    if (!quranSectionEl) return;
    var isCollapsed = quranSectionEl.classList.toggle("quran-collapsed");
    try { window.localStorage.setItem(QURAN_COLLAPSED_KEY, isCollapsed ? "1" : "0"); } catch (e) {}
    if (quranToggleHeaderBtn) {
      quranToggleHeaderBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    }
  }
  if (quranCollapseBtn) quranCollapseBtn.addEventListener("click", toggleQuranCollapse);
  if (quranToggleHeaderBtn) {
    quranToggleHeaderBtn.addEventListener("click", function () {
      if (quranSectionEl) {
        if (quranSectionEl.classList.contains("quran-collapsed")) {
          toggleQuranCollapse();
        }
        quranSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Restore Quran collapsed state
  try {
    if (window.localStorage.getItem(QURAN_COLLAPSED_KEY) === "1" && quranSectionEl) {
      quranSectionEl.classList.add("quran-collapsed");
      if (quranToggleHeaderBtn) quranToggleHeaderBtn.setAttribute("aria-expanded", "false");
    }
  } catch (e) {}

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", function (ev) {
    // Focus task input with '/' when not already typing
    if (ev.key === "/" && document.activeElement !== inputEl &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA") {
      ev.preventDefault();
      if (inputEl) inputEl.focus();
    }
  });

  // Theme, Sound & WakeLock Buttons
  if (themeToggleBtn) themeToggleBtn.addEventListener("click", cycleTheme);
  if (soundToggleBtn) soundToggleBtn.addEventListener("click", toggleSound);
  if (wakelockToggleBtn) wakelockToggleBtn.addEventListener("click", toggleWakeLock);

  // Maintain screen wake lock while app is in active use
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && wakeLockEnabled) {
      requestWakeLock();
    } else if (document.hidden) {
      releaseWakeLock();
    }
  });
  window.addEventListener("focus", function () {
    if (wakeLockEnabled) requestWakeLock();
  });
  ["click", "touchstart", "keydown"].forEach(function (evName) {
    document.addEventListener(evName, function () {
      if (wakeLockEnabled && !wakeLockSentinel) {
        requestWakeLock();
      }
    }, { passive: true });
  });

  // Rollover Watcher
  function startRolloverWatch() {
    window.setInterval(function () {
      if (ensureTodayFresh()) {
        renderDate();
        renderReminderBar();
        updateBadge();
      } else {
        renderDate();
      }
    }, ROLLOVER_CHECK_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        ensureTodayFresh();
        renderDate();
        checkDueReminders(new Date());
      }
    });
    window.addEventListener("focus", function () {
      ensureTodayFresh();
      renderDate();
      checkDueReminders(new Date());
    });
  }

  // ---------- Init ----------
  applyTheme(currentTheme);
  updateSoundIcon();
  updateWakeLockUI();
  if (wakeLockEnabled) requestWakeLock();
  ensureTodayFresh();
  if (!storageOK) showStorageWarning();
  renderAll();
  renderReminderBar();
  initInstall();
  startRolloverWatch();
  startReminderWatch();
  checkDueReminders(new Date());

  if (installBtn) {
    installBtn.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        try { window.localStorage.setItem(INSTALL_SEEN_KEY, "1"); } catch (e) {}
        if (installSectionEl) installSectionEl.hidden = true;
      }).catch(function () {});
    });
  }
  if (installDismissBtn) {
    installDismissBtn.addEventListener("click", function () {
      if (installSectionEl) installSectionEl.hidden = true;
      try { window.localStorage.setItem(INSTALL_SEEN_KEY, "1"); } catch (e) {}
    });
  }

  if (reminderBtn) {
    reminderBtn.addEventListener("click", function () {
      if (permissionState() === "unsupported") {
        renderReminderBar();
        return;
      }
      try {
        var p = Notification.requestPermission();
        if (p && p.then) {
          p.then(function () {
            renderReminderBar();
            checkDueReminders(new Date());
          }).catch(function () { renderReminderBar(); });
        } else {
          Notification.requestPermission(function () {
            renderReminderBar();
            checkDueReminders(new Date());
          });
        }
      } catch (e) {
        renderReminderBar();
      }
    });
  }

  // Deep-link from notification tap: ?task=<id>
  try {
    var q = new URLSearchParams(window.location.search || "");
    var deep = q.get("task");
    if (deep) {
      window.setTimeout(function () { focusTask(deep); }, 300);
    }
  } catch (e) {}

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (ev) {
      if (ev.data && ev.data.type === "FOCUS_TASK") focusTask(ev.data.taskId);
      if (ev.data && ev.data.type === "CHECK_DAILY_PLANNING") checkDailyPlanningPrompts(new Date());
    });
    if ("periodicSync" in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.periodicSync.register("fikra-daily-planning", {
          minInterval: 60 * 60 * 1000
        });
      }).catch(function () {});
    }
  }

  // Test Seam (Exact backward compatibility preserved + new features)
  if (typeof window !== "undefined") {
    window.__fikraTest = {
      getLocalDateKey: getLocalDateKey,
      todayKey: todayKey,
      blankState: blankState,
      isValidTask: isValidTask,
      isValidTime: isValidTime,
      formatTime12: formatTime12,
      taskReminderState: taskReminderState,
      dueTasks: dueTasks,
      notificationBody: notificationBody,
      getState: function () { return state; },
      addTask: addTask,
      commitEdit: commitEdit,
      deleteTask: deleteTask,
      toggleTask: toggleTask,
      toggleTaskRecurring: toggleTaskRecurring,
      ensureTodayFresh: ensureTodayFresh,
      getDailyPlanningState: getDailyPlanningState,
      saveDailyPlanningState: saveDailyPlanningState,
      checkDailyPlanningPrompts: checkDailyPlanningPrompts,
      QURAN_MIN: QURAN_MIN,
      QURAN_MAX: QURAN_MAX,
      isValidQuranPlan: isValidQuranPlan,
      sanitizeQuranPlan: sanitizeQuranPlan,
      validateQuranRange: validateQuranRange,
      parseQuranInput: parseQuranInput,
      quranStats: quranStats,
      createQuranPlan: createQuranPlan,
      clearQuranPlan: clearQuranPlan,
      toggleQuranPage: toggleQuranPage,
      wakeLockSupported: wakeLockSupported,
      requestWakeLock: requestWakeLock,
      releaseWakeLock: releaseWakeLock,
      toggleWakeLock: toggleWakeLock,
      taskDeadlineMinutes: taskDeadlineMinutes,
      formatDuration: formatDuration,
      parseDuration: parseDuration,
      isOverdue: isOverdue
    };
  }
})();
