"""Known analytic centerlines versus observed QA paths; no portrait evidence."""
import os,sys,json
from pathlib import Path
repo=Path(__file__).resolve().parents[2];sys.path.insert(0,str(repo/'.snapshots/plot-libs'));os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
data=json.loads(Path(sys.argv[1]).read_text());target=Path(sys.argv[2])
if target.exists():raise RuntimeError('Supply NEW image path')
fig,axes=plt.subplots(3,5,figsize=(15,12))
for ax,row in zip(axes.flat,data['results']):
 y=[34-i*.1 for i in range(141)];x=[40+row['k']*(34-v)**2 for v in y];ax.plot(x,y,color='#3377dd',label='known analytic center')
 p=row['result']['points'];ax.plot([v['x'] for v in p],[v['y'] for v in p],'g.-',label='accepted QA prefix',markersize=3)
 last=row['result']['attempts'][-1] if row['result']['attempts'] else None
 if last and last.get('center') and not last.get('linkAccepted'):ax.plot(last['center']['x'],last['center']['y'],'rx',label='rejected proposal')
 ax.set_xlim(38,47);ax.set_ylim(35,19);ax.grid(alpha=.2);ax.set_aspect('equal');ax.set_title('%s err%s k%s m%s\n%s; arc%.2f; dxerr%.3f'%(row['kind'],row['error'],row['k'],row['margin'],row['result']['reason'],p[-1]['arc'],row['maximumHorizontalTruthError']),fontsize=8);ax.set_xlabel('native x');ax.set_ylabel('native y')
axes.flat[-1].axis('off');axes.flat[-1].text(0,.8,'ANALYTIC CONTROLS ONLY\nBlue: known continuous centerline\nGreen: accepted sampled prefix\nRed: rejected proposed center\nEvery path stays UNKNOWN.\nNeither naturalness nor real\nbranch rejection is established.',transform=axes.flat[-1].transAxes)
fig.suptitle('Frozen curve controller: initialization errors and gentle curvature — unchanged protocol, no tuning')
fig.tight_layout(rect=(0,0,1,.96));fig.savefig(target,dpi=130);plt.close(fig)
