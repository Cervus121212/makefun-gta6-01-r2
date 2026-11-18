// HUD: health/cash/stars/speed, minimap canvas, mission panel, menus, message feed.
export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'health-fill', 'health-num', 'cash', 'stars', 'speed', 'speed-unit',
      'mission-title', 'mission-text', 'mission-timer', 'msg', 'radio', 'dj-line', 'district',
      'debrief', 'debrief-title', 'debrief-text', 'debrief-reward', 'minimap',
      'title-screen', 'pause-screen', 'end-screen', 'end-title', 'end-text',
      'crosshair', 'hint', 'wasted-screen', 'wasted-title', 'wasted-text']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.msgTimer = null;
    this.debriefTimer = null;
    this.cashShown = 0;   // animated cash value actually on screen
    this.cashTarget = 0;
    this.cashRaf = 0;
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
  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(Math.abs(kmh))}` : '—';
    this.el['speed-unit'].textContent = inCar ? 'km/h' : 'on foot';
  }
  setMission(title, text, timerText) {
    this.el['mission-title'].textContent = title;
    this.el['mission-text'].textContent = text;
    this.el['mission-timer'].textContent = timerText || '';
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
  message(text, ms = 4200) {
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
    c.fillStyle = '#20262e'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#3a3f46'; c.fillRect(0, 0, S, px(252)); // city
    c.fillStyle = '#e8cf9a'; c.fillRect(0, px(252), S, S - px(252)); // sand
    c.fillStyle = '#2e6f8e'; c.fillRect(0, px(300), S, S - px(300)); // sea
    c.fillStyle = '#4d7a4a'; c.fillRect(px(-22), px(-22), px(22) - px(-22), px(22) - px(-22)); // park
    c.strokeStyle = '#5a6068'; c.lineWidth = 5;
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
    if (view.marker) dot(view.marker.x, view.marker.z, '#ffd23e', 4);
    for (const e of view.enemies || []) dot(e.x, e.z, '#ff4040', 3);
    for (const p of view.police || []) dot(p.x, p.z, '#4080ff', 3);
    // Player arrow
    c.save();
    c.translate(px(view.px), px(view.pz));
    c.rotate(-view.heading);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
    // North marker
    c.fillStyle = '#cfd6de'; c.font = 'bold 11px sans-serif'; c.fillText('N', S - 12, 13);
  }
}
