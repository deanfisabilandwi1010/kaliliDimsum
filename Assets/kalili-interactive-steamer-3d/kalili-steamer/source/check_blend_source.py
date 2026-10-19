"""Check the editable source's packed textures and sequential NLA poses."""
import bpy,json
from pathlib import Path
from mathutils import Quaternion
OUT=Path(__file__).resolve().parent.parent
states=json.loads((OUT/'state-transforms.json').read_text())['states']
bpy.ops.wm.open_mainfile(filepath=str(OUT/'kalili-interactive-steamer.blend'))
report={'packed_images':{},'state_max_translation_error_metres':{},'state_max_rotation_error_radians':{}}
for im in bpy.data.images:
 if im.source=='FILE':
  assert im.packed_file is not None,im.name
  assert len(im.packed_file.data)>0,im.name
  report['packed_images'][im.name]=len(im.packed_file.data)
for frame,name in [(0,'closed'),(72,'open'),(102,'hero_lifted'),(198,'exploded'),(342,'hero_lifted')]:
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();worst=0;rotation_error=0
 for n,p in states[name].items():
  ob=bpy.data.objects[n];tr=p['translation'];expected=(tr[0],-tr[2],tr[1])
  worst=max(worst,max(abs(ob.location[i]-expected[i]) for i in range(3)))
  q=p['rotation'];eq=Quaternion((q[3],q[0],-q[2],q[1]));rotation_error=max(rotation_error,ob.rotation_quaternion.rotation_difference(eq).angle)
 report['state_max_translation_error_metres'][str(frame)+'_'+name]=worst
 report['state_max_rotation_error_radians'][str(frame)+'_'+name]=rotation_error
 assert worst<1e-6,(frame,name,worst)
 assert rotation_error<1e-3,(frame,name,rotation_error)
(OUT/'source-validation.json').write_text(json.dumps(report,indent=2))
print('SOURCE_CHECK_PASSED',json.dumps(report))
