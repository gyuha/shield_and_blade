// 렌더·DOM과 무관한 결투 시뮬레이션. 같은 시드와 같은 입력 열은 항상 같은 결과를 낸다.
import { DT, ARENA_RADIUS, P, B, MOVES } from './rules.js';

export const NO_INPUT = Object.freeze({ moveX: 0, moveZ: 0, light: false, heavy: false, dodge: false, heal: false, block: false });

function rng(seed) { // mulberry32
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function turnToward(cur, target, max) {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return cur + Math.max(-max, Math.min(max, d));
}
function clampToArena(e, radius) {
  const d = Math.hypot(e.x, e.z), max = ARENA_RADIUS - radius;
  if (d > max) { e.x *= max / d; e.z *= max / d; }
}

export class Sim {
  constructor({ seed = 1 } = {}) {
    this.rand = rng(seed);
    this.time = 0;
    this.state = 'fight'; // 'fight' | 'victory' | 'dead'
    this.events = [];     // 이번 스텝에 일어난 일 (렌더·테스트용)
    this.player = {
      x: 0, z: 5, face: Math.PI, hp: P.hp, stamina: P.stamina, regenWait: 0, flasks: P.heal.flasks,
      state: 'free', t: 0, blocking: false, blockAge: 99, parryLock: 0, invuln: 0,
      attack: null, combo: 0, hitDone: false, healed: false, stunTime: 0, rollX: 0, rollZ: 0,
      buf: { light: 0, heavy: 0, dodge: 0, heal: 0 },
    };
    this.boss = {
      x: 0, z: -5, face: 0, hp: B.hp, poise: B.poise, poiseWait: 0, poiseImmune: 0, phase: 1,
      state: 'rest', t: 0, rest: 1, move: null, partIdx: 0, hitDone: false, lunged: 0,
      cooldowns: {}, lastMove: null,
    };
  }

  step(input = NO_INPUT) {
    if (this.state !== 'fight') return;
    this.events = [];
    this.#player(input);
    this.#boss();
    this.#separate();
    this.time += DT;
    if (this.boss.state === 'dead') this.state = 'victory';
    else if (this.player.state === 'dead') this.state = 'dead';
  }

  /** 보스가 지금 준비 중이거나 휘두르는 공격. 없으면 null. */
  threat() {
    const b = this.boss;
    if (b.state !== 'attack') return null;
    const part = b.move.parts[b.partIdx];
    if (b.t >= part.windup + part.active) return null;
    return { part, timeToActive: part.windup - b.t, lungeLeft: part.lunge - b.lunged };
  }

  /** 보스의 다음 공격 판정이 나올 수 있는 가장 이른 시간(초). */
  safeTime() {
    const b = this.boss;
    if (b.state === 'downed') return B.downTime - b.t + 0.4;
    if (b.state === 'recoil') return B.recoil - b.t + 0.7;
    if (b.state === 'roar') return B.roar - b.t + 0.8;
    if (b.state === 'rest') return b.rest + 0.4;
    if (b.state !== 'attack') return 99;
    const part = b.move.parts[b.partIdx], next = b.move.parts[b.partIdx + 1];
    if (b.t < part.windup + part.active) return Math.max(0, part.windup - b.t);
    const left = part.windup + part.active + part.recover - b.t;
    return left + (next ? next.windup : 0.9);
  }

  // ── 플레이어 ────────────────────────────────────────────────
  #spend(cost) {
    const p = this.player;
    p.stamina = Math.max(0, p.stamina - cost);
    p.regenWait = p.stamina === 0 ? P.exhaustDelay : P.regenDelay;
  }

  #player(input) {
    const p = this.player, b = this.boss;
    if (p.state === 'dead') return;
    for (const k of Object.keys(p.buf)) p.buf[k] = input[k] ? P.buffer : Math.max(0, p.buf[k] - DT);
    p.invuln = Math.max(0, p.invuln - DT);
    p.parryLock = Math.max(0, p.parryLock - DT);
    p.t += DT;
    if (p.state !== 'roll' && p.state !== 'stun') p.face = angleTo(p, b);

    const wasBlocking = p.blocking;
    p.blocking = p.state === 'free' && input.block && p.stamina > 0;
    if (p.blocking && !wasBlocking) p.blockAge = p.parryLock > 0 ? 99 : 0;
    else p.blockAge += DT;
    if (!p.blocking && wasBlocking) p.parryLock = P.parry.lock;

    let mx = input.moveX, mz = input.moveZ;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    if (p.state === 'free') {
      const sp = P.speed * (p.blocking ? P.blockSpeedFactor : 1);
      p.x += mx * sp * DT; p.z += mz * sp * DT;
      this.#tryAct(mx, mz, ml);
    } else if (p.state === 'attack') {
      const a = p.attack, hitAt = a.windup, hitEnd = a.windup + a.active;
      if (p.t < hitAt && dist(p, b) > 1.7) { p.x += Math.sin(p.face) * 2 * DT; p.z += Math.cos(p.face) * 2 * DT; }
      if (!p.hitDone && p.t >= hitAt && p.t < hitEnd
          && dist(p, b) <= P.reach + B.radius && angDiff(p.face, angleTo(p, b)) <= P.arc) {
        p.hitDone = true;
        this.#hurtBoss(a.dmg, a.poise);
      }
      if (p.t >= hitEnd) this.#tryAct(mx, mz, ml, true);
      if (p.state === 'attack' && p.t >= hitEnd + a.recover) { p.state = 'free'; p.combo = 0; }
    } else if (p.state === 'roll') {
      p.x += p.rollX * (P.roll.dist / P.roll.time) * DT; p.z += p.rollZ * (P.roll.dist / P.roll.time) * DT;
      if (p.t >= P.roll.time) p.state = 'free';
    } else if (p.state === 'heal') {
      p.x += mx * P.speed * 0.3 * DT; p.z += mz * P.speed * 0.3 * DT;
      if (!p.healed && p.t >= P.heal.at) { p.healed = true; p.hp = Math.min(P.hp, p.hp + P.heal.amount); this.events.push('heal'); }
      if (p.t >= P.heal.time) p.state = 'free';
    } else if (p.state === 'stun') {
      if (p.t >= p.stunTime) p.state = 'free';
    }

    if (p.state !== 'attack' && p.state !== 'roll') {
      if (p.regenWait > 0) p.regenWait -= DT;
      else p.stamina = Math.min(P.stamina, p.stamina + (p.blocking ? P.blockRegen : P.regen) * DT);
    }
    clampToArena(p, P.radius);
  }

  /** 버퍼에 남은 입력을 실행한다. 공격 후딜 중(fromAttack)에는 콤보와 회피만 허용. */
  #tryAct(mx, mz, ml, fromAttack = false) {
    const p = this.player;
    if (p.stamina <= 0) return;
    const start = (state) => { p.state = state; p.t = 0; p.blocking = false; };
    if (p.buf.dodge > 0) {
      p.buf.dodge = 0;
      if (ml > 0.1) { p.rollX = mx / ml; p.rollZ = mz / ml; }
      else { p.rollX = -Math.sin(p.face); p.rollZ = -Math.cos(p.face); }
      this.#spend(P.roll.cost); start('roll'); p.combo = 0;
      return;
    }
    if (fromAttack) {
      const isLight = P.light.includes(p.attack);
      if (isLight && p.buf.light > 0 && p.combo < P.light.length - 1) { p.combo++; this.#startAttack(P.light[p.combo], 'light'); }
      return;
    }
    if (p.buf.heal > 0 && p.flasks > 0 && p.hp < P.hp) {
      p.buf.heal = 0; p.flasks--; p.healed = false; start('heal');
    } else if (p.buf.heavy > 0) {
      this.#startAttack(P.heavy, 'heavy');
    } else if (p.buf.light > 0) {
      p.combo = 0; this.#startAttack(P.light[0], 'light');
    }
  }

  #startAttack(def, key) {
    const p = this.player;
    p.buf[key] = 0; p.attack = def; p.hitDone = false; p.state = 'attack'; p.t = 0; p.blocking = false;
    this.#spend(def.cost);
    this.events.push('swing');
  }

  /** 보스 공격 한 파트가 플레이어에게 닿았을 때. 반환: 'miss' | 'parry' | 'block' | 'hit' */
  #hurtPlayer(part) {
    const p = this.player, b = this.boss;
    if (p.state === 'dead' || p.invuln > 0 || (p.state === 'roll' && p.t < P.roll.iframes)) return 'miss';
    if (p.blocking && angDiff(p.face, angleTo(p, b)) <= P.block.arc) {
      if (part.parryable && p.blockAge <= P.parry.window) return 'parry';
      if (!part.unblockable) {
        this.#spend(part.dmg * P.block.staminaFactor);
        if (p.stamina === 0) { p.state = 'stun'; p.t = 0; p.stunTime = P.block.breakStun; p.blocking = false; this.events.push('guardbreak'); }
        return 'block';
      }
    }
    p.hp -= part.dmg;
    p.blocking = false; p.combo = 0;
    if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; return 'hit'; }
    p.state = 'stun'; p.t = 0;
    p.stunTime = part.dmg >= P.stun.heavyDmg ? P.stun.heavy : P.stun.light;
    p.invuln = P.stun.invuln;
    return 'hit';
  }

  // ── 보스 ────────────────────────────────────────────────────
  #hurtBoss(dmg, poise) {
    const b = this.boss;
    if (b.state === 'dead' || b.state === 'roar') return;
    b.hp -= dmg * (b.state === 'downed' ? B.downDmg : 1);
    this.events.push('bosshit');
    if (b.hp <= 0) { b.hp = 0; b.state = 'dead'; return; }
    if (b.phase === 1 && b.hp <= B.hp / 2) {
      b.state = 'roar'; b.t = 0; b.poise = B.poise; this.events.push('phase2');
      return;
    }
    this.#poiseHit(poise * (b.state === 'attack' ? B.attackPoiseFactor : 1));
  }

  #poiseHit(amount) {
    const b = this.boss;
    if (b.state === 'downed' || b.poiseImmune > 0) return;
    b.poise -= amount; b.poiseWait = B.poiseDelay;
    if (b.poise <= 0) { b.poise = 0; b.state = 'downed'; b.t = 0; this.events.push('poisebreak'); }
  }

  #boss() {
    const b = this.boss, p = this.player;
    if (b.state === 'dead') return;
    b.t += DT;
    for (const k of Object.keys(b.cooldowns)) b.cooldowns[k] -= DT;
    b.poiseImmune = Math.max(0, b.poiseImmune - DT);
    if (b.poiseWait > 0) b.poiseWait -= DT;
    else if (b.state !== 'downed') b.poise = Math.min(B.poise, b.poise + B.poiseRegen * DT);
    const speed = b.phase === 2 ? B.phase2Speed : B.speed;
    const toP = angleTo(b, p), d = dist(b, p);

    if (b.state === 'rest') {
      b.face = turnToward(b.face, toP, B.turn * DT);
      if (d > B.keepDist && p.state !== 'dead') { b.x += Math.sin(toP) * speed * DT; b.z += Math.cos(toP) * speed * DT; }
      b.rest -= DT;
      if (b.rest <= 0 && p.state !== 'dead') this.#chooseMove(d);
    } else if (b.state === 'attack') {
      const part = b.move.parts[b.partIdx];
      if (b.t < part.windup - 0.2) b.face = turnToward(b.face, toP, part.track * DT);
      if (part.lunge && b.t >= part.windup - 0.25 && b.t < part.windup && d > 1.8) {
        const stepLen = (part.lunge / 0.25) * DT;
        b.x += Math.sin(b.face) * stepLen; b.z += Math.cos(b.face) * stepLen; b.lunged += stepLen;
      }
      const end = part.windup + part.active;
      if (!b.hitDone && b.t >= part.windup && b.t < end
          && d <= part.range + P.radius && (part.ring || angDiff(b.face, toP) <= part.arc)) {
        const r = this.#hurtPlayer(part);
        if (r !== 'miss') { b.hitDone = true; this.events.push(r); }
        if (r === 'parry') {
          b.state = 'recoil'; b.t = 0;
          this.#poiseHit(P.parry.poise);
          return;
        }
      }
      if (b.t >= end + part.recover) {
        if (b.partIdx + 1 < b.move.parts.length) { b.partIdx++; b.t = 0; b.hitDone = false; b.lunged = 0; }
        else this.#rest(B.rest[0] + this.rand() * (B.rest[1] - B.rest[0]));
      }
    } else if (b.state === 'downed') {
      if (b.t >= B.downTime) { b.poise = B.poise; b.poiseImmune = B.downImmune; this.#rest(0.4); }
    } else if (b.state === 'recoil') {
      if (b.t >= B.recoil) this.#rest(0.3);
    } else if (b.state === 'roar') {
      if (b.t >= B.roar) { b.phase = 2; this.#rest(0.4); }
    }
    clampToArena(b, B.radius);
  }

  #rest(time) {
    const b = this.boss;
    b.state = 'rest'; b.t = 0; b.move = null;
    b.rest = time * (b.phase === 2 ? B.phase2Rest : 1);
  }

  #chooseMove(d) {
    const b = this.boss;
    const ok = MOVES.filter((m) => m.phase <= b.phase && d >= m.min && d <= m.max && !(b.cooldowns[m.name] > 0));
    if (!ok.length) { b.rest = 0.2; return; }
    const w = ok.map((m) => m.weight * (m.name === b.lastMove ? 0.2 : 1) * (m.phase === 2 ? 1.5 : 1));
    let r = this.rand() * w.reduce((s, x) => s + x, 0), i = 0;
    while (i < ok.length - 1 && (r -= w[i]) > 0) i++;
    const m = ok[i];
    b.state = 'attack'; b.move = m; b.partIdx = 0; b.t = 0; b.hitDone = false; b.lunged = 0;
    b.lastMove = m.name; b.cooldowns[m.name] = m.cooldown;
    this.events.push('telegraph');
  }

  #separate() {
    const p = this.player, b = this.boss;
    const d = dist(p, b), min = P.radius + B.radius;
    if (d < min && d > 1e-6 && b.state !== 'dead') {
      const k = (min - d) / d;
      p.x += (p.x - b.x) * k; p.z += (p.z - b.z) * k;
      clampToArena(p, P.radius);
    }
  }
}
