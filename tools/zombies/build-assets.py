# v109 CC0 Patch 인체를 실사형 감염자와 실제 뼈대 클립으로 가공한다.
import bpy, math, json, sys, os, numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion
root=Path(__file__).resolve().parents[2]
out=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root/'assets/zombies'
out.mkdir(parents=True,exist_ok=True)
clips={'idle':2.4,'walk':1.3,'run':.8,'attack':1.2,'hurt':.6,'death':1.9,'crawl':1.8,'vault':1.3,'roar':2.,'charge':.65,'slam':1.6}
report=[]
for variant,source in enumerate(['survivor-cargo','survivor-sweater']):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/'assets/patch/people'/f'{source}.glb'))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.name='infected-rig'
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
 atlas=np.zeros((1024,1024,4),dtype=np.float32);atlas[:,:,3]=1
 slots=[]
 for o in meshes:
  for m in o.data.materials:
   if m and m not in slots:slots.append(m)
 rng=np.random.default_rng(109+variant)
 for idx,m in enumerate(slots):
  nodes=m.node_tree.nodes if m.use_nodes else [];images=[n.image for n in nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB']
  color=np.array(list(m.diffuse_color),dtype=np.float32);bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
  if bs:color=np.array(bs.inputs['Base Color'].default_value,dtype=np.float32)
  tile=np.broadcast_to(color,(256,256,4)).copy()
  if images:
   im=images[0];w,h=im.size;arr=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4);tile=arr[np.minimum((np.arange(256)+.5)*h/256,h-1).astype(int)[:,None],np.minimum((np.arange(256)+.5)*w/256,w-1).astype(int)[None,:]].copy()
  yy,xx=np.mgrid[:256,:256];noise=rng.random((256,256));stain=(np.sin(xx*.047+np.sin(yy*.052)*2)+np.cos(yy*.081-xx*.018)+noise*.8)>1.35
  body='body' in m.name;cloth=any(t in m.name for t in ['shirt','sweater','pants'])
  if body:
   tile[:,:,:3]*=np.array([.72,.73,.65]);tile[stain,:3]*=np.array([.62,.32,.28])
  elif cloth:
   tile[:,:,:3]*=np.array([.59,.62,.57]);tile[stain,:3]*=np.array([.49,.32,.27])
  tile[:,:,:3]*=(.96+noise*.08)[:,:,None];tile[:,:,3]=1
  tx=(idx%4)*256;ty=(idx//4)*256;atlas[ty:ty+256,tx:tx+256]=tile
 for o in meshes:
  uv=o.data.uv_layers.active
  if not uv:continue
  for poly in o.data.polygons:
   m=o.data.materials[poly.material_index];idx=slots.index(m)
   for li in poly.loop_indices:
    a=uv.data[li].uv;a.x=((a.x%1)*.94+.03+idx%4)/4;a.y=((a.y%1)*.94+.03+idx//4)/4
 image=bpy.data.images.new('감염자-피부-의복',width=1024,height=1024);image.pixels.foreach_set(atlas.ravel());image.filepath_raw=str(out/f'infected-{variant}-atlas.png');image.file_format='PNG';image.save()
 mat=bpy.data.materials.new('감염자-의복과피부');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.91;tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='감염자'
 mesh.data.materials.clear();mesh.data.materials.append(mat)
 for p in mesh.data.polygons:p.material_index=0;p.use_smooth=True
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
 # v109 관절은 원본 가중치를 유지하고 동작은 블렌더 액션으로 저장한다.
 bones=rig.pose.bones;restq={b.name:b.bone.matrix_local.to_quaternion() for b in bones};dirs={b.name:(b.bone.tail_local-b.bone.head_local).normalized() for b in bones}
 order=sorted(bones,key=lambda b:len(b.parent_recursive));fps=20;bpy.context.scene.render.fps=fps
 rig.animation_data_create()
 for name,duration in clips.items():
  act=bpy.data.actions.new(name);rig.animation_data.action=act;frames=round(duration*fps)
  for f in range(frames+1):
   t=f/fps;p=min(1,f/frames);cycle=2*math.pi*p;walk=name in ['walk','run','charge'];run=name in ['run','charge'];crawl=name=='crawl';dead=name=='death';attack=name in ['attack','slam'];qmap={}
   lean=.13 if not run else .27
   if crawl:lean=1.38
   if dead:lean=1.5*min(1,p*1.5)
   hipz=(.027*math.cos(cycle*2) if walk else .009*math.sin(cycle))-(.55 if crawl else 0)-(.78*min(1,p*1.4) if dead else 0)
   if name=='vault':hipz+=.5*math.sin(math.pi*p)
   if name=='hurt':lean+=.25*math.sin(math.pi*p)
   if name=='roar':lean-=.22*math.sin(math.pi*p)
   for b in order:
    target=None;extra=Quaternion((1,0,0),0)
    if b.name=='pelvis':extra=Quaternion((1,0,0),lean)
    for side,sign in [('l',1),('r',-1)]:
     phase=cycle+(0 if side=='l' else math.pi);swing=math.sin(phase);lift=max(0,math.cos(phase))
     if b.name==f'thigh_{side}':target=Vector((sign*.04,(.65 if run else .4)*swing if walk else (.4*math.sin(phase) if crawl else .06),-.9 if not crawl else -.4))
     if b.name==f'calf_{side}':target=Vector((sign*.02,.12+.7*lift if walk else (.55 if crawl else .04),-.9 if not crawl else -.2))
     # v109 기어갈 때 무릎·발은 지면을 따라가고, 쓰러지면 다리를 뒤로 편다.
     if crawl and b.name==f'thigh_{side}':target=Vector((sign*.08,.25+.1*math.sin(phase),-.4))
     if crawl and b.name==f'calf_{side}':target=Vector((sign*.02,.65,-.02))
     if dead and b.name in [f'thigh_{side}',f'calf_{side}']:
      fall=min(1,p*1.4);target=Vector((sign*(.04+.1*fall),.06+.85*fall,-.9*(1-fall)-(.07 if b.name==f'thigh_{side}' else .03)*fall))
     if b.name==f'upperarm_{side}':
      forward=.44+(.24*math.sin(phase+math.pi) if walk else .03*math.sin(cycle));down=-.48
      if attack:forward=.45+.5*math.sin(math.pi*p);down=-.5+.9*math.sin(math.pi*p)
      if crawl:forward=.42+.12*math.sin(phase);down=-.65
      if name=='roar':forward=.1;down=.65*math.sin(math.pi*p)-.35
      if dead:forward=.2*(1-min(1,p*1.4));down=-.48*(1-min(1,p*1.4))-.02
      target=Vector((sign*.25,-forward,down))
     if b.name==f'lowerarm_{side}':target=Vector((sign*.1,-.42,-.6)) if crawl else Vector((sign*(.35 if dead else .1),-.4 if dead else -.75,-.02 if dead else -.05))
     if b.name==f'hand_{side}':target=Vector((sign*.04,-.3,-.18))
    parentq=qmap[b.parent.name] if b.parent else Quaternion();rel=restq[b.parent.name].inverted()@restq[b.name] if b.parent else restq[b.name];base=parentq@rel
    world=(dirs[b.name].rotation_difference(target.normalized())@restq[b.name]) if target else base@extra
    qmap[b.name]=world;b.rotation_mode='QUATERNION';b.rotation_quaternion=base.inverted()@world;b.location=(0,0,0)
    if b.name=='pelvis':
     # v109 골반 이동은 로컬 축으로 바꿔 발이 바닥을 따라가게 한다.
     b.location=b.bone.matrix_local.to_3x3().inverted()@Vector((0,0,hipz));b.keyframe_insert('location',frame=f)
    if target or b.name in ['pelvis','spine_01','neck_01','head']:b.keyframe_insert('rotation_quaternion',frame=f)
  for fc in act.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,act);strip.action_frame_start=0;strip.action_frame_end=frames
 rig.animation_data.action=None
 for track in rig.animation_data.nla_tracks:track.mute=True
 original=mesh.data.copy();tri=sum(len(p.vertices)-2 for p in original.polygons)
 for lod,target in enumerate([9000,3000,1000]):
  mesh.data=original.copy();bpy.context.view_layer.objects.active=mesh
  dec=mesh.modifiers.new('거리별 삼각형 축소','DECIMATE');dec.ratio=min(1,target/tri);bpy.ops.object.modifier_apply(modifier=dec.name)
  for track in rig.animation_data.nla_tracks:track.mute=False
  bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(out/f'infected-{variant}-lod{lod}.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_yup=True,export_apply=False)
  for track in rig.animation_data.nla_tracks:track.mute=True
  report.append({'file':f'infected-{variant}-lod{lod}.glb','triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),'bones':len(bones),'clips':list(clips)})
(out/'build.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
