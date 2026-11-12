"""Native terminal-audit views. Diagnostic path, never an applied lash."""
import os,sys,json
from pathlib import Path
repo=Path(__file__).resolve().parents[2];sys.path.insert(0,str(repo/'.snapshots/plot-libs'));os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
inputs,centers,output=map(Path,sys.argv[1:4]);output.mkdir(parents=True,exist_ok=False)
for engine in ['chromium','webkit']:
 data=json.loads((inputs/(engine+'.json')).read_text());previous=json.loads((centers/('centers-'+engine+'.json')).read_text())
 for case in data['results']:
  crop=next(r for r in previous['results'] if r['id']==case['id'])['crop'];x,y=case['source']['x'],case['source']['y'];left,top=int(x)-48,int(y)-48
  patch=Image.open(repo/'tests/visual/positive-evidence/sources'/case['file']).crop((left,top,left+96,top+96))
  for cfg in case['configurations']:
   c,a,old=cfg['auditCurve'],cfg['audit'],cfg['curve'];fig,axes=plt.subplots(1,3,figsize=(13,4.5))
   axes[0].imshow(patch,extent=(left-.5,left+95.5,top+95.5,top-.5),interpolation='nearest');axes[0].plot(x-.5,y-.5,'cx',label='unchanged old anchor')
   for points,color,label in [(c['points'],'#008844','36px observation audit'),(old['points'],'#e9bc00','unchanged12px record')]:
    if points:axes[0].plot([p['x']+crop['x'] for p in points],[p['y']+crop['y'] for p in points],color=color,label=label,linewidth=1)
   axes[0].legend(fontsize=6,loc='upper center',bbox_to_anchor=(.5,-.10));axes[0].set_title('Native source + observation paths')
   if a['available']:
    profile=a['profile'];axes[1].plot([p['distance'] for p in profile],[p.get('response',float('nan')) for p in profile],'o-');axes[1].axhline(.006,color='red',linestyle='--');axes[1].set_xlabel('distance from audit stop (native px)');axes[1].set_ylabel('bilateral response, not probability');axes[1].set_title('Stop is not an endpoint')
    probes=[(n,p) for n in a['neighborhoods'] for p in n['probes'] if p['secondaryBands']]
    if probes:
     for n,p in probes:axes[2].plot([s['offset'] for s in p['samples']],[s.get('response',float('nan')) for s in p['samples']],label='arc%.1f ahead%s'%(n['arc'],p['ahead']))
     axes[2].legend(fontsize=6)
    else:axes[2].text(.1,.5,'No sampled off-axis run\nDoes not prove one fiber',transform=axes[2].transAxes)
    axes[2].axhline(.006,color='red',linestyle='--');axes[2].set_xlabel('transverse offset (native px)');axes[2].set_ylabel('bilateral response');axes[2].set_title('Boundary-touching runs are censored')
   else:
    for ax in axes[1:]:ax.text(.1,.5,'UNKNOWN: no observed path',transform=ax.transAxes)
   fig.suptitle('%s %s m%s w%s | audit stop %s arc%.3f | UNKNOWN'%(engine,case['id'],cfg['margin'],cfg['window'],c['reason'],c['points'][-1]['arc'] if c['points'] else 0),fontsize=10)
   fig.text(.01,.01,'Yellow12px unchanged; green36px audit is NOT product Length. No endpoint or same-fiber approval. Y scales vary. Pillow illustration; numeric probes use browser RGBA.',fontsize=8)
   fig.tight_layout(rect=(0,.20,1,.92));fig.savefig(output/('%s-%s-m%s-w%s.png'%(engine,case['id'],cfg['margin'],cfg['window'])),dpi=120);plt.close(fig)
print('36 terminal-audit figures saved.')
