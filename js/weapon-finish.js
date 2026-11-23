// Consistent material response across imported guns; authored texture colors
// stay intact. Optic glass, reticles and emissive effects retain their setup.
(function(){
'use strict';
const G=window.G,T=window.THREE,U=G.U;
const seen=new WeakSet();
const F=G.WeaponFinish={count:0,roles:{},
  material(m){
    if(!m||seen.has(m)||!(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial))return;
    seen.add(m);if(m.transparent||/lens|glass|reticle|emissi/i.test(m.name))return;
    const name=String(m.name||'').toLowerCase();let role='painted';
    if(/hand|glove|sleeve|cloth|skin|fabric/i.test(name))role='cloth';
    else if(/wood|walnut|stock_wood/i.test(name))role='wood';
    else if(/rubber|plastic|polymer|grip|bakelite/i.test(name))role='polymer';
    else if(/steel|metal|bolt|barrel|slide|chrome|brass/i.test(name))role='metal';
    if(role==='cloth'){m.metalness=0;m.roughness=Math.max(.84,m.roughness);m.envMapIntensity=.5}
    else if(role==='wood'){m.metalness=Math.min(.05,m.metalness);m.roughness=U.clamp(m.roughness,.62,.92);m.envMapIntensity=.75}
    else if(role==='polymer'){m.metalness=Math.min(.08,m.metalness);m.roughness=U.clamp(m.roughness,.64,.93);m.envMapIntensity=.75}
    else if(role==='metal'){m.metalness=U.clamp(m.metalness,.15,.85);m.roughness=U.clamp(m.roughness,.38,.82);m.envMapIntensity=1.0}
    else{m.metalness=Math.min(.8,m.metalness);m.roughness=U.clamp(m.roughness,.5,.94);m.envMapIntensity=.9}
    if(m.normalMap)m.normalScale.set(U.clamp(m.normalScale.x,-1.1,1.1),U.clamp(m.normalScale.y,-1.1,1.1));
    m.userData.finishRole=role;this.count++;this.roles[role]=(this.roles[role]||0)+1;
  },
  root(root){root?.traverse(o=>{for(const m of [].concat(o.material||[]))this.material(m)})}
};
})();
