"""Kalili open-top shumai. Run with Blender 4.5: blender -b -t 4 --python build_model.py

All coordinates below are Blender Z-up in metres. GLB export converts to Y-up.
The ingredient breakdown is illustrative; it is not a verified recipe.
"""
import bpy, bmesh, math, random, json, struct, os
from pathlib import Path
from mathutils import Vector, noise
import numpy as np

OUT = Path(__file__).resolve().parent.parent
TEX = OUT/'textures'
random.seed(6081)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
scene.render.fps=30
scene.frame_start=0; scene.frame_end=240
root = bpy.data.objects.new('kalili_dimsum_root',None)
scene.collection.objects.link(root)
root['description']='Kalili Original inspired open-top shumai; illustrative ingredient breakdown, not a verified recipe.'

def image_node(nodes, file, colorspace='sRGB'):
    n=nodes.new('ShaderNodeTexImage')
    im=bpy.data.images.load(str(TEX/file),check_existing=True)
    im.colorspace_settings.name=colorspace
    im.pack(); n.image=im; n.interpolation='Linear'
    return n

def material(name, color, colorfile=None, rough=.59, normal_strength=.15):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1)
    b.inputs['Metallic'].default_value=0
    b.inputs['Roughness'].default_value=rough
    b.inputs['IOR'].default_value=1.45
    if colorfile:l.new(image_node(n,colorfile).outputs['Color'],b.inputs['Base Color'])
    if colorfile:
        l.new(image_node(n,'food-roughness.png','Non-Color').outputs['Color'],b.inputs['Roughness'])
    tex=image_node(n,'food-normal.png','Non-Color')
    norm=n.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=normal_strength
    l.new(tex.outputs['Color'],norm.inputs['Color']);l.new(norm.outputs['Normal'],b.inputs['Normal'])
    return m

m_wrapper=material('Steamed ivory wrapper',(0.84,.74,.54),'wrapper-basecolor.png',normal_strength=.18)
m_meat=material('Warm cooked minced filling',(.72,.57,.39),'meat-basecolor.png',normal_strength=.45)
m_green=[material('Chopped green vegetable '+str(i+1),c,rough=.6,normal_strength=.12) for i,c in enumerate([(.13,.28,.045),(.23,.37,.065),(.09,.21,.035)])]
m_carrot=[material('Carrot '+str(i+1),c,rough=.58,normal_strength=.12) for i,c in enumerate([(.95,.245,.022),(.96,.33,.035),(.78,.17,.012)])]

def make_mesh(name, verts, faces, mat):
    mesh=bpy.data.meshes.new(name+'_mesh');mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);scene.collection.objects.link(ob)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    for p in mesh.polygons:p.use_smooth=True
    ob.data.materials.append(mat)
    return ob

def smart_uv(ob):
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.018)
    bpy.ops.object.mode_set(mode='OBJECT')

def set_pivot(ob, pivot):
    p=Vector(pivot)
    for v in ob.data.vertices:v.co-=p
    ob.location=p;ob.parent=root
    return ob

# One watertight folded wrapper: outer base -> exterior wall -> rounded lip ->
# interior wall -> inner floor. There is no cap across the mouth.
N=160
verts=[]; faces=[]; rings=[]

def ring(radius_func, z_func):
    ids=[]
    for i in range(N):
        a=2*math.pi*i/N;r=radius_func(a);z=z_func(a)
        ids.append(len(verts));verts.append((r*math.cos(a),r*math.sin(a),z))
    if rings:
        prev=rings[-1]
        for i in range(N):j=(i+1)%N;faces.append((prev[i],prev[j],ids[j],ids[i]))
    rings.append(ids)

def pleat(a,t):
    phase=18*a+.33*math.sin(3*a)+.30*t*math.sin(5*a)
    return (math.cos(phase)+.23*math.cos(2*phase))*(.00022+.00130*t**.8)

def edgeheight(a):return .0315+.00145*math.sin(5*a+.6)+.00065*math.sin(11*a-.3)
def outerrad(a,t):
    base=.0185+.0095*math.sin(t*math.pi/2)**.72-.0012*t**5
    handmade=1+.028*math.sin(3*a+.5)+.018*math.sin(7*a-1)
    return base*handmade+pleat(a,t)

# Flat underside with concentric support rings.
ring(lambda a:.0005,lambda a:0)
for f in [.35,.68,1.0]:ring(lambda a,f=f:outerrad(a,0)*f,lambda a:0)
for k in range(1,19):
    t=k/18
    ring(lambda a,t=t:outerrad(a,t),lambda a,t=t:edgeheight(a)*t)
# Rounded lip curves into the inner surface; thickness ~0.85 mm.
for phi in [math.pi/4,math.pi/2,3*math.pi/4,math.pi]:
    ring(lambda a,phi=phi:outerrad(a,1)-.000425+.000425*math.cos(phi),
         lambda a,phi=phi:edgeheight(a)+.000425*math.sin(phi))
for k in range(17,-1,-1):
    t=k/18
    ring(lambda a,t=t:outerrad(a,t)-.00085,lambda a,t=t:.00115+(edgeheight(a)-.00115)*t)
for f in [.68,.35,.025]:
    ring(lambda a,f=f:(outerrad(a,0)-.00085)*f,lambda a:.00115)
# Seal only the small centres of the inner and outer bases.
for ri,z,reverse in [(0,0,True),(-1,.00115,False)]:
    ix=len(verts);verts.append((0,0,z));rs=rings[ri]
    for i in range(N):
        j=(i+1)%N
        faces.append((ix,rs[j],rs[i]) if reverse else (ix,rs[i],rs[j]))
wrapper=make_mesh('wrapper_shell',verts,faces,m_wrapper)
smart_uv(wrapper);set_pivot(wrapper,(0,0,.014))

# Complete filling surface: a lightly textured, gently lobed compact volume.
N=112; LAT=48
verts=[(0,0,.037)];faces=[]
for j in range(1,LAT):
    p=math.pi*j/LAT
    for i in range(N):
        a=2*math.pi*i/N
        s=math.sin(p); c=math.cos(p)
        r=.0262*s**.25*(1+.017*math.sin(5*a+.6)+.012*math.cos(9*a-2*p))
        z=.0197+.0173*c
        xyz=Vector((r*math.cos(a),r*math.sin(a),z))
        n=noise.fractal(xyz*1450,.9,2,3,noise_basis='PERLIN_ORIGINAL')
        n2=noise.noise_vector(xyz*480,noise_basis='PERLIN_ORIGINAL').x
        normal=Vector((math.cos(a)*s,math.sin(a)*s,c)).normalized()
        xyz+=normal*(.00072*n+.00045*n2)
        if xyz.z<edgeheight(a)-.0004:
            allowed=outerrad(a,max(0,min(1,xyz.z/edgeheight(a))))-.00108
            radial=math.hypot(xyz.x,xyz.y)
            if radial>allowed:
                xyz.x*=allowed/radial;xyz.y*=allowed/radial
        verts.append(tuple(xyz))
bottom=len(verts);verts.append((0,0,.0024))
for i in range(N):
    q=(i+1)%N;faces.append((0,1+i,1+q))
for j in range(LAT-2):
    for i in range(N):
        q=(i+1)%N;a=1+j*N+i;b=1+j*N+q
        faces.append((a,a+N,b+N,b))
start=1+(LAT-2)*N
for i in range(N):faces.append((bottom,start+(i+1)%N,start+i))
meat=make_mesh('meat_filling',verts,faces,m_meat)
# Parametric spherical UVs with corrected seam per polygon.
uv=meat.data.uv_layers.new(name='UVMap')
for poly in meat.data.polygons:
    us=[];vs=[]
    for li in poly.loop_indices:
        co=meat.data.vertices[meat.data.loops[li].vertex_index].co
        us.append((math.atan2(co.y,co.x)/(2*math.pi))%1)
        vs.append(math.acos(max(-1,min(1,(co.z-.0197)/.0173)))/math.pi)
    if max(us)-min(us)>.5:us=[u+1 if u<.5 else u for u in us]
    for li,u,v in zip(poly.loop_indices,us,vs):uv.data[li].uv=(u,1-v)
set_pivot(meat,(0,0,.0197))

def piece(name,location,size,mat,rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    ob=bpy.context.object;ob.name=name
    ob.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=ob.modifiers.new('Soft freshly cut edges','BEVEL');bevel.width=min(size)*.19;bevel.segments=2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Tiny deviations avoid identical machined-looking cubes.
    for v in ob.data.vertices:v.co*=random.uniform(.97,1.03)
    ob.rotation_euler=rotation or [random.uniform(-.8,.8) for _ in range(3)]
    ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
    norm=ob.modifiers.new('Weighted cut-face normals','WEIGHTED_NORMAL');norm.keep_sharp=True;norm.weight=35
    bpy.ops.object.modifier_apply(modifier=norm.name)
    return ob

def surface_z(r):
    return .0197+.0173*math.sqrt(max(0,1-(r/.0262)**(2/.25)))

def join_group(name,parts,pivot):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    ob=bpy.context.object;ob.name=name
    # Bake rotation and translation into vertices before assigning group pivot.
    mat=ob.matrix_world.copy()
    for v in ob.data.vertices:v.co=mat@v.co
    ob.matrix_world.identity()
    smart_uv(ob);return set_pivot(ob,pivot)

parts=[]
for i in range(17):
    a=i*2.39996+.2;r=random.uniform(.012,.017) if i<9 else random.uniform(.004,.010)
    z=surface_z(r)-.0005 if i<9 else random.uniform(.014,.027)
    parts.append(piece('green_cut',(r*math.cos(a),r*math.sin(a),z),
       (random.uniform(.0028,.0046),random.uniform(.0014,.0026),random.uniform(.0006,.0010)),random.choice(m_green)))
veg=join_group('vegetable_pieces',parts,(0,0,.027))

parts=[]
for i in range(22):
    a=i*2.39996+1.2;r=random.uniform(.012,.018) if i<7 else random.uniform(.004,.011)
    z=surface_z(r)-.00055 if i<7 else random.uniform(.014,.027)
    s=random.uniform(.0012,.0019)
    parts.append(piece('carrot_dice',(r*math.cos(a),r*math.sin(a),z),(s,s*.83,s*.74),random.choice(m_carrot)))
mix=join_group('carrot_mix',parts,(0,0,.026))

# A dense but finely chopped topping. Its lower pieces sit into the meat dome;
# higher pieces touch lower pieces. All belong to one independently movable mesh.
parts=[]
for i in range(88):
    # Packed phyllotactic placement on a low irregular mound, not random debris.
    a=i*2.399963
    r=.0108*math.sqrt((i+.5)/88)
    x=r*math.cos(a);y=r*math.sin(a)
    z=surface_z(r)+.00015+.00020*(1-r/.0108)
    s=random.uniform(.00135,.0020)
    parts.append(piece('carrot_fine',(x,y,z),(s,s*random.uniform(.60,.95),s*random.uniform(.65,.95)),random.choice(m_carrot)))
topping=join_group('carrot_topping',parts,(0,0,.038))

objects=[wrapper,meat,veg,mix,topping]
# Down/up in Blender is Z; X gives the editorial left/right branches.
deltas={
 'wrapper_shell':(0,0,-.012), 'meat_filling':(0,0,.037),
 'vegetable_pieces':(-.062,0,.066), 'carrot_mix':(.062,0,.066),
 'carrot_topping':(0,0,.105)}
times=[0,1,3.2,4.8,7.2,8]; weights=[0,0,1,1,0,0]
transforms={'coordinate_system':'glTF Y-up; metres; quaternion x,y,z,w','root':'kalili_dimsum_root','animation':'assemble_explode_reassemble','duration_seconds':8,'loop':False,'nodes':{}}
def yup(v):return [float(v[0]),float(v[2]),float(-v[1])]
for ob in objects:
    base=ob.location.copy();delta=Vector(deltas[ob.name])
    transforms['nodes'][ob.name]={'assembled':{'translation':yup(base),'rotation':[0,0,0,1],'scale':[1,1,1]},'exploded':{'translation':yup(base+delta),'rotation':[0,0,0,1],'scale':[1,1,1]}}
    for t,w in zip(times,weights):
        ob.location=base+delta*w;ob.keyframe_insert('location',frame=round(t*30),group='Ingredients')
    if ob.animation_data and ob.animation_data.action:
        ob.animation_data.action.name=ob.name+'_assembly'
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation='BEZIER';kp.handle_left_type='AUTO_CLAMPED';kp.handle_right_type='AUTO_CLAMPED'
    ob['ingredient_group']=ob.name;ob['illustrative_recipe']=True
scene.frame_set(0)

# Match a real width of exactly 60 mm and preserve the root at the flat bottom.
allpts=[ob.matrix_world@v.co for ob in objects for v in ob.data.vertices]
width=max(v.x for v in allpts)-min(v.x for v in allpts)
factor=.060/width
for ob in objects:
    for v in ob.data.vertices:v.co*=factor
    for fc in ob.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.co.y*=factor;k.handle_left.y*=factor;k.handle_right.y*=factor
    for state in ['assembled','exploded']:
        transforms['nodes'][ob.name][state]['translation']=[v*factor for v in transforms['nodes'][ob.name][state]['translation']]
scene.frame_set(0)
(OUT/'ingredient-transforms.json').write_text(json.dumps(transforms,indent=2))

# Source file retains only the five meshes and the root, all image maps packed.
scene.world=bpy.data.worlds.new('Neutral studio world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=.14
            a.spaces.active.region_3d.view_location=(0,0,.023)
            a.spaces.active.clip_start=.001
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kalili-dimsum-ingredients.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=root
glb=OUT/'kalili-dimsum-ingredients.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,
 export_animations=False,export_yup=True,export_apply=True,export_extras=True,export_tangents=True,
 export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False)

# Embed an exact, deterministic 8-second CUBICSPLINE clip directly in glTF.
# Zero tangents produce smoothstep movement and mathematically constant holds.
raw=glb.read_bytes();jslen,jstype=struct.unpack_from('<II',raw,12)
doc=json.loads(raw[20:20+jslen]);bin_offset=20+jslen
blen,btype=struct.unpack_from('<II',raw,bin_offset)
binary=bytearray(raw[bin_offset+8:bin_offset+8+blen])
def add_accessor(a,typ,include_bounds=False):
    a=np.asarray(a,dtype='<f4')
    while len(binary)%4:binary.append(0)
    offset=len(binary);binary.extend(a.tobytes())
    bv=len(doc.setdefault('bufferViews',[]));doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes})
    acc={'bufferView':bv,'componentType':5126,'count':len(a),'type':typ}
    if include_bounds:
        acc['min']=[float(a.min())];acc['max']=[float(a.max())]
    ix=len(doc.setdefault('accessors',[]));doc['accessors'].append(acc);return ix
time_acc=add_accessor(times,'SCALAR',True)
clip={'name':'assemble_explode_reassemble','channels':[],'samplers':[],'extras':{'durationSeconds':8,'loop':False,'playbackNote':'Set LoopOnce in the player. glTF itself has no standard looping flag.'}}
for name,poses in transforms['nodes'].items():
    ni=next(i for i,n in enumerate(doc['nodes']) if n.get('name')==name)
    assembled=np.array(poses['assembled']['translation']);exploded=np.array(poses['exploded']['translation'])
    vals=[]
    for w in weights:vals.extend([[0,0,0],(assembled+(exploded-assembled)*w).tolist(),[0,0,0]])
    oa=add_accessor(vals,'VEC3')
    si=len(clip['samplers']);clip['samplers'].append({'input':time_acc,'output':oa,'interpolation':'CUBICSPLINE'})
    clip['channels'].append({'sampler':si,'target':{'node':ni,'path':'translation'}})
doc['animations']=[clip]
doc['asset']['generator']='Kalili procedural Blender 4.5 asset; explicit glTF CUBICSPLINE animation'
doc['buffers'][0]['byteLength']=len(binary)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\x00'*((-len(binary))%4)
glb.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
print('GLB_READY',glb,glb.stat().st_size,flush=True)

# Re-import the final binary, inspect mesh topology, then render THAT model.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb))
scene=bpy.context.scene;scene.render.fps=30
imported={name:bpy.data.objects.get(name) for name in transforms['nodes']}
report={'source_reference':'Original.png from Menu 2(1).rar; open-top shumai','file_bytes':glb.stat().st_size,'glTF_version':doc['asset']['version'],'nodes':{},'triangles':0}
assert all(imported.values())
assert bpy.data.objects.get('kalili_dimsum_root')
for name,ob in imported.items():
    assert ob.type=='MESH' and ob.parent.name=='kalili_dimsum_root'
    ob.data.calc_loop_triangles();tri=len(ob.data.loop_triangles)
    bm=bmesh.new();bm.from_mesh(ob.data)
    # UV seams are split on export: weld only in temporary diagnostic mesh.
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8)
    nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
    report['nodes'][name]={'triangles':tri,'closed_surface_after_seam_weld':nonmanifold==0,'nonmanifold_edges':nonmanifold,'independent_parent':ob.parent.name}
    report['triangles']+=tri
# Evaluate first/last imported animation frame and movement isolation.
scene.frame_set(0);bpy.context.view_layer.update()
start={n:ob.matrix_world.copy() for n,ob in imported.items()}
scene.frame_set(240);bpy.context.view_layer.update()
report['reassembly_max_matrix_error']=max(max(abs(ob.matrix_world[r][c]-start[n][r][c]) for r in range(4) for c in range(4)) for n,ob in imported.items())
scene.frame_set(0)
for ob in imported.values():ob.animation_data_clear()
bpy.context.view_layer.update()
before={n:ob.matrix_world.copy() for n,ob in imported.items()}
imported['meat_filling'].location.x+=.01;bpy.context.view_layer.update()
report['moving_meat_leaves_other_groups_unchanged']=all(ob.matrix_world==before[n] for n,ob in imported.items() if n!='meat_filling')
imported['meat_filling'].matrix_world=before['meat_filling']
report['textures_embedded']=all('bufferView' in im and 'uri' not in im for im in doc.get('images',[]))
report['texture_count']=len(doc.get('images',[]))
report['animation_name']=clip['name'];report['animation_duration']=8
report['animation_paths']=['translation'];report['default_pose']='assembled'
(OUT/'validation-report.json').write_text(json.dumps(report,indent=2))
print('VALIDATION',json.dumps(report),flush=True)
if os.environ.get('KALILI_SKIP_RENDER')=='1':
    raise SystemExit(0)

# Transparent studio previews; cameras/lights are only in this render scene.
scene.render.engine='CYCLES';scene.cycles.samples=int(os.environ.get('KALILI_SAMPLES','24'));scene.cycles.use_denoising=True
scene.render.resolution_x=int(os.environ.get('KALILI_RES','1200'));scene.render.resolution_y=scene.render.resolution_x;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Preview studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.84,.89,1,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.6
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.025))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(-.10,-.10,.17),.315,.12)
area('Fill',(.12,-.015,.10),.14,.10)
area('Rim',(0,.10,.16),.245,.09)
data=bpy.data.cameras.new('Preview Camera');camera=bpy.data.objects.new('Preview Camera',data);scene.collection.objects.link(camera);scene.camera=camera
camera.data.type='ORTHO';camera.data.lens=50;camera.data.clip_start=.001
def render_pose(state,target,position,scale,filename):
    for name,ob in imported.items():
        tr=transforms['nodes'][name][state]['translation'];ob.location=(tr[0],-tr[2],tr[1])
    bpy.context.view_layer.update()
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
    scene.render.filepath=str(OUT/filename);bpy.ops.render.render(write_still=True)
render_pose('assembled',(0,0,.021),(.078,-.145,.102),.080,'kalili-assembled.png')
render_pose('exploded',(0,0,.064),(.027,-.31,.21),.205,'kalili-exploded.png')
print('FINISHED',flush=True)
