"""Read-only scientific figures; no retouching, interpolation or effect output."""
import os,sys,json,gzip,base64,hashlib,math
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(repo/'.snapshots/plot-libs'))
os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
folder,output=map(Path,sys.argv[1:3]);output.mkdir(parents=True,exist_ok=False)
data=json.loads((folder/'result.json').read_text());pack=repo/'tests/visual/downward-evidence';mapping=json.loads((pack/'files.json').read_text())
def old(ref):
 m=mapping[ref];b=(pack/m['asset']).read_bytes();b=gzip.decompress(b) if m['gzip'] else b
 assert hashlib.sha256(b).hexdigest()==m['sha256'];return b
manifest=[]
for r in data['runs']:
 image=Image.open(repo/r['imagePath']).convert('RGB')
 for side,e in r['eyes'].items():
  raw=(folder/e['sidecar']).read_bytes();assert hashlib.sha256(raw).hexdigest()==e['sidecarSHA256']
  m=json.loads(gzip.decompress(raw));w,h=m['w'],m['h'];decode=lambda k:np.frombuffer(base64.b64decode(m[k]),dtype='u1').reshape(h,w)
  active,roots,original,expanded=[decode(k)for k in ['active','roots','originalReach','expandedReach']]
  luma=np.frombuffer(old(m['lumaRef']),dtype='<f4').reshape(h,w)
  roi=r['geometry'][side]['roi'];ox,oy=roi['x0']*r['W'],roi['y0']*r['H'];sx,sy=(roi['x1']-roi['x0'])*r['W']/w,(roi['y1']-roi['y0'])*r['H']/h
  native=lambda ids:([ox+(i%w)*sx for i in ids],[oy+(i//w)*sy for i in ids])
  items=[('automatic',e['examples'][0] if e['examples'] else None)]+[(q['id'],q)for q in r['references']if q['side']==side]
  for label,q in items:
   spectrum=(q or {}).get('spectrum');route=(q or {}).get('expandedRoute') or {};center=spectrum['j'] if spectrum else ((q or {}).get('nearestActive') or {}).get('index',w*h//2);cx,cy=center%w,center//w
   fig,axes=plt.subplots(1,5,figsize=(20,5.4))
   box=(math.floor(ox),math.floor(oy),math.ceil(roi['x1']*r['W']),math.ceil(roi['y1']*r['H']))
   axes[0].imshow(image.crop(box),extent=(box[0]-.5,box[2]-.5,box[3]-.5,box[1]-.5),interpolation='nearest')
   overview=e['examples'] if label=='automatic' else ([q] if q else [])
   colors=['cyan','#ff66cc','#88dd00']
   for example,color in zip(overview,colors):
    pixels=(example.get('expandedRoute') or {}).get('pixels',[])
    if pixels:axes[0].plot(*native(pixels),color=color,linewidth=.7)
   axes[0].set_title('Source / first3 probes' if label=='automatic' else 'Source / reference probe')
   for ax in axes[1:3]:ax.imshow(luma,cmap='gray',vmin=0,vmax=1,interpolation='nearest')
   for mask,color,size in [(active,'#aaaaaa',2),(expanded,'#ff9900',3),(original,'#00bb66',3),(roots,'#0088ff',5)]:
    yy,xx=np.nonzero(mask);axes[1].scatter(xx,yy,s=size,c=color)
   for example,color in zip(overview,colors):
    pixels=(example.get('expandedRoute') or {}).get('pixels',[])
    if pixels:axes[1].plot([i%w for i in pixels],[i//w for i in pixels],color=color,linewidth=.6)
   axes[1].set_title(f"Reach {e['originalReach']} -> {e['expandedReach']}")
   axes[2].set_xlim(max(-.5,cx-6),min(w-.5,cx+6));axes[2].set_ylim(min(h-.5,cy+6),max(-.5,cy-6));axes[2].set_title('First local witness / mode IDs')
   crossing=e['productCrossing']
   info=['EYE TOTALS',f"original qualified: {e['unchangedOriginalQualified']}",f"rooted frontier edges: {e['summary']['rootedFourPoint']}",f"ambiguous middle edges: {e['summary']['ambiguousMiddleModePairs']}",f"product occluded: {crossing.get('occluded')}",f"product Length abstain: {crossing.get('lengthAbstain')}",f"crossing paths: {len(crossing.get('paths',[]))}",'','SELECTED PAIR (auto0 / reference)',route.get('status','No route probe').replace('_',' ')]
   if label=='automatic':
    info+=['','ALL RETAINED AUTO PROBES']+[example['id']+': '+example['expandedRoute']['status'].replace('DIAGNOSTIC_ROOT_STATE_ROUTE','root state route').replace('NO_EXPANDED_ROOT_STATE_ROUTE','unreachable').replace('CENSORED_STATE_ROUTE','censored') for example in overview]
   if spectrum:
    pairs=spectrum['pairs'];witness=next((p['firstRootedWitness'] for p in pairs if p['firstRootedWitness']),None) or next((p['firstWitness']for p in pairs if p['firstWitness']),None)
    if witness:
     ids=[s//8 for s in witness];axes[2].plot([i%w for i in ids],[i//w for i in ids],'-o',color='cyan',markersize=3)
     for state,i in zip(witness,ids):axes[2].annotate(str(state%8),(i%w,i//w),color='orange',fontsize=9)
    else:axes[2].text(.03,.93,'No four-point witness',transform=axes[2].transAxes,color='orange')
    for offset,key,color in [(-.18,'source','#ff4444'),(.18,'target','#4488ff')]:
     p=spectrum[key];vals=[np.nan if v is None else v for v in p['responses']];bars=axes[3].bar(np.arange(8)+offset,vals,width=.34,color=color,alpha=.7,label=key)
     for k,b in enumerate(bars):
      if p['eligibleMask']&(1<<k):b.set_edgecolor('black');b.set_linewidth(1.5)
     axes[3].plot(p['bestIndex']+offset,vals[p['bestIndex']],'k*',markersize=9)
    axes[3].axhline(.006,color='gray',linestyle='--');axes[3].set_xticks(range(8));axes[3].legend(fontsize=7);axes[3].set_title('8 unoriented axes / raw response')
    info += [f"middle mode pairs: {spectrum['pairCount']}",f"local four-point pairs: {spectrum['localFourPointPairs']}",f"rooted four-point pairs: {spectrum['rootedFourPointPairs']}"]
   else:axes[3].text(.05,.5,'No selected frontier\n(no gap invented)',transform=axes[3].transAxes)
   axes[4].axis('off');axes[4].text(0,1,'\n'.join(info),va='top',fontsize=8,wrap=True)
   fig.suptitle(f"{r['engine']} {r['version']} {r['file']} {side} / {label} / HOLD")
   fig.text(.02,.07,'Green: original reach; orange: expanded reach; blue: roots. Probe routes auto0/1/2: cyan/pink/lime; witness: cyan. NOT biological hairs. Axis IDs, not arrows. Bar outline: eligible; star: winner.',fontsize=8)
   fig.text(.02,.025,'Four observed pixels and root-state reach do not prove strand ownership or a free tip. Source illustration: Pillow; numeric evidence: archived browser Float32 luma. No Length rendered.',fontsize=8)
   fig.tight_layout(rect=(0,.13,1,.94));name=f"{r['engine']}-{r['version']}-{r['file']}-{side}-{label}.png";fig.savefig(output/name,dpi=110);plt.close(fig)
   nx,ny=native([center]);left=max(0,min(r['W']-160,math.floor(nx[0])-80));top=max(0,min(r['H']-160,math.floor(ny[0])-80));cropname=name.replace('.png','-source160.png');image.crop((left,top,left+160,top+160)).save(output/cropname)
   manifest.append({'engine':r['engine'],'version':r['version'],'file':r['file'],'side':side,'case':label,'figure':name,'sourceCrop':cropname,'sourceRect':[left,top,160,160],'figureSHA256':hashlib.sha256((output/name).read_bytes()).hexdigest(),'cropSHA256':hashlib.sha256((output/cropname).read_bytes()).hexdigest()})
 image.close()
(output/'manifest.json').write_text(json.dumps({'inputSHA256':hashlib.sha256((folder/'result.json').read_bytes()).hexdigest(),'plotSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'meaning':'Scientific diagnostic figures; source crops native, view at100/200/400%; no beauty output.','figures':manifest},indent=2)+'\n')
print(len(manifest),'figures and native crops saved')
