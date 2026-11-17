// tools/vehicles/build.cjs — 차량 4종 GLB 만들기 (v48)
//  원본: Kenney "Car Kit" (CC0) — suv · truck(픽업) · sedan · van
//        GitHub 사본 kidscancode/3d_car_sphere `assets/kenney_car_kit/` (커밋 cabc5c0)
//  결과: assets/models/vehicles/<id>.glb — 노드(차체 body, 바퀴 wheel_frontLeft…)는 그대로 둔다 (바퀴를 굴리고 꺾는다)
//        정점 용접·중복 제거 + meshopt 압축만 한다. 크기·위치 맞춤은 js/vehicles.js 가 한다.
// 쓰는 법: NODE_PATH=<@gltf-transform·meshoptimizer 가 있는 node_modules> node tools/vehicles/build.cjs <원본 폴더>
const fs = require('fs'), path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, weld, reorder, quantize } = require('@gltf-transform/functions');
const { MeshoptEncoder } = require('meshoptimizer');

const OUT = path.join(__dirname, '../../assets/models/vehicles');
const IDS = ['suv', 'truck', 'sedan', 'van'];

(async () => {
  const src = process.argv[2];
  if (!src) throw Error('원본 GLB 폴더를 주세요');
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of IDS) {
    const doc = await io.read(path.join(src, id + '.glb'));
    await doc.transform(dedup(), prune(), weld(), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 }));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const bin = await io.writeBinary(doc);
    fs.writeFileSync(path.join(OUT, id + '.glb'), bin);
    console.log(id.padEnd(6), (fs.statSync(path.join(src, id + '.glb')).size / 1024).toFixed(0) + ' KB →', (bin.length / 1024).toFixed(0) + ' KB', doc.getRoot().listNodes().map(n => n.getName()).join(','));
  }
})().catch(e => { console.error(e); process.exit(1); });
