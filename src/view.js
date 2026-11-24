// 시뮬레이션 상태를 읽어 그리기만 한다. 규칙에는 관여하지 않는다. 모든 형상은 코드로 만든 도형이다.
import * as THREE from 'three';
import { ARENA_RADIUS, P, B } from './sim/rules.js';

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15, ...o });
function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent?.add(m);
  return m;
}

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#5b5a63'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) { // 돌 표면의 얼룩
    const v = 70 + Math.random() * 50 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 10},0.25)`;
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 4 + Math.random() * 22, 4 + Math.random() * 22);
  }
  g.strokeStyle = 'rgba(20,20,28,0.7)'; g.lineWidth = 5;
  for (const r of [120, 250, 380, 500]) { g.beginPath(); g.arc(512, 512, r, 0, 7); g.stroke(); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath(); g.moveTo(512 + Math.cos(a) * 120, 512 + Math.sin(a) * 120); g.lineTo(512 + Math.cos(a) * 500, 512 + Math.sin(a) * 500); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildArena(scene) {
  mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 1, ARENA_RADIUS + 2.5, 3, 64), [mat(0x3a3942), mat(0xffffff, { map: groundTexture() }), mat(0x3a3942)], 0, -1.5, 0, scene);
  const fires = [];
  for (let i = 0; i < 12; i++) { // 가장자리의 선돌과 화톳불
    const a = (i / 12) * Math.PI * 2, r = ARENA_RADIUS + 0.4, x = Math.sin(a) * r, z = Math.cos(a) * r;
    const h = 3 + (i * 37 % 5) * 0.7;
    const stone = mesh(new THREE.BoxGeometry(1.1, h, 0.8), mat(0x45444e), x, h / 2, z, scene);
    stone.rotation.y = a + (i % 3) * 0.2; stone.rotation.z = ((i % 4) - 1.5) * 0.04;
    if (i % 3 === 0) {
      const fire = mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb35c }), x * 0.93, 1.5, z * 0.93, scene);
      fire.castShadow = false;
      mesh(new THREE.CylinderGeometry(0.4, 0.15, 1.3, 8), mat(0x25242b), x * 0.93, 0.65, z * 0.93, scene);
      const light = new THREE.PointLight(0xff9a4a, 26, 20, 1.8); light.position.set(x * 0.93, 2, z * 0.93); scene.add(light);
      fires.push({ fire, light });
    }
  }
  for (let i = 0; i < 26; i++) { // 먼 산등성이
    const a = (i / 26) * Math.PI * 2, r = 60 + (i * 53 % 17), h = 16 + (i * 29 % 23);
    const peak = mesh(new THREE.ConeGeometry(14 + (i % 5) * 3, h, 5), new THREE.MeshBasicMaterial({ color: 0x1b2033 }), Math.sin(a) * r, h / 2 - 9, Math.cos(a) * r, scene);
    peak.castShadow = peak.receiveShadow = false; peak.rotation.y = i;
  }
  const moon = mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: 0xf2e6c8, fog: false }), -40, 38, -90, scene);
  moon.castShadow = false; moon.lookAt(0, 0, 0);
  return fires;
}

function buildPlayer() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cloth = mat(0x2f5d7c), steel = mat(0xc9ccd4, { metalness: 0.7, roughness: 0.35 });
  mesh(new THREE.CapsuleGeometry(0.27, 0.62, 6, 12), cloth, 0, 0.95, 0, body);
  mesh(new THREE.SphereGeometry(0.2, 14, 10), steel, 0, 1.62, 0, body);
  mesh(new THREE.BoxGeometry(0.06, 0.34, 0.26), mat(0xb5402f), 0, 1.85, -0.04, body); // 투구 깃
  mesh(new THREE.BoxGeometry(0.62, 0.16, 0.34), steel, 0, 1.33, 0, body);
  const shield = new THREE.Group(); shield.position.set(-0.36, 1.1, 0.12); body.add(shield);
  const disc = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 20), mat(0x8a5a2b), 0, 0, 0, shield); disc.rotation.x = Math.PI / 2;
  const bossPart = mesh(new THREE.SphereGeometry(0.11, 10, 8), steel, 0, 0, 0.05, shield);
  const sword = new THREE.Group(); sword.position.set(0.36, 1.2, 0.05); body.add(sword);
  mesh(new THREE.BoxGeometry(0.07, 0.95, 0.025), steel, 0, 0.6, 0, sword);
  mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), mat(0x6b5a34), 0, 0.12, 0, sword);
  return { root, body, shield, sword, cloth, bossPart };
}

function buildBoss() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const iron = mat(0x4a3f3a, { metalness: 0.55, roughness: 0.55 }), dark = mat(0x23201f, { metalness: 0.4 });
  const core = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x6fd0ff, emissiveIntensity: 2 });
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.42, 1.25, 0.46), dark, sx * 0.36, 0.62, 0, body);
    mesh(new THREE.BoxGeometry(0.7, 0.36, 0.8), iron, sx * 0.86, 2.55, 0, body); // 어깨 갑주
    mesh(new THREE.BoxGeometry(0.3, 1.2, 0.34), dark, sx * 0.88, 1.75, 0.05, body);
  }
  mesh(new THREE.BoxGeometry(1.3, 1.35, 0.8), iron, 0, 1.95, 0, body);
  mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06), core, 0, 2.05, 0.41, body);
  mesh(new THREE.BoxGeometry(0.5, 0.52, 0.5), iron, 0, 2.95, 0.02, body);
  mesh(new THREE.BoxGeometry(0.34, 0.07, 0.04), core, 0, 2.98, 0.27, body); // 눈구멍
  for (const sx of [-1, 1]) { const horn = mesh(new THREE.ConeGeometry(0.09, 0.7, 6), dark, sx * 0.3, 3.4, 0, body); horn.rotation.z = -sx * 0.5; }
  const glow = new THREE.PointLight(0x6fd0ff, 6, 8, 2); glow.position.set(0, 2.1, 0.9); body.add(glow);
  const weapon = new THREE.Group(); weapon.position.set(0.95, 2.2, 0.2); body.add(weapon);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8), dark, 0, 0.9, 0, weapon);
  const blade = mesh(new THREE.BoxGeometry(0.07, 1.1, 0.75), mat(0xbfc3cc, { metalness: 0.8, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0 }), 0, 2.4, 0.3, weapon);
  return { root, body, weapon, blade, core, glow };
}

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x232a45);
    this.scene.fog = new THREE.Fog(0x232a45, 24, 95);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);
    this.scene.add(new THREE.HemisphereLight(0x8fa3d8, 0x2a2420, 1.1));
    const moonlight = new THREE.DirectionalLight(0xcfd8ff, 2.2);
    moonlight.position.set(-14, 22, -18); moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(2048, 2048);
    Object.assign(moonlight.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    this.scene.add(moonlight);
    this.fires = buildArena(this.scene);
    this.player = buildPlayer(); this.boss = buildBoss();
    this.scene.add(this.player.root, this.boss.root);
    this.zone = new THREE.Group(); this.scene.add(this.zone); // 보스 공격 범위 예고
    this.zoneMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, depthWrite: false }));
    this.zoneMesh.rotation.x = -Math.PI / 2; this.zoneMesh.position.y = 0.03; this.zone.add(this.zoneMesh);
    this.zonePart = null;
    this.shake = 0;
    this.camPos = new THREE.Vector3(0, 6, 16); this.camAim = new THREE.Vector3(0, 1.5, 0);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  draw(sim, state, time) {
    this.#player(sim.player, time);
    this.#boss(sim.boss, sim, time);
    this.#zone(sim);
    this.#camera(sim, state, time);
    for (const [i, f] of this.fires.entries()) { const k = 1 + 0.18 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i); f.light.intensity = 26 * k; f.fire.scale.setScalar(k); }
    this.renderer.render(this.scene, this.camera);
  }

  #player(p, time) {
    const m = this.player;
    m.root.position.set(p.x, 0, p.z); m.root.rotation.y = p.face;
    const b = m.body; b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
    let swing = 0.5, side = 0, shieldZ = 0.12, shieldX = -0.36;
    if (p.state === 'attack') {
      const a = p.attack, heavy = a === P.heavy;
      const raised = heavy ? -2.3 : -1.3, down = heavy ? 2.1 : 1.8;
      if (p.t < a.windup) swing = lerp(0.5, raised, p.t / a.windup);
      else if (p.t < a.windup + a.active) swing = lerp(raised, down, (p.t - a.windup) / a.active);
      else swing = lerp(down, 0.5, (p.t - a.windup - a.active) / a.recover);
      side = heavy ? 0 : [0.5, -0.5, 0][P.light.indexOf(a)];
      b.rotation.x = 0.12;
    } else if (p.state === 'roll') {
      b.position.y = 0.45; b.rotation.x = (p.t / P.roll.time) * Math.PI * 2;
      const s = 0.7; b.scale.setScalar(s);
    } else if (p.state === 'stun') { b.rotation.x = -0.35; }
    else if (p.state === 'dead') { const k = Math.min(1, p.t / 0.6); b.rotation.x = -Math.PI / 2 * k; b.position.y = 0.3 * k; b.position.z = -0.6 * k; }
    else if (p.state === 'heal') { swing = -0.4; }
    else if (p.state === 'free') { b.position.y = Math.sin(time * 2.4) * 0.015; }
    if (p.state !== 'roll') b.scale.setScalar(1);
    if (p.blocking) { shieldZ = 0.5; shieldX = -0.1; swing = 0.9; }
    m.shield.position.set(shieldX, 1.1 + (p.blocking ? 0.15 : 0), shieldZ);
    m.sword.rotation.set(swing, 0, side);
    m.bossPart.material.emissive.setHex(p.blocking && p.blockAge <= P.parry.window ? 0xffe9a8 : 0);
    m.cloth.emissive.setHex(p.state === 'heal' ? 0x2f8f4a : p.invuln > 0 && p.state !== 'stun' ? 0x333333 : 0);
  }

  #boss(bs, sim, time) {
    const m = this.boss;
    m.root.position.set(bs.x, 0, bs.z); m.root.rotation.y = bs.face;
    const b = m.body; b.rotation.set(0, 0, 0); b.position.set(0, 0, 0); b.scale.setScalar(1);
    let rx = 0.35, ry = 0, glint = 0;
    if (bs.state === 'attack') {
      const part = bs.move.parts[bs.partIdx], t = bs.t, sweep = !part.ring && part.arc > 1;
      const w = Math.min(1, t / part.windup), a = (t - part.windup) / part.active, r = (t - part.windup - part.active) / part.recover;
      if (sweep) { // 가로로 크게 휘두른다
        rx = 1.45; ry = t < part.windup ? lerp(0, -1.9, w) : a < 1 ? lerp(-1.9, 1.9, a) : lerp(1.9, 0, r);
        if (t >= part.windup) rx = lerp(1.45, 0.35, r);
      } else { // 들어 올렸다가 내려찍는다
        const top = part.ring ? -2.7 : -2.1;
        rx = t < part.windup ? lerp(0.35, top, w * 1.4) : a < 1 ? lerp(top, 1.75, a) : lerp(1.75, 0.35, r);
        b.rotation.x = t < part.windup ? -0.12 * w : a < 1 ? 0.25 : lerp(0.25, 0, r);
      }
      const left = part.windup - t;
      if (left > 0 && left < 0.22) glint = part.parryable ? 1 : 0.4; // 판정 직전의 번쩍임: 패링·회피 신호
    } else if (bs.state === 'downed') { b.position.y = -0.55; b.rotation.x = 0.45; rx = 1.6; }
    else if (bs.state === 'recoil') { b.rotation.x = -0.3; rx = -1.2; ry = 0.8; }
    else if (bs.state === 'roar') { rx = -2.6; b.scale.setScalar(1 + 0.05 * Math.sin(bs.t * 30)); }
    else if (bs.state === 'dead') { const k = Math.min(1, bs.t / 1.2); b.rotation.x = Math.PI / 2 * k; b.position.y = 0.4 * k; rx = 1.6; }
    else { b.position.y = Math.sin(time * 1.6) * 0.03; }
    m.weapon.rotation.set(rx, ry, 0);
    m.blade.material.emissiveIntensity = glint * 2.5;
    m.blade.material.emissive.setHex(glint === 1 ? 0xffe9a8 : 0xff4a3c);
    const hot = bs.phase === 2 || bs.state === 'roar', color = bs.state === 'dead' ? 0x000000 : hot ? 0xff5a1f : 0x6fd0ff;
    m.core.emissive.setHex(color); m.glow.color.setHex(color);
    m.glow.intensity = bs.state === 'dead' ? 0 : hot ? 14 + 4 * Math.sin(time * 12) : 6;
  }

  #zone(sim) {
    const th = sim.threat(), z = this.zoneMesh;
    z.visible = !!th && th.timeToActive > 0;
    if (!z.visible) { this.zonePart = null; return; }
    const { part } = th, b = sim.boss;
    if (this.zonePart !== part) {
      this.zonePart = part; z.geometry.dispose();
      z.geometry = part.ring ? new THREE.CircleGeometry(part.range, 48)
        : new THREE.CircleGeometry(part.range, 32, -Math.PI / 2 - part.arc, part.arc * 2);
    }
    this.zone.position.set(b.x, 0, b.z); this.zone.rotation.y = b.face;
    z.material.color.setHex(part.unblockable ? 0xc04cff : 0xff5a3c);
    z.material.opacity = lerp(0.08, 0.42, 1 - th.timeToActive / part.windup);
  }

  #camera(sim, state, time) {
    const { player: p, boss: b } = sim, pos = new THREE.Vector3(), aim = new THREE.Vector3();
    if (state === 'title') { // 경기장을 천천히 도는 화면
      pos.set(Math.sin(time * 0.12) * 19, 6.5, Math.cos(time * 0.12) * 19); aim.set(0, 1.8, 0);
    } else {
      const d = Math.hypot(b.x - p.x, b.z - p.z) || 1, fx = (b.x - p.x) / d, fz = (b.z - p.z) / d;
      const back = 5.2 + Math.min(3, d * 0.25);
      pos.set(p.x - fx * back + fz * 1.1, 3 + d * 0.12, p.z - fz * back - fx * 1.1);
      aim.set(p.x + fx * d * 0.6, 1.5, p.z + fz * d * 0.6);
    }
    const k = state === 'title' ? 1 : 0.12;
    this.camPos.lerp(pos, k); this.camAim.lerp(aim, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.01) { this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; this.shake *= 0.85; }
    this.camera.lookAt(this.camAim);
  }
}
