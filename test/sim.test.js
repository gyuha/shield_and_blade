import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim, NO_INPUT } from '../src/sim/sim.js';
import { DT, P, B, MOVES } from '../src/sim/rules.js';
import { bots, runBot } from '../src/sim/bot.js';

const steps = (sec) => Math.round(sec / DT);
const run = (sim, sec, input = NO_INPUT) => { for (let i = 0; i < steps(sec); i++) sim.step(input); };
const press = (sim, key) => sim.step({ ...NO_INPUT, [key]: true });
const move = (name) => MOVES.find((m) => m.name === name);

/** 보스가 지정한 기술을 지금 막 시작한 상태로 만든다. 플레이어는 보스 정면 dist 거리. */
function setup(moveName, dist = 2.5) {
  const sim = new Sim({ seed: 7 });
  const { boss: b, player: p } = sim;
  b.x = 0; b.z = 0; b.face = 0; p.x = 0; p.z = dist;
  b.state = 'attack'; b.move = move(moveName); b.partIdx = 0; b.t = 0; b.hitDone = false;
  return sim;
}
const runUntilActive = (sim, lead = 0) => { while (sim.threat() && sim.threat().timeToActive > lead + 1e-9) sim.step(NO_INPUT); };

test('스태미나: 구르기는 비용을 쓰고, 지연 뒤에 회복된다', () => {
  const sim = new Sim(); sim.boss.rest = 99; sim.boss.x = 50; // 보스는 멀리서 쉰다
  press(sim, 'dodge');
  assert.equal(sim.player.state, 'roll');
  assert.equal(sim.player.stamina, P.stamina - P.roll.cost);
  run(sim, P.roll.time + P.regenDelay - 0.1);
  assert.equal(sim.player.stamina, P.stamina - P.roll.cost, '지연 중에는 회복 없음');
  run(sim, 1);
  assert.equal(sim.player.stamina, P.stamina);
});

test('회피: 무적 시간 안의 공격은 빗나가고, 너무 일찍 구르면 맞는다', () => {
  const dodged = setup('stomp');
  runUntilActive(dodged, 0.1);
  press(dodged, 'dodge');
  run(dodged, 0.5);
  assert.equal(dodged.player.hp, P.hp);

  const early = setup('stomp');
  runUntilActive(early, 0.6);
  early.step({ ...NO_INPUT, dodge: true, moveX: 1 }); // 옆으로 굴러 범위 안에 남는다
  run(early, 1);
  assert.equal(early.player.hp, P.hp - move('stomp').parts[0].dmg);
});

test('방어: 정면 방어는 체력 대신 스태미나를 깎는다', () => {
  const sim = setup('sweep');
  const hold = { ...NO_INPUT, block: true };
  run(sim, 1.2, hold);
  assert.equal(sim.player.hp, P.hp);
  assert.ok(sim.player.stamina < P.stamina);
  assert.equal(sim.boss.state, 'attack', '패링이 아니므로 보스는 튕겨나지 않는다');
});

test('방어: 스태미나가 바닥나면 가드 브레이크로 경직된다', () => {
  const sim = setup('overhead');
  sim.player.stamina = 5;
  let broke = false;
  for (let i = 0; i < steps(1.4); i++) { sim.step({ ...NO_INPUT, block: true }); broke ||= sim.events.includes('guardbreak'); }
  assert.ok(broke);
  assert.equal(sim.player.hp, P.hp);
});

test('방어 불가 공격은 방어를 뚫는다', () => {
  const sim = setup('crush');
  run(sim, 1.6, { ...NO_INPUT, block: true });
  assert.equal(sim.player.hp, P.hp - move('crush').parts[0].dmg);
});

test('패링: 판정 직전에 방패를 올리면 피해 0, 보스는 튕겨나고 체간이 깎인다', () => {
  const sim = setup('sweep');
  runUntilActive(sim, 0.05);
  const stamina = sim.player.stamina;
  run(sim, 0.2, { ...NO_INPUT, block: true });
  assert.equal(sim.player.hp, P.hp);
  assert.equal(sim.player.stamina, stamina, '패링은 스태미나를 쓰지 않는다');
  assert.equal(sim.boss.state, 'recoil');
  assert.ok(sim.boss.poise <= B.poise - P.parry.poise + 1);
});

test('패링: 방패를 계속 들고 있으면 패링이 아니라 방어다', () => {
  const sim = setup('sweep');
  run(sim, 1, { ...NO_INPUT, block: true });
  assert.notEqual(sim.boss.state, 'recoil');
});

test('체간 붕괴: 무방비가 되고 추가 피해를 받는다', () => {
  const sim = new Sim(); const { boss: b, player: p } = sim;
  b.x = 0; b.z = 0; p.x = 0; p.z = 2; b.rest = 99; b.poise = 5;
  press(sim, 'light'); run(sim, 0.4);
  assert.equal(b.state, 'downed');
  const hp = b.hp;
  press(sim, 'light'); run(sim, 0.4);
  assert.ok(Math.abs(hp - b.hp - P.light[0].dmg * B.downDmg) < 1e-9);
  while (b.state === 'downed') sim.step(NO_INPUT);
  assert.ok(sim.time > B.downTime && sim.time < B.downTime + 0.5, `정해진 시간 뒤에 일어난다 (t=${sim.time})`);
  assert.equal(b.poise, B.poise);
});

test('약공격 콤보: 연속 입력은 3타까지 이어진다', () => {
  const sim = new Sim(); const { boss: b, player: p } = sim;
  b.x = 0; b.z = 0; p.x = 0; p.z = 2; b.rest = 99; b.poiseImmune = 99;
  run(sim, 1.6, { ...NO_INPUT, light: true });
  const total = P.light.reduce((s, a) => s + a.dmg, 0);
  assert.ok(B.hp - b.hp >= total, `3타 합계 ${total} 이상`);
});

test('페이즈 전환: 체력 50%에서 포효(무적) 후 2페이즈, 전용 기술을 쓴다', () => {
  const sim = new Sim({ seed: 3 }); const { boss: b, player: p } = sim;
  b.x = 0; b.z = 0; p.x = 0; p.z = 2; b.rest = 99; b.hp = B.hp / 2 + 5;
  press(sim, 'light'); run(sim, 0.4);
  assert.equal(b.state, 'roar');
  const hp = b.hp;
  press(sim, 'light'); run(sim, 0.5);
  assert.equal(b.hp, hp, '포효 중 무적');
  run(sim, B.roar);
  assert.equal(b.phase, 2);
  p.invuln = 1e9; // 관찰만 한다
  const seen = new Set();
  for (let i = 0; i < steps(90); i++) { sim.step(NO_INPUT); if (b.move) seen.add(b.move.name); }
  assert.ok(seen.has('triple') || seen.has('crush'), [...seen].join(','));
});

test('1페이즈에서는 2페이즈 기술을 쓰지 않는다', () => {
  const sim = new Sim({ seed: 5 }); sim.player.invuln = 1e9;
  for (let i = 0; i < steps(60); i++) { sim.step(NO_INPUT); if (sim.boss.move) assert.equal(sim.boss.move.phase, 1); }
});

test('승리와 사망 판정', () => {
  const win = new Sim(); win.boss.x = 0; win.boss.z = 0; win.player.z = 2; win.boss.rest = 99; win.boss.phase = 2; win.boss.hp = 1;
  press(win, 'light'); run(win, 0.4);
  assert.equal(win.state, 'victory');
  const lose = setup('overhead'); lose.player.hp = 1;
  run(lose, 1.5);
  assert.equal(lose.state, 'dead');
});

test('회복: 병을 쓰면 체력이 오르고 횟수가 준다', () => {
  const sim = new Sim(); sim.boss.rest = 99; sim.boss.x = 50; sim.player.hp = 40;
  press(sim, 'heal'); run(sim, 1);
  assert.equal(sim.player.hp, 40 + P.heal.amount);
  assert.equal(sim.player.flasks, P.heal.flasks - 1);
});

test('결정론: 같은 시드와 같은 입력은 같은 결과', () => {
  const play = () => { const s = new Sim({ seed: 11 }); runBot(s, bots.skilled, 40); return JSON.stringify([s.player, s.boss, s.time]); };
  assert.equal(play(), play());
});

test('무입력은 죽는다', () => {
  for (const seed of [1, 2, 3]) assert.equal(runBot(new Sim({ seed }), bots.idle), 'dead');
});

test('공격만 연타하는 봇은 진다', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(runBot(new Sim({ seed }), bots.masher), 'dead', `seed ${seed}`);
});

test('숙련 봇은 여러 시드에서 이긴다', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const sim = new Sim({ seed });
    assert.equal(runBot(sim, bots.skilled), 'victory', `seed ${seed} t=${sim.time.toFixed(1)} bossHp=${sim.boss.hp}`);
  }
});
