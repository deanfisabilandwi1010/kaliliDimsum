"""Re-import final GLBs, validate solid parts and transforms, render actual geometry."""
import bpy,bmesh,json,os,math,struct
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent.parent
RES=int(os.environ.get('VARIANT_RES','1100'))
SAMPLES=int(os.environ.get('VARIANT_SAMPLES','32'))

def setup():
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=SAMPLES;scene.cycles.use_denoising=True
    scene.render.resolution_x=RES;scene.render.resolution_y=RES;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
    scene.world=bpy.data.worlds.new('Preview only');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.84,.89,1,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.6
    def area(name,loc,power,size):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
        o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,.025))-o.location).to_track_quat('-Z','Y').to_euler()
    area('Softbox',(-.10,-.10,.17),.315,.12);area('Fill',(.12,-.015,.10),.14,.10);area('Rim',(0,.10,.16),.245,.09)
    d=bpy.data.cameras.new('Preview camera');c=bpy.data.objects.new('Preview camera',d);scene.collection.objects.link(c)
    scene.camera=c;d.type='ORTHO';d.clip_start=.001;d.clip_end=10;d.ortho_scale=.080
    return scene,c

def render(scene,c,loc,target,path,scale=.080,res=None):
    c.location=loc;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=scale
    scene.render.resolution_x=res or RES;scene.render.resolution_y=res or RES
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)

reports={}
for variant in ['cheese-mentai','black-series']:
    glb=OUT/('kalili-'+variant+'.glb');bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb))
    root=bpy.data.objects['black_series_root' if variant=='black-series' else 'cheese_mentai_root']
    names=['wrapper_shell','filling_core','topping_cap' if variant=='black-series' else 'mentai_cap','cheese_surface','garnish_details']
    objs={n:bpy.data.objects[n] for n in names};assert set(root.children)==set(objs.values())
    assert len(bpy.data.objects)==6 and root.location.length<1e-9
    report={'file':glb.name,'geometry_nodes':{},'triangle_count':0}
    for name,ob in objs.items():
        assert ob.type=='MESH' and tuple(ob.scale)==(1,1,1)
        ob.data.calc_loop_triangles();tri=len(ob.data.loop_triangles);report['triangle_count']+=tri
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8)
        bad=sum(not e.is_manifold for e in bm.edges);vol=bm.calc_volume(signed=True)
        report['geometry_nodes'][name]={'triangles':tri,'nonmanifold_edges_after_seam_weld':bad,'signed_volume_m3':vol}
        assert bad==0 and vol>0,(name,bad,vol)
        bm.free()
    assert 8000<=report['triangle_count']<=15000
    bpy.context.view_layer.update()
    start={n:o.matrix_world.copy() for n,o in objs.items()}
    report['independent_motion']={}
    for name,ob in objs.items():
        ob.location.x+=.01;bpy.context.view_layer.update()
        assert all(o.matrix_world==start[n] for n,o in objs.items() if n!=name)
        ob.matrix_world=start[name];bpy.context.view_layer.update()
        assert ob.matrix_world==start[name]
        report['independent_motion'][name]=True
    pts=[o.matrix_world@v.co for o in objs.values() for v in o.data.vertices]
    mi=[min(p[i] for p in pts) for i in range(3)];ma=[max(p[i] for p in pts) for i in range(3)]
    report['bounds_blender_z_up']=[mi,ma];report['width_m']=ma[0]-mi[0];report['height_m']=ma[2]-mi[2]
    assert abs(report['width_m']-.06)<1e-6 and abs(mi[2])<1e-7
    image_payloads=[{'name':im.name,'size':list(im.size),'first_pixel':float(im.pixels[0]),'packed_bytes':len(im.packed_file.data) if im.packed_file else 0} for im in bpy.data.images if im.type=='IMAGE']
    report['image_payloads']=image_payloads
    report['images_loaded']=all(im['size'][0]>0 and im['packed_bytes']>0 for im in image_payloads)
    assert report['images_loaded']
    reports[variant]=report
    if os.environ.get('VARIANT_SKIP_RENDER')!='1':
        scene,c=setup()
        render(scene,c,(.078,-.145,.102),(0,0,.021),OUT/('kalili-'+variant+'-preview.png'))
        for view,loc,target in [('front',(0,-.18,.023),(0,0,.023)),('side',(.18,0,.023),(0,0,.023)),('top',(.0001,-.0001,.20),(0,0,.020)),('underside',(.08,-.13,-.10),(0,0,.017))]:
            render(scene,c,loc,target,OUT/'qa'/(variant+'-'+view+'.png'),res=min(RES,600))
    print('REIMPORT_OK',variant,json.dumps(report),flush=True)
(OUT/'reimport-validation.json').write_text(json.dumps(reports,indent=2))

# Same studio settings and camera for the previously delivered Original.
if os.environ.get('VARIANT_SKIP_RENDER')!='1':
    original=OUT/'source'/'original-reference.glb'
    if original.exists():
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(original))
        bpy.context.scene.frame_set(0)
        for ob in bpy.data.objects:ob.animation_data_clear()
        scene,c=setup();render(scene,c,(.078,-.145,.102),(0,0,.021),OUT/'qa'/'original-same-light.png')
print('REIMPORT_AND_RENDER_COMPLETE',flush=True)
