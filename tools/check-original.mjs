// 독자성 검사: 참고한 게임의 이름이 저장소에 없고, 밖에서 가져온 그림·소리·모델 파일이 없는지 확인한다.
// (이 게임의 형상·질감은 전부 코드로 만든다. 따라서 에셋 파일은 0개여야 한다.)
import { readdir, readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.forge']);
const NAME = new RegExp(['even', 'song'].join(''), 'i'); // 이 파일 자신이 걸리지 않게 나눠 적는다
const ASSET = /\.(png|jpe?g|webp|gif|svg|ico|glb|gltf|fbx|obj|mp3|ogg|wav|m4a|ttf|otf|woff2?|ktx2|hdr|exr|bin)$/i;

export async function scan(dir, found = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const file = path.join(dir, e.name);
    if (e.isDirectory()) { await scan(file, found); continue; }
    if (NAME.test(e.name)) found.push(`이름: ${file}`);
    if (ASSET.test(e.name)) found.push(`에셋 파일: ${file}`);
    else if (NAME.test(await readFile(file, 'utf8'))) found.push(`내용: ${file}`);
  }
  return found;
}

// 양성 대조: 검사기가 정말 잡아내는지 먼저 증명한다
const tmp = await mkdtemp(path.join(os.tmpdir(), 'original-check-'));
await writeFile(path.join(tmp, 'a.js'), `// ${['Even', 'song'].join('')}`);
await writeFile(path.join(tmp, 'b.png'), '');
const control = await scan(tmp);
await rm(tmp, { recursive: true });
if (control.length !== 2) { console.log(`FAIL 양성 대조 — 2건을 잡아야 하는데 ${control.length}건`); process.exit(1); }
console.log('PASS 양성 대조 — 이름 1건, 에셋 1건 탐지');

const found = await scan(ROOT);
console.log(found.length ? `FAIL 독자성 — ${found.length}건\n${found.join('\n')}` : 'PASS 독자성 — 참고 대상의 이름 0건, 에셋 파일 0건');
process.exit(found.length ? 1 : 0);
