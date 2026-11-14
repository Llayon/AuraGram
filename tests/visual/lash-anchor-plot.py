"""Fixed source-pixel diagnostic figures; no image editing or product effect."""
import os, sys, json
from pathlib import Path
repo = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo / '.snapshots' / 'plot-libs'))
os.environ.setdefault('MPLCONFIGDIR', str(repo / '.snapshots' / 'mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

inputs, centers, output = map(Path, sys.argv[1:4])
output.mkdir(parents=True, exist_ok=False)
for engine in ['chromium', 'webkit']:
    data = json.loads((inputs / (engine + '.json')).read_text())
    previous = json.loads((centers / (engine + '.json')).read_text())
    for case in data['results']:
        old = next(c for c in previous['results'] if c['id'] == case['id'])
        image = Image.open(repo / 'tests/visual/positive-evidence/sources' / case['file'])
        x, y = case['source']['x'], case['source']['y']
        left, top = int(x) - 24, int(y) - 24
        patch = image.crop((left, top, left + 48, top + 48))
        for cfg in case['configurations']:
            fig, axes = plt.subplots(1, 3, figsize=(13, 4.5))
            p, axis = cfg['probe'], cfg['axis']
            axes[0].imshow(patch, extent=(left-.5, left+47.5, top+47.5, top-.5), interpolation='nearest')
            # Native luma center i corresponds to decoded source coordinate crop+i+.5.
            axes[0].plot(x-.5, y-.5, 'cx', label='old anchor')
            axes[0].set_title('Source pixels; diagnostic overlay')
            if p['available']:
                crop = old['crop']
                for key, marker in [('association', 'o'), ('forward', '.')]:
                    samples = p[key]
                    for supported, color in [(True, '#00db87'), (False, '#ed4040')]:
                        subset = [s for s in samples if s['supported'] == supported]
                        axes[0].scatter([s['point']['x']+crop['x'] for s in subset], [s['point']['y']+crop['y'] for s in subset], c=color, marker=marker, s=12)
                for ax, key in zip(axes[1:], ['association', 'forward']):
                    samples = p[key]
                    ax.plot([s['distanceNative'] for s in samples], [s.get('response', float('nan')) for s in samples], 'o-', markersize=3)
                    ax.axhline(data['protocol']['observationFloor'], color='red', linestyle='--', label='inherited floor .006')
                    ax.set_xlabel('native distance (px)'); ax.set_ylabel('bilateral response'); ax.set_title(key)
                    ax.legend(fontsize=8)
                result = '%s; body=%s; association=%s; first loss=%s' % (p['outcome'], p['bodySupported'], p['associationSupported'], p['firstUnsupportedNative'])
            else:
                result = 'UNKNOWN: no complete measured axis'
                for ax in axes[1:]: ax.text(.1, .5, result, transform=ax.transAxes, wrap=True)
            fig.suptitle('%s %s margin%s window%s\n%s' % (engine, case['id'], cfg['margin'], cfg['window'], result), fontsize=10)
            fig.text(.01, .01, 'Cyan=old anchor; green=supported sample; red=unsupported. No refit, tip movement or rendered lash. Loss/reentry is not an endpoint.', fontsize=8)
            fig.tight_layout(rect=(0, .04, 1, .9))
            fig.savefig(output / ('%s-%s-m%s-w%s.png' % (engine, case['id'], cfg['margin'], cfg['window'])), dpi=120)
            plt.close(fig)
print('Saved every configuration in both decoders (36 figures).')
