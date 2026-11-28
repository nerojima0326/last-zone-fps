// v109 감염자는 총기 봇과 분리하고 근거리 판단·원거리 갱신을 나눈다.
const G=window.G,T=window.THREE,dir=new T.Vector3(),probe=new T.Vector3(),tmp=new T.Vector3(),hit={};
export const TYPES={walker:{name:'감염자',speed:1.7,hp:82,damage:9,scale:1,index:0},runner:{name:'러너',speed:4.7,hp:58,damage:7,scale:.97,index:1},tank:{name:'탱커',speed:1.25,hp:460,damage:21,scale:1.32,index:2},screamer:{name:'비명자',speed:2.1,hp:110,damage:6,scale:1,index:3},exploder:{name:'폭발형',speed:2.6,hp:90,damage:27,scale:1.08,index:4},boss:{name:'차단자',speed:2.25,hp:2300,damage:24,scale:1.65,index:6}};
export class Brain{
 constructor(a,mode,nav,models){this.a=a;this.mode=mode;this.nav=nav;this.models=models;this.goal=null;this.next=0;this.dir=new T.Vector3();this.stuck=0;this.lastPos=new T.Vector3();this.recoveries=0;this.vaults=0;this.soundAt=0;this.cool=1;this.special=5;this.state='walk'}
 clearGoal(){this.goal=null}hear(p){this.goal=p.clone();this.next=0}onHurt(attacker){this.goal=attacker.pos.clone();this.next=0}
 animate(name,rate=1){this.models.animate(this.a,name,this.mode.time,rate)}
 update(dt){
  const a=this.a,z=a.z,m=this.mode,p=G.Game.player;if(!a.alive||!z.visible||!p.alive||m.finished)return;const distance=a.pos.distanceTo(p.pos),spec=TYPES[z.kind];this.cool-=dt;this.special-=dt;this.next-=dt;this.soundAt-=dt;
  if(this.soundAt<=0&&distance<80){m.audio?.voice(a,z.kind==='screamer'?'scream':'moan');this.soundAt=4+Math.random()*8}
  if(z.vault){const v=z.vault;v.t+=dt;const k=Math.min(1,v.t/1.1);a.pos.lerpVectors(v.from,v.to,k);a.pos.y+=Math.sin(k*Math.PI)*.65;if(k>=1)z.vault=null;return}
  if(z.hurtUntil>m.time){this.animate('hurt');a.vel.set(0,0,0);return}
  if(z.kind==='exploder'&&distance<2.8&&!z.fuse){z.fuse=m.time+.9;this.animate('roar');m.audio?.voice(a,'scream')}
  if(z.fuse){a.vel.set(0,0,0);if(m.time>=z.fuse)m.explode(a);return}
  if(z.kind==='screamer'&&this.special<=0&&distance<35){this.special=18;z.roarUntil=m.time+1.7;this.animate('roar');m.summon(a);m.audio?.voice(a,'scream')}
  if(z.roarUntil>m.time)return;
  if(z.kind==='boss'&&this.special<=0){this.special=7+Math.random()*3;z.pattern=(z.pattern+1)%3;z.windup=m.time+1;z.patternEnd=m.time+2.4;this.dir.copy(p.pos).sub(a.pos).setY(0).normalize();this.animate(z.pattern===0?'roar':z.pattern===1?'slam':'charge');m.radio('저 거대한 감염자, 등을 노려! 돌진 전에는 옆으로 피해!','분대장',4)}
  if(z.patternEnd>m.time){
   if(m.time<z.windup)return;
   if(z.pattern===2){a.vel.copy(this.dir).multiplyScalar(10);G.Physics.move(a,dt);this.animate('charge');if(distance<2.5&&this.cool<=0){m.attack(a,32,true);this.cool=1.2}}
   else if(!z.patternHit){z.patternHit=true;m.bossPulse(a,z.pattern===1?6:4);this.animate('slam')}
   return;
  }else z.patternHit=false;
  const reach=z.crawl?1.15:z.kind==='tank'||z.kind==='boss'?2.2:1.45;
  if(distance<reach&&Math.abs(p.pos.y-a.pos.y)<2){
   a.yaw=Math.atan2(a.pos.x-p.pos.x,a.pos.z-p.pos.z);a.vel.set(0,0,0);
   if(this.cool<=0){this.cool=z.crawl?2:1.65;z.attackAt=m.time+.34;this.animate('attack',z.crawl?.75:1);}
   if(z.attackAt&&m.time>=z.attackAt){z.attackAt=0;if(distance<reach+.4&&this.clearSight(p.pos))m.attack(a,spec.damage,z.kind==='tank'||z.kind==='boss')}
   return;
  }
  z.attackAt=0;
  if(this.next<=0){
   this.next=distance<35?.1:distance<85?.26:.6;this.nav.direction(a,p.pos,this.dir);
   if(!this.canMove(this.dir)){
    if(!z.crawl&&this.tryVault(this.dir))return;
    const angle=Math.atan2(this.dir.x,this.dir.z);let found=false;for(const q of [.55,-.55,1.05,-1.05,1.6,-1.6,2.3,-2.3,Math.PI]){dir.set(Math.sin(angle+q),0,Math.cos(angle+q));if(this.canMove(dir)){this.dir.copy(dir);found=true;break}}if(!found)this.dir.set(0,0,0);
   }
  }
  const speed=(z.crawl?.8:spec.speed)*m.difficulty.speed*(m.carry?1:1);a.vel.x=this.dir.x*speed;a.vel.z=this.dir.z*speed;const beforeX=a.pos.x,beforeZ=a.pos.z;G.Physics.move(a,dt);a.yaw=G.U.damp(a.yaw,unwrap(a.yaw,Math.atan2(-this.dir.x,-this.dir.z)),9,dt);a.hspeed=Math.hypot(a.pos.x-beforeX,a.pos.z-beforeZ)/Math.max(.001,dt);this.animate(z.crawl?'crawl':speed>3?'run':'walk',Math.max(.6,speed/(z.crawl?.8:speed>3?4.7:1.7)));
  this.stuck+=dt;if(this.stuck>=1.2){if(this.lastPos.distanceTo(a.pos)<.35){this.recoveries++;this.next=0;this.dir.applyAxisAngle(new T.Vector3(0,1,0),this.recoveries%2?1.2:-1.2);a.vel.copy(this.dir).multiplyScalar(2);a.vel.y=2.5;G.Physics.move(a,.1);this.goal=p.pos.clone();}this.lastPos.copy(a.pos);this.stuck=0}
  m.scene?.attackBarricade(a,dt);
 }
 clearSight(p){tmp.copy(p).sub(this.a.pos);const d=tmp.length();tmp.y+=1;tmp.normalize();probe.copy(this.a.pos);probe.y+=.7;return G.World.rayBoxes(probe.x,probe.y,probe.z,tmp.x,tmp.y,tmp.z,d,hit)>=d-.3}
 canMove(d){const a=this.a;return this.nav.free(a.pos.x+d.x*1.2,a.pos.z+d.z*1.2,this.nav.height(a.pos.x+d.x*1.2,a.pos.z+d.z*1.2))}
 tryVault(d){const a=this.a;let wall=null;const x=a.pos.x+d.x*.8,z=a.pos.z+d.z*.8;G.World.queryBoxes(x-.3,z-.3,x+.3,z+.3,b=>{if(b.maxY>a.pos.y+.55&&b.maxY<a.pos.y+1.25&&b.minY<a.pos.y+1.5&&!b.vehicle)wall=b});if(!wall)return false;const to=probe.copy(a.pos).addScaledVector(d,2.4);to.y=this.nav.height(to.x,to.z);if(!this.nav.free(to.x,to.z,to.y)||Math.abs(to.y-a.pos.y)>1.1)return false;a.z.vault={from:a.pos.clone(),to:to.clone(),t:0};this.vaults++;this.animate('vault');return true}
}
function unwrap(from,to){while(to-from>Math.PI)to-=Math.PI*2;while(to-from<-Math.PI)to+=Math.PI*2;return to}
function sphere(o,d,p,r){tmp.copy(o).sub(p);const b=tmp.dot(d),c=tmp.lengthSq()-r*r,disc=b*b-c;if(disc<0)return Infinity;const t=-b-Math.sqrt(disc);return t>=0?t:Infinity}
export const Combat={
 hit(a,o,d,max){const z=a.z;if(!z?.visible)return null;let best=Infinity,region='body';const radii=[.17,.28,.17,.15,.17,.15,.22,.2,.22,.2];for(let i=0;i<z.contacts.length;i++){const t=sphere(o,d,z.contacts[i],radii[i]*z.scale);if(t<best){best=t;region=i===0?'head':i>=6?'leg':i>=2?'arm':'body'}}return best<=max?{t:best,head:region==='head',region}:null},
 region(a,point,head){if(head)return'head';if(!point)return'body';let best=Infinity,region='body';for(let i=0;i<a.z.contacts.length;i++){const d=point.distanceToSquared(a.z.contacts[i]);if(d<best){best=d;region=i>=6?'leg':i>=2?'arm':'body'}}return region}
};
