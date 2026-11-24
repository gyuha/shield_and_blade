// 시뮬레이션 상태를 읽고 "입력"만 돌려주는 자동 조종. 상태를 직접 바꾸지 않는다.
import { P, B } from './rules.js';
import { NO_INPUT } from './sim.js';

export const bots = {
  /** 아무것도 하지 않는다. */
  idle: () => NO_INPUT,

  /** 보스에게 다가가 약공격만 연타한다. 회피도 방어도 없다. */
  masher(sim) {
    const { player: p, boss: b } = sim;
    const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz) || 1;
    const far = d > 2.2;
    return { ...NO_INPUT, moveX: far ? dx / d : 0, moveZ: far ? dz / d : 0, light: true };
  },

  /** 판정 직전에 패링하거나 구르고, 안전한 틈에만 때리고, 위험하면 회복한다. */
  skilled(sim) {
    const { player: p, boss: b } = sim;
    const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz) || 1;
    const out = { ...NO_INPUT };
    const th = sim.threat();
    const safe = sim.safeTime();
    if (th) {
      const reach = th.part.range + th.lungeLeft + P.radius + 0.6;
      const t = th.timeToActive;
      if (d <= reach && t <= 0.1) {
        // 패링할 수 있으면 방패를 판정 직전에 올리고, 아니면 구른다
        if (th.part.parryable && p.state === 'free' && p.parryLock <= 0) { out.block = t <= 0.06; return out; }
        if (p.blocking) { out.block = true; return out; }
        if (p.state !== 'roll') { out.dodge = true; out.moveX = -dz / d; out.moveZ = dx / d; }
        return out;
      }
    }
    if (p.hp <= P.hp - P.heal.amount && p.flasks > 0 && safe >= P.heal.time + 0.1) { out.heal = true; return out; }
    const inReach = d <= P.reach + B.radius - 0.3;
    if (!inReach) { out.moveX = dx / d; out.moveZ = dz / d; }
    if (inReach && p.stamina >= 35 && b.state !== 'roar') {
      if (safe >= 1.25 && (b.state === 'downed' || b.state === 'recoil')) out.heavy = true;
      else if (safe >= 0.75) out.light = true;
    }
    return out;
  },
};

/** 봇으로 한 판을 끝까지(또는 maxTime 초까지) 돌린다. */
export function runBot(sim, bot, maxTime = 300) {
  while (sim.state === 'fight' && sim.time < maxTime) sim.step(bot(sim));
  return sim.state;
}
