# v109 실제 크기의 발전기·연료통·항구 구조물을 블렌더에서 만든다.
import bpy, math, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root/'assets/zombies/city-kit.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
colors={'paint':(.17,.22,.18,1),'iron':(.11,.12,.12,1),'rubber':(.028,.03,.028,1),'chrome':(.43,.45,.43,1),'orange':(.51,.25,.08,1),'glass':(.065,.16,.21,1),'lamp':(.8,.42,.12,1),'blood':(.18,.025,.02,1),'cement':(.29,.28,.25,1)}
mats={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=c;m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=c;bs.inputs['Roughness'].default_value=.74 if k!='glass' else .2;bs.inputs['Metallic'].default_value=.45 if k in ['iron','chrome','glass'] else .1;mats[k]=m
parts=[]
def cube(p,s,m='iron',bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[m]);parts.append(o)
 if bevel:mod=o.modifiers.new('모서리 마모','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def cyl(p,r,h,m='iron',rot=None,n=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=p);o=bpy.context.object;o.data.materials.append(mats[m]);parts.append(o)
 if rot:o.rotation_euler=rot
 return o
def finish(name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');parts.clear();return o
cube((0,0,.14),(1.6,2.6,.28));cube((0,0,.82),(1.35,2.2,1.25),'paint',.08)
for side in [-1,1]:
 for i in range(11):cube((side*.686,-.75+i*.14,.9),(.02,.07,.5),'iron',.003)
 for y in [-.82,.82]:cyl((side*.8,y,.23),.24,.18,'rubber',(0,math.pi/2,0))
cube((0,-1.13,.93),(.8,.045,.65),'iron');cyl((-.23,-1.17,1.05),.095,.035,'chrome',(math.pi/2,0,0));cube((.23,-1.17,.95),(.09,.06,.13),'orange');cyl((.4,.7,1.7),.05,.7,'iron');cyl((.4,.7,2.03),.09,.07,'iron');finish('generator')
cube((0,0,.3),(.34,.21,.6),'paint',.045);cube((0,0,.63),(.27,.13,.075),'paint');cube((0,0,.66),(.13,.08,.08),'iron');cyl((-.12,0,.64),.04,.04,'iron')
for x in [-.07,.07]:cube((x,-.11,.3),(.025,.025,.37),'iron',.006)
finish('fuel')
cube((0,0,.48),(3.1,.65,.96),'cement',.04)
for x in [-1.25,-.75,-.25,.25,.75,1.25]:
 o=cube((x,-.335,.57),(.3,.02,.62),'orange',.003);o.rotation_euler.y=-.42
finish('barrier')
for x in [-1,1]:
 for y in [-1,1]:cyl((x,y,1.8),.075,3.6,'iron')
for z in [.4,1.8,3.4]:
 for y in [-1,1]:cube((0,y,z),(2.1,.07,.07),'iron',.004)
 for x in [-1,1]:cube((x,0,z),(.07,2.1,.07),'iron',.004)
cyl((0,0,5),.07,3,'chrome');cube((0,0,3.35),(2.8,2.8,.12),'iron');cube((0,.4,3.8),(.8,.4,.7),'paint');finish('tower')
cube((0,0,.16),(.55,.38,.32),'paint');cube((0,0,.34),(.57,.4,.045),'iron');cube((0,-.21,.16),(.4,.015,.07),'chrome');finish('supply')
cube((0,0,.52),(1.4,.2,1),'iron');cube((0,-.12,.52),(1.2,.03,.72),'blood');finish('warning')
# v109 헬기는 실제 치수·기수 창·스키드·회전익을 갖춘 원본 제작물이다.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(0,0,1.55));o=bpy.context.object;o.scale=(1.16,2.55,1.12);o.data.materials.append(mats['paint']);parts.append(o)
for side in [-1,1]:
 cube((side*1.02,-1.02,1.9),(.035,1.45,.82),'glass',.09);cube((side*1.14,.45,1.55),(.035,1.3,1.35),'iron',.04);cube((side*1.17,.38,1.9),(.035,.92,.62),'glass',.04)
 cube((side*1.03,0,.15),(.1,4.6,.1),'iron');cyl((side*.85,-.8,.52),.055,.75,'chrome');cyl((side*.85,1.1,.52),.055,.75,'chrome')
cube((0,-2.3,1.92),(1.25,.04,.8),'glass',.09);o=cube((0,4,1.85),(.35,5,.4),'paint',.07);o.rotation_euler.x=.045;cube((0,6.1,2.6),(.07,1.1,1.5),'paint');cube((0,4.9,1.94),(3,.6,.08),'paint');cyl((0,.35,2.8),.11,.85,'chrome');finish('helicopter')
cube((0,0,0),(.15,11,.035),'iron');cube((0,0,0),(11,.15,.035),'iron');finish('rotor')
cube((0,0,.02),(12,12,.04),'iron',.002)
for x in [-.8,.8]:cube((x,0,.05),(.2,3,.015),'chrome',0)
cube((0,0,.05),(1.6,.25,.015),'chrome',0);finish('helipad')
out.parent.mkdir(parents=True,exist_ok=True);bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_yup=True)
