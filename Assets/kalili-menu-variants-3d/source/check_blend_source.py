"""Verify both editable files have the assembled asset and packed texture bytes."""
import bpy,json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent.parent
report={}
for variant in ['cheese-mentai','black-series']:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/('kalili-'+variant+'.blend')))
    root=bpy.data.objects['black_series_root' if variant=='black-series' else 'cheese_mentai_root']
    assert len(bpy.data.objects)==6 and len(root.children)==5 and root.location.length==0
    assert not bpy.data.cameras and not bpy.data.lights
    assert not any(ob.animation_data for ob in bpy.data.objects)
    images=[]
    assert len(bpy.data.images)==3
    for im in bpy.data.images:
        assert im.packed_file and im.size[0]==1024 and len(im.pixels)==1024*1024*4
        original=(OUT/'textures'/im.name).read_bytes()
        assert bytes(im.packed_file.data)==original
        images.append({'name':im.name,'bytes':len(im.packed_file.data),'sha256':hashlib.sha256(im.packed_file.data).hexdigest()})
    p=[ob.matrix_world@v.co for ob in root.children for v in ob.data.vertices]
    bounds=[[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]]
    assert abs(bounds[0][2])<1e-7 and abs(bounds[1][0]-bounds[0][0]-.06)<1e-7
    report[variant]={'passed':True,'root':root.name,'mesh_nodes':sorted(o.name for o in root.children),'packed_images':images,'default_pose':'assembled','width_m':bounds[1][0]-bounds[0][0],'bottom_z_m':bounds[0][2]}
    print('SOURCE_VALIDATED',variant,flush=True)
(OUT/'source-validation.json').write_text(json.dumps(report,indent=2))
