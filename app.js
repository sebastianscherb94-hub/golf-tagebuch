'use strict';

/* ---------- Grundwerte ---------- */

const WIND = ['Kein', 'Leicht', 'Mittel', 'Stark'];
const DIRS = { gegen: 'Gegenwind', rueck: 'Rückenwind', seite: 'Seitenwind' };
const SKY = { sonne: '☀️ Sonnig', wolken: '⛅ Bewölkt', regen: '🌧️ Regen', nebel: '🌫️ Nebel' };
const DEFAULT_CLUBS = ['Driver', 'Holz 3', 'Holz 5', 'Hybrid', 'Eisen 5', 'Eisen 6', 'Eisen 7',
  'Eisen 8', 'Eisen 9', 'Pitching Wedge', 'Sand Wedge', 'Putter'];
const BACKUP_REMINDER_DAYS = 30;
const QUOTE_AGAIN_AFTER_MIN = 30; // so lange im Hintergrund → beim Zurückkommen neuer Spruch

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
    version: 1,
    courses: [],
    clubs: DEFAULT_CLUBS.map(name => ({ id: uid(), name, active: true })),
    rounds: [],
    activeRoundId: null,
    currentHole: 0,
    lastBackup: null,
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
  for (const [id, list] of Object.entries(stats)) {
    out[id] = { avg: Math.round(list.reduce((a, b) => a + b, 0) / list.length), count: list.length };
  }
  return out;
}

// Das letzte Mal, als sie dieses Loch gespielt hat (aus einer anderen Runde)
function lastTimeOn(courseId, holeIndex, excludeRoundId) {
  return state.rounds
    .filter(r => r.courseId === courseId && r.id !== excludeRoundId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => ({ round: r, hole: r.holes[holeIndex] }))
    .find(x => x.hole && (x.hole.strokes || x.hole.club || x.hole.distance));
}

function roundTotals(r) {
  const c = course(r.courseId);
  let strokes = 0, par = 0, putts = 0, played = 0;
  r.holes.forEach((h, i) => {
    if (!h || !h.strokes) return;
    strokes += h.strokes;
    par += c?.holes[i]?.par || 0;
    putts += h.putts || 0;
    played++;
  });
  return { strokes, par, putts, played };
}

/* Zeitmessung: Ein Loch läuft vom ersten Betreten bis zum Weitergehen zum nächsten Loch.
   Zurückblättern zum Korrigieren ändert die Zeiten nicht. */
const holeDuration = h => (h?.start && h?.end ? h.end - h.start : null);
const roundDuration = r => (r.finishedAt ? r.finishedAt - Date.parse(r.date) : null);

function holeTimeNow(h) {
  if (!h?.start) return null;
  return (h.end || Date.now()) - h.start;
}

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

/* ---------- Ansichten ---------- */

const views = {
  home() {
    const r = activeRound();
    const recent = state.rounds.filter(x => x.id !== state.activeRoundId)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    let html = `<h1>Golf-Tagebuch</h1>`;

    if (!isStandalone()) {
      html += `<div class="card hint">
        <h3>Als App auf den Home-Bildschirm legen</h3>
        <p class="small">In Safari unten auf <strong>Teilen</strong> (□ mit Pfeil) tippen, dann
        <strong>„Zum Home-Bildschirm“</strong> wählen. So bleiben deine Daten sicher gespeichert.</p>
      </div>`;
    }
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
        <p>${esc(c?.name)} · Loch ${state.currentHole + 1} von ${r.holes.length}</p>
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
          <span class="score">${t.strokes || '–'}</span></button></li>`;
      }).join('') + `</ul>`;
    } else if (!r) {
      html += `<p class="muted center">Hier erscheinen deine Runden, sobald du gespielt hast.</p>`;
    }
    return html;
  },

  /* --- Runde starten: Platz wählen --- */
  roundCourse() {
    let html = `<div class="topbar"><button class="btn" data-a="tab" data-view="home">‹ Zurück</button></div>
      <h1>Wo spielst du heute?</h1>`;
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

  /* --- Runde starten: Wetter --- */
  roundWeather() {
    const p = ui.params, d = p.draft, c = course(p.courseId);
    let status = '';
    if (p.wx === 'loading') status = `<div class="status">Wetter wird abgerufen …</div>`;
    else if (p.wx === 'ok') status = `<div class="status">Automatisch ermittelt: ${d.temp} °C, Wind ${d.windKmh} km/h. Du kannst es unten ändern.</div>`;
    else if (p.wx === 'fail') status = `<div class="status fail">Wetter konnte nicht abgerufen werden (kein Internet oder Standort nicht erlaubt). Bitte einfach antippen.</div>`;

    return `<div class="topbar"><button class="btn" data-a="newRound">‹ Zurück</button></div>
      <h1>Wie ist das Wetter?</h1>
      <p class="muted">${esc(c.name)}</p>
      ${status}
      <div class="section"><span class="label">Himmel</span>
        <div class="choices c2">${choiceButtons(Object.entries(SKY), d.sky, 'draftSky')}</div></div>
      <div class="section"><span class="label">Wind</span>
        <div class="choices c4">${choiceButtons(WIND.map((w, i) => [i, w]), d.windLevel, 'draftWind')}</div></div>
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

    let html = `<div class="topbar">
        <button class="btn" data-a="pause">‹ Startseite</button>
        <span class="muted small">${esc(c.name)}</span>
      </div>
      <div class="holehead">
        <h1>Loch ${i + 1}</h1>
        <span class="meta">Par ${ch.par}${ch.length ? ` · ${ch.length} m` : ''}</span>
      </div>
      <p class="timer">⏱ <strong id="tHole">${fmtDuration(holeTimeNow(h))}</strong> an diesem Loch ·
        <strong id="tRound">${fmtDuration(Date.now() - Date.parse(r.date))}</strong> gesamt</p>
      <div class="dots" id="dots">${r.holes.map((x, j) =>
        `<button data-a="holeGo" data-v="${j}" class="${j === i ? 'current' : x.strokes ? 'done' : ''}"
          aria-label="Loch ${j + 1}">${j + 1}</button>`).join('')}</div>`;

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
      </div>`;

    // Ergebnis
    html += `<div class="section"><span class="label">Schläge insgesamt</span>
        <div class="choices c6">${choiceButtons(Array.from({ length: 12 }, (_, n) => [n + 1, n + 1]), h.strokes, 'setStrokes', '', 'choice num')}</div>
      </div>
      <div class="section"><span class="label">Davon Putts</span>
        <div class="choices c6">${choiceButtons(Array.from({ length: 6 }, (_, n) => [n, n]), h.putts, 'setPutts', '', 'choice num')}</div>
      </div>
      <div class="section"><span class="label">Wind an diesem Loch</span>
        ${windPicker(h.windLevel, h.windDir, 'holeWind', 'holeDir')}
      </div>
      <div class="section">
        <label class="field">📝 Mein Tipp für dieses Loch
          <span class="small muted" style="display:block;font-weight:400">Bleibt gespeichert und erscheint jedes Mal hier. Tipp: Mit dem 🎤 auf der Tastatur kannst du diktieren.</span>
          <textarea data-in="holeNote" placeholder="z. B. Bunker rechts – lieber links anspielen">${esc(ch.note)}</textarea>
        </label>
      </div>`;

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
    const rows = r.holes.map((h, i) => `<tr>
        <td>${i + 1}</td><td>${c?.holes[i]?.par ?? '–'}</td>
        <td><strong>${h.strokes || '–'}</strong></td><td>${h.putts ?? '–'}</td>
        <td class="small">${h.club ? esc(clubName(h.club)) : '–'}${h.distance ? `<br>${h.distance} m` : ''}</td>
        <td class="small">${fmtMinutes(holeDuration(h))}</td>
      </tr>`).join('');
    const dur = roundDuration(r);

    return `<div class="topbar"><button class="btn" data-a="tab" data-view="home">‹ Start</button></div>
      <h1>${esc(courseName(c))}</h1>
      <p class="muted">${fmtDate(r.date)}${w.sky ? ` · ${SKY[w.sky]}` : ''}${w.temp != null ? ` · ${w.temp} °C` : ''}${w.windLevel != null ? ` · ${windText(w.windLevel)}` : ''}</p>
      <div class="card center">
        <div class="total">${t.strokes || '–'}</div>
        <p class="muted" style="margin-top:8px">Schläge auf ${t.played} ${t.played === 1 ? 'Loch' : 'Löchern'}</p>
        ${t.played ? `<p><strong>${parText(t.strokes - t.par)}</strong> · ${t.putts} Putts</p>` : ''}
        ${dur ? `<p>⏱ Gespielt in <strong>${fmtDuration(dur)}</strong></p>` : ''}
      </div>
      <div class="card"><table class="score">
        <thead><tr><th>Loch</th><th>Par</th><th>Schläge</th><th>Putts</th><th>Abschlag</th><th>Zeit</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <button class="btn link danger" data-a="deleteRound" data-id="${r.id}">Diese Runde löschen</button>`;
  },

  /* --- Plätze --- */
  courses() {
    let html = `<h1>Meine Golfplätze</h1>`;
    if (!state.courses.length) html += `<p class="muted">Lege hier die Plätze an, auf denen du spielst.</p>`;
    html += `<ul class="list">` + state.courses.map(c => {
      const rs = state.rounds.filter(r => r.courseId === c.id && r.holes.every(h => h.strokes));
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

    return `<div class="topbar"><button class="btn" data-a="tab" data-view="courses">‹ Plätze</button></div>
      <h1>Platz bearbeiten</h1>
      <p class="small muted">Alles wird sofort gespeichert.</p>
      <label class="field">Name des Platzes
        <input type="text" data-in="courseName" value="${esc(c.name)}" placeholder="z. B. GC Sonnenhof" autocomplete="off">
      </label>
      <div class="section"><span class="label">Wie viele Löcher?</span>
        <div class="choices c2">${choiceButtons([[9, '9 Löcher'], [18, '18 Löcher']], c.holes.length, 'setHoleCount')}</div>
      </div>
      <h2>Par und Länge</h2>
      <p class="small muted">Die Länge (in Metern) steht auf der Scorekarte. Du kannst sie auch weglassen.</p>
      ${c.holes.map((h, i) => `<div class="card">
        <h3>Loch ${i + 1}</h3>
        <div class="choices c3">${choiceButtons([[3, 'Par 3'], [4, 'Par 4'], [5, 'Par 5']], h.par, 'setPar', `data-i="${i}"`)}</div>
        <label class="field" style="margin:8px 0 0">Länge in Metern
          <input type="number" inputmode="numeric" data-in="holeLength" data-i="${i}" value="${h.length ?? ''}" placeholder="z. B. 320">
        </label>
      </div>`).join('')}
      ${back}
      <button class="btn link danger" data-a="deleteCourse" data-id="${c.id}">Platz löschen</button>`;
  },

  /* --- Schläger --- */
  clubs() {
    const stats = clubStats();
    return `<h1>Meine Schläger</h1>
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
    return `<h1>Daten sichern</h1>
      <div class="card">
        <p>Alle deine Plätze, Schläger und Runden sind auf diesem iPhone gespeichert.</p>
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
const NAV_VIEWS = { home: 'home', courses: 'courses', courseEdit: 'courses', clubs: 'clubs', backup: 'backup', summary: 'home' };

function render() {
  app.innerHTML = views[ui.view]();
  const tab = NAV_VIEWS[ui.view];
  document.body.classList.toggle('no-nav', !tab);
  document.querySelectorAll('#nav button').forEach(b => {
    if (b.dataset.view === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const dot = document.querySelector('#dots .current');
  if (dot) dot.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function go(view, params = {}) {
  ui = { view, params };
  render();
  window.scrollTo(0, 0);
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

const actions = {
  tab: d => go(d.view),
  go: d => go(d.view, { id: d.id }),

  newRound: () => go('roundCourse'),
  pickCourse: d => {
    const c = course(d.id);
    if (!c.name.trim()) c.name = 'Mein Golfplatz';
    save();
    const params = { courseId: d.id, draft: { sky: null, windLevel: null, temp: null, windKmh: null }, wx: null };
    go('roundWeather', params);
    fetchWeather(params);
  },
  draftSky: d => { ui.params.draft.sky = d.v; render(); },
  draftWind: d => { ui.params.draft.windLevel = Number(d.v); render(); },
  startRound: () => {
    const { courseId, draft } = ui.params;
    const c = course(courseId);
    const r = {
      id: uid(), courseId, date: new Date().toISOString(),
      weather: { sky: draft.sky, windLevel: draft.windLevel, temp: draft.temp, windKmh: draft.windKmh },
      holes: c.holes.map(() => ({ strokes: null, putts: null, club: null, distance: null, windLevel: draft.windLevel, windDir: null })),
    };
    r.holes[0].start = Date.parse(r.date);
    state.rounds.push(r);
    state.activeRoundId = r.id;
    state.currentHole = 0;
    save();
    go('hole');
  },
  resume: () => go('hole'),
  pause: () => { saveNow(); go('home'); },
  discardRound: () => {
    if (!confirm('Die laufende Runde wirklich verwerfen? Die Eingaben gehen verloren.')) return;
    state.rounds = state.rounds.filter(r => r.id !== state.activeRoundId);
    state.activeRoundId = null;
    save();
    render();
  },
  holeGo: d => {
    const r = activeRound(), from = state.currentHole, to = Number(d.v), now = Date.now();
    if (to > from && !r.holes[from].end) r.holes[from].end = now;
    if (!r.holes[to].start) r.holes[to].start = now;
    state.currentHole = to;
    save();
    render();
    window.scrollTo(0, 0);
  },
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
  holeWind: d => updateHole(h => { h.windLevel = Number(d.v); if (h.windLevel === 0) h.windDir = null; }),
  holeDir: d => updateHole(h => { h.windDir = h.windDir === d.v ? null : d.v; }),
  finishRound: () => {
    const r = activeRound();
    const open = r.holes.filter(h => !h.strokes).length;
    if (open && !confirm(`Bei ${open} ${open === 1 ? 'Loch fehlen' : 'Löchern fehlen'} noch die Schläge. Trotzdem beenden?`)) return;
    const now = Date.now();
    const cur = r.holes[state.currentHole];
    if (cur.start && !cur.end) cur.end = now;
    r.finishedAt = now;
    state.activeRoundId = null;
    saveNow();
    go('summary', { id: r.id });
  },
  deleteRound: d => {
    if (!confirm('Diese Runde wirklich löschen?')) return;
    state.rounds = state.rounds.filter(r => r.id !== d.id);
    save();
    go('home');
  },

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
};

document.getElementById('restoreFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.courses) || !Array.isArray(data.rounds) || !Array.isArray(data.clubs)) throw new Error('format');
    if (!confirm(`Sicherung mit ${data.courses.length} Plätzen und ${data.rounds.length} Runden laden? Die jetzigen Daten werden ersetzt.`)) return;
    state = { ...freshState(), ...data };
    await saveNow();
    go('home');
    alert('Fertig – deine Daten sind wieder da.');
  } catch {
    alert('Diese Datei ist keine Golf-Tagebuch-Sicherung.');
  }
});

/* Eingaben in Textfeldern: speichern ohne neu zu zeichnen (sonst springt die Tastatur weg) */
const inputs = {
  courseName: v => { course(ui.params.id).name = v; },
  holeLength: (v, d) => { course(ui.params.id).holes[d.i].length = v ? Math.max(0, parseInt(v, 10)) : null; },
  holeNote: v => { const h = course(activeRound().courseId).holes[state.currentHole]; if (h) h.note = v; },
  distance: v => { activeRound().holes[state.currentHole].distance = v ? Math.max(0, Math.min(400, parseInt(v, 10))) : null; },
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
actions.closeSplash = () => document.querySelector('.splash')?.remove();

let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    saveNow();
  } else {
    if (hiddenAt && Date.now() - hiddenAt > QUOTE_AGAIN_AFTER_MIN * 60000) showQuote();
    tick();
  }
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
  if (saved) state = { ...freshState(), ...saved };
  if (state.activeRoundId && activeRound()) ui = { view: 'hole', params: {} };
  render();
  showQuote();

  // iOS bitten, die Daten dauerhaft zu behalten
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
