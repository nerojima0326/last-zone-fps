// THREE_DIR: official Three.js r160 checkout. argv[2]: locally licensed M4 ZIP.
// Motion/geometry regression checks; browser QA additionally verifies decoded textures and IndexedDB.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import{fileURLToPath,pathToFileURL}from'node:url';
if(!process.env.THREE_DIR||!process.argv[2])throw Error('Usage: THREE_DIR=/path/to/three node tools/check-m4-model.mjs /path/to/m4_animations.zip');
const uri=p=>pathToFileURL(path.join(process.env.THREE_DIR,p)).href;
const T=await import(uri('build/three.module.js')),{FBXLoader}=await import(uri('examples/jsm/loaders/FBXLoader.js')),{GLTFLoader}=await import(uri('examples/jsm/loaders/GLTFLoader.js')),{unzipSync}=await import(uri('examples/jsm/libs/fflate.module.js'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');globalThis.window={URL};globalThis.self={URL};globalThis.document={getElementById(){return{addEventListener(){}}}};T.TextureLoader.prototype.load=function(url,onLoad){const texture=new T.Texture();queueMicrotask(()=>onLoad?.(texture));return texture};
const files=unzipSync(fs.readFileSync(process.argv[2])),src=Object.entries(files).find(([n])=>/(^|\/)M4\.fbx$/i.test(n))?.[1];if(!src)throw Error('M4.fbx missing');
const manager=new T.LoadingManager();manager.addHandler(/\.tga$/i,new T.TextureLoader(manager));const model=new FBXLoader(manager).parse(src.buffer.slice(src.byteOffset,src.byteOffset+src.byteLength),'');
const original={root:new T.Group(),flash:new T.Mesh(new T.PlaneGeometry(.05,.05),new T.MeshBasicMaterial())};
const V={root:new T.Group(),models:{ar7:original},cur:'ar7',t:0,kick:0,kickRoll:0,flashT:0,sway:{x:0,y:0},flashLight:new T.PointLight(),update(dt){this.t+=dt;original.root.visible=this.cur==='ar7'},set(id){this.cur=id},fireKick(a,s){this.flashT=s?0:.04},muzzleWorld(cam,out){return out.set(99,99,99)}};
const assets={};for(const[id,file]of Object.entries({reddot:'red-dot',holo:'holo',x2:'magnifier',x4:'weathered-scope',x8:'weathered-scope',grip:'vertical-grip',suppressor:'suppressor',laser:'laser'})){const b=fs.readFileSync(root+'/assets/models/attachments/'+file+'.glb');assets[id]=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene}
const G={VM:V,vmCamera:{fov:54},Guns:{reloadDuration(){return 1.8},reloadEvents(){return[]}},Game:{player:{weapons:{rifle:{id:'ar7',attachments:{}}}}},Attachments:{make(id,scale){const o=assets[id]?.clone(true);if(o)o.scale.setScalar(scale);return o}}};window.G=G;window.THREE={...T,FBXLoader};vm.runInThisContext(fs.readFileSync(root+'/js/m4-viewmodel.js','utf8'));const M=G.M4Viewmodel;await M.init();M.install(model);
const s={ads:0,raise:1,landDip:0,phase:0,moving:0,sprint:false,hideVM:false,reload:null,scope:null,empty:false},cam=new T.PerspectiveCamera(54,16/9,.01,10);cam.updateMatrixWorld(true);let frames=0,checks=0;
const assert=(v,label)=>{if(!v)throw Error(label);checks++};
// An optic may first be mounted while the weapon is still being drawn.
// Its idle aiming point must be independent of the animation and pivot transform.
for (const scope of ['reddot','holo','x2','x4','x8']) {
 M.sample('Idle',0); M.mountKey=null; M.syncAttachments(scope);
 const reference=M.aimOffset.clone();
 for (const pose of ['Draw','Reload','Reload_Empty','Fire']) {
  M.sample(pose,.35); M.pivot.position.set(.12,.08,-.04); M.pivot.rotation.set(.1,.2,-.1);
  M.mountKey=null; M.syncAttachments(scope);
  assert(M.aimOffset.distanceTo(reference)<1e-8,scope+' ADS shifted while '+pose);
 }
}
M.pivot.position.set(0,0,0); M.pivot.rotation.set(0,0,0);
M.sample('Reload',.4); M.pivot.updateMatrixWorld(true);
const scrub=M.model.getObjectByName('LeftHand').getWorldPosition(new T.Vector3());
M.sample('Reload',1); M.sample('Reload',.4); M.pivot.updateMatrixWorld(true);
assert(scrub.distanceTo(M.model.getObjectByName('LeftHand').getWorldPosition(new T.Vector3()))<1e-8,'clamped reload failed to seek backwards');
for(const fps of[30,60,144]){
 V.set('ar7');V.update(2,s);assert(M.name==='Idle'&&!original.root.visible,'idle replacement');
 for(const empty of[false,true]){
  for(let i=0;i<=fps;i++){V.update(1/fps,{...s,reload:{type:'mag',empty,p:i/fps}});assert(M.name===(empty?'Reload_Empty':'Reload'),'reload selection');M.model.traverse(o=>{if(o.matrixWorld.elements.some(x=>!Number.isFinite(x)))throw Error('nonfinite pose')});frames++}
  const end=M.model.getObjectByName('LeftHand').getWorldPosition(new T.Vector3());V.update(1,s);assert(end.distanceTo(M.model.getObjectByName('LeftHand').getWorldPosition(new T.Vector3()))<.005,'reload return continuity');
 }
 for(const scope of[null,'reddot','holo','x2','x4','x8']){
  G.Game.player.weapons.rifle.attachments={muzzle:'suppressor',under:'grip',side:'laser',stock:'tactical'};V.update(1/fps,{...s,ads:1,scope});assert(M.aimOffset.toArray().every(Number.isFinite),'finite ADS');assert(M.rearSight.visible===!scope,'rear aperture/optic conflict');const preview=M.preview(scope);let arms=false;preview.traverse(o=>{if(o.isSkinnedMesh)arms=true});assert(!arms&&!preview.getObjectByName('Mag2'),'preview contains arms/spare magazine');
 }
 V.fireKick(1,false);V.update(1/fps,s);assert(M.name==='Fire'&&M.flash.visible,'shot animation/flash');V.fireKick(1,true);V.update(1/fps,s);assert(!M.flash.visible,'suppressed flash');V.update(1,{...s,empty:true});assert(Math.abs(M.model.getObjectByName('Bolt_j').position.z+.7)<.001,'empty bolt lock');
 const muzzle=V.muzzleWorld(cam,new T.Vector3());assert(muzzle.z<-.5&&muzzle.z>-1&&muzzle.toArray().every(Number.isFinite),'muzzle alignment');
 V.set('g18');assert(!M.pivot.visible,'immediate weapon switch hide');V.update(1/fps,s);assert(!M.pivot.visible,'other weapon');V.set('ar7');V.update(1/fps,s);assert(M.name==='Draw','equip animation');V.update(1/fps,{...s,hideVM:true});assert(!M.pivot.visible,'magnified-scope hide');
}
assert(G.Guns.reloadDuration('ar7',true)>G.Guns.reloadDuration('ar7',false),'empty duration');assert(G.Guns.reloadDuration('g18',false)===1.8,'unrelated timing');const keep=M.model;try{await M.loadZip(new ArrayBuffer(12),unzipSync);throw Error('invalid accepted')}catch(e){if(e.message==='invalid accepted')throw e}assert(M.model===keep,'invalid file removed working model');M.unload();assert(!M.ready&&original.root.visible&&!V.root.children.length,'reset');console.log('PASS',JSON.stringify({checks,frames,fps:[30,60,144]}));
