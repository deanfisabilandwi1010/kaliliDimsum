"""Check both final variants in the actual previously delivered steamer position.

Triangle SAT narrow phase follows BVH broad-phase candidates. Internal ingredient
nesting is intentional and is not treated as an external collision.
"""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
OUT=Path(__file__).resolve().parent.parent
STEAMER=OUT/'source'/'steamer-reference.glb'

def tris(ob):
    ob.data.calc_loop_triangles();m=ob.matrix_world
    vertices=[m@v.co for v in ob.data.vertices]
    faces=[tuple(t.vertices) for t in ob.data.loop_triangles]
    return vertices,faces,BVHTree.FromPolygons(vertices,faces,all_triangles=True,epsilon=0)

def intersect(a,b):
    ea=[a[(i+1)%3]-a[i] for i in range(3)];eb=[b[(i+1)%3]-b[i] for i in range(3)]
    na=ea[0].cross(ea[1]);nb=eb[0].cross(eb[1])
    axes=[na,nb]+[e.cross(f) for e in ea for f in eb]+[na.cross(e) for e in ea]+[nb.cross(e) for e in eb]
    for axis in axes:
        if axis.length_squared<1e-24:continue
        axis.normalize();pa=[p.dot(axis) for p in a];pb=[p.dot(axis) for p in b]
        if max(pa)<min(pb)-1e-9 or max(pb)<min(pa)-1e-9:return False
    return True

report={}
for variant in ['cheese-mentai','black-series']:
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(STEAMER))
    bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
    for o in bpy.data.objects:o.animation_data_clear()
    hero=bpy.data.objects['dimsum_hero_root']
    for o in list(hero.children):bpy.data.objects.remove(o,do_unlink=True)
    obstacles=[bpy.data.objects[n] for n in ['steamer_base','steamer_lid','brand_badge']+[f'dimsum_support_{i:02}' for i in range(1,5)]]
    bpy.ops.import_scene.gltf(filepath=str(OUT/('kalili-'+variant+'.glb')))
    root=bpy.data.objects['black_series_root' if variant=='black-series' else 'cheese_mentai_root']
    root.parent=hero;root.location=(0,0,0);root.rotation_euler=(0,0,0);root.scale=(1,1,1)
    bpy.context.view_layer.update()
    pairs=[];bad=[]
    obs={ob.name:tris(ob) for ob in obstacles}
    for ob in root.children:
        av,af,at=tris(ob)
        for name,(bv,bf,bt) in obs.items():
            hits=at.overlap(bt);actual=0
            for i,j in hits:
                if intersect([av[k] for k in af[i]],[bv[k] for k in bf[j]]):actual+=1
            pairs.append({'part':ob.name,'obstacle':name,'intersecting_triangle_pairs':actual})
            if actual:bad.append((ob.name,name,actual))
    assert not bad,(variant,bad)
    bottom=min((o.matrix_world@v.co).z for o in root.children for v in o.data.vertices)
    report[variant]={'fits_existing_closed_steamer':True,'uniform_scale':1,'root_local_translation':[0,0,0],'hero_anchor_blender_z_up':list(hero.location),'bottom_world_m':bottom,'external_collision_pairs_tested':len(pairs),'intersections':0,'pairs':pairs}
    print('STEAMER_FIT_OK',variant,flush=True)
(OUT/'steamer-fit-validation.json').write_text(json.dumps(report,indent=2))
