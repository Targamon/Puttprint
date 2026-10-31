# Slim Dolphin courses.json (+ OSM trees) into src/data/courses.json
import json,xml.etree.ElementTree as ET,os
D=json.load(open('/workspace/dolphin/packages/shared/src/courses/courses.json'))['courses']
r=lambda pts:[[round(x,7),round(y,7)] for x,y in pts]
out=[]
for c in D:
    trees=[]
    f=f'/workspace/dolphin/data/osm/{c["id"]}.osm'
    if os.path.exists(f):
        root=ET.parse(f).getroot()
        trees=[[round(float(n.get('lon')),7),round(float(n.get('lat')),7)] for n in root.iter('node') if any(t.get('k')=='natural' and t.get('v')=='tree' for t in n.iter('tag'))]
    holes=[]
    for h in c['holes']:
        F=h.get('features',{})
        holes.append(dict(number=h['number'],par=h['par'],handicap=h.get('handicap'),yards=h.get('yards',{}),tee=h['tee'],green=h['greenCenter'],path=r(h['path']),
          features={k:([r(F[k])] if k=='green' and F.get(k) else [r(p) for p in F.get(k,[])]) for k in ['green','tees','fairways','bunkers','water','woods']}))
    out.append(dict(id=c['id'],name=c['name'],shortName=c['shortName'],address=c.get('address',''),par=c['par'],holeCount=c['holeCount'],
       tees=[t['name'] for t in c['tees']],geometry=c['dataStatus']['geometry'],location=c['location'],trees=trees,holes=holes,seeded=True))
json.dump(out,open('src/data/courses.json','w'),separators=(',',':'))
print([(c['id'],c['geometry'],len(c['trees'])) for c in out])
