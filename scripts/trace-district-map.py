"""Reproduce the schematic SVG paths from the licensed 2023 raster.
Offline build-time utility: Python + Pillow (not an application dependency).
No geographic coordinates are inferred; source pixel aspect ratio is preserved.
"""
from PIL import Image
from collections import defaultdict
from pathlib import Path
import json, math, hashlib
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/geography/astana-districts-2023-source.png'
im = Image.open(SOURCE).convert('RGB')
im.thumbnail((800, 1000), Image.Resampling.NEAREST)
w, h = im.size
pixels = im.load()
colors = {'saryarka': (255,201,14), 'almaty': (181,230,29), 'esil': (255,174,201), 'baikonur': (200,191,231), 'nura': (239,228,176)}

def rdp(points, tolerance=1.0):
    if len(points) < 3: return points
    ax, ay = points[0]; bx, by = points[-1]
    dx, dy = bx-ax, by-ay
    def distance(p):
        if dx == dy == 0: return math.hypot(p[0]-ax, p[1]-ay)
        return abs(dy*p[0]-dx*p[1]+bx*ay-by*ax)/math.hypot(dx,dy)
    index = max(range(1,len(points)-1), key=lambda i: distance(points[i]))
    if distance(points[index]) <= tolerance: return [points[0],points[-1]]
    return rdp(points[:index+1],tolerance)[:-1] + rdp(points[index:],tolerance)

def trace(color):
    mask = {(x,y) for y in range(h) for x in range(w) if pixels[x,y] == color}
    edges = defaultdict(list)
    for x,y in sorted(mask):
        # Clockwise exterior, counterclockwise interior lake holes.
        if (x,y-1) not in mask: edges[(x,y)].append((x+1,y))
        if (x+1,y) not in mask: edges[(x+1,y)].append((x+1,y+1))
        if (x,y+1) not in mask: edges[(x+1,y+1)].append((x,y+1))
        if (x-1,y) not in mask: edges[(x,y+1)].append((x,y))
    paths=[]
    while edges:
        start=min(edges); current=start; ring=[start]
        while True:
            following=edges[current].pop()
            if not edges[current]: del edges[current]
            ring.append(following);current=following
            if current==start: break
        area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))/2
        if area < 100: continue # fill lake holes; discard tiny raster artifacts, keep detached districts
        pivot=len(ring)//2
        simplified=rdp(ring[:pivot+1])[:-1]+rdp(ring[pivot:])
        paths.append((area,'M'+' L'.join(f'{x} {y}' for x,y in simplified[:-1])+' Z'))
    return ' '.join(p for _,p in sorted(paths,reverse=True))

# Digitized from the blue Yesil channel on the SAME 2023 source; minor bends omitted.
# Coordinates use the 800x981 source raster, not arbitrary decorative placement.
river = [(147,373),(163,379),(178,385),(199,388),(209,399),(223,404),(252,406),(255,425),(269,428),(281,424),(293,418),(304,413),(310,419),(315,430),(324,434),(328,450),(333,462),(334,468),(340,473),(340,479),(334,484),(338,492),(340,502),(351,507),(366,508),(373,515),(370,522),(384,519),(400,511)]
# Only the central, clearly identifiable river reach is shown; other watercourses omitted.
result = {'source': 'https://commons.wikimedia.org/wiki/File:Astana_districts_coloured_2023.png', 'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'period':'2023 (source revision 2023-01-07)', 'license':'CC-BY-SA-4.0', 'author':'Bogomolov.PL', 'viewBox':'-100 35 1000 930', 'districts':{k:trace(v) for k,v in colors.items()}, 'river':'M'+' L'.join(f'{x} {y}' for x,y in river)}
(ROOT/'data/geography/astana-2023.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Traced five districts; detached components retained; equal x/y scale.')
