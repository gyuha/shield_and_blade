// 결투 규칙의 수치. 시뮬레이션은 이 값과 입력만으로 결정된다.
export const DT = 1 / 60;
export const ARENA_RADIUS = 13;

export const P = {
  hp: 120, radius: 0.4, speed: 4.2, blockSpeedFactor: 0.45,
  stamina: 100, regen: 40, blockRegen: 12, regenDelay: 0.7, exhaustDelay: 1.2,
  buffer: 0.3,
  roll: { cost: 20, time: 0.5, iframes: 0.32, dist: 3.4 },
  block: { arc: 1.3, staminaFactor: 0.7, breakStun: 1.0 },
  parry: { window: 0.15, lock: 0.3, poise: 45 },
  heal: { flasks: 3, amount: 50, time: 0.9, at: 0.55 },
  stun: { light: 0.4, heavy: 0.8, heavyDmg: 30, invuln: 0.45 },
  light: [
    { dmg: 14, poise: 10, cost: 12, windup: 0.22, active: 0.12, recover: 0.28 },
    { dmg: 14, poise: 10, cost: 12, windup: 0.2, active: 0.12, recover: 0.28 },
    { dmg: 20, poise: 16, cost: 15, windup: 0.26, active: 0.12, recover: 0.4 },
  ],
  heavy: { dmg: 32, poise: 30, cost: 26, windup: 0.55, active: 0.14, recover: 0.45 },
  reach: 2.4, arc: 1.0,
};

export const B = {
  hp: 700, radius: 0.9, speed: 2.6, turn: 3,
  poise: 100, poiseDelay: 2, poiseRegen: 10, attackPoiseFactor: 0.5,
  downTime: 3, downDmg: 1.3, downImmune: 8,
  recoil: 0.9, roar: 2,
  rest: [0.5, 1.2], phase2Rest: 0.7, phase2Speed: 3.2,
  keepDist: 2.6,
};

// 보스 기술: 파트마다 예비(windup) → 활성(active) → 후딜(recover).
// arc는 정면 기준 반각(rad), ring이면 전방위. lunge는 예비 끝에 전진하는 거리.
const part = (o) => ({ arc: 0.6, track: 2.5, lunge: 0, ring: false, parryable: true, unblockable: false, ...o });
export const MOVES = [
  { name: 'sweep', phase: 1, min: 0, max: 4, cooldown: 2, weight: 3,
    parts: [part({ windup: 0.7, active: 0.15, recover: 0.9, dmg: 22, range: 3.4, arc: 1.2 })] },
  { name: 'overhead', phase: 1, min: 0, max: 4.5, cooldown: 4, weight: 2,
    parts: [part({ windup: 1.1, active: 0.12, recover: 1.3, dmg: 38, range: 3.8, arc: 0.45, track: 4 })] },
  { name: 'lunge', phase: 1, min: 4, max: 10, cooldown: 5, weight: 3,
    parts: [part({ windup: 0.8, active: 0.15, recover: 1.1, dmg: 28, range: 3.2, lunge: 5 })] },
  { name: 'stomp', phase: 1, min: 0, max: 3, cooldown: 7, weight: 2,
    parts: [part({ windup: 0.9, active: 0.12, recover: 1.0, dmg: 26, range: 4.5, ring: true, parryable: false })] },
  { name: 'triple', phase: 2, min: 0, max: 4.5, cooldown: 6, weight: 3,
    parts: [
      part({ windup: 0.5, active: 0.12, recover: 0.15, dmg: 18, range: 3.4, arc: 1.2, lunge: 1 }),
      part({ windup: 0.4, active: 0.12, recover: 0.15, dmg: 18, range: 3.4, arc: 1.2, lunge: 1 }),
      part({ windup: 0.55, active: 0.14, recover: 1.2, dmg: 26, range: 3.6, arc: 1.2, lunge: 1 }),
    ] },
  { name: 'crush', phase: 2, min: 0, max: 8, cooldown: 9, weight: 2,
    parts: [part({ windup: 1.3, active: 0.14, recover: 1.6, dmg: 44, range: 5, ring: true, parryable: false, unblockable: true, lunge: 3 })] },
];
