"""Read-only scientific graph-break figures; never retouch or effect output."""
import os,sys,json,gzip,base64,hashlib,math
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(repo/'.snapshots/plot-libs'))
os.environ.setdefault('MPLCONFIGDIR',str(repo/'.snapshots/mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import numpy as np
from PIL import Image

folder,output=map(Path,sys.argv[1:3]);output.mkdir(parents=True,exist_ok=False)
data=json.loads((folder/'census.json').read_text());packed=repo/'tests/visual/downward-evidence';mapping=json.loads((packed/'files.json').read_text())
def read_old(ref):
 m=mapping[ref];raw=(packed/m['asset']).read_bytes();raw=gzip.decompress(raw) if m['gzip'] else raw
 assert hashlib.sha256(raw).hexdigest()==m['sha256'];return raw
manifest=[]
for r in data['runs']:
 image=Image.open(repo/r['imagePath']).convert('RGB')
 for side,e in r['eyes'].items():
  saved=gzip.decompress((folder/e['plotFile']).read_bytes());m=json.loads(saved);w,h=m['w'],m['h']
  decode=lambda key,dtype:np.frombuffer(base64.b64decode(m[key]),dtype=dtype).reshape(h,w)
  active=decode('active','u1');strict=decode('strict','u1');roots=decode('roots','u1');dx=decode('dx','<f4');dy=decode('dy','<f4')
  luma=np.frombuffer(read_old(m['lumaRef']),dtype='<f4').reshape(h,w)
  roi=r['geometry'][side]['roi'];sx=(roi['x1']-roi['x0'])*r['W']/w;sy=(roi['y1']-roi['y0'])*r['H']/h;ox=roi['x0']*r['W'];oy=roi['y0']*r['H']
  box=(math.floor(ox),math.floor(oy),math.ceil(roi['x1']*r['W']),math.ceil(roi['y1']*r['H']));patch=image.crop(box)
  native=lambda ids:([(i%w)*sx+ox for i in ids],[(i//w)*sy+oy for i in ids])
  items=[('automatic',None,None)]+[(l['id'],l,None)for l in r['labels']if l['side']==side]
  for label,ref,_ in items:
   route=ref['route'] if ref else (e['examples'][0]['route'] if e['examples'] else None)
   nmsRefId=label if ref else 'auto-0'
   removal=next((q['firstRemoval']for q in r.get('nmsReferenceRoutes',[])if q['side']==side and q['id']==nmsRefId and q['firstRemoval']),None)
   fail=(route or {}).get('firstFrontier');center=(fail or {}).get('j')
   if center is None and removal:center=removal['index']
   if center is None and ref and ref['nearestActive']:center=ref['nearestActive']['index']
   if center is None:center=e['examples'][0]['target'] if e['examples'] else (h//2)*w+w//2
   cx,cy=center%w,center//w
   fig,axes=plt.subplots(1,4,figsize=(17,5.5),gridspec_kw={'width_ratios':[1.5,1.1,1,1.2]})
   axes[0].imshow(patch,extent=(box[0]-.5,box[2]-.5,box[3]-.5,box[1]-.5),interpolation='nearest')
   routes=[q['route']for q in e['examples']] if not ref else ([route]if route else [])
   for path_record in routes:
    ids=path_record.get('path',[])
    if ids:axes[0].plot(*native(ids),color='#00b9ce',linewidth=.8)
   if ref:axes[0].add_patch(plt.Circle((ref['tip']['x'],ref['tip']['y']),ref['uncertainty'],color='white',fill=False,linewidth=.7))
   if fail:axes[0].plot(*native([fail['i'],fail['j']]),color='red',linewidth=2)
   if removal:axes[0].plot(*native([removal['index']]),marker='*',color='magenta',markersize=8)
   axes[0].set_title('Source illustration / native coordinates')
   axes[1].imshow(luma,cmap='gray',vmin=0,vmax=1,interpolation='nearest')
   yy,xx=np.nonzero(active);axes[1].scatter(xx,yy,s=2,c='#aaaaaa',alpha=.6)
   yy,xx=np.nonzero(strict);axes[1].scatter(xx,yy,s=3,c='#00bb66')
   yy,xx=np.nonzero(roots);axes[1].scatter(xx,yy,s=4,c='#0077ff')
   for path_record in routes:
    ids=path_record.get('path',[])
    if ids:axes[1].plot([i%w for i in ids],[i//w for i in ids],color='cyan',linewidth=.7)
   axes[1].set_title('Working pixels / observed routes')
   axes[2].imshow(luma,cmap='gray',vmin=0,vmax=1,interpolation='nearest')
   yy,xx=np.nonzero(active);axes[2].scatter(xx,yy,s=10,c='#aaaaaa')
   yy,xx=np.nonzero(strict);axes[2].scatter(xx,yy,s=12,c='#00bb66')
   if fail:
    for i,color in [(fail['i'],'#ff3333'),(fail['j'],'#0088ff')]:
     x,y=i%w,i//w;axes[2].quiver(x,y,float(dx[y,x]),float(dy[y,x]),color=color,angles='xy',scale_units='xy',scale=.6,width=.014)
    axes[2].plot([fail['i']%w,fail['j']%w],[fail['i']//w,fail['j']//w],color='red',linewidth=2)
   if removal:axes[2].plot(removal['x'],removal['y'],marker='*',color='magenta',markersize=14)
   axes[2].set_xlim(max(-.5,cx-6),min(w-.5,cx+6));axes[2].set_ylim(min(h-.5,cy+6),max(-.5,cy-6));axes[2].set_title('Local gate / measured directions')
   text=['strict/loose/raw-directed pixels',f"{e['strictPixels']} / {e['loosePixels']} / {e['rawDirectedPixels']}",f"pruning reach loss: {e['prunedReachLoss']}"]
   if route:text+=['',route['status']]
   if fail:text+=['','First strict-frontier exit',f"working ({fail['i']%w},{fail['i']//w})",f"  -> ({fail['j']%w},{fail['j']//w})",' + '.join(fail['reasons']),f"direction dot: {fail['agreement']:.6f}",f"align source/target:",f"{fail['sourceAlignment']:.6f}/{fail['targetAlignment']:.6f}",f"depth change: {fail['depthChange']:.6f}"]
   else:text+=['','No route-specific frontier witness.','No missing link is invented.']
   if removal:text+=['','Removed V1 ref '+nmsRefId,f"({removal['x']},{removal['y']}) root={removal['wasRoot']}",f"response {removal['centerResponse']:.6f}",f"NMS +/- {removal['positiveResponse']:.6f}",f"       / {removal['negativeResponse']:.6f}"]
   if removal and (abs(removal['x']-cx)>6 or abs(removal['y']-cy)>6):text+=['NMS star outside local zoom;', 'see wide source / coordinates.']
   axes[3].axis('off');axes[3].text(0,1,'\n'.join(text),va='top',fontsize=8.5,transform=axes[3].transAxes)
   fig.suptitle(f"{r['engine']} {r['version']} {r['file']} {side} / {label} / HOLD",fontsize=11)
   handles=[Line2D([0],[0],color='cyan',label='diagnostic route, NOT a hair'),Line2D([0],[0],color='red',label='selected frontier failure'),Line2D([0],[0],marker='*',color='magenta',label='removed V1 reference-route pixel'),Line2D([0],[0],color='#00bb66',label='strict reach'),Line2D([0],[0],color='#0077ff',label='automatic roots')]
   fig.legend(handles=handles,loc='lower center',bbox_to_anchor=(.5,.08),ncol=5,fontsize=8)
   fig.text(.02,.02,'Read-only observations. Shortest8-neighbor routes can cross different hairs/texture; a failed edge is not a unique physical break. Source illustration uses Pillow; numbers use archived browser Float32 grids.',fontsize=8)
   fig.tight_layout(rect=(0,.19,1,.92));name=f"{r['engine']}-{r['version']}-{r['file']}-{side}-{label}.png";fig.savefig(output/name,dpi=120);plt.close(fig)
   # A separate, unresized source crop supports actual100/200/400% viewing.
   nx,ny=native([center]);left=max(0,min(r['W']-160,math.floor(nx[0])-80));top=max(0,min(r['H']-160,math.floor(ny[0])-80));crop=image.crop((left,top,left+160,top+160));cropName=name.replace('.png','-source160.png');crop.save(output/cropName)
   manifest.append({'engine':r['engine'],'version':r['version'],'file':r['file'],'side':side,'case':label,'figure':name,'sourceCrop':cropName,'sourceRect':[left,top,160,160],'nmsReferenceId':nmsRefId,'nmsShown':bool(removal),'nmsOutsideLocalZoom':bool(removal and (abs(removal['x']-cx)>6 or abs(removal['y']-cy)>6)),'figureSHA256':hashlib.sha256((output/name).read_bytes()).hexdigest(),'cropSHA256':hashlib.sha256((output/cropName).read_bytes()).hexdigest()})
 image.close()
(output/'manifest.json').write_text(json.dumps({'inputSHA256':hashlib.sha256((folder/'census.json').read_bytes()).hexdigest(),'harnessSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'meaning':'Scientific diagnostic figures, no beauty effect; source crops unresized, annotations never detection seeds.','figures':manifest},indent=2)+'\n')
print(len(manifest),'figures and native source crops saved.')
