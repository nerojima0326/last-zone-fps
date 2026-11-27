// v107 실제 훈련장의 같은 장전 프레임을 저장소 밖에 촬영한다.
const fs=require('fs'),path=require('path'),assert=require('assert'),fixture=require('./expanded-motion-fixture.cjs');
const out=path.resolve(process.env.SHOTS||'/tmp/lz-reload-clearance');
(async()=>{const f=await fixture({viewport:{width:1280,height:720}});try{
 fs.mkdirSync(out,{recursive:true});const rows=[];
 for(const [id,empty,p]of [['v45',false,.702],['ms56',false,.703],['cx9',false,.713],['ar416',false,.703],['sr25',false,.702],['sm45',false,.702],['sr25',true,.237]]){
  const row=await f.page.evaluate(({id,empty,p})=>{
   const P=G.Player;gunStudio.select(id,empty);G.setRenderResolution('100');P.startReload();
   while(P.reload&&P.reload.t/P.reload.dur<p){P.reloadLogic(1/144);P.updateCamera(1/144);}
   G.World.update(0,G.camera.position,G.camera);G.UI.update(1/60);G.renderNow();G.Perf.gpuWait();
   const m=G.VM.models[id],L=m.armL;return{id,empty,p:P.reload?.t/P.reload?.dur,contact:L.contactMode,mm:G.Guns.armOverlap(L,L.bE.position,L.bW.position,36)*1000,position:P.a.pos.toArray(),image:G.renderer.domElement.toDataURL('image/png').split(',')[1]};
  },{id,empty,p});
  fs.writeFileSync(path.join(out,id+'-'+(empty?'empty':'tactical')+'.png'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);
 }
 fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({rows,errors:f.errors},null,2)+'\n');assert.deepEqual(f.errors,[]);console.log('PASS 훈련장 장전 관통 프레임 촬영',JSON.stringify(rows));
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
