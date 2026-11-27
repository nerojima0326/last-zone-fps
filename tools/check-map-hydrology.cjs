
// v108 기존 검증 자료 쓰기 보호.
require('./artifact-paths.cjs');
// 실제 수면 삼각형이 수역 밖에 떠 있는지, 그 위치의 물리 수위와 맞는지 검사한다. GPU 없이 실행한다.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),T=require('three'),assert=require('assert');
const root=path.resolve(__dirname,'..'),base='cc88b96bd30ff88ec424d97e748fecfa2d28b4b5';
function inspect(before){
 const context=vm.createContext({window:{THREE:T},console,performance});
 for(const name of before?['core','world']:['core','map-layout','world']){
  const file='js/'+name+'.js',source=before?cp.execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');vm.runInContext(source,context);
 }
 const G=context.window.G,W=G.World;W.rnd=G.U.mulberry32(20261028);W.decorRnd=G.U.mulberry32(781245);W.noise=G.Noise.make(1337);W.genHeights();
 const geos=[];
 if(before){W.scene=new T.Scene();W.buildInlandWater(new T.MeshBasicMaterial());for(const o of W.scene.children)geos.push(o.geometry)}else geos.push(G.MapLayout.waterGeometry(W,T));
 let triangles=0,visible=0,outside=0,error=0,samples=0;const point=new T.Vector3(),vertices=[new T.Vector3(),new T.Vector3(),new T.Vector3()],blobs=[],segments=[];
 for(const L of W.lakes)for(const b of L.blobs)blobs.push({x:b.x,z:b.z,r2:(b.r+3.2)**2});
 for(const R of W.rivers)for(let i=1;i<R.pts.length;i++){const a=R.pts[i-1],b=R.pts[i],r=Math.max(a.w,b.w)+3.2,dx=b.x-a.x,dz=b.z-a.z;segments.push({x:a.x,z:a.z,dx,dz,l2:dx*dx+dz*dz||1,r2:r*r,x0:Math.min(a.x,b.x)-r,x1:Math.max(a.x,b.x)+r,z0:Math.min(a.z,b.z)-r,z1:Math.max(a.z,b.z)+r})}
 const inBody=p=>{for(const b of blobs)if((p.x-b.x)**2+(p.z-b.z)**2<b.r2)return true;for(const s of segments){if(p.x<s.x0||p.x>s.x1||p.z<s.z0||p.z>s.z1)continue;const t=Math.max(0,Math.min(1,((p.x-s.x)*s.dx+(p.z-s.z)*s.dz)/s.l2));if((p.x-s.x-s.dx*t)**2+(p.z-s.z-s.dz*t)**2<s.r2)return true}return false};
 const bary=[[1/3,1/3,1/3],[.05,.475,.475],[.475,.05,.475],[.475,.475,.05],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]];
 for(const geo of geos){const a=geo.attributes.position,idx=geo.index;for(let i=0;i<idx.count;i+=3){triangles++;let seen=false,bad=false;for(let j=0;j<3;j++)vertices[j].fromBufferAttribute(a,idx.getX(i+j));for(const weights of bary){samples++;point.set(0,0,0);for(let j=0;j<3;j++)point.addScaledVector(vertices[j],weights[j]);assert(Number.isFinite(point.x+point.y+point.z));if(point.y<W.heightAt(point.x,point.z)+.02)continue;seen=true;error=Math.max(error,Math.abs(point.y-(before?0:.008)-W.waterAt(point.x,point.z)));if(point.y>.1&&!inBody(point))bad=true}if(seen)visible++;if(bad)outside++}}
 let dryQueries=0,badDryQueries=0;if(W.waterEdge)for(let z=0;z<=W.RES;z++)for(let x=0;x<=W.RES;x++){const k=z*(W.RES+1)+x;if(W.heights[k]<.1||W.waterEdge[k]>=-.1||W.waterH[k]<.1||W.heights[k]>=W.waterH[k]-.1)continue;dryQueries++;if(W.waterAt(x*W.SIZE/W.RES-W.HALF,z*W.SIZE/W.RES-W.HALF)>W.heights[k]+.01)badDryQueries++}
 let lakeInteriorLandCells=0;for(const L of W.lakes)for(let z=0;z<=W.RES;z++)for(let x=0;x<=W.RES;x++){const px=x*W.SIZE/W.RES-W.HALF,pz=z*W.SIZE/W.RES-W.HALF;if(W.lakeSD(L,px,pz)<-8&&W.heights[z*(W.RES+1)+x]>=L.level-.1)lakeInteriorLandCells++}
 return{triangles,samples,visibleTriangles:visible,outsideWaterBodies:outside,maxSurfaceLogicError:error,dryDepressionsChecked:dryQueries,falseWaterInDryDepressions:badDryQueries,lakeInteriorLandCells};
}
const report={version:87,base,method:'수면의 모든 삼각형에서 중심·가장자리 7곳을 검사. 지면 위에 노출된 표본을 호수 합집합·실제 강 폭과 비교. 격자 오차 여유는 3.2m.',after:inspect(false)};
assert.equal(report.after.outsideWaterBodies,0,'정의된 호수·강 밖에 고립 수면이 있음');assert.equal(report.after.falseWaterInDryDepressions,0,'마른 저지대를 물속으로 판정함');assert(report.after.maxSurfaceLogicError<.03,'표시 수면과 물리 수위 불일치');
assert.equal(report.after.lakeInteriorLandCells,0,'강둑이 호수 내부를 가로막음');
if(process.argv.includes('--compare'))report.before=inspect(true);
if(process.argv.includes('--compare')||process.env.REPORT)fs.writeFileSync(process.env.REPORT||'/tmp/lz-v87-water-domain.json',JSON.stringify(report,null,2)+'\n');console.log('PASS 수역·수면 검사',JSON.stringify(report));
