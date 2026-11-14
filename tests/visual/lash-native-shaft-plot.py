"""Offline source-measurement figures, not an app dependency."""
import os, sys, json
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(repo/'.snapshots'/'plot-libs'))
os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots'/'mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source, dense, output=map(Path,sys.argv[1:4])
if output.exists(): raise RuntimeError('Supply NEW plot directory')
output.mkdir(parents=True)
count=0
for engine in ['chromium','webkit']:
    data=json.loads((source/(engine+'.json')).read_text(encoding='utf-8'))
    extra=json.loads((dense/(engine+'.json')).read_text(encoding='utf-8'))
    for case in data['results']:
        for cfg in case['analysis']['configurations']:
            fig,axes=plt.subplots(2,3,figsize=(13,7))
            for ax,row in zip(axes.flat,cfg['rows']):
                profile=row['profile']
                if profile:
                    ax.plot([p['offset'] for p in profile],[p['deficit'] for p in profile],color='#0077b6')
                    ax.axvspan(-row['searchHalf'],row['searchHalf'],alpha=.1,color='#555555')
                    ax.axhline(.006,color='#a32c31',linestyle='--',linewidth=.7)
                    ax.axvline(row['proposedShift'],color='#008844' if row['accepted'] else '#cc3333',linewidth=1)
                ax.set_title('arc %spx: %s'%(row['distance'],row['reason']),fontsize=10)
                ax.set_xlabel('normal displacement (native px)')
                ax.set_ylabel('background-subtracted deficit')
                ax.grid(alpha=.2)
            fig.suptitle('%s / %s / margin%s / NO manual axis in estimator'%(engine,case['id'],cfg['margin']),fontsize=12)
            fig.text(.5,.01,'Shading: search domain INSIDE mapped sampling cell, not a confidence interval. Boundary/multiple/weak samples remain unresolved.\nAll margins/windows retained; sparse center observations do not establish connected native same-fiber ownership.',ha='center',fontsize=8)
            fig.tight_layout(rect=(0,.06,1,.94))
            stem=engine+'-'+case['id']+'-margin'+str(cfg['margin'])+'-profiles'
            for ext in ['png','svg']: fig.savefig(output/(stem+'.'+ext),dpi=140)
            plt.close(fig);count+=2
        details=next(r for r in extra['results'] if r['id']==case['id'])
        fig,axes=plt.subplots(2,3,figsize=(13,7))
        for col,window in enumerate([6,8,12]):
            for margin,color in [(1.5,'#0077b6'),(2.5,'#c45c00')]:
                r=next(r for r in details['configurations'] if r['window']==window and r['margin']==margin)
                if not r['axis']['available']:
                    axes[0,col].text(.05,.85-(.2 if margin==2.5 else 0),'margin%s: no complete axis'%margin,transform=axes[0,col].transAxes,fontsize=9)
                    continue
                f=r['forward']
                axes[0,col].plot([p['distanceNative'] for p in f['curve']],[p['response'] for p in f['curve']],color=color,label='margin%s: %s'%(margin,f['interpretation']))
                samples=r['continuity']['samples']
                axes[1,col].plot(range(len(samples)),[p['response'] for p in samples],color=color,label='margin%s: all=%s'%(margin,r['continuity']['allSamplesSupported']))
            axes[0,col].set_title('window%s: every available automatic axis'%window,fontsize=9)
            axes[0,col].set_xlabel('forward from FIXED old anchor (native px)')
            axes[1,col].set_xlabel('ordered dense segment sample index')
            for ax in axes[:,col]:
                ax.axhline(.006,color='#a32c31',linestyle='--',linewidth=.7);ax.grid(alpha=.2)
                if ax.get_legend_handles_labels()[0]:ax.legend(fontsize=7)
        axes[0,0].set_ylabel('forward transverse response')
        axes[1,0].set_ylabel('between-center transverse response')
        fig.suptitle('%s / %s / dense support and forward evidence'%(engine,case['id']),fontsize=12)
        fig.text(.5,.01,'Every axis/margin reported; no chosen best window, no recentering, no new seed or extension. Operator floor is diagnostic, not calibrated.\nDense samples <=.5nativepx do not certify biological ownership or a native 8-connected skeleton. Unknowns are not bridged.',ha='center',fontsize=8)
        fig.tight_layout(rect=(0,.06,1,.94))
        for ext in ['png','svg']:fig.savefig(output/(engine+'-'+case['id']+'-dense-forward.'+ext),dpi=140)
        plt.close(fig);count+=2
(output/'plots.json').write_text(json.dumps({'matplotlib':matplotlib.__version__,'files':count},indent=2),encoding='utf-8')
print('Rendered',count,'diagnostic plot files.')
