// Porto Vela — world constants, story missions, radio. All names original.
export const WORLD = {
  seed: 7,
  pitch: 58,          // block pitch (block + road)
  blocks: 4,          // blocks from centre to edge: city spans -232..232
  roadHalf: 7,        // half width of a road
  blockHalf: 22,      // half size of a buildable block
  beachZ: 252,        // sand starts here (south edge)
  seaZ: 300,
  docksX: 270,        // docks on the east edge (clear of the last block column)
};
export const PLAYER = {
  walkSpeed: 6, runSpeed: 10, radius: 0.6, health: 100,
  jumpSpeed: 0, // on-foot movement stays grounded for stable autopilot
};
export const CAR = { accel: 22, brake: 34, maxSpeed: 42, maxReverse: 12, turn: 2.1, radius: 1.6 };
export const WANTED = { decayPerSec: 0.05, maxStars: 5 };

// ---- Porto Vela lore: districts, streets, city history (all original names) ----
// District rectangles are checked in order; the first match wins.
export const DISTRICTS = [
  { name: 'Central Park', minX: -24, maxX: 24, minZ: -24, maxZ: 24,
    blurb: 'The green heart of the city — fountain, old trees, and every deal made on a bench.' },
  { name: 'Marlin Row', minX: 120, maxX: 180, minZ: -180, maxZ: -110,
    blurb: 'Garages, chop shops and Mara\u2019s old paint shop. Every stolen car in Vela passes through here.' },
  { name: 'Safehouse Row', minX: -95, maxX: -25, minZ: -205, maxZ: -145,
    blurb: 'Quiet stucco houses with heavy curtains. Mara keeps a key under the third flowerpot.' },
  { name: 'East Docks', minX: 235, maxX: 295, minZ: 25, maxZ: 185,
    blurb: 'Container stacks, crane rust and rival crews. The port never sleeps and neither do its debts.' },
  { name: 'Marina & Beachfront', minX: -295, maxX: 295, minZ: 225, maxZ: 295,
    blurb: 'White hulls, palm shade and the yacht La Sirena — the way out of Porto Vela, if you earn it.' },
  { name: 'North Gate', minX: -180, maxX: -120, minZ: -240, maxZ: -195,
    blurb: 'The only road out of town that the precinct does not watch every hour. The only road that matters.' },
  { name: 'Old Town', minX: -235, maxX: -110, minZ: -120, maxZ: 120,
    blurb: 'Narrow lanes, laundry lines, grandmothers on balconies who see everything and say nothing.' },
  { name: 'Downtown Vela', minX: -235, maxX: 235, minZ: -235, maxZ: 225,
    blurb: 'Glass towers over bodegas. Everybody here is either going somewhere or hiding from someone.' },
];
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}
// Street names for the road grid (lines at -203, -145, -87, -29, 29, 87, 145, 203).
export const V_STREETS = ['Harbor Way', 'Calle Verde', 'Avenida Sol', 'Plaza Vieja',
  'Calle Larga', 'Marlin Avenue', 'Dockside Drive', 'Costa Road'];
export const H_STREETS = ['North Gate Road', 'Calle Brisa', 'Mercado Street', 'Fountain Lane',
  'Palma Street', 'Rooftop Row', 'Beachfront Blvd', 'Shoreline Drive'];
export function streetAt(x, z) {
  const lines = [-203, -145, -87, -29, 29, 87, 145, 203];
  let bx = 0, bd = Infinity, bz = 0, bd2 = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const dx = Math.abs(x - lines[i]);
    if (dx < bd) { bd = dx; bx = i; }
    const dz = Math.abs(z - lines[i]);
    if (dz < bd2) { bd2 = dz; bz = i; }
  }
  // Off the road grid (docks apron, beach, park) there is no street to name.
  if (Math.min(bd, bd2) > 15) return '';
  return bd < bd2 ? V_STREETS[bx] : H_STREETS[bz];
}

export const CITY_LORE =
  'Porto Vela was a fishing town until the container port doubled it in a decade — ' +
  'old fishermen\u2019s cottages under glass towers, a marina full of other people\u2019s yachts, ' +
  'and a precinct that rents its blind eye by the hour. Mara Voss owns the docks the way the ' +
  'tide owns the beach. Det. Rook owns the precinct\u2019s paperwork. Dante Reyes owes them both.';

// Stealable car names, keyed by paint colour. The van and the cruiser have
// their own names; anything unlisted falls back to a generic coupe name.
export const CAR_NAMES = {
  0xc23b2e: 'BRISA GT', 0x2e6fc2: 'COSTA S', 0xe8c832: 'SOL COUPE',
  0x3a9a4a: 'VELA ROADSTER', 0x8a8f96: 'CORAL GT', 0x22242a: 'CORAL GT',
  0xe8e4da: 'VELA ROADSTER', 0x7a4a9a: 'CORAL GT', 0xd07028: 'SOL COUPE',
  0x2a8a3a: 'VELA ROADSTER', 0x3a5a7a: 'FURGÓN', 0xf2f2f2: 'PD CRUISER',
};
export function carNameFor(color, opts = {}) {
  if (opts.van) return 'FURGÓN';
  if (opts.police) return 'PD CRUISER';
  return CAR_NAMES[color] || 'VELA COUPE';
}

// REP ranks: derived honestly from jobs done + cash earned.
export const REP_RANKS = [
  { at: 0, name: 'ROOKIE' },
  { at: 300, name: 'STREET DRIVER' },
  { at: 800, name: 'GETAWAY PRO' },
  { at: 1500, name: 'KING OF VELA' },
];
export function repFor(missionsDone, cash) {
  const points = missionsDone * 150 + Math.floor(cash / 50);
  let rank = REP_RANKS[0], next = REP_RANKS[1];
  for (let i = 0; i < REP_RANKS.length; i++) {
    if (points >= REP_RANKS[i].at) { rank = REP_RANKS[i]; next = REP_RANKS[i + 1] || null; }
  }
  const span = next ? next.at - rank.at : 1;
  const progress = next ? Math.min(1, (points - rank.at) / span) : 1;
  return { points, rank: rank.name, next: next ? next.name : null, progress };
}

// debrief: shown when the mission passes. barks: {step, text} shown when a step starts.
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Mara Voss', reward: 500, act: 1,
    brief: 'Mara needs wheels. Steal any car on the street and bring it to the garage on Marlin Row.',
    debrief: 'Mara tosses you the garage key. "Not bad for a man who just got out. The plates are clean, the tank is full — and from now on, every car in this city is a maybe."',
    barks: [{ step: 1, who: 'mara', text: 'Mara: "Marlin Row, north-east side. Don\u2019t scratch the paint — I just had it done."' }],
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', at: [150, -138], r: 8, text: 'Drive the car to the garage on Marlin Row' },
    ],
  },
  {
    id: 2, name: 'The Pickup', giver: 'Mara Voss', reward: 900, act: 1,
    brief: 'A package is waiting at the docks. Collect it and deliver it to the safehouse — no police attention.',
    debrief: 'Mara weighs the package in her hand and nods. "Sealed, dry, on time. The docks talk, Dante — tonight they\u2019ll say you\u2019re reliable. That\u2019s worth more than cash."',
    barks: [{ step: 2, who: 'mara', text: 'Mara: "Safehouse Row, the stucco house with the blue door. Knock twice. Don\u2019t run — running is what guilty people do."' }],
    steps: [
      { type: 'goto', at: [264, 60], r: 8, text: 'Go to the docks pickup point' },
      { type: 'pickup', text: 'Pick up the package (press E)' },
      { type: 'goto', at: [-60, -168], r: 8, text: 'Deliver the package to the safehouse' },
    ],
  },
  {
    id: 3, name: 'Hot Pursuit', giver: 'Det. Rook (off the books)', reward: 1200, act: 1,
    brief: 'Rook tipped off the precinct. You are about to be made — lose a 2-star wanted level and get clean.',
    debrief: 'Rook\u2019s voice on the payphone, flat as ever: "You vanished. Good. The report says the suspect was never identified. Keep it that way and I\u2019ll keep the precinct off your street."',
    barks: [{ step: 1, who: 'rook', text: 'Rook: "Two stars, Dante. Break line of sight, stay out of the cruisers\u2019 view, and let the heat die on its own."' }],
    steps: [
      { type: 'wanted', stars: 2, text: 'The police are onto you — 2 stars!' },
      { type: 'escape', text: 'Lose the cops: break line of sight and stay hidden until the stars fade' },
    ],
  },
  {
    id: 4, name: 'Dockside Deal', giver: 'Mara Voss', reward: 2000, act: 2,
    brief: 'A rival crew is moving product through the east docks. Clear them out and take the cash.',
    debrief: 'Mara counts the rival cash twice. "The east docks are mine again. Their crew will think twice before unloading on my pier — and twice is all I need."',
    barks: [
      { step: 1, who: 'mara', text: 'Mara: "Four of them, between the containers. They shoot first and count later — so you shoot first."' },
      { step: 2, who: 'mara', text: 'Mara: "Cash is on the ground by the crates. Grab it and walk away like you own the pier. Tonight, you do."' },
    ],
    steps: [
      { type: 'goto', at: [264, 120], r: 10, text: 'Go to the east docks' },
      { type: 'kill', count: 4, at: [264, 120], text: 'Take out the rival crew (4 left)' },
      { type: 'pickup', text: 'Grab the cash (press E)' },
    ],
  },
  {
    id: 5, name: 'Getaway Driver', giver: 'Mara Voss', reward: 1800, act: 2,
    brief: 'A client needs a fast, quiet ride from the marina to the north gate. 90 seconds. No scratches on the story.',
    debrief: 'The client pays without looking up from his phone. "Ninety seconds, not a scratch. Mara was right about you, Reyes. Next time I\u2019m in Vela, I ask for you by name."',
    barks: [{ step: 1, who: 'client', text: 'Client: "North Gate, ninety seconds. I don\u2019t care how — I care that nobody remembers my face."' }],
    steps: [
      { type: 'goto', at: [60, 232], r: 8, text: 'Pick up the client at the marina' },
      { type: 'deliver', at: [-150, -232], r: 9, time: 90, text: 'Drive the client to the north gate — 90 seconds!' },
    ],
  },
  {
    id: 6, name: 'The Informant', giver: 'Det. Rook', reward: 2400, act: 2,
    brief: 'An informant is running in a green sedan. Chase him down and ram his car until it stops.',
    debrief: 'Rook flips through the informant\u2019s statement. "He talked. Names, dates, the whole dock ledger. You didn\u2019t just stop a car, Dante — you handed me the precinct\u2019s winter."',
    barks: [{ step: 0, who: 'rook', text: 'Rook: "Green sedan, heading anywhere but here. Ram him until the engine gives up — I need him talking, not running."' }],
    steps: [
      { type: 'chase', text: 'Chase the green sedan and ram it until it stalls' },
    ],
  },
  {
    id: 7, name: 'Beachfront Heist', giver: 'Mara Voss', reward: 3500, act: 3,
    brief: 'A cash van is parked by the beachfront. Steal it and bring it to the safehouse — the whole precinct will chase you.',
    debrief: 'Mara opens the van doors and laughs for the first time in years. "Three stars and you still brought it home. The beach saw everything, Dante — tomorrow the whole city will know your name."',
    barks: [
      { step: 1, who: 'mara', text: 'Mara: "That van is the precinct\u2019s payroll. Touch it and every cruiser in Vela wakes up. Touch it anyway."' },
      { step: 2, who: 'mara', text: 'Mara: "Safehouse, fast. The helicopter is already in the air — don\u2019t give it a clean look at your plates."' },
    ],
    steps: [
      { type: 'goto', at: [-180, 232], r: 9, text: 'Reach the cash van on the beachfront' },
      { type: 'steal', van: true, text: 'Steal the cash van (press E)' },
      { type: 'goto', at: [-60, -168], r: 9, text: 'Bring the van to the safehouse — 3 stars on you!' },
    ],
  },
  {
    id: 8, name: 'King of Vela', giver: 'Mara Voss', reward: 6000, act: 3,
    brief: 'The finale. Survive a 4-star manhunt for 60 seconds, then reach the yacht at the marina and sail out a legend.',
    debrief: 'The yacht La Sirena slips past the breakwater as the sun goes down. Behind you: sirens, smoke, and a city that will tell your story for years. Ahead: open water, and nobody left to answer to.',
    barks: [
      { step: 1, who: 'mara', text: 'Mara: "Sixty seconds, four stars, one helicopter. Survive it and the yacht is yours. Sail out a legend, Dante."' },
      { step: 2, who: 'mara', text: 'Mara: "The marina — now! La Sirena is fuelled and waiting. Don\u2019t look back."' },
    ],
    steps: [
      { type: 'wanted', stars: 4, text: '4 stars! Survive the manhunt — 60 seconds' },
      { type: 'survive', time: 60, text: 'Stay alive and stay free for 60 seconds' },
      { type: 'goto', at: [60, 232], r: 9, text: 'Reach the yacht at the marina' },
    ],
  },
];

export const RADIO = [
  { name: 'VELA FM — synthwave', dj: 'DJ Neon', bpm: 112, root: 55, scale: [0, 3, 5, 7, 10],
    tracks: [
      { title: 'Neon Coast', artist: 'Retro Drive' },
      { title: 'Sunset Mirage', artist: 'Palm Static' },
      { title: 'Golden Hour Run', artist: 'Costa Lights' },
    ],
    lines: [
      'DJ Neon: "You\u2019re riding with VELA FM — neon nights, golden hour, and the only traffic report that matters: the cops are always behind you."',
      'DJ Neon: "That was Retro Coast, for everyone driving with the windows down and the plates up. Stay gold, Porto Vela."',
      'DJ Neon: "Sunset over the marina, synths on the radio. If you\u2019re hearing this from a stolen car — drive safe, I didn\u2019t see a thing."',
    ] },
  { name: 'COSTA 88 — latin drive', dj: 'La Voz', bpm: 132, root: 65.41, scale: [0, 2, 4, 7, 9],
    tracks: [
      { title: 'Salsa de la Calle', artist: 'Los Marineros' },
      { title: 'Ritmo del Puerto', artist: 'Marimba Sol' },
      { title: 'Cumbia del Amanecer', artist: 'La Brisa' },
    ],
    lines: [
      'La Voz: "COSTA 88, la radio que maneja contigo — salsa for the avenues, drums for the docks, and no questions asked."',
      'La Voz: "From Old Town to the beachfront, this one\u2019s for the drivers who know every shortcut and every cop\u2019s favourite corner."',
      'La Voz: "¡Ay, Porto Vela! Turn it up — the whole city is dancing and the precinct is just the percussion."',
    ] },
  { name: 'STATIC — radio off', dj: '', bpm: 0, root: 0, scale: [], lines: [] },
];

export const STORY_INTRO =
  'Porto Vela, 2026. You are Dante Reyes, a getaway driver fresh out of the county lockup. ' +
  'Mara Voss runs the port; Det. Rook runs the precinct — both want you working for them, and you owe them both. ' +
  'Eight jobs stand between you and the yacht La Sirena at the marina — from a stolen sedan on Marlin Row ' +
  'to a four-star manhunt at dusk. Porto Vela was a fishing town until the container port doubled it in a decade, ' +
  'and the precinct rents its blind eye by the hour.';
