"""Static diagnostic plots. Optional isolated matplotlib; never used by app."""
import os
import sys
import json
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo / '.snapshots' / 'plot-libs'))
os.environ.setdefault('MPLCONFIGDIR', str(repo / '.snapshots' / 'mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

source, output = map(Path, sys.argv[1:3])
if output.exists():
    raise RuntimeError('Supply NEW plot directory')
output.mkdir(parents=True)
modes = ['analysis', 'native-scale-matched', 'native-fine']
directions = ['stored-render-tangent', 'annotated-local-shaft-axis']
colors = ['#0077b6', '#c45c00']
records = []
for engine in ['chromium', 'webkit']:
    data = json.loads((source / (engine + '.json')).read_text(encoding='utf-8'))
    for case in data['results']:
        budget = next(b for b in case['budgets'] if b['cap'] == 224)
        fig, axes = plt.subplots(2, 3, figsize=(14, 7), sharex=True)
        for row, direction in enumerate(directions):
            for col, mode in enumerate(modes):
                cfg = next(c for c in budget['configurations'] if c['direction'] == direction and c['mode'] == mode)
                ax = axes[row, col]
                curve = cfg['curves']
                ax.plot([p['distanceNative'] for p in curve], [p['response'] for p in curve], color=colors[row], label='response')
                ax.plot([p['distanceNative'] for p in curve], [p['transverseContrast'] for p in curve], color='#777777', linestyle=':', label='unclipped valley')
                ax.axhline(.006, color='#a32c31', linestyle='--', linewidth=.8, label='inherited floor (diagnostic)')
                ax.axvline(0, color='#333333', linewidth=.8)
                ax.axvspan(cfg['stepNative'], 2 * cfg['stepNative'], color='#aaaaaa', alpha=.15)
                ax.scatter([p['distanceNative'] for p in cfg['profile']], [p['response'] for p in cfg['profile']], s=14, color=colors[row])
                ax.set_title(mode + '\n' + cfg['interpretation'], fontsize=9)
                ax.grid(alpha=.2)
                if col == 0:
                    ax.set_ylabel(direction + '\naxis %.1f degrees' % cfg['axisDegrees'], fontsize=9)
                if row == 1:
                    ax.set_xlabel('distance along ray (native source pixels)')
        axes[0, 0].legend(fontsize=7, loc='upper left')
        fig.suptitle(engine + ' / ' + case['id'] + ' / SAME old physical anchor / cap224', fontsize=12)
        fig.text(.5, .015, 'Dots: original test offsets; shaded: offsets1..2 in analysis units. Native-fine uses source-pixel kernels; floor is NOT calibrated across spaces.\nAnnotation axis is diagnostic, not an adopted correction or exact derivative. Operator pass does not verify a physical tip.', ha='center', fontsize=8)
        fig.tight_layout(rect=(0, .06, 1, .94))
        stem = engine + '-' + case['id']
        for ext in ['png', 'svg']:
            fig.savefig(output / (stem + '-profiles.' + ext), dpi=140)
        plt.close(fig)

        fig, axes = plt.subplots(2, 3, figsize=(10, 6))
        codes = {'weak-fitted-tip-direction': 0, 'continuing-transverse-ridge': 1, 'passes-existing-endpoint-check': 2}
        for row, direction in enumerate(directions):
            for col, mode in enumerate(modes):
                cfg = next(c for c in budget['configurations'] if c['direction'] == direction and c['mode'] == mode)
                ax = axes[row, col]
                values = [[codes[next(p for p in cfg['phases'] if p['alongAnalysis'] == along and p['acrossAnalysis'] == across)['interpretation']] for across in [-.5, 0, .5]] for along in [-.5, 0, .5]]
                ax.imshow(values, vmin=0, vmax=2, cmap=ListedColormap(['#b0b0b0', '#ffbd69', '#80b9d6']), origin='lower')
                for y in range(3):
                    for x in range(3):
                        ax.text(x, y, ['weak', 'continues', 'op. pass'][values[y][x]], ha='center', va='center', fontsize=8)
                ax.set_xticks([0, 1, 2], ['-.5', '0', '+.5'])
                ax.set_yticks([0, 1, 2], ['-.5', '0', '+.5'])
                ax.set_title(mode, fontsize=10)
                if row == 1:
                    ax.set_xlabel('across offset (analysis px)')
                if col == 0:
                    ax.set_ylabel(direction + '\nalong offset (analysis px)', fontsize=9)
        fig.suptitle(engine + ' / ' + case['id'] + ' / anchor-offset sensitivity, cap224', fontsize=11)
        fig.text(.5, .012, 'These probes MOVE the physical measurement anchor. This is NOT a pure resampling-grid-phase experiment.\nNo favorable offset is selected; operator pass is not quality approval.', ha='center', fontsize=8)
        fig.tight_layout(rect=(0, .06, 1, .94))
        for ext in ['png', 'svg']:
            fig.savefig(output / (stem + '-anchor-offsets.' + ext), dpi=140)
        plt.close(fig)
        records.append({'engine': engine, 'id': case['id']})
(output / 'plots.json').write_text(json.dumps({'matplotlib': matplotlib.__version__, 'records': records}, indent=2), encoding='utf-8')
print('Rendered', len(records) * 4, 'diagnostic plot files; app unchanged.')
