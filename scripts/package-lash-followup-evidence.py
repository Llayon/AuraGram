"""Package only the explicitly listed public-source follow-up evidence.
Original JPEGs, root user files and image crops are never included.
"""
import hashlib
import json
import zipfile
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/visual/out'
DEST = ROOT / 'tests/visual/spatial-ending-evidence'
ENTRIES = [
    'spatial-cohort-qualification-20261115-01.json',
    'spatial-supplement-04', 'spatial-supplement-04-network',
    'spatial-supplement-04-chromium', 'spatial-supplement-04-webkit',
    'spatial-label-review-11383300-frozen', 'mask-scope-11383300-01',
    'native-real-11383300-01', 'native-real-11383300-repeat-01',
    'local-ending-11383300-01', '11383300-posthoc-summary-01.json',
    'native-real-11383300-bootstrap-01',
    'bootstrap-diagnosis-11383300-01', 'bootstrap-diagnosis-11383300-02',
    'bootstrap-diagnosis-11383300-summary-01.json',
    'bootstrap-diagnosis-11383300-dense-01',
    'bootstrap-dense-summary-11383300-01.json',
]
SNAPSHOTS = [
    'scripts/package-lash-followup-evidence.py',
    'tests/visual/lash-native-real.cjs',
    'tests/visual/lash-bootstrap-diagnosis.cjs',
    'tests/visual/lash-spatial-qualify.cjs',
    'tests/visual/lash-spatial-cohort-gate.cjs',
    'tests/visual/lash-spatial-cohort-gate.test.mjs',
    'tests/visual/lash-native-cell.test.mjs',
    'tests/visual/lash-spatial-supplement-04.json',
    'tests/visual/lash-spatial-supplement-04-summary.json',
    'tests/visual/lash-spatial-case-11383300.json',
    'tests/visual/lash-spatial-labels-11383300.json',
    'tests/visual/lash-spatial-labels-11383300.freeze.json',
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    if sys.argv[1:] not in ([], ['--controls05'], ['--resolved-edges'], ['--observability'], ['--label-coverage'], ['--cell-boundary']):
        raise RuntimeError('Usage: package-lash-followup-evidence.py [--controls05|--resolved-edges|--observability|--label-coverage|--cell-boundary]')
    controls = sys.argv[1:] == ['--controls05']
    resolved = sys.argv[1:] == ['--resolved-edges']
    observability = sys.argv[1:] == ['--observability']
    coverage = sys.argv[1:] == ['--label-coverage']
    boundary = sys.argv[1:] == ['--cell-boundary']
    date = '2026-11-18' if boundary else '2026-11-17' if resolved or observability or coverage else '2026-11-16' if controls else '2026-11-15'
    stem = 'followup-' + date.replace('-', '') + ('-03' if coverage else '-02' if observability else '-01')
    entries = ENTRIES
    selected_snapshots = SNAPSHOTS
    dependencies = ['native-real-11383300-bootstrap-01',
                    'bootstrap-diagnosis-11383300-dense-01']
    if controls:
        entries = ['spatial-supplement-05', 'spatial-supplement-05-chromium',
                   'spatial-supplement-05-webkit', 'closure-control-14818485-01',
                   'native-real-11383300-control-runner-01']
        for identifier in ['29117992', '14818485']:
            entries += ['spatial-control-review-' + identifier,
                        'native-control-' + identifier + '-01',
                        'native-control-' + identifier + '-repeat-01',
                        'ending-control-' + identifier + '-01']
        entries.append('ending-control-14818485-02')
        selected_snapshots = ['scripts/package-lash-followup-evidence.py',
                              'tests/visual/lash-native-real.cjs',
                              'tests/visual/lash-local-ending-run.cjs',
                              'tests/visual/lash-local-ending-views.cjs',
                              'tests/visual/lash-spatial-supplement-05.json',
                              'tests/visual/lash-spatial-supplement-05-summary.json',
                              'tests/visual/lash-spatial-controls-05.freeze.json',
                              'tests/visual/lash-spatial-controls-05-results.json']
        for identifier in ['29117992', '14818485']:
            selected_snapshots += ['tests/visual/lash-spatial-case-' + identifier + '.json',
                                   'tests/visual/lash-spatial-control-' + identifier + '.json']
        dependencies = ['native-control-29117992-01', 'native-control-14818485-01']
    if resolved:
        entries = ['resolved-edges-browser-01', 'native-real-10598787-01',
                   'resolved-ending-10598787-01', 'legacy-ending-10598787-01',
                   'resolved-edges-native-summary-01.json',
                   'resolved-edges-development-replay-01.json',
                   'resolved-edges-development-replay-02.json',
                   'resolved-edges-unit-sequential-01.txt',
                   'resolved-edges-unit-sequential-02.txt']
        selected_snapshots = ['scripts/package-lash-followup-evidence.py', 'package.json',
                              'tests/visual/lash-local-ending-run.cjs',
                              'tests/visual/lash-native-real.cjs',
                              'tests/visual/lash-spatial-case-10598787.json',
                              'tests/visual/lash-spatial-source-review-10598787.json',
                              'tests/visual/lash-spatial-source-review-10598787.freeze.json']
        selected_snapshots += ['tests/visual/lash-resolved-edges' + suffix for suffix in
                               ['.mjs', '.test.mjs', '-protocol.json', '-replay.cjs', '-browser.cjs']]
        dependencies = ['native-real-10598787-01', 'resolved-ending-10598787-01',
                        'resolved-edges-browser-01']
    if observability:
        entries = ['resolved-observability-01', 'resolved-observability-browser-01',
                   'resolved-observability-browser-02', 'resolved-observability-unit-sequential-01.txt']
        selected_snapshots = ['scripts/package-lash-followup-evidence.py', 'package.json',
                              'tests/visual/lash-resolved-edges.mjs',
                              'tests/visual/lash-resolved-edges-browser.cjs',
                              'tests/visual/lash-resolved-edges-protocol.json']
        selected_snapshots += ['tests/visual/lash-resolved-observability' + suffix for suffix in
                               ['.mjs', '.cjs', '.test.mjs', '-protocol.json']]
        dependencies = ['resolved-observability-01', 'resolved-observability-browser-02']
    if coverage:
        entries = ['resolved-edges-14297936-replay-01.json',
                   'resolved-coverage-14297936-01.json', 'resolved-coverage-14297936-02.json',
                   'resolved-coverage-unit-sequential-01.txt']
        selected_snapshots = ['scripts/package-lash-followup-evidence.py', 'package.json',
                              'tests/visual/lash-label-coverage.mjs',
                              'tests/visual/lash-label-window.mjs',
                              'tests/visual/lash-label-window.test.mjs',
                              'tests/visual/lash-spatial-match.mjs',
                              'tests/visual/lash-resolved-edges.mjs',
                              'tests/visual/lash-resolved-edges-replay.cjs',
                              'tests/visual/lash-spatial-original-labels-01.json',
                              'tests/visual/lash-spatial-original-labels-01.freeze.json',
                              'tests/visual/spatial-ending-evidence/manifest.json']
        dependencies = []  # Historical measurements are verified against their archived hashes by the coverage tool.
    if boundary:
        entries = ['native-boundary-baseline-14297936-01', 'native-boundary-baseline-14297936-02',
                   'native-boundary-baseline-14297936-03', 'native-boundary-default-14297936-01',
                   'native-boundary-exact-14297936-01', 'native-boundary-exact-14297936-repeat-01',
                   'native-boundary-comparison-01.json', 'native-boundary-comparison-02.json',
                   'native-boundary-ending-14297936-01', 'native-boundary-ending-14297936-02',
                   'native-boundary-ending-webkit-01', 'native-boundary-ending-summary-01.json',
                   'cell-boundary-unit-sequential-01.txt']
        selected_snapshots = ['scripts/package-lash-followup-evidence.py',
                              'tests/visual/lash-cell-boundary-protocol.json',
                              'tests/visual/lash-cell-boundary-compare.mjs',
                              'tests/visual/lash-native-cell.test.mjs',
                              'tests/visual/lash-native-real.cjs',
                              'tests/visual/lash-local-ending-run.cjs']
        dependencies = ['native-boundary-baseline-14297936-03',
                        'native-boundary-default-14297936-01',
                        'native-boundary-exact-14297936-01',
                        'native-boundary-ending-webkit-01']
    target = DEST / (stem + '.zip')
    manifest = DEST / (stem + '.json')
    if target.exists() or manifest.exists():
        raise RuntimeError('Refusing to overwrite existing evidence')
    files, omitted = {}, []
    for name in entries:
        entry = OUT / name
        if not entry.exists():
            raise RuntimeError('Missing evidence: ' + name)
        for file in sorted(entry.rglob('*')) if entry.is_dir() else [entry]:
            if not file.is_file():
                continue
            data = file.read_bytes()
            if file.suffix == '.json' or ((resolved or observability or coverage or boundary) and file.suffix == '.txt') or (boundary and 'verified-source' in file.parts and file.suffix in {'.mjs', '.cjs', '.js'}):
                files[file.relative_to(OUT).as_posix()] = data
            else:
                omitted.append({'path': file.relative_to(OUT).as_posix(),
                                'bytes': len(data), 'sha256': sha(data)})
    snapshots = set(selected_snapshots)
    for directory in dependencies:
        protocol = json.loads((OUT / directory / 'protocol.json').read_bytes())
        for name, digest in protocol['moduleSHA256'].items():
            archived_source = OUT / directory / 'verified-source' / name
            check_source = archived_source if boundary and archived_source.exists() else ROOT / name
            if sha(check_source.read_bytes()) != digest:
                raise RuntimeError('Changed algorithm dependency: ' + name)
            snapshots.add(name)
    for name in sorted(snapshots):
        files['source-snapshots/' + name] = (ROOT / name).read_bytes()
    rows = []
    with zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, int(date[-2:]), 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
            rows.append({'path': name, 'bytes': len(data), 'sha256': sha(data)})
    with zipfile.ZipFile(target) as archive:
        for row in rows:
            if sha(archive.read(row['path'])) != row['sha256']:
                raise RuntimeError('Archive member mismatch: ' + row['path'])
    result = {'date': date, 'restoreDirectory': 'tests/visual/out',
              'policy': 'Explicit public-source numeric evidence only; JPEGs and PNGs omitted. Source snapshots are for review, not automatic overwrite.',
              'archive': target.name, 'bytes': target.stat().st_size,
              'sha256': sha(target.read_bytes()), 'members': rows, 'omitted': omitted}
    manifest.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'archive': target.name, 'bytes': result['bytes'],
                      'verifiedMembers': len(rows), 'omitted': len(omitted)}))


if __name__ == '__main__':
    main()
