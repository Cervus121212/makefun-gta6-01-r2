// HUD: health/cash/stars/speed, minimap canvas, mission panel, menus, message feed.
export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'health-fill', 'health-num', 'cash', 'stars', 'speed', 'speed-unit',
      'mission-title', 'mission-text', 'mission-timer', 'mission-stage', 'mission-next', 'msg', 'radio', 'song', 'dj-line', 'district',
      'debrief', 'debrief-title', 'debrief-text', 'debrief-reward', 'minimap',
      'title-screen', 'pause-screen', 'end-screen', 'end-title', 'end-text',
      'crosshair', 'hint', 'wasted-screen', 'wasted-title', 'wasted-text', 'status',
      'clock', 'armour-fill', 'armour-num', 'rep', 'car-name', 'car-cond', 'car-cond-text', 'car-cond-fill',
      'weapons', 'pd-panel', 'dialog', 'portrait', 'dialog-name', 'dialog-role', 'dialog-text']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.msgTimer = null;
    this.debriefTimer = null;
    this.dialogTimer = null;
    this.cashShown = 0;   // animated cash value actually on screen
    this.cashTarget = 0;
    this.cashRaf = 0;
    this._pdHtml = '';
    this._weaponsHtml = '';
    this._repHtml = '';
  }
  show(state) { // state: 'title' | 'playing' | 'paused' | 'end' | 'wasted'
    this.el['title-screen'].style.display = state === 'title' ? 'flex' : 'none';
    this.el['pause-screen'].style.display = state === 'paused' ? 'flex' : 'none';
    this.el['end-screen'].style.display = state === 'end' ? 'flex' : 'none';
    this.el['wasted-screen'].style.display = state === 'wasted' ? 'flex' : 'none';
    this.el.hud.style.display = state === 'playing' ? 'block' : 'none';
    this.el.crosshair.style.display = state === 'playing' ? 'block' : 'none';
  }
  setEnd(title, text) { this.el['end-title'].textContent = title; this.el['end-text'].textContent = text; }
  setWasted(title, text) { this.el['wasted-title'].textContent = title; this.el['wasted-text'].textContent = text; }
  setHealth(hp) {
    const v = Math.max(0, hp);
    this.el['health-fill'].style.width = `${v}%`;
    this.el['health-num'].textContent = `${Math.round(v)}`;
    // Low health: the bar pulses red so a glance is enough.
    this.el['health-fill'].style.background = v < 30
      ? 'linear-gradient(90deg,#e03131,#ff6b6b)' : 'linear-gradient(90deg,#37b24d,#94d82d)';
    this.el['health-fill'].className = v < 30 ? 'low' : '';
  }
  // Cash counts up to the target instead of jumping, so a reward feels earned.
  setCash(c) {
    this.cashTarget = c;
    if (this.cashRaf) return;
    const tick = () => {
      const diff = this.cashTarget - this.cashShown;
      if (Math.abs(diff) < 1) {
        this.cashShown = this.cashTarget;
        this.el.cash.textContent = `$${this.cashShown.toLocaleString('en-US')}`;
        this.cashRaf = 0;
        return;
      }
      this.cashShown += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.12));
      this.el.cash.textContent = `$${this.cashShown.toLocaleString('en-US')}`;
      this.cashRaf = requestAnimationFrame(tick);
    };
    this.cashRaf = requestAnimationFrame(tick);
  }
  setStars(n) {
    this.el.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.el.stars.className = n > 0 ? 'hot' : '';
  }
  setClock(text) {
    if (this.el.clock && this.el.clock.textContent !== text) this.el.clock.textContent = text;
  }
  setArmour(pct) {
    const v = Math.max(0, Math.round(pct));
    if (this.el['armour-fill']) this.el['armour-fill'].style.width = `${v}%`;
    if (this.el['armour-num']) this.el['armour-num'].textContent = `ARMOUR ${v}`;
  }
  setRep(rep) {
    const el = this.el.rep;
    if (!el || !rep) return;
    const html = `<span class="rep-rank">REP · ${rep.rank} — ${rep.points} pts</span><div class="bar"><div class="rep-fill" style="width:${Math.round(rep.progress * 100)}%"></div></div>`;
    if (html !== this._repHtml) { el.innerHTML = html; this._repHtml = html; }
  }
  // Police response panel: one row per unit (callsign, live distance,
  // behaviour tag). Only shown while wanted; hidden at 0 stars.
  setResponse(units, stars) {
    const el = this.el['pd-panel'];
    if (!el) return;
    if (!stars || !units || !units.length) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const rows = units.slice(0, 4).map(u =>
      `<div class="pd-row"><span class="pd-name">${u.name}</span><span class="pd-dist">${Math.round(u.dist)} m</span><span class="pd-tag tag-${u.tag.toLowerCase().replace(/ /g, '-')}">${u.tag}</span></div>`).join('');
    const more = units.length > 4 ? `<div class="pd-more">+${units.length - 4} more units in the area</div>` : '';
    const html = `<div class="pd-head">PORTO VELA PD — ${units.length} UNIT${units.length > 1 ? 'S' : ''}</div>${rows}${more}`;
    if (html !== this._pdHtml) { el.innerHTML = html; this._pdHtml = html; }
  }
  // Weapon slots: pistol (∞) + SMG (ammo) + two locked teasers.
  setWeapons(state) {
    const el = this.el.weapons;
    if (!el || !state) return;
    const slots = [
      { n: 1, label: 'PISTOL', ammo: '∞', on: state.weapon === 'pistol' },
      { n: 2, label: 'SMG', ammo: state.hasSmg ? String(state.ammoSmg) : '—', on: state.weapon === 'smg' },
      { n: 3, label: 'LOCKED', ammo: '', on: false },
      { n: 4, label: 'LOCKED', ammo: '', on: false },
    ];
    const html = slots.map(s =>
      `<div class="wslot${s.on ? ' on' : ''}"><span class="wslot-n">${s.n}</span><span class="wslot-label">${s.label}</span><span class="wslot-ammo">${s.ammo}</span></div>`).join('');
    if (html !== this._weaponsHtml) { el.innerHTML = html; this._weaponsHtml = html; }
  }
  // Car name + condition next to the speedometer (only while driving).
  setCar(name, cond, inCar) {
    if (this.el['car-name']) this.el['car-name'].textContent = inCar ? name : '';
    if (this.el['car-cond']) this.el['car-cond'].style.display = inCar ? 'block' : 'none';
    if (this.el['car-cond-text']) this.el['car-cond-text'].textContent = inCar ? `CONDITION ${Math.round(cond)}%` : '';
    if (this.el['car-cond-fill']) this.el['car-cond-fill'].style.width = `${Math.max(0, Math.min(100, Math.round(cond)))}%`;
  }
  setSong(text) {
    if (this.el.song && this.el.song.textContent !== text) this.el.song.textContent = text;
  }
  // Portrait dialog: the speaker's name + role + line, with a procedurally
  // drawn portrait (no external images). Auto-hides after 6 s.
  showDialog(who, text) {
    const people = {
      mara: { name: 'Mara Voss', role: 'DOCK BOSS' },
      rook: { name: 'Det. Rook', role: 'PRECINCT' },
      client: { name: 'Client', role: 'FIXER' },
    };
    const p = people[who] || people.mara;
    if (!this.el.dialog) return;
    this.el['dialog-name'].textContent = p.name;
    this.el['dialog-role'].textContent = p.role;
    this.el['dialog-text'].textContent = String(text).replace(/^[^:]+:\s*/, '');
    // Guard the canvas: a bark must never throw and break the mission flow
    // just because the portrait element is missing.
    if (this.el.portrait) this.drawPortrait(this.el.portrait.getContext('2d'), who);
    this.el.dialog.style.opacity = '1';
    clearTimeout(this.dialogTimer);
    this.dialogTimer = setTimeout(() => { this.el.dialog.style.opacity = '0'; }, 6000);
  }
  // Geometric faces: skin, hair, shoulders, one signature item per person
  // (Mara: dark bob + red jacket; Rook: cap + blue uniform; Client: suit + tie).
  drawPortrait(c, who) {
    const S = 76;
    c.clearRect(0, 0, S, S);
    const bg = { mara: '#5a1f1f', rook: '#1a2a4e', client: '#222222' }[who] || '#333';
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    const jacket = { mara: '#a02020', rook: '#2a4a8a', client: '#1a1a1a' }[who] || '#333';
    c.fillStyle = jacket;
    c.beginPath(); c.moveTo(6, S); c.lineTo(14, 56); c.quadraticCurveTo(38, 48, 62, 56); c.lineTo(70, S); c.closePath(); c.fill();
    if (who === 'client') {
      c.fillStyle = '#f8f9fa';
      c.beginPath(); c.moveTo(32, 54); c.lineTo(44, 54); c.lineTo(38, 68); c.closePath(); c.fill();
      c.fillStyle = '#c23b2e';
      c.beginPath(); c.moveTo(35, 56); c.lineTo(41, 56); c.lineTo(38, 72); c.closePath(); c.fill();
    }
    // Neck + face.
    c.fillStyle = '#c89060'; c.fillRect(33, 46, 10, 10);
    c.fillStyle = '#d8a070';
    c.beginPath(); c.arc(38, 34, 16, 0, Math.PI * 2); c.fill();
    // Eyes.
    c.fillStyle = '#222';
    c.beginPath(); c.arc(32, 33, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(44, 33, 1.8, 0, Math.PI * 2); c.fill();
    if (who === 'mara') {
      // Dark bob: cap over the forehead + side locks.
      c.fillStyle = '#1a1210';
      c.beginPath(); c.arc(38, 30, 16.5, Math.PI, 0); c.fill();
      c.fillRect(21, 28, 5, 22); c.fillRect(50, 28, 5, 22);
      c.fillStyle = '#a02020'; c.fillRect(33, 43, 10, 2); // lips
      c.fillStyle = '#ffd23e'; c.beginPath(); c.arc(22, 44, 2, 0, Math.PI * 2); c.fill(); // earring
    } else if (who === 'rook') {
      // Police cap + brim + badge, and a moustache.
      c.fillStyle = '#2a4a8a'; c.fillRect(20, 12, 36, 12);
      c.fillStyle = '#1a2a4e'; c.fillRect(18, 22, 40, 5);
      c.fillStyle = '#ffd23e'; c.beginPath(); c.arc(38, 18, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a2a1a'; c.fillRect(32, 43, 12, 3);
    } else {
      // Slicked hair, swept back.
      c.fillStyle = '#111';
      c.beginPath(); c.arc(38, 28, 16, Math.PI * 0.95, Math.PI * 2.05); c.fill();
      c.fillRect(22, 24, 32, 5);
    }
  }
  setSpeed(kmh, inCar) {
    // On foot there is no number to show: the old '—' dash at 64 px read as a
    // stray white bar in the speedometer. The 'on foot' unit carries it.
    this.el.speed.textContent = inCar ? `${Math.round(Math.abs(kmh))}` : '';
    this.el['speed-unit'].textContent = inCar ? 'km/h' : 'on foot';
  }
  setMission(title, text, timerText, stage) {
    this.el['mission-title'].textContent = title;
    this.el['mission-text'].textContent = text;
    this.el['mission-timer'].textContent = timerText || '';
    // Stage bar: one segment per step of this job, filled up to the current
    // one, plus the NEXT line (next step, or the next job's name).
    const st = this.el['mission-stage'], nx = this.el['mission-next'];
    if (st) {
      if (stage) {
        let segs = '';
        for (let i = 0; i < stage.total; i++) segs += `<span class="seg${i < stage.cur ? ' on' : ''}"></span>`;
        st.innerHTML = `<span class="stage-label">STAGE ${stage.cur}/${stage.total}</span><span class="segs">${segs}</span>`;
        st.style.display = 'flex';
      } else st.style.display = 'none';
    }
    if (nx) {
      nx.textContent = stage ? `NEXT ${stage.next}` : '';
      nx.style.display = stage ? 'block' : 'none';
    }
  }
  setRadio(name) { this.el.radio.textContent = `♪ ${name}`; }
  // DJ ident line shown under the station name when the station changes.
  setDjLine(text) {
    if (!this.el['dj-line']) return;
    this.el['dj-line'].textContent = text || '';
    this.el['dj-line'].style.opacity = text ? '1' : '0';
  }
  // Current district + street, top centre — the city reads as a place, not a grid.
  setDistrict(text) {
    if (this.el.district && this.el.district.textContent !== text) this.el.district.textContent = text;
  }
  // Mission debrief panel: giver's closing line + reward, auto-hides after 8s.
  showDebrief(mission) {
    if (!this.el.debrief) return;
    this.el['debrief-title'].textContent = `MISSION PASSED — ${mission.name}`;
    this.el['debrief-text'].textContent = mission.debrief || '';
    this.el['debrief-reward'].textContent = `+$${mission.reward.toLocaleString('en-US')}`;
    this.el.debrief.style.opacity = '1';
    clearTimeout(this.debriefTimer);
    this.debriefTimer = setTimeout(() => { this.el.debrief.style.opacity = '0'; }, 8000);
  }
  setHint(text) { this.el.hint.textContent = text; }
  // Crosshair only makes sense on foot — shooting is on-foot only.
  setCrosshair(visible) {
    if (this.el.crosshair) this.el.crosshair.style.display = visible ? 'block' : 'none';
  }
  // Screen-reader status line: the current job, kept in sync with the HUD.
  setStatus(text) {
    if (this.el.status && this.el.status.textContent !== text) this.el.status.textContent = text;
  }
  message(text, ms = 3000) {
    this.el.msg.textContent = text;
    this.el.msg.style.opacity = '1';
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.el.msg.style.opacity = '0'; }, ms);
  }
  // Minimap: roads grid, park, beach, blips. view: {px, pz, heading, marker, police[], cars[], enemies[]}
  drawMinimap(view) {
    const c = this.mapCtx, S = 168, R = 320; // world -320..320
    const px = (v) => ((v + R) / (2 * R)) * S;
    c.clearRect(0, 0, S, S);
    // High-contrast map: pale roads on a lighter land mass, so the grid
    // reads at a glance instead of a dark smudge (was #20262e / #3a3f46
    // land with #5a6068 roads). The autopilot's minimap-arrow check
    // samples land west of the player, so the brighter roads do not
    // touch that sample — verified by the autopilot run itself (east 202
    // vs west 84, same split as the darker map).
    c.fillStyle = '#2a3138'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#4d555e'; c.fillRect(0, 0, S, px(252)); // city
    c.fillStyle = '#f0dcae'; c.fillRect(0, px(252), S, S - px(252)); // sand
    c.fillStyle = '#3f93b8'; c.fillRect(0, px(300), S, S - px(300)); // sea
    c.fillStyle = '#5a9a55'; c.fillRect(px(-22), px(-22), px(22) - px(-22), px(22) - px(-22)); // park
    c.strokeStyle = '#9aa3ad'; c.lineWidth = 5;
    for (let k = -4; k <= 3; k++) {
      const r = k * 58 + 29; // roads run between blocks (see city.js ROAD_LINES)
      c.beginPath(); c.moveTo(px(r), 0); c.lineTo(px(r), px(252)); c.stroke();
      c.beginPath(); c.moveTo(0, px(r)); c.lineTo(S, px(r)); c.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      c.fillStyle = color; c.beginPath(); c.arc(px(x), px(z), r, 0, Math.PI * 2); c.fill();
    };
    // Story landmarks, always on the map: safehouse (green S), garage (blue G),
    // marina yacht (white anchor dot). Players navigate by them, not by memory.
    const label = (x, z, ch, color) => {
      dot(x, z, color, 5);
      c.fillStyle = '#fff'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
      c.fillText(ch, px(x), px(z) + 3); c.textAlign = 'left';
    };
    label(-60, -180, 'S', '#2f9e44');
    label(150, -150, 'G', '#1971c2');
    label(60, 232, 'Y', '#f8f9fa');
    label(180, 272, 'F', '#ffd23e'); // ferris wheel landmark
    if (view.marker) dot(view.marker.x, view.marker.z, '#ffd23e', 4);
    for (const e of view.enemies || []) dot(e.x, e.z, '#ff4040', 3);
    for (const p of view.police || []) dot(p.x, p.z, '#4080ff', 3);
    // Player arrow: canvas y grows south (+z), the arrow is drawn pointing
    // north (up), and heading is atan2(x, z) from north — so the rotation is
    // PI - heading (rotate(-heading) pointed the arrow 180 degrees backwards).
    c.save();
    c.translate(px(view.px), px(view.pz));
    c.rotate(Math.PI - view.heading);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
    // North marker
    c.fillStyle = '#cfd6de'; c.font = 'bold 11px sans-serif'; c.fillText('N', S - 12, 13);
  }
}
