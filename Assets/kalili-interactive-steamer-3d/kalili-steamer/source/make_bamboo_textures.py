"""Unlit, tileable 1K bamboo maps. Run with Python + numpy/scipy/Pillow."""
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates
from PIL import Image
out=Path(__file__).resolve().parent.parent/'textures';out.mkdir(exist_ok=True)
n=1024;rng=np.random.default_rng(813)
def field(sig):
 a=gaussian_filter(rng.normal(size=(n,n)),sig,mode='wrap');return a/a.std()
y,x=np.mgrid[:n,:n]
grain=field((1.1,42));wide=field((18,150));fine=field((.7,8))
warp=y+2.4*np.sin(x/n*2*np.pi)+1.2*np.sin(x/n*6*np.pi)
grain=map_coordinates(grain,[warp,x],mode='wrap')
height=.5*grain+.24*fine+.26*wide
rgb=np.array([194,148,85])[None,None,:]+(grain*3.1+wide*6+fine*.7)[:,:,None]*[1,.85,.59]
Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(out/'bamboo-basecolor.jpg',quality=93,subsampling=0)
gx=(np.roll(height,-1,1)-np.roll(height,1,1))*.11
gy=(np.roll(height,-1,0)-np.roll(height,1,0))*.11
normal=np.stack([-gx,gy,np.ones_like(gx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/'bamboo-normal.png',optimize=True)
Image.fromarray(np.uint8(np.clip(172+height*6,149,194))).save(out/'bamboo-roughness.png',optimize=True)
print('Bamboo image maps ready')
