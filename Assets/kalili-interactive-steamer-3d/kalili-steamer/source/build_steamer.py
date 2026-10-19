"""Build the Kalili steamer in Blender 4.5. All authoring coordinates: Z-up/metres.
Run: blender -b -t 6 --python source/build_steamer.py
"""
import bpy,bmesh,math,json,struct,os,runpy
from pathlib import Path
from mathutils import Vector,Quaternion
import numpy as np
OUT=Path(__file__).resolve().parent.parent
SRC=OUT/'source';TEX=OUT/'textures'
bpy.ops.wm.open_mainfile(filepath=str(SRC/'hero-source.blend'))
scene=bpy.context.scene;scene.frame_set(0);scene.render.fps=30
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
hero=bpy.data.objects['kalili_dimsum_root'];hero.name='dimsum_hero_root'
names=['wrapper_shell','meat_filling','vegetable_pieces','carrot_mix','carrot_topping']
ingredients=[bpy.data.objects[n] for n in names]
for o in ingredients:o.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
root=bpy.data.objects.new('kalili_steamer_root',None);scene.collection.objects.link(root)
root['description']='Open the Kalili Steamer. Five shumai; illustrative ingredient breakdown, not a verified recipe.'
hero.parent=root

def active(ob):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
def apply_decimate(ob,ratio):
 active(ob);mod=ob.modifiers.new('Web geometry budget','DECIMATE');mod.ratio=ratio
 mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
def join(name,objects,pivot=(0,0,0),parent=None):
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object
 matrix=ob.matrix_world.copy();p=Vector(pivot)
 for v in ob.data.vertices:v.co=matrix@v.co-p
 ob.matrix_world.identity();ob.parent=parent;ob.location=p;ob.name=name;ob.data.name=name+'_mesh'
 return ob

# Four lower-detail supports share one mesh resource. They retain complete food
# geometry, while the hero keeps five independently transformable ingredient nodes.
support_parts=[]
for ob in ingredients:
 dup=ob.copy();dup.data=ob.data.copy();scene.collection.objects.link(dup)
 dup.animation_data_clear();dup.parent=None;dup.matrix_world=ob.matrix_world.copy()
 apply_decimate(dup,.105);support_parts.append(dup)
support=join('dimsum_support_01',support_parts,parent=root)
for v in support.data.vertices:v.co*=.91
support_positions=[(-.057,-.018,.010),(.057,-.018,.010),(-.036,.045,.010),(.036,.045,.010)]
support_rot=[.3,-.6,.9,-.2]
supports=[]
for i,(pos,rot) in enumerate(zip(support_positions,support_rot)):
 o=support if i==0 else support.copy()
 if i:scene.collection.objects.link(o)
 o.name='dimsum_support_%02d'%(i+1);o.parent=root;o.location=pos;o.rotation_euler=(0,0,rot)
 supports.append(o)
for ob,ratio in zip(ingredients,[.68,.74,.63,.58,.49]):apply_decimate(ob,ratio)
hero.location=(0,-.050,.010)

def img(nodes,filename,space='sRGB'):
 t=nodes.new('ShaderNodeTexImage');im=bpy.data.images.load(str(TEX/filename),check_existing=True)
 im.colorspace_settings.name=space;im.pack();t.image=im;return t
def mat(name,color,rough=.58,bamboo=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=rough
 if bamboo:
  l.new(img(n,'bamboo-basecolor.jpg').outputs['Color'],p.inputs['Base Color'])
  l.new(img(n,'bamboo-roughness.png','Non-Color').outputs['Color'],p.inputs['Roughness'])
  norm=n.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.34
  l.new(img(n,'bamboo-normal.png','Non-Color').outputs['Color'],norm.inputs['Color']);l.new(norm.outputs['Normal'],p.inputs['Normal'])
 return m
wood=mat('Honey bamboo | longitudinal grain',(.55,.34,.13),bamboo=True)
edge=mat('Bamboo rim end grain',(.48,.285,.10),.62)
binding=mat('Natural bamboo binding',(.59,.39,.17),.66)
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
red=mat('Kalili oxblood accent #891F1F',tuple(linear(c/255) for c in [137,31,31]),.64)
cream=mat('Badge logo surface | intentionally blank',tuple(linear(c/255) for c in [243,224,187]),.66)
for m in bpy.data.materials:
 if m.use_nodes:
  p=m.node_tree.nodes.get('Principled BSDF')
  if p:p.inputs['Metallic'].default_value=0;p.inputs['IOR'].default_value=1.5

def mesh(name,vs,fs,material,uv_fn=None,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);me.materials.append(material)
 for p in me.polygons:p.use_smooth=smooth
 if uv_fn:
  layer=me.uv_layers.new(name='UVMap')
  for p in me.polygons:
   uv=[uv_fn(me.vertices[me.loops[i].vertex_index].co) for i in p.loop_indices]
   if uv_fn.__name__=='lathe_uv' and max(v[0] for v in uv)-min(v[0] for v in uv)>2:
    uv=[(u+6 if u<3 else u,v) for u,v in uv]
   for i,xy in zip(p.loop_indices,uv):layer.data[i].uv=xy
 return ob
def lathe_uv(co):return ((math.atan2(co.y,co.x)/(2*math.pi))%1*6,co.z*32)
def lathe(name,profile,material=wood,segments=96):
 if profile[0]==profile[-1]:profile=profile[:-1]
 vs=[];fs=[]
 for r,z in profile:
  for i in range(segments):
   a=2*math.pi*i/segments;vs.append((r*math.cos(a),r*math.sin(a),z))
 for j in range(len(profile)):
  k=(j+1)%len(profile)
  for i in range(segments):q=(i+1)%segments;fs.append((j*segments+i,j*segments+q,k*segments+q,k*segments+i))
 return mesh(name,vs,fs,material,lathe_uv)

def rounded_box(name,location,size,material,bevel=.0006):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);ob=bpy.context.object;ob.name=name;ob.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=ob.modifiers.new('Rounded craftsmanship','BEVEL');mod.width=bevel;mod.segments=2
 bpy.ops.object.modifier_apply(modifier=mod.name);ob.data.materials.append(material)
 for p in ob.data.polygons:p.use_smooth=True
 mod=ob.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return ob

def tube(name,points,radius,material,sides=6):
 vs=[];fs=[];points=[Vector(p) for p in points]
 for i,p in enumerate(points):
  tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
  axis=tangent.cross(Vector((0,0,1)))
  if axis.length<.001:axis=tangent.cross(Vector((0,1,0)))
  axis.normalize();other=tangent.cross(axis).normalized()
  for j in range(sides):
   a=2*math.pi*j/sides;vs.append(tuple(p+radius*(axis*math.cos(a)+other*math.sin(a))))
 for i in range(len(points)-1):
  for j in range(sides):k=(j+1)%sides;fs.append((i*sides+j,i*sides+k,(i+1)*sides+k,(i+1)*sides+j))
 fs.append(tuple(range(sides-1,-1,-1)));fs.append(tuple((len(points)-1)*sides+j for j in range(sides)))
 return mesh(name,vs,fs,material,lambda c:(c.x*80,c.z*90))

def woven_strips(radius,z,pitch,width,amplitude,thickness,name):
 result=[]
 # Continuous solid strips follow alternating over-under profiles; no alpha planes.
 for axis in range(2):
  for k in range(-int(radius/pitch),int(radius/pitch)+1):
   fixed=k*pitch
   if abs(fixed)+width/2>=radius:continue
   end=math.sqrt(radius**2-(abs(fixed)+width/2)**2)
   count=max(4,math.ceil(2*end/(pitch/2)))
   vs=[];fs=[]
   for j in range(count+1):
    along=-end+2*end*j/count
    weave=amplitude*math.cos(math.pi*(along/pitch+k))*(1 if axis==0 else -1)
    for dw,dz in [(-width/2,-thickness/2),(width/2,-thickness/2),(width/2,thickness/2),(-width/2,thickness/2)]:
     xx,yy=(along,fixed+dw) if axis==0 else (fixed+dw,along)
     vs.append((xx,yy,z+weave+dz))
   for j in range(count):
    for a in range(4):b=(a+1)%4;fs.append((j*4+a,j*4+b,(j+1)*4+b,(j+1)*4+a))
   fs.append((3,2,1,0));fs.append(tuple(count*4+a for a in range(4)))
   def uv(co,axis=axis,k=k):return ((co.x if axis==0 else co.y)*12+.37,(co.y if axis==0 else co.x)*10+k*.19)
   result.append(mesh(name,vs,fs,wood,uv))
 return result

# Basket exterior and interior form a closed bamboo wall, with a modeled base.
base_parts=[lathe('Continuous bamboo basket wall',[
 (.1005,0),(.103,0),(.104,.0012),(.104,.0525),(.103,.0555),
 (.1015,.056),(.096,.056),(.0948,.0548),(.0948,.008),(.096,.001),(.1005,0)])]
for z in [.0025,.0505]:
 base_parts.append(lathe('Rolled bamboo rim',[(.104,z),(.105,z+.0005),(.105,z+.003),(.104,z+.0036),(.1035,z+.003),(.1035,z+.0005)],edge))
for z in [.014,.040]:
 base_parts.append(lathe('Thin oxblood binding',[(.104,z),(.1043,z+.00015),(.1043,z+.0012),(.104,z+.00135)],red))
for z in [.022,.032]:
 base_parts.append(lathe('Bamboo band joint',[(.104,z),(.10418,z+.00015),(.10418,z+.0006),(.104,z+.0008)],edge))
base_parts+=woven_strips(.096,.0086,.014,.0125,.00045,.0011,'Woven inner bamboo base')
# Restrained traditional lacing; these components belong to the base object.
for a in [-math.pi/2-.78,-math.pi/2+.78,math.pi/3,2*math.pi/3]:
 for sign in [-1,1]:
  pts=[]
  for t in np.linspace(0,1,10):
   aa=a+sign*(t-.5)*.060;r=.1045+.0005*math.sin(math.pi*t)
   pts.append((r*math.cos(aa),r*math.sin(aa),.024+.008*t))
  base_parts.append(tube('Bamboo hand lacing',pts,.00048,binding))
base=join('steamer_base',base_parts,parent=root)
triangulate=base.modifiers.new('Export-safe tangent triangulation','TRIANGULATE')
triangulate.keep_custom_normals=True

lid_parts=[lathe('Lid bamboo fitting ring',[
 (.105,-.008),(.107,-.008),(.108,-.007),(.108,.0105),(.107,.012),
 (.099,.012),(.0985,.011),(.0985,.008),(.100,.006),(.102,.001),(.1056,0),(.1056,-.007)])]
lid_parts+=woven_strips(.101,.0088,.010,.0088,.00065,.0008,'Over-under woven lid')
lid_parts.append(lathe('Lid bound edge',[(.108,.0035),(.1085,.004),(.1085,.0052),(.108,.0057)],edge))
lid_parts.append(lathe('Lid narrow oxblood accent',[(.108,.0002),(.1083,.00035),(.1083,.0012),(.108,.0014)],red))
# A real arch handle with an open centre and a rectangular bamboo cross-section.
vs=[];fs=[];N=44
for i in range(N+1):
 a=math.pi*i/N;yy=.019*math.cos(a);zz=.0095+.014*math.sin(a)
 for xoff,d in [(-.003,-.0007),(.003,-.0007),(.003,.0007),(-.003,.0007)]:
  vs.append((xoff,yy+math.cos(a)*d,zz+math.sin(a)*d))
for i in range(N):
 for j in range(4):k=(j+1)%4;fs.append((i*4+j,i*4+k,(i+1)*4+k,(i+1)*4+j))
fs.extend([(3,2,1,0),tuple(N*4+i for i in range(4))])
lid_parts.append(mesh('Arched bamboo lid handle',vs,fs,wood,lambda c:(c.y*25,c.x*50)))
for y in [-.018,.018]:lid_parts.append(rounded_box('Handle bound foot',(0,y,.0105),(.008,.004,.002),binding,.0005))
lid=join('steamer_lid',lid_parts,parent=root);lid.location=(0,0,.056)

badgeparts=[rounded_box('Badge oxblood border',(0,-.1056,.029),(.024,.0024,.015),red,.002),rounded_box('Blank logo application face',(0,-.1071,.029),(.0208,.0004,.0118),cream,.0013)]
badge=join('brand_badge',badgeparts,(0,-.1056,.029),root)
# Planar front UV coordinates for applying the original supplied logo later.
for p in badge.data.polygons:
 if badge.data.materials[p.material_index]==cream:
  for i in p.loop_indices:
   c=badge.data.vertices[badge.data.loops[i].vertex_index].co
   badge.data.uv_layers.active.data[i].uv=(c.x/.0208+.5,c.z/.0118+.5)
badge['logo_surface_material']=cream.name;badge['logo_applied']=False

def yup(v):return [float(v[0]),float(v[2]),float(-v[1])]
def quatx(degrees):a=math.radians(degrees)/2;return [math.sin(a),0,0,math.cos(a)]
ingredient_delta={
 'wrapper_shell':(0,0,-.012),'meat_filling':(0,0,.045),
 'vegetable_pieces':(-.054,0,.070),'carrot_mix':(.054,0,.070),'carrot_topping':(0,0,.105)}
clips=[]
lidtimes=[0,.12,.24,.85,1.95,2.4]
lidvalues=[(0,0,.056),(0,0,.0565),(0,0,.0561),(0,.010,.145),(.132,.087,.108),(.130,.085,.105)]
clips.append({'name':'entrance_open','duration':2.4,'tracks':[
 {'node':'steamer_lid','path':'translation','times':lidtimes,'values':[yup(v) for v in lidvalues]},
 {'node':'steamer_lid','path':'rotation','times':lidtimes,'values':[quatx(a) for a in [0,0,0,0,22,20]]}]})
clips.append({'name':'hero_lift','duration':1.0,'tracks':[{'node':'dimsum_hero_root','path':'translation','times':[0,1],'values':[yup((0,-.05,.010)),yup((0,-.05,.038))]}]})
ingredient_tracks=[]
for ob in ingredients:
 a=ob.location.copy();e=a+Vector(ingredient_delta[ob.name])
 ingredient_tracks.append({'node':ob.name,'path':'translation','times':[0,1,3.2,4.8,7.2,8],'values':[yup(p) for p in [a,a,e,e,a,a]]})
clips.append({'name':'ingredients_cycle','duration':8,'tracks':ingredient_tracks})
state={'units':'metres','coordinate_system':'glTF Y-up; quaternion x,y,z,w','front_direction':'+Z','hero_lift_metres':.028,'basket_height_metres':.056,'clips':clips,'usage_order':['entrance_open','hero_lift','ingredients_cycle'],'steam_included':False,'recipe_verified':False}
state['states']={}
defaults={o.name:{'translation':yup(o.location),'rotation':quatx(0),'scale':list(o.scale)} for o in [base,lid,badge,hero]+ingredients+supports}
# Retain support rotations in the documented default transforms.
for o in supports:
 q=o.rotation_euler.to_quaternion();defaults[o.name]['rotation']=[q.x,q.z,-q.y,q.w]
import copy
state['states']['closed']=copy.deepcopy(defaults)
state['states']['open']=copy.deepcopy(defaults)
state['states']['open']['steamer_lid'].update(translation=yup(lidvalues[-1]),rotation=quatx(20))
state['states']['hero_lifted']=copy.deepcopy(state['states']['open'])
state['states']['hero_lifted']['dimsum_hero_root']['translation']=yup((0,-.05,.038))
state['states']['exploded']=copy.deepcopy(state['states']['hero_lifted'])
for tr in ingredient_tracks:state['states']['exploded'][tr['node']]['translation']=tr['values'][2]
(OUT/'state-transforms.json').write_text(json.dumps(state,indent=2))

# Native Blender source has a convenient sequential NLA demonstration:
# lid 0..72 frames, hero 72..102, ingredients 102..342 (30 fps).
for clip,frame_start in zip(clips,[0,72,102]):
 grouped={}
 for tr in clip['tracks']:grouped.setdefault(tr['node'],[]).append(tr)
 for name,tracks in grouped.items():
  ob=bpy.data.objects[name]
  for tr in tracks:
   for t,val in zip(tr['times'],tr['values']):
    if tr['path']=='translation':ob.location=(val[0],-val[2],val[1]);path='location'
    else:ob.rotation_mode='QUATERNION';ob.rotation_quaternion=(val[3],val[0],-val[2],val[1]);path='rotation_quaternion'
    ob.keyframe_insert(path,frame=t*30)
  action=ob.animation_data.action;action.name=clip['name']+' | '+name
  for fc in action.fcurves:
   keys=fc.keyframe_points
   for i,kp in enumerate(keys):
    x,y=kp.co;previous=keys[i-1].co.x if i else x-3;following=keys[i+1].co.x if i<len(keys)-1 else x+3
    kp.interpolation='BEZIER';kp.handle_left_type='FREE';kp.handle_right_type='FREE'
    kp.handle_left=(x-(x-previous)/3,y);kp.handle_right=(x+(following-x)/3,y)
  track=ob.animation_data.nla_tracks.new();track.name=clip['name']
  strip=track.strips.new(clip['name'],frame_start,action);strip.extrapolation='HOLD'
  ob.animation_data.action=None
scene.frame_start=0;scene.frame_end=342;scene.frame_set(0)
for name,pose in defaults.items():
 ob=bpy.data.objects[name];tr=pose['translation'];ob.location=(tr[0],-tr[2],tr[1])
 q=pose['rotation'];ob.rotation_mode='QUATERNION';ob.rotation_quaternion=(q[3],q[0],-q[2],q[1])
bpy.context.view_layer.update()
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=.45;area.spaces.active.region_3d.view_location=(0,0,.045);area.spaces.active.clip_start=.001
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
for im in bpy.data.images:
 if im.source=='FILE':
  local=TEX/Path(im.filepath).name
  if local.exists():im.filepath=str(local)
  im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kalili-interactive-steamer.blend'),compress=True)
bpy.ops.object.select_all(action='SELECT')
glb=OUT/'kalili-interactive-steamer.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_tangents=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO')

# Write three disjoint glTF animation clips, with exact zero-tangent holds.
data=glb.read_bytes();jlen=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jlen]);blen=struct.unpack_from('<I',data,20+jlen)[0];binary=bytearray(data[28+jlen:28+jlen+blen])
def accessor(a,typ,bounds=False):
 a=np.array(a,dtype='<f4')
 while len(binary)%4:binary.append(0)
 offset=len(binary);binary.extend(a.tobytes());bv=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes})
 acc={'bufferView':bv,'componentType':5126,'count':len(a),'type':typ}
 if bounds:acc.update(min=[float(a.min())],max=[float(a.max())])
 ai=len(doc['accessors']);doc['accessors'].append(acc);return ai
doc['animations']=[]
for clip in clips:
 anim={'name':clip['name'],'samplers':[],'channels':[],'extras':{'loop':False,'durationSeconds':clip['duration'],'playback':'Configure non-looping playback in the application.'}}
 for tr in clip['tracks']:
  ni=next(i for i,n in enumerate(doc['nodes']) if n['name']==tr['node']);ta=accessor(tr['times'],'SCALAR',True)
  width=4 if tr['path']=='rotation' else 3;values=[]
  for v in tr['values']:values.extend([[0]*width,v,[0]*width])
  va=accessor(values,'VEC4' if width==4 else 'VEC3');si=len(anim['samplers'])
  anim['samplers'].append({'input':ta,'output':va,'interpolation':'CUBICSPLINE'})
  anim['channels'].append({'sampler':si,'target':{'node':ni,'path':tr['path']}})
 doc['animations'].append(anim)
doc['asset']['generator']='Kalili bamboo steamer | Blender 4.5 | explicit disjoint glTF clips'
doc['buffers'][0]['byteLength']=len(binary);j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\x00'*((-len(binary))%4)
glb.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
print('EXPORTED',glb,glb.stat().st_size,flush=True)
runpy.run_path(str(SRC/'verify_render.py'),run_name='__main__')
