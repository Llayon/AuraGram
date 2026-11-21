"""All frozen loss-neighborhood profiles. Offline QA, not app processing."""
import os,sys,json
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(repo/'.snapshots/plot-libs'))
os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

source,centers,output=map(Path,sys.argv[1:4])
output.mkdir(parents=True,exist_ok=False)
for engine in ['chromium','webkit']:
 data=json.loads((source/(engine+'.json')).read_text())
 old=json.loads((centers/('centers-'+engine+'.json')).read_text())
 for case in data['results']:
  crop=next(c for c in old['results'] if c['id']==case['id'])['crop']
  x,y=case['source']['x'],case['source']['y'];left,top=int(x)-24,int(y)-24
  patch=Image.open(repo/'tests/visual/positive-evidence/sources'/case['file']).crop((left,top,left+48,top+48))
  for cfg in case['configurations']:
   fig,axes=plt.subplots(2,3,figsize=(13,8));axs=list(axes.flat);ins=cfg['inspection']
   axs[0].imshow(patch,extent=(left-.5,left+47.5,top+47.5,top-.5),interpolation='nearest')
   axs[0].plot(x-.5,y-.5,'cx',label='old anchor');axs[0].set_title('Original pixels + diagnostic profiles')
   if ins['available']:
    for ax,row in zip(axs[1:],ins['rows']):
     profile=row['profile'];point=row['reference'];nx,ny=row['nx'],row['ny'];rad=row['radius']
     axs[0].plot([point['x']+crop['x']-nx*rad,point['x']+crop['x']+nx*rad],[point['y']+crop['y']-ny*rad,point['y']+crop['y']+ny*rad],color='#999',linewidth=.5)
     if row['accepted']:axs[0].plot(row['center']['x']+crop['x'],row['center']['y']+crop['y'],'go',markersize=3)
     else:axs[0].plot(point['x']+crop['x'],point['y']+crop['y'],'rx',markersize=3)
     ax.plot([p['offset'] for p in profile],[p['deficit'] for p in profile],label='background deficit')
     ax.axvspan(-row['searchHalf'],row['searchHalf'],color='gray',alpha=.1,label='mapped search cell')
     ax.axhline(.006,color='red',linestyle='--',linewidth=.7)
     ax.axvline(row['proposedShift'],color='green' if row['accepted'] else 'red',linewidth=.8)
     ax.set_title('d%s: %s\nshift%.3f, lateral=%s'%(row['distanceNative'],row['reason'],row['proposedShift'],row['displacedSupport']),fontsize=9)
     ax.set_xlabel('native transverse offset (px)');ax.set_ylabel('deficit; not ridge probability')
   else:
    for ax in axs[1:]:ax.text(.1,.5,'UNKNOWN: no axis/loss',transform=ax.transAxes)
   fig.suptitle('%s %s margin%s window%s — UNKNOWN'%(engine,case['id'],cfg['margin'],cfg['window']))
   fig.text(.01,.01,'Cyan=old anchor; gray=profile; green=unique center; red=unresolved. Y scales vary. Pillow source illustration; numeric probes use browser RGBA. No rendered effect.',fontsize=8)
   fig.tight_layout(rect=(0,.04,1,.94))
   fig.savefig(output/('%s-%s-m%s-w%s.png'%(engine,case['id'],cfg['margin'],cfg['window'])),dpi=120)
   plt.close(fig)
print('36 figures saved; every margin/window/missing axis retained.')
