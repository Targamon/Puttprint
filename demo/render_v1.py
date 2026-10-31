import json,math,sys
sys.path.insert(0,'/workspace/dolphin/data/osm')
from parse import load
from PIL import Image,ImageDraw,ImageFont
D=json.load(open('/workspace/dolphin/packages/shared/src/courses/courses.json'))['courses']
C=[x for x in D if x['id']=='thunderhart'][0]
ways=load('/workspace/dolphin/data/osm/thunderhart.osm')
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
    for _,k,P in sorted(feats,key=lambda f:f[0]):
        f,ol=STYLE[k]; d.polygon(P,fill=f,outline=ol,width=3*S if ol else 0)
    # mow stripes on greens omitted; flag
    G=scr(ll2m(*g,o)); d.line([G,(G[0],G[1]-60*S)],fill='white',width=4*S); d.polygon([(G[0],G[1]-60*S),(G[0]+34*S,G[1]-50*S),(G[0],G[1]-40*S)],fill='#e53935')
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
            t1,t2=i/k,(i+1)/k; d.line([(a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1),(a[0]+(b[0]-a[0])*t2,a[1]+(b[1]-a[1])*t2)],fill=gold,width=8*S)
        if club!='Putt':
            mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2; lbl=f'{club} {yd}y'
            bb=d.textbbox((0,0),lbl,font=F(30)); w=bb[2]+28*S
            d.rounded_rectangle([mx+24*S,my-24*S,mx+24*S+w,my+24*S],18*S,fill='#1d1d1d',outline=gold,width=3*S)
            d.text((mx+38*S,my-18*S),lbl,font=F(30),fill=gold)
    for p in pts[1:-1]: d.ellipse([p[0]-16*S,p[1]-16*S,p[0]+16*S,p[1]+16*S],fill=gold,outline='white',width=3*S)
    T=pts[0]; d.ellipse([T[0]-30*S,T[1]-30*S,T[0]+30*S,T[1]+30*S],fill='#1e88e5',outline='white',width=6*S)
    # UI chrome
    d.rectangle([0,0,W*S,300*S],fill='#10261a')
    d.text((60*S,90*S),'PUTT PRINT',font=F(40),fill=gold)
    d.text((60*S,150*S),f'Hole {n}',font=F(92),fill='white')
    d.text((560*S,160*S),f"Par {h['par']}",font=F(56),fill='white')
    yb=h['yards']; yb=yb if isinstance(yb,dict) else {}
    ytxt=f"Blue {yb.get('Blue','')}y · White {yb.get('White','')}y" if yb else f"{h['yards']}y"
    d.text((560*S,232*S),f"{ytxt} · HCP {h['handicap']}",font=Fr(30),fill='#cfe8d2')
    d.text((60*S,250*S),'Thunderhart GC',font=Fr(30),fill='#cfe8d2')
    d.rounded_rectangle([W*S-380*S,90*S,W*S-60*S,140*S],25*S,fill='#3a2f05',outline=gold,width=3*S)
    d.text((W*S-355*S,96*S),'👻 BEST GHOST ON'.replace('👻 ',''),font=F(28),fill=gold)
    d.rectangle([0,2080*S,W*S,H*S],fill='#10261a')
    tot_g=sum(1 for _ in GHOST[n])+1
    d.text((60*S,2105*S),f'Ghost: {h["par"]-1 if True else ""} strokes (birdie) · {", ".join(c for c,_ in GHOST[n])}, putt',font=Fr(32),fill=gold)
    clubs=['Driver','3W','5i','7i','9i','PW','SW','Putter']
    for i,c in enumerate(clubs):
        x=40+i*137; sel=c==GHOST[n][0][0]
        d.rounded_rectangle([x*S,2170*S,(x+125)*S,2250*S],20*S,fill='#f2b705' if sel else '#24402e')
        bb=d.textbbox((0,0),c,font=F(26)); d.text(((x+62)*S-bb[2]/2,2195*S),c,font=F(26),fill='#10261a' if sel else 'white')
    d.rounded_rectangle([60*S,2290*S,(W-60)*S,2430*S],70*S,fill='#1e88e5')
    bb=d.textbbox((0,0),'▶  PLAY',font=F(60)); d.text((W/2*S-bb[2]/2,2322*S),'▶  PLAY',font=F(60),fill='white')
    d.text((60*S,2460*S),'You ● blue    Best Ghost — gold    Map: OSM, north rotated tee→green',font=Fr(24),fill='#9fbfa5')
    im.resize((W,H),Image.LANCZOS).save(f'thunderhart_hole{n}.png')
    print(n,h['par'],h['yards'],h['mappedLengthYards'],len(feats))
for n in (1,2,3): render(n)
