// 실제 페이지가 오류 없이 뜨고, 캔버스가 정말 그려지고, 결투가 시작되는지 확인한다.
import { openGame, readPixels, check } from './browser.mjs';

const { page, errors, close } = await openGame('?seed=1');
try {
  const title = await readPixels(page);
  const colors = new Set();
  for (let i = 0; i < title.length; i += 4) colors.add((title[i] >> 3) << 10 | (title[i + 1] >> 3) << 5 | (title[i + 2] >> 3));
  check('타이틀 상태', (await page.evaluate(() => game.state)) === 'title');
  check('캔버스가 단색이 아님', colors.size >= 16, `서로 다른 색 ${colors.size}개`);

  await page.keyboard.press('Enter'); // 실제 키 입력으로 시작
  await page.waitForFunction(() => game.state === 'fight' && game.sim.time > 1, null, { timeout: 10000 });
  const fight = await readPixels(page);
  let changed = 0;
  for (let i = 0; i < fight.length; i += 4) if (Math.abs(fight[i] - title[i]) + Math.abs(fight[i + 1] - title[i + 1]) + Math.abs(fight[i + 2] - title[i + 2]) > 48) changed++;
  const ratio = changed / (fight.length / 4);
  check('결투 시작 후 화면이 타이틀과 다름', ratio > 0.05, `달라진 픽셀 ${(ratio * 100).toFixed(1)}%`);
  check('시뮬레이션 시간이 흐름', (await page.evaluate(() => game.sim.time)) > 1);

  const before = await page.evaluate(() => game.sim.player.stamina);
  await page.keyboard.press('Space'); // 구르기 키가 시뮬레이션까지 전달되는지
  await page.waitForFunction((s) => game.sim.player.stamina < s, before, { timeout: 5000 }).catch(() => {});
  check('키 입력이 시뮬레이션에 반영됨', (await page.evaluate(() => game.sim.player.stamina)) < before);
  check('콘솔 에러·페이지 예외 0건', errors.length === 0, errors.join(' | '));
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
} finally { await close(); }
