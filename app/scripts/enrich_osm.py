# Enrich non-Thunderhart courses in src/data/courses.json with OSM from /workspace/dolphin/data/osm (read-only).
# Run after export_courses.py:  python3 scripts/export_courses.py && python3 scripts/enrich_osm.py
import json,math,xml.etree.ElementTree as ET
OSM='/workspace/dolphin/data/osm/'
C=json.load(open('src/data/courses.json'))
R=lambda pts:[[round(x,7),round(y,7)] for x,y in pts]
def m(a,b): return math.hypot((a[0]-b[0])*111320*math.cos(math.radians(b[1])),(a[1]-b[1])*110540)
def pip(p,poly):
    x,y=p;ins=False
    for i in range(len(poly)):
        x1,y1=poly[i-1];x2,y2=poly[i]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1+1e-15)+x1: ins=not ins
    return ins
def cen(p): return [sum(q[0] for q in p)/len(p),sum(q[1] for q in p)/len(p)]
def load(f):
    r=ET.parse(OSM+f+'.osm').getroot()
    N={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in r.iter('node')}
    W={}
    out=dict(ways=[],trees=[])
    for n in r.iter('node'):
        if any(t.get('k')=='natural' and t.get('v')=='tree' for t in n.iter('tag')): out['trees'].append(N[n.get('id')])
    for w in r.iter('way'):
        t={x.get('k'):x.get('v') for x in w.iter('tag')}
        p=[N[n.get('ref')] for n in w.iter('nd') if n.get('ref') in N]
        W[w.get('id')]=p
        if len(p)>=2: out['ways'].append((t,p))
    # multipolygon outer rings (e.g. golf_course, water)
    for rel in r.iter('relation'):
        t={x.get('k'):x.get('v') for x in rel.iter('tag')}
        if t.get('type')!='multipolygon': continue
        for mbr in rel.iter('member'):
            if mbr.get('type')=='way' and mbr.get('role')=='outer' and W.get(mbr.get('ref')): out['ways'].append((t,W[mbr.get('ref')]))
    return out
def kind(t):
    g=t.get('golf')
    if g in('hole','fairway','green','tee','bunker','cartpath'): return g
    if g in('water_hazard','lateral_water_hazard') or t.get('natural')=='water': return 'water'
    if t.get('natural')=='sand': return 'bunker'
    if t.get('natural')=='wood' or t.get('landuse')=='forest': return 'woods'
    if t.get('waterway') in('stream','river','ditch'): return 'stream'
    if t.get('leisure')=='golf_course': return 'outline'
    if t.get('highway')=='path' and t.get('golf_cart'): return 'cartpath'
    return None
def shift(c,dx,dy):
    mv=lambda p:[round(p[0]+dx,7),round(p[1]+dy,7)]
    for h in c['holes']:
        h['tee']=mv(h['tee']);h['green']=mv(h['green']);h['path']=[mv(p) for p in h['path']]
        for k,v in h['features'].items(): h['features'][k]=[[mv(p) for p in poly] for poly in v]
    c['location']['lon']+=dx;c['location']['lat']+=dy
report=[]
for c in C:
    if c['id']=='thunderhart': c['mapLabel']='OSM mapped';continue
    o=load(c['id']);ways=[(kind(t),t,p) for t,p in o['ways']]
    outl=[p for k,t,p in ways if k=='outline' and c['shortName'].split()[0].lower() in (t.get('name') or '').lower()]
    foreign=[p for k,t,p in ways if k=='outline' and p not in outl]  # e.g. Thunderhart inside sunnyhill bbox
    ok=lambda p: not any(pip(cen(p),f) for f in foreign)
    ex=dict(outline=[R(p) for p in outl],water=[],streams=[],cartpaths=[],woods=[])
    attached=0
    if outl and c['id']=='sycamore':  # holes unmapped: centre schematic layout inside the real club outline
        oc=cen(outl[0]);pts=[p for h in c['holes'] for p in h['path']];cc=cen(pts)
        shift(c,oc[0]-cc[0],oc[1]-cc[1])
    for k,t,p in ways:
        if k=='hole' and outl and t.get('ref','').isdigit() and ok(p):
            n=int(t['ref']);
            if 1<=n<=len(c['holes']):
                h=c['holes'][n-1];h['tee']=R([p[0]])[0];h['green']=R([p[-1]])[0];h['path']=R(p);attached+=1
                h['osm']=True
                if t.get('par','').isdigit(): h['par']=int(t['par'])
    for k,t,p in ways:
        if not ok(p): continue
        if k=='water': ex['water'].append(R(p))
        elif k=='stream': ex['streams'].append(R(p))
        elif k=='cartpath': ex['cartpaths'].append(R(p))
        elif k=='woods': ex['woods'].append(R(p))
    # per-hole OSM golf polygons for attached holes: assign to nearest hole path
    if attached:
        for h in c['holes']:
            if h.get('osm'): h['features']={k:[] for k in h['features']}
        for k,t,p in ways:
            if k not in('fairway','green','tee','bunker'): continue
            q=cen(p);best=min(c['holes'],key=lambda h:min(m(q,x) for x in h['path']))
            if not best.get('osm') or min(m(q,x) for x in best['path'])>90: continue
            key={'fairway':'fairways','tee':'tees','bunker':'bunkers','green':'green'}[k]
            if key=='green':  # a green belongs to the hole whose way ENDS at it
                best=min(c['holes'],key=lambda h:m(q,h['path'][-1]))
                if not best.get('osm') or m(q,best['path'][-1])>60 or best['features']['green']: continue
            best['features'][key].append(R(p))
        for h in c['holes']:
            if h.get('osm') and h['features']['green']: h['green']=R([cen(h['features']['green'][0])])[0]
    c['trees']=R([tr for tr in o['trees'] if not any(pip(tr,f) for f in foreign)])
    c['par']=sum(h['par'] for h in c['holes'])
    c['extras']=ex
    c['geometry']='osm-partial' if attached or outl else 'schematic'
    c['mapLabel']=f'OSM partial ({attached}/{len(c["holes"])} holes)' if attached else ('OSM outline + schematic holes' if outl else 'schematic (enhanced)')
    report.append((c['id'],c['mapLabel'],{k:len(v) for k,v in ex.items()},len(c['trees'])))
json.dump(C,open('src/data/courses.json','w'),separators=(',',':'))
for r in report: print(r)
