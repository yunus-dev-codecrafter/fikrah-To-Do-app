/* Fikra To-Do — Phase One + PWA/Reminders (§22–§35)
   Sections: constants | date utils | storage | state + task ops | rendering |
             reminders | install | events | init
   Future i18n: all UI strings live in STRINGS so EN/AR toggle can be added later.
*/
(function () {
  "use strict";

  var STORAGE_KEY = "fikra-todo-v1";
  var INSTALL_SEEN_KEY = "fikra-pwa-install-dismissed";
  var MAX_TEXT_LENGTH = 500;
  var ROLLOVER_CHECK_MS = 30000;
  var REMINDER_CHECK_MS = 20000;

  // Centralized UI strings (future localization point).
  var STRINGS = {
    emptyTaskError: "Please type a task before adding.",
    invalidTimeError: "That time doesn't look valid — pick a time or leave it empty.",
    storageUnavailable: "Browser storage is unavailable — tasks will work for this session only and won't persist after reload.",
    summaryNone: "0 of 0 tasks completed",
    loadDateFallback: "Today",
    reminderOn: "Reminders are on — you'll be notified at each task's time.",
    reminderOff: "Enable notifications to get reminded at each task's time.",
    reminderDenied: "Notifications are blocked — tasks still work. Re-enable them in your browser/site settings, then try again.",
    reminderUnsupported: "This browser doesn't support notifications — tasks still work normally.",
    reminderGranted: "Reminders enabled ✓",
    notifDuePrefixEn: "🔔 It's time:",
    notifDuePrefixAr: "🔔 حان وقت:",
    appName: "Fikra To-Do"
  };

  // ---------- DOM ----------
  var dateEl = document.getElementById("current-date");
  var formEl = document.getElementById("task-form");
  var inputEl = document.getElementById("task-input");
  var timeEl = document.getElementById("task-time");
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

  // ---------- Date utils ----------
  // Local calendar key, e.g. "2026-09-26". Never UTC — must follow user's local day.
  function getLocalDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // Test seam: lets tests simulate another day without touching prod logic.
  // Production always calls with `new Date()`. Tests may set window.__fikraDateOverride = "2026-09-27".
  function todayKey() {
    if (typeof window !== "undefined" && typeof window.__fikraDateOverride === "string" && window.__fikraDateOverride) {
      return window.__fikraDateOverride;
    }
    return getLocalDateKey(new Date());
  }

  function formatDisplayDate(now) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(now);
    } catch (e) {
      return STRINGS.loadDateFallback;
    }
  }

  // ---------- Time utils (optional per-task reminder, "HH:MM" 24h) ----------
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
  // "19:00" -> "7:00 PM" for chips; keeps native input value untouched.
  function formatTime12(hhmm) {
    if (!isValidTime(hhmm)) return "";
    var h = parseInt(hhmm.slice(0, 2), 10);
    var m = hhmm.slice(3, 5);
    var suffix = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + suffix;
  }

  // ---------- Storage ----------
  var memoryFallback = null;
  var storageOK = true;

  function isValidTask(t, index) {
    if (!t || typeof t.id !== "string" || typeof t.text !== "string" ||
        typeof t.completed !== "boolean" || typeof t.createdAt !== "number" ||
        typeof t.order !== "number") {
      return false;
    }
    // Optional timed-reminder fields (must be well-formed when present).
    if (t.time !== undefined && t.time !== null && !isValidTime(t.time)) return false;
    if (t.date !== undefined && typeof t.date !== "string") return false;
    if (t.reminderTriggered !== undefined && typeof t.reminderTriggered !== "boolean") return false;
    return true;
  }

  function blankState(dateKey) {
    return { date: dateKey, tasks: [] };
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
      // Strict validation: drop malformed entries instead of crashing.
      // In-place migration: old tasks without timed fields get defaults.
      var clean = parsed.tasks.filter(isValidTask).map(function (t) {
        return {
          id: t.id,
          text: t.text.slice(0, MAX_TEXT_LENGTH),
          date: (typeof t.date === "string" && t.date) || parsed.date || key,
          time: normalizeTime(t.time === undefined ? null : t.time),
          completed: t.completed,
          createdAt: t.createdAt,
          order: t.order,
          reminderTriggered: t.reminderTriggered === true
        };
      });
      // Stable order.
      clean.sort(function (a, b) { return a.order - b.order; });
      return { date: parsed.date, tasks: clean };
    } catch (e) {
      // Corrupted JSON — start fresh rather than break.
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
    storageWarningEl.textContent = STRINGS.storageUnavailable;
    storageWarningEl.hidden = false;
  }

  // ---------- State + task ops ----------
  var state = loadState();

  // Daily reset: calendar-date comparison, not a 24h timer.
  // If stored date != today, previous day's list is retired and a fresh list begins.
  function ensureTodayFresh() {
    var key = todayKey();
    if (state.date !== key) {
      state = blankState(key);
      saveState(state);
      renderAll();
      return true;
    }
    return false;
  }

  function makeId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) { /* fall through */ }
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

  function addTask(rawText, rawTime) {
    var text = (rawText || "").trim();
    if (!text) return { ok: false, error: STRINGS.emptyTaskError };
    var time = normalizeTime(rawTime === undefined ? (timeEl && timeEl.value ? timeEl.value : null) : rawTime);
    if (rawTime !== undefined && rawTime !== null && rawTime !== "" && time === null) {
      return { ok: false, error: STRINGS.invalidTimeError };
    }
    // If the visible time field holds garbage the browser didn't sanitize, reject kindly.
    if (rawTime === undefined && timeEl && timeEl.value && !isValidTime(timeEl.value)) {
      return { ok: false, error: STRINGS.invalidTimeError };
    }
    text = text.slice(0, MAX_TEXT_LENGTH);
    state.tasks.push({
      id: makeId(),
      text: text,
      date: todayKey(),
      time: time,
      completed: false,
      createdAt: Date.now(),
      order: nextOrder(),
      reminderTriggered: false
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
      // A completed task must never notify again.
      t.reminderTriggered = true;
    } else if (t.time && t.date === todayKey()) {
      // Re-armed only if its time is still in the future today.
      try {
        var mins = minutesOf(t.time);
        if (nowMinutes(new Date()) < mins) t.reminderTriggered = false;
      } catch (e) { /* keep flag as-is */ }
    }
    saveState(state);
    renderTasks();
    renderSummary();
    checkDueReminders(new Date());
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    saveState(state);
    renderTasks();
    renderSummary();
    inputEl.focus({ preventScroll: true });
  }

  function commitEdit(id, rawText) {
    var t = findTask(id);
    if (!t) return { ok: false };
    var text = (rawText || "").trim();
    if (!text) return { ok: false, error: STRINGS.emptyTaskError };
    t.text = text.slice(0, MAX_TEXT_LENGTH);
    saveState(state);
    renderTasks();
    return { ok: true };
  }

  function findTask(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === id) return state.tasks[i];
    }
    return null;
  }

  function taskReminderState(task, now) {
    // Upcoming | Due | Completed | Overdue (timed tasks only; untimed -> "none").
    if (!task.time) return "none";
    if (task.completed) return "completed";
    if (task.date !== todayKey()) return "upcoming";
    var dueMins = minutesOf(task.time);
    var nowM = nowMinutes(now || new Date());
    if (nowM < dueMins) return "upcoming";
    return task.reminderTriggered ? "overdue" : "due";
  }

  function isOverdue(task, now) {
    if (!task.time || task.completed) return false;
    if (task.date !== todayKey()) return false;
    return nowMinutes(now || new Date()) > minutesOf(task.time);
  }

  // ---------- Rendering (safe: textContent only, never innerHTML with user text) ----------
  function makeTimeChip(task) {
    var chip = document.createElement("span");
    chip.className = "task-time";
    chip.setAttribute("dir", "ltr");
    chip.textContent = "⏰ " + formatTime12(task.time);
    var st = taskReminderState(task, new Date());
    chip.setAttribute("data-state", st);
    chip.setAttribute("aria-label", "Reminder at " + formatTime12(task.time) + ", " + st);
    return chip;
  }

  function renderAll() {
    renderDate();
    renderTasks();
    renderSummary();
  }

  function renderDate() {
    var now = new Date();
    var label = formatDisplayDate(now);
    dateEl.textContent = label;
    dateEl.setAttribute("datetime", getLocalDateKey(now));
  }

  function renderSummary() {
    var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.completed; }).length;
    if (total === 0) {
      summaryTextEl.textContent = STRINGS.summaryNone;
    } else {
      summaryTextEl.textContent = done + " of " + total + " task" + (total === 1 ? "" : "s") + " completed";
    }
    var pct = total === 0 ? 0 : Math.round((done / total) * 100);
    summaryPctEl.textContent = pct + "%";
    progressFillEl.style.width = pct + "%";
    progressBarEl.setAttribute("aria-valuenow", String(pct));
    var allDone = total > 0 && done === total;
    celebrationEl.hidden = !allDone;
  }

  function clearList() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  }

  function renderTasks() {
    clearList();
    var isEmpty = state.tasks.length === 0;
    emptyStateEl.style.display = isEmpty ? "" : "none";

    state.tasks.forEach(function (task) {
      var li = document.createElement("li");
      li.className = "task-item" + (task.completed ? " completed" : "") + (isOverdue(task, new Date()) ? " overdue" : "");
      li.dataset.id = task.id;

      // Completion toggle
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

      // Text + optional time chip (dir=auto handles Arabic/English/mixed per-item)
      var content = document.createElement("div");
      content.className = "task-content";
      var span = document.createElement("span");
      span.className = "task-text";
      span.setAttribute("dir", "auto");
      span.textContent = task.text;
      content.appendChild(span);
      if (task.time) {
        content.appendChild(makeTimeChip(task));
      }

      // Actions
      var actions = document.createElement("div");
      actions.className = "task-actions";

      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-btn";
      edit.dataset.action = "edit";
      edit.setAttribute("aria-label", "Edit task");
      edit.title = "Edit";
      edit.textContent = "✎";

      var del = document.createElement("button");
      del.type = "button";
      del.className = "icon-btn danger";
      del.dataset.action = "delete";
      del.setAttribute("aria-label", "Delete task");
      del.title = "Delete";
      del.textContent = "🗑";

      actions.appendChild(edit);
      actions.appendChild(del);

      li.appendChild(check);
      li.appendChild(content);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }

  function renderEditMode(li, task) {
    clearList();
    // Rebuild list with the editing row in place (keeps order stable).
    state.tasks.forEach(function (t) {
      var row = document.createElement("li");
      row.className = "task-item" + (t.completed ? " completed" : "");
      row.dataset.id = t.id;

      if (t.id === task.id) {
        var wrap = document.createElement("div");
        wrap.className = "edit-row";

        var editInput = document.createElement("input");
        editInput.type = "text";
        editInput.className = "edit-input";
        editInput.setAttribute("dir", "auto");
        editInput.setAttribute("aria-label", "Edit task text");
        editInput.maxLength = MAX_TEXT_LENGTH;
        editInput.value = t.text;

        var save = document.createElement("button");
        save.type = "button";
        save.className = "edit-save";
        save.dataset.action = "save";
        save.textContent = "Save";

        var cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "edit-cancel";
        cancel.dataset.action = "cancel";
        cancel.textContent = "Cancel";

        wrap.appendChild(editInput);
        wrap.appendChild(save);
        wrap.appendChild(cancel);
        row.appendChild(wrap);

        listEl.appendChild(row);

        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);

        editInput.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            var res = commitEdit(t.id, editInput.value);
            if (!res.ok && res.error) {
              editInput.setAttribute("aria-invalid", "true");
              showError(res.error);
              editInput.focus();
            } else {
              hideError();
            }
          } else if (ev.key === "Escape") {
            renderTasks();
          }
        });
      } else {
        // Non-editing rows rendered normally.
        var check = document.createElement("button");
        check.type = "button";
        check.className = "check-btn";
        check.dataset.action = "toggle";
        check.setAttribute("aria-label", t.completed ? "Mark as not completed" : "Mark as completed");
        check.setAttribute("aria-pressed", t.completed ? "true" : "false");
        var box = document.createElement("span");
        box.className = "check-box";
        box.setAttribute("aria-hidden", "true");
        box.textContent = t.completed ? "✓" : "";
        check.appendChild(box);

        var content = document.createElement("div");
        content.className = "task-content";
        var span = document.createElement("span");
        span.className = "task-text";
        span.setAttribute("dir", "auto");
        span.textContent = t.text;
        content.appendChild(span);
        if (t.time) content.appendChild(makeTimeChip(t));
        row.className = "task-item" + (t.completed ? " completed" : "") + (isOverdue(t, new Date()) ? " overdue" : "");

        var actions = document.createElement("div");
        actions.className = "task-actions";
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "icon-btn";
        editBtn.dataset.action = "edit";
        editBtn.setAttribute("aria-label", "Edit task");
        editBtn.textContent = "✎";
        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "icon-btn danger";
        delBtn.dataset.action = "delete";
        delBtn.setAttribute("aria-label", "Delete task");
        delBtn.textContent = "🗑";
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(check);
        row.appendChild(content);
        row.appendChild(actions);
        listEl.appendChild(row);
      }
    });
    void li; // keep signature stable
  }

  // ---------- Errors ----------
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    inputEl.classList.remove("input-shake");
    // Restart shake animation.
    void inputEl.offsetWidth;
    inputEl.classList.add("input-shake");
  }
  function hideError() {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  // ---------- Reminders (Notification API + Service Worker) ----------
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
    if (p === "unsupported") {
      reminderStatusEl.textContent = STRINGS.reminderUnsupported;
      reminderBtn.hidden = true;
    } else if (p === "granted") {
      reminderStatusEl.textContent = STRINGS.reminderOn;
      reminderBtn.textContent = "Reminders on ✓";
      reminderBtn.disabled = true;
    } else if (p === "denied") {
      reminderStatusEl.textContent = STRINGS.reminderDenied;
      reminderBtn.textContent = "Try enabling again 🔔";
      reminderBtn.disabled = false;
    } else {
      reminderStatusEl.textContent = STRINGS.reminderOff;
      reminderBtn.textContent = "Enable Reminders 🔔";
      reminderBtn.disabled = false;
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
    // Prefer persistent service-worker notification (works for installed PWA on Android).
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
              try { new Notification(title, { body: body, tag: "fikra-" + task.id }); } catch (e) { /* ignore */ }
            });
          } else {
            try { new Notification(title, { body: body, tag: "fikra-" + task.id }); } catch (e) { /* ignore */ }
          }
        }).catch(function () {
          try { new Notification(title, { body: body, tag: "fikra-" + task.id }); } catch (e) { /* ignore */ }
        });
      } else {
        try { new Notification(title, { body: body }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* notifications unavailable — task list still updates */ }
  }

  function updateBadge() {
    try {
      var count = dueTasks(new Date()).length + state.tasks.filter(function (t) { return isOverdue(t, new Date()); }).length;
      if ("setAppBadge" in navigator) {
        if (count > 0) navigator.setAppBadge(count).catch(function () {});
        else if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(function () {});
      }
    } catch (e) { /* badges unsupported — ignore */ }
  }

  function checkDueReminders(now) {
    now = now || new Date();
    // Midnight boundary first: never fire yesterday's reminders.
    if (ensureTodayFresh()) return;
    if (permissionState() !== "granted") {
      // Still refresh overdue visuals even without permission.
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

  // ---------- PWA install ----------
  var deferredPrompt = null;
  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.navigator.standalone === true) return true; // iOS
    } catch (e) { /* ignore */ }
    return false;
  }
  function dismissedBefore() {
    try { return window.localStorage.getItem(INSTALL_SEEN_KEY) === "1"; } catch (e) { return true; }
  }
  function initInstall() {
    if (!installSectionEl) return;
    // Never prompt inside the installed app.
    if (isStandalone()) {
      installSectionEl.hidden = true;
      return;
    }
    var canPrompt = ("BeforeInstallPromptEvent" in window) || ("onbeforeinstallprompt" in window);
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (!dismissedBefore()) installSectionEl.hidden = false;
      if (installFallbackEl) installFallbackEl.hidden = true;
      if (installBtn) installBtn.hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      installSectionEl.hidden = true;
      try { window.localStorage.setItem(INSTALL_SEEN_KEY, "1"); } catch (e) {}
    });
    // Browser without programmatic prompt: show graceful manual instructions
    // (but only outside standalone, and only once per user).
    if (!dismissedBefore()) {
      window.setTimeout(function () {
        if (!deferredPrompt && !isStandalone() && canPrompt === false) {
          // Chrome/Edge/Samsung will still fire beforeinstallprompt when eligible;
          // show fallback text so users know the menu path.
          installSectionEl.hidden = false;
          if (installFallbackEl) installFallbackEl.hidden = false;
          if (installBtn) installBtn.hidden = true;
        }
      }, 1500);
    }
    void canPrompt;
  }

  // ---------- Events ----------
  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    ensureTodayFresh();
    var res = addTask(inputEl.value, timeEl ? timeEl.value : null);
    if (!res.ok) {
      showError(res.error);
      inputEl.focus();
      return;
    }
    hideError();
    inputEl.value = "";
    if (timeEl) timeEl.value = "";
    inputEl.focus();
  });

  inputEl.addEventListener("input", function () {
    if (!errorEl.hidden && inputEl.value.trim()) hideError();
  });

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
    } else if (action === "delete") {
      deleteTask(id);
    } else if (action === "edit") {
      var task = findTask(id);
      if (task) renderEditMode(li, task);
    } else if (action === "save") {
      var field = li.querySelector(".edit-input");
      var res = commitEdit(id, field ? field.value : "");
      if (!res.ok && res.error) {
        showError(res.error);
        if (field) field.focus();
      } else {
        hideError();
      }
    } else if (action === "cancel") {
      renderTasks();
    }
  });

  // ---------- Midnight rollover (no refresh required) ----------
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
          // Legacy callback form (older Samsung Internet).
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
  // Deep-link from notification tap: ?task=<id> or SW postMessage.
  try {
    var q = new URLSearchParams(window.location.search || "");
    var deep = q.get("task");
    if (deep) {
      window.setTimeout(function () { focusTask(deep); }, 300);
    }
  } catch (e) { /* ignore */ }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (ev) {
      if (ev.data && ev.data.type === "FOCUS_TASK") focusTask(ev.data.taskId);
    });
  }

  // Safe test seam (does not alter prod behavior unless override is set externally).
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
      getState: function () { return state; }
    };
  }
})();
