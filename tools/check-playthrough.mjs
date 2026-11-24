// 실제 페이지에서 한 판이 끝까지 진행되는지 확인한다: 승리, 사망, 그리고 재도전.
// 봇은 입력 계층에 입력만 넣고, 이 스크립트는 상태를 읽기만 한다(시작·재시작은 실제 Enter 키).
import { openGame, check } from './browser.mjs';

const read = (page) => page.evaluate(() => ({
  state: game.state, time: game.sim.time, hp: game.sim.player.hp, bossHp: game.sim.boss.hp, phase: game.sim.boss.phase,
  card: document.querySelector('#card h1').textContent, cardShown: !document.querySelector('#card').classList.contains('hidden'),
}));

async function play(auto, endState) {
  const { page, errors, close } = await openGame(`?auto=${auto}&speed=20&seed=1`);
  await page.keyboard.press('Enter');
  await page.waitForFunction((s) => game.state === s, endState, { timeout: 90000 }).catch(() => {});
  return { page, errors, close, end: await read(page) };
}

const win = await play('skilled', 'victory');
try {
  const e = win.end;
  check('숙련 봇이 승리 화면에 도달', e.state === 'victory' && e.cardShown, JSON.stringify(e));
  check('보스 체력 0, 2페이즈를 거침', e.bossHp === 0 && e.phase === 2);
  check('한 판이 실제로 진행됨(20초 이상)', e.time > 20, `결투 시간 ${e.time.toFixed(1)}초`);
  check('승리 판 콘솔 에러 0건', win.errors.length === 0, win.errors.join(' | '));
} finally { await win.close(); }

const lose = await play('idle', 'dead');
try {
  const e = lose.end;
  check('무입력은 사망 화면에 도달', e.state === 'dead' && e.cardShown && e.hp === 0, JSON.stringify(e));
  await lose.page.keyboard.press('Enter');
  await lose.page.waitForFunction(() => game.state === 'fight' && game.sim.time > 0, null, { timeout: 10000 }).catch(() => {});
  const again = await read(lose.page);
  check('사망 후 Enter로 새 결투가 시작됨', again.state === 'fight' && again.time < e.time && again.bossHp > 0 && !again.cardShown, JSON.stringify(again));
  check('사망 판 콘솔 에러 0건', lose.errors.length === 0, lose.errors.join(' | '));
} finally { await lose.close(); }
