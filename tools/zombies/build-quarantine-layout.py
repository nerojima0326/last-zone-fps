# v110 목표 동선·건물·설비·실제 충돌을 같은 배치 자료로 만든다.
import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'assets/zombies/maps/quarantine';out.mkdir(parents=True,exist_ok=True)
items=[];boxes=[];buildings=[]
def item(kind,x,z,y=8,yaw=0,scale=(1,1,1)):
 items.append(dict(kind=kind,p=[x,y,z],yaw=yaw,scale=list(scale)))
def collider(x,z,w,d,y,h,mat='hard'):
 boxes.append(dict(minX=x-w/2,maxX=x+w/2,minZ=z-d/2,maxZ=z+d/2,minY=y,maxY=y+h,mat=mat))
def wall_line(x,z,length,yaw,door=False,stories=1):
 spans=[]
 if door:
  remaining=(length-8)/2
  for sign in [-1,1]:
   n=max(1,math.ceil(remaining/8))
   for i in range(n):spans.append((sign*(4+remaining/n*(i+.5)),remaining/n,False))
  spans.append((0,8,True))
 else:
  n=math.ceil(length/8)
  for i in range(n):spans.append((-length/2+length/n*(i+.5),length/n,False))
 for offset,width,opening in spans:
  px=x+math.cos(yaw)*offset;pz=z-math.sin(yaw)*offset
  for floor in range(stories):
   kind='door' if opening and floor==0 else 'window'
   item(kind,px,pz,8+floor*4.8,yaw,(width/8,1,1))
  if opening:
   for sign in [-1,1]:
    dx=sign*3*width/8;cx=px+math.cos(yaw)*dx;cz=pz-math.sin(yaw)*dx
    collider(cx,cz,abs(math.cos(yaw))*width/4+abs(math.sin(yaw))*.4,abs(math.sin(yaw))*width/4+abs(math.cos(yaw))*.4,8,4.8*stories)
   collider(px,pz,abs(math.cos(yaw))*width/2+abs(math.sin(yaw))*.4,abs(math.sin(yaw))*width/2+abs(math.cos(yaw))*.4,11.6,4.8*stories-3.6)
  else:collider(px,pz,abs(math.cos(yaw))*width+abs(math.sin(yaw))*.4,abs(math.sin(yaw))*width+abs(math.cos(yaw))*.4,8,4.8*stories)
def building(name,x,z,w,d,stories=1):
 buildings.append(dict(name=name,x=x,z=z,w=w,d=d,h=4.8*stories))
 wall_line(x,z+d/2,w,0,True,stories);wall_line(x,z-d/2,w,math.pi,True,stories)
 wall_line(x-w/2,z,d,math.pi/2,False,stories);wall_line(x+w/2,z,d,-math.pi/2,False,stories)
 item('roof',x,z,8+stories*4.8,0,(w/8,1,d/8));collider(x,z,w,d,8+stories*4.8,.55)
 for dx in [-w*.24,w*.24]:item('vent',x+dx,z,8+stories*4.8+.55)
for args in [
 ('검역 경비실',-216,-305,16,16,1),('제염 연구동',-130,-310,32,24,2),('의무 보급동',-80,-248,24,12,1),
 ('격리 병동',-34,-300,40,24,2),('소각 설비동',166,-282,48,24,2),('서측 연료 창고',-65,-178,16,12,1),
 ('배전 설비동',155,-145,48,32,2),('정비 공장',-150,-130,48,32,2),('냉동 창고',-30,-90,48,24,1),
 ('남부 처리동',-160,88,48,32,2),('통신 연구동',-125,198,56,24,2),('검체 보관동',10,145,48,32,2),
 ('중앙 반응동',170,150,64,32,3),('비상 격납고',-60,282,64,40,2),('폐쇄 격리동',-180,280,32,48,2),
 ('철도 출하동',210,295,32,64,2),('교량 감시실',190,55,24,24,1),('착륙장 통제실',48,270,24,16,1)]:building(*args)
for z in range(-346,347,8):
 for x in [-240,240]:item('perimeter',x,z,8,math.pi/2);collider(x,z,.65,8,8,6)
for x in range(-236,237,8):
 for z in [-350,350]:item('perimeter',x,z);collider(x,z,8,.65,8,6)
item('checkpoint',-185,-290);collider(-193.4,-290,1,2,8,6);collider(-176.6,-290,1,2,8,6);collider(-185,-290,18,2.2,13.6,.8)
for z in [-315,-287,-259,-231]:
 item('railcar',-211,z);collider(-211,z,3.1,8.5,8,3.6)
for x,z in [(-168,-230),(-130,-205),(-12,-240),(202,-210),(202,-230),(-190,-76),(-162,-68),(172,80),(206,218),(-175,218),(-150,244),(194,230)]:
 item('container',x,z);collider(x,z,6.1,2.5,8,2.7)
for x,z in [(85,290),(62,310),(128,315)]:
 item('container',x,z);collider(x,z,6.1,2.5,8,2.7)
item('container',85,290,10.65);collider(85,290,6.1,2.5,10.65,2.7)
for x,z in [(-205,-200),(-120,-210),(110,-205),(110,-156),(-25,-128),(110,96),(-62,102),(45,238)]:
 item('pipes',x,z)
 for dx in [-3.7,3.7]:
  for dz in [-1,1]:collider(x+dx,z+dz,.2,.2,8,2.9)
 collider(x,z,8,2.5,10.8,.6)
for x,z in [(205,-286),(220,-286),(215,-130),(-206,104),(202,116),(220,116)]:
 item('tank',x,z);collider(x,z,4.2,4.2,8,8.5)
for x in [-195,-40,75,220]:
 for z in [-330,-205,-70,62,212,332]:item('lamp',x,z)
for z in range(-330,335,24):
 for x in [-228,228]:item('snowbank',x,z,8,math.pi/2,(1.1,.8,1.2))
for x in range(-220,225,24):
 for z in [-338,338]:item('snowbank',x,z,8,0,(1.4,.8,1))
for x,z in [(-105,-235),(-46,-202),(170,-104),(184,-190),(-130,120),(143,262),(-130,250)]:
 for dx in [-.7,.7]:item('drum',x+dx,z);collider(x+dx,z,.68,.68,8,.95)
# v110 실제 배수로 철교와 추락 후 복귀할 완만한 정비 경사로.
for z in [-28,28]:
 for a,b in [(-400,-210),(-196,196),(210,400)]:collider((a+b)/2,z,b-a,.25,2,6)
bridge=dict(x=110,z=0,y=8.2,ux=0,uz=1,half=42,w=14)
item('deck',110,0,7.4,0,(14/8,2,84/8));collider(110,0,14,84,7.4,.8)
for z in range(-38,39,8):
 for x in [102.8,117.2]:item('railing',x,z,8.2,math.pi/2);collider(x,z,.14,8,8.2,1.15,'metal')
roads=[dict(ax=a,az=b,bx=c,bz=d,w=w) for a,b,c,d,w in [
 (-185,-330,-185,-265,12),(-185,-265,-80,-225,12),(-80,-225,110,-215,14),(110,-215,110,100,14),
 (-65,-160,110,-160,10),(110,-190,200,-190,10),(110,100,-110,100,12),(-110,100,-110,235,12),
 (-110,235,100,235,14),(100,235,100,325,16)]]
points=dict(start=[-185,-310],rally=[-185,-265],supply=[-80,-245],generator=[110,-105],fuel=[[-65,-160],[200,-190]],tower=[-110,130],harbor=[100,300])
layout=dict(id='whiteout-quarantine',title='백야 검역단지',version=110,size=800,ground=8,bounds=dict(minX=-238,maxX=238,minZ=-348,maxZ=348),nav=dict(x0=-250,z0=-360,nx=1000,nz=1440,step=.5,cacheVersion=110,cacheFile='maps/quarantine/nav-grid.bin.gz'),bridge=bridge,points=points,roads=roads,buildings=buildings,items=items,colliders=boxes)
(out/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,separators=(',',':'))+'\n')
for phase in range(6):
 props=[dict(kind='warning',offset=[-10,-9],yaw=.2,size=1)]
 if phase in [0,1,4]:props.append(dict(kind='barrier',offset=[-13,8],yaw=.3,size=1))
 if phase==2:props.append(dict(kind='barrier',offset=[18,10],yaw=.1,size=1))
 (out/('sector-'+str(phase)+'.json')).write_text(json.dumps(dict(stage=phase,props=props),separators=(',',':'))+'\n')
print('백야 배치:',len(items),'개 인스턴스,',len(boxes),'개 충돌')
