// build.js — 총기 GLB 제작 페이지 (tools/guns/build.html)
//  · 목록에서 총을 고르면 미리보기 (기준점 표시) + GLB 내려받기
//  · run.cjs 가 이 페이지를 헤드리스로 열어 전부 만든 뒤 assets/models/guns/ 에 압축해 저장한다
import { THREE, materials, exportGLB, cleanMeta } from './kit.js';
import { DESIGNS } from './designs.js';
import { REAL, buildReal } from './real.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const IDS = ['ka47', 'sc17', 'mk14', 'kr98', 's12', 'm1014', 'db2', 'sa12', 'aa12', 'g18', 'm1911', 'de7', 'r45'];

async function build(id) {
  if (REAL[id]) return buildReal(id, './');
  const M = DESIGNS[id]();
  const r = M.build();
  const lib = materials(), mats = {};
  for (const m of r.meshes) mats[m.mat] = lib[m.mat];
  return { meshes: r.meshes, mats, meta: Object.assign({}, M.meta), tris: r.tris };
}
async function glb(id) {
  const b = await build(id);
  const meta = cleanMeta(Object.assign({ v: 1, id }, b.meta));
  return exportGLB(id, b.meshes, b.mats, meta);
}
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

/* ---------------- 미리보기 ---------------- */
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8d969f);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 2); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfd8e0, 0x404040, 0.6));
const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 50);
const ctl = new OrbitControls(cam, renderer.domElement);
let cur = null;
function clear() { if (cur) { scene.remove(cur); cur = null; } }
function marker(p, c, r = 0.004) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.position.fromArray(p); m.renderOrder = 9; return m; }
function frame(obj, mode) {
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), L = box.getSize(new THREE.Vector3()).length();
  ctl.target.copy(c);
  if (mode === 'side') cam.position.set(c.x + L * 1.9, c.y, c.z);
  else if (mode === 'left') cam.position.set(c.x - L * 1.9, c.y, c.z);
  else if (mode === 'top') cam.position.set(c.x, c.y + L * 1.9, c.z + 0.001);
  else if (mode === 'front') cam.position.set(c.x + L * 0.25, c.y + L * 0.1, c.z - L * 1.6);
  else cam.position.set(c.x + L * 1.1, c.y + L * 0.55, c.z - L * 1.2);
  cam.lookAt(c); ctl.update();
}
async function show(id, opts = {}) {
  clear();
  const g = new THREE.Group();
  let meta;
  if (opts.final) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gl = await loader.loadAsync('../../assets/models/guns/' + id + '.glb?' + Date.now());
    g.add(gl.scene); gl.scene.traverse(o => { if (o.userData.lz) meta = o.userData.lz; });
  } else {
    const b = await build(id);
    for (const m of b.meshes) g.add(new THREE.Mesh(m.geo, b.mats[m.mat]));
    meta = cleanMeta(b.meta);
    document.getElementById('info').textContent = id + ' · ' + (b.tris ? b.tris + ' 삼각형' : '') + '\n' + JSON.stringify(meta);
  }
  if (opts.markers !== false && meta) {
    g.add(marker([0, 0, 0], 0xff00ff));
    if (meta.muzzle) g.add(marker(meta.muzzle, 0xff0000));
    if (meta.fore) g.add(marker(meta.fore, 0x00ff00));
    if (meta.charge) g.add(marker(meta.charge, 0x00ffff));
    if (meta.port) g.add(marker(meta.port, 0xffff00));
    if (meta.sight) g.add(marker([0, meta.sight[0], meta.sight[1]], 0xffffff, 0.003));
    if (meta.rail) g.add(marker([0, meta.rail[0], meta.rail[1]], 0x0000ff, 0.003));
    for (const k in meta.pivots || {}) g.add(marker(meta.pivots[k], 0xff8800, 0.003));
    if (meta.sight) {   // 조준선
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, meta.sight[0], meta.sight[1] + 0.1), new THREE.Vector3(0, meta.sight[0], meta.muzzle[2] - 0.05)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
      g.add(l);
    }
  }
  scene.add(g); cur = g;
  frame(g, opts.mode || 'persp');
  renderer.render(scene, cam);
}
(function loop() { requestAnimationFrame(loop); renderer.render(scene, cam); })();

/* ---------------- UI ---------------- */
const list = document.getElementById('list');
for (const id of IDS) {
  const b = document.createElement('button'); b.textContent = id; b.onclick = () => show(id); list.appendChild(b);
  const d = document.createElement('button'); d.textContent = '⤓'; d.title = 'GLB 내려받기';
  d.onclick = async () => { const u8 = await glb(id); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: 'model/gltf-binary' })); a.download = id + '.glb'; a.click(); };
  list.appendChild(d); list.appendChild(document.createElement('br'));
}
for (const m of ['persp', 'side', 'left', 'top', 'front']) { const b = document.createElement('button'); b.textContent = m; b.onclick = () => cur && frame(cur, m); document.getElementById('modes').appendChild(b); }

window.LZ = { IDS, build, show, glb64: async id => b64(await glb(id)), render: () => renderer.render(scene, cam) };
window.__ready = true;
