'use strict';

/* ---------- Grundwerte ---------- */

const APP_URL = 'https://sebastianscherb94-hub.github.io/golf-tagebuch/';
const WIND = ['Kein', 'Leicht', 'Mittel', 'Stark'];
const DIRS = { gegen: 'Gegenwind', rueck: 'Rückenwind', seite: 'Seitenwind' };
const SKY = { sonne: '☀️ Sonnig', wolken: '⛅ Bewölkt', regen: '🌧️ Regen', nebel: '🌫️ Nebel' };
const DEFAULT_CLUBS = ['Driver', 'Holz 3', 'Holz 5', 'Hybrid', 'Eisen 5', 'Eisen 6', 'Eisen 7',
  'Eisen 8', 'Eisen 9', 'Pitching Wedge', 'Sand Wedge', 'Putter'];
const FONT_SIZES = [[1, 'Normal'], [1.15, 'Groß'], [1.3, 'Sehr groß']];
const BACKUP_REMINDER_DAYS = 30;
const QUOTE_AGAIN_AFTER_MIN = 30; // so lange im Hintergrund → beim Zurückkommen neuer Spruch
const GPS_MAX_ACCURACY = 25;      // Meter – ungenauere Messungen werden nicht übernommen
const MAX_PLAYERS = 3;            // Mitspielerinnen zusätzlich zu ihr selbst

const QUOTES = [
  'Jeder Schlag ist eine neue Chance.',
  'Heute zählt nicht der Score, sondern die Freude am Spiel.',
  'Locker bleiben – der Ball merkt, wenn du verkrampfst.',
  'Der beste Schlag ist immer der nächste.',
  'Geduld ist dein bester Schläger.',
  'Du spielst nicht gegen den Platz, sondern mit ihm.',
  'Ein Lächeln verbessert jedes Handicap.',
  'Kleine Fortschritte sind auch Fortschritte.',
  'Vertrau deinem Schwung – du hast ihn oft genug geübt.',
  'Frische Luft, schöne Aussicht, gute Gesellschaft – du hast schon gewonnen.',
  'Jedes Loch ist ein kleiner Neuanfang.',
  'Nicht die Weite zählt, sondern die Richtung.',
  'Heute ist ein wunderbarer Tag für ein Birdie.',
  'Ruhe im Kopf, Rhythmus im Schwung.',
  'Auch Profis landen im Bunker – entscheidend ist, wie man wieder rauskommt.',
  'Spiel dein eigenes Spiel.',
  'Genieß jeden Schritt zwischen den Schlägen.',
  'Der Ball weiß nicht, wie alt du bist.',
  'Mut beim Putten – zu kurz ist nie drin.',
  'Ein gutes Spiel beginnt mit einem tiefen Atemzug.',
  'Wer lacht, schwingt lockerer.',
  'Heute schreibst du ein neues Kapitel in dein Golf-Tagebuch.',
  'Fehler gehören dazu – sie machen den nächsten guten Schlag noch schöner.',
  'Schau nach vorn, nicht auf die Scorekarte.',
  'Golf ist wie das Leben: immer schön im Takt bleiben.',
  'Du hast das Zeug zu deiner besten Runde.',
  'Sonne oder Regen – Golf macht immer gute Laune.',
  'Ein schlechter Schlag ist schnell vergessen, ein guter bleibt im Herzen.',
  'Atme durch, schau aufs Grün und genieß den Moment.',
  'Heute wird ein guter Tag – du bist ja auf dem Golfplatz!',
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = iso => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
const isAndroid = /Android/i.test(navigator.userAgent);
const sum = list => list.reduce((a, b) => a + b, 0);
const avg = list => (list.length ? sum(list) / list.length : null);
const fmtNum = (n, digits = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: digits });

function fmtDuration(ms) {
  if (ms == null || ms < 0) return '–';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'unter 1 Min';
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)} Std ${min % 60} Min`;
}

// Kurzform für die Tabelle: 12′ oder 1:05 h
function fmtMinutes(ms) {
  if (ms == null || ms < 0) return '–';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(min, 1)}′`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;
}

function freshState() {
  return {
    version: 2,
    courses: [],
    clubs: DEFAULT_CLUBS.map(name => ({ id: uid(), name, active: true })),
    rounds: [],
    activeRoundId: null,
    currentHole: 0,
    lastBackup: null,
    lastQuote: null,
    profile: { hcpIndex: null },
    settings: { fontScale: 1, keepAwake: false },
    knownPlayers: [],
  };
}

function mergeState(saved) {
  const base = freshState();
  return {
    ...base, ...saved,
    profile: { ...base.profile, ...saved.profile },
    settings: { ...base.settings, ...saved.settings },
    knownPlayers: saved.knownPlayers || [],
  };
}

/* ---------- Speichern auf dem iPhone (IndexedDB, notfalls localStorage) ---------- */

const store = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('golf-tagebuch', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  },
  async load() {
    try {
      const db = await this.open();
      return await new Promise((resolve, reject) => {
        const req = db.transaction('kv').objectStore('kv').get('state');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const raw = localStorage.getItem('golf-tagebuch');
      return raw ? JSON.parse(raw) : null;
    }
  },
  async save(data) {
    try {
      const db = await this.open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(data, 'state');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      localStorage.setItem('golf-tagebuch', JSON.stringify(data));
    }
  },
};

let state = freshState();
let ui = { view: 'home', params: {} };
let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.save(state), 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  return store.save(state);
}

/* ---------- Nachschlagen ---------- */

const course = id => state.courses.find(c => c.id === id);
const courseName = c => c ? (c.name.trim() || 'Platz ohne Namen') : 'Gelöschter Platz';
const club = id => state.clubs.find(c => c.id === id);
const round = id => state.rounds.find(r => r.id === id);
const activeRound = () => round(state.activeRoundId);
const isStandalone = () => window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;
const isComplete = r => r.holes.every(h => h.strokes);
const sortedRounds = () => [...state.rounds].sort((a, b) => b.date.localeCompare(a.date));

function clubName(id) {
  return club(id)?.name || 'Unbekannter Schläger';
}

function clubStats() {
  const stats = {};
  for (const r of state.rounds) {
    for (const h of r.holes) {
      if (!h || !h.club || !h.distance) continue;
      (stats[h.club] ||= []).push(h.distance);
    }
  }
  const out = {};
  for (const [id, list] of Object.entries(stats)) out[id] = { avg: Math.round(avg(list)), count: list.length };
  return out;
}

// Das letzte Mal, als sie dieses Loch gespielt hat (aus einer anderen Runde)
function lastTimeOn(courseId, holeIndex, excludeRoundId) {
  return sortedRounds()
    .filter(r => r.courseId === courseId && r.id !== excludeRoundId)
    .map(r => ({ round: r, hole: r.holes[holeIndex] }))
    .find(x => x.hole && (x.hole.strokes || x.hole.club || x.hole.distance));
}

/* ---------- Stableford ---------- */

const hasStableford = c => !!c && c.holes.every(h => h.si >= 1);

// Spielvorgabe nach WHS: HCPI × Slope/113 + (CR − Par); bei 9 Löchern halber HCPI
function playingHandicap(hcpIndex, c) {
  if (hcpIndex == null || !c) return null;
  const par = sum(c.holes.map(h => h.par));
  const slope = c.slope || 113;
  const cr = c.cr || par;
  const factor = c.holes.length <= 9 ? 0.5 : 1;
  return Math.max(0, Math.round(hcpIndex * factor * slope / 113 + (cr - par)));
}

// Vorgabeschläge an einem Loch – nach der Reihenfolge der Loch-Hcp verteilt
function strokesReceived(c, phcp, i) {
  const n = c.holes.length;
  const rank = c.holes.map((h, j) => ({ si: h.si, j }))
    .sort((a, b) => a.si - b.si || a.j - b.j)
    .findIndex(x => x.j === i) + 1;
  return Math.floor(phcp / n) + (rank <= phcp % n ? 1 : 0);
}

function stablefordPoints(r, i) {
  const c = course(r.courseId), h = r.holes[i];
  if (r.playingHcp == null || !hasStableford(c) || !h.strokes) return null;
  return Math.max(0, 2 + c.holes[i].par + strokesReceived(c, r.playingHcp, i) - h.strokes);
}

function roundTotals(r) {
  const c = course(r.courseId);
  const stableford = r.playingHcp != null && hasStableford(c);
  let strokes = 0, par = 0, putts = 0, penalties = 0, played = 0, points = 0;
  r.holes.forEach((h, i) => {
    if (!h || !h.strokes) return;
    strokes += h.strokes;
    par += c?.holes[i]?.par || 0;
    putts += h.putts || 0;
    penalties += h.penalties || 0;
    points += stableford ? stablefordPoints(r, i) : 0;
    played++;
  });
  const others = (r.players || []).map((name, k) =>
    ({ name, strokes: sum(r.holes.map(h => h.others?.[k] || 0)) }));
  return { strokes, par, putts, penalties, played, points: stableford ? points : null, others };
}

/* ---------- Zeitmessung ----------
   Ein Loch läuft vom ersten Betreten bis zum Weitergehen zum nächsten Loch.
   Zurückblättern zum Korrigieren ändert die Zeiten nicht. */

const holeDuration = h => (h?.start && h?.end ? h.end - h.start : null);
const roundDuration = r => (r.finishedAt ? r.finishedAt - Date.parse(r.date) : null);
const holeTimeNow = h => (h?.start ? (h.end || Date.now()) - h.start : null);

function parText(diff) {
  if (diff === 0) return 'genau Par';
  return diff > 0 ? `${diff} über Par` : `${-diff} unter Par`;
}

function windText(level, dir) {
  if (level == null) return '';
  let t = `Wind ${WIND[level].toLowerCase()}`;
  if (dir && level > 0) t += `, ${DIRS[dir]}`;
  return t;
}

function needsBackup() {
  if (!state.rounds.length) return false;
  if (!state.lastBackup) return true;
  return (Date.now() - new Date(state.lastBackup)) / 86400000 > BACKUP_REMINDER_DAYS;
}

/* ---------- GPS ---------- */

// Mehrere Sekunden lauschen und die genaueste Position nehmen
function getFix(maxWait = 6000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 2 });
    let best = null, watchId = null, timer = null;
    const finish = err => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best); else reject(err || { code: 3 });
    };
    watchId = navigator.geolocation.watchPosition(p => {
      const fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
      if (!best || fix.acc < best.acc) best = fix;
      if (fix.acc <= 10) finish();
    }, err => { if (err.code === 1 || !best) finish(err); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait });
    timer = setTimeout(() => finish(), maxWait);
  });
}

function distanceM(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function gpsError(err) {
  if (err?.code === 1) return 'Standort ist nicht erlaubt. iPhone-Einstellungen → Datenschutz → Ortungsdienste → Safari-Websites → „Beim Verwenden der App“.';
  return 'Kein GPS-Signal. Bitte einfach selbst eintragen.';
}

// Nur für die Anzeige, wird nicht gespeichert
const gps = { busy: null, msg: {}, toGreen: null };

/* ---------- Bausteine ---------- */

function choiceButtons(values, current, action, extra = '', cls = 'choice') {
  return values.map(([v, label]) =>
    `<button class="${cls}" data-a="${action}" data-v="${esc(v)}" ${extra}
       aria-pressed="${String(current) === String(v)}">${label}</button>`).join('');
}

function windPicker(level, dir, levelAction, dirAction) {
  return `
    <div class="choices c4">${choiceButtons(WIND.map((w, i) => [i, w]), level, levelAction)}</div>
    ${level > 0 ? `<div class="choices c3">${choiceButtons(Object.entries(DIRS).map(([k, v]) => [k, v.replace('wind', '-<br>wind')]), dir, dirAction)}</div>` : ''}`;
}

function stepper(value, action, extra, label) {
  return `<div class="stepper compact">
    <button data-a="${action}" data-v="-1" ${extra} aria-label="${label} weniger">−</button>
    <span class="value"><strong class="stepval">${value ?? '–'}</strong></span>
    <button data-a="${action}" data-v="1" ${extra} aria-label="${label} mehr">+</button>
  </div>`;
}

function gpsMsg(key) {
  const m = gps.msg[key];
  return m ? `<div class="status ${m.ok ? '' : 'fail'}">${m.text}</div>` : '';
}

function installHint() {
  if (isStandalone()) return '';
  return isAndroid
    ? `<div class="card hint">
        <h3>Als App auf den Startbildschirm legen</h3>
        <p class="small">In Chrome oben rechts auf <strong>⋮</strong> tippen, dann
        <strong>„Zum Startbildschirm hinzufügen“</strong> wählen. So bleiben deine Daten sicher gespeichert.</p>
      </div>`
    : `<div class="card hint">
        <h3>Als App auf den Home-Bildschirm legen</h3>
        <p class="small">In Safari unten auf <strong>Teilen</strong> (□ mit Pfeil) tippen, dann
        <strong>„Zum Home-Bildschirm“</strong> wählen. So bleiben deine Daten sicher gespeichert.</p>
      </div>`;
}

function backBtn(view, label) {
  return `<div class="topbar"><button class="btn" data-a="tab" data-view="${view}">‹ ${label}</button></div>`;
}

/* ---------- Ansichten ---------- */

const views = {
  home() {
    const r = activeRound();
    const recent = sortedRounds().filter(x => x.id !== state.activeRoundId).slice(0, 5);

    let html = `<h1>Golf-Tagebuch</h1>` + installHint();
    if (needsBackup()) {
      html += `<div class="card hint">
        <h3>Zeit für eine Sicherung</h3>
        <p class="small">Damit keine Runde verloren geht, falls etwas mit dem Handy passiert.</p>
        <button class="btn" data-a="tab" data-view="backup">💾 Jetzt sichern</button>
      </div>`;
    }

    if (r) {
      const c = course(r.courseId);
      html += `<div class="card last">
        <h3>Laufende Runde</h3>
        <p>${esc(courseName(c))} · Loch ${state.currentHole + 1} von ${r.holes.length}</p>
        <p class="small muted">⏱ Läuft seit ${fmtDuration(Date.now() - Date.parse(r.date))}</p>
        <button class="btn primary big" data-a="resume">Weiterspielen ▶</button>
        <button class="btn link danger" data-a="discardRound">Runde verwerfen</button>
      </div>`;
    } else {
      html += `<button class="btn primary big" data-a="newRound">⛳ Neue Runde starten</button>`;
    }

    if (recent.length) {
      html += `<h2>Letzte Runden</h2><ul class="list">` + recent.map(x => {
        const t = roundTotals(x);
        return `<li><button class="item" data-a="go" data-view="summary" data-id="${x.id}">
          <span><span class="title">${esc(courseName(course(x.courseId)))}</span>
          <span class="sub">${fmtDate(x.date)}${roundDuration(x) ? ` · ⏱ ${fmtDuration(roundDuration(x))}` : ''}</span></span>
          <span class="score">${t.strokes || '–'}${t.points != null ? `<small>${t.points} Pkt</small>` : ''}</span></button></li>`;
      }).join('') + `</ul>`;
    } else if (!r) {
      html += `<p class="muted center">Hier erscheinen deine Runden, sobald du gespielt hast.</p>`;
    }
    return html;
  },

  /* --- Runde starten: Platz wählen --- */
  roundCourse() {
    let html = backBtn('home', 'Zurück') + `<h1>Wo spielst du heute?</h1>`;
    if (!state.courses.length) {
      return html + `<div class="card"><p>Du hast noch keinen Golfplatz angelegt. Das dauert nur eine Minute.</p>
        <button class="btn primary" data-a="newCourse" data-then="round">Platz anlegen</button></div>`;
    }
    html += `<ul class="list">` + state.courses.map(c =>
      `<li><button class="item" data-a="pickCourse" data-id="${c.id}">
        <span><span class="title">${esc(courseName(c))}</span><span class="sub">${c.holes.length} Löcher</span></span>
        <span class="arrow">›</span></button></li>`).join('') + `</ul>
      <button class="btn" data-a="newCourse" data-then="round">+ Anderen Platz anlegen</button>`;
    return html;
  },

  /* --- Runde starten: Wetter, Mitspielerinnen, Vorgabe --- */
  roundSetup() {
    const p = ui.params, d = p.draft, c = course(p.courseId);
    let status = '';
    if (p.wx === 'loading') status = `<div class="status">Wetter wird abgerufen …</div>`;
    else if (p.wx === 'ok') status = `<div class="status">Automatisch ermittelt: ${d.temp} °C, Wind ${d.windKmh} km/h. Du kannst es unten ändern.</div>`;
    else if (p.wx === 'fail') status = `<div class="status fail">Wetter konnte nicht abgerufen werden (kein Internet oder Standort nicht erlaubt). Bitte einfach antippen.</div>`;

    const suggestions = state.knownPlayers.filter(n => !d.players.includes(n)).slice(0, 8);
    let hcp = '';
    if (hasStableford(c) && state.profile.hcpIndex != null) {
      hcp = `<div class="section"><span class="label">Deine Spielvorgabe heute</span>
        <p class="small muted">Für die Stableford-Punkte. Ausgerechnet aus deinem Handicap ${fmtNum(state.profile.hcpIndex)} –
        vergleiche mit der Vorgabentabelle am ersten Abschlag.</p>
        ${stepper(d.playingHcp, 'draftHcp', '', 'Vorgabe')}</div>`;
    } else if (state.profile.hcpIndex == null) {
      hcp = `<p class="small muted">💡 Für Stableford-Punkte: unter <strong>Mehr</strong> dein Handicap eintragen.</p>`;
    } else {
      hcp = `<p class="small muted">💡 Für Stableford-Punkte: beim Platz die Hcp-Zahl jedes Lochs eintragen.</p>`;
    }

    return `<div class="topbar"><button class="btn" data-a="newRound">‹ Zurück</button></div>
      <h1>Runde vorbereiten</h1>
      <p class="muted">${esc(courseName(c))}</p>
      ${status}
      <div class="section"><span class="label">Himmel</span>
        <div class="choices c2">${choiceButtons(Object.entries(SKY), d.sky, 'draftSky')}</div></div>
      <div class="section"><span class="label">Wind</span>
        <div class="choices c4">${choiceButtons(WIND.map((w, i) => [i, w]), d.windLevel, 'draftWind')}</div></div>
      <div class="section"><span class="label">Wer spielt mit? <span class="muted small">(freiwillig)</span></span>
        ${d.players.map((n, k) => `<div class="player-row"><span>👤 ${esc(n)}</span>
          <button class="btn link danger" data-a="removePlayer" data-v="${k}" aria-label="${esc(n)} entfernen">Entfernen</button></div>`).join('')}
        ${d.players.length < MAX_PLAYERS ? `
          ${suggestions.length ? `<div class="chips">${suggestions.map(n =>
            `<button class="chip" data-a="addPlayer" data-v="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>` : ''}
          <button class="btn" data-a="addPlayer">+ Mitspielerin hinzufügen</button>` : ''}
      </div>
      ${hcp}
      <button class="btn primary big" data-a="startRound">Los geht's – Loch 1 ▶</button>`;
  },

  /* --- Das Herzstück: ein Loch --- */
  hole() {
    const r = activeRound();
    if (!r) { ui = { view: 'home', params: {} }; return views.home(); }
    const c = course(r.courseId);
    const i = state.currentHole;
    const h = r.holes[i];
    const ch = c.holes[i] || { par: 4, length: null, note: '' };
    const stats = clubStats();
    const last = lastTimeOn(c.id, i, r.id);
    const isLast = i === r.holes.length - 1;
    const stableford = r.playingHcp != null && hasStableford(c);
    const extra = stableford ? strokesReceived(c, r.playingHcp, i) : 0;
    const pts = stablefordPoints(r, i);

    let html = `<div class="topbar">
        <button class="btn" data-a="pause">‹ Startseite</button>
        <span class="muted small">${esc(courseName(c))}</span>
      </div>
      <div class="holehead">
        <h1>Loch ${i + 1}</h1>
        <span class="meta">Par ${ch.par}${ch.length ? ` · ${ch.length} m` : ''}</span>
      </div>
      ${stableford ? `<p class="timer">Hcp ${ch.si} · ${extra === 0 ? 'kein Vorgabeschlag' : `${extra} ${extra === 1 ? 'Vorgabeschlag' : 'Vorgabeschläge'} ${'●'.repeat(Math.min(extra, 4))}`}</p>` : ''}
      <p class="timer">⏱ <strong id="tHole">${fmtDuration(holeTimeNow(h))}</strong> an diesem Loch ·
        <strong id="tRound">${fmtDuration(Date.now() - Date.parse(r.date))}</strong> gesamt</p>
      <div class="dots" id="dots">${r.holes.map((x, j) =>
        `<button data-a="holeGo" data-v="${j}" class="${j === i ? 'current' : x.strokes ? 'done' : ''}"
          aria-label="Loch ${j + 1}">${j + 1}</button>`).join('')}</div>`;

    // Entfernung zum Grün
    if (ch.green) {
      const g = gps.toGreen?.hole === i && gps.toGreen.courseId === c.id ? gps.toGreen : null;
      html += `<div class="card green">
        ${g ? `<p class="green-dist">🚩 Noch <strong>${g.m} m</strong> zum Grün</p>
               <p class="small muted">Genauigkeit ±${g.acc} m · bis zur Grünmitte</p>`
            : `<p class="green-dist">🚩 Entfernung zum Grün</p>`}
        <button class="btn" data-a="gpsToGreen" ${gps.busy ? 'disabled' : ''}>${gps.busy === 'toGreen' ? 'Messe …' : g ? '📍 Neu messen' : '📍 Jetzt messen'}</button>
        ${gpsMsg('toGreen')}
      </div>`;
    }

    // Letztes Mal
    if (last) {
      const lh = last.hole;
      const bits = [];
      if (lh.club) bits.push(`<strong>${esc(clubName(lh.club))}</strong>${lh.distance ? `, ${lh.distance} m weit` : ''}`);
      if (lh.strokes) bits.push(`${lh.strokes} Schläge${lh.putts != null ? `, davon ${lh.putts} Putts` : ''}`);
      const w = windText(lh.windLevel, lh.windDir);
      if (w) bits.push(w);
      html += `<div class="card last"><h3>Letztes Mal hier · ${fmtShort(last.round.date)}</h3>
        ${bits.map(b => `<p>${b}</p>`).join('')}</div>`;
    } else {
      html += `<div class="card last"><h3>Letztes Mal hier</h3>
        <p>Dieses Loch spielst du heute zum ersten Mal mit dem Tagebuch.</p></div>`;
    }

    // Vorschlag bei Par 3 anhand der Länge
    if (ch.par === 3 && ch.length) {
      const best = state.clubs.filter(k => k.active && stats[k.id])
        .sort((a, b) => Math.abs(stats[a.id].avg - ch.length) - Math.abs(stats[b.id].avg - ch.length))[0];
      if (best) html += `<p class="small muted">💡 Für ${ch.length} m passt bei dir meist <strong>${esc(best.name)}</strong> (Ø ${stats[best.id].avg} m).</p>`;
    }

    // Abschlag
    const teeClubs = state.clubs.filter(k => k.active && k.name !== 'Putter');
    html += `<div class="section"><span class="label">Abschlag mit …</span>
        <div class="choices c3">${teeClubs.map(k =>
          `<button class="choice" data-a="setClub" data-v="${k.id}" aria-pressed="${h.club === k.id}">${esc(k.name)}</button>`).join('')}</div>
      </div>
      <div class="section"><span class="label">Wie weit? (Meter)</span>
        <div class="stepper">
          <button data-a="dist" data-v="-5" aria-label="5 Meter weniger">−</button>
          <span class="value"><input type="number" inputmode="numeric" min="0" max="400" data-in="distance"
            value="${h.distance ?? ''}" placeholder="–" aria-label="Weite in Metern"> m</span>
          <button data-a="dist" data-v="5" aria-label="5 Meter mehr">+</button>
        </div>
        <details class="gps" ${h.teePos || gps.msg.dist || gps.busy === 'tee' ? 'open' : ''}>
          <summary>📍 Mit GPS messen (freiwillig)</summary>
          <p class="small muted">Am Abschlag „Hier stehe ich“ tippen, zum Ball gehen, dann „Ball liegt hier“.</p>
          <div class="row">
            <button class="btn" data-a="gpsTee" ${gps.busy ? 'disabled' : ''}>${gps.busy === 'tee' ? 'Messe …' : h.teePos ? '✓ Abschlag' : 'Hier stehe ich'}</button>
            <button class="btn" data-a="gpsBall" ${gps.busy || !h.teePos ? 'disabled' : ''}>${gps.busy === 'ball' ? 'Messe …' : 'Ball liegt hier'}</button>
          </div>
          ${gpsMsg('dist')}
        </details>
      </div>`;

    // Ergebnis
    html += `<div class="section"><span class="label">Schläge insgesamt
          ${pts != null ? `<span class="pts">= ${pts} ${pts === 1 ? 'Punkt' : 'Punkte'}</span>` : ''}</span>
        <div class="choices c6">${choiceButtons(Array.from({ length: 12 }, (_, n) => [n + 1, n + 1]), h.strokes, 'setStrokes', '', 'choice num')}</div>
      </div>
      <div class="section"><span class="label">Davon Putts</span>
        <div class="choices c6">${choiceButtons(Array.from({ length: 6 }, (_, n) => [n, n]), h.putts, 'setPutts', '', 'choice num')}</div>
      </div>
      <div class="section inline-row">
        <span class="label">Davon Strafschläge<span class="small muted" style="display:block;font-weight:400">z. B. verlorener Ball, Wasser</span></span>
        ${stepper(h.penalties || 0, 'setPenalties', '', 'Strafschläge')}
      </div>`;

    // Mitspielerinnen
    if (r.players?.length) {
      html += `<div class="section"><span class="label">Schläge der Mitspielerinnen</span>
        ${r.players.map((n, k) => `<div class="inline-row player">
          <span class="pname">${esc(n)}</span>${stepper(h.others?.[k], 'setOther', `data-k="${k}"`, `Schläge ${esc(n)}`)}
        </div>`).join('')}</div>`;
    }

    html += `<div class="section"><span class="label">Wind an diesem Loch</span>
        ${windPicker(h.windLevel, h.windDir, 'holeWind', 'holeDir')}
      </div>
      <div class="section">
        <label class="field">📝 Mein Tipp für dieses Loch
          <span class="small muted" style="display:block;font-weight:400">Bleibt gespeichert und erscheint jedes Mal hier. Tipp: Mit dem 🎤 auf der Tastatur kannst du diktieren.</span>
          <textarea data-in="holeNote" placeholder="z. B. Bunker rechts – lieber links anspielen">${esc(ch.note)}</textarea>
        </label>
      </div>
      <details class="gps" ${gps.msg.green || gps.busy === 'green' ? 'open' : ''}>
        <summary>🚩 Grün-Position ${ch.green ? 'neu ' : ''}merken</summary>
        <p class="small muted">Stell dich in die Mitte des Grüns und tippe auf den Knopf. Ab dann zeigt dir die App an diesem Loch, wie weit es noch bis zum Grün ist.</p>
        <button class="btn" data-a="gpsGreen" ${gps.busy ? 'disabled' : ''}>${gps.busy === 'green' ? 'Messe …' : '📍 Ich stehe auf dem Grün'}</button>
        ${gpsMsg('green')}
      </details>`;

    html += isLast
      ? `<button class="btn primary big" data-a="finishRound">Runde beenden ✓</button>`
      : `<button class="btn primary big" data-a="holeGo" data-v="${i + 1}">Weiter zu Loch ${i + 2} ▶</button>`;
    if (i > 0) html += `<button class="btn" data-a="holeGo" data-v="${i - 1}">◀ Zurück zu Loch ${i}</button>`;
    return html;
  },

  /* --- Ergebnis einer Runde --- */
  summary() {
    const r = round(ui.params.id);
    if (!r) { ui = { view: 'home', params: {} }; return views.home(); }
    const c = course(r.courseId);
    const t = roundTotals(r);
    const w = r.weather || {};
    const dur = roundDuration(r);
    const stableford = t.points != null;

    const rows = r.holes.map((h, i) => {
      const details = [h.club && clubName(h.club), h.distance && `${h.distance} m`,
        h.penalties && `${h.penalties} Strafschl.`].filter(Boolean);
      const pts = stablefordPoints(r, i);
      return `<tr class="${details.length ? 'has-details' : ''}">
          <td>${i + 1}</td><td>${c?.holes[i]?.par ?? '–'}</td>
          <td><strong>${h.strokes || '–'}</strong></td>
          ${stableford ? `<td>${pts ?? '–'}</td>` : ''}
          <td>${h.putts ?? '–'}</td>
          <td>${fmtMinutes(holeDuration(h))}</td>
        </tr>${details.length ? `<tr class="details"><td></td><td colspan="${stableford ? 5 : 4}">${esc(details.join(' · '))}</td></tr>` : ''}`;
    }).join('');

    let players = '';
    if (t.others.length) {
      const all = [{ name: 'Du', strokes: t.strokes, me: true }, ...t.others].sort((a, b) => (a.strokes || 999) - (b.strokes || 999));
      players = `<div class="card"><h3>Mitspielerinnen</h3><ul class="plain">${all.map(p =>
        `<li class="${p.me ? 'me' : ''}"><span>${esc(p.name)}</span><strong>${p.strokes || '–'}</strong></li>`).join('')}</ul></div>`;
    }

    return backBtn('home', 'Start') + `
      <h1>${esc(courseName(c))}</h1>
      <p class="muted">${fmtDate(r.date)}${w.sky ? ` · ${SKY[w.sky]}` : ''}${w.temp != null ? ` · ${w.temp} °C` : ''}${w.windLevel != null ? ` · ${windText(w.windLevel)}` : ''}</p>
      <div class="card center">
        <div class="total">${t.strokes || '–'}</div>
        <p class="muted" style="margin-top:8px">Schläge auf ${t.played} ${t.played === 1 ? 'Loch' : 'Löchern'}</p>
        ${t.played ? `<p><strong>${parText(t.strokes - t.par)}</strong> · ${t.putts} Putts${t.penalties ? ` · ${t.penalties} ${t.penalties === 1 ? 'Strafschlag' : 'Strafschläge'}` : ''}</p>` : ''}
        ${stableford ? `<p class="points"><strong>${t.points}</strong> Stableford-Punkte <span class="muted small">(Vorgabe ${r.playingHcp})</span></p>` : ''}
        ${dur ? `<p>⏱ Gespielt in <strong>${fmtDuration(dur)}</strong></p>` : ''}
      </div>
      ${allAwards(r).length ? `<div class="card last"><h3>🏆 Deine Erfolge</h3>${allAwards(r).map(a => `<p>${esc(a)}</p>`).join('')}</div>` : ''}
      ${players}
      <button class="btn primary" data-a="shareRound" data-id="${r.id}">📤 Ergebnis teilen</button>
      <div class="card"><table class="score">
        <thead><tr><th>Loch</th><th>Par</th><th>Schläge</th>${stableford ? '<th>Pkt</th>' : ''}<th>Putts</th><th>Zeit</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <label class="field">📝 Notiz zur Runde
        <textarea data-in="roundNote" data-id="${r.id}" placeholder="z. B. mit wem gespielt, Tagesform, was gut lief …">${esc(r.note)}</textarea>
      </label>
      <button class="btn link danger" data-a="deleteRound" data-id="${r.id}">Diese Runde löschen</button>`;
  },

  /* --- Plätze --- */
  courses() {
    let html = `<h1>Meine Golfplätze</h1>`;
    if (!state.courses.length) html += `<p class="muted">Lege hier die Plätze an, auf denen du spielst.</p>`;
    html += `<ul class="list">` + state.courses.map(c => {
      const rs = state.rounds.filter(r => r.courseId === c.id && isComplete(r));
      const best = rs.length ? Math.min(...rs.map(r => roundTotals(r).strokes)) : null;
      return `<li><button class="item" data-a="editCourse" data-id="${c.id}">
        <span><span class="title">${esc(courseName(c))}</span>
        <span class="sub">${c.holes.length} Löcher · ${state.rounds.filter(r => r.courseId === c.id).length} Runden${best ? ` · Bestes: ${best}` : ''}</span></span>
        <span class="arrow">›</span></button></li>`;
    }).join('') + `</ul>
      <button class="btn primary" data-a="newCourse">+ Neuen Platz anlegen</button>`;
    return html;
  },

  courseEdit() {
    const c = course(ui.params.id);
    if (!c) { ui = { view: 'courses', params: {} }; return views.courses(); }
    const back = ui.params.then === 'round'
      ? `<button class="btn primary big" data-a="pickCourse" data-id="${c.id}">Fertig – Runde starten ▶</button>`
      : `<button class="btn primary big" data-a="tab" data-view="courses">Fertig ✓</button>`;

    return backBtn('courses', 'Plätze') + `
      <h1>Platz bearbeiten</h1>
      <p class="small muted">Alles wird sofort gespeichert.</p>
      <label class="field">Name des Platzes
        <input type="text" data-in="courseName" value="${esc(c.name)}" placeholder="z. B. GC Sonnenhof" autocomplete="off">
      </label>
      <div class="section"><span class="label">Wie viele Löcher?</span>
        <div class="choices c2">${choiceButtons([[9, '9 Löcher'], [18, '18 Löcher']], c.holes.length, 'setHoleCount')}</div>
      </div>
      <div class="card">
        <h3>Für Stableford <span class="muted small">(freiwillig)</span></h3>
        <p class="small muted">Course Rating (CR) und Slope stehen auf der Scorekarte oder am ersten Abschlag – für deine Abschlagfarbe.
        Ohne diese Werte rechnet die App mit deinem Handicap direkt.</p>
        <div class="row">
          <label class="field">CR<input type="text" inputmode="decimal" data-in="courseCr" value="${c.cr != null ? fmtNum(c.cr) : ''}" placeholder="z. B. 71,2"></label>
          <label class="field">Slope<input type="number" inputmode="numeric" data-in="courseSlope" value="${c.slope ?? ''}" placeholder="z. B. 128"></label>
        </div>
      </div>
      <h2>Die Löcher</h2>
      <p class="small muted">Länge (in Metern) und Hcp stehen auf der Scorekarte. „Hcp“ ist die Schwierigkeit des Lochs (1 = schwerstes) – nur für Stableford nötig.</p>
      ${c.holes.map((h, i) => `<div class="card">
        <h3>Loch ${i + 1}${h.green ? ' <span class="small muted">· 🚩 Grün gemerkt</span>' : ''}</h3>
        <div class="choices c3">${choiceButtons([[3, 'Par 3'], [4, 'Par 4'], [5, 'Par 5']], h.par, 'setPar', `data-i="${i}"`)}</div>
        <div class="row" style="margin-top:8px">
          <label class="field">Länge (m)
            <input type="number" inputmode="numeric" data-in="holeLength" data-i="${i}" value="${h.length ?? ''}" placeholder="z. B. 320">
          </label>
          <label class="field">Hcp
            <input type="number" inputmode="numeric" min="1" max="18" data-in="holeSi" data-i="${i}" value="${h.si ?? ''}" placeholder="1–18">
          </label>
        </div>
      </div>`).join('')}
      ${back}
      <button class="btn link danger" data-a="deleteCourse" data-id="${c.id}">Platz löschen</button>`;
  },

  /* --- Statistik --- */
  stats() {
    let html = `<h1>Meine Statistik</h1>`;
    const done = state.rounds.filter(r => r.id !== state.activeRoundId);
    if (!done.length) return html + `<p class="muted">Sobald du Runden gespielt hast, siehst du hier, wie du dich entwickelst.</p>`;

    const holes = done.flatMap(r => r.holes.filter(h => h.strokes));
    const puttHoles = holes.filter(h => h.putts != null);
    const durations = done.map(roundDuration).filter(Boolean);
    html += `<div class="tiles">
      <div class="tile"><span class="tile-num">${done.length}</span><span class="tile-label">Runden</span></div>
      <div class="tile"><span class="tile-num">${holes.length}</span><span class="tile-label">Löcher gespielt</span></div>
      ${puttHoles.length ? `<div class="tile"><span class="tile-num">${fmtNum(avg(puttHoles.map(h => h.putts)))}</span><span class="tile-label">Putts pro Loch</span></div>` : ''}
      ${durations.length ? `<div class="tile"><span class="tile-num">${sum(durations) >= 3600000 ? `${Math.round(sum(durations) / 3600000)} Std` : fmtDuration(sum(durations))}</span><span class="tile-label">auf dem Platz</span></div>` : ''}
      <div class="tile"><span class="tile-num">${fmtNum(avg(done.map(r => roundTotals(r).penalties)))}</span><span class="tile-label">Strafschläge pro Runde</span></div>
    </div>`;

    for (const c of state.courses) {
      const rs = done.filter(r => r.courseId === c.id).sort((a, b) => a.date.localeCompare(b.date));
      if (!rs.length) continue;
      const complete = rs.filter(isComplete);
      const totals = complete.map(r => ({ r, t: roundTotals(r) }));
      const best = totals.length ? Math.min(...totals.map(x => x.t.strokes)) : null;
      const withPts = totals.filter(x => x.t.points != null);

      html += `<h2>${esc(courseName(c))}</h2><div class="card">
        <p>${rs.length} ${rs.length === 1 ? 'Runde' : 'Runden'}${best ? ` · Bestes Ergebnis <strong>${best}</strong> · Ø ${fmtNum(avg(totals.map(x => x.t.strokes)))}` : ''}</p>
        ${withPts.length ? `<p>Stableford: bestes <strong>${Math.max(...withPts.map(x => x.t.points))}</strong> · Ø ${fmtNum(avg(withPts.map(x => x.t.points)))} Punkte</p>` : ''}`;

      // Entwicklung: die letzten 10 vollständigen Runden als waagrechte Balken
      const recent = totals.slice(-10);
      if (recent.length >= 2) {
        const max = Math.max(...recent.map(x => x.t.strokes));
        html += `<h3 style="margin-top:14px">Schläge pro Runde</h3>
          <p class="small muted">Kürzerer Balken = weniger Schläge = besser</p>
          <ul class="bars" aria-label="Schläge der letzten Runden">${recent.map(x => `
            <li><span class="bar-date">${fmtShort(x.r.date)}</span>
              <span class="bar-track"><span class="bar" style="width:${Math.max(8, x.t.strokes / max * 100)}%"></span></span>
              <span class="bar-val">${x.t.strokes}${x.t.strokes === best ? ' 🏆' : ''}</span></li>`).join('')}</ul>`;
      }

      // Bestes Loch und Angstloch (Ø über Par)
      const perHole = c.holes.map((ch, i) => {
        const s = rs.map(r => r.holes[i]?.strokes).filter(Boolean);
        return s.length ? { i, diff: avg(s) - ch.par, n: s.length } : null;
      }).filter(Boolean);
      if (perHole.length >= 2) {
        const sorted = [...perHole].sort((a, b) => a.diff - b.diff);
        const fmtDiff = d => (d <= 0 ? `Ø ${fmtNum(-d)} unter Par` : `Ø ${fmtNum(d)} über Par`).replace('Ø 0 unter Par', 'Ø genau Par');
        html += `<div class="row" style="margin-top:14px">
          <div class="mini"><span class="mini-label">😊 Dein bestes Loch</span><strong>Loch ${sorted[0].i + 1}</strong><span class="small muted">${fmtDiff(sorted[0].diff)}</span></div>
          <div class="mini"><span class="mini-label">😬 Dein Angstloch</span><strong>Loch ${sorted.at(-1).i + 1}</strong><span class="small muted">${fmtDiff(sorted.at(-1).diff)}</span></div>
        </div>`;
      }
      html += `</div>`;
    }

    const cs = clubStats();
    const measured = state.clubs.filter(k => cs[k.id]).sort((a, b) => cs[b.id].avg - cs[a.id].avg);
    if (measured.length) {
      html += `<h2>Deine Weiten</h2><div class="card"><ul class="plain">${measured.map(k =>
        `<li><span>${esc(k.name)}</span><strong>Ø ${cs[k.id].avg} m</strong></li>`).join('')}</ul></div>`;
    }
    return html;
  },

  /* --- Mehr --- */
  more() {
    const s = state.settings;
    return `<h1>Mehr</h1>
      <div class="card">
        <label class="field" style="margin:0">Mein Handicap (HCPI)
          <span class="small muted" style="display:block;font-weight:400">Für die Stableford-Punkte, z. B. 28,4</span>
          <input type="text" inputmode="decimal" data-in="hcpIndex" value="${state.profile.hcpIndex != null ? fmtNum(state.profile.hcpIndex) : ''}" placeholder="z. B. 28,4">
        </label>
      </div>
      <button class="btn primary" data-a="shareApp">💌 App an Freundin schicken</button>
      <ul class="list">
        <li><button class="item" data-a="tab" data-view="clubs"><span><span class="title">🏌️ Meine Schläger</span><span class="sub">Bag und Durchschnittsweiten</span></span><span class="arrow">›</span></button></li>
        <li><button class="item" data-a="tab" data-view="backup"><span><span class="title">💾 Daten sichern</span><span class="sub">${state.lastBackup ? `Zuletzt am ${fmtDate(state.lastBackup)}` : 'Noch keine Sicherung'}</span></span><span class="arrow">›</span></button></li>
      </ul>
      <h2>Anzeige</h2>
      <div class="section"><span class="label">Schriftgröße</span>
        <div class="choices c3">${choiceButtons(FONT_SIZES, s.fontScale, 'setFont')}</div>
      </div>
      ${'wakeLock' in navigator ? `<label class="card toggle">
        <span><strong>Bildschirm bleibt an</strong><br><span class="small muted">Während der Runde geht das Display nicht aus. Braucht etwas mehr Akku.</span></span>
        <input type="checkbox" data-a="toggleAwake" ${s.keepAwake ? 'checked' : ''}>
      </label>` : ''}
      <p class="small muted center">Golf-Tagebuch · Deine Daten bleiben nur auf diesem Handy.</p>`;
  },

  /* --- Schläger --- */
  clubs() {
    const stats = clubStats();
    return backBtn('more', 'Mehr') + `<h1>Meine Schläger</h1>
      <p class="small muted">Die durchschnittliche Weite rechnet die App aus deinen Runden selbst aus.
      Nimm den Haken raus bei Schlägern, die nicht in deinem Bag sind.</p>
      <ul class="list">${state.clubs.map(k => `<li class="card toggle">
        <span><span class="title" style="font-weight:700">${esc(k.name)}</span><br>
        <span class="small muted">${stats[k.id] ? `Ø ${stats[k.id].avg} m · ${stats[k.id].count}× gemessen` : 'Noch keine Weite'}</span></span>
        <span class="row" style="flex:none;align-items:center">
          <button class="btn link" style="width:auto;margin:0" data-a="renameClub" data-id="${k.id}">Ändern</button>
          <input type="checkbox" data-a="toggleClub" data-id="${k.id}" ${k.active ? 'checked' : ''} aria-label="${esc(k.name)} im Bag">
        </span></li>`).join('')}</ul>
      <button class="btn primary" data-a="addClub">+ Schläger hinzufügen</button>`;
  },

  /* --- Sichern --- */
  backup() {
    return backBtn('more', 'Mehr') + `<h1>Daten sichern</h1>
      <div class="card">
        <p>Alle deine Plätze, Schläger und Runden sind auf diesem Handy gespeichert.</p>
        <p>Mit einer Sicherung legst du eine Kopie in <strong>iCloud Drive</strong> oder <strong>„Dateien“</strong> ab –
        zum Beispiel für ein neues Handy.</p>
        <p class="small muted">${state.lastBackup ? `Letzte Sicherung: ${fmtDate(state.lastBackup)}` : 'Noch keine Sicherung gemacht.'}</p>
        <button class="btn primary big" data-a="doBackup">💾 Jetzt sichern</button>
      </div>
      <div class="card">
        <h3>Sicherung zurückholen</h3>
        <p class="small">Ersetzt alle Daten auf diesem Handy durch die gewählte Sicherung.</p>
        <button class="btn" data-a="restore">Sicherung wiederherstellen</button>
      </div>
      <p class="small muted center">${state.courses.length} Plätze · ${state.rounds.length} Runden</p>`;
  },
};

/* ---------- Anzeigen ---------- */

const app = document.getElementById('app');
const NAV_VIEWS = { home: 'home', summary: 'home', courses: 'courses', courseEdit: 'courses',
  stats: 'stats', more: 'more', clubs: 'more', backup: 'more' };

function render() {
  document.documentElement.style.setProperty('--fs', state.settings.fontScale);
  app.innerHTML = views[ui.view]();
  const tab = NAV_VIEWS[ui.view];
  document.body.classList.toggle('no-nav', !tab);
  document.querySelectorAll('#nav button').forEach(b => {
    if (b.dataset.view === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const dot = document.querySelector('#dots .current');
  if (dot) dot.scrollIntoView({ inline: 'center', block: 'nearest' });
  updateWakeLock();
}

function go(view, params = {}) {
  ui = { view, params };
  render();
  window.scrollTo(0, 0);
}

function toast(lines) {
  if (!lines.length) return;
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join('');
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/* ---------- Bildschirm anlassen (optional) ---------- */

let wakeLock = null;
async function updateWakeLock() {
  const want = state.settings.keepAwake && ui.view === 'hole' && !document.hidden;
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}

/* ---------- Wetter (Open-Meteo, kostenlos, ohne Anmeldung) ---------- */

function windLevelFromKmh(k) {
  if (k < 6) return 0;
  if (k < 20) return 1;
  if (k < 35) return 2;
  return 3;
}
function skyFromCode(code) {
  if (code <= 1) return 'sonne';
  if (code <= 3) return 'wolken';
  if (code === 45 || code === 48) return 'nebel';
  return 'regen';
}

async function fetchWeather(params) {
  params.wx = 'loading';
  render();
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 600000 }));
    const lat = pos.coords.latitude.toFixed(2), lon = pos.coords.longitude.toFixed(2);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`);
    if (!res.ok) throw new Error(res.status);
    const cur = (await res.json()).current;
    const d = params.draft;
    d.temp = Math.round(cur.temperature_2m);
    d.windKmh = Math.round(cur.wind_speed_10m);
    if (d.windLevel == null) d.windLevel = windLevelFromKmh(cur.wind_speed_10m);
    if (d.sky == null) d.sky = skyFromCode(cur.weather_code);
    params.wx = 'ok';
  } catch {
    params.wx = 'fail';
  }
  if (ui.params === params) render();
}

/* ---------- Erfolge ---------- */

function holeAwards(r, i) {
  const c = course(r.courseId), h = r.holes[i];
  if (!c || !h.strokes) return [];
  const diff = h.strokes - c.holes[i].par;
  const earlier = state.rounds.filter(x => x.id !== r.id);
  const earlierDiffs = earlier.flatMap(x => {
    const cc = course(x.courseId);
    return x.holes.map((hh, j) => (hh.strokes && cc?.holes[j] ? hh.strokes - cc.holes[j].par : null));
  }).concat(r.holes.slice(0, i).map((hh, j) => (hh.strokes ? hh.strokes - c.holes[j].par : null)))
    .filter(v => v != null);
  const out = [];
  if (h.strokes === 1) out.push(`🏆 HOLE IN ONE auf Loch ${i + 1}! Unglaublich!`);
  else if (diff <= -2) out.push(`🦅 Eagle auf Loch ${i + 1}! Ganz großes Golf!`);
  else if (diff === -1) out.push(earlierDiffs.some(v => v <= -1) ? `🐦 Birdie auf Loch ${i + 1}! Super gespielt!` : '🐦 Dein erstes Birdie! Herzlichen Glückwunsch!');
  else if (diff === 0 && !earlierDiffs.some(v => v <= 0)) out.push('⭐ Dein erstes Par! Herzlichen Glückwunsch!');
  const before = earlier.filter(x => x.courseId === c.id).map(x => x.holes[i]?.strokes).filter(Boolean);
  if (before.length && h.strokes < Math.min(...before)) out.push(`🎉 Neuer Rekord auf Loch ${i + 1}!`);
  return out;
}

function roundAwards(r) {
  const earlier = state.rounds.filter(x => x.id !== r.id && x.courseId === r.courseId);
  if (!earlier.length) return ['🌟 Deine erste Runde auf diesem Platz – schön, dass du sie festgehalten hast!'];
  const out = [];
  if (isComplete(r)) {
    const t = roundTotals(r);
    const prev = earlier.filter(isComplete).map(roundTotals);
    if (prev.length && t.strokes < Math.min(...prev.map(p => p.strokes))) out.push('🏆 Deine beste Runde auf diesem Platz!');
    const prevPts = prev.map(p => p.points).filter(p => p != null);
    if (t.points != null && prevPts.length && t.points > Math.max(...prevPts)) out.push('🏆 Deine beste Stableford-Runde hier!');
    const prevDur = earlier.filter(isComplete).map(roundDuration).filter(Boolean);
    if (prevDur.length && roundDuration(r) < Math.min(...prevDur)) out.push('⚡ Deine schnellste Runde auf diesem Platz!');
  }
  return out;
}

// Erfolge eines Lochs nur einmal vergeben, auch wenn sie hin- und herblättert
function awardHole(r, i) {
  const h = r.holes[i];
  if (!h.strokes || h.awarded === h.strokes) return [];
  h.awarded = h.strokes;
  h.awards = holeAwards(r, i);
  return h.awards;
}

// Für Übersicht und Teilen: viele Loch-Rekorde zu einer Zeile zusammenfassen
function allAwards(r) {
  const list = r.holes.flatMap(h => h.awards || []);
  const isRecord = a => a.startsWith('🎉 Neuer Rekord auf Loch');
  const records = list.filter(isRecord);
  const rest = list.filter(a => !isRecord(a));
  if (records.length >= 3) {
    rest.push(`🎉 Neue Rekorde auf ${records.length} Löchern: ${records.map(a => a.match(/\d+/)[0]).join(', ')}`);
  } else rest.push(...records);
  return [...rest, ...(r.awards || [])];
}

/* ---------- Teilen ---------- */

async function share(data) {
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText([data.text, data.url].filter(Boolean).join('\n'));
    alert('In die Zwischenablage kopiert – jetzt z. B. in WhatsApp einfügen.');
  } catch (e) {
    if (e.name !== 'AbortError') alert('Teilen hat leider nicht geklappt.');
  }
}

function roundShareText(r) {
  const c = course(r.courseId), t = roundTotals(r), dur = roundDuration(r);
  const lines = [`⛳ ${courseName(c)} – ${fmtDate(r.date)}`,
    `${t.strokes} Schläge auf ${t.played} Löchern (${parText(t.strokes - t.par)})`];
  if (t.points != null) lines.push(`${t.points} Stableford-Punkte`);
  lines.push(`${t.putts} Putts`);
  if (dur) lines.push(`⏱ ${fmtDuration(dur)}`);
  if (t.others.length) lines.push('', 'Mitspielerinnen: ' + t.others.map(o => `${o.name} ${o.strokes || '–'}`).join(', '));
  if (allAwards(r).length) lines.push('', ...allAwards(r));
  lines.push('', 'Festgehalten mit dem Golf-Tagebuch:');
  return lines.join('\n');
}

/* ---------- Aktionen ---------- */

function updateHole(fn) {
  const r = activeRound();
  fn(r.holes[state.currentHole]);
  save();
  render();
}

function newCourse(then) {
  const c = { id: uid(), name: '', holes: Array.from({ length: 18 }, () => ({ par: 4, length: null, note: '' })) };
  state.courses.push(c);
  save();
  go('courseEdit', { id: c.id, then });
  setTimeout(() => app.querySelector('[data-in="courseName"]')?.focus(), 50);
}

async function runGps(kind, msgKey, onFix) {
  gps.busy = kind;
  delete gps.msg[msgKey];
  render();
  try {
    const fix = await getFix();
    if (fix.acc > GPS_MAX_ACCURACY) {
      gps.msg[msgKey] = { ok: false, text: `GPS gerade zu ungenau (±${fix.acc} m). Bitte kurz warten und nochmal versuchen – oder selbst eintragen.` };
    } else {
      gps.msg[msgKey] = { ok: true, text: onFix(fix) };
      save();
    }
  } catch (err) {
    gps.msg[msgKey] = { ok: false, text: gpsError(err) };
  }
  gps.busy = null;
  if (ui.view === 'hole') render();
}

function measureToGreen() {
  const r = activeRound(), c = course(r.courseId), i = state.currentHole, green = c.holes[i]?.green;
  if (!green) return;
  return runGps('toGreen', 'toGreen', fix => {
    gps.toGreen = { courseId: c.id, hole: i, m: distanceM(fix, green), acc: fix.acc };
    return '';
  }).then(() => { if (gps.msg.toGreen?.ok) delete gps.msg.toGreen; if (ui.view === 'hole') render(); });
}

// Beim Betreten eines Lochs automatisch messen – aber nur, wenn GPS schon erlaubt ist
async function autoGreenDistance() {
  const r = activeRound();
  if (!r || ui.view !== 'hole' || gps.busy || !course(r.courseId).holes[state.currentHole]?.green) return;
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' });
    if (p?.state === 'granted') measureToGreen();
  } catch { /* ohne Berechtigungs-Abfrage einfach per Knopf */ }
}

function enterHole(to) {
  const r = activeRound(), from = state.currentHole, now = Date.now();
  if (to > from) {
    if (!r.holes[from].end) r.holes[from].end = now;
    toast(awardHole(r, from));
  }
  if (!r.holes[to].start) r.holes[to].start = now;
  state.currentHole = to;
  gps.msg = {};
  save();
  render();
  window.scrollTo(0, 0);
  autoGreenDistance();
}

const actions = {
  tab: d => go(d.view),
  go: d => go(d.view, { id: d.id }),

  newRound: () => go('roundCourse'),
  pickCourse: d => {
    const c = course(d.id);
    if (!c.name.trim()) c.name = 'Mein Golfplatz';
    save();
    const params = {
      courseId: d.id, wx: null,
      draft: { sky: null, windLevel: null, temp: null, windKmh: null, players: [],
        playingHcp: playingHandicap(state.profile.hcpIndex, c) },
    };
    go('roundSetup', params);
    fetchWeather(params);
  },
  draftSky: d => { ui.params.draft.sky = d.v; render(); },
  draftWind: d => { ui.params.draft.windLevel = Number(d.v); render(); },
  draftHcp: d => { const p = ui.params.draft; p.playingHcp = Math.max(0, Math.min(60, (p.playingHcp || 0) + Number(d.v))); render(); },
  addPlayer: d => {
    const name = (d.v ?? prompt('Name der Mitspielerin:') ?? '').trim();
    const p = ui.params.draft.players;
    if (!name || p.includes(name) || p.length >= MAX_PLAYERS) return;
    p.push(name);
    render();
  },
  removePlayer: d => { ui.params.draft.players.splice(Number(d.v), 1); render(); },
  startRound: () => {
    const { courseId, draft } = ui.params;
    const c = course(courseId);
    const stableford = hasStableford(c) && state.profile.hcpIndex != null;
    const r = {
      id: uid(), courseId, date: new Date().toISOString(),
      weather: { sky: draft.sky, windLevel: draft.windLevel, temp: draft.temp, windKmh: draft.windKmh },
      players: [...draft.players],
      playingHcp: stableford ? draft.playingHcp : null,
      holes: c.holes.map(() => ({ strokes: null, putts: null, penalties: 0, club: null, distance: null,
        windLevel: draft.windLevel, windDir: null, others: draft.players.map(() => null) })),
      awards: [],
    };
    r.holes[0].start = Date.parse(r.date);
    state.knownPlayers = [...new Set([...draft.players, ...state.knownPlayers])].slice(0, 20);
    state.rounds.push(r);
    state.activeRoundId = r.id;
    state.currentHole = 0;
    gps.msg = {};
    save();
    go('hole');
    autoGreenDistance();
  },
  resume: () => { go('hole'); autoGreenDistance(); },
  pause: () => { saveNow(); go('home'); },
  discardRound: () => {
    if (!confirm('Die laufende Runde wirklich verwerfen? Die Eingaben gehen verloren.')) return;
    state.rounds = state.rounds.filter(r => r.id !== state.activeRoundId);
    state.activeRoundId = null;
    save();
    render();
  },
  holeGo: d => enterHole(Number(d.v)),
  setClub: d => updateHole(h => {
    h.club = h.club === d.v ? null : d.v;
    // Weite schon mal mit dem Durchschnitt vorbelegen
    const s = clubStats()[h.club];
    if (h.club && !h.distance && s) h.distance = s.avg;
  }),
  dist: d => updateHole(h => {
    const base = h.distance ?? (clubStats()[h.club]?.avg || 100);
    h.distance = Math.max(0, Math.min(400, (h.distance == null ? base : base + Number(d.v))));
  }),
  setStrokes: d => updateHole(h => {
    const v = Number(d.v);
    h.strokes = h.strokes === v ? null : v;
    if (h.putts != null && h.strokes != null && h.putts >= h.strokes) h.putts = null;
  }),
  setPutts: d => updateHole(h => { const v = Number(d.v); h.putts = h.putts === v ? null : v; }),
  setPenalties: d => updateHole(h => { h.penalties = Math.max(0, Math.min(9, (h.penalties || 0) + Number(d.v))); }),
  setOther: d => updateHole(h => {
    const k = Number(d.k), par = course(activeRound().courseId).holes[state.currentHole]?.par || 4;
    h.others ||= [];
    const cur = h.others[k];
    h.others[k] = cur == null ? par : Math.max(1, Math.min(15, cur + Number(d.v)));
  }),
  holeWind: d => updateHole(h => { h.windLevel = Number(d.v); if (h.windLevel === 0) h.windDir = null; }),
  holeDir: d => updateHole(h => { h.windDir = h.windDir === d.v ? null : d.v; }),

  gpsTee: () => runGps('tee', 'dist', fix => {
    activeRound().holes[state.currentHole].teePos = fix;
    return `Abschlag gemerkt ✓ (±${fix.acc} m). Geh zu deinem Ball und tippe dann „Ball liegt hier“.`;
  }),
  gpsBall: () => runGps('ball', 'dist', fix => {
    const h = activeRound().holes[state.currentHole];
    h.distance = Math.min(400, distanceM(h.teePos, fix));
    return `Gemessen: ${h.distance} m ✓`;
  }),
  gpsGreen: () => runGps('green', 'green', fix => {
    const r = activeRound();
    course(r.courseId).holes[state.currentHole].green = fix;
    return 'Grün gemerkt ✓ – ab jetzt siehst du an diesem Loch die Entfernung zum Grün.';
  }),
  gpsToGreen: () => measureToGreen(),

  finishRound: () => {
    const r = activeRound();
    const open = r.holes.filter(h => !h.strokes).length;
    if (open && !confirm(`Bei ${open} ${open === 1 ? 'Loch fehlen' : 'Löchern fehlen'} noch die Schläge. Trotzdem beenden?`)) return;
    const now = Date.now();
    const cur = r.holes[state.currentHole];
    if (cur.start && !cur.end) cur.end = now;
    r.finishedAt = now;
    const lastHole = awardHole(r, state.currentHole);
    r.awards = roundAwards(r);
    state.activeRoundId = null;
    saveNow();
    go('summary', { id: r.id });
    toast(['🎉 Runde geschafft!', ...lastHole, ...r.awards]);
  },
  deleteRound: d => {
    if (!confirm('Diese Runde wirklich löschen?')) return;
    state.rounds = state.rounds.filter(r => r.id !== d.id);
    save();
    go('home');
  },
  shareRound: d => share({ title: 'Meine Golfrunde', text: roundShareText(round(d.id)), url: APP_URL }),
  shareApp: () => share({
    title: 'Golf-Tagebuch',
    text: 'Schau mal, mit dieser App schreibe ich meine Golfrunden mit ⛳ Einfach den Link öffnen und auf den Home-Bildschirm legen:',
    url: APP_URL,
  }),

  newCourse: d => newCourse(d.then),
  editCourse: d => go('courseEdit', { id: d.id }),
  setHoleCount: d => {
    const c = course(ui.params.id), n = Number(d.v);
    if (n < c.holes.length && !confirm('Löcher 10 bis 18 werden entfernt. Fortfahren?')) return;
    while (c.holes.length < n) c.holes.push({ par: 4, length: null, note: '' });
    c.holes.length = n;
    save();
    render();
  },
  setPar: d => { course(ui.params.id).holes[d.i].par = Number(d.v); save(); render(); },
  deleteCourse: d => {
    const n = state.rounds.filter(r => r.courseId === d.id).length;
    if (!confirm(`Diesen Platz wirklich löschen?${n ? ` Auch die ${n} Runden darauf werden gelöscht.` : ''}`)) return;
    state.courses = state.courses.filter(c => c.id !== d.id);
    state.rounds = state.rounds.filter(r => r.courseId !== d.id);
    if (state.activeRoundId && !activeRound()) state.activeRoundId = null;
    save();
    go('courses');
  },

  setFont: d => { state.settings.fontScale = Number(d.v); save(); render(); },
  toggleAwake: (d, el) => { state.settings.keepAwake = el.checked; save(); },
  toggleClub: (d, el) => { club(d.id).active = el.checked; save(); },
  renameClub: d => {
    const k = club(d.id);
    const name = prompt('Neuer Name für den Schläger (leer lassen zum Löschen):', k.name);
    if (name === null) return;
    if (!name.trim()) {
      if (confirm(`„${k.name}“ löschen?`)) state.clubs = state.clubs.filter(x => x.id !== k.id);
    } else k.name = name.trim();
    save();
    render();
  },
  addClub: () => {
    const name = prompt('Name des Schlägers, z. B. „Eisen 4“ oder „Lob Wedge“:');
    if (!name || !name.trim()) return;
    state.clubs.push({ id: uid(), name: name.trim(), active: true });
    save();
    render();
  },

  doBackup: async () => {
    const day = new Date().toISOString().slice(0, 10);
    const file = new File([JSON.stringify(state, null, 1)], `golf-tagebuch-${day}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Golf-Tagebuch Sicherung' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      state.lastBackup = new Date().toISOString();
      save();
      render();
    } catch (e) {
      if (e.name !== 'AbortError') alert('Die Sicherung hat nicht geklappt. Bitte noch einmal versuchen.');
    }
  },
  restore: () => document.getElementById('restoreFile').click(),
  closeSplash: () => document.querySelector('.splash')?.remove(),
};

document.getElementById('restoreFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.courses) || !Array.isArray(data.rounds) || !Array.isArray(data.clubs)) throw new Error('format');
    if (!confirm(`Sicherung mit ${data.courses.length} Plätzen und ${data.rounds.length} Runden laden? Die jetzigen Daten werden ersetzt.`)) return;
    state = mergeState(data);
    await saveNow();
    go('home');
    alert('Fertig – deine Daten sind wieder da.');
  } catch {
    alert('Diese Datei ist keine Golf-Tagebuch-Sicherung.');
  }
});

/* Eingaben in Textfeldern: speichern ohne neu zu zeichnen (sonst springt die Tastatur weg) */
const parseDecimal = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const parseIntOrNull = (v, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null; };

const inputs = {
  courseName: v => { course(ui.params.id).name = v; },
  courseCr: v => { course(ui.params.id).cr = parseDecimal(v); },
  courseSlope: v => { course(ui.params.id).slope = parseIntOrNull(v, 55, 155); },
  holeLength: (v, d) => { course(ui.params.id).holes[d.i].length = parseIntOrNull(v, 0, 700); },
  holeSi: (v, d) => { course(ui.params.id).holes[d.i].si = parseIntOrNull(v, 1, 18); },
  holeNote: v => { const h = course(activeRound().courseId).holes[state.currentHole]; if (h) h.note = v; },
  distance: v => { activeRound().holes[state.currentHole].distance = parseIntOrNull(v, 0, 400); },
  roundNote: (v, d) => { round(d.id).note = v; },
  hcpIndex: v => { const n = parseDecimal(v); state.profile.hcpIndex = n == null ? null : Math.max(-10, Math.min(54, n)); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || !actions[el.dataset.a]) return;
  actions[el.dataset.a](el.dataset, el);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-in]');
  if (!el || !inputs[el.dataset.in]) return;
  inputs[el.dataset.in](el.value, el.dataset);
  save();
});

/* ---------- Motivierender Spruch bei jedem Start ---------- */

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen!';
  if (h < 17) return 'Hallo, schön dass du da bist!';
  return 'Guten Abend!';
}

function showQuote() {
  let i;
  do { i = Math.floor(Math.random() * QUOTES.length); } while (QUOTES.length > 1 && i === state.lastQuote);
  state.lastQuote = i;
  save();
  document.querySelector('.splash')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="splash" role="dialog" aria-modal="true" aria-label="Spruch des Tages">
      <div class="splash-card">
        <div class="splash-icon" aria-hidden="true">⛳</div>
        <p class="splash-greet">${greeting()}</p>
        <p class="splash-quote">„${esc(QUOTES[i])}“</p>
        <button class="btn primary big" data-a="closeSplash">Los geht's</button>
      </div>
    </div>`);
}

let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    saveNow();
  } else {
    if (hiddenAt && Date.now() - hiddenAt > QUOTE_AGAIN_AFTER_MIN * 60000) showQuote();
    tick();
  }
  updateWakeLock();
});

/* Uhr am Loch alle 15 Sekunden auffrischen, ohne die Seite neu zu zeichnen */
function tick() {
  const r = activeRound();
  const tHole = document.getElementById('tHole');
  if (!r || !tHole) return;
  tHole.textContent = fmtDuration(holeTimeNow(r.holes[state.currentHole]));
  document.getElementById('tRound').textContent = fmtDuration(Date.now() - Date.parse(r.date));
}
setInterval(tick, 15000);

/* ---------- Start ---------- */

(async function init() {
  const saved = await store.load();
  if (saved) state = mergeState(saved);
  if (state.activeRoundId && activeRound()) ui = { view: 'hole', params: {} };
  render();
  showQuote();
  autoGreenDistance();

  // iOS bitten, die Daten dauerhaft zu behalten
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
