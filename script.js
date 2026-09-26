/* Fikra To-Do — Phase One
   Sections: constants | date utils | storage | state + task ops | rendering | events | init
   Future i18n: all UI strings live in STRINGS so EN/AR toggle can be added later.
*/
(function () {
  "use strict";

  var STORAGE_KEY = "fikra-todo-v1";
  var MAX_TEXT_LENGTH = 500;
  var ROLLOVER_CHECK_MS = 30000;

  // Centralized UI strings (future localization point).
  var STRINGS = {
    emptyTaskError: "Please type a task before adding.",
    storageUnavailable: "Browser storage is unavailable — tasks will work for this session only and won't persist after reload.",
    summaryNone: "0 of 0 tasks completed",
    loadDateFallback: "Today"
  };

  // ---------- DOM ----------
  var dateEl = document.getElementById("current-date");
  var formEl = document.getElementById("task-form");
  var inputEl = document.getElementById("task-input");
  var errorEl = document.getElementById("form-error");
  var listEl = document.getElementById("task-list");
  var emptyStateEl = document.getElementById("empty-state");
  var summaryTextEl = document.getElementById("summary-text");
  var summaryPctEl = document.getElementById("summary-pct");
  var progressBarEl = document.getElementById("progress-bar");
  var progressFillEl = document.getElementById("progress-fill");
  var celebrationEl = document.getElementById("celebration");
  var storageWarningEl = document.getElementById("storage-warning");

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

  // ---------- Storage ----------
  var memoryFallback = null;
  var storageOK = true;

  function isValidTask(t, index) {
    return (
      t &&
      typeof t.id === "string" &&
      typeof t.text === "string" &&
      typeof t.completed === "boolean" &&
      typeof t.createdAt === "number" &&
      typeof t.order === "number"
    );
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
      var clean = parsed.tasks.filter(isValidTask).map(function (t) {
        return {
          id: t.id,
          text: t.text.slice(0, MAX_TEXT_LENGTH),
          completed: t.completed,
          createdAt: t.createdAt,
          order: t.order
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

  function addTask(rawText) {
    var text = (rawText || "").trim();
    if (!text) return { ok: false, error: STRINGS.emptyTaskError };
    text = text.slice(0, MAX_TEXT_LENGTH);
    state.tasks.push({
      id: makeId(),
      text: text,
      completed: false,
      createdAt: Date.now(),
      order: nextOrder()
    });
    saveState(state);
    renderTasks();
    renderSummary();
    return { ok: true };
  }

  function toggleTask(id) {
    var t = findTask(id);
    if (!t) return;
    t.completed = !t.completed;
    saveState(state);
    renderTasks();
    renderSummary();
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

  // ---------- Rendering (safe: textContent only, never innerHTML with user text) ----------
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
      li.className = "task-item" + (task.completed ? " completed" : "");
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

      // Text (dir=auto handles Arabic/English/mixed per-item)
      var span = document.createElement("span");
      span.className = "task-text";
      span.setAttribute("dir", "auto");
      span.textContent = task.text;

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
      li.appendChild(span);
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

        var span = document.createElement("span");
        span.className = "task-text";
        span.setAttribute("dir", "auto");
        span.textContent = t.text;

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
        row.appendChild(span);
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

  // ---------- Events ----------
  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    ensureTodayFresh();
    var res = addTask(inputEl.value);
    if (!res.ok) {
      showError(res.error);
      inputEl.focus();
      return;
    }
    hideError();
    inputEl.value = "";
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
      ensureTodayFresh();
      renderDate();
    }, ROLLOVER_CHECK_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        ensureTodayFresh();
        renderDate();
      }
    });
    window.addEventListener("focus", function () {
      ensureTodayFresh();
      renderDate();
    });
  }

  // ---------- Init ----------
  ensureTodayFresh();
  if (!storageOK) showStorageWarning();
  renderAll();
  startRolloverWatch();

  // Safe test seam (does not alter prod behavior unless override is set externally).
  if (typeof window !== "undefined") {
    window.__fikraTest = {
      getLocalDateKey: getLocalDateKey,
      todayKey: todayKey,
      blankState: blankState,
      isValidTask: isValidTask
    };
  }
})();
