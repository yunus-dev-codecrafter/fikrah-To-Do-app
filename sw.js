/* Fikra To-Do — Service Worker
   Offline-first cache for core files + persistent reminder notifications.
   No backend, no push. The page detects due tasks and asks the SW to show
   a persistent notification (works on installed Android PWA where supported).
*/
"use strict";

var CACHE = "fikra-todo-v2";
var CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
        return Promise.resolve(false);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  // Only handle same-origin; let cross-origin pass through.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        // Opportunistically cache successful same-origin GETs for offline use.
        if (res && (res.status === 200 || res.type === "opaque")) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      }).catch(function () {
        // Offline fallback: serve cached app shell for navigations.
        if (req.mode === "navigate") {
          return caches.match("./index.html");
        }
        throw new Error("offline");
      });
    })
  );
});

// Page-initiated reminder: navigator.serviceWorker.ready.then(reg =>
//   reg.showNotification(...)) lands here for display bookkeeping only.
// Tapping a notification focuses/opens the app at the relevant task.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var taskId = event.notification.data && event.notification.data.taskId;
  var target = "./" + (taskId ? "?task=" + encodeURIComponent(taskId) : "");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        try {
          var u = new URL(c.url);
          if (u.origin === self.location.origin) {
            if (taskId) {
              c.postMessage({ type: "FOCUS_TASK", taskId: taskId });
            }
            return c.focus();
          }
        } catch (e) { /* fall through to openWindow */ }
      }
      return self.clients.openWindow(target);
    })
  );
});
