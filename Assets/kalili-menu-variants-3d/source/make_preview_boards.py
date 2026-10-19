"""Contact sheets from the actual GLB renders; no generated or painted food."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import io,os
OUT=Path(__file__).resolve().parent.parent
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
def font(n,serif=False):return ImageFont.truetype(SERIF if serif else FONT,n)
def put(im,file,xy,size):
    p=Image.open(file).convert('RGBA');p.thumbnail((size,size),Image.Resampling.LANCZOS)
    im.paste(p,xy,p)
def save(im,path):
    b=io.BytesIO();im.save(b,format='JPEG',quality=94,subsampling=0)
    data=memoryview(b.getvalue());fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o644)
    try:
        while data:data=data[os.write(fd,data):]
    finally:os.close(fd)
    with Image.open(path) as q:q.load()

im=Image.new('RGB',(1440,840),'#F7F0E4');d=ImageDraw.Draw(im)
d.text((66,47),'Dua varian. Satu keluarga Kalili.',font=font(39,True),fill='#532A23')
d.text((68,105),'Model 3D mandiri  /  lebar 60 mm  /  lima komponen terpisah',font=font(19),fill='#7A6758')
for i,(name,v) in enumerate([('Cheese Mentai','cheese-mentai'),('Black Series','black-series')]):
    x=40+i*710;put(im,OUT/('kalili-'+v+'-preview.png'),(x,130),650)
    d.text((x+66,749),name,font=font(28,True),fill='#702B24')
save(im,OUT/'kalili-menu-variants-preview.jpg')

im=Image.new('RGB',(1440,820),'#F7F0E4');d=ImageDraw.Draw(im)
d.text((35,25),'Perbandingan dengan Original — pencahayaan dan skala yang sama',font=font(25),fill='#532A23')
for i,(name,file) in enumerate([('Original',OUT/'qa'/'original-same-light.png'),('Cheese Mentai',OUT/'kalili-cheese-mentai-preview.png'),('Black Series',OUT/'kalili-black-series-preview.png')]):
    x=i*480;put(im,file,(x+10,80),460);d.text((x+80,540),name,font=font(23),fill='#532A23')
    d.rectangle((x+15,600,x+465,805),fill='#211C1B')
    put(im,file,(x+35,610),180);put(im,file,(x+280,630),120)
    d.text((x+80,783),'180 px',font=font(12),fill='#D9CBBB');d.text((x+318,765),'120 px',font=font(12),fill='#D9CBBB')
save(im,OUT/'qa'/'same-light-and-small-size.jpg')

im=Image.new('RGB',(1600,850),'#F7F0E4');d=ImageDraw.Draw(im)
for row,v in enumerate(['cheese-mentai','black-series']):
    for col,view in enumerate(['front','side','top','underside']):
        x=col*400;y=row*420
        put(im,OUT/'qa'/(v+'-'+view+'.png'),(x,y+30),390)
        d.text((x+20,y+12),v+' / '+view,font=font(15),fill='#532A23')
save(im,OUT/'qa'/'geometry-inspection.jpg')

# Separate native-size cream/dark comparison, including 120px checks.
im=Image.new('RGB',(960,510),'#F7F0E4');d=ImageDraw.Draw(im)
d.rectangle((0,255,959,509),fill='#211C1B')
for i,(v,label) in enumerate([('cheese-mentai','Cheese Mentai'),('black-series','Black Series')]):
    for row in range(2):
        x=i*480;y=row*255
        put(im,OUT/('kalili-'+v+'-preview.png'),(x+22,y+35),180)
        put(im,OUT/('kalili-'+v+'-preview.png'),(x+286,y+55),120)
        d.text((x+34,y+12),label+'  /  180 px + 120 px',font=font(15),fill='#D9CBBB' if row else '#532A23')
save(im,OUT/'qa'/'cream-dark-readability.jpg')
