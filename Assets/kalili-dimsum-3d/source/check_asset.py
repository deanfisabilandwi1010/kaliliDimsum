"""Independent binary/animation/scale checks. Requires numpy and Pillow."""
from pathlib import Path
import struct,json,io
import numpy as np
from PIL import Image

out=Path(__file__).resolve().parent.parent
b=(out/'kalili-dimsum-ingredients.glb').read_bytes()
magic,version,length=struct.unpack_from('<III',b)
assert magic==0x46546c67 and version==2 and length==len(b)
jlen,jtype=struct.unpack_from('<II',b,12)
g=json.loads(b[20:20+jlen]);blen,btype=struct.unpack_from('<II',b,20+jlen)
binary=b[28+jlen:28+jlen+blen]

def accessor(idx):
    a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    offset=v.get('byteOffset',0)+a.get('byteOffset',0)
    stride=v.get('byteStride',np.dtype(dtype).itemsize*width)
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=offset,strides=(stride,np.dtype(dtype).itemsize)).copy()

names=['wrapper_shell','meat_filling','vegetable_pieces','carrot_mix','carrot_topping']
root=next(x for x in g['nodes'] if x.get('name')=='kalili_dimsum_root')
assert set(g['nodes'][i]['name'] for i in root['children'])==set(names)
assert len(g['nodes'])==6 and len(g['meshes'])==5
assert not g.get('cameras') and not g.get('skins')
assert all(m['pbrMetallicRoughness'].get('metallicFactor',1)==0 for m in g['materials'])
assert all('uri' not in x for x in g['buffers'])
image_sizes=[]
for im in g['images']:
    assert 'bufferView' in im and 'uri' not in im
    v=g['bufferViews'][im['bufferView']];o=v.get('byteOffset',0)
    image=Image.open(io.BytesIO(binary[o:o+v['byteLength']]))
    image.load();assert max(image.size)<=2048;image_sizes.append(image.size)

triangles=0;points=[]
for node in g['nodes']:
    if 'mesh' not in node:continue
    assert node.get('scale',[1,1,1])==[1,1,1]
    t=np.array(node.get('translation',[0,0,0]))
    for p in g['meshes'][node['mesh']]['primitives']:
        assert p.get('mode',4)==4 and 'TANGENT' in p['attributes']
        a=accessor(p['attributes']['POSITION']);assert np.isfinite(a).all()
        points.append(a+t)
        normals=accessor(p['attributes']['NORMAL'])
        assert np.allclose(np.linalg.norm(normals,axis=1),1,atol=2e-5)
        indices=accessor(p['indices']);assert indices.max()<len(a);triangles+=len(indices)//3
points=np.concatenate(points)
bounds=np.array([points.min(0),points.max(0)])
assert abs(bounds[0,1])<1e-7
assert abs(bounds[1,0]-bounds[0,0]-.06)<1e-7
assert 20000<=triangles<=40000

assert len(g['animations'])==1
clip=g['animations'][0];assert clip['name']=='assemble_explode_reassemble'
assert len(clip['channels'])==5
max_error=0
for ch in clip['channels']:
    assert ch['target']['path']=='translation'
    sampler=clip['samplers'][ch['sampler']]
    assert sampler['interpolation']=='CUBICSPLINE'
    times=accessor(sampler['input']).ravel()
    assert np.allclose(times,[0,1,3.2,4.8,7.2,8])
    keys=accessor(sampler['output']).reshape(6,3,3)
    assert (keys[:,0]==0).all() and (keys[:,2]==0).all()
    values=keys[:,1]
    assert np.array_equal(values[0],values[-1])
    assert np.array_equal(values[0],values[1])
    assert np.array_equal(values[2],values[3])
    assert np.array_equal(values[4],values[5])
    expected=g['nodes'][ch['target']['node']].get('translation',[0,0,0])
    max_error=max(max_error,float(abs(values[0]-expected).max()))
    assert np.allclose(values[0],expected,atol=1e-8)
    # Equivalent normalized outbound and inbound progress follows the same path.
    for u in np.linspace(0,1,51):
        w=u*u*(3-2*u)
        outward=values[1]*(1-w)+values[2]*w
        inward=values[3]*w+values[4]*(1-w)
        assert np.allclose(outward,inward,atol=1e-8)

report={'passed':True,'triangles':triangles,'bytes':len(b),'width_metres':float(bounds[1,0]-bounds[0,0]),'assembled_bounds_y_up':bounds.tolist(),'embedded_image_sizes':image_sizes,'five_direct_sibling_ingredient_nodes':True,'normals_unit_length':True,'tangents_present':True,'scale_constant':True,'first_last_pose_exactly_equal':True,'animation_holds_exact':True,'outbound_return_path_match':True,'default_pose_max_error':max_error}
(out/'independent-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
