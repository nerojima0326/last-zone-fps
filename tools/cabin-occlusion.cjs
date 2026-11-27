// v108 실제 팔 삼각형·게이지를 별도 색상 마스크로 렌더해 겹치는 픽셀을 센다.
module.exports=function(){window.measureCabinOcclusion=(v,m)=>{
 const T=THREE,R=G.renderer,c=v.cabin,parent=m.root.parent,shown=m.root.visible,target=R.getRenderTarget(),clear=R.getClearColor(new T.Color()),alpha=R.getClearAlpha(),scene=new T.Scene(),white=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}),face=new T.Mesh(c.faces.geometry,white),rt=new T.WebGLRenderTarget(640,360),a=new Uint8Array(640*360*4),b=new Uint8Array(a.length);
 v.mesh.updateMatrixWorld(true);m.root.updateMatrixWorld(true);G.camera.updateMatrixWorld(true);face.matrixAutoUpdate=false;face.matrix.copy(c.faces.matrixWorld);scene.add(face,m.root);scene.overrideMaterial=white;
 try{R.setRenderTarget(rt);R.setClearColor(0,0);m.root.visible=false;R.render(scene,G.camera);R.readRenderTargetPixels(rt,0,0,640,360,a);m.root.visible=shown;face.visible=false;R.render(scene,G.camera);R.readRenderTargetPixels(rt,0,0,640,360,b);let gauge=0,blocked=0;for(let i=0;i<a.length;i+=4)if(a[i]>127){gauge++;if(b[i]>127)blocked++;}return{gaugePixels:gauge,blockedPixels:blocked,fraction:gauge?blocked/gauge:1};}
 finally{parent.add(m.root);m.root.visible=shown;R.setRenderTarget(target);R.setClearColor(clear,alpha);rt.dispose();white.dispose();}
};};
