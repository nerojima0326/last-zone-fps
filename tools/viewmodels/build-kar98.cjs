// tools/viewmodels/build-kar98.cjs — v63 KR-98 1인칭 총: Kar98k (Kvark025, Sketchfab CC-BY-4.0) → swap/kr98.glb
//  저격 팩(sniper.glb)의 팔·사격 동작 위에 얹는다. 볼트(zatvor)·손잡이(group10)는 따로 움직이도록 노드를 나눈다.
//  · 단위 m, 총구 = −Z, 오른쪽 = +X (원본: cm, 총구 +X)
//  · 노드: body (고정 부품) · bolt (노리쇠 몸통, 닫힌 자세) ⊃ handle (손잡이, 아래로 내린 자세) · rounds (내부 탄창 4발) · round (탄 한 발 견본)
//  · extras: bolt.open (열 때 옮길 거리, m) · handle.up / handle.down (손잡이 로컬 회전) · handle.knob (손잡이 공의 로컬 위치)
//  · 붙박이 조준경·마운트는 뺀다 (게임 조준경 부착물을 쓴다)
// 쓰는 법: NODE_PATH=<playwright> THREE_DIR=<three 패키지> node tools/viewmodels/build-kar98.cjs <원본 폴더(Kar98k anim.fbx + PNG)> <출력 glb>
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const SRC = process.argv[2], OUT = process.argv[3], THREE_DIR = process.env.THREE_DIR;
const DROP = [3, 13, 23, 30, 31, 32, 41, 43, 20, 46, 21, 42, 53, 54, 29, 19, 45, 2].map(n => 'polySurface' + n);   // 조준경·마운트
const PAGE = `<html><body><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const DROP=${JSON.stringify(DROP)};
const m=new FBXLoader().parse(await (await fetch('/src/Kar98k anim.fbx')).arrayBuffer(),'/src/');
const tl=new T.TextureLoader(),tex=async(f,srgb)=>{const t=await tl.loadAsync('/src/Kar_LP_phong1_'+f+'.png');if(srgb)t.colorSpace=T.SRGBColorSpace;t.flipY=false;return t};
// FBX UV 는 three 기본(flipY=true)으로 맞춰져 있다 → 내보낼 때는 glTF 규칙(flipY=false)이라 V 를 뒤집는다
const mat=new T.MeshStandardMaterial({name:'kar98',map:await tex('BaseColor',1),normalMap:await tex('Normal'),roughnessMap:await tex('Roughness'),metalnessMap:await tex('Metallic'),metalness:1,roughness:1});
const mixer=new T.AnimationMixer(m),act=mixer.clipAction(m.animations[0]);act.play();
const at=t=>{mixer.setTime(t);m.updateMatrixWorld(true)};
const C=new T.Matrix4().makeRotationY(Math.PI/2).multiply(new T.Matrix4().makeScale(.01,.01,.01));
const W=o=>C.clone().multiply(o.matrixWorld);
const frame=M=>{const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();M.decompose(p,q,s);return new T.Matrix4().compose(p,q,new T.Vector3(1,1,1))};
const bake=(o,F)=>{const g=o.geometry.clone();g.applyMatrix4(F.clone().invert().multiply(W(o)));const uv=g.attributes.uv;if(uv)for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));const k=new T.Mesh(g,mat);k.name=o.name;return k};
const setTRS=(n,M)=>M.decompose(n.position,n.quaternion,n.scale);
const zat=m.getObjectByName('zatvor'),hnd=m.getObjectByName('group10'),rounds=m.getObjectByName('group11'),round=m.getObjectByName('polySurface51');
const under=(o,a)=>{for(let x=o;x;x=x.parent)if(x===a)return true;return false};
// 닫힌 자세 (원본 4.5 초 클립의 1.95 초: 노리쇠 앞, 손잡이 아래)
at(1.95);
const root=new T.Group();root.name='kar98';
const body=new T.Group();body.name='body';root.add(body);
const I=new T.Matrix4();
// 조준경 마운트 받침(Kar_06·07 메시 안에 붙어 있다): 원본 좌표 y > 2.3 cm 인 꼭짓점이 있는 삼각형을 뺀다 (가늠자·가늠쇠는 1.9 cm 아래)
const cutHigh=k=>{const g=k.geometry.index?k.geometry.toNonIndexed():k.geometry,p=g.attributes.position,keep=[],Mw=C.clone().invert().multiply(k.matrix);const v=new T.Vector3();
 for(let i=0;i<p.count;i+=3){let hi=false;for(let j=0;j<3;j++){v.fromBufferAttribute(p,i+j).applyMatrix4(k.matrix).applyMatrix4(C.clone().invert());if(v.y>2.3)hi=true}if(!hi)keep.push(i)}
 const out=new T.BufferGeometry();for(const [n,a] of Object.entries(g.attributes)){const s=a.itemSize,arr=new Float32Array(keep.length*3*s);keep.forEach((i,q)=>{for(let j=0;j<3*s;j++)arr[q*3*s+j]=a.array[i*s+j]});out.setAttribute(n,new T.BufferAttribute(arr,s))}
 window.cut=(window.cut||[]).concat([k.name+' '+(p.count/3)+'→'+keep.length]);k.geometry=out;return k};
m.traverse(o=>{if(!o.isMesh||DROP.includes(o.name)||o===round||under(o,zat)||under(o,rounds))return;const k=bake(o,I);body.add(/^Kar_0[67]_low$/.test(o.name)?cutHigh(k):k)});
const Fb=frame(W(zat)),Fh=frame(W(hnd));
const bolt=new T.Group();bolt.name='bolt';setTRS(bolt,Fb);root.add(bolt);
const handle=new T.Group();handle.name='handle';setTRS(handle,Fb.clone().invert().multiply(Fh));bolt.add(handle);
zat.traverse(o=>{if(!o.isMesh)return;(under(o,hnd)?handle:bolt).add(bake(o,under(o,hnd)?Fh:Fb))});
// 그룹마다 메시를 하나로 (그리기 호출 수 줄이기)
const merge=(g,name)=>{const ms=g.children.filter(o=>o.isMesh);if(ms.length<2)return;const geo=mergeGeometries(ms.map(o=>{const x=o.geometry.clone();x.applyMatrix4(o.matrix);for(const k of Object.keys(x.attributes))if(!['position','normal','uv'].includes(k))x.deleteAttribute(k);return x}));for(const o of ms)g.remove(o);const k=new T.Mesh(geo,mat);k.name=name;g.add(k)};
merge(body,'body_mesh');merge(handle,'handle_mesh');merge(bolt,'bolt_mesh');
const rg=new T.Group();rg.name='rounds';root.add(rg);rounds.children.filter(o=>o.isMesh).sort((a,b)=>W(b).elements[13]-W(a).elements[13]).forEach((o,i)=>{const k=bake(o,I);k.name='round'+i;rg.add(k)});
// 탄 견본: 가운데를 원점, 총알 끝 = −Z
const rb=new T.Box3().setFromObject(round),rc=rb.getCenter(new T.Vector3());
const tmpl=new T.Mesh(bake(round,I).geometry,mat);tmpl.geometry.computeBoundingBox();const c=tmpl.geometry.boundingBox.getCenter(new T.Vector3());tmpl.geometry.translate(-c.x,-c.y,-c.z);tmpl.name='round';tmpl.visible=true;root.add(tmpl);tmpl.position.set(0,-.3,0);
const knobMesh=hnd.getObjectByName('polySurface39'),kb=new T.Box3().setFromObject(knobMesh),kc=kb.getCenter(new T.Vector3()).applyMatrix4(C).applyMatrix4(Fh.clone().invert());
const hq=Fb.clone().invert().multiply(Fh),down=new T.Quaternion();hq.decompose(new T.Vector3(),down,new T.Vector3());
at(1.2);const Fh2=frame(W(hnd)),Fb2=frame(W(zat)),up=new T.Quaternion();Fb2.clone().invert().multiply(Fh2).decompose(new T.Vector3(),up,new T.Vector3());
at(0.03);const Fb0=frame(W(zat)),p0=new T.Vector3().setFromMatrixPosition(Fb0),p1=new T.Vector3().setFromMatrixPosition(Fb);
handle.userData={up:up.toArray(),down:down.toArray(),knob:kc.toArray()};
bolt.userData={open:p0.sub(p1).toArray()};
root.userData={source:'Kar98k by Kvark025 (Sketchfab, CC-BY-4.0)'};
const out=await new GLTFExporter().parseAsync(root,{binary:true});
const b=new Uint8Array(out);let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));
window.result={glb:btoa(s),info:{bolt:bolt.userData,handle:handle.userData,cut:window.cut}};
</script></body></html>`;
(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(PAGE); }
    let f = null;
    if (u.startsWith('/three/')) f = path.join(THREE_DIR, u.slice(7));
    else if (u.startsWith('/src/')) f = path.join(SRC, u.slice(5));
    if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream'); fs.createReadStream(f).pipe(res);
  }).listen(0);
  await new Promise(r => server.once('listening', r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(); page.on('pageerror', e => console.log('ERR', e.message)); page.on('console', m => console.log('CON', m.text().slice(0, 200)));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForFunction(() => window.result, null, { timeout: 300000 });
  const r = await page.evaluate(() => window.result);
  fs.writeFileSync(OUT, Buffer.from(r.glb, 'base64'));
  console.log(JSON.stringify(r.info), fs.statSync(OUT).size);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
