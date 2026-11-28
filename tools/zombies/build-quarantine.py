# v110 백야 검역단지 건축 모듈을 블렌더 원본으로 제작한다.
import bpy, math, sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.read_factory_settings(use_empty=True)
palette={'cement':(.38,.43,.45,1),'steel':(.12,.17,.20,1),'cladding':(.29,.37,.40,1),'snow':(.76,.82,.84,1),'glass':(.045,.11,.15,1),'rust':(.38,.14,.075,1),'red':(.48,.035,.025,1),'lamp':(.8,.9,1,1),'amber':(.94,.38,.045,1)}
mats={}
for name,color in palette.items():
 m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=.92 if name in ['cement','snow'] else .68;p.inputs['Metallic'].default_value=.6 if name in ['steel','cladding','rust'] else 0;mats[name]=m
parts=[]
def box(p,s,material='steel',bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[material]);parts.append(o)
 if bevel:
  mod=o.modifiers.new('모서리 마모','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def cyl(p,r,h,material='steel',rot=None,n=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=p);o=bpy.context.object;o.data.materials.append(mats[material]);parts.append(o)
 if rot:o.rotation_euler=rot
 for face in o.data.polygons:face.use_smooth=len(face.vertices)==4
 return o
def finish(name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');parts.clear()
# v110 모든 벽 모듈은 폭 8m·높이 4.8m를 기준으로 한다.
for name in ['wall','window','door']:
 if name=='door':
  for x in [-3,3]:box((x,0,2.4),(2,.4,4.8),'cement',.055)
  box((0,0,4.2),(4,.4,1.2),'cement',.055)
  for x in [-2.06,2.06]:box((x,-.24,1.8),(.12,.12,3.6))
  box((0,-.24,3.65),(4.2,.12,.12))
 else:
  box((0,0,2.4),(8,.4,4.8),'cement',.055)
  if name=='window':
   box((0,-.24,3.03),(5.1,.06,1.45),'steel');box((0,-.28,3.03),(4.85,.025,1.21),'glass',.008)
   for x in [-1.62,0,1.62]:box((x,-.31,3.03),(.065,.04,1.28),'cladding',.004)
  for x in [-3.9,3.9]:box((x,-.24,2.4),(.16,.11,4.8),'steel',.01)
  box((0,-.25,.32),(7.8,.08,.45),'cladding',.01)
 for x in [-3.6,3.6]:
  for z in [.65,4.3]:cyl((x,-.27,z),.045,.035,'rust',(math.pi/2,0,0),8)
 box((0,0,4.84),(8.12,.54,.08),'snow',.035);finish(name)
box((0,0,.16),(8,8,.32),'steel',.025)
for y in [-3.2,-1.6,0,1.6,3.2]:box((0,y,.37),(8,.08,.1),'cladding',.008)
box((0,0,.46),(8.03,8.03,.09),'snow',.025);finish('roof')
box((0,0,.2),(8,8,.4),'cement',.04);finish('deck')
# v110 외벽은 기둥·조립 이음·상부 철선을 포함한다.
box((0,0,2.7),(8,.65,5.4),'cement',.05)
for x in [-3.85,3.85]:box((x,0,2.85),(.3,.85,5.7),'cladding',.02)
for z in [1.8,3.6]:box((0,-.34,z),(7.7,.025,.035),'steel',.004)
for z in [5.65,5.95]:cyl((0,0,z),.023,8,'steel',(0,math.pi/2,0),6)
box((0,0,5.43),(8.1,.82,.08),'snow',.02);finish('perimeter')
# v110 도로 위 배관은 중앙 통행 높이 2.8m를 확보한다.
for x in [-3.7,3.7]:
 for y in [-1,1]:box((x,y,1.5),(.16,.16,3))
 box((x,0,2.8),(.23,2.5,.23))
for y,r in [(-.68,.2),(0,.27),(.72,.16)]:
 cyl((0,y,3.12),r,8,'cladding',(0,math.pi/2,0),16)
 for x in [-3.3,0,3.3]:cyl((x,y,3.12),r+.04,.08,'steel',(0,math.pi/2,0),16)
finish('pipes')
cyl((0,0,4),2.0,8,'cladding',n=32)
for z in [1,4,7.6]:cyl((0,0,z),2.05,.12,'steel',n=32)
for x in [-.3,.3]:cyl((x,-2.08,4.25),.04,8.5,'steel',n=8)
for z in [i*.38 for i in range(23)]:cyl((0,-2.08,z),.025,.6,'rust',(0,math.pi/2,0),8)
cyl((0,0,8.12),.2,.4);box((0,0,8.23),(1,1,.1),'snow');finish('tank')
# v110 컨테이너에는 골·잠금봉·모서리 주물을 넣는다.
box((0,0,1.3),(6.1,2.44,2.6),'cladding',.035)
for x in [-2.9+i*.24 for i in range(25)]:
 for y in [-1.24,1.24]:box((x,y,1.3),(.065,.045,2.42),'steel',.005)
for y in [-1.12,1.12]:
 for x in [-3.06,3.06]:box((x,y,1.32),(.1,.1,2.62),'steel',.005)
for y in [-.7,.7]:cyl((3.09,y,1.28),.035,2.25,'rust',n=8)
box((0,0,2.64),(6.05,2.45,.1),'snow');finish('container')
box((0,0,1.1),(3,2.2,2.2),'cladding')
for i in range(15):box((-1.32+i*.19,-1.12,1.15),(.07,.04,1.6),'steel',.004)
cyl((0,0,2.28),.65,.16,'steel',n=24)
for a in range(8):
 o=box((0,0,2.38),(1.1,.12,.045),'rust',.004);o.rotation_euler.z=a*math.pi/4
box((0,0,2.48),(3.06,2.28,.08),'snow');finish('vent')
# v110 폐화차와 제염 정문은 새 맵의 진입 실루엣이다.
box((0,0,.8),(3.0,8.5,.4),'steel');box((0,0,2.2),(2.9,8,2.5),'rust',.035)
for y in [-3.6,-2.4,-1.2,0,1.2,2.4,3.6]:
 for x in [-1.47,1.47]:box((x,y,2.15),(.07,.12,2.45),'steel',.008)
for y in [-2.7,2.7]:
 for x in [-1.45,1.45]:cyl((x,y,.5),.48,.22,'steel',(0,math.pi/2,0),16)
box((0,0,3.51),(3,8.15,.12),'snow');finish('railcar')
for x in [-8.4,8.4]:box((x,0,3),(1,2,6),'cement',.06)
box((0,0,6),(18,2.2,.7),'cladding',.04);box((0,-1.14,5.95),(9,.08,.75),'red')
for x in [-7.6,7.6]:box((x,-.9,5.2),(.5,.45,.25),'lamp')
box((0,0,6.42),(18.1,2.3,.12),'snow');finish('checkpoint')
for x in [-4,0,4]:cyl((x,0,.6),.045,1.2)
for z in [.55,1.15]:cyl((0,0,z),.035,8,'cladding',(0,math.pi/2,0),8)
finish('railing')
cyl((0,0,3.2),.075,6.4,'steel',n=10)
box((.3,0,6.35),(1,.55,.3),'steel');box((.3,-.29,6.3),(.85,.025,.18),'lamp',.004)
cyl((0,0,6.75),.12,.22,'red',n=12);finish('lamp')
cyl((0,0,.45),.32,.9,'rust',n=16)
for z in [.08,.35,.7,.86]:cyl((0,0,z),.335,.04,'steel',n=16)
finish('drum')
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(0,0,.18));o=bpy.context.object;o.scale=(2.8,1.2,.65);o.data.materials.append(mats['snow']);parts.append(o)
for v in o.data.vertices:v.co.z=max(-.26,v.co.z)
finish('snowbank')
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
print('검역단지 모듈 GLB:',out)
