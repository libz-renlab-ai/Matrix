#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../digital-twin/src/bin-uploader.ts
var bin_uploader_exports = {};
__export(bin_uploader_exports, {
  runDaemon: () => runDaemon
});
module.exports = __toCommonJS(bin_uploader_exports);
var import_node_os8 = require("os");

// ../digital-twin/src/paths.ts
var import_node_os = require("os");
var import_node_path = require("path");
function digitalTwinPaths(home = (0, import_node_os.homedir)()) {
  const teamagentDir = (0, import_node_path.join)(home, ".teamagent");
  const digitalTwinDir = (0, import_node_path.join)(teamagentDir, "digital-twin");
  const queueDir = (0, import_node_path.join)(digitalTwinDir, "queue");
  return {
    teamagentDir,
    digitalTwinDir,
    configFile: (0, import_node_path.join)(teamagentDir, "digital-twin.json"),
    machineIdFile: (0, import_node_path.join)(digitalTwinDir, "machine-id"),
    queueDir,
    pendingDir: (0, import_node_path.join)(queueDir, "pending"),
    deadLetterDir: (0, import_node_path.join)(queueDir, "dead-letter"),
    recordingTempDir: (0, import_node_path.join)(queueDir, "recording_temp"),
    daemonPidFile: (0, import_node_path.join)(digitalTwinDir, "daemon.pid"),
    lastHourlyScanFile: (0, import_node_path.join)(digitalTwinDir, "last-hourly-scan.txt"),
    quotaCacheFile: (0, import_node_path.join)(digitalTwinDir, "quota-cache.json"),
    uploaderLogFile: (0, import_node_path.join)(digitalTwinDir, "uploader.log")
  };
}
var DEFAULT_PATHS = digitalTwinPaths();

// ../digital-twin/src/limits.ts
var MAX_PAYLOAD_BYTES = 100 * 1024 * 1024;

// ../digital-twin/src/identity.ts
var import_node_child_process = require("child_process");
var import_node_fs = require("fs");
var import_node_os2 = require("os");
var import_node_path2 = require("path");

// ../../node_modules/.pnpm/ulid@2.4.0/node_modules/ulid/dist/index.esm.js
function createError(message) {
  const err = new Error(message);
  err.source = "ulid";
  return err;
}
var ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var ENCODING_LEN = ENCODING.length;
var TIME_MAX = Math.pow(2, 48) - 1;
var TIME_LEN = 10;
var RANDOM_LEN = 16;
function randomChar(prng) {
  let rand = Math.floor(prng() * ENCODING_LEN);
  if (rand === ENCODING_LEN) {
    rand = ENCODING_LEN - 1;
  }
  return ENCODING.charAt(rand);
}
function encodeTime(now, len) {
  if (isNaN(now)) {
    throw new Error(now + " must be a number");
  }
  if (now > TIME_MAX) {
    throw createError("cannot encode time greater than " + TIME_MAX);
  }
  if (now < 0) {
    throw createError("time must be positive");
  }
  if (Number.isInteger(Number(now)) === false) {
    throw createError("time must be an integer");
  }
  let mod;
  let str = "";
  for (; len > 0; len--) {
    mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = (now - mod) / ENCODING_LEN;
  }
  return str;
}
function encodeRandom(len, prng) {
  let str = "";
  for (; len > 0; len--) {
    str = randomChar(prng) + str;
  }
  return str;
}
function detectPrng(allowInsecure = false, root) {
  if (!root) {
    root = typeof window !== "undefined" ? window : null;
  }
  const browserCrypto = root && (root.crypto || root.msCrypto);
  if (browserCrypto) {
    return () => {
      const buffer = new Uint8Array(1);
      browserCrypto.getRandomValues(buffer);
      return buffer[0] / 255;
    };
  } else {
    try {
      const nodeCrypto = require("crypto");
      return () => nodeCrypto.randomBytes(1).readUInt8() / 255;
    } catch (e) {
    }
  }
  if (allowInsecure) {
    try {
      console.error("secure crypto unusable, falling back to insecure Math.random()!");
    } catch (e) {
    }
    return () => Math.random();
  }
  throw createError("secure crypto unusable, insecure Math.random not allowed");
}
function factory(currPrng) {
  if (!currPrng) {
    currPrng = detectPrng();
  }
  return function ulid2(seedTime) {
    if (isNaN(seedTime)) {
      seedTime = Date.now();
    }
    return encodeTime(seedTime, TIME_LEN) + encodeRandom(RANDOM_LEN, currPrng);
  };
}
var ulid = factory();

// ../digital-twin/src/config.ts
var import_node_fs2 = require("fs");
var import_node_path3 = require("path");
function loadConfig(file = DEFAULT_PATHS.configFile) {
  if (!(0, import_node_fs2.existsSync)(file)) return null;
  try {
    const raw = (0, import_node_fs2.readFileSync)(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function isEnabled(config) {
  if (!config) return false;
  if (!config.uploader.enabled) return false;
  if (!config.uploader.token) return false;
  return true;
}

// ../digital-twin/src/mock-server.ts
var import_node_http = require("http");
var import_node_zlib = require("zlib");
var import_node_fs4 = require("fs");
var import_node_crypto = require("crypto");
var import_node_path5 = require("path");

// ../digital-twin/src/dashboard-html.ts
var DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>TeamAgent Collector</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f6f7f9; color: #222; }
header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #1f2937; color: #fff; border-bottom: 1px solid #111; }
header h1 { font-size: 16px; margin: 0; font-weight: 600; }
header .ts { color: #9ca3af; font-size: 12px; margin-left: auto; }
header button { background: #2563eb; color: #fff; border: 0; border-radius: 4px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
header button:hover { background: #1d4ed8; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 8px; padding: 8px; height: 38vh; }
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; display: flex; flex-direction: column; min-height: 0; }
.panel h2 { margin: 0; padding: 8px 10px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; }
.panel ul { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
.panel li { padding: 6px 10px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
.panel li:hover { background: #f9fafb; }
.panel li.sel { background: #dbeafe; color: #1e3a8a; font-weight: 500; }
.panel li .meta { color: #9ca3af; font-size: 11px; margin-left: 8px; }
.preview { margin: 0 8px 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; min-height: 30vh; max-height: 50vh; overflow: auto; }
.preview h2 { margin: 0 0 8px; font-size: 13px; color: #6b7280; }
.preview pre { margin: 0; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.preview .ev { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
.preview .ev .k { color: #7c3aed; }
.preview .ev .s { color: #059669; }
.preview .ev .n { color: #dc2626; }
.preview audio { width: 100%; }
.empty { color: #9ca3af; font-size: 13px; padding: 8px; }
.err { color: #dc2626; font-size: 12px; padding: 8px; }
.user-row { display: flex; align-items: center; gap: 6px; }
.user-row .uname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-row .qslot { display: inline-flex; align-items: center; gap: 4px; }
.qbar { display: inline-block; width: 60px; height: 8px; background: #e5e7eb; border-radius: 3px; overflow: hidden; vertical-align: middle; }
.qbar > span { display: block; height: 100%; width: 0%; background: #9ca3af; transition: width 0.2s ease; }
.qbar.ok > span { background: #10b981; }
.qbar.warn > span { background: #f59e0b; }
.qbar.hot > span { background: #ef4444; }
.qbar.stale { border: 1px dashed #9ca3af; opacity: 0.5; }
.qbadge { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 10px; color: #6b7280; min-width: 30px; text-align: right; }
</style>
</head>
<body>
<header>
  <h1>TeamAgent Collector</h1>
  <span class="ts" id="ts"></span>
  <button id="refresh">Refresh</button>
</header>
<div class="grid">
  <div class="panel"><h2>Users</h2><ul id="users"><li class="empty">loading...</li></ul></div>
  <div class="panel"><h2>Dates</h2><ul id="dates"><li class="empty">select a user</li></ul></div>
  <div class="panel"><h2>Sessions</h2><ul id="sessions"><li class="empty">select a date</li></ul></div>
</div>
<div class="preview">
  <h2 id="ph">Preview</h2>
  <div id="pv"><div class="empty">select a session</div></div>
</div>
<script>
(function () {
  var sel = { user: null, date: null, sid: null, sext: null };
  var $ = function (id) { return document.getElementById(id); };
  function setTs() {
    var d = new Date();
    $('ts').textContent = 'last refreshed ' + d.toLocaleTimeString();
  }
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function render(ulId, items, fn) {
    var ul = $(ulId);
    ul.innerHTML = '';
    if (!items || items.length === 0) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '(empty)';
      ul.appendChild(li);
      return;
    }
    items.forEach(function (it) {
      var li = document.createElement('li');
      fn(li, it);
      ul.appendChild(li);
    });
  }
  function showErr(ulId, msg) {
    var ul = $(ulId);
    ul.innerHTML = '<li class="err">' + escHtml(msg) + '</li>';
  }
  function quotaBucket(util) {
    if (typeof util !== 'number' || !isFinite(util) || util < 0) return 'ok';
    if (util >= 0.8) return 'hot';
    if (util >= 0.5) return 'warn';
    return 'ok';
  }
  function todayUtc() {
    return new Date().toISOString().slice(0, 10);
  }
  function quotaSlotHtml(util, stale) {
    var bucket = quotaBucket(util);
    var pct = Math.max(0, Math.min(1, util)) * 100;
    var pctText = Math.round(pct) + '%';
    var staleCls = stale ? ' stale' : '';
    return '<span class="qslot">'
      + '<span class="qbar ' + bucket + staleCls + '"><span style="width:' + pct.toFixed(1) + '%"></span></span>'
      + '<span class="qbadge">' + pctText + '</span>'
      + '</span>';
  }
  function quotaPendingHtml() {
    return '<span class="qslot">'
      + '<span class="qbar"><span></span></span>'
      + '<span class="qbadge">\u2014</span>'
      + '</span>';
  }
  function fetchQuotaFor(u, li) {
    var url = '/api/quota?user=' + encodeURIComponent(u) + '&date=' + encodeURIComponent(todayUtc());
    fetch(url).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (q) {
      if (!q || !li) return;
      var slots = li.querySelectorAll('.qslot');
      if (slots.length < 2) return;
      var stale = !!q.stale;
      var h5 = quotaSlotHtml(Number(q.five_hour_utilization) || 0, stale);
      var h7 = quotaSlotHtml(Number(q.seven_day_utilization) || 0, stale);
      slots[0].outerHTML = h5;
      slots[1].outerHTML = h7;
    }).catch(function () { /* keep \u2014 placeholder */ });
  }
  function loadUsers() {
    sel.user = sel.date = sel.sid = sel.sext = null;
    $('dates').innerHTML = '<li class="empty">select a user</li>';
    $('sessions').innerHTML = '<li class="empty">select a date</li>';
    $('pv').innerHTML = '<div class="empty">select a session</div>';
    $('ph').textContent = 'Preview';
    fetch('/api/users').then(function (r) { return r.json(); }).then(function (d) {
      var liByUser = {};
      render('users', d.users, function (li, u) {
        li.innerHTML = '<div class="user-row">'
          + '<span class="uname">' + escHtml(u) + '</span>'
          + quotaPendingHtml()
          + quotaPendingHtml()
          + '</div>';
        li.onclick = function () { selectUser(u, li); };
        liByUser[u] = li;
      });
      setTs();
      if (d.users && d.users.length) {
        d.users.forEach(function (u) {
          fetchQuotaFor(u, liByUser[u]);
        });
      }
    }).catch(function (e) { showErr('users', 'failed: ' + e.message); });
  }
  function selectUser(u, li) {
    sel.user = u; sel.date = sel.sid = sel.sext = null;
    Array.prototype.forEach.call($('users').querySelectorAll('li'), function (x) { x.classList.remove('sel'); });
    if (li) li.classList.add('sel');
    $('sessions').innerHTML = '<li class="empty">select a date</li>';
    $('pv').innerHTML = '<div class="empty">select a session</div>';
    $('dates').innerHTML = '<li class="empty">loading...</li>';
    fetch('/api/dates?user=' + encodeURIComponent(u)).then(function (r) { return r.json(); }).then(function (d) {
      render('dates', d.dates, function (li2, dt) {
        li2.textContent = dt;
        li2.onclick = function () { selectDate(dt, li2); };
      });
    }).catch(function (e) { showErr('dates', 'failed: ' + e.message); });
  }
  function selectDate(dt, li) {
    sel.date = dt; sel.sid = sel.sext = null;
    Array.prototype.forEach.call($('dates').querySelectorAll('li'), function (x) { x.classList.remove('sel'); });
    if (li) li.classList.add('sel');
    $('pv').innerHTML = '<div class="empty">select a session</div>';
    $('sessions').innerHTML = '<li class="empty">loading...</li>';
    var url = '/api/sessions?user=' + encodeURIComponent(sel.user) + '&date=' + encodeURIComponent(dt);
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      render('sessions', d.sessions, function (li2, s) {
        var size = s.size < 1024 ? s.size + ' B' : (s.size / 1024).toFixed(1) + ' KB';
        li2.innerHTML = '<span>' + escHtml(s.id) + '.' + escHtml(s.ext) + '</span><span class="meta">' + size + '</span>';
        li2.onclick = function () { selectSession(s, li2); };
      });
    }).catch(function (e) { showErr('sessions', 'failed: ' + e.message); });
  }
  function selectSession(s, li) {
    sel.sid = s.id; sel.sext = s.ext;
    Array.prototype.forEach.call($('sessions').querySelectorAll('li'), function (x) { x.classList.remove('sel'); });
    if (li) li.classList.add('sel');
    var url = '/api/file?user=' + encodeURIComponent(sel.user) + '&date=' + encodeURIComponent(sel.date) + '&id=' + encodeURIComponent(s.id) + '&ext=' + encodeURIComponent(s.ext);
    $('ph').textContent = s.id + '.' + s.ext;
    if (s.ext === 'ogg') {
      $('pv').innerHTML = '<audio controls preload="metadata" src="' + escHtml(url) + '"></audio>';
      return;
    }
    $('pv').innerHTML = '<div class="empty">loading...</div>';
    fetch(url).then(function (r) { return r.text(); }).then(function (t) {
      renderJsonl(t);
    }).catch(function (e) { $('pv').innerHTML = '<div class="err">failed: ' + escHtml(e.message) + '</div>'; });
  }
  function renderJsonl(text) {
    var lines = text.split(/\\r?\\n/);
    var html = '';
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      count++;
      try {
        var obj = JSON.parse(line);
        html += '<div class="ev"><pre>' + colorize(JSON.stringify(obj, null, 2)) + '</pre></div>';
      } catch (e) {
        html += '<div class="ev"><pre>' + escHtml(line) + '</pre></div>';
      }
      if (count >= 500) {
        html += '<div class="empty">(truncated at 500 events)</div>';
        break;
      }
    }
    if (count === 0) html = '<div class="empty">(empty)</div>';
    $('pv').innerHTML = html;
  }
  function colorize(s) {
    var esc = escHtml(s);
    esc = esc.replace(/(&quot;[^&]*?&quot;)(\\s*:)/g, '<span class="k">$1</span>$2');
    esc = esc.replace(/:\\s*(&quot;[^&]*?&quot;)/g, function (m, p) { return ': <span class="s">' + p + '</span>'; });
    esc = esc.replace(/:\\s*(-?\\d+(?:\\.\\d+)?)/g, ': <span class="n">$1</span>');
    return esc;
  }
  $('refresh').onclick = loadUsers;
  loadUsers();
})();
</script>
</body>
</html>`;

// ../digital-twin/src/videos-html.ts
var VIDEOS_DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Team Videos \u2014 TeamBrain</title>
<style>
  :root {
    --bg: #0b1220;
    --bg-panel: #131c2f;
    --bg-card: #1a2438;
    --border: #243049;
    --ink: #e8eef7;
    --mute: #93a4c1;
    --accent: #5b9bff;
    --accent-2: #8b6cff;
    --ok: #2ea043;
    --warn: #d29922;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "SF Pro Text", BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(180deg, #0b1220 0%, #0a1a2e 100%);
    color: var(--ink);
    min-height: 100vh;
  }
  header {
    display: flex; align-items: center; gap: 16px;
    padding: 18px 28px;
    border-bottom: 1px solid var(--border);
    background: rgba(11, 18, 32, 0.85);
    backdrop-filter: saturate(140%) blur(8px);
    position: sticky; top: 0; z-index: 10;
  }
  .logo {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px; color: white;
  }
  h1 { font-size: 18px; font-weight: 600; margin: 0; letter-spacing: -0.2px; }
  .sub { color: var(--mute); font-size: 12px; margin-left: 4px; }
  .nav-right { margin-left: auto; display: flex; gap: 10px; align-items: center; }
  .badge {
    background: rgba(91, 155, 255, 0.15);
    color: var(--accent);
    border: 1px solid rgba(91, 155, 255, 0.35);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .refresh {
    background: rgba(255,255,255,0.06);
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .refresh:hover { background: rgba(255,255,255,0.1); }

  .layout {
    display: grid;
    grid-template-columns: minmax(320px, 380px) 1fr;
    gap: 18px;
    padding: 18px 28px 28px;
    max-width: 1480px;
    margin: 0 auto;
  }

  .left { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .summary {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  }
  .stat {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
  }
  .stat .lbl { color: var(--mute); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .val { font-size: 20px; font-weight: 600; margin-top: 4px; }

  .list-card {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    display: flex; flex-direction: column;
    flex: 1; min-height: 0;
  }
  .list-card h2 {
    margin: 0; padding: 12px 16px;
    font-size: 12px; font-weight: 600; color: var(--mute);
    text-transform: uppercase; letter-spacing: 0.6px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .list-card h2 .count { color: var(--ink); font-weight: 700; }

  .vlist { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; max-height: 70vh; }
  .vitem {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(36, 48, 73, 0.6);
    cursor: pointer;
    transition: background 100ms ease;
    display: flex; align-items: flex-start; gap: 12px;
  }
  .vitem:hover { background: rgba(91, 155, 255, 0.06); }
  .vitem.sel { background: rgba(91, 155, 255, 0.14); border-left: 3px solid var(--accent); padding-left: 13px; }
  .vthumb {
    width: 56px; height: 36px;
    background: linear-gradient(135deg, #2a3550 0%, #1e2842 100%);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--border);
  }
  .vthumb .play { color: var(--accent); font-size: 14px; }
  .vbody { flex: 1; min-width: 0; }
  .vlabel { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vmeta { font-size: 11px; color: var(--mute); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .vmeta .who { color: var(--accent); font-weight: 600; }
  .vmeta .when { color: var(--mute); }
  .vmeta .ext {
    background: rgba(139, 108, 255, 0.15);
    color: var(--accent-2);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .right {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .player-head {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px;
  }
  .player-head .title { font-size: 15px; font-weight: 600; }
  .player-head .meta { color: var(--mute); font-size: 12px; margin-left: 4px; }
  .player-head .share {
    margin-left: auto;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
    color: white;
    border: 0;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .player-head .share:hover { opacity: 0.92; }
  .player-body { padding: 18px; flex: 1; display: flex; flex-direction: column; gap: 14px; }
  video {
    width: 100%; max-height: 56vh;
    border-radius: 10px;
    background: black;
    border: 1px solid var(--border);
  }
  .link-row {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    display: flex; gap: 10px; align-items: center;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 12px;
  }
  .link-row .url { color: var(--mute); flex: 1; overflow-x: auto; white-space: nowrap; }
  .link-row .copy {
    background: rgba(91, 155, 255, 0.15);
    color: var(--accent);
    border: 1px solid rgba(91, 155, 255, 0.3);
    border-radius: 5px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
  .link-row .copy:hover { background: rgba(91, 155, 255, 0.25); }
  .link-row .copy.copied { background: rgba(46, 160, 67, 0.2); color: var(--ok); border-color: var(--ok); }

  .details {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    font-size: 12px;
  }
  .detail { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }
  .detail .lbl { color: var(--mute); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .detail .val { color: var(--ink); font-weight: 500; word-break: break-all; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; }

  .empty { padding: 80px 30px; color: var(--mute); text-align: center; font-size: 13px; }
  .empty .big { font-size: 16px; color: var(--ink); margin-bottom: 8px; font-weight: 500; }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .right { min-height: 60vh; }
  }
</style>
</head>
<body>
<header>
  <div class="logo">TB</div>
  <h1>Team Videos <span class="sub">\u2014 TeamBrain Feature #3</span></h1>
  <div class="nav-right">
    <span class="badge">LIVE</span>
    <button class="refresh" onclick="loadVideos()">\u21BB Refresh</button>
  </div>
</header>

<div class="layout">
  <div class="left">
    <div class="summary">
      <div class="stat"><div class="lbl">Total uploads</div><div class="val" id="stat-total">\u2026</div></div>
      <div class="stat"><div class="lbl">Teammates</div><div class="val" id="stat-users">\u2026</div></div>
    </div>
    <div class="list-card">
      <h2>Recent uploads <span class="count" id="list-count"></span></h2>
      <ul class="vlist" id="vlist">
        <li class="empty"><div class="big">Loading\u2026</div></li>
      </ul>
    </div>
  </div>
  <div class="right" id="player">
    <div class="empty">
      <div class="big">Select an upload from the list</div>
      Pick any video on the left to preview, copy a share link, and see who shipped it.
    </div>
  </div>
</div>

<script>
let videos = [];
let selectedIdx = -1;

// Escape every user-controlled string before it touches innerHTML / attribute
// interpolation. Required because label, id, user_id, sha256, captured_at,
// container, and link all originate from the upload envelope written by the
// CLI \u2014 a hostile teammate could otherwise stuff <script> into --label and
// the boss's browser would execute it on /videos.
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"'\\/]/g, function (c) {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      case '/': return '&#x2F;';
      default: return c;
    }
  });
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/(1024*1024)).toFixed(2) + ' MB';
}
function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
}

function renderList() {
  const ul = document.getElementById('vlist');
  document.getElementById('list-count').textContent = videos.length;
  document.getElementById('stat-total').textContent = videos.length;
  document.getElementById('stat-users').textContent = new Set(videos.map(v => v.user_id)).size;
  if (videos.length === 0) {
    ul.innerHTML = '<li class="empty"><div class="big">No videos yet</div>Run <code>teamagent video upload &lt;file&gt;</code> from any teammate to get started.</li>';
    return;
  }
  ul.innerHTML = videos.map((v, i) => {
    const sel = i === selectedIdx ? ' sel' : '';
    return [
      '<li class="vitem' + sel + '" onclick="selectVideo(' + i + ')">',
        '<div class="vthumb"><span class="play">\u25B6</span></div>',
        '<div class="vbody">',
          '<div class="vlabel">' + esc(v.label || v.id) + '</div>',
          '<div class="vmeta">',
            '<span class="who">@' + esc(v.user_id) + '</span>',
            '<span class="when">' + esc(v.date) + ' \xB7 ' + formatBytes(v.size) + '</span>',
            '<span class="ext">' + esc(v.container) + '</span>',
          '</div>',
        '</div>',
      '</li>'
    ].join('');
  }).join('');
}

function selectVideo(i) {
  selectedIdx = i;
  renderList();
  const v = videos[i];
  // Build the link via URL to defang any injected javascript: / data: schemes
  // and to keep the server-supplied path-encoding intact. window.location.origin
  // is always http(s)://host[:port], so absolute URLs win and we fall through
  // to URL() only for server-relative links.
  let link;
  try {
    const base = v.link.startsWith('http') ? v.link : window.location.origin + v.link;
    const u = new URL(base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported protocol');
    link = u.toString();
  } catch {
    link = '';
  }
  const linkEsc = esc(link);
  // Pass the link to copyLink via the DOM (dataset) instead of inline JS so a
  // crafted link can't break out of the attribute. The handler reads
  // event.currentTarget.dataset.link, which the browser already escapes.
  document.getElementById('player').innerHTML = [
    '<div class="player-head">',
      '<div>',
        '<div class="title">' + esc(v.label || 'Untitled upload') + '</div>',
        '<div class="meta">by <strong style="color:var(--accent)">@' + esc(v.user_id) + '</strong> \xB7 ' + esc(v.date) + ' \xB7 ' + formatBytes(v.size) + '</div>',
      '</div>',
      '<button class="share" data-link="' + linkEsc + '" onclick="copyLinkFromBtn(this)">Share link</button>',
    '</div>',
    '<div class="player-body">',
      '<video controls preload="metadata" src="' + linkEsc + '"></video>',
      '<div class="link-row">',
        '<span class="url">' + linkEsc + '</span>',
        '<button class="copy" data-link="' + linkEsc + '" onclick="copyLinkFromBtn(this)">Copy</button>',
      '</div>',
      '<div class="details">',
        '<div class="detail"><div class="lbl">Upload ID</div><div class="val">' + esc(v.id) + '</div></div>',
        '<div class="detail"><div class="lbl">SHA-256</div><div class="val">' + esc(v.sha256 || '\u2014') + '</div></div>',
        '<div class="detail"><div class="lbl">Container</div><div class="val">' + esc((v.container || '').toUpperCase()) + '</div></div>',
        '<div class="detail"><div class="lbl">Captured at</div><div class="val">' + esc(formatWhen(v.captured_at)) + '</div></div>',
      '</div>',
    '</div>'
  ].join('');
}

function copyLinkFromBtn(btn) {
  copyLink(btn.dataset.link || '', btn);
}

function copyLink(link, btn) {
  navigator.clipboard.writeText(link).then(() => {
    const orig = btn.textContent;
    btn.textContent = '\u2713 Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
  }).catch(() => {});
}

async function loadVideos() {
  try {
    const r = await fetch('/api/videos');
    const j = await r.json();
    videos = j.videos || [];
    renderList();
    if (videos.length > 0 && selectedIdx === -1) {
      // ?select=<idx> URL param picks a video on first paint (used by
      // screenshot tooling). Default = newest.
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('select');
      const idx = raw === null ? 0 : Math.max(0, Math.min(videos.length - 1, Number(raw) || 0));
      selectVideo(idx);
    }
  } catch (e) {
    document.getElementById('vlist').innerHTML = '<li class="empty"><div class="big">Failed to load</div>' + String(e) + '</li>';
  }
}

loadVideos();
</script>
</body>
</html>`;

// ../digital-twin/src/cc-status/path-safety.ts
function safeUserId(raw) {
  if (typeof raw !== "string" || raw.length === 0) return "unknown";
  let cleaned = raw.replace(/[^a-zA-Z0-9._@+-]/g, "_").slice(0, 80);
  cleaned = cleaned.replace(/\.{2,}/g, "_");
  cleaned = cleaned.replace(/^[._-]+/, "").replace(/[._-]+$/, "");
  return cleaned.length > 0 ? cleaned : "unknown";
}
function dateStamp(raw, now) {
  let d = now;
  if (typeof raw === "string" && raw.length > 0) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
var WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function isUnreservedComponent(name) {
  if (name.includes("..")) return false;
  return !WINDOWS_RESERVED_RE.test(name);
}

// ../digital-twin/src/cc-status/store.ts
var import_node_fs3 = require("fs");
var import_node_path4 = require("path");

// ../digital-twin/src/cc-status/types.ts
var CC_STATUS_SCHEMA_VERSION = 1;

// ../digital-twin/src/cc-status/store.ts
var CC_STATUS_FILE_SUFFIX = ".cc-status.jsonl";
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var ID_RE = /^[A-Za-z0-9._-]+$/;
var MAX_DATE_DIRS = 60;
var MAX_FILES_PER_DIR = 500;
var MAX_USERS_PER_ALL = 500;
var MAX_HISTORY_ROWS = 5e3;
var CC_STATUS_FILE_CAP_BYTES = 2 * 1024 * 1024;
var CC_STATUS_KEEP_TAIL_BYTES = CC_STATUS_FILE_CAP_BYTES / 2;
var CC_STATUS_KEEP_TAIL_LINES = 5e3;
var STRING_FIELD_CAP = {
  cwd: 4096,
  session_started_at: 64,
  ts: 64,
  event: 64,
  model: 256,
  git_branch: 256,
  display_name: 256,
  machine_id: 256,
  subscription_tier: 256,
  // Issue #308 grill §3: raw prompt evidence. Cap at 64 KiB — comfortably
  // larger than typical CC prompts (≤8 KiB) but small enough that a hostile
  // client looping POSTs cannot fill disk through this single field. Anything
  // longer is truncated and persisted; downstream normalized_event extractors
  // see "<truncated>" rather than failing.
  raw_prompt: 65536
};
var DEFAULT_STRING_CAP = 256;
var SNAPSHOT_KEYS = [
  "schema_version",
  "session_id",
  "user_id",
  "ts",
  "event",
  "display_name",
  "machine_id",
  "cwd",
  "git_branch",
  "model",
  "context_tokens",
  "context_pct",
  "session_health",
  "cost_usd",
  "tokens_5h",
  "tokens_7d",
  "subscription_tier",
  "five_hour_utilization",
  "seven_day_utilization",
  "five_hour_reset_at",
  "seven_day_reset_at",
  "quota_stale",
  "turn_count",
  "tool_calls_total",
  "tool_calls_failed",
  "files_touched",
  "session_started_at",
  // Issue #308 grill §3 — raw prompt evidence. See STRING_FIELD_CAP for the cap.
  "raw_prompt"
];
var NUMERIC_KEYS = /* @__PURE__ */ new Set([
  "context_tokens",
  "context_pct",
  "cost_usd",
  "tokens_5h",
  "tokens_7d",
  "five_hour_utilization",
  "seven_day_utilization",
  "five_hour_reset_at",
  "seven_day_reset_at",
  "turn_count",
  "tool_calls_total",
  "tool_calls_failed",
  "files_touched"
]);
var STRING_KEYS = /* @__PURE__ */ new Set([
  "session_id",
  "user_id",
  "ts",
  "event",
  "display_name",
  "machine_id",
  "cwd",
  "git_branch",
  "model",
  "subscription_tier",
  "session_started_at",
  // Issue #308 grill §3 — raw prompt evidence. Capped at 64 KiB via STRING_FIELD_CAP.
  "raw_prompt"
]);
var BOOL_KEYS = /* @__PURE__ */ new Set(["quota_stale"]);
function isUnder(parent, child) {
  const p = (0, import_node_path4.resolve)(parent);
  const c = (0, import_node_path4.resolve)(child);
  if (c === p) return true;
  return c.startsWith(p + import_node_path4.sep);
}
function capString(key, val) {
  const cap = STRING_FIELD_CAP[key] ?? DEFAULT_STRING_CAP;
  return val.length > cap ? val.slice(0, cap) : val;
}
function sanitizeCcStatusSnapshot(v) {
  if (typeof v !== "object" || v === null) return null;
  const o = v;
  if (o.schema_version !== CC_STATUS_SCHEMA_VERSION) return null;
  if (typeof o.session_id !== "string" || !ID_RE.test(o.session_id) || !isUnreservedComponent(o.session_id)) {
    return null;
  }
  if (typeof o.event !== "string" || o.event.length === 0) return null;
  if (typeof o.ts !== "string" || o.ts.length > (STRING_FIELD_CAP.ts ?? DEFAULT_STRING_CAP) || Number.isNaN(Date.parse(o.ts))) {
    return null;
  }
  const userId = safeUserId(o.user_id);
  const out = {
    schema_version: CC_STATUS_SCHEMA_VERSION,
    session_id: o.session_id,
    user_id: userId,
    ts: o.ts,
    event: capString("event", o.event)
  };
  for (const key of SNAPSHOT_KEYS) {
    if (key in out) continue;
    const val = o[key];
    if (val === void 0 || val === null) continue;
    if (NUMERIC_KEYS.has(key)) {
      const n = typeof val === "number" ? val : Number(val);
      if (Number.isFinite(n)) out[key] = n;
    } else if (STRING_KEYS.has(key)) {
      if (typeof val === "string" && val.length > 0) out[key] = capString(key, val);
    } else if (BOOL_KEYS.has(key)) {
      if (typeof val === "boolean") out[key] = val;
    } else if (key === "session_health") {
      if (val === "OK" || val === "OVER_200K") out[key] = val;
    }
  }
  return out;
}
function ccStatusJsonlPath(outputDir, user, date, session) {
  return (0, import_node_path4.join)(outputDir, user, date, `${session}${CC_STATUS_FILE_SUFFIX}`);
}
function rotateIfOversize(file) {
  let size = 0;
  try {
    size = (0, import_node_fs3.statSync)(file).size;
  } catch {
    return;
  }
  if (size <= CC_STATUS_FILE_CAP_BYTES) return;
  try {
    const lines = readSnapshotLines(file).map((s) => JSON.stringify(s));
    if (lines.length === 0) return;
    const tail = [];
    let bytes = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lineBytes = Buffer.byteLength(line, "utf8") + 1;
      if (tail.length > 0 && (bytes + lineBytes > CC_STATUS_KEEP_TAIL_BYTES || tail.length >= CC_STATUS_KEEP_TAIL_LINES)) {
        break;
      }
      tail.push(line);
      bytes += lineBytes;
    }
    tail.reverse();
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    (0, import_node_fs3.writeFileSync)(tmp, `${tail.join("\n")}
`, "utf8");
    try {
      (0, import_node_fs3.renameSync)(tmp, file);
    } catch {
      try {
        (0, import_node_fs3.unlinkSync)(file);
      } catch {
      }
      (0, import_node_fs3.renameSync)(tmp, file);
    }
  } catch {
  }
}
function appendCcStatusSnapshot(outputDir, raw, now = /* @__PURE__ */ new Date()) {
  const snap = sanitizeCcStatusSnapshot(raw);
  if (!snap) return { ok: false, reason: "invalid" };
  const user = snap.user_id;
  const date = dateStamp(snap.ts, now);
  if (!DATE_RE.test(date)) return { ok: false, reason: "invalid" };
  const target = ccStatusJsonlPath(outputDir, user, date, snap.session_id);
  if (!isUnder(outputDir, target)) return { ok: false, reason: "path" };
  try {
    (0, import_node_fs3.mkdirSync)((0, import_node_path4.join)(outputDir, user, date), { recursive: true });
    rotateIfOversize(target);
    (0, import_node_fs3.appendFileSync)(target, `${JSON.stringify(snap)}
`, "utf8");
  } catch {
    return { ok: false, reason: "io" };
  }
  return { ok: true, user_id: user, date, session_id: snap.session_id };
}
function listDateDirs(userDir) {
  if (!(0, import_node_fs3.existsSync)(userDir)) return [];
  try {
    return (0, import_node_fs3.readdirSync)(userDir, { withFileTypes: true }).filter((d) => d.isDirectory() && DATE_RE.test(d.name)).map((d) => d.name).sort((a, b) => a < b ? 1 : a > b ? -1 : 0).slice(0, MAX_DATE_DIRS);
  } catch {
    return [];
  }
}
function listStatusFiles(dir) {
  if (!(0, import_node_fs3.existsSync)(dir)) return [];
  try {
    return (0, import_node_fs3.readdirSync)(dir, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith(CC_STATUS_FILE_SUFFIX)).map((d) => d.name).slice(0, MAX_FILES_PER_DIR);
  } catch {
    return [];
  }
}
function sessionIdFromFilename(name) {
  return name.slice(0, name.length - CC_STATUS_FILE_SUFFIX.length);
}
function readSnapshotLines(file) {
  let text;
  try {
    text = (0, import_node_fs3.readFileSync)(file, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.length === 0 || t[0] !== "{") continue;
    let parsed;
    try {
      parsed = JSON.parse(t);
    } catch {
      continue;
    }
    const snap = sanitizeCcStatusSnapshot(parsed);
    if (snap) out.push(snap);
  }
  return out;
}
function tsMs(snap) {
  const ms = Date.parse(snap.ts);
  return Number.isFinite(ms) ? ms : 0;
}
function withStaleSeconds(snap, nowMs) {
  const age = Math.max(0, Math.floor((nowMs - tsMs(snap)) / 1e3));
  return { ...snap, stale_seconds: age };
}
function readLatestPerSession(outputDir, user, now = /* @__PURE__ */ new Date()) {
  const userDir = (0, import_node_path4.join)(outputDir, user);
  if (!isUnder(outputDir, userDir)) return [];
  const latest = /* @__PURE__ */ new Map();
  for (const date of listDateDirs(userDir)) {
    const dir = (0, import_node_path4.join)(userDir, date);
    if (!isUnder(outputDir, dir)) continue;
    for (const fname of listStatusFiles(dir)) {
      const session = sessionIdFromFilename(fname);
      const file = (0, import_node_path4.join)(dir, fname);
      if (!isUnder(outputDir, file)) continue;
      const lines = readSnapshotLines(file);
      if (lines.length === 0) continue;
      let candidate = lines[0];
      for (const s of lines) if (tsMs(s) >= tsMs(candidate)) candidate = s;
      const existing = latest.get(session);
      if (!existing || tsMs(candidate) >= tsMs(existing)) latest.set(session, candidate);
    }
  }
  const nowMs = now.getTime();
  return [...latest.values()].map((s) => withStaleSeconds(s, nowMs)).sort((a, b) => tsMs(b) - tsMs(a));
}
function readLatestForSession(outputDir, user, session, now = /* @__PURE__ */ new Date()) {
  if (!ID_RE.test(session) || !isUnreservedComponent(session)) return null;
  return readLatestPerSession(outputDir, user, now).find((r) => r.session_id === session) ?? null;
}
function readLatestAllUsers(outputDir, now = /* @__PURE__ */ new Date()) {
  if (!(0, import_node_fs3.existsSync)(outputDir)) return [];
  let users;
  try {
    users = (0, import_node_fs3.readdirSync)(outputDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).filter((u) => safeUserId(u) === u).sort().slice(0, MAX_USERS_PER_ALL);
  } catch {
    return [];
  }
  const rows = [];
  for (const u of users) rows.push(...readLatestPerSession(outputDir, u, now));
  return rows.sort((a, b) => tsMs(b) - tsMs(a));
}
function readHistory(outputDir, user, session, sinceMs, now = /* @__PURE__ */ new Date()) {
  if (!ID_RE.test(session) || !isUnreservedComponent(session)) return [];
  const userDir = (0, import_node_path4.join)(outputDir, user);
  if (!isUnder(outputDir, userDir)) return [];
  const all = [];
  for (const date of listDateDirs(userDir)) {
    const file = ccStatusJsonlPath(outputDir, user, date, session);
    if (!isUnder(outputDir, file)) continue;
    if (!(0, import_node_fs3.existsSync)(file)) continue;
    all.push(...readSnapshotLines(file));
  }
  const cutoff = Number.isFinite(sinceMs) ? sinceMs : 0;
  const filtered = all.filter((s) => tsMs(s) >= cutoff).sort((a, b) => tsMs(a) - tsMs(b));
  const trimmed = filtered.length > MAX_HISTORY_ROWS ? filtered.slice(filtered.length - MAX_HISTORY_ROWS) : filtered;
  const nowMs = now.getTime();
  return trimmed.map((s) => withStaleSeconds(s, nowMs));
}

// ../digital-twin/src/mock-server.ts
var MAX_BODY_BYTES = 32 * 1024 * 1024;
var MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024;
var ROUTE_CC_SESSIONS = "/v1/cc-sessions";
var ROUTE_RECORDINGS = "/v1/recordings";
var ROUTE_CC_STATUS = "/v1/cc-status";
var ROUTE_VIDEOS = "/v1/videos";
var ALLOWED_VIDEO_CONTAINERS = /* @__PURE__ */ new Set(["mov", "mp4", "webm", "mkv"]);
var DATE_RE2 = /^\d{4}-\d{2}-\d{2}$/;
var ID_RE2 = /^[A-Za-z0-9._-]+$/;
function send(res, status, body) {
  res.statusCode = status;
  if (body !== void 0) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  } else {
    res.end();
  }
}
function validateUserParam(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return null;
  if (safeUserId(raw) !== raw) return null;
  return raw;
}
function validateDateParam(raw) {
  if (typeof raw !== "string") return null;
  if (!DATE_RE2.test(raw)) return null;
  const parts = raw.split("-");
  const yyyy = Number(parts[0]);
  const mm = Number(parts[1]);
  const dd = Number(parts[2]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) {
    return null;
  }
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  const probe = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (probe.getUTCFullYear() !== yyyy || probe.getUTCMonth() !== mm - 1 || probe.getUTCDate() !== dd) {
    return null;
  }
  return raw;
}
function validateIdParam(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw.includes("..")) return null;
  return ID_RE2.test(raw) ? raw : null;
}
function isValidQuotaBlock(v) {
  if (typeof v !== "object" || v === null) return false;
  const o = v;
  return typeof o.subscription_tier === "string" && typeof o.five_hour_utilization === "number" && Number.isFinite(o.five_hour_utilization) && typeof o.seven_day_utilization === "number" && Number.isFinite(o.seven_day_utilization) && typeof o.five_hour_reset_at === "number" && Number.isFinite(o.five_hour_reset_at) && typeof o.seven_day_reset_at === "number" && Number.isFinite(o.seven_day_reset_at) && typeof o.probed_at === "string" && typeof o.stale === "boolean";
}
function atomicWriteFileSync(target, data) {
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  (0, import_node_fs4.writeFileSync)(tmp, data);
  try {
    (0, import_node_fs4.renameSync)(tmp, target);
  } catch {
    try {
      (0, import_node_fs4.unlinkSync)(target);
    } catch {
    }
    (0, import_node_fs4.renameSync)(tmp, target);
  }
}
function validateExtParam(raw) {
  if (raw === "jsonl" || raw === "ogg" || raw === "mov" || raw === "mp4" || raw === "webm" || raw === "mkv") {
    return raw;
  }
  return null;
}
function contentTypeForExt(ext) {
  switch (ext) {
    case "jsonl":
      return "text/plain; charset=utf-8";
    case "ogg":
      return "audio/ogg";
    case "mov":
      return "video/quicktime";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
  }
}
function isUnder2(parent, child) {
  const p = (0, import_node_path5.resolve)(parent);
  const c = (0, import_node_path5.resolve)(child);
  if (c === p) return true;
  return c.startsWith(p + import_node_path5.sep);
}
function listDirNames(dir) {
  if (!(0, import_node_fs4.existsSync)(dir)) return [];
  try {
    return (0, import_node_fs4.readdirSync)(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}
function listSessions(dir) {
  if (!(0, import_node_fs4.existsSync)(dir)) return [];
  let entries = [];
  try {
    const files = (0, import_node_fs4.readdirSync)(dir, { withFileTypes: true }).filter((d) => d.isFile());
    for (const f of files) {
      const m = /^(.+)\.(jsonl|ogg)$/.exec(f.name);
      if (!m || m[1] === void 0 || m[2] === void 0) continue;
      const id = m[1];
      const ext = m[2];
      try {
        const st = (0, import_node_fs4.statSync)((0, import_node_path5.join)(dir, f.name));
        entries.push({
          id,
          ext,
          size: st.size,
          mtime: st.mtime.toISOString()
        });
      } catch {
      }
    }
  } catch {
    return [];
  }
  entries.sort((a, b) => a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0);
  return entries;
}
function parseQuery(url) {
  const idx = url.indexOf("?");
  return new URLSearchParams(idx >= 0 ? url.slice(idx + 1) : "");
}
var EPOCH_MS_THRESHOLD = 1e12;
var MAX_DATE_MS = 864e13;
function parseSinceMs(raw, nowMs) {
  let ms = nowMs - 24 * 60 * 60 * 1e3;
  if (typeof raw === "string" && raw.length > 0) {
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      if (Number.isFinite(n)) ms = n < EPOCH_MS_THRESHOLD ? n * 1e3 : n;
    } else {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) ms = parsed;
    }
  }
  if (!Number.isFinite(ms)) return 0;
  return Math.min(Math.max(0, ms), MAX_DATE_MS);
}
function handleGet(req, res, outputDir, now) {
  const url = req.url ?? "";
  const path2 = url.split("?")[0];
  if (path2 === "/" || path2 === "/index.html") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(DASHBOARD_HTML);
    return;
  }
  if (path2 === "/videos" || path2 === "/videos.html") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(VIDEOS_DASHBOARD_HTML);
    return;
  }
  const q = parseQuery(url);
  if (path2 === "/api/videos") {
    const videos = [];
    const allowedExts = /* @__PURE__ */ new Set(["mov", "mp4", "webm", "mkv"]);
    try {
      for (const userName of listDirNames(outputDir)) {
        if (safeUserId(userName) !== userName) continue;
        const userDir = (0, import_node_path5.join)(outputDir, userName);
        if (!isUnder2(outputDir, userDir)) continue;
        for (const dateName of listDirNames(userDir)) {
          if (!DATE_RE2.test(dateName)) continue;
          const dateDir = (0, import_node_path5.join)(userDir, dateName);
          if (!isUnder2(outputDir, dateDir)) continue;
          let files;
          try {
            files = (0, import_node_fs4.readdirSync)(dateDir);
          } catch {
            continue;
          }
          for (const fname of files) {
            const m = /^([A-Za-z0-9._-]+)\.([A-Za-z0-9]+)$/.exec(fname);
            if (!m) continue;
            const id = m[1];
            const ext = m[2].toLowerCase();
            if (!allowedExts.has(ext)) continue;
            if (id.includes("..")) continue;
            const full = (0, import_node_path5.join)(dateDir, fname);
            let size = 0;
            let mtime = "";
            try {
              const st = (0, import_node_fs4.statSync)(full);
              size = st.size;
              mtime = st.mtime.toISOString();
            } catch {
              continue;
            }
            const link = "/api/file?user=" + encodeURIComponent(userName) + "&date=" + encodeURIComponent(dateName) + "&id=" + encodeURIComponent(id) + "&ext=" + encodeURIComponent(ext);
            let label;
            let sha256;
            let capturedAt = mtime;
            try {
              const metaPath = (0, import_node_path5.join)(dateDir, id + ".meta.json");
              if (isUnder2(outputDir, metaPath) && (0, import_node_fs4.existsSync)(metaPath)) {
                const meta = JSON.parse((0, import_node_fs4.readFileSync)(metaPath, "utf8"));
                if (typeof meta.label === "string") label = meta.label;
                if (typeof meta.payload_sha256 === "string") sha256 = meta.payload_sha256;
                if (typeof meta.captured_at === "string") capturedAt = meta.captured_at;
              }
            } catch {
            }
            videos.push({
              id,
              user_id: userName,
              date: dateName,
              container: ext,
              size,
              sha256,
              label,
              captured_at: capturedAt,
              link
            });
          }
        }
      }
    } catch (err) {
      send(res, 500, {
        error: "list failed",
        detail: err instanceof Error ? err.message : String(err)
      });
      return;
    }
    videos.sort((a, b) => a.captured_at && b.captured_at ? a.captured_at < b.captured_at ? 1 : -1 : 0);
    send(res, 200, { videos });
    return;
  }
  if (path2 === "/api/cc-status/all") {
    send(res, 200, { sessions: readLatestAllUsers(outputDir, now()) });
    return;
  }
  if (path2 === "/api/cc-status/history") {
    const user = validateUserParam(q.get("user") ?? void 0);
    const session = validateIdParam(q.get("session") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    if (!session) {
      send(res, 400, { error: "invalid session" });
      return;
    }
    const sinceMs = parseSinceMs(q.get("since"), now().getTime());
    send(res, 200, {
      user_id: user,
      session_id: session,
      since: new Date(sinceMs).toISOString(),
      history: readHistory(outputDir, user, session, sinceMs, now())
    });
    return;
  }
  if (path2 === "/api/cc-status") {
    const user = validateUserParam(q.get("user") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    const sessionRaw = q.get("session");
    if (sessionRaw !== null) {
      const session = validateIdParam(sessionRaw);
      if (!session) {
        send(res, 400, { error: "invalid session" });
        return;
      }
      const row = readLatestForSession(outputDir, user, session, now());
      if (!row) {
        send(res, 404, { error: "not found" });
        return;
      }
      send(res, 200, row);
      return;
    }
    send(res, 200, { sessions: readLatestPerSession(outputDir, user, now()) });
    return;
  }
  if (path2 === "/api/users") {
    const users = listDirNames(outputDir).sort((a, b) => a.localeCompare(b));
    send(res, 200, { users });
    return;
  }
  if (path2 === "/api/dates") {
    const user = validateUserParam(q.get("user") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    const userDir = (0, import_node_path5.join)(outputDir, user);
    if (!isUnder2(outputDir, userDir)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    const dates = listDirNames(userDir).filter((n) => DATE_RE2.test(n)).sort((a, b) => a < b ? 1 : a > b ? -1 : 0);
    send(res, 200, { dates });
    return;
  }
  if (path2 === "/api/sessions") {
    const user = validateUserParam(q.get("user") ?? void 0);
    const date = validateDateParam(q.get("date") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    if (!date) {
      send(res, 400, { error: "invalid date" });
      return;
    }
    const dir = (0, import_node_path5.join)(outputDir, user, date);
    if (!isUnder2(outputDir, dir)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    send(res, 200, { sessions: listSessions(dir) });
    return;
  }
  if (path2 === "/api/quota") {
    const user = validateUserParam(q.get("user") ?? void 0);
    const date = validateDateParam(q.get("date") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    if (!date) {
      send(res, 400, { error: "invalid date" });
      return;
    }
    const quotaFile = (0, import_node_path5.join)(outputDir, user, date, "quota.json");
    if (!isUnder2(outputDir, quotaFile)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    if (!(0, import_node_fs4.existsSync)(quotaFile)) {
      send(res, 404, { error: "not found" });
      return;
    }
    try {
      const raw = (0, import_node_fs4.readFileSync)(quotaFile, "utf8");
      const parsed = JSON.parse(raw);
      send(res, 200, parsed);
    } catch (err) {
      send(res, 500, {
        error: "read failed",
        detail: err instanceof Error ? err.message : String(err)
      });
    }
    return;
  }
  if (path2 === "/api/file") {
    const user = validateUserParam(q.get("user") ?? void 0);
    const date = validateDateParam(q.get("date") ?? void 0);
    const id = validateIdParam(q.get("id") ?? void 0);
    const ext = validateExtParam(q.get("ext") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    if (!date) {
      send(res, 400, { error: "invalid date" });
      return;
    }
    if (!id) {
      send(res, 400, { error: "invalid id" });
      return;
    }
    if (!ext) {
      send(res, 400, { error: "invalid ext" });
      return;
    }
    const filePath = (0, import_node_path5.join)(outputDir, user, date, `${id}.${ext}`);
    if (!isUnder2(outputDir, filePath)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    if (!(0, import_node_fs4.existsSync)(filePath)) {
      send(res, 404, { error: "not found" });
      return;
    }
    try {
      const buf = (0, import_node_fs4.readFileSync)(filePath);
      res.statusCode = 200;
      res.setHeader("content-type", contentTypeForExt(ext));
      res.setHeader("content-length", String(buf.length));
      res.on("error", () => {
      });
      res.end(buf);
    } catch (err) {
      send(res, 500, {
        error: "read failed",
        detail: err instanceof Error ? err.message : String(err)
      });
    }
    return;
  }
  send(res, 404);
}
async function startMockServer(opts) {
  const outputDir = opts.outputDir ?? (0, import_node_path5.join)(process.cwd(), "test-output");
  (0, import_node_fs4.mkdirSync)(outputDir, { recursive: true });
  const host = opts.host ?? "127.0.0.1";
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const server = (0, import_node_http.createServer)((req, res) => {
    if (req.method === "GET") {
      handleGet(req, res, outputDir, now);
      return;
    }
    if (req.method !== "POST") {
      send(res, 405);
      return;
    }
    const route = (req.url ?? "").split("?")[0] ?? "";
    if (route !== ROUTE_CC_SESSIONS && route !== ROUTE_RECORDINGS && route !== ROUTE_CC_STATUS && route !== ROUTE_VIDEOS) {
      send(res, 404);
      return;
    }
    let bodyBytes = 0;
    let aborted = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (aborted) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        aborted = true;
        send(res, 413, { error: "payload too large", limit: MAX_BODY_BYTES });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      let json;
      try {
        json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (err) {
        send(res, 400, {
          error: "invalid json",
          detail: err instanceof Error ? err.message : String(err)
        });
        return;
      }
      if (route === ROUTE_CC_STATUS) {
        const r = appendCcStatusSnapshot(outputDir, json, now());
        if (!r.ok) {
          if (r.reason === "path") {
            send(res, 400, { error: "invalid path" });
          } else if (r.reason === "io") {
            send(res, 500, { error: "write failed" });
          } else {
            send(res, 400, { error: "invalid cc-status snapshot" });
          }
          return;
        }
        send(res, 200, {
          ok: true,
          user_id: r.user_id,
          date: r.date,
          session_id: r.session_id
        });
        return;
      }
      if (route === ROUTE_VIDEOS) {
        const obj2 = json;
        const envelope2 = obj2.envelope ?? {};
        const idRaw2 = envelope2.video_id ?? envelope2.id;
        let id2;
        if (typeof idRaw2 === "string" && idRaw2.length > 0) {
          const validated = validateIdParam(idRaw2);
          if (validated === null) {
            send(res, 400, { error: "invalid id" });
            return;
          }
          id2 = validated;
        } else {
          id2 = `video-${Date.now()}-${(0, import_node_crypto.randomUUID)().slice(0, 8)}`;
        }
        const videoBlock = obj2.video;
        const containerRaw = videoBlock?.container ?? envelope2.container;
        const container = typeof containerRaw === "string" ? containerRaw.toLowerCase() : "";
        if (!ALLOWED_VIDEO_CONTAINERS.has(container)) {
          send(res, 400, {
            error: "unsupported container",
            allowed: [...ALLOWED_VIDEO_CONTAINERS]
          });
          return;
        }
        const contentB642 = videoBlock?.content;
        if (typeof contentB642 !== "string" || contentB642.length === 0) {
          send(res, 400, { error: "missing content", route });
          return;
        }
        try {
          const buf = Buffer.from(contentB642, "base64");
          if (buf.length > MAX_DECOMPRESSED_BYTES) {
            send(res, 413, {
              error: "decoded payload too large",
              limit: MAX_DECOMPRESSED_BYTES
            });
            return;
          }
          const userIdSafe = safeUserId(envelope2.user_id);
          const date = dateStamp(envelope2.captured_at, now());
          const targetDir = (0, import_node_path5.join)(outputDir, userIdSafe, date);
          const targetFile = (0, import_node_path5.join)(targetDir, `${id2}.${container}`);
          if (!isUnder2(outputDir, targetFile)) {
            send(res, 400, { error: "invalid path" });
            return;
          }
          (0, import_node_fs4.mkdirSync)(targetDir, { recursive: true });
          atomicWriteFileSync(targetFile, buf);
          try {
            const labelRaw = envelope2.label;
            const shaRaw = envelope2.payload_sha256;
            const capturedRaw = envelope2.captured_at;
            const sidecar = {};
            if (typeof labelRaw === "string" && labelRaw.length > 0) sidecar.label = labelRaw;
            if (typeof shaRaw === "string" && shaRaw.length > 0) sidecar.payload_sha256 = shaRaw;
            if (typeof capturedRaw === "string" && capturedRaw.length > 0) sidecar.captured_at = capturedRaw;
            if (Object.keys(sidecar).length > 0) {
              const metaPath = (0, import_node_path5.join)(targetDir, `${id2}.meta.json`);
              if (isUnder2(outputDir, metaPath)) {
                atomicWriteFileSync(metaPath, Buffer.from(JSON.stringify(sidecar), "utf8"));
              }
            }
          } catch {
          }
          const link = `/api/file?user=${encodeURIComponent(userIdSafe)}&date=${encodeURIComponent(date)}&id=${encodeURIComponent(id2)}&ext=${encodeURIComponent(container)}`;
          send(res, 200, {
            ok: true,
            id: id2,
            user_id: userIdSafe,
            date,
            container,
            link,
            payload_size: buf.length
          });
        } catch (err) {
          send(res, 500, {
            error: "decode or write failed",
            detail: err instanceof Error ? err.message : String(err)
          });
        }
        return;
      }
      const isLog = route === ROUTE_CC_SESSIONS;
      const obj = json;
      const envelope = obj.envelope ?? {};
      const idRaw = isLog ? envelope.session_id : envelope.recording_id;
      let id;
      if (typeof idRaw === "string" && idRaw.length > 0) {
        const validated = validateIdParam(idRaw);
        if (validated === null) {
          send(res, 400, { error: "invalid id", detail: 'id must match [A-Za-z0-9._-]+ and not contain ".."' });
          return;
        }
        id = validated;
      } else {
        id = `unknown-${Date.now()}-${(0, import_node_crypto.randomUUID)().slice(0, 8)}`;
      }
      const payloadBlock = isLog ? obj.transcript : obj.audio;
      const contentB64 = payloadBlock?.content;
      if (typeof contentB64 !== "string" || contentB64.length === 0) {
        send(res, 400, { error: "missing content", route });
        return;
      }
      try {
        const buf = Buffer.from(contentB64, "base64");
        const decoded = isLog ? (0, import_node_zlib.gunzipSync)(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES }) : buf;
        if (decoded.length > MAX_DECOMPRESSED_BYTES) {
          send(res, 413, {
            error: "decompressed payload too large",
            limit: MAX_DECOMPRESSED_BYTES
          });
          return;
        }
        const ext = isLog ? "jsonl" : "ogg";
        const userIdSafe = safeUserId(envelope.user_id);
        const date = dateStamp(envelope.captured_at, now());
        const targetDir = (0, import_node_path5.join)(outputDir, userIdSafe, date);
        const targetFile = (0, import_node_path5.join)(targetDir, `${id}.${ext}`);
        if (!isUnder2(outputDir, targetFile)) {
          send(res, 400, { error: "invalid path" });
          return;
        }
        (0, import_node_fs4.mkdirSync)(targetDir, { recursive: true });
        atomicWriteFileSync(targetFile, decoded);
        if (isLog) {
          const quotaCandidate = obj.envelope?.quota;
          if (isValidQuotaBlock(quotaCandidate)) {
            const quotaFile = (0, import_node_path5.join)(targetDir, "quota.json");
            if (isUnder2(outputDir, quotaFile)) {
              try {
                const quotaBuf = Buffer.from(JSON.stringify(quotaCandidate), "utf8");
                atomicWriteFileSync(quotaFile, quotaBuf);
              } catch {
              }
            }
          }
        }
        send(res, 200, { ok: true, id, user_id: userIdSafe, date });
      } catch (err) {
        send(res, 500, {
          error: "decode or write failed",
          detail: err instanceof Error ? err.message : String(err)
        });
      }
    });
    req.on("error", () => {
      if (!res.headersSent) {
        send(res, 500);
      }
    });
  });
  const sockets = /* @__PURE__ */ new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("mock server failed to bind"));
        return;
      }
      resolve({
        url: `http://${host}:${addr.port}`,
        port: addr.port,
        outputDir,
        close: () => new Promise((r, rej) => {
          server.close((err) => err ? rej(err) : r());
          for (const s of sockets) s.destroy();
          sockets.clear();
        })
      });
    });
  });
}

// ../digital-twin/src/cc-status/compute.ts
var FIVE_HOURS_MS = 5 * 60 * 60 * 1e3;
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;

// ../digital-twin/src/bin-prod-server.ts
var import_node_os3 = require("os");
var import_node_path6 = require("path");
async function runProdServer(deps = {}) {
  const env = deps.env ?? process.env;
  const home = (deps.homedir ?? import_node_os3.homedir)();
  const log = deps.log ?? ((msg) => process.stderr.write(`${msg}
`));
  const portRaw = env.PORT ?? "8080";
  const portParsed = Number(portRaw);
  if (!Number.isInteger(portParsed) || portParsed < 0 || portParsed > 65535) {
    throw new Error(
      `[teamagent-collector] invalid PORT='${portRaw}' \u2014 must be an integer 0-65535`
    );
  }
  const port = portParsed;
  const host = env.HOST ?? "0.0.0.0";
  const outputDir = env.TEAMAGENT_COLLECTOR_DIR ?? (0, import_node_path6.join)(home, "teamagent-collector");
  const handle = await startMockServer({ port, host, outputDir });
  log(`[teamagent-collector] listening on ${handle.url}`);
  log(`[teamagent-collector] outputDir = ${handle.outputDir}`);
  deps.onReady?.({ url: handle.url, outputDir: handle.outputDir });
  return handle.close;
}
var argv1 = process.argv[1] ?? "";
if (argv1.includes("bin-prod-server")) {
  runProdServer().then((close) => {
    const shutdown = (signal) => {
      process.stderr.write(`[teamagent-collector] ${signal} received \u2014 shutting down
`);
      close().then(() => process.exit(0)).catch((err) => {
        process.stderr.write(`shutdown error: ${String(err)}
`);
        process.exit(1);
      });
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }).catch((err) => {
    process.stderr.write(`[teamagent-collector] fatal: ${String(err)}
`);
    process.exit(1);
  });
}

// ../digital-twin/src/hooks/tap-session.ts
var import_node_fs5 = require("fs");
var import_node_path7 = require("path");
var import_node_os4 = require("os");
var import_node_child_process2 = require("child_process");

// ../digital-twin/src/schemas/cc-session.ts
var import_node_zlib2 = require("zlib");
function buildCcSessionEnvelope(input) {
  const compressed = (0, import_node_zlib2.gzipSync)(input.payloadBytes);
  const payloadB64 = compressed.toString("base64");
  const env = {
    schema_version: 1,
    envelope: {
      id: input.metadata.id,
      user_id: input.identity.user_id,
      machine_id: input.identity.machine_id,
      session_id: input.metadata.session_id,
      cwd: input.metadata.cwd,
      project_name: input.metadata.project_name,
      transcript_path: input.metadata.transcript_path,
      payload_size: input.metadata.payload_size,
      captured_at: input.metadata.captured_at,
      source: input.metadata.source,
      host: input.metadata.host,
      teamagent_version: input.metadata.teamagent_version,
      consented_at: input.identity.consented_at ?? null
    },
    transcript: {
      compression: "gzip+base64",
      content: payloadB64
    }
  };
  if (input.quota) env.quota = input.quota;
  return env;
}
function isCcSessionMetadata(v) {
  if (typeof v !== "object" || v === null) return false;
  const o = v;
  return typeof o.id === "string" && o.kind === "cc-session" && typeof o.session_id === "string" && typeof o.cwd === "string" && typeof o.transcript_path === "string" && typeof o.captured_at === "string";
}

// ../digital-twin/src/quota/state.ts
var import_node_fs6 = require("fs");
var import_node_path8 = require("path");

// ../digital-twin/src/quota/scheduler.ts
var import_node_fs7 = require("fs");
var import_node_path9 = require("path");

// ../digital-twin/src/incremental/scan.ts
var import_node_fs8 = require("fs");
var import_node_path10 = require("path");

// ../digital-twin/src/schemas/recording.ts
var RECORDING_CODEC_DEFAULTS = Object.freeze({
  codec: "opus",
  bitrate: 24e3,
  sample_rate: 16e3,
  channels: 1,
  container: "ogg"
});
function buildRecordingEnvelope(input) {
  const payloadB64 = input.payloadBytes.toString("base64");
  return {
    schema_version: 1,
    envelope: {
      id: input.metadata.id,
      recording_id: input.metadata.id,
      user_id: input.identity.user_id,
      machine_id: input.identity.machine_id,
      started_at: input.metadata.started_at,
      ended_at: input.metadata.ended_at,
      duration_ms: input.metadata.duration_ms,
      payload_size: input.metadata.payload_size,
      source: input.metadata.source,
      host: input.metadata.host,
      teamagent_version: input.metadata.teamagent_version,
      consented_at: input.identity.consented_at ?? null
    },
    audio: {
      compression: "none",
      codec: input.metadata.codec,
      bitrate: input.metadata.bitrate,
      sample_rate: input.metadata.sample_rate,
      channels: input.metadata.channels,
      container: input.metadata.container,
      content: payloadB64
    }
  };
}
function isRecordingMetadata(v) {
  if (typeof v !== "object" || v === null) return false;
  const o = v;
  return typeof o.id === "string" && o.kind === "recording" && typeof o.started_at === "string" && typeof o.ended_at === "string" && typeof o.duration_ms === "number" && o.codec === "opus" && typeof o.bitrate === "number" && typeof o.sample_rate === "number" && typeof o.channels === "number" && o.container === "ogg" && typeof o.payload_size === "number" && typeof o.source === "string" && typeof o.teamagent_version === "string" && o.schema_version === 1;
}

// ../digital-twin/src/daemon/uploader.ts
var ROUTE_BY_KIND = {
  "cc-session": "/v1/cc-sessions",
  recording: "/v1/recordings"
};
var defaultBuildEnvelope = (input) => {
  if (input.metadata.kind === "recording") {
    return buildRecordingEnvelope({
      metadata: input.metadata,
      payloadBytes: input.payloadBytes,
      identity: input.identity
    });
  }
  return buildCcSessionEnvelope({
    metadata: input.metadata,
    payloadBytes: input.payloadBytes,
    identity: input.identity,
    quota: input.metadata.quota
  });
};
async function uploadEntry(input, deps = {}) {
  const buildFn = deps.buildEnvelope ?? defaultBuildEnvelope;
  const fetchFn = deps.fetchFn ?? globalThis.fetch;
  if (!fetchFn) {
    return { kind: "network-error", error: "global fetch is not available" };
  }
  const envelope = buildFn(input);
  const url = stripTrailingSlash(input.endpoint) + ROUTE_BY_KIND[input.metadata.kind];
  let res;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.token}`,
        "idempotency-key": input.metadata.id
      },
      body: JSON.stringify(envelope)
    });
  } catch (err) {
    return {
      kind: "network-error",
      error: err instanceof Error ? err.message : String(err)
    };
  }
  return classifyResponse(res.status, await safeReadBody(res));
}
async function safeReadBody(res) {
  try {
    return await res.text();
  } catch {
    return void 0;
  }
}
function classifyResponse(status, body) {
  if (status === 200 || status === 204) return { kind: "success", status };
  if (status === 401) return { kind: "auth-failed", status, body };
  if (status === 429 || status >= 500 && status < 600) {
    return { kind: "transient", status, body };
  }
  return { kind: "permanent-failure", status, body };
}
function stripTrailingSlash(s) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

// ../digital-twin/src/daemon/queue.ts
var import_node_fs9 = require("fs");
var import_node_path11 = __toESM(require("path"), 1);
var import_node_os5 = require("os");
var DEFAULT_QUEUE_CAPACITY_BYTES = 5e3 * 1024 * 1024;
function getPaths(home) {
  return digitalTwinPaths(home);
}
function safeStat(p) {
  try {
    const s = (0, import_node_fs9.statSync)(p);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}
function listPending(home = (0, import_node_os5.homedir)()) {
  const paths = getPaths(home);
  if (!(0, import_node_fs9.existsSync)(paths.pendingDir)) return [];
  const names = (0, import_node_fs9.readdirSync)(paths.pendingDir);
  const ids = /* @__PURE__ */ new Set();
  for (const n of names) {
    if (n.endsWith(".payload")) ids.add(n.slice(0, -".payload".length));
    else if (n.endsWith(".json")) ids.add(n.slice(0, -".json".length));
  }
  const out = [];
  for (const id of ids) {
    const payloadPath = import_node_path11.default.join(paths.pendingDir, `${id}.payload`);
    const metadataPath = import_node_path11.default.join(paths.pendingDir, `${id}.json`);
    const ps = safeStat(payloadPath);
    const ms = safeStat(metadataPath);
    if (!ps || !ms) continue;
    out.push({
      id,
      payloadPath,
      metadataPath,
      mtimeMs: ms.mtimeMs,
      payloadSize: ps.size,
      metadataSize: ms.size
    });
  }
  out.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return out;
}
function isEntryTooLarge(entry, maxBytes = MAX_PAYLOAD_BYTES) {
  return entry.payloadSize > maxBytes;
}
function loadEntry(entry) {
  let payloadBytes;
  try {
    payloadBytes = (0, import_node_fs9.readFileSync)(entry.payloadPath);
  } catch {
    return null;
  }
  let metadataRaw;
  try {
    metadataRaw = (0, import_node_fs9.readFileSync)(entry.metadataPath, "utf-8");
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(metadataRaw);
  } catch {
    return null;
  }
  if (isCcSessionMetadata(parsed)) {
    return { entry, payloadBytes, metadata: parsed };
  }
  if (isRecordingMetadata(parsed)) {
    return { entry, payloadBytes, metadata: parsed };
  }
  return null;
}
function writeMetadataAtomic(metadataPath, metadata) {
  const tmp = `${metadataPath}.tmp`;
  (0, import_node_fs9.writeFileSync)(tmp, JSON.stringify(metadata, null, 2), "utf-8");
  (0, import_node_fs9.renameSync)(tmp, metadataPath);
}
function removeEntry(entry) {
  for (const p of [entry.payloadPath, entry.metadataPath]) {
    try {
      (0, import_node_fs9.unlinkSync)(p);
    } catch {
    }
  }
}
function moveToDeadLetter(entry, home = (0, import_node_os5.homedir)()) {
  const paths = getPaths(home);
  (0, import_node_fs9.mkdirSync)(paths.deadLetterDir, { recursive: true });
  for (const src of [entry.payloadPath, entry.metadataPath]) {
    const base = import_node_path11.default.basename(src);
    const dst = import_node_path11.default.join(paths.deadLetterDir, base);
    try {
      (0, import_node_fs9.renameSync)(src, dst);
    } catch {
    }
  }
}
function enforceCapacity(home = (0, import_node_os5.homedir)(), maxBytes = DEFAULT_QUEUE_CAPACITY_BYTES) {
  const paths = getPaths(home);
  const units = [];
  for (const dir of [paths.pendingDir, paths.deadLetterDir]) {
    if (!(0, import_node_fs9.existsSync)(dir)) continue;
    const idToFiles = /* @__PURE__ */ new Map();
    for (const n of (0, import_node_fs9.readdirSync)(dir)) {
      let id;
      if (n.endsWith(".payload")) id = n.slice(0, -".payload".length);
      else if (n.endsWith(".json")) id = n.slice(0, -".json".length);
      else continue;
      const abs = import_node_path11.default.join(dir, n);
      const list = idToFiles.get(id);
      if (list) list.push(abs);
      else idToFiles.set(id, [abs]);
    }
    for (const filesForId of idToFiles.values()) {
      let totalSize = 0;
      let oldestMtimeMs = Number.POSITIVE_INFINITY;
      for (const abs of filesForId) {
        const s = safeStat(abs);
        if (!s) continue;
        totalSize += s.size;
        if (s.mtimeMs < oldestMtimeMs) oldestMtimeMs = s.mtimeMs;
      }
      if (!Number.isFinite(oldestMtimeMs)) continue;
      units.push({ paths: filesForId, totalSize, oldestMtimeMs });
    }
  }
  let total = units.reduce((acc, u) => acc + u.totalSize, 0);
  if (total <= maxBytes) return [];
  units.sort((a, b) => a.oldestMtimeMs - b.oldestMtimeMs);
  const deleted = [];
  for (const u of units) {
    if (total <= maxBytes) break;
    for (const p of u.paths) {
      try {
        (0, import_node_fs9.unlinkSync)(p);
        deleted.push(p);
      } catch {
      }
    }
    total -= u.totalSize;
  }
  return deleted;
}

// ../digital-twin/src/daemon/backoff.ts
var MAX_BACKOFF_MS = 24 * 60 * 60 * 1e3;
var DEAD_LETTER_AFTER_MS = 24 * 60 * 60 * 1e3;
function shouldDeadLetter(firstFailedAt, now) {
  if (!firstFailedAt) return false;
  const startedMs = Date.parse(firstFailedAt);
  if (!Number.isFinite(startedMs)) return false;
  return now.getTime() - startedMs >= DEAD_LETTER_AFTER_MS;
}

// ../digital-twin/src/daemon/process-manager.ts
var import_node_fs10 = require("fs");
var import_node_os6 = require("os");
function isPidAlive(pid) {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = err.code;
    if (code === "EPERM") return true;
    return false;
  }
}
function readPidFile(home = (0, import_node_os6.homedir)()) {
  const paths = digitalTwinPaths(home);
  if (!(0, import_node_fs10.existsSync)(paths.daemonPidFile)) return null;
  try {
    const raw = (0, import_node_fs10.readFileSync)(paths.daemonPidFile, "utf-8");
    const obj = JSON.parse(raw);
    if (typeof obj.pid !== "number" || typeof obj.start_at !== "string") return null;
    return { pid: obj.pid, start_at: obj.start_at };
  } catch {
    return null;
  }
}
function acquirePidLock(home = (0, import_node_os6.homedir)(), deps = {}) {
  const paths = digitalTwinPaths(home);
  const myPid = deps.pid ?? process.pid;
  const now = deps.now ?? (() => /* @__PURE__ */ new Date());
  const aliveCheck = deps.isPidAlive ?? isPidAlive;
  (0, import_node_fs10.mkdirSync)(paths.digitalTwinDir, { recursive: true });
  const payload = JSON.stringify({
    pid: myPid,
    start_at: now().toISOString()
  });
  if (tryWritePidLockAtomic(paths.daemonPidFile, payload)) return true;
  const existing = readPidFile(home);
  if (existing?.pid === myPid) {
    return true;
  }
  if (existing && aliveCheck(existing.pid)) {
    return false;
  }
  try {
    (0, import_node_fs10.unlinkSync)(paths.daemonPidFile);
  } catch {
  }
  return tryWritePidLockAtomic(paths.daemonPidFile, payload);
}
function tryWritePidLockAtomic(path2, payload) {
  try {
    (0, import_node_fs10.writeFileSync)(path2, payload, { flag: "wx", encoding: "utf-8" });
    return true;
  } catch (err) {
    if (err.code === "EEXIST") return false;
    throw err;
  }
}
function releasePidLock(home = (0, import_node_os6.homedir)()) {
  const paths = digitalTwinPaths(home);
  try {
    (0, import_node_fs10.unlinkSync)(paths.daemonPidFile);
  } catch {
  }
}
async function runUploadCycle(config, home = (0, import_node_os6.homedir)(), deps = {}) {
  const uploader = deps.uploader ?? uploadEntry;
  const now = deps.now ?? (() => /* @__PURE__ */ new Date());
  const maxBytes = deps.maxPayloadBytes;
  const entries = listPending(home);
  const outcomes = [];
  let authFailed = false;
  for (const entry of entries) {
    if (authFailed) break;
    const out = await processEntry(entry, config, uploader, deps.fetchFn, home, now, maxBytes);
    outcomes.push(out);
    if (out.outcome === "auth-failed") {
      authFailed = true;
    }
  }
  return { scanned: entries.length, outcomes, authFailed };
}
async function processEntry(entry, config, uploader, fetchFn, home, now, maxPayloadBytes) {
  if (isEntryTooLarge(entry, maxPayloadBytes)) {
    moveToDeadLetter(entry, home);
    return { id: entry.id, outcome: "too-large", payload_size: entry.payloadSize };
  }
  const loaded = loadEntry(entry);
  if (!loaded) {
    moveToDeadLetter(entry, home);
    return { id: entry.id, outcome: "invalid-metadata" };
  }
  const result = await uploader(
    {
      metadata: loaded.metadata,
      payloadBytes: loaded.payloadBytes,
      endpoint: config.endpoint,
      token: config.token,
      identity: {
        user_id: config.user_id,
        machine_id: config.machine_id,
        consented_at: config.consented_at ?? null
      }
    },
    { fetchFn }
  );
  return classifyAndAct(entry, loaded, result, home, now());
}
function classifyAndAct(entry, loaded, result, home, now) {
  switch (result.kind) {
    case "success": {
      removeEntry(entry);
      return { id: entry.id, outcome: "uploaded" };
    }
    case "auth-failed": {
      return { id: entry.id, outcome: "auth-failed" };
    }
    case "permanent-failure": {
      moveToDeadLetter(entry, home);
      const out = {
        id: entry.id,
        outcome: "dead-letter",
        reason: "permanent-failure",
        status: result.status
      };
      if (loaded.metadata.first_failed_at) {
        out.first_failed_at = loaded.metadata.first_failed_at;
      }
      return out;
    }
    case "transient":
    case "network-error": {
      let firstFailedAt = loaded.metadata.first_failed_at ?? null;
      if (!firstFailedAt) {
        firstFailedAt = now.toISOString();
        try {
          writeMetadataAtomic(entry.metadataPath, {
            ...loaded.metadata,
            first_failed_at: firstFailedAt
          });
        } catch {
        }
      }
      if (shouldDeadLetter(firstFailedAt, now)) {
        moveToDeadLetter(entry, home);
        return {
          id: entry.id,
          outcome: "dead-letter",
          reason: "too-old",
          first_failed_at: firstFailedAt,
          status: "status" in result ? result.status : void 0
        };
      }
      return {
        id: entry.id,
        outcome: "transient",
        first_failed_at: firstFailedAt,
        status: "status" in result ? result.status : void 0,
        error: "error" in result ? result.error : void 0
      };
    }
  }
}
var POLL_INTERVAL_MS = 6e4;
var IDLE_EXIT_MS = 15 * 6e4;
async function mainLoop(config, home = (0, import_node_os6.homedir)(), deps = {}) {
  const sleep = deps.sleep ?? defaultSleep;
  const runCycle = deps.runCycle ?? runUploadCycle;
  const shouldStop = deps.shouldStop ?? (() => false);
  const pollMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const idleMs = deps.idleExitMs ?? IDLE_EXIT_MS;
  let idleAccumulatedMs = 0;
  while (!shouldStop()) {
    enforceCapacity(home);
    const summary = await runCycle(config, home, { fetchFn: deps.fetchFn });
    deps.onCycle?.(summary);
    if (summary.authFailed) {
      return { reason: "auth-failed" };
    }
    if (summary.scanned === 0) {
      idleAccumulatedMs += pollMs;
      if (idleAccumulatedMs >= idleMs) {
        return { reason: "idle" };
      }
    } else {
      idleAccumulatedMs = 0;
    }
    if (shouldStop()) break;
    await sleep(pollMs);
  }
  return { reason: "stopped" };
}
function defaultSleep(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t === "object" && t !== null && "unref" in t) {
      t.unref();
    }
  });
}

// ../digital-twin/src/daemon/uploader-log.ts
var import_node_fs11 = require("fs");

// ../digital-twin/src/recorder/platform-input.ts
var import_node_child_process3 = require("child_process");

// ../digital-twin/src/recorder/ffmpeg-wrapper.ts
var import_node_fs12 = require("fs");
var import_node_path12 = require("path");
var import_node_child_process4 = require("child_process");
var import_node_os7 = require("os");
var RECORDING_CODEC_FLAGS = Object.freeze([
  "-vn",
  "-c:a",
  "libopus",
  "-b:a",
  "24k",
  "-ar",
  "16000",
  "-ac",
  "1"
]);

// ../digital-twin/src/bin-uploader.ts
async function runDaemon(deps = {}) {
  const home = (deps.homedir ?? import_node_os8.homedir)();
  const exit = deps.exit ?? ((code) => process.exit(code));
  const log = deps.log ?? ((msg) => process.stderr.write(`${msg}
`));
  const dryRun = deps.dryRun ?? process.env.TEAMAGENT_UPLOADER_DRYRUN === "1";
  if (dryRun) {
    log("digital-twin uploader: dry-run OK (all imports resolved)");
    return exit(0);
  }
  const cfg = loadConfig(digitalTwinPaths(home).configFile);
  if (!isEnabled(cfg)) {
    log("digital-twin: config missing or disabled \u2014 daemon exiting");
    return exit(2);
  }
  const acquired = acquirePidLock(home);
  if (!acquired) {
    log("digital-twin: another daemon is already running \u2014 exiting");
    return exit(0);
  }
  let exitCode = 0;
  try {
    const daemonCfg = {
      endpoint: cfg.uploader.endpoint,
      token: cfg.uploader.token,
      user_id: cfg.identity.user_id,
      machine_id: cfg.identity.machine_id,
      // Issue #146 F9: forward consented_at into every envelope so the
      // server-side audit trail can answer "when did this user first agree".
      consented_at: cfg.consented_at ?? null
    };
    const result = await mainLoop(daemonCfg, home);
    if (result.reason === "auth-failed") {
      log("digital-twin: auth failed (HTTP 401) \u2014 token invalid");
      exitCode = 1;
    } else {
      log(`digital-twin: daemon exiting (${result.reason})`);
    }
  } finally {
    releasePidLock(home);
  }
  return exit(exitCode);
}
var argv12 = process.argv[1] ?? "";
if (argv12.includes("bin-uploader")) {
  runDaemon().catch((err) => {
    process.stderr.write(`digital-twin daemon crash: ${String(err)}
`);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runDaemon
});
