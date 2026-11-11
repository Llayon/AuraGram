"""Frozen curve-following diagnostics, including every stopped/missing path."""
import os,sys,json
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(repo/'.snapshots/plot-libs'))
os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

inputs,centers,output=map(Path,sys.argv[1:4]);output.mkdir(parents=True,exist_ok=False)
for engine in ['chromium','webkit']:
 data=json.loads((inputs/(engine+'.json')).read_text())
 previous=json.loads((centers/('centers-'+engine+'.json')).read_text())
 for case in data['results']:
  crop=next(c for c in previous['results'] if c['id']==case['id'])['crop'];x,y=case['source']['x'],case['source']['y']
  left,top=int(x)-16,int(y)-16;patch=Image.open(repo/'tests/visual/positive-evidence/sources'/case['file']).crop((left,top,left+32,top+32))
  for cfg in case['configurations']:
   fig,axes=plt.subplots(1,3,figsize=(13,4.5));c=cfg['curve']
   axes[0].imshow(patch,extent=(left-.5,left+31.5,top+31.5,top-.5),interpolation='nearest');axes[0].plot(x-.5,y-.5,'cx',label='old anchor')
   if c['points']:
    points=c['points'];axes[0].plot([p['x']+crop['x'] for p in points],[p['y']+crop['y'] for p in points],'g.-',label='accepted sampled prefix')
    axes[0].plot(points[0]['x']+crop['x'],points[0]['y']+crop['y'],'wo',markersize=4,label='measured seed')
    axes[1].plot([p['arc'] for p in points],[p['x']-points[0]['x'] for p in points],'o-',label='dx')
    axes[1].plot([p['arc'] for p in points],[p['y']-points[0]['y'] for p in points],'o-',label='dy');axes[1].set_xlabel('accepted arc from body seed (native px)');axes[1].set_ylabel('displacement (native px)');axes[1].legend()
   if c['attempts']:
    last=c['attempts'][-1];r=last['reference'];axes[0].plot(r['x']+crop['x'],r['y']+crop['y'],'rx',label='rejected prediction')
    if last.get('center'):
     p=last['center'];axes[0].plot(p['x']+crop['x'],p['y']+crop['y'],'o',color='orange',markersize=4,label='rejected proposed center')
    profile=last['profile'];axes[2].plot([p['offset'] for p in profile],[p['deficit'] for p in profile]);axes[2].axvspan(-.5,.5,color='gray',alpha=.15);axes[2].axhline(.006,color='red',linestyle='--');axes[2].set_xlabel('last transverse offset (native px)');axes[2].set_ylabel('background deficit; not probability')
   else:
    for ax in axes[1:]:ax.text(.05,.5,'UNKNOWN: seed/axis not eligible',transform=ax.transAxes)
   axes[0].legend(fontsize=7);axes[0].set_title('Source pixels + diagnostic prefix')
   fig.suptitle('%s %s margin%s window%s\nSTOP %s; accepted arc %.3fpx; UNKNOWN'%(engine,case['id'],cfg['margin'],cfg['window'],c['reason'],c['points'][-1]['arc'] if c['points'] else 0),fontsize=10)
   fig.text(.01,.01,'No endpoint approval or rendered lash. Orange/red attempted point is NOT accepted. Axes vary; seed is before old anchor. Pillow illustration; measurements use browser RGBA.',fontsize=8)
   fig.tight_layout(rect=(0,.04,1,.9));fig.savefig(output/('%s-%s-m%s-w%s.png'%(engine,case['id'],cfg['margin'],cfg['window'])),dpi=120);plt.close(fig)
print('36 stopped/missing-path figures saved.')
