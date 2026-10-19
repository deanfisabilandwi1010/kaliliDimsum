"""Re-import final GLB, test its hierarchy and motion, and render four states."""
import bpy,bmesh,math,json,struct,os
from pathlib import Path
import numpy as np
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent.parent
glb=OUT/'kalili-interactive-steamer.glb';data=glb.read_bytes()
jl=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+jl]);bl=struct.unpack_from('<I',data,20+jl)[0];binary=data[28+jl:28+jl+bl]
state=json.loads((OUT/'state-transforms.json').read_text())
# Check the exported default itself before any preview/state helper can repair it.
for node in g['nodes']:
 if node['name'] in state['states']['closed']:
  p=state['states']['closed'][node['name']]
  assert np.allclose(node.get('translation',[0,0,0]),p['translation'],atol=1e-8),(node['name'],'default translation mismatch')
  assert np.allclose(node.get('scale',[1,1,1]),p['scale'],atol=1e-8)
  q=np.array(node.get('rotation',[0,0,0,1]));wanted=np.array(p['rotation'])
  assert min(np.max(abs(q-wanted)),np.max(abs(q+wanted)))<1e-6
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
 width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];size=np.dtype(dt).itemsize
 return np.ndarray((a['count'],width),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',size*width),size)).copy()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb))
scene=bpy.context.scene
expectedroot={'steamer_base','steamer_lid','brand_badge','dimsum_hero_root',*(f'dimsum_support_{i:02d}' for i in range(1,5))}
expectedhero={'wrapper_shell','meat_filling','vegetable_pieces','carrot_mix','carrot_topping'}
root=bpy.data.objects['kalili_steamer_root'];hero=bpy.data.objects['dimsum_hero_root']
assert set(o.name for o in root.children)==expectedroot
assert set(o.name for o in hero.children)==expectedhero
objects={o.name:o for o in scene.objects}
for o in objects.values():o.animation_data_clear()
def apply_state(name):
 for n,p in state['states'][name].items():
  o=objects[n];t=p['translation'];q=p['rotation'];o.location=(t[0],-t[2],t[1]);o.rotation_mode='QUATERNION';o.rotation_quaternion=(q[3],q[0],-q[2],q[1]);o.scale=p['scale']
 bpy.context.view_layer.update()
def apply_clip(name,time):
 c=next(a for a in g['animations'] if a['name']==name)
 for ch in c['channels']:
  s=c['samplers'][ch['sampler']];times=acc(s['input']).ravel();keys=acc(s['output']).reshape(len(times),3,-1)
  i=max(0,min(len(times)-2,np.searchsorted(times,time,side='right')-1));span=times[i+1]-times[i]
  u=max(0,min(1,float((time-times[i])/span)))
  value=(2*u**3-3*u**2+1)*keys[i,1]+(u**3-2*u**2+u)*span*keys[i,2]+(-2*u**3+3*u**2)*keys[i+1,1]+(u**3-u**2)*span*keys[i+1,0]
  ob=objects[g['nodes'][ch['target']['node']]['name']]
  if ch['target']['path']=='translation':ob.location=(value[0],-value[2],value[1])
  else:
   value/=np.linalg.norm(value);ob.rotation_mode='QUATERNION';ob.rotation_quaternion=(value[3],value[0],-value[2],value[1])
 bpy.context.view_layer.update()

report={'file_bytes':len(data),'hierarchy_verified':True,'default_closed_pose_verified':True,'nodes':{},'triangles_in_scene':0,'clips':{},'collision_sampling':{},'textures_embedded':all('bufferView' in x and 'uri' not in x for x in g['images'])}
for n,o in objects.items():
 if o.type!='MESH':continue
 o.data.calc_loop_triangles();tri=len(o.data.loop_triangles);report['triangles_in_scene']+=tri
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8)
 bad=sum(not e.is_manifold for e in bm.edges);bm.free()
 report['nodes'][n]={'triangles':tri,'parent':o.parent.name,'nonmanifold_edges_after_seam_weld':bad}
 if n in expectedhero:assert bad==0,(n,bad)
assert 40000<=report['triangles_in_scene']<=70000,report['triangles_in_scene']
assert len(data)<=6_000_000,len(data)
assert report['textures_embedded']
assert len(g['animations'])==3
expectedtracks={'entrance_open':{'steamer_lid'},'hero_lift':{'dimsum_hero_root'},'ingredients_cycle':expectedhero}
targets=[]
for c in g['animations']:
 ns={g['nodes'][ch['target']['node']]['name'] for ch in c['channels']};assert ns==expectedtracks[c['name']]
 paths={ch['target']['path'] for ch in c['channels']};assert 'scale' not in paths
 duration=max(float(acc(s['input']).max()) for s in c['samplers'])
 report['clips'][c['name']]={'duration':duration,'targets':sorted(ns),'paths':sorted(paths)}
 targets.append(ns)
 if c['name']=='ingredients_cycle':
  for s in c['samplers']:
   k=acc(s['output']).reshape(-1,3,3);assert np.array_equal(k[0,1],k[-1,1]);assert np.all(k[:,0]==0) and np.all(k[:,2]==0)
assert all(not targets[i]&targets[j] for i in range(3) for j in range(i+1,3))
apply_state('hero_lifted');apply_clip('ingredients_cycle',0)
start={n:objects[n].matrix_local.copy() for n in expectedhero}
apply_clip('ingredients_cycle',8)
report['reassembly_max_matrix_error']=max(max(abs(objects[n].matrix_local[r][c]-start[n][r][c]) for r in range(4) for c in range(4)) for n in expectedhero)
assert report['reassembly_max_matrix_error']==0
apply_state('closed');before={n:o.matrix_world.copy() for n,o in objects.items()}
objects['steamer_lid'].location.z+=.1;bpy.context.view_layer.update()
report['lid_moves_independently']=all(o.matrix_world==before[n] for n,o in objects.items() if n!='steamer_lid')
apply_state('closed');before={n:o.matrix_world.copy() for n,o in objects.items()};hero.location.z+=.028;bpy.context.view_layer.update()
report['hero_moves_without_basket']=all(objects[n].matrix_world==before[n] for n in expectedroot-{'dimsum_hero_root'})
apply_state('closed');before={n:o.matrix_world.copy() for n,o in objects.items()};objects['meat_filling'].location.x+=.010;bpy.context.view_layer.update()
report['hero_ingredients_independent']=all(objects[n].matrix_world==before[n] for n in objects if n!='meat_filling')
assert report['lid_moves_independently'] and report['hero_moves_without_basket'] and report['hero_ingredients_independent']

# BVH broad phase followed by triangle separating-axis tests. Construction joins
# within one object and intended ingredient nesting are not treated as collisions.
def tree(obs):
 verts=[];faces=[]
 for ob in obs:
  offset=len(verts);verts.extend([tuple(ob.matrix_world@v.co) for v in ob.data.vertices]);faces.extend([tuple(offset+i for i in t.vertices) for t in ob.data.loop_triangles])
 pts=np.array(verts);faces=np.array(faces,dtype=int)
 return BVHTree.FromPolygons(verts,faces.tolist(),all_triangles=True,epsilon=0),pts[faces]
def intersects(A,B):
 pairs=A[0].overlap(B[0])
 if not pairs:return 0
 pairs=np.array(pairs);a=A[1][pairs[:,0]];b=B[1][pairs[:,1]]
 ea=np.roll(a,-1,axis=1)-a;eb=np.roll(b,-1,axis=1)-b
 na=np.cross(ea[:,0],ea[:,1]);nb=np.cross(eb[:,0],eb[:,1])
 axes=[na,nb]
 for i in range(3):
  axes.extend([np.cross(ea[:,i],eb[:,j]) for j in range(3)])
  axes.extend([np.cross(na,ea[:,i]),np.cross(nb,eb[:,i])])
 alive=np.ones(len(a),dtype=bool)
 for axis in axes:
  length=np.linalg.norm(axis,axis=1);valid=length>1e-16
  axis=axis/np.maximum(length,1e-30)[:,None]
  ap=np.einsum('nij,nj->ni',a,axis);bp=np.einsum('nij,nj->ni',b,axis)
  separated=(ap.max(1)<bp.min(1)-1e-8)|(bp.max(1)<ap.min(1)-1e-8)
  alive&=~(valid&separated)
  if not alive.any():return 0
 return int(alive.sum())
static_names=['steamer_base','brand_badge']+[f'dimsum_support_{i:02d}' for i in range(1,5)]
apply_state('closed');static={n:tree([objects[n]]) for n in static_names}
collision_records=[]
for phase,times in [('entrance_open',np.linspace(0,2.4,19)),('hero_lift',np.linspace(0,1,11)),('ingredients_cycle',np.linspace(1,3.2,13))]:
 max_pairs=0
 for t in times:
  apply_state({'entrance_open':'closed','hero_lift':'open','ingredients_cycle':'hero_lifted'}[phase]);apply_clip(phase,float(t))
  if phase=='entrance_open':
   moving=tree([objects['steamer_lid']]);fixed={**static,'hero':tree([objects[n] for n in expectedhero])}
  else:
   moving=tree([objects[n] for n in expectedhero]);fixed={**static,'steamer_lid':tree([objects['steamer_lid']])}
  for n,target in fixed.items():
   count=intersects(moving,target);max_pairs=max(max_pairs,count)
   if count:collision_records.append({'phase':phase,'time':float(t),'target':n,'triangle_pairs':count})
 report['collision_sampling'][phase]={'samples':len(times),'maximum_external_triangle_intersections':max_pairs}
report['collision_records']=collision_records
report['steam_geometry_present']=False
report['shared_support_mesh_resources']=len({g['nodes'][next(i for i,n in enumerate(g['nodes']) if n['name']==f'dimsum_support_{j:02d}')]['mesh'] for j in range(1,5)})
(OUT/'validation-report.json').write_text(json.dumps(report,indent=2))
print('VALIDATION',json.dumps(report),flush=True)
if collision_records:raise RuntimeError('External motion intersections found; inspect validation-report.json')
if os.environ.get('STEAMER_SKIP_RENDER')=='1':raise SystemExit(0)

# Preview-only studio; no camera/light/background nodes are exported in the GLB.
scene.render.engine='CYCLES';scene.cycles.samples=int(os.environ.get('STEAMER_SAMPLES','24'));scene.cycles.use_denoising=True
scene.render.resolution_x=int(os.environ.get('STEAMER_RES','1200'));scene.render.resolution_y=scene.render.resolution_x;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Preview neutral studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.88,.91,1,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.32
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.25
def light(name,loc,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.06))-o.location).to_track_quat('-Z','Y').to_euler()
light('Soft key',(-.28,-.35,.55),5,.36);light('Gentle fill',(.4,-.12,.30),2.2,.30);light('Bamboo rim light',(0,.35,.50),6,.30)
d=bpy.data.cameras.new('Preview camera');camera=bpy.data.objects.new('Preview camera',d);scene.collection.objects.link(camera);scene.camera=camera;d.type='ORTHO';d.clip_start=.001
shots=[('closed',(.24,-.44,.31),(0,0,.037),.280),('open',(.27,-.50,.38),(.055,.028,.060),.405),('hero_lifted',(.19,-.54,.24),(.050,.020,.065),.405),('exploded',(.23,-.55,.37),(.050,.020,.090),.415)]
for name,position,target,scale in shots:
 apply_state(name);camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=scale
 scene.render.filepath=str(OUT/f'kalili-steamer-{name.replace("_","-")}.png');bpy.ops.render.render(write_still=True)
print('ALL_FOUR_STATES_RENDERED',flush=True)
