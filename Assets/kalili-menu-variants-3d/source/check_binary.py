"""Independent raw GLB checks: hierarchy, units, embedded maps, normals, geometry."""
from pathlib import Path
import struct,json,io
import numpy as np
from PIL import Image
OUT=Path(__file__).resolve().parent.parent
reports={}
for variant in ('cheese-mentai','black-series'):
    path=OUT/('kalili-'+variant+'.glb');b=path.read_bytes()
    magic,version,length=struct.unpack_from('<III',b)
    assert (magic,version,length)==(0x46546c67,2,len(b))
    jlen,jtype=struct.unpack_from('<II',b,12);g=json.loads(b[20:20+jlen])
    blen,btype=struct.unpack_from('<II',b,20+jlen);binary=b[28+jlen:28+jlen+blen]
    def accessor(idx):
        a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']]
        dtype=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']])
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dtype.itemsize*width),dtype.itemsize)).copy()
    names=['wrapper_shell','filling_core','topping_cap' if variant=='black-series' else 'mentai_cap','cheese_surface','garnish_details']
    rootname='black_series_root' if variant=='black-series' else 'cheese_mentai_root'
    root=next(n for n in g['nodes'] if n['name']==rootname)
    assert root.get('translation',[0,0,0])==[0,0,0] and root.get('rotation',[0,0,0,1])==[0,0,0,1]
    assert set(g['nodes'][i]['name'] for i in root['children'])==set(names)
    assert len(g['nodes'])==6 and len(g['meshes'])==5
    assert not g.get('cameras') and not g.get('skins') and not g.get('animations')
    assert not g.get('extensionsRequired') and 'KHR_lights_punctual' not in g.get('extensions',{})
    assert all(m['pbrMetallicRoughness'].get('metallicFactor',1)==0 for m in g['materials'])
    assert len(g['images'])==3 and all('normalTexture' in m for m in g['materials'])
    assert all('uri' not in x for x in g['buffers'])
    images=[]
    for im in g['images']:
        assert 'bufferView' in im and 'uri' not in im
        v=g['bufferViews'][im['bufferView']];o=v.get('byteOffset',0)
        image=Image.open(io.BytesIO(binary[o:o+v['byteLength']]));image.load()
        assert max(image.size)<=2048
        images.append({'size':image.size,'bytes':v['byteLength'],'format':image.format})
    triangles=0;points=[];component_transforms={}
    for node in g['nodes']:
        assert node.get('scale',[1,1,1])==[1,1,1]
        if 'mesh' not in node:continue
        t=np.array(node.get('translation',[0,0,0]));component_transforms[node['name']]={'translation':t.tolist(),'rotation':node.get('rotation',[0,0,0,1]),'scale':[1,1,1]}
        for p in g['meshes'][node['mesh']]['primitives']:
            assert p.get('mode',4)==4
            pos=accessor(p['attributes']['POSITION']);assert np.isfinite(pos).all();points.append(pos+t)
            normals=accessor(p['attributes']['NORMAL']);assert np.allclose(np.linalg.norm(normals,axis=1),1,atol=2e-5)
            tan=accessor(p['attributes']['TANGENT']);assert np.isfinite(tan).all()
            # Blender's glTF tangent output is rounded to four decimals.
            assert np.allclose(np.linalg.norm(tan[:,:3],axis=1),1,atol=1e-4)
            assert np.all(np.abs(np.sum(tan[:,:3]*normals,axis=1))<1e-4)
            indices=accessor(p['indices']).ravel();assert indices.max()<len(pos);triangles+=len(indices)//3
            tri=pos[indices].reshape(-1,3,3)
            areas=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5
            assert areas.min()>1e-13,(node['name'],float(areas.min()))
    points=np.concatenate(points);bounds=np.array([points.min(0),points.max(0)])
    assert abs(bounds[0,1])<1e-7 and abs(bounds[1,0]-bounds[0,0]-.06)<1e-7
    assert 8000<=triangles<=15000 and len(b)<2_000_000
    reports[variant]={'passed':True,'file_bytes':len(b),'triangles':triangles,'root':rootname,'width_m':float(bounds[1,0]-bounds[0,0]),'bounds_y_up_m':bounds.tolist(),'embedded_images':images,'component_transforms':component_transforms,'unit_normals_and_tangents':True,'non_degenerate_triangles':True,'external_dependencies':False,'required_extensions':[]}
(OUT/'binary-validation.json').write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2))
