// 검사 스크립트 공용: 정적 서버 + 헤드리스 Chrome으로 게임 페이지를 열고 오류를 모은다.
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';

export async function openGame(query = '') {
  const { server, url } = await serve();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(url + query);
  await page.waitForFunction(() => window.game?.ready, null, { timeout: 15000 });
  const close = async () => { await browser.close(); server.close(); };
  return { page, errors, close };
}

/** 지금 프레임을 다시 그려 캔버스 픽셀을 160×90 RGBA 배열로 읽는다. */
export const readPixels = (page) => page.evaluate(() => {
  window.game.render();
  const c = document.createElement('canvas'); c.width = 160; c.height = 90;
  const g = c.getContext('2d'); g.drawImage(document.getElementById('view'), 0, 0, 160, 90);
  return Array.from(g.getImageData(0, 0, 160, 90).data);
});

export function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
}
