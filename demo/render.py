import json,math,sys
sys.path.insert(0,'/workspace/dolphin/data/osm')
from parse import load
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageChops
import random
D=json.load(open('/workspace/dolphin/packages/shared/src/courses/courses.json'))['courses']
C=[x for x in D if x['id']=='thunderhart'][0]
ways=load('/workspace/dolphin/data/osm/thunderhart.osm')
import xml.etree.ElementTree as ET
_r=ET.parse('/workspace/dolphin/data/osm/thunderhart.osm').getroot()
TREES=[(float(n.get('lat')),float(n.get('lon'))) for n in _r.iter('node') if any(t.get('k')=='natural' and t.get('v')=='tree' for t in n.iter('tag'))]
W,H=1170,2532; S=2  # supersample
F=lambda s:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',s*S)
Fr=lambda s:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',s*S)
def ll2m(lon,lat,o):
    return ((lon-o[0])*111320*math.cos(math.radians(o[1])),(lat-o[1])*110540)
STYLE={'woods':('#2f6b3a',None),'water':('#4aa3df','#2b7fb8'),'lateral_water_hazard':('#4aa3df','#2b7fb8'),'water_hazard':('#4aa3df','#2b7fb8'),
 'fairway':('#7cc66a','#69b357'),'tee':('#8fd47d','#5fa04e'),'bunker':('#f1e2b0','#d9c58a'),'green':('#a8e69a','#6fbf5f'),'rough':('#5aa64d',None)}
ORDER=['woods','rough','water','lateral_water_hazard','water_hazard','fairway','tee','bunker','green']
# ghost (demo) clubs + carry yards per hole
GHOST={1:[('Driver',250),('9i',110)],2:[('Driver',255),('3W',160),('SW',45)],3:[('Driver',240),('PW',105)]}
def render(n):
    h=C['holes'][n-1]; o=h['tee']; g=h['greenCenter']
    gx,gy=ll2m(*g,o); ang=math.atan2(gx,gy)
    pathm=[ll2m(*p,o) for p in h['path']]
    def rot(p):
        x,y=p; c,s=math.cos(ang),math.sin(ang); return (x*c-y*s, x*s+y*c)
    pr=[rot(p) for p in pathm]
    xs=[p[0] for p in pr]; ys=[p[1] for p in pr]
    L=max(ys); mapT,mapB=330,2050; padm=45
    sc=(mapB-mapT)/(L+2*padm); cx=W/2-(min(xs)+max(xs))/2*sc
    def scr(p): x,y=rot(p); return ((cx+x*sc)*S,(mapB-(y+padm)*sc)*S)
    im=Image.new('RGB',(W*S,H*S),'#3f8a3f'); d=ImageDraw.Draw(im)
    # gather OSM features near hole
    feats=[]
    for wid,tg,pts in ways:
        kind=tg.get('golf') or tg.get('natural') or tg.get('landuse')
        if kind=='forest':kind='woods'
        if kind=='wood':kind='woods'
        if tg.get('natural')=='water' or tg.get('water'):kind='water'
        if kind not in STYLE or len(pts)<3: continue
        P=[rot(ll2m(lon,lat,o)) for lat,lon in pts]
        if any(abs(x*sc+cx-W/2)<W/2+100 and -padm-80<y<L+padm+80 for x,y in P):
            feats.append((ORDER.index(kind),kind,[((cx+x*sc)*S,(mapB-(y+padm)*sc)*S) for x,y in P]))
    WW,HH=W*S,H*S
    def noise(base,amp,blur=2):
        n=Image.effect_noise((WW//4,HH//4),amp).resize((WW,HH)).filter(ImageFilter.GaussianBlur(blur))
        b=Image.new('RGB',(WW,HH),base); return ImageChops.add(ImageChops.subtract(b,Image.new('RGB',(WW,HH),(12,12,12))),Image.merge('RGB',[n.point(lambda v:v//10)]*3))
    def stripes(c1,c2,band):
        t=Image.new('RGB',(WW,HH),c1); td=ImageDraw.Draw(t)
        for y in range(0,HH,band*2): td.rectangle([0,y,WW,y+band],fill=c2)
        return t
    im.paste(noise('#2f6e33',40))  # darker rough base
    d=ImageDraw.Draw(im)
    TEX={'woods':lambda:noise('#1f4f28',70,4),'rough':lambda:noise('#336f35',40),
     'water':lambda:Image.new('RGB',(WW,HH),'#3d97d6'),'fairway':lambda:stripes('#7ccb68','#6db95a',34*S),
     'tee':lambda:stripes('#8fd67c','#80c76e',14*S),'bunker':lambda:noise('#f4e4b4',30,1),'green':lambda:stripes('#9fe48f','#92d882',12*S)}
    TEX['lateral_water_hazard']=TEX['water_hazard']=TEX['water']
    SH={'woods':0.45,'fairway':0.25,'green':0.3,'tee':0.25,'bunker':0.0,'water':0.0}
    for k in sorted(set(f[1] for f in feats),key=ORDER.index):
        m=Image.new('L',(WW,HH),0); md=ImageDraw.Draw(m)
        for _,kk,P in feats:
            if kk==k: md.polygon(P,fill=255)
        a=SH.get(k,0.15)
        if a:
            sh=m.filter(ImageFilter.GaussianBlur(10*S)).point(lambda v:int(v*a))
            im.paste((10,30,14),(6*S,10*S),sh)
        if k in('bunker','water','lateral_water_hazard','water_hazard'):
            # inner lip shadow
            im.paste(Image.new('RGB',(WW,HH),'#24557a' if 'water' in k else '#c9ad6a'),(0,0),m)
            inner=m.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(4*S))
            im.paste(TEX[k](),(0,0),inner)
            if 'water' in k:
                hl=Image.new('RGB',(WW,HH),'#7cc4f0'); g2=m.filter(ImageFilter.MinFilter(15)).filter(ImageFilter.GaussianBlur(14*S))
                im.paste(hl,(-6*S,-8*S),ImageChops.subtract(inner,g2).point(lambda v:v//2))
        else:
            im.paste(TEX[k](),(0,0),m)
        d=ImageDraw.Draw(im)
        f,ol=STYLE[k]
        edge={'water':'#1f5f8f','lateral_water_hazard':'#1f5f8f','water_hazard':'#1f5f8f','bunker':'#b8975a','green':'#5fae50','fairway':'#5ea34c','tee':'#5fa04e'}.get(k)
        if edge:
            for _,kk,P in feats:
                if kk==k: d.line(P+[P[0]],fill=edge,width=4*S if 'water' in k else 3*S,joint='curve')
    def inview(x,y): return abs(x*sc+cx-W/2)<W/2+60 and -padm-60<y<L+padm+60
    def S2(x,y): return ((cx+x*sc)*S,(mapB-(y+padm)*sc)*S)
    # cart paths (OSM golf=cartpath + service roads)
    for wid,tg,pts in ways:
        if tg.get('golf')=='cartpath' or tg.get('highway') in('service','track') and tg.get('golf')!='hole':
            P=[rot(ll2m(lon,lat,o)) for lat,lon in pts]
            if len(P)>1 and any(inview(*p) for p in P):
                Q=[S2(*p) for p in P]; wd=max(5,int(2.4*sc))*S
                d.line([(x+3*S,y+5*S) for x,y in Q],fill='#1e4a24',width=wd+4*S,joint='curve')
                d.line(Q,fill='#9a958a',width=wd+4*S,joint='curve'); d.line(Q,fill='#d8d3c4',width=wd,joint='curve')
    # trees: real OSM tree nodes + canopy fill along woods edges
    rng=random.Random(n*7); TP=[]
    for lat,lon in TREES:
        x,y=rot(ll2m(lon,lat,o))
        if inview(x,y): TP.append((S2(x,y),rng.uniform(16,24)))
    for _,kk,P in feats:
        if kk=='woods':
            for i in range(0,len(P),2):
                TP.append(((P[i][0]+rng.uniform(-30,30)*S,P[i][1]+rng.uniform(-30,30)*S),rng.uniform(18,28)))
    # sparse rough trees left/right of play corridor, avoiding fairway/green
    cor=[scr(p) for p in pathm]
    for _ in range(26):
        a=rng.choice(cor); side=rng.choice((-1,1)); off=rng.uniform(230,400)*S
        TP.append(((a[0]+side*off,a[1]+rng.uniform(-80,80)*S),rng.uniform(16,26)))
    TP=[t for t in TP if 0<t[0][0]<WW and 300*S<t[0][1]<2080*S]
    shm=Image.new('L',(WW,HH),0); sd=ImageDraw.Draw(shm)
    for (x,y),r in TP: sd.ellipse([x-r*S+9*S,y-r*S+14*S,x+r*S+9*S,y+r*S+14*S],fill=140)
    im.paste((8,28,12),(0,0),shm.filter(ImageFilter.GaussianBlur(6*S))); d=ImageDraw.Draw(im)
    for (x,y),r in sorted(TP,key=lambda t:t[0][1]):
        R=r*S; tone=rng.choice([('#1d5a2a','#2e7d3a','#4c9e4f'),('#235f2c','#38863f','#5fae57'),('#2a5a24','#4a8a34','#7cb44f')])
        d.ellipse([x-R,y-R,x+R,y+R],fill=tone[0])
        for k in range(5):
            aa=k*1.256+rng.random(); rr=R*0.55
            d.ellipse([x+math.cos(aa)*R*0.35-rr,y+math.sin(aa)*R*0.35-rr,x+math.cos(aa)*R*0.35+rr,y+math.sin(aa)*R*0.35+rr],fill=tone[1])
        d.ellipse([x-R*0.55,y-R*0.65,x+R*0.1,y-R*0.0],fill=tone[2])
    # tee markers (blue + white) at tee
    T0=scr((0,0))
    for dx,c in((-58,'#1565c0'),(58,'#1565c0'),(-40,'#fafafa'),(40,'#fafafa')):
        yy=T0[1]+(0 if c!='#fafafa' else 46*S)
        d.ellipse([T0[0]+dx*S-11*S,yy-11*S+3*S,T0[0]+dx*S+11*S,yy+11*S+3*S],fill='#123')
        d.ellipse([T0[0]+dx*S-10*S,yy-10*S,T0[0]+dx*S+10*S,yy+10*S],fill=c,outline='#0d2b45',width=2*S)
    # yardage markers 200/150/100 to green along path
    segs0=list(zip(pathm,pathm[1:])); tot0=sum(math.dist(a,b) for a,b in segs0)
    def at0(m):
        for a,b in segs0:
            l=math.dist(a,b)
            if m<=l: t=m/l; return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
            m-=l
        return pathm[-1]
    for yd,c in((200,'#1565c0'),(150,'#fafafa'),(100,'#e53935')):
        m=tot0-yd*0.9144
        if m>60:
            p=scr(at0(m)); p=(p[0]+120*S,p[1])
            d.ellipse([p[0]-14*S,p[1]-14*S+4*S,p[0]+14*S,p[1]+14*S+4*S],fill='#123')
            d.ellipse([p[0]-14*S,p[1]-14*S,p[0]+14*S,p[1]+14*S],fill=c,outline='#222',width=2*S)
            d.text((p[0]+20*S,p[1]-16*S),str(yd),font=F(24),fill='white',stroke_width=3*S,stroke_fill='#103018')
    # flag with cup + shadow
    G=scr(ll2m(*g,o))
    d.ellipse([G[0]-13*S,G[1]-7*S,G[0]+13*S,G[1]+7*S],fill='#1b1b1b',outline='#e8f5e9',width=2*S)
    d.line([(G[0]+4*S,G[1]),(G[0]+44*S,G[1]+26*S)],fill='#2f6a2f',width=5*S)
    d.polygon([(G[0]+44*S,G[1]+26*S),(G[0]+78*S,G[1]+30*S),(G[0]+56*S,G[1]+44*S)],fill='#3d7a3a')
    d.line([G,(G[0],G[1]-90*S)],fill='white',width=6*S); d.line([G,(G[0],G[1]-90*S)],fill='#cfd8dc',width=2*S)
    d.polygon([(G[0]+3*S,G[1]-90*S),(G[0]+56*S,G[1]-76*S),(G[0]+3*S,G[1]-60*S)],fill='#e53935',outline='#8e1c1a')
    d.text((G[0]+12*S,G[1]-87*S),str(n),font=F(20),fill='white')
    # ghost line along hole path, shot points by carry
    segs=list(zip(pathm,pathm[1:])); tot=sum(math.dist(a,b) for a,b in segs)
    def at(m):
        for a,b in segs:
            l=math.dist(a,b)
            if m<=l: t=m/l; return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
            m-=l
        return pathm[-1]
    pts=[(0,0)]; acc=0
    for club,yd in GHOST[n]:
        acc=min(acc+yd*0.9144,tot); pts.append(at(acc))
    pts.append(ll2m(*g,o)); pts=[scr(p) for p in pts]
    gold='#f2b705'
    for (a,b),(club,yd) in zip(zip(pts,pts[1:]),GHOST[n]+[('Putt',0)]):
        L2=math.dist(a,b); k=int(L2/(28*S))
        for i in range(0,k,2):
            t1,t2=i/k,(i+1)/k; q=[(a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1),(a[0]+(b[0]-a[0])*t2,a[1]+(b[1]-a[1])*t2)]; d.line(q,fill='#5a4300',width=16*S); d.line(q,fill=gold,width=11*S); d.line(q,fill='#ffe27a',width=3*S)
        if club!='Putt':
            mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2; lbl=f'{club} {yd}y'
            bb=d.textbbox((0,0),lbl,font=F(30)); w=bb[2]+28*S
            d.rounded_rectangle([mx+28*S,my-18*S,mx+28*S+w,my+30*S],18*S,fill='#00000066'); d.rounded_rectangle([mx+24*S,my-24*S,mx+24*S+w,my+24*S],18*S,fill='#14110a',outline=gold,width=4*S)
            d.text((mx+38*S,my-18*S),lbl,font=F(30),fill=gold)
    for p in pts[1:-1]: d.ellipse([p[0]-16*S,p[1]-16*S,p[0]+16*S,p[1]+16*S],fill=gold,outline='white',width=3*S)
    T=pts[0]; d.ellipse([T[0]-44*S,T[1]-44*S,T[0]+44*S,T[1]+44*S],fill='#90c8f5'); d.ellipse([T[0]-30*S,T[1]-30*S,T[0]+30*S,T[1]+30*S],fill='#1e88e5',outline='white',width=6*S)
    # UI chrome
    for yy in range(300*S): d.line([(0,yy),(W*S,yy)],fill=(int(22-10*yy/(300*S)),int(52-20*yy/(300*S)),int(34-14*yy/(300*S))))
    d.line([(0,300*S),(W*S,300*S)],fill=gold,width=4*S)
    sh=Image.new('L',(W*S,H*S),0); ImageDraw.Draw(sh).rectangle([0,0,W*S,300*S],fill=150); sh=sh.filter(ImageFilter.GaussianBlur(14*S))
    sh2=sh.crop((0,0,W*S,340*S)); im.paste((0,0,0),(0,0),Image.merge('L',[ImageChops.subtract(sh2,Image.new('L',sh2.size,0))])); 
    for yy in range(300*S): d.line([(0,yy),(W*S,yy)],fill=(int(22-10*yy/(300*S)),int(52-20*yy/(300*S)),int(34-14*yy/(300*S))))
    d.line([(0,300*S),(W*S,300*S)],fill=gold,width=4*S)
    d.text((60*S,90*S),'PUTT PRINT',font=F(40),fill=gold)
    d.text((60*S,150*S),f'Hole {n}',font=F(92),fill='white')
    d.text((560*S,160*S),f"Par {h['par']}",font=F(56),fill='white')
    yb=h['yards']; yb=yb if isinstance(yb,dict) else {}
    ytxt=f"Blue {yb.get('Blue','')}y · White {yb.get('White','')}y" if yb else f"{h['yards']}y"
    d.text((560*S,232*S),f"{ytxt} · HCP {h['handicap']}",font=Fr(30),fill='#cfe8d2')
    d.text((60*S,250*S),'Thunderhart GC',font=Fr(30),fill='#cfe8d2')
    d.rounded_rectangle([W*S-380*S,90*S,W*S-60*S,140*S],25*S,fill='#3a2f05',outline=gold,width=3*S)
    d.text((W*S-355*S,96*S),'👻 BEST GHOST ON'.replace('👻 ',''),font=F(28),fill=gold)
    for yy in range(2080*S,H*S): t=(yy-2080*S)/((H-2080)*S); d.line([(0,yy),(W*S,yy)],fill=(int(16-6*t),int(38-16*t),int(26-10*t)))
    d.line([(0,2080*S),(W*S,2080*S)],fill=gold,width=4*S)
    tot_g=sum(1 for _ in GHOST[n])+1
    d.text((60*S,2105*S),f'Ghost: {h["par"]-1 if True else ""} strokes (birdie) · {", ".join(c for c,_ in GHOST[n])}, putt',font=Fr(32),fill=gold)
    clubs=['Driver','3W','5i','7i','9i','PW','SW','Putter']
    for i,c in enumerate(clubs):
        x=40+i*137; sel=c==GHOST[n][0][0]
        d.rounded_rectangle([x*S,2170*S,(x+125)*S,2250*S],20*S,fill='#f2b705' if sel else '#24402e',outline='#ffe27a' if sel else '#3d6b4c',width=3*S)
        bb=d.textbbox((0,0),c,font=F(26)); d.text(((x+62)*S-bb[2]/2,2195*S),c,font=F(26),fill='#10261a' if sel else 'white')
    # PLAY: golf ball with large thumbprint
    d.rounded_rectangle([60*S,2296*S,(W-60)*S,2446*S],75*S,fill='#06240f'); d.rounded_rectangle([60*S,2286*S,(W-60)*S,2436*S],75*S,fill='#14532d',outline=gold,width=4*S)
    bx,by,br=210*S,2361*S,92*S
    d.ellipse([bx-br+6*S,by-br+10*S,bx+br+6*S,by+br+10*S],fill='#03140a')
    d.ellipse([bx-br,by-br,bx+br,by+br],fill='#f4f6f8',outline='#b0bec5',width=3*S)
    for i in range(-4,5):
        for j in range(-4,5):
            px,py=bx+i*21*S+(j%2)*10*S,by+j*19*S
            if math.dist((px,py),(bx,by))<br-12*S: d.ellipse([px-4*S,py-4*S,px+4*S,py+4*S],fill='#dfe5ea')
    fx,fy=bx+4*S,by+6*S
    for k in range(1,9):
        rx,ry=k*8.5*S,k*10.5*S
        d.arc([fx-rx,fy-ry,fx+rx,fy+ry],200+k*3,520-k*4,fill='#1e3a5f',width=4*S)
    d.ellipse([bx-br*0.7,by-br*0.8,bx-br*0.2,by-br*0.4],fill='#ffffff')
    d.text((360*S,2318*S),'PLAY',font=F(84),fill='white')
    d.text((364*S,2408*S)," ",font=F(10),fill='white')
    d.text((680*S,2348*S),'tap to stamp shot',font=Fr(30),fill='#ffe27a')
    d.text((60*S,2460*S),'You ● blue    Best Ghost — gold    Map: OSM, north rotated tee→green',font=Fr(24),fill='#9fbfa5')
    im.resize((W,H),Image.LANCZOS).save(f'thunderhart_hole{n}.png')
    print(n,h['par'],h['yards'],h['mappedLengthYards'],len(feats))
for n in (1,2,3): render(n)
