"""Create tileable, unlit PBR image maps. Requires numpy, scipy and Pillow."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, zoom

OUT = Path(__file__).resolve().parent.parent / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(91371)
N = 512

def noise(sigma):
    a = gaussian_filter(rng.normal(size=(N,N)), sigma, mode='wrap')
    return a / max(a.std(), 1e-9)

fine, medium, broad = noise(.8), noise(3.4), noise(17)
detail = .22*fine+.5*medium+.28*broad
for name, rgb, amount in [('wrapper', (239,220,179),3.3), ('meat',(220,191,155),6.8)]:
    variation = np.clip(detail, -2.8,2.8)*amount
    color = np.clip(np.array(rgb)[None,None,:]+variation[:,:,None]*np.array([1,.94,.81]),0,255).astype('uint8')
    Image.fromarray(color).save(OUT/f'{name}-basecolor.png',optimize=True)

height = gaussian_filter(rng.normal(size=(N,N)),1.5,mode='wrap')
height = height/height.std()
gx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*.115
gy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*.115
normal = np.stack([-gx,gy,np.ones_like(gx)],axis=-1)
normal /= np.linalg.norm(normal,axis=-1,keepdims=True)
Image.fromarray(np.uint8(np.clip(normal*.5+.5,0,1)*255)).save(OUT/'food-normal.png',optimize=True)
rough = np.uint8(np.clip(175+medium*7,152,195))
Image.fromarray(rough).save(OUT/'food-roughness.png',optimize=True)
print('Created 512px unlit color, normal and roughness maps.')
