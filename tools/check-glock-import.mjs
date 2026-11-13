// THREE_DIR points to Three.js r160; pass the locally licensed glock17.fbx as argv[2].
// Geometry/animation checks only: texture loading is stubbed, without WebGL rendering.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
if(!process.env.THREE_DIR||!process.argv[2])throw Error('Usage: THREE_DIR=/path/to/three node tools/check-glock-import.mjs /path/to/glock17.fbx');
const uri=p=>pathToFileURL(path.join(process.env.THREE_DIR,p)).href;
const T=await import(uri('build/three.module.js'));
const {FBXLoader}=await import(uri('examples/jsm/loaders/FBXLoader.js'));
const {GLTFLoader}=await import(uri('examples/jsm/loaders/GLTFLoader.js'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');globalThis.window={URL};T.TextureLoader.prototype.load=function(){return new T.Texture()};globalThis.document={getElementById(){return {addEventListener(){}}}};
const assets={};for(const [id,file] of [['micro','micro-dot'],['laser','laser'],['suppressor','suppressor']]){let b=fs.readFileSync(root+'/assets/models/attachments/'+file+'.glb');assets[id]=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene}
const original={root:new T.Group(),flash:new T.Mesh(new T.PlaneGeometry(.05,.05),new T.MeshBasicMaterial())},V={root:new T.Group(),models:{g18:original},cur:'g18',kick:0,kickRoll:0,flashT:0,sway:{x:0,y:0},flashLight:new T.PointLight(),update(){original.root.visible=true},fireKick(a,s){this.flashT=s?0:.04},muzzleWorld(cam,out){return out.set(99,99,99)}};
const G={VM:V,vmCamera:{fov:54},Game:{player:{weapons:{pistol:{id:'g18',attachments:{}}}}},Attachments:{make(id,scale){const o=assets[id]?.clone(true);if(o)o.scale.setScalar(scale);return o}}};window.G=G;window.THREE={...T,FBXLoader};vm.runInThisContext(fs.readFileSync(root+'/js/g17-pilot.js','utf8'));const P=G.G17Pilot;P.init();let b=fs.readFileSync(process.argv[2]);await P.load(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const base={ads:0,raise:1,landDip:0,phase:0,moving:0,sprint:false,hideVM:false,reload:null};const cam=new T.PerspectiveCamera(54,1,.01,10);cam.updateMatrixWorld(true);let frames=0;
P.sample('Idle',0); P.mountKey=null; P.syncAttachments('reddot');
const opticOffset=P.aimOffset.clone();
for (const pose of ['Reload','ReloadEmpty','Fire']) {
 P.sample(pose,.4); P.pivot.position.set(.12,.08,-.04); P.pivot.rotation.set(.1,.2,-.1);
 P.mountKey=null; P.syncAttachments('reddot');
 if (P.aimOffset.distanceTo(opticOffset)>1e-8) throw Error('Glock ADS shifted while '+pose);
}
P.pivot.position.set(0,0,0); P.pivot.rotation.set(0,0,0);
P.sample('Reload',.4); P.pivot.updateMatrixWorld(true);
const hand=P.model.getObjectByName('LeftHand').getWorldPosition(new T.Vector3());
P.sample('Reload',1); P.sample('Reload',.4); P.pivot.updateMatrixWorld(true);
if(hand.distanceTo(P.model.getObjectByName('LeftHand').getWorldPosition(new T.Vector3()))>1e-8) throw Error('Glock clamped reload failed to seek backwards');
for(const fps of [30,60,144]){
 V.cur='g18';V.update(1/fps,base);if(original.root.visible||!P.pivot.visible||P.name!=='Idle')throw Error('Glock not visible at idle');
 const pos=V.muzzleWorld(cam,new T.Vector3());if(!(pos.z<-.2&&pos.z>-.6)||pos.toArray().some(x=>!Number.isFinite(x)))throw Error('bad muzzle '+pos.toArray());
 V.fireKick(1,false);V.update(1/fps,base);if(P.name!=='Fire'||!P.flash.visible)throw Error('fire clip/flash');
 for(const empty of [false,true]){for(let t=0;t<=1;t+=1/fps){V.update(1/fps,{...base,reload:{type:'mag',empty,p:t}});P.pivot.updateMatrixWorld(true);if(original.root.visible||!P.pivot.visible)throw Error('old gun during reload');P.model.traverse(n=>{if(n.matrixWorld.elements.some(x=>!Number.isFinite(x)))throw Error('nonfinite transform')});frames++}V.update(1,base);if(original.root.visible||!P.pivot.visible||P.name!=='Idle')throw Error('old gun after reload')}
 V.update(1/fps,{...base,ads:1});const point=P.ironOffset.clone().negate();point.z-=.28;point.applyMatrix4(P.pivot.matrixWorld);if(Math.abs(point.x)>1e-5||Math.abs(point.y)>1e-5)throw Error('iron sight alignment');
 V.cur='ar7';V.update(1/fps,base);if(P.pivot.visible)throw Error('Glock persists after weapon switch');
 V.cur='g18';G.Game.player.weapons.pistol.attachments={muzzle:'suppressor',side:'laser'};V.update(1/fps,{...base,scope:'reddot',ads:1});if(P.mount.children.length!==3||!P.aimOffset.toArray().every(Number.isFinite))throw Error('attachment sync');let preview=P.preview('reddot'),skinned=false;preview.traverse(x=>{if(x.isSkinnedMesh)skinned=true});if(skinned)throw Error('arms in gun preview');
}
const model=P.model;try{await P.load(new ArrayBuffer(12));throw Error('invalid accepted')}catch(e){if(e.message==='invalid accepted')throw e}if(P.model!==model)throw Error('bad input destroyed model');P.unload();if(P.ready||V.root.children.length||!original.root.visible)throw Error('unload');console.log('PASS',JSON.stringify({frames,fps:[30,60,144],checks:['idle','fire','reload','empty reload','iron ADS','optic and accessories','preview','muzzle','switch','invalid file','reset']}));
