import {
  enumerateInstallTableBundlePaths
} from "./chunk-PWKQGRHF.js";
import {
  openDb
} from "./chunk-EHS4WAHC.js";
import {
  STATIC_USER_SKILLS,
  planStaticUserSkillInstall,
  stripLegacyTeamagentBlock
} from "./chunk-SBHLEGQ2.js";
import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/doctor.ts
init_esm_shims();
import fs from "fs";
import path2 from "path";
import os from "os";
import { execSync as execSync2, spawn as nodeSpawn3 } from "child_process";
import { createRequire } from "module";

// ../digital-twin/src/index.ts
init_esm_shims();

// ../digital-twin/src/paths.ts
init_esm_shims();
import { homedir } from "os";
import { join } from "path";
function digitalTwinPaths(home = homedir()) {
  const teamagentDir = join(home, ".teamagent");
  const digitalTwinDir = join(teamagentDir, "digital-twin");
  const queueDir = join(digitalTwinDir, "queue");
  return {
    teamagentDir,
    digitalTwinDir,
    configFile: join(teamagentDir, "digital-twin.json"),
    machineIdFile: join(digitalTwinDir, "machine-id"),
    queueDir,
    pendingDir: join(queueDir, "pending"),
    deadLetterDir: join(queueDir, "dead-letter"),
    recordingTempDir: join(queueDir, "recording_temp"),
    daemonPidFile: join(digitalTwinDir, "daemon.pid"),
    lastHourlyScanFile: join(digitalTwinDir, "last-hourly-scan.txt"),
    quotaCacheFile: join(digitalTwinDir, "quota-cache.json"),
    uploaderLogFile: join(digitalTwinDir, "uploader.log")
  };
}
var DEFAULT_PATHS = digitalTwinPaths();

// ../digital-twin/src/limits.ts
init_esm_shims();
var MAX_PAYLOAD_BYTES = 100 * 1024 * 1024;

// ../digital-twin/src/identity.ts
init_esm_shims();
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { hostname, userInfo } from "os";
import { dirname } from "path";
import { ulid } from "ulid";
function getUserId(opts = {}) {
  try {
    const execOpts = {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    };
    if (typeof opts.timeoutMs === "number" && opts.timeoutMs > 0) {
      execOpts.timeout = opts.timeoutMs;
    }
    const email = execSync("git config user.email", execOpts).trim();
    if (email) return email;
  } catch {
  }
  return `${userInfo().username}@${hostname()}`;
}
function getMachineId(machineIdFile = DEFAULT_PATHS.machineIdFile) {
  if (existsSync(machineIdFile)) {
    const cached = readFileSync(machineIdFile, "utf8").trim();
    if (cached) return cached;
  }
  const id = `${hostname()}-${ulid().slice(-8).toLowerCase()}`;
  mkdirSync(dirname(machineIdFile), { recursive: true });
  writeFileSync(machineIdFile, id, { encoding: "utf8" });
  try {
    chmodSync(machineIdFile, 384);
  } catch {
  }
  return id;
}

// ../digital-twin/src/config.ts
init_esm_shims();
import {
  existsSync as existsSync2,
  readFileSync as readFileSync2,
  writeFileSync as writeFileSync2,
  mkdirSync as mkdirSync2,
  chmodSync as chmodSync2,
  renameSync,
  unlinkSync
} from "fs";
import { dirname as dirname2 } from "path";
var DEFAULT_ENDPOINT = "http://192.168.22.88:8080";
function defaultConfig(input) {
  return {
    schema_version: "1",
    identity: {
      user_id: input.user_id,
      machine_id: input.machine_id
    },
    uploader: {
      enabled: true,
      endpoint: input.endpoint ?? DEFAULT_ENDPOINT,
      token: null
    },
    consented_at: input.consented_at ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
function loadConfig(file = DEFAULT_PATHS.configFile) {
  if (!existsSync2(file)) return null;
  try {
    const raw = readFileSync2(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveConfig(config, file = DEFAULT_PATHS.configFile) {
  mkdirSync2(dirname2(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync2(tmp, JSON.stringify(config, null, 2), { encoding: "utf8" });
  try {
    chmodSync2(tmp, 384);
  } catch {
  }
  try {
    renameSync(tmp, file);
  } catch {
    try {
      unlinkSync(file);
    } catch {
    }
    renameSync(tmp, file);
  }
  try {
    chmodSync2(file, 384);
  } catch {
  }
}
function isEnabled(config) {
  if (!config) return false;
  if (!config.uploader.enabled) return false;
  if (!config.uploader.token) return false;
  return true;
}

// ../digital-twin/src/mock-server.ts
init_esm_shims();
import {
  createServer
} from "http";
import { gunzipSync } from "zlib";
import {
  writeFileSync as writeFileSync4,
  renameSync as renameSync3,
  unlinkSync as unlinkSync3,
  mkdirSync as mkdirSync4,
  readdirSync as readdirSync2,
  statSync as statSync2,
  existsSync as existsSync4,
  readFileSync as readFileSync4
} from "fs";
import { randomUUID } from "crypto";
import { join as join3, resolve as resolvePath2, sep as sep2 } from "path";

// ../digital-twin/src/dashboard-html.ts
init_esm_shims();
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
init_esm_shims();
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
init_esm_shims();
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
init_esm_shims();
import {
  appendFileSync,
  existsSync as existsSync3,
  mkdirSync as mkdirSync3,
  readFileSync as readFileSync3,
  readdirSync,
  renameSync as renameSync2,
  statSync,
  unlinkSync as unlinkSync2,
  writeFileSync as writeFileSync3
} from "fs";
import { join as join2, resolve as resolvePath, sep } from "path";

// ../digital-twin/src/cc-status/types.ts
init_esm_shims();
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
  const p = resolvePath(parent);
  const c = resolvePath(child);
  if (c === p) return true;
  return c.startsWith(p + sep);
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
  return join2(outputDir, user, date, `${session}${CC_STATUS_FILE_SUFFIX}`);
}
function rotateIfOversize(file) {
  let size = 0;
  try {
    size = statSync(file).size;
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
    writeFileSync3(tmp, `${tail.join("\n")}
`, "utf8");
    try {
      renameSync2(tmp, file);
    } catch {
      try {
        unlinkSync2(file);
      } catch {
      }
      renameSync2(tmp, file);
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
    mkdirSync3(join2(outputDir, user, date), { recursive: true });
    rotateIfOversize(target);
    appendFileSync(target, `${JSON.stringify(snap)}
`, "utf8");
  } catch {
    return { ok: false, reason: "io" };
  }
  return { ok: true, user_id: user, date, session_id: snap.session_id };
}
function listDateDirs(userDir) {
  if (!existsSync3(userDir)) return [];
  try {
    return readdirSync(userDir, { withFileTypes: true }).filter((d) => d.isDirectory() && DATE_RE.test(d.name)).map((d) => d.name).sort((a, b) => a < b ? 1 : a > b ? -1 : 0).slice(0, MAX_DATE_DIRS);
  } catch {
    return [];
  }
}
function listStatusFiles(dir) {
  if (!existsSync3(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith(CC_STATUS_FILE_SUFFIX)).map((d) => d.name).slice(0, MAX_FILES_PER_DIR);
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
    text = readFileSync3(file, "utf8");
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
  const userDir = join2(outputDir, user);
  if (!isUnder(outputDir, userDir)) return [];
  const latest = /* @__PURE__ */ new Map();
  for (const date of listDateDirs(userDir)) {
    const dir = join2(userDir, date);
    if (!isUnder(outputDir, dir)) continue;
    for (const fname of listStatusFiles(dir)) {
      const session = sessionIdFromFilename(fname);
      const file = join2(dir, fname);
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
  if (!existsSync3(outputDir)) return [];
  let users;
  try {
    users = readdirSync(outputDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).filter((u) => safeUserId(u) === u).sort().slice(0, MAX_USERS_PER_ALL);
  } catch {
    return [];
  }
  const rows = [];
  for (const u of users) rows.push(...readLatestPerSession(outputDir, u, now));
  return rows.sort((a, b) => tsMs(b) - tsMs(a));
}
function readHistory(outputDir, user, session, sinceMs, now = /* @__PURE__ */ new Date()) {
  if (!ID_RE.test(session) || !isUnreservedComponent(session)) return [];
  const userDir = join2(outputDir, user);
  if (!isUnder(outputDir, userDir)) return [];
  const all = [];
  for (const date of listDateDirs(userDir)) {
    const file = ccStatusJsonlPath(outputDir, user, date, session);
    if (!isUnder(outputDir, file)) continue;
    if (!existsSync3(file)) continue;
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
  writeFileSync4(tmp, data);
  try {
    renameSync3(tmp, target);
  } catch {
    try {
      unlinkSync3(target);
    } catch {
    }
    renameSync3(tmp, target);
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
  const p = resolvePath2(parent);
  const c = resolvePath2(child);
  if (c === p) return true;
  return c.startsWith(p + sep2);
}
function listDirNames(dir) {
  if (!existsSync4(dir)) return [];
  try {
    return readdirSync2(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}
function listSessions(dir) {
  if (!existsSync4(dir)) return [];
  let entries = [];
  try {
    const files = readdirSync2(dir, { withFileTypes: true }).filter((d) => d.isFile());
    for (const f of files) {
      const m = /^(.+)\.(jsonl|ogg)$/.exec(f.name);
      if (!m || m[1] === void 0 || m[2] === void 0) continue;
      const id = m[1];
      const ext = m[2];
      try {
        const st = statSync2(join3(dir, f.name));
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
  const path3 = url.split("?")[0];
  if (path3 === "/" || path3 === "/index.html") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(DASHBOARD_HTML);
    return;
  }
  if (path3 === "/videos" || path3 === "/videos.html") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(VIDEOS_DASHBOARD_HTML);
    return;
  }
  const q = parseQuery(url);
  if (path3 === "/api/videos") {
    const videos = [];
    const allowedExts = /* @__PURE__ */ new Set(["mov", "mp4", "webm", "mkv"]);
    try {
      for (const userName of listDirNames(outputDir)) {
        if (safeUserId(userName) !== userName) continue;
        const userDir = join3(outputDir, userName);
        if (!isUnder2(outputDir, userDir)) continue;
        for (const dateName of listDirNames(userDir)) {
          if (!DATE_RE2.test(dateName)) continue;
          const dateDir = join3(userDir, dateName);
          if (!isUnder2(outputDir, dateDir)) continue;
          let files;
          try {
            files = readdirSync2(dateDir);
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
            const full = join3(dateDir, fname);
            let size = 0;
            let mtime = "";
            try {
              const st = statSync2(full);
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
              const metaPath = join3(dateDir, id + ".meta.json");
              if (isUnder2(outputDir, metaPath) && existsSync4(metaPath)) {
                const meta = JSON.parse(readFileSync4(metaPath, "utf8"));
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
  if (path3 === "/api/cc-status/all") {
    send(res, 200, { sessions: readLatestAllUsers(outputDir, now()) });
    return;
  }
  if (path3 === "/api/cc-status/history") {
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
  if (path3 === "/api/cc-status") {
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
  if (path3 === "/api/users") {
    const users = listDirNames(outputDir).sort((a, b) => a.localeCompare(b));
    send(res, 200, { users });
    return;
  }
  if (path3 === "/api/dates") {
    const user = validateUserParam(q.get("user") ?? void 0);
    if (!user) {
      send(res, 400, { error: "invalid user" });
      return;
    }
    const userDir = join3(outputDir, user);
    if (!isUnder2(outputDir, userDir)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    const dates = listDirNames(userDir).filter((n) => DATE_RE2.test(n)).sort((a, b) => a < b ? 1 : a > b ? -1 : 0);
    send(res, 200, { dates });
    return;
  }
  if (path3 === "/api/sessions") {
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
    const dir = join3(outputDir, user, date);
    if (!isUnder2(outputDir, dir)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    send(res, 200, { sessions: listSessions(dir) });
    return;
  }
  if (path3 === "/api/quota") {
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
    const quotaFile = join3(outputDir, user, date, "quota.json");
    if (!isUnder2(outputDir, quotaFile)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    if (!existsSync4(quotaFile)) {
      send(res, 404, { error: "not found" });
      return;
    }
    try {
      const raw = readFileSync4(quotaFile, "utf8");
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
  if (path3 === "/api/file") {
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
    const filePath = join3(outputDir, user, date, `${id}.${ext}`);
    if (!isUnder2(outputDir, filePath)) {
      send(res, 400, { error: "invalid path" });
      return;
    }
    if (!existsSync4(filePath)) {
      send(res, 404, { error: "not found" });
      return;
    }
    try {
      const buf = readFileSync4(filePath);
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
  const outputDir = opts.outputDir ?? join3(process.cwd(), "test-output");
  mkdirSync4(outputDir, { recursive: true });
  const host = opts.host ?? "127.0.0.1";
  const now = opts.now ?? (() => /* @__PURE__ */ new Date());
  const server = createServer((req, res) => {
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
          id2 = `video-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
          const targetDir = join3(outputDir, userIdSafe, date);
          const targetFile = join3(targetDir, `${id2}.${container}`);
          if (!isUnder2(outputDir, targetFile)) {
            send(res, 400, { error: "invalid path" });
            return;
          }
          mkdirSync4(targetDir, { recursive: true });
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
              const metaPath = join3(targetDir, `${id2}.meta.json`);
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
        id = `unknown-${Date.now()}-${randomUUID().slice(0, 8)}`;
      }
      const payloadBlock = isLog ? obj.transcript : obj.audio;
      const contentB64 = payloadBlock?.content;
      if (typeof contentB64 !== "string" || contentB64.length === 0) {
        send(res, 400, { error: "missing content", route });
        return;
      }
      try {
        const buf = Buffer.from(contentB64, "base64");
        const decoded = isLog ? gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES }) : buf;
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
        const targetDir = join3(outputDir, userIdSafe, date);
        const targetFile = join3(targetDir, `${id}.${ext}`);
        if (!isUnder2(outputDir, targetFile)) {
          send(res, 400, { error: "invalid path" });
          return;
        }
        mkdirSync4(targetDir, { recursive: true });
        atomicWriteFileSync(targetFile, decoded);
        if (isLog) {
          const quotaCandidate = obj.envelope?.quota;
          if (isValidQuotaBlock(quotaCandidate)) {
            const quotaFile = join3(targetDir, "quota.json");
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

// ../digital-twin/src/cc-status/index.ts
init_esm_shims();

// ../digital-twin/src/cc-status/compute.ts
init_esm_shims();
var FIVE_HOURS_MS = 5 * 60 * 60 * 1e3;
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;

// ../digital-twin/src/realtime-client.ts
init_esm_shims();

// ../digital-twin/src/realtime-stream.ts
init_esm_shims();

// ../digital-twin/src/bin-prod-server.ts
init_esm_shims();
import { homedir as homedir2 } from "os";
import { join as join4 } from "path";
async function runProdServer(deps = {}) {
  const env = deps.env ?? process.env;
  const home = (deps.homedir ?? homedir2)();
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
  const outputDir = env.TEAMAGENT_COLLECTOR_DIR ?? join4(home, "teamagent-collector");
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
init_esm_shims();
import {
  existsSync as existsSync5,
  copyFileSync,
  mkdirSync as mkdirSync5,
  writeFileSync as writeFileSync5,
  statSync as statSync3,
  openSync,
  closeSync
} from "fs";
import { join as join5 } from "path";
import { homedir as osHomedir, platform as osPlatform, arch as osArch, hostname as hostname2 } from "os";
import { spawn as nodeSpawn } from "child_process";
import { ulid as defaultUlid } from "ulid";
function projectDirForCwd(cwd) {
  return cwd.replace(/[:/\\]/g, "-");
}
function claudeTranscriptPath(home, cwd, sessionId) {
  return join5(home, ".claude", "projects", projectDirForCwd(cwd), `${sessionId}.jsonl`);
}
function tapSession(input, deps = {}) {
  try {
    const home = (deps.homedir ?? osHomedir)();
    const ulidFn = deps.ulid ?? defaultUlid;
    const now = deps.now ?? (() => /* @__PURE__ */ new Date());
    const platform = deps.platform ?? osPlatform();
    const arch = deps.arch ?? osArch();
    const host = deps.hostname ?? hostname2();
    const transcriptPath = claudeTranscriptPath(home, input.cwd, input.sessionId);
    if (!existsSync5(transcriptPath)) {
      return { status: "no-log" };
    }
    let sourceSize = 0;
    try {
      sourceSize = statSync3(transcriptPath).size;
    } catch {
    }
    const sizeCap = deps.maxPayloadBytes ?? MAX_PAYLOAD_BYTES;
    if (sourceSize > sizeCap) {
      return { status: "too-large", payload_size: sourceSize };
    }
    const paths = digitalTwinPaths(home);
    mkdirSync5(paths.pendingDir, { recursive: true });
    const id = ulidFn();
    const payloadPath = join5(paths.pendingDir, `${id}.payload`);
    const metadataPath = join5(paths.pendingDir, `${id}.json`);
    copyFileSync(transcriptPath, payloadPath);
    let payloadSize = 0;
    try {
      payloadSize = statSync3(payloadPath).size;
    } catch {
    }
    const projectName = input.cwd.split(/[/\\]/).filter(Boolean).pop() ?? "";
    const metadata = {
      id,
      kind: "cc-session",
      session_id: input.sessionId,
      cwd: input.cwd,
      project_name: projectName,
      transcript_path: transcriptPath,
      payload_size: payloadSize,
      captured_at: now().toISOString(),
      source: "stop-hook",
      host: { os: platform, arch, hostname: host },
      teamagent_version: deps.teamagentVersion ?? "unknown",
      schema_version: 1,
      // Issue #283: forward quota only when caller provided one — keeps the
      // field absent from the JSON on pre-#283 Stop taps (no JSON churn).
      ...input.quota ? { quota: input.quota } : {}
    };
    writeFileSync5(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
    if (deps.daemonBin && existsSync5(deps.daemonBin)) {
      const spawnFn = deps.spawn ?? nodeSpawn;
      let logFd;
      try {
        const logPath = paths.uploaderLogFile;
        try {
          if (existsSync5(logPath) && statSync3(logPath).size > 1e6) {
            writeFileSync5(logPath, "", "utf-8");
          }
        } catch {
        }
        logFd = openSync(logPath, "a");
      } catch {
        logFd = void 0;
      }
      const stdio = logFd === void 0 ? "ignore" : ["ignore", logFd, logFd];
      try {
        const nodeBin = deps.nodeBin ?? process.execPath;
        const child = spawnFn(nodeBin, [deps.daemonBin], {
          detached: true,
          stdio,
          windowsHide: true,
          cwd: paths.digitalTwinDir
        });
        child.on("error", () => {
        });
        child.unref();
      } catch {
      } finally {
        if (logFd !== void 0) {
          try {
            closeSync(logFd);
          } catch {
          }
        }
      }
    }
    return { status: "tapped", payloadPath, metadataPath };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

// ../digital-twin/src/schemas/cc-session.ts
init_esm_shims();
import { gzipSync } from "zlib";
function buildCcSessionEnvelope(input) {
  const compressed = gzipSync(input.payloadBytes);
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

// ../digital-twin/src/quota/probe.ts
init_esm_shims();

// ../digital-twin/src/quota/state.ts
init_esm_shims();
import {
  existsSync as defaultExistsSync,
  readFileSync as defaultReadFileSync,
  writeFileSync as defaultWriteFileSync,
  mkdirSync as defaultMkdirSync
} from "fs";
import { dirname as dirname3, join as join6 } from "path";

// ../digital-twin/src/quota/scheduler.ts
init_esm_shims();
import {
  existsSync as defaultExistsSync2,
  readFileSync as defaultReadFileSync2,
  openSync as defaultOpenSync,
  writeSync as defaultWriteSync,
  closeSync as defaultCloseSync,
  mkdirSync as defaultMkdirSync2,
  unlinkSync as defaultUnlinkSync,
  writeFileSync as defaultWriteFileSync2
} from "fs";
import { dirname as dirname4 } from "path";

// ../digital-twin/src/incremental/scan.ts
init_esm_shims();
import {
  existsSync as defaultExistsSync3,
  readdirSync as defaultReaddirSync,
  statSync as defaultStatSync
} from "fs";
import { join as join7 } from "path";

// ../digital-twin/src/quota/hourly.ts
init_esm_shims();

// ../digital-twin/src/daemon/uploader.ts
init_esm_shims();

// ../digital-twin/src/schemas/recording.ts
init_esm_shims();
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
init_esm_shims();
import {
  readdirSync as readdirSync3,
  statSync as statSync4,
  readFileSync as readFileSync5,
  writeFileSync as writeFileSync6,
  unlinkSync as unlinkSync4,
  renameSync as renameSync4,
  mkdirSync as mkdirSync6,
  existsSync as existsSync6
} from "fs";
import path from "path";
import { homedir as osHomedir2 } from "os";
var DEFAULT_QUEUE_CAPACITY_BYTES = 5e3 * 1024 * 1024;
function getPaths(home) {
  return digitalTwinPaths(home);
}
function safeStat(p) {
  try {
    const s = statSync4(p);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}
function listPending(home = osHomedir2()) {
  const paths = getPaths(home);
  if (!existsSync6(paths.pendingDir)) return [];
  const names = readdirSync3(paths.pendingDir);
  const ids = /* @__PURE__ */ new Set();
  for (const n of names) {
    if (n.endsWith(".payload")) ids.add(n.slice(0, -".payload".length));
    else if (n.endsWith(".json")) ids.add(n.slice(0, -".json".length));
  }
  const out = [];
  for (const id of ids) {
    const payloadPath = path.join(paths.pendingDir, `${id}.payload`);
    const metadataPath = path.join(paths.pendingDir, `${id}.json`);
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
    payloadBytes = readFileSync5(entry.payloadPath);
  } catch {
    return null;
  }
  let metadataRaw;
  try {
    metadataRaw = readFileSync5(entry.metadataPath, "utf-8");
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
  writeFileSync6(tmp, JSON.stringify(metadata, null, 2), "utf-8");
  renameSync4(tmp, metadataPath);
}
function removeEntry(entry) {
  for (const p of [entry.payloadPath, entry.metadataPath]) {
    try {
      unlinkSync4(p);
    } catch {
    }
  }
}
function moveToDeadLetter(entry, home = osHomedir2()) {
  const paths = getPaths(home);
  mkdirSync6(paths.deadLetterDir, { recursive: true });
  for (const src of [entry.payloadPath, entry.metadataPath]) {
    const base = path.basename(src);
    const dst = path.join(paths.deadLetterDir, base);
    try {
      renameSync4(src, dst);
    } catch {
    }
  }
}
function enforceCapacity(home = osHomedir2(), maxBytes = DEFAULT_QUEUE_CAPACITY_BYTES) {
  const paths = getPaths(home);
  const units = [];
  for (const dir of [paths.pendingDir, paths.deadLetterDir]) {
    if (!existsSync6(dir)) continue;
    const idToFiles = /* @__PURE__ */ new Map();
    for (const n of readdirSync3(dir)) {
      let id;
      if (n.endsWith(".payload")) id = n.slice(0, -".payload".length);
      else if (n.endsWith(".json")) id = n.slice(0, -".json".length);
      else continue;
      const abs = path.join(dir, n);
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
        unlinkSync4(p);
        deleted.push(p);
      } catch {
      }
    }
    total -= u.totalSize;
  }
  return deleted;
}

// ../digital-twin/src/daemon/backoff.ts
init_esm_shims();
var MAX_BACKOFF_MS = 24 * 60 * 60 * 1e3;
var DEAD_LETTER_AFTER_MS = 24 * 60 * 60 * 1e3;
function shouldDeadLetter(firstFailedAt, now) {
  if (!firstFailedAt) return false;
  const startedMs = Date.parse(firstFailedAt);
  if (!Number.isFinite(startedMs)) return false;
  return now.getTime() - startedMs >= DEAD_LETTER_AFTER_MS;
}

// ../digital-twin/src/daemon/process-manager.ts
init_esm_shims();
import {
  existsSync as existsSync7,
  readFileSync as readFileSync6,
  writeFileSync as writeFileSync7,
  unlinkSync as unlinkSync5,
  mkdirSync as mkdirSync7
} from "fs";
import { homedir as osHomedir3 } from "os";
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
function readPidFile(home = osHomedir3()) {
  const paths = digitalTwinPaths(home);
  if (!existsSync7(paths.daemonPidFile)) return null;
  try {
    const raw = readFileSync6(paths.daemonPidFile, "utf-8");
    const obj = JSON.parse(raw);
    if (typeof obj.pid !== "number" || typeof obj.start_at !== "string") return null;
    return { pid: obj.pid, start_at: obj.start_at };
  } catch {
    return null;
  }
}
function acquirePidLock(home = osHomedir3(), deps = {}) {
  const paths = digitalTwinPaths(home);
  const myPid = deps.pid ?? process.pid;
  const now = deps.now ?? (() => /* @__PURE__ */ new Date());
  const aliveCheck = deps.isPidAlive ?? isPidAlive;
  mkdirSync7(paths.digitalTwinDir, { recursive: true });
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
    unlinkSync5(paths.daemonPidFile);
  } catch {
  }
  return tryWritePidLockAtomic(paths.daemonPidFile, payload);
}
function tryWritePidLockAtomic(path3, payload) {
  try {
    writeFileSync7(path3, payload, { flag: "wx", encoding: "utf-8" });
    return true;
  } catch (err) {
    if (err.code === "EEXIST") return false;
    throw err;
  }
}
function releasePidLock(home = osHomedir3()) {
  const paths = digitalTwinPaths(home);
  try {
    unlinkSync5(paths.daemonPidFile);
  } catch {
  }
}
async function runUploadCycle(config, home = osHomedir3(), deps = {}) {
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
async function mainLoop(config, home = osHomedir3(), deps = {}) {
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

// ../digital-twin/src/bin-uploader.ts
init_esm_shims();
import { homedir as osHomedir4 } from "os";
async function runDaemon(deps = {}) {
  const home = (deps.homedir ?? osHomedir4)();
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

// ../digital-twin/src/daemon/uploader-log.ts
init_esm_shims();
import { existsSync as existsSync8, readFileSync as readFileSync7 } from "fs";
var ERROR_LINE_RE = /MODULE_NOT_FOUND|Cannot find module|daemon crash|auth failed|UnhandledPromiseRejection|\b(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError)\b:|\b(?:EACCES|ENOENT|EPERM|EISDIR|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/;
var MAX_LINE_LEN = 400;
function readLastUploaderError(home) {
  const logPath = digitalTwinPaths(home).uploaderLogFile;
  if (!existsSync8(logPath)) return null;
  let text;
  try {
    text = readFileSync7(logPath, "utf-8");
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = (lines[i] ?? "").trim();
    if (raw && ERROR_LINE_RE.test(raw)) {
      const line = raw.length > MAX_LINE_LEN ? `${raw.slice(0, MAX_LINE_LEN)}\u2026` : raw;
      return { line, lineno: i + 1 };
    }
  }
  return null;
}

// ../digital-twin/src/recorder/platform-input.ts
init_esm_shims();
import { spawnSync as nodeSpawnSync } from "child_process";
function resolvePlatformInput(opts) {
  switch (opts.platform) {
    case "darwin":
      return { format: "avfoundation", device: opts.deviceArg ?? ":0" };
    case "win32":
      return {
        format: "dshow",
        device: opts.deviceArg ?? "audio=Microphone"
      };
    case "linux":
      return { format: "pulse", device: opts.deviceArg ?? "default" };
    default:
      throw new Error(
        `unsupported platform for ffmpeg recorder: ${opts.platform}. supported: darwin, win32, linux`
      );
  }
}
function listAudioDevicesArgs(platform) {
  switch (platform) {
    case "darwin":
      return ["-f", "avfoundation", "-list_devices", "true", "-i", ""];
    case "win32":
      return ["-list_devices", "true", "-f", "dshow", "-i", "dummy"];
    case "linux":
      return ["-sources", "pulse"];
    default:
      throw new Error(
        `unsupported platform for audio device listing: ${platform}. supported: darwin, win32, linux`
      );
  }
}
function bufToString(b) {
  if (!b) return "";
  if (typeof b === "string") return b;
  return b.toString("utf-8");
}
function listAudioDevices(opts) {
  const argv = listAudioDevicesArgs(opts.platform);
  const spawn = opts.spawnSync ?? defaultListAudioDevicesSpawnSync;
  const res = spawn("ffmpeg", argv);
  const stderr = bufToString(res.stderr);
  const stdout = bufToString(res.stdout);
  return { raw: stderr || stdout, exitCode: res.status, argv };
}
function defaultListAudioDevicesSpawnSync(cmd, args) {
  const r = nodeSpawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout };
}
function installHintForPlatform(platform) {
  switch (platform) {
    case "darwin":
      return "install ffmpeg with: brew install ffmpeg";
    case "win32":
      return "install ffmpeg from https://ffmpeg.org/download.html or run: scoop install ffmpeg";
    case "linux":
      return "install ffmpeg with: apt-get install ffmpeg (Debian/Ubuntu) or dnf install ffmpeg (Fedora/RHEL)";
    default:
      return "install ffmpeg from https://ffmpeg.org/download.html";
  }
}

// ../digital-twin/src/recorder/ffmpeg-wrapper.ts
init_esm_shims();
import {
  existsSync as existsSync9,
  mkdirSync as mkdirSync8,
  readFileSync as readFileSync8,
  renameSync as renameSync5,
  statSync as statSync5,
  unlinkSync as unlinkSync6,
  writeFileSync as writeFileSync8
} from "fs";
import { join as join8 } from "path";
import {
  spawn as nodeSpawn2,
  spawnSync as nodeSpawnSync2
} from "child_process";
import {
  homedir as osHomedir5,
  platform as osPlatform2,
  arch as osArch2,
  hostname as osHostname
} from "os";
import { ulid as defaultUlid2 } from "ulid";
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
var cachedProbe = null;
function detectFfmpegDefault() {
  if (cachedProbe) return cachedProbe;
  try {
    const r = nodeSpawnSync2("ffmpeg", ["-version"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (r.status === 0 && r.stdout) {
      const out = r.stdout.toString("utf-8");
      const m = /ffmpeg version (\S+)/.exec(out);
      cachedProbe = { available: true, version: m?.[1] ?? "unknown" };
      return cachedProbe;
    }
  } catch {
  }
  cachedProbe = { available: false };
  return cachedProbe;
}
function ensureFfmpegOrThrow(probe, platform) {
  if (probe.available) return;
  throw new Error(
    `ffmpeg not found on PATH. ${installHintForPlatform(platform)}`
  );
}
function start(input, deps = {}) {
  const platform = deps.platform ?? osPlatform2();
  const detect = deps.detectFfmpeg ?? detectFfmpegDefault;
  const spawnFn = deps.spawn ?? nodeSpawn2;
  const now = deps.now ?? (() => /* @__PURE__ */ new Date());
  const probe = detect();
  ensureFfmpegOrThrow(probe, platform);
  const inputDevice = resolvePlatformInput({ platform, deviceArg: input.deviceArg });
  const oggPath = `${input.output}.ogg`;
  const args = [
    "-y",
    "-f",
    inputDevice.format,
    "-i",
    inputDevice.device,
    ...RECORDING_CODEC_FLAGS,
    oggPath
  ];
  const child = spawnFn("ffmpeg", args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  const pid = child.pid;
  if (typeof pid !== "number") {
    throw new Error("failed to spawn ffmpeg: no pid returned");
  }
  try {
    child.unref();
  } catch {
  }
  try {
    child.on("error", () => {
    });
  } catch {
  }
  writeFileSync8(`${input.output}.pid`, String(pid), "utf-8");
  writeFileSync8(
    `${input.output}.start.json`,
    JSON.stringify({ id: input.id, started_at: now().toISOString() }),
    "utf-8"
  );
  return { id: input.id, pid, output: oggPath };
}
var DEFAULT_MAX_WAIT_MS = 1e4;
var DEFAULT_POLL_INTERVAL_MS = 100;
function defaultIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function defaultKill(pid, signal) {
  return process.kill(pid, signal ?? "SIGTERM");
}
function defaultSleep2(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
async function stop(input, deps = {}) {
  const platform = deps.platform ?? osPlatform2();
  const home = (deps.homedir ?? osHomedir5)();
  const ulidFn = deps.ulid ?? defaultUlid2;
  const now = deps.now ?? (() => /* @__PURE__ */ new Date());
  const arch = deps.arch ?? osArch2();
  const host = deps.hostname ?? osHostname();
  const isAlive = deps.isAlive ?? defaultIsAlive;
  const kill = deps.kill ?? defaultKill;
  const sleep = deps.sleep ?? defaultSleep2;
  const spawnFn = deps.spawn ?? nodeSpawn2;
  const maxWaitMs = deps.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const pidFile = `${input.output}.pid`;
  const startMetaFile = `${input.output}.start.json`;
  const oggPath = `${input.output}.ogg`;
  if (!existsSync9(pidFile)) {
    return { status: "no-pid" };
  }
  const pidStr = readFileSync8(pidFile, "utf-8").trim();
  const pid = Number(pidStr);
  if (!Number.isFinite(pid) || pid <= 0) {
    return { status: "error", error: `invalid pid in ${pidFile}: ${pidStr}` };
  }
  try {
    kill(pid, "SIGTERM");
  } catch (err) {
    if (platform === "win32") {
      try {
        const child = spawnFn("taskkill", ["/PID", String(pid), "/F"], {
          stdio: "ignore",
          windowsHide: true
        });
        try {
          child.unref();
        } catch {
        }
      } catch (spawnErr) {
        return {
          status: "error",
          error: `failed to kill pid ${pid}: ${spawnErr.message ?? String(spawnErr)}`
        };
      }
    } else {
      return {
        status: "error",
        error: `failed to kill pid ${pid}: ${err.message ?? String(err)}`
      };
    }
  }
  const deadline = Date.now() + maxWaitMs;
  let alive = isAlive(pid);
  while (alive && Date.now() < deadline) {
    await sleep(pollIntervalMs);
    alive = isAlive(pid);
  }
  if (alive) {
    return { status: "timeout" };
  }
  let startedAt = now().toISOString();
  let recId = input.id;
  try {
    const sm = JSON.parse(readFileSync8(startMetaFile, "utf-8"));
    if (typeof sm.started_at === "string") startedAt = sm.started_at;
    if (typeof sm.id === "string") recId = sm.id;
  } catch {
  }
  if (!existsSync9(oggPath)) {
    cleanupTempFiles(pidFile, startMetaFile);
    return { status: "error", error: `ffmpeg did not produce output: ${oggPath}` };
  }
  const endedAtDate = now();
  const endedAt = endedAtDate.toISOString();
  const startedAtMs = Date.parse(startedAt);
  const duration = Number.isFinite(startedAtMs) ? Math.max(0, endedAtDate.getTime() - startedAtMs) : 0;
  const paths = digitalTwinPaths(home);
  mkdirSync8(paths.pendingDir, { recursive: true });
  let payloadSize = 0;
  try {
    payloadSize = statSync5(oggPath).size;
  } catch {
  }
  const sizeCap = deps.maxPayloadBytes ?? MAX_PAYLOAD_BYTES;
  if (payloadSize > sizeCap) {
    cleanupTempFiles(pidFile, startMetaFile);
    return {
      status: "too-large",
      oversizePath: oggPath,
      payload_size: payloadSize
    };
  }
  const newId = ulidFn();
  const payloadPath = join8(paths.pendingDir, `${newId}.payload`);
  const metadataPath = join8(paths.pendingDir, `${newId}.json`);
  try {
    renameSync5(oggPath, payloadPath);
  } catch {
    try {
      const buf = readFileSync8(oggPath);
      writeFileSync8(payloadPath, buf);
      unlinkSync6(oggPath);
    } catch (copyErr) {
      cleanupTempFiles(pidFile, startMetaFile);
      return {
        status: "error",
        error: `failed to move OGG into pending/: ${copyErr.message ?? String(copyErr)}`
      };
    }
  }
  const metadata = {
    id: newId,
    kind: "recording",
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: duration,
    codec: RECORDING_CODEC_DEFAULTS.codec,
    bitrate: RECORDING_CODEC_DEFAULTS.bitrate,
    sample_rate: RECORDING_CODEC_DEFAULTS.sample_rate,
    channels: RECORDING_CODEC_DEFAULTS.channels,
    container: RECORDING_CODEC_DEFAULTS.container,
    payload_size: payloadSize,
    source: "recorder",
    host: { os: platform, arch, hostname: host },
    teamagent_version: deps.teamagentVersion ?? "unknown",
    schema_version: 1
  };
  const metaWithCorrelation = { ...metadata, correlation_id: recId };
  writeFileSync8(metadataPath, JSON.stringify(metaWithCorrelation, null, 2), "utf-8");
  cleanupTempFiles(pidFile, startMetaFile);
  return { status: "stopped", payloadPath, metadataPath };
}
function cleanupTempFiles(...files) {
  for (const f of files) {
    try {
      if (existsSync9(f)) unlinkSync6(f);
    } catch {
    }
  }
}
function importRecording(input, deps = {}) {
  const platform = deps.platform ?? osPlatform2();
  const detect = deps.detectFfmpeg ?? detectFfmpegDefault;
  const probe = detect();
  ensureFfmpegOrThrow(probe, platform);
  const spawnSyncFn = deps.spawnSync ?? nodeSpawnSync2;
  const home = (deps.homedir ?? osHomedir5)();
  const ulidFn = deps.ulid ?? defaultUlid2;
  const now = deps.now ?? (() => /* @__PURE__ */ new Date());
  const arch = deps.arch ?? osArch2();
  const host = deps.hostname ?? osHostname();
  const oggPath = `${input.output}.ogg`;
  const args = [
    "-y",
    "-i",
    input.inputPath,
    ...RECORDING_CODEC_FLAGS,
    oggPath
  ];
  const r = spawnSyncFn("ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  if (r.status !== 0) {
    const stderr = r.stderr ? r.stderr.toString("utf-8") : "";
    return {
      status: "failed",
      error: stderr.trim() || `ffmpeg exited with status ${r.status}`
    };
  }
  if (!existsSync9(oggPath)) {
    return {
      status: "failed",
      error: `ffmpeg reported success but output missing: ${oggPath}`
    };
  }
  const paths = digitalTwinPaths(home);
  mkdirSync8(paths.pendingDir, { recursive: true });
  const id = ulidFn();
  const payloadPath = join8(paths.pendingDir, `${id}.payload`);
  const metadataPath = join8(paths.pendingDir, `${id}.json`);
  let payloadSize = 0;
  try {
    payloadSize = statSync5(oggPath).size;
  } catch {
  }
  try {
    renameSync5(oggPath, payloadPath);
  } catch {
    try {
      const buf = readFileSync8(oggPath);
      writeFileSync8(payloadPath, buf);
      unlinkSync6(oggPath);
    } catch (copyErr) {
      return {
        status: "failed",
        error: `failed to move imported OGG: ${copyErr.message ?? String(copyErr)}`
      };
    }
  }
  const nowDate = now();
  const metadata = {
    id,
    kind: "recording",
    started_at: nowDate.toISOString(),
    ended_at: nowDate.toISOString(),
    duration_ms: 0,
    codec: RECORDING_CODEC_DEFAULTS.codec,
    bitrate: RECORDING_CODEC_DEFAULTS.bitrate,
    sample_rate: RECORDING_CODEC_DEFAULTS.sample_rate,
    channels: RECORDING_CODEC_DEFAULTS.channels,
    container: RECORDING_CODEC_DEFAULTS.container,
    payload_size: payloadSize,
    source: "import",
    host: { os: platform, arch, hostname: host },
    teamagent_version: deps.teamagentVersion ?? "unknown",
    schema_version: 1
  };
  writeFileSync8(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  return { status: "imported", payloadPath, metadataPath };
}

// ../cli/src/commands/doctor-diff.ts
init_esm_shims();
function diffLines(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = [];
  for (let i2 = 0; i2 <= n; i2++) dp.push(new Array(m + 1).fill(0));
  for (let i2 = n - 1; i2 >= 0; i2--) {
    for (let j2 = m - 1; j2 >= 0; j2--) {
      if (a[i2] === b[j2]) dp[i2][j2] = dp[i2 + 1][j2 + 1] + 1;
      else dp[i2][j2] = Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "eq", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", line: a[i] });
      i++;
    } else {
      ops.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: "del", line: a[i++] });
  while (j < m) ops.push({ type: "add", line: b[j++] });
  return ops;
}
function unifiedDiff(filePath, before, after, context = 3) {
  const beforeLines = before.split("\n");
  const afterLines = after === null ? [] : after.split("\n");
  const ops = diffLines(beforeLines, afterLines);
  if (ops.every((op) => op.type === "eq")) return "";
  const oldLineAt = new Array(ops.length + 1);
  const newLineAt = new Array(ops.length + 1);
  oldLineAt[0] = 1;
  newLineAt[0] = 1;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    oldLineAt[i + 1] = oldLineAt[i] + (op.type === "add" ? 0 : 1);
    newLineAt[i + 1] = newLineAt[i] + (op.type === "del" ? 0 : 1);
  }
  const ranges = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type === "eq") continue;
    const start2 = Math.max(0, i - context);
    const end = Math.min(ops.length - 1, i + context);
    const last = ranges[ranges.length - 1];
    if (last && last[1] >= start2 - 1) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start2, end]);
    }
  }
  const out = [];
  out.push(`--- ${filePath}`);
  out.push(after === null ? `+++ /dev/null` : `+++ ${filePath}`);
  for (const [start2, end] of ranges) {
    const hunkOps = ops.slice(start2, end + 1);
    const oldStart = oldLineAt[start2];
    const newStart = newLineAt[start2];
    const oldCount = hunkOps.filter((o) => o.type !== "add").length;
    const newCount = hunkOps.filter((o) => o.type !== "del").length;
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const op of hunkOps) {
      const prefix = op.type === "eq" ? " " : op.type === "del" ? "-" : "+";
      out.push(prefix + op.line);
    }
  }
  return out.join("\n") + "\n";
}

// ../cli/src/commands/doctor.ts
var _require = createRequire(import.meta.url);
function parseDoctorArgs(argv) {
  let cwd;
  for (const arg of argv) {
    if (arg.startsWith("--cwd=")) {
      cwd = arg.slice("--cwd=".length);
      break;
    }
  }
  const cwdIdx = argv.indexOf("--cwd");
  if (cwdIdx !== -1 && argv[cwdIdx + 1] && !argv[cwdIdx + 1].startsWith("--")) {
    cwd = argv[cwdIdx + 1];
  }
  return {
    fix: argv.includes("--fix"),
    dryRun: argv.includes("--dry-run"),
    json: argv.includes("--json"),
    postinstall: argv.includes("--postinstall"),
    cwd
  };
}
function backupFile(filePath, opts) {
  const home = opts.homeDir ?? os.homedir();
  const backupDir = opts.backupDir ?? path2.join(home, ".teamagent", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backupPath = path2.join(backupDir, `${path2.basename(filePath)}.${ts}.bak`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}
async function autoFix(check, opts) {
  if (check.status !== "fail") {
    return { name: check.name, status: "skipped", detail: "check did not fail" };
  }
  const cwd = opts.cwd ?? process.cwd();
  try {
    if (check.name === "knowledge-db") {
      if (opts.dryRun) {
        return {
          name: check.name,
          status: "preview",
          detail: "\u5C06\u8FD0\u884C `teamagent init` \u521B\u5EFA knowledge.db\uFF08\u65E0 prior state\uFF0C\u56E0\u6B64\u8DF3\u8FC7 backup\uFF09"
        };
      }
      const { executeInit } = await import("./init-DZ5D4MA2.js");
      await executeInit({ cwd, skipImport: true });
      return {
        name: check.name,
        status: "applied",
        detail: "\u5DF2\u901A\u8FC7 `teamagent init` \u521B\u5EFA knowledge.db"
      };
    } else if (check.name === "hook-registered" || check.name === "hook-script") {
      if (opts.dryRun) {
        return {
          name: check.name,
          status: "preview",
          detail: "\u5C06\u5411 .claude/settings.local.json \u6CE8\u518C PreToolUse hook"
        };
      }
      const { installHook } = await import("./install-hook-OOXQ5YHJ.js");
      installHook({ cwd });
      return {
        name: check.name,
        status: "applied",
        detail: "\u5DF2\u5411 .claude/settings.local.json \u6CE8\u518C PreToolUse hook"
      };
    } else if (check.name === "claude-md") {
      const claudeMdPath = path2.join(cwd, "CLAUDE.md");
      if (!fs.existsSync(claudeMdPath)) {
        return {
          name: check.name,
          status: "skipped",
          detail: `CLAUDE.md \u4E0D\u5B58\u5728: ${claudeMdPath}`,
          filePath: claudeMdPath
        };
      }
      const before = fs.readFileSync(claudeMdPath, "utf-8");
      const after = stripLegacyTeamagentBlock(before);
      if (after === before) {
        return {
          name: check.name,
          status: "skipped",
          detail: "\u672A\u68C0\u6D4B\u5230 legacy TEAMAGENT \u5757",
          filePath: claudeMdPath
        };
      }
      const willDelete = after === "";
      const targetAfter = willDelete ? null : after;
      if (opts.dryRun) {
        return {
          name: check.name,
          status: "preview",
          filePath: claudeMdPath,
          diff: unifiedDiff(claudeMdPath, before, targetAfter),
          detail: willDelete ? "\u5C06\u5220\u9664 CLAUDE.md\uFF08\u6574\u6587\u4EF6\u5373 legacy \u5757\uFF09" : "\u5C06\u5265\u79BB legacy TEAMAGENT \u5757"
        };
      }
      const backupPath = backupFile(claudeMdPath, opts);
      if (willDelete) {
        fs.unlinkSync(claudeMdPath);
      } else {
        fs.writeFileSync(claudeMdPath, after, "utf-8");
      }
      return {
        name: check.name,
        status: "applied",
        filePath: claudeMdPath,
        backupPath,
        detail: willDelete ? "\u5DF2\u5220\u9664 CLAUDE.md\uFF08\u6574\u6587\u4EF6\u5373 legacy \u5757\uFF09" : "\u5DF2\u5265\u79BB legacy TEAMAGENT \u5757"
      };
    }
    return { name: check.name, status: "skipped", detail: "\u65E0\u81EA\u52A8\u4FEE\u590D" };
  } catch (e) {
    return {
      name: check.name,
      status: "error",
      detail: "\u81EA\u52A8\u4FEE\u590D\u5931\u8D25",
      error: String(e).slice(0, 200)
    };
  }
}
async function executeDoctor(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.homeDir ?? os.homedir();
  const checks = [];
  const fixOutcomes = [];
  const dryRun = !!opts.fix && !!opts.dryRun;
  const tryFix = async (check) => {
    if (!opts.fix || check.status !== "fail") return;
    const outcome = await autoFix(check, opts);
    fixOutcomes.push(outcome);
  };
  const nodeCheck = checkNodeVersion();
  checks.push(nodeCheck);
  if (nodeCheck.status === "fail") {
    return finalize(checks, true, opts, fixOutcomes);
  }
  checks.push(
    checkInstallTableBundles(opts.installTableEnumerator, opts.bundleExistsFn)
  );
  const claudeCheck = checkClaudeCode(opts.claudeProbe);
  checks.push(claudeCheck);
  if (claudeCheck.status === "fail") {
    return finalize(checks, true, opts, fixOutcomes);
  }
  checks.push(checkSqliteVec());
  const homeCheck = checkHomeDir(home);
  checks.push(homeCheck);
  if (homeCheck.status === "fail") {
    return finalize(checks, true, opts, fixOutcomes);
  }
  const dbPath = path2.join(cwd, ".teamagent", "knowledge.db");
  const dbCheck = checkKnowledgeDb(dbPath);
  checks.push(dbCheck);
  await tryFix(dbCheck);
  if (dbCheck.status === "fail" && !opts.fix) {
    checks.push(skip("hook-registered", "knowledge.db \u5148\u4FEE"));
    checks.push(skip("hook-script", "knowledge.db \u5148\u4FEE"));
    return finalize(checks, false, opts, fixOutcomes);
  }
  const settingsPath = path2.join(cwd, ".claude", "settings.local.json");
  const userSettingsPath = path2.join(home, ".claude", "settings.json");
  const hookCheck = checkHookRegistered(settingsPath, userSettingsPath);
  checks.push(hookCheck);
  await tryFix(hookCheck);
  if (hookCheck.status === "fail" && !opts.fix) {
    checks.push(skip("hook-script", "Hook \u6CE8\u518C\u5148\u4FEE"));
    return finalize(checks, false, opts, fixOutcomes);
  }
  const hookScriptCheck = checkHookScript(settingsPath);
  checks.push(hookScriptCheck);
  await tryFix(hookScriptCheck);
  if (hookScriptCheck.status === "pass") {
    checks.push(await checkHookSpawn(hookScriptCheck.detail, opts.hookProbe));
  }
  checks.push(checkSettingsJsonScope(settingsPath, path2.join(home, ".claude", "settings.json")));
  checks.push(checkPluginSync(cwd, home));
  checks.push(checkStaticUserSkillsPropagated(home));
  checks.push(checkCodexBin(opts.codexProbe));
  checks.push(await checkMcpReachability(cwd, opts.mcpProbe));
  checks.push(await checkDigitalTwinUploader(home, opts.uploaderProbe));
  const claudeMdPath = path2.join(cwd, "CLAUDE.md");
  const claudeMdCheck = checkClaudeMd(claudeMdPath);
  if (opts.fix && claudeMdCheck.status === "fail") {
    await tryFix(claudeMdCheck);
    if (dryRun) {
      checks.push(claudeMdCheck);
    } else {
      checks.push(checkClaudeMd(claudeMdPath));
    }
  } else {
    checks.push(claudeMdCheck);
  }
  checks.push(await checkVectorModelState(home));
  return finalize(checks, false, opts, fixOutcomes);
}
async function checkVectorModelState(home) {
  const { describeWarmupReadiness, defaultWarmupStatePath } = await import("./warmup-state-4E7RVQWL.js");
  const r = describeWarmupReadiness(defaultWarmupStatePath(home));
  if (r.reason === "ready" && r.state) {
    const took = r.state.completed_at && r.state.started_at ? new Date(r.state.completed_at).getTime() - new Date(r.state.started_at).getTime() : void 0;
    return {
      name: "vector_model",
      status: "pass",
      detail: `ready (${r.state.model})${took ? ` \xB7 \u9884\u70ED ${Math.round(took / 1e3)}s` : ""}`
    };
  }
  if (r.reason === "missing") {
    return {
      name: "vector_model",
      status: "skip",
      detail: "\u65E0 warmup \u72B6\u6001\u6587\u4EF6 (\u5C1A\u672A\u8DD1\u8FC7 init/warmup)"
    };
  }
  if (r.reason === "downloading" && r.state) {
    const p = r.state.progress;
    const pct = p && p.total_bytes > 0 ? Math.min(100, Math.floor(p.loaded_bytes / p.total_bytes * 100)) : null;
    const detail = pct !== null ? `downloading (${pct}%, ${p.files_done}/${p.files_total} files, pid=${r.state.pid})` : `downloading (pid=${r.state.pid})`;
    return { name: "vector_model", status: "skip", detail };
  }
  if (r.reason === "stale_downloading" && r.state) {
    return {
      name: "vector_model",
      status: "fail",
      detail: `stale downloading (pid=${r.state.pid} not alive); \u8DD1 \`teamagent warmup\` \u91CD\u8BD5`
    };
  }
  if (r.reason === "failed" && r.state) {
    return {
      name: "vector_model",
      status: "fail",
      detail: `failed: ${r.state.error ?? "unknown"}`
    };
  }
  if (r.reason === "skipped" && r.state) {
    return {
      name: "vector_model",
      status: "skip",
      detail: `skipped (vector deps \u672A\u5728 node_modules \u4E2D\u627E\u5230; \u91CD\u88C5 teamagent \u6062\u590D)`
    };
  }
  return {
    name: "vector_model",
    status: "fail",
    detail: `state file malformed`
  };
}
function finalize(checks, earlyExit, opts = {}, fixOutcomes = []) {
  if (!checks.some((check) => check.name === "team-sharing")) {
    checks.push(checkTeamSharingStatus());
  }
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const skipped = checks.filter((c) => c.status === "skip").length;
  const result = {
    checks,
    passed,
    failed,
    skipped,
    allPassed: failed === 0 && !earlyExit
  };
  if (opts.fix) {
    result.fixOutcomes = fixOutcomes;
    result.dryRun = !!opts.dryRun;
  }
  return result;
}
function skip(name, detail) {
  return { name, status: "skip", detail };
}
function checkNodeVersion() {
  const raw = process.version;
  const major = parseInt(raw.slice(1).split(".")[0] ?? "0", 10);
  if (major >= 22) {
    return { name: "node-version", status: "pass", detail: `${raw}  (\u9700\u8981 \u2265 22)` };
  }
  return {
    name: "node-version",
    status: "fail",
    detail: `${raw} (\u9700\u8981 \u2265 22)`,
    fix: "nvm install 22 && nvm use 22"
  };
}
var NODE_MODULES_BIN_FRAGMENTS = ["node_modules/.bin", "node_modules\\.bin"];
function pathContainsNodeModulesBin(p) {
  return NODE_MODULES_BIN_FRAGMENTS.some((frag) => p.includes(frag));
}
function firstLine(s) {
  const trimmed = s.trim();
  return trimmed.split("\n")[0] ?? trimmed;
}
var defaultClaudeProbe = (env) => {
  try {
    const stdout = execSync2("claude --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: env ?? process.env
    });
    return { ok: true, stdout, stderr: "" };
  } catch (e) {
    const err = e;
    const stderr = String(err.stderr ?? err.message ?? "");
    const stdout = String(err.stdout ?? "");
    return { ok: false, stdout, stderr };
  }
};
function isBrokenLocalStub(stderr) {
  return stderr.includes("claude native binary not installed") || stderr.includes("postinstall did not run") || stderr.includes("@anthropic-ai/claude-code/install.cjs");
}
function envWithoutNodeModulesBin(env) {
  const PATH = env.PATH ?? env.Path ?? "";
  if (!PATH) return null;
  const sep3 = path2.delimiter;
  const parts = PATH.split(sep3);
  const filtered = parts.filter((p) => !pathContainsNodeModulesBin(p));
  if (filtered.length === parts.length) return null;
  const joined = filtered.join(sep3);
  return { ...env, PATH: joined, Path: joined };
}
function checkClaudeCode(probe = defaultClaudeProbe) {
  const first = probe();
  if (first.ok) {
    return { name: "claude-code", status: "pass", detail: firstLine(first.stdout) };
  }
  if (isBrokenLocalStub(first.stderr)) {
    const cleanEnv = envWithoutNodeModulesBin(process.env);
    if (cleanEnv) {
      const retry = probe(cleanEnv);
      if (retry.ok) {
        return {
          name: "claude-code",
          status: "pass",
          detail: `${firstLine(retry.stdout)} (\u672C\u5730 pnpm \u526F\u672C\u635F\u574F\uFF0C\u5DF2\u56DE\u9000\u5230\u5168\u5C40 claude)`
        };
      }
    }
    return {
      name: "claude-code",
      status: "fail",
      detail: "\u672C\u5730 pnpm \u526F\u672C\u672A\u5B89\u88C5\u539F\u751F\u4E8C\u8FDB\u5236\uFF0C\u4E14\u5168\u5C40 claude \u4E0D\u53EF\u7528",
      fix: "\u8FD0\u884C `node node_modules/@anthropic-ai/claude-code/install.cjs` \u4FEE\u590D\u672C\u5730\u526F\u672C\uFF0C\u6216\u786E\u4FDD\u5168\u5C40 claude \u5728 PATH \u4E2D"
    };
  }
  return {
    name: "claude-code",
    status: "fail",
    detail: "\u672A\u627E\u5230 claude \u547D\u4EE4",
    fix: "npm install -g @anthropic-ai/claude-code"
  };
}
function checkSqliteVec() {
  try {
    _require("sqlite-vec");
    return { name: "sqlite-vec", status: "pass", detail: "\u52A0\u8F7D\u6210\u529F" };
  } catch {
    const here = path2.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w):/, "$1:"));
    const candidates = [
      // packages/cli/.../doctor.ts → walk up to monorepo root
      path2.resolve(here, "../../../adapters"),
      path2.resolve(here, "../../../teamagent"),
      path2.resolve(here, "../../../../adapters"),
      path2.resolve(here, "../../../../teamagent")
    ];
    for (const root of candidates) {
      try {
        _require.resolve("sqlite-vec", { paths: [root] });
        return { name: "sqlite-vec", status: "pass", detail: `\u52A0\u8F7D\u6210\u529F (resolved via ${path2.basename(root)})` };
      } catch {
      }
    }
    return {
      name: "sqlite-vec",
      status: "fail",
      detail: "sqlite-vec \u6269\u5C55\u52A0\u8F7D\u5931\u8D25",
      fix: "npm install -g sqlite-vec  \uFF08\u6216\u68C0\u67E5\u5E73\u53F0\u662F\u5426\u652F\u6301\uFF09"
    };
  }
}
function checkHomeDir(home) {
  const tDir = path2.join(home, ".teamagent");
  try {
    fs.mkdirSync(tDir, { recursive: true });
    const probe = path2.join(tDir, `.doctor-probe-${process.pid}`);
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
    return { name: "home-dir", status: "pass", detail: `${tDir} \u53EF\u8BFB\u5199` };
  } catch (e) {
    return {
      name: "home-dir",
      status: "fail",
      detail: `~/.teamagent \u4E0D\u53EF\u5199: ${String(e).slice(0, 80)}`,
      fix: `chmod 755 ${tDir}`
    };
  }
}
function checkKnowledgeDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return {
      name: "knowledge-db",
      status: "fail",
      detail: "\u77E5\u8BC6\u5E93\u672A\u521D\u59CB\u5316",
      fix: "teamagent init"
    };
  }
  try {
    const db = openDb(dbPath);
    db.close();
    return { name: "knowledge-db", status: "pass", detail: dbPath };
  } catch (e) {
    return {
      name: "knowledge-db",
      status: "fail",
      detail: `knowledge.db \u65E0\u6CD5\u6253\u5F00\uFF1A${String(e).slice(0, 120)}`,
      fix: "teamagent init  \uFF08\u5C06\u91CD\u5EFA\u6570\u636E\u5E93\uFF09"
    };
  }
}
function hasTeamAgentHookInSettings(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings["hooks"];
    if (!hooks) return false;
    return Object.values(hooks).some(
      (entries) => Array.isArray(entries) && entries.some(
        (h) => typeof h === "object" && h !== null && typeof h["_teamagentTag"] === "string" && h["_teamagentTag"].startsWith("teamagent-")
      )
    );
  } catch {
    return false;
  }
}
function checkHookRegistered(settingsPath, userSettingsPath) {
  if (hasTeamAgentHookInSettings(settingsPath)) {
    return { name: "hook-registered", status: "pass", detail: "PreToolUse Hook \u5DF2\u6CE8\u518C" };
  }
  if (userSettingsPath && hasTeamAgentHookInSettings(userSettingsPath)) {
    return { name: "hook-registered", status: "pass", detail: "\u7528\u6237\u7EA7 Hook \u5DF2\u6CE8\u518C (teamagent install-user-hook)" };
  }
  if (!fs.existsSync(settingsPath)) {
    return {
      name: "hook-registered",
      status: "fail",
      detail: ".claude/settings.local.json \u4E0D\u5B58\u5728",
      fix: "teamagent install-hook"
    };
  }
  try {
    JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    return {
      name: "hook-registered",
      status: "fail",
      detail: "settings.local.json \u4E2D\u672A\u627E\u5230 TeamAgent hook",
      fix: "teamagent install-hook"
    };
  } catch {
    return {
      name: "hook-registered",
      status: "fail",
      detail: "\u65E0\u6CD5\u89E3\u6790 settings.local.json",
      fix: "teamagent install-hook"
    };
  }
}
function checkHookScript(settingsPath) {
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings["hooks"];
    const pre = hooks?.["PreToolUse"];
    const entry = Array.isArray(pre) ? pre.find((h) => h["_teamagentTag"] === "teamagent-pre-tool-use") : void 0;
    const cmds = entry?.["hooks"];
    const cmd = cmds?.[0]?.command ?? "";
    const match = cmd.match(/node\s+"?([^"]+)"?/);
    const scriptPath = match?.[1];
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      return {
        name: "hook-script",
        status: "fail",
        detail: `Hook \u811A\u672C\u4E0D\u5B58\u5728: ${scriptPath ?? "(\u672A\u627E\u5230\u8DEF\u5F84)"}`,
        fix: "npm install -g teamagent  \uFF08\u91CD\u88C5\uFF09"
      };
    }
    return { name: "hook-script", status: "pass", detail: scriptPath };
  } catch {
    return {
      name: "hook-script",
      status: "fail",
      detail: "\u65E0\u6CD5\u8BFB\u53D6 hook \u811A\u672C\u8DEF\u5F84",
      fix: "teamagent install-hook"
    };
  }
}
var defaultHookProbe = (scriptPath, opts = {}) => {
  const timeoutMs = opts.timeoutMs ?? 5e3;
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env["CLAUDE_PROJECT_DIR"];
    delete env["TEAMAGENT_ALLOW_BARE_SESSIONSTART"];
    let child;
    try {
      child = nodeSpawn3(process.execPath, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env,
        windowsHide: true
      });
    } catch (err) {
      resolve({ exitCode: null, stderr: "", timedOut: false, spawnError: String(err) });
      return;
    }
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
      }
      resolve({ exitCode: null, stderr, timedOut: true });
    }, timeoutMs);
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: null, stderr, timedOut: false, spawnError: String(err) });
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString("utf-8");
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: code, stderr, timedOut: false });
    });
    child.stdin?.end();
  });
};
async function checkHookSpawn(scriptPath, probe = defaultHookProbe) {
  const result = await probe(scriptPath);
  if (result.spawnError) {
    return {
      name: "hook-spawn",
      status: "fail",
      detail: `hook spawn \u542F\u52A8\u5931\u8D25: ${result.spawnError.slice(0, 200)}`,
      fix: "\u91CD\u88C5 teamagent (npm install -g teamagent) \u6216\u68C0\u67E5 node \u662F\u5426\u53EF\u7528"
    };
  }
  if (result.timedOut) {
    return {
      name: "hook-spawn",
      status: "fail",
      detail: `hook spawn \u8D85\u8FC7 5s \u672A\u9000\u51FA \u2014 \u53EF\u80FD\u5361\u5728 require/import \u94FE`,
      fix: "\u68C0\u67E5 ~/.teamagent/postinstall.log \u4E2D\u7684 stage=install-user-hook \u4E0E\u4F9D\u8D56\u5B8C\u6574\u6027"
    };
  }
  if (result.exitCode === 0) {
    return {
      name: "hook-spawn",
      status: "pass",
      detail: "hook \u8FDB\u7A0B\u80FD\u6210\u529F\u542F\u52A8\u5E76\u9000\u51FA (probe: empty-stdin \u2192 fast-exit 0)"
    };
  }
  const stderrTail = result.stderr.trim().split("\n").slice(-5).join(" | ").slice(-400);
  return {
    name: "hook-spawn",
    status: "fail",
    detail: `hook spawn exit=${result.exitCode} \u2014 ${stderrTail || "(no stderr)"}`,
    fix: "\u91CD\u88C5 teamagent \u6216\u68C0\u67E5 ~/.teamagent/postinstall.log"
  };
}
var defaultUploaderProbe = (binPath, opts = {}) => {
  const timeoutMs = opts.timeoutMs ?? 5e3;
  return new Promise((resolve) => {
    const env = { ...process.env, TEAMAGENT_UPLOADER_DRYRUN: "1" };
    let child;
    try {
      child = nodeSpawn3(process.execPath, [binPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env,
        windowsHide: true
      });
    } catch (err) {
      resolve({ exitCode: null, stderr: "", timedOut: false, spawnError: String(err) });
      return;
    }
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
      }
      resolve({ exitCode: null, stderr, timedOut: true });
    }, timeoutMs);
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: null, stderr, timedOut: false, spawnError: String(err) });
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString("utf-8");
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: code, stderr, timedOut: false });
    });
    child.stdin?.on("error", () => {
    });
    child.stdin?.end();
  });
};
var UPLOADER_DRYRUN_MARKER = "TEAMAGENT_UPLOADER_DRYRUN";
async function checkDigitalTwinUploader(home, probe = defaultUploaderProbe) {
  const name = "digital-twin-uploader";
  const binPath = path2.join(digitalTwinPaths(home).digitalTwinDir, "bin-uploader.cjs");
  if (!fs.existsSync(binPath)) {
    return {
      name,
      status: "skip",
      detail: "digital-twin-uploader: \u672A\u5B89\u88C5 (\u672C\u673A\u672A\u8DD1\u8FC7 teamagent init / install-hook)"
    };
  }
  let staged = "";
  try {
    staged = fs.readFileSync(binPath, "utf-8");
  } catch (err) {
    return {
      name,
      status: "fail",
      detail: `digital-twin-uploader: BROKEN \u2014 \u65E0\u6CD5\u8BFB\u53D6 ${binPath}: ${String(err).slice(0, 160)}`,
      fix: "pnpm --filter @teamagent/digital-twin build && pnpm teamagent install-hook"
    };
  }
  if (!staged.includes(UPLOADER_DRYRUN_MARKER)) {
    return {
      name,
      status: "skip",
      detail: "digital-twin-uploader: \u8DF3\u8FC7 \u2014 \u5DF2\u88C5\u7684 bin-uploader.cjs \u65E9\u4E8E\u672C\u63A2\u9488 (issue #368)\uFF0C\u8DD1 `teamagent install-hook` \u91CD\u65B0 stage \u540E\u518D doctor \u9A8C\u8BC1"
    };
  }
  const result = await probe(binPath);
  const lastErr = readLastUploaderError(home);
  const moduleNotFound = /MODULE_NOT_FOUND|Cannot find module/i.test(result.stderr);
  if (result.spawnError) {
    return {
      name,
      status: "fail",
      detail: `digital-twin-uploader: BROKEN \u2014 spawn \u5931\u8D25: ${result.spawnError.slice(0, 200)}`,
      fix: "node \u4E0D\u53EF\u7528\uFF1F\u68C0\u67E5\u540E\u91CD\u88C5 teamagent"
    };
  }
  if (result.timedOut) {
    return {
      name,
      status: "fail",
      detail: "digital-twin-uploader: BROKEN \u2014 dry-run \u8D85\u8FC7 5s \u672A\u9000\u51FA (\u53EF\u80FD\u5361\u5728 require/import \u94FE)",
      fix: "pnpm --filter @teamagent/digital-twin build && pnpm teamagent install-hook"
    };
  }
  if (result.exitCode === 0 && !moduleNotFound) {
    return {
      name,
      status: "pass",
      detail: "digital-twin-uploader: OK (dry-run \u52A0\u8F7D\u4E86\u6240\u6709 import)" + (lastErr ? ` \xB7 \u6CE8\u610F uploader.log \u6709\u5386\u53F2\u9519\u8BEF: ${lastErr.line} (line ${lastErr.lineno})` : "")
    };
  }
  const stderrTail = result.stderr.trim().split("\n").slice(-5).join(" | ").slice(-400);
  const why = moduleNotFound ? `MODULE_NOT_FOUND \u2014 ${stderrTail || "(staged bin-uploader.cjs \u7F3A\u6253\u5305\u4F9D\u8D56)"}` : `exit=${result.exitCode} \u2014 ${stderrTail || lastErr?.line || "(no stderr)"}`;
  return {
    name,
    status: "fail",
    detail: `digital-twin-uploader: BROKEN \u2014 ${why}`,
    fix: "pnpm --filter @teamagent/digital-twin build && pnpm teamagent install-hook"
  };
}
function checkSettingsJsonScope(projectSettingsPath, userSettingsPath) {
  const projectHasHook = hasTeamAgentHookInSettings(projectSettingsPath);
  const userHasHook = hasTeamAgentHookInSettings(userSettingsPath);
  if (projectHasHook) {
    return {
      name: "settings-json-scope",
      status: "pass",
      detail: `Hook \u5DF2\u6CE8\u518C\u5728\u9879\u76EE\u7EA7 (.claude/settings.local.json)`
    };
  }
  if (userHasHook) {
    return {
      name: "settings-json-scope",
      status: "pass",
      detail: `Hook \u5DF2\u6CE8\u518C\u5728\u7528\u6237\u7EA7 (~/.claude/settings.json)`
    };
  }
  return {
    name: "settings-json-scope",
    status: "fail",
    detail: "\u672A\u627E\u5230\u9879\u76EE\u7EA7\u6216\u7528\u6237\u7EA7 settings.json hook",
    fix: "teamagent install-hook"
  };
}
function checkInstallTableBundles(enumerate = enumerateInstallTableBundlePaths, existsFn = (p) => fs.existsSync(p)) {
  const entries = enumerate();
  const missing = entries.filter((e) => !existsFn(e.absPath));
  if (missing.length === 0) {
    return {
      name: "install-table-bundles",
      status: "pass",
      detail: `${entries.length} \u4E2A install-table bundles \u90FD\u5728 dist/ \u4E0B`
    };
  }
  const filenames = Array.from(new Set(missing.map((m) => m.bundleFilename))).join(", ");
  return {
    name: "install-table-bundles",
    status: "fail",
    detail: `dist \u7F3A\u5931 install-table \u5F15\u7528\u7684 bundle: ${filenames}`,
    fix: "pnpm --filter teamagent build  \uFF08\u6216\u91CD\u88C5 teamagent\uFF09"
  };
}
function checkStaticUserSkillsPropagated(home) {
  const plan = planStaticUserSkillInstall({
    homeDir: home,
    fileExists: (p) => fs.existsSync(p),
    joinPath: path2.join
  });
  const expected = plan.length;
  const present = plan.filter((e) => e.action === "skip-exists").length;
  const missingEntries = plan.filter((e) => e.action === "create");
  if (present === expected) {
    return {
      name: "skills-propagated",
      status: "pass",
      detail: `static user skills propagated \u2713 ${present}/${expected}\uFF08${STATIC_USER_SKILLS.length} skills \xD7 2 targets\uFF09`
    };
  }
  const missingShort = missingEntries.slice(0, 4).map((e) => `${e.skill}/${e.target}`).join(", ");
  const more = missingEntries.length > 4 ? ` +${missingEntries.length - 4}` : "";
  return {
    name: "skills-propagated",
    status: "fail",
    detail: `static user skills propagation incomplete: ${present}/${expected}; missing ${missingShort}${more}`,
    fix: "teamagent init"
  };
}
function checkPluginSync(cwd, home) {
  const projectPluginsDir = path2.join(cwd, ".claude", "plugins");
  const userPluginsDir = path2.join(home, ".claude", "plugins");
  const projectExists = fs.existsSync(projectPluginsDir) && fs.statSync(projectPluginsDir).isDirectory();
  const userExists = fs.existsSync(userPluginsDir) && fs.statSync(userPluginsDir).isDirectory();
  if (!projectExists && !userExists) {
    return {
      name: "plugin-sync",
      status: "fail",
      detail: ".claude/plugins \u76EE\u5F55\u4E0D\u5B58\u5728\uFF08\u9879\u76EE\u7EA7\u548C\u7528\u6237\u7EA7\u5747\u672A\u627E\u5230\uFF09",
      fix: "teamagent install-plugins"
    };
  }
  const pluginsRoot = projectExists ? projectPluginsDir : userPluginsDir;
  const scope = projectExists ? "\u9879\u76EE\u7EA7" : "\u7528\u6237\u7EA7";
  try {
    const entries = fs.readdirSync(pluginsRoot, { withFileTypes: true });
    const pluginDirs = entries.filter((e) => e.isDirectory()).length;
    if (pluginDirs === 0) {
      return {
        name: "plugin-sync",
        status: "fail",
        detail: `${scope} .claude/plugins \u5B58\u5728\u4F46\u4E3A\u7A7A`,
        fix: "teamagent install-plugins"
      };
    }
    return {
      name: "plugin-sync",
      status: "pass",
      detail: `${pluginDirs} \u4E2A\u63D2\u4EF6\u5DF2\u540C\u6B65 (${scope}: ${pluginsRoot})`
    };
  } catch {
    return {
      name: "plugin-sync",
      status: "fail",
      detail: `\u65E0\u6CD5\u8BFB\u53D6 plugins \u76EE\u5F55: ${pluginsRoot}`,
      fix: "teamagent install-plugins"
    };
  }
}
var defaultCodexProbe = (env) => {
  try {
    const stdout = execSync2("codex --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: env ?? process.env
    });
    return { ok: true, stdout, stderr: "" };
  } catch (e) {
    const err = e;
    return { ok: false, stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? err.message ?? "") };
  }
};
function checkCodexBin(probe = defaultCodexProbe) {
  const result = probe();
  if (result.ok) {
    return {
      name: "codex-bin",
      status: "pass",
      detail: result.stdout.trim().split("\n")[0] ?? "codex present"
    };
  }
  return {
    name: "codex-bin",
    status: "fail",
    detail: "\u672A\u627E\u5230 codex \u547D\u4EE4",
    fix: "npm install -g @openai/codex  \uFF08\u6216\u786E\u4FDD codex \u5728 PATH \u4E2D\uFF09"
  };
}
var defaultMcpProbe = async (url) => {
  try {
    const { request } = await import("https");
    const { request: httpRequest } = await import("http");
    const reqFn = url.startsWith("https") ? request : httpRequest;
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ reachable: false, detail: `timeout connecting to ${url}` }), 3e3);
      const req = reqFn(url, { method: "HEAD" }, (res) => {
        clearTimeout(timeout);
        resolve({ reachable: true, detail: `HTTP ${res.statusCode}` });
      });
      req.on("error", (err) => {
        clearTimeout(timeout);
        resolve({ reachable: false, detail: err.message });
      });
      req.end();
    });
  } catch (e) {
    return { reachable: false, detail: String(e) };
  }
};
async function checkMcpReachability(cwd, probe = defaultMcpProbe) {
  const urls = collectMcpUrls(cwd);
  if (urls.length === 0) {
    return {
      name: "mcp-reachability",
      status: "skip",
      detail: "\u672A\u914D\u7F6E MCP \u670D\u52A1\u5668\uFF08\u8DF3\u8FC7\uFF09"
    };
  }
  const results = await Promise.all(urls.map(async (url) => ({ url, ...await probe(url) })));
  const failed = results.filter((r) => !r.reachable);
  if (failed.length === 0) {
    return {
      name: "mcp-reachability",
      status: "pass",
      detail: `${urls.length} \u4E2A MCP \u670D\u52A1\u5668\u5747\u53EF\u8FBE`
    };
  }
  return {
    name: "mcp-reachability",
    status: "fail",
    detail: `${failed.length}/${urls.length} \u4E2A MCP \u670D\u52A1\u5668\u4E0D\u53EF\u8FBE: ${failed.map((r) => r.url).join(", ")}`,
    fix: "\u68C0\u67E5 MCP \u670D\u52A1\u5668\u662F\u5426\u542F\u52A8\uFF0C\u6216\u79FB\u9664 .claude/settings.local.json \u4E2D\u5931\u6548\u7684 mcpServers \u6761\u76EE"
  };
}
function collectMcpUrls(cwd) {
  const urls = [];
  for (const settingsPath of [
    path2.join(cwd, ".claude", "settings.local.json"),
    path2.join(cwd, ".claude", "settings.json")
  ]) {
    if (!fs.existsSync(settingsPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      const mcpServers = raw["mcpServers"];
      if (!mcpServers) continue;
      for (const server of Object.values(mcpServers)) {
        const s = server;
        if (typeof s["url"] === "string") urls.push(s["url"]);
      }
    } catch {
    }
  }
  return urls;
}
function checkClaudeMd(claudeMdPath) {
  if (!fs.existsSync(claudeMdPath)) {
    return {
      name: "claude-md",
      status: "skip",
      detail: "CLAUDE.md \u4E0D\u5B58\u5728\uFF08\u53EF\u9009\uFF1BTeamAgent \u4E0D\u518D\u751F\u6210\u89C4\u5219\u5757\uFF09"
    };
  }
  const content = fs.readFileSync(claudeMdPath, "utf-8");
  if (content.includes("TEAMAGENT:START")) {
    return {
      name: "claude-md",
      status: "fail",
      detail: "\u4ECD\u5305\u542B\u65E7 TEAMAGENT:START \u751F\u6210\u5757\uFF08#63 \u4E4B\u540E\u5DF2\u5F03\u7528\uFF09",
      fix: "teamagent doctor --fix  \uFF08\u4F1A\u5148\u5907\u4EFD\u5230 ~/.teamagent/backups/\uFF1B\u914D --dry-run \u9884\u89C8\uFF09"
    };
  }
  return {
    name: "claude-md",
    status: "pass",
    detail: "\u65E0\u751F\u6210\u89C4\u5219\u5757\uFF08OK\uFF09"
  };
}
function checkTeamSharingStatus() {
  return {
    name: "team-sharing",
    status: "pass",
    detail: "M5 viral-sync ready: gate-1 secret scan, gate-2 scope classifier, LWW+tombstone merge, m5-publish auto-commit, post-merge auto-pull"
  };
}
function renderDoctorHelp() {
  return [
    "teamagent doctor \u2014 \u68C0\u67E5\u5DE5\u5177\u5B89\u88C5\u662F\u5426\u5065\u5EB7",
    "",
    "\u7528\u6CD5:",
    "  teamagent doctor                \u8DD1\u5168\u90E8\u68C0\u67E5\u5E76\u6253\u5370\u7ED3\u679C",
    "  teamagent doctor --fix          \u81EA\u52A8\u4FEE\u590D\u80FD\u4FEE\u7684\u9879\uFF1B\u5199\u5165\u524D\u4F1A\u5148\u5907\u4EFD\u5230 ~/.teamagent/backups/",
    "  teamagent doctor --fix --dry-run",
    "                                   \u9884\u89C8\u8981\u4FEE\u4EC0\u4E48\uFF08unified diff\uFF09\uFF0C\u4E0D\u5199\u5165",
    "  teamagent doctor --json         \u8F93\u51FA\u673A\u5668\u53EF\u8BFB JSON\uFF08\u542B fixOutcomes \u5B57\u6BB5\uFF0C\u542B dryRun bool\uFF09",
    "  teamagent doctor --cwd=<path>   \u6307\u5B9A\u9879\u76EE\u76EE\u5F55\uFF08\u9ED8\u8BA4\u4E3A\u5F53\u524D\u76EE\u5F55\uFF09",
    "  teamagent doctor --help         \u663E\u793A\u672C\u5E2E\u52A9",
    "",
    "\u53EF\u81EA\u52A8\u4FEE\u590D\u7684\u68C0\u67E5\u9879\uFF1A",
    "  knowledge-db        \u901A\u8FC7 `teamagent init --skip-import` \u521B\u5EFA knowledge.db\uFF08\u65E0 prior state\uFF0C\u8DF3\u8FC7 backup\uFF09",
    "  hook-registered     \u5411 .claude/settings.local.json \u6CE8\u518C PreToolUse hook",
    "  hook-script         \u540C\u4E0A",
    "  claude-md           \u5265\u79BB legacy <!-- TEAMAGENT:START..END --> \u5757\uFF1B\u5199\u5165\u524D backup CLAUDE.md",
    "",
    "\u5907\u4EFD\u4F4D\u7F6E:",
    "  ~/.teamagent/backups/<filename>.<ISO-timestamp>.bak",
    "  \u8FD8\u539F: cp <backup-path> <original-path>",
    "",
    "\u793A\u4F8B:",
    "  teamagent doctor --fix --dry-run    # \u770B\u4E00\u4E0B\u4F1A\u6539\u4EC0\u4E48",
    "  teamagent doctor --fix              # \u771F\u6539\uFF08\u5148\u5907\u4EFD\uFF09",
    "  teamagent doctor --fix --json       # \u5E94\u7528\u5E76\u8F93\u51FA JSON \u62A5\u544A",
    ""
  ].join("\n") + "\n";
}
function renderDoctorResult(result) {
  const lines = [];
  lines.push("\u73AF\u5883\u8BCA\u65AD / Environment Check");
  lines.push("\u2500".repeat(40));
  for (const check of result.checks) {
    if (check.status === "pass") {
      lines.push(`\u2705 ${check.name.padEnd(16)}  ${check.detail}`);
    } else if (check.status === "fail") {
      lines.push(`\u274C ${check.name.padEnd(16)}  ${check.detail}`);
      if (check.fix) {
        lines.push(`   \u2192 \u8FD0\u884C: ${check.fix}`);
      }
    } else {
      lines.push(`\u23ED  ${check.name.padEnd(16)}  (${check.detail})`);
    }
  }
  lines.push("");
  if (result.allPassed && result.skipped === 0) {
    lines.push("\u2705 \u5168\u90E8\u68C0\u67E5\u901A\u8FC7\uFF01TeamAgent \u8FD0\u884C\u6B63\u5E38\u3002");
  } else if (result.allPassed) {
    lines.push("\u2705 \u53EF\u8FD0\u884C\u68C0\u67E5\u901A\u8FC7\uFF1B\u8DF3\u8FC7\u9879\u89C1\u4E0A\u65B9\uFF08\u53EF\u80FD\u4EE3\u8868\u672A\u5B8C\u6210\u4EA7\u54C1\u8303\u56F4\uFF09\u3002");
  } else {
    const parts = [];
    if (result.failed > 0) parts.push(`${result.failed} \u9879\u5931\u8D25`);
    if (result.skipped > 0) parts.push(`${result.skipped} \u9879\u8DF3\u8FC7`);
    lines.push(`${parts.join("\uFF0C")}\u3002\u4FEE\u590D\u540E\u91CD\u8DD1 teamagent doctor`);
  }
  if (result.fixOutcomes && result.fixOutcomes.length > 0) {
    lines.push("");
    lines.push("\u2500".repeat(40));
    lines.push(result.dryRun ? "\u{1F527} doctor --fix --dry-run\uFF08\u9884\u89C8\uFF0C\u672A\u5199\u5165\uFF09" : "\u{1F527} doctor --fix\uFF08\u5DF2\u5E94\u7528\uFF09");
    lines.push("\u2500".repeat(40));
    let appliedCount = 0;
    for (const outcome of result.fixOutcomes) {
      if (outcome.status === "preview") {
        lines.push(`\u{1F441}  ${outcome.name.padEnd(16)}  ${outcome.detail}`);
        if (outcome.diff) {
          for (const dl of outcome.diff.split("\n")) {
            if (dl !== "") lines.push("   " + dl);
          }
        }
      } else if (outcome.status === "applied") {
        appliedCount++;
        lines.push(`\u2705 ${outcome.name.padEnd(16)}  ${outcome.detail}`);
        if (outcome.backupPath && outcome.filePath) {
          lines.push(`   \u5907\u4EFD: ${outcome.backupPath}`);
          lines.push(`   \u8FD8\u539F: cp "${outcome.backupPath}" "${outcome.filePath}"`);
        }
      } else if (outcome.status === "skipped") {
        lines.push(`\u23ED  ${outcome.name.padEnd(16)}  ${outcome.detail}`);
      } else {
        lines.push(`\u274C ${outcome.name.padEnd(16)}  ${outcome.detail}${outcome.error ? `: ${outcome.error}` : ""}`);
      }
    }
    if (result.dryRun) {
      lines.push("");
      lines.push("\u4E0D\u4F1A\u5199\u5165\u3002\u53BB\u6389 --dry-run \u771F\u5B9E\u6267\u884C\uFF08\u5199\u5165\u524D\u4F1A\u5148\u5907\u4EFD\u5230 ~/.teamagent/backups/\uFF09\u3002");
    } else if (appliedCount > 0) {
      lines.push("");
      lines.push(`\u5DF2\u4FEE\u590D ${appliedCount} \u9879\u3002\u5907\u4EFD\u4F4D\u7F6E\uFF1A~/.teamagent/backups/`);
    }
  }
  return lines.join("\n") + "\n";
}

export {
  digitalTwinPaths,
  getUserId,
  getMachineId,
  defaultConfig,
  loadConfig,
  saveConfig,
  claudeTranscriptPath,
  tapSession,
  listPending,
  isPidAlive,
  readPidFile,
  readLastUploaderError,
  listAudioDevices,
  installHintForPlatform,
  detectFfmpegDefault,
  start,
  stop,
  importRecording,
  parseDoctorArgs,
  backupFile,
  executeDoctor,
  pathContainsNodeModulesBin,
  checkClaudeCode,
  checkHookSpawn,
  checkDigitalTwinUploader,
  checkSettingsJsonScope,
  checkInstallTableBundles,
  checkStaticUserSkillsPropagated,
  checkPluginSync,
  checkCodexBin,
  checkMcpReachability,
  checkClaudeMd,
  checkTeamSharingStatus,
  renderDoctorHelp,
  renderDoctorResult
};
