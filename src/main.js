import { Game } from './game.js';

const game = new Game({
  canvas: document.getElementById('view'),
  ui: document.getElementById('ui'),
  params: new URLSearchParams(location.search),
});
window.game = game; // 콘솔과 자동 검사에서 상태를 읽을 수 있게 한다
game.run();
