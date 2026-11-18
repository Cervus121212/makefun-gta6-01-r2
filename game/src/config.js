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

// 8 story missions. Steps: goto | pickup | kill | chase | survive | deliver | escape
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Mara Voss', reward: 500,
    brief: 'Mara needs wheels. Steal any car on the street and bring it to the garage on Marlin Row.',
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', at: [150, -138], r: 8, text: 'Drive the car to the garage on Marlin Row' },
    ],
  },
  {
    id: 2, name: 'The Pickup', giver: 'Mara Voss', reward: 900,
    brief: 'A package is waiting at the docks. Collect it and deliver it to the safehouse — no police attention.',
    steps: [
      { type: 'goto', at: [264, 60], r: 8, text: 'Go to the docks pickup point' },
      { type: 'pickup', text: 'Pick up the package (press E)' },
      { type: 'goto', at: [-60, -180], r: 8, text: 'Deliver the package to the safehouse' },
    ],
  },
  {
    id: 3, name: 'Hot Pursuit', giver: 'Det. Rook (off the books)', reward: 1200,
    brief: 'Rook tipped off the precinct. You are about to be made — lose a 2-star wanted level and get clean.',
    steps: [
      { type: 'wanted', stars: 2, text: 'The police are onto you — 2 stars!' },
      { type: 'escape', text: 'Lose the cops: break line of sight and stay hidden until the stars fade' },
    ],
  },
  {
    id: 4, name: 'Dockside Deal', giver: 'Mara Voss', reward: 2000,
    brief: 'A rival crew is moving product through the east docks. Clear them out and take the cash.',
    steps: [
      { type: 'goto', at: [264, 120], r: 10, text: 'Go to the east docks' },
      { type: 'kill', count: 4, at: [264, 120], text: 'Take out the rival crew (4 left)' },
      { type: 'pickup', text: 'Grab the cash (press E)' },
    ],
  },
  {
    id: 5, name: 'Getaway Driver', giver: 'Mara Voss', reward: 1800,
    brief: 'A client needs a fast, quiet ride from the marina to the north gate. 90 seconds. No scratches on the story.',
    steps: [
      { type: 'goto', at: [60, 232], r: 8, text: 'Pick up the client at the marina' },
      { type: 'deliver', at: [-150, -232], r: 9, time: 90, text: 'Drive the client to the north gate — 90 seconds!' },
    ],
  },
  {
    id: 6, name: 'The Informant', giver: 'Det. Rook', reward: 2400,
    brief: 'An informant is running in a green sedan. Chase him down and ram his car until it stops.',
    steps: [
      { type: 'chase', text: 'Chase the green sedan and ram it until it stalls' },
    ],
  },
  {
    id: 7, name: 'Beachfront Heist', giver: 'Mara Voss', reward: 3500,
    brief: 'A cash van is parked by the beachfront. Steal it and bring it to the safehouse — the whole precinct will chase you.',
    steps: [
      { type: 'goto', at: [-180, 232], r: 9, text: 'Reach the cash van on the beachfront' },
      { type: 'steal', van: true, text: 'Steal the cash van (press E)' },
      { type: 'goto', at: [-60, -180], r: 9, text: 'Bring the van to the safehouse — 3 stars on you!' },
    ],
  },
  {
    id: 8, name: 'King of Vela', giver: 'Mara Voss', reward: 6000,
    brief: 'The finale. Survive a 4-star manhunt for 60 seconds, then reach the yacht at the marina and sail out a legend.',
    steps: [
      { type: 'wanted', stars: 4, text: '4 stars! Survive the manhunt — 60 seconds' },
      { type: 'survive', time: 60, text: 'Stay alive and stay free for 60 seconds' },
      { type: 'goto', at: [60, 232], r: 9, text: 'Reach the yacht at the marina' },
    ],
  },
];

export const RADIO = [
  { name: 'VELA FM — synthwave', bpm: 112, root: 55, scale: [0, 3, 5, 7, 10] },
  { name: 'COSTA 88 — latin drive', bpm: 132, root: 65.41, scale: [0, 2, 4, 7, 9] },
  { name: 'STATIC — radio off', bpm: 0, root: 0, scale: [] },
];

export const STORY_INTRO =
  'Porto Vela, 2026. You are Dante Reyes, a getaway driver fresh out of the county lockup. ' +
  'Mara Voss runs the port; Det. Rook runs the precinct — both want you working for them. ' +
  'Eight jobs stand between you and the yacht at the marina.';
