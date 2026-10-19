"""Build two standalone Kalili menu variants with five independent solid parts.

Run: blender -b -t 6 --python-exit-code 1 --python source/build_variants.py
Authoring is Z-up, metres; the exporter converts the GLB to Y-up.
"""
import bpy, bmesh, math, random, json, shutil, struct
import numpy as np
from pathlib import Path
from mathutils import Vector

OUT=Path(__file__).resolve().parent.parent
TEX=OUT/'textures'
ORIGINAL=OUT/'source'/'original-source.blend'
TAU=2*math.pi

def active(ob):
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
    bpy.context.view_layer.objects.active=ob

def mesh(name,verts,faces,mat):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    for p in me.polygons:p.use_smooth=True
    return ob

def material(variant,label,normal_strength=1):
    m=bpy.data.materials.new(label);m.use_nodes=True
    n=m.node_tree.nodes;l=m.node_tree.links;b=n.get('Principled BSDF')
    b.inputs['Metallic'].default_value=0;b.inputs['IOR'].default_value=1.5
    for suffix,space,socket in [('basecolor.jpg','sRGB','Base Color'),('roughness.png','Non-Color','Roughness'),('normal.png','Non-Color',None)]:
        t=n.new('ShaderNodeTexImage');im=bpy.data.images.load(str(TEX/(variant+'-'+suffix)),check_existing=True)
        im.colorspace_settings.name=space
        assert len(im.pixels)>0 and len(im.size)==2 and im.size[0]==1024
        im.pack();assert len(im.packed_file.data)==(TEX/(variant+'-'+suffix)).stat().st_size
        t.image=im
        if socket:l.new(t.outputs['Color'],b.inputs[socket])
        else:
            normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=normal_strength
            l.new(t.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],b.inputs['Normal'])
    return m

def atlas_uv(ob,slot,planar_radius=None):
    corners={'wrapper':(0,.5),'cap':(.5,.5),'core':(0,0),'cheese':(.5,0)}
    x,y=corners[slot]
    layer=ob.data.uv_layers.active or ob.data.uv_layers.new(name='UVMap')
    for p in ob.data.polygons:
        for li in p.loop_indices:
            if planar_radius:
                co=ob.data.vertices[ob.data.loops[li].vertex_index].co
                uv=(.5+co.x/(2*planar_radius),.5+co.y/(2*planar_radius))
            else:uv=tuple(layer.data[li].uv)
            layer.data[li].uv=(x+.018+.464*uv[0],y+.018+.464*uv[1])

def pivot(ob,p,root):
    p=Vector(p)
    for v in ob.data.vertices:v.co-=p
    ob.location=p;ob.rotation_euler=(0,0,0);ob.scale=(1,1,1);ob.parent=root
    ob['component']=ob.name

def disk(name,N,steps,radius_func,top_func,bottom_z,mat,slot,uvradius):
    verts=[(0,0,top_func(0,0))];faces=[];rings=[]
    def ring(q,zd=0):
        ids=[]
        for i in range(N):
            a=TAU*i/N;r=radius_func(a)*q
            ids.append(len(verts));verts.append((r*math.cos(a),r*math.sin(a),top_func(q,a)+zd))
        if not rings:
            for i in range(N):faces.append((0,ids[i],ids[(i+1)%N]))
        else:
            prev=rings[-1]
            for i in range(N):j=(i+1)%N;faces.append((prev[i],ids[i],ids[j],prev[j]))
        rings.append(ids)
    for k in range(1,steps+1):ring(k/steps)
    # Turn the perimeter through a rounded shoulder into a solid underside.
    edge=rings[-1]
    for factor,depth in [(1.003,.00035),(.995,.00085),(.968,.00145)]:
        ids=[]
        for i in range(N):
            a=TAU*i/N;r=radius_func(a)*factor
            ids.append(len(verts));verts.append((r*math.cos(a),r*math.sin(a),top_func(1,a)-depth))
        for i in range(N):j=(i+1)%N;faces.append((edge[i],ids[i],ids[j],edge[j]))
        edge=ids
    # Bottom is genuinely modeled and closed. It is intentionally embedded.
    ids=[]
    for i in range(N):
        a=TAU*i/N;r=radius_func(a)*.90
        ids.append(len(verts));verts.append((r*math.cos(a),r*math.sin(a),bottom_z))
    for i in range(N):j=(i+1)%N;faces.append((edge[i],ids[i],ids[j],edge[j]))
    bottom=len(verts);verts.append((0,0,bottom_z))
    for i in range(N):faces.append((bottom,ids[(i+1)%N],ids[i]))
    ob=mesh(name,verts,faces,mat);atlas_uv(ob,slot,uvradius)
    return ob

def build(variant):
    black=variant=='black-series'
    bpy.ops.wm.open_mainfile(filepath=str(ORIGINAL))
    scene=bpy.context.scene;scene.frame_set(0);bpy.context.view_layer.update()
    wrapper=bpy.data.objects['wrapper_shell'];core=bpy.data.objects['meat_filling']
    keep=[wrapper,core]
    for ob in keep:
        world=ob.matrix_world.copy();ob.animation_data_clear();ob.parent=None
        for v in ob.data.vertices:v.co=world@v.co
        ob.matrix_world.identity();ob.data.materials.clear()
    for ob in list(bpy.data.objects):
        if ob not in keep:bpy.data.objects.remove(ob,do_unlink=True)
    for block in list(bpy.data.actions):bpy.data.actions.remove(block)
    root=bpy.data.objects.new('black_series_root' if black else 'cheese_mentai_root',None)
    scene.collection.objects.link(root)
    root['description']='One Kalili '+('Black Series' if black else 'Cheese Mentai')+' shumai; visual product interpretation, no recipe claims.'
    root['nominal_width_m']=.06;root['root_origin']='bottom-center';root['front_axis']='+Z in glTF'
    m=material(variant,'Kalili '+variant+' | shared surface atlas',.55 if black else .6)
    for ob,ratio in [(wrapper,.365),(core,.175)]:
        active(ob);d=ob.modifiers.new('Web silhouette budget','DECIMATE');d.ratio=ratio
        bpy.ops.object.modifier_apply(modifier=d.name)
        ob.data.materials.append(m)
    core.name='filling_core';core.data.name='filling_core_mesh'
    for v in core.data.vertices:
        v.co.z=.0016+(v.co.z-.0016)*.915
        if black:v.co.x*=.90;v.co.y*=.90
    # The Black reference has a rounded body and folds gathered beneath its cap.
    # Preserve the inherited folds/thickness, adapting the neck in real geometry.
    original_factor=1.0360632
    for v in wrapper.data.vertices:
        a=math.atan2(v.co.y,v.co.x)
        oldedge=original_factor*(.0315+.00145*math.sin(5*a+.6)+.00065*math.sin(11*a-.3))
        t=max(0,min(1,v.co.z/oldedge));r=math.hypot(v.co.x,v.co.y)
        delta=(.0020 if black else .0010)*math.sin(math.pi*t)-(.0037 if black else .0014)*t**4
        if r>.001:
            v.co.x*=max(.5,(r+delta)/r);v.co.y*=max(.5,(r+delta)/r)
        target=.0355 if black else .0340
        v.co.z+=(target-oldedge)*t**5
    # Exact 60 mm footprint, shared origin with Original; keep a flat zero base.
    lo=min(v.co.x for v in wrapper.data.vertices);hi=max(v.co.x for v in wrapper.data.vertices)
    factor=.060/(hi-lo)
    for v in wrapper.data.vertices:
        v.co.x*=factor;v.co.y*=factor
        if v.co.z<.00001:v.co.z=0
    atlas_uv(wrapper,'wrapper');atlas_uv(core,'core')
    radius=.0255 if black else .0280
    edge_z=.0360 if black else .0352
    dome=.0048 if black else .0052
    def cap_radius(a):
        return radius*(1+.022*math.sin(5*a+.2)+.014*math.sin(9*a+.8)+.016*math.cos(22*a))
    def cap_top(q,a):
        q=min(1,max(0,q))
        return edge_z+dome*max(0,1-q*q)**.78+(.00032*math.sin(5*a+q*4)+.00023*math.cos(13*a-q*5))*q+.00026*math.sin(q*25)*math.sin(7*a)*q+.00015*math.sin(q*45+9*a)*q
    cap=disk('topping_cap' if black else 'mentai_cap',96,15,cap_radius,cap_top,.0334 if black else .0328,m,'cap',.031)
    cheese_radius=.0170 if black else .0195
    def cr(a):return cheese_radius*(1+.065*math.sin(3*a+.3)+.035*math.sin(7*a-1)+.021*math.cos(11*a))
    def ct(q,a):
        r=cr(a)*q;under=cap_top(r/cap_radius(a),a)
        # Soft, lumpy melted crown; never a separate flat disc or sheet.
        return under+.00010+.00110*max(0,1-q*q)**.85+.00016*math.sin(4*a+q*7)*q*(1-q)
    cheese=disk('cheese_surface',80,11,cr,ct,.0355,m,'cheese',.025)
    # Sink the rounded edge into the sauce. Full lower surfaces remain present.
    # The cap under the cheese stays closed when the cheese object is moved.
    parts=[];rng=random.Random(582 if black else 237)
    for i in range(24):
        a=i*2.399963+.25;r=cheese_radius*math.sqrt((i+.5)/24)*.79
        q=r/cr(a);x=r*math.cos(a);y=r*math.sin(a)
        z=ct(q,a)+.00004
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z))
        ob=bpy.context.object;ob.name='toast_fragment'
        sx=rng.uniform(.00023,.00043);sy=sx*rng.uniform(.45,.85);sz=rng.uniform(.00011,.00018)
        ob.scale=(sx,sy,sz);ob.rotation_euler=(0,0,a+.4)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        ob.data.materials.append(m)
        for p in ob.data.polygons:p.use_smooth=True
        for layer in list(ob.data.uv_layers):ob.data.uv_layers.remove(layer)
        uv=ob.data.uv_layers.new(name='UVMap')
        # Sample golden/small toasted tones from the cap region; no new ingredient.
        for p in ob.data.polygons:
            for k,li in enumerate(p.loop_indices):
                uv.data[li].uv=(.72+(i%4)*.025+(k==1)*.001,.77+(i%3)*.018+(k==2)*.001)
        parts.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    garnish=bpy.context.object;garnish.name='garnish_details'
    world=garnish.matrix_world.copy()
    for v in garnish.data.vertices:v.co=world@v.co
    garnish.matrix_world.identity()
    objs=[wrapper,core,cap,cheese,garnish]
    for ob in objs:
        # Exact centerline pivots, useful for independent ingredient transforms.
        z=(min(v.co.z for v in ob.data.vertices)+max(v.co.z for v in ob.data.vertices))*.5
        pivot(ob,(0,0,z),root)
        active(ob)
        tri=ob.modifiers.new('Portable triangles','TRIANGULATE');tri.keep_custom_normals=True
        bpy.ops.object.modifier_apply(modifier=tri.name)
        ob.data.calc_loop_triangles()
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    scene.frame_start=0;scene.frame_end=1;scene.frame_set(0)
    scene.world=bpy.data.worlds.new('Neutral preview environment');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    for screen in bpy.data.screens:
        for a in screen.areas:
            if a.type=='VIEW_3D':
                a.spaces.active.region_3d.view_distance=.14
                a.spaces.active.region_3d.view_location=(0,0,.022)
                a.spaces.active.clip_start=.001
    # Remove unused reference materials/images/actions from editable source.
    bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
    active(root)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('kalili-'+variant+'.blend')),compress=True)
    for ob in objs:ob.select_set(True)
    path=OUT/('kalili-'+variant+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_animations=False,export_yup=True,export_apply=True,export_extras=True,
        export_tangents=True,export_materials='EXPORT',export_image_format='AUTO',
        export_cameras=False,export_lights=False)
    # Orthonormalize rounded exporter tangents against the stored normals.
    # This prevents tangent-space skew near UV poles after decimation.
    data=bytearray(path.read_bytes());jlen=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+jlen]);bo=28+jlen
    def arr(idx,w):
        ac=doc['accessors'][idx];bv=doc['bufferViews'][ac['bufferView']]
        return np.ndarray((ac['count'],w),dtype='<f4',buffer=data,offset=bo+bv.get('byteOffset',0)+ac.get('byteOffset',0),strides=(bv.get('byteStride',w*4),4))
    for me in doc['meshes']:
        for pr in me['primitives']:
            n=arr(pr['attributes']['NORMAL'],3).astype('float64')
            n/=np.linalg.norm(n,axis=1,keepdims=True)
            tangent=arr(pr['attributes']['TANGENT'],4)
            t=tangent[:,:3].astype('float64');t-=n*np.sum(n*t,axis=1,keepdims=True)
            assert np.min(np.linalg.norm(t,axis=1))>1e-6
            tangent[:,:3]=t/np.linalg.norm(t,axis=1,keepdims=True)
    path.write_bytes(data)
    total=sum(len(ob.data.loop_triangles) for ob in objs)
    print('BUILT',variant,'triangles',total,'bytes',path.stat().st_size,flush=True)

for variant in ['cheese-mentai','black-series']:build(variant)
