"""Complete analytic raster matrix, not real-portrait quality evidence."""
import os,sys,json
from pathlib import Path
repo=Path(__file__).resolve().parents[2];sys.path.insert(0,str(repo/'.snapshots/plot-libs'));os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
data=json.loads(Path(sys.argv[1]).read_text());target=Path(sys.argv[2])
if target.exists():raise RuntimeError('Supply NEW image path')
shapes=[('straight',0,0),('straight',25,0),('quadratic',0,.015),('quadratic',0,.03)];columns=[('point',1.5),('point',2.5),('pixel-area-8x8',1.5),('pixel-area-8x8',2.5)]
fig,axes=plt.subplots(4,4,figsize=(15,13))
for i,(kind,error,k) in enumerate(shapes):
 for j,(mode,margin) in enumerate(columns):
  ax=axes[i,j];subset=[r for r in data['results'] if(r['kind'],r['error'],r['k'],r['mode'],r['margin'])==(kind,error,k,mode,margin)]
  grid=[[next(r for r in subset if r['sigma']==s and r['phase']==p) for p in [0,.25,.5,.75]]for s in [.35,.7,1.2]]
  im=ax.imshow([[(r['result']['points'][-1]['arc'] if r['result']['points'] else 0) for r in row]for row in grid],vmin=0,vmax=12,cmap='viridis',aspect='auto')
  for y,row in enumerate(grid):
   for x,r in enumerate(row):
    code={'arc-budget':'A','search-boundary':'B','turn-bound':'T','bootstrap-search-boundary':'I'}[r['result']['reason']];ax.text(x,y,'%.2f %s'%((r['result']['points'][-1]['arc'] if r['result']['points'] else 0),code),ha='center',va='center',fontsize=8,color='white' if (r['result']['points'][-1]['arc'] if r['result']['points'] else 0)<6 else 'black')
  ax.set_xticks(range(4),[0,.25,.5,.75]);ax.set_yticks(range(3),[.35,.7,1.2]);ax.set_xlabel('horizontal pixel phase');ax.set_ylabel('sigma native px');ax.set_title('%s e%s k%s\n%s m%s'%(kind,error,k,mode,margin),fontsize=9)
fig.suptitle('All192 analytic variants вЂ” accepted arc in native px; A=budget B=search boundary T=turn bound I=initialization boundary; all UNKNOWN')
fig.tight_layout(rect=(0,.02,1,.96));fig.text(.01,.005,'Controller/thresholds unchanged. Pixel-area mode averages64midpoint samples; this is an analytic sampling control, not portrait or optical-PSF validation.',fontsize=9);fig.savefig(target,dpi=130);plt.close(fig)
