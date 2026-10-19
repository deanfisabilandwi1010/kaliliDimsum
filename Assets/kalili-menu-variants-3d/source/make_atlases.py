"""Deterministic portable surface maps. No lighting, shadows, or photo projection.

Four atlas regions: ivory/charcoal wrapper, orange cap, hidden core, pale cheese.
Toasting is an irregular material-color pattern, never baked illumination.
"""
from pathlib import Path
import io,os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT=Path(__file__).resolve().parent.parent/'textures'
OUT.mkdir(parents=True,exist_ok=True)
S=512
y,x=np.mgrid[:S,:S].astype(float)/S
xx=(x-.5)*2; yy=(y-.5)*2; rr=np.sqrt(xx*xx+yy*yy)

def field(rng,scale):
    a=gaussian_filter(rng.normal(size=(S,S)),scale,mode='wrap')
    return (a-a.mean())/(a.std()+1e-8)

def blend(a,c,w):
    return a*(1-w[...,None])+np.array(c)[None,None,:]*w[...,None]

def save_complete(im,path,fmt,**kwargs):
    buf=io.BytesIO();im.save(buf,format=fmt,**kwargs);payload=buf.getvalue()
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o644)
    try:
        remaining=memoryview(payload)
        while remaining:remaining=remaining[os.write(fd,remaining):]
    finally:os.close(fd)
    assert path.read_bytes()==payload
    with Image.open(path) as check:check.load()

def region(kind,seed):
    rng=np.random.default_rng(seed)
    broad=field(rng,23); mid=field(rng,6); fine=field(rng,1.2)
    base={'ivory':[236,218,178],'black':[36,32,27],'core':[208,177,138],
          'cap':[246,137,38],'cheese':[250,224,155]}[kind]
    rgb=np.zeros((S,S,3))+base
    height=.1*mid+.025*fine
    if kind in ('ivory','black','core'):
        amount={'ivory':2.1,'black':1.8,'core':2.5}[kind]
        rgb+=(.70*broad+.25*mid+.07*fine)[...,None]*amount
        rough=np.clip((.63 if kind=='black' else .64)+.018*broad+.009*mid,.55,.72)
        height=.035*mid+.007*fine
    else:
        rgb+=(1.9*broad+1.4*mid+.45*fine)[...,None]
        # Soft irregular golden blisters, plus small discrete char flecks.
        toast=np.clip((.9*broad+.52*mid-.14)/1.25,0,1)
        if kind=='cheese':toast*=.86
        rgb=blend(rgb,[176,91,23] if kind=='cap' else [201,128,37],toast*.77)
        marks=np.zeros((S,S)); halo=np.zeros((S,S))
        count=135 if kind=='cap' else 65
        for i in range(count):
            cx,cy=rng.uniform(.075,.925,2)
            rx=rng.uniform(.0025,.0100); ry=rx*rng.uniform(.55,1.35)
            if i<9:rx*=2.2;ry*=1.6
            angle=rng.uniform(0,6.283)
            dx=(x-cx)*np.cos(angle)+(y-cy)*np.sin(angle)
            dy=-(x-cx)*np.sin(angle)+(y-cy)*np.cos(angle)
            d=(dx/rx)**2+(dy/ry)**2
            mask=np.clip((1.4-d+.17*fine)*2,0,1)
            marks=np.maximum(marks,mask*rng.uniform(.55,1))
            halo=np.maximum(halo,np.exp(-d*.23)*.3)
        rgb=blend(rgb,[173,100,32],halo)
        rgb=blend(rgb,[58,38,22],marks*.88)
        rough=np.clip(.425+.020*mid+.07*toast+.07*marks,.38,.65)
        height=.22*mid+.05*fine+.065*toast-.025*marks
    dy,dx=np.gradient(height)
    normal=np.stack([-dx,-dy,np.ones_like(dx)],-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    return np.clip(rgb,0,255).astype('uint8'),np.rint((normal*.5+.5)*255).astype('uint8'),np.rint(rough*255).astype('uint8')

for variant in ('cheese-mentai','black-series'):
    rgb=np.zeros((1024,1024,3),dtype='uint8');norm=np.zeros_like(rgb);rough=np.zeros((1024,1024),dtype='uint8')
    # Pillow row order is top-down; UV V is bottom-up.
    specs=[('black' if variant=='black-series' else 'ivory',0,0,122),
           ('cap',0,512,723 if variant=='black-series' else 381),
           ('core',512,0,65),('cheese',512,512,245 if variant=='black-series' else 991)]
    for kind,j,i,seed in specs:
        c,n,r=region(kind,seed);rgb[j:j+S,i:i+S]=c;norm[j:j+S,i:i+S]=n;rough[j:j+S,i:i+S]=r
    save_complete(Image.fromarray(rgb),OUT/(variant+'-basecolor.jpg'),'JPEG',quality=92,subsampling=0,optimize=True)
    save_complete(Image.fromarray(norm),OUT/(variant+'-normal.png'),'PNG',optimize=True)
    save_complete(Image.fromarray(rough),OUT/(variant+'-roughness.png'),'PNG',optimize=True)
    print(variant,'atlas ready')
