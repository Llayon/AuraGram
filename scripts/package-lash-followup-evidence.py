"""Package only the explicitly listed public-source follow-up evidence.
Original JPEGs, root user files and image crops are never included.
"""
import hashlib
import json
import zipfile
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
    target = DEST / 'followup-20261115-01.zip'
    manifest = DEST / 'followup-20261115-01.json'
    if target.exists() or manifest.exists():
        raise RuntimeError('Refusing to overwrite existing evidence')
    files, omitted = {}, []
    for name in ENTRIES:
        entry = OUT / name
        if not entry.exists():
            raise RuntimeError('Missing evidence: ' + name)
        for file in sorted(entry.rglob('*')) if entry.is_dir() else [entry]:
            if not file.is_file():
                continue
            data = file.read_bytes()
            if file.suffix == '.json':
                files[file.relative_to(OUT).as_posix()] = data
            else:
                omitted.append({'path': file.relative_to(OUT).as_posix(),
                                'bytes': len(data), 'sha256': sha(data)})
    snapshots = set(SNAPSHOTS)
    for directory in ['native-real-11383300-bootstrap-01',
                      'bootstrap-diagnosis-11383300-dense-01']:
        protocol = json.loads((OUT / directory / 'protocol.json').read_bytes())
        for name, digest in protocol['moduleSHA256'].items():
            if sha((ROOT / name).read_bytes()) != digest:
                raise RuntimeError('Changed algorithm dependency: ' + name)
            snapshots.add(name)
    for name in sorted(snapshots):
        files['source-snapshots/' + name] = (ROOT / name).read_bytes()
    rows = []
    with zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
            rows.append({'path': name, 'bytes': len(data), 'sha256': sha(data)})
    with zipfile.ZipFile(target) as archive:
        for row in rows:
            if sha(archive.read(row['path'])) != row['sha256']:
                raise RuntimeError('Archive member mismatch: ' + row['path'])
    result = {'date': '2026-11-15', 'restoreDirectory': 'tests/visual/out',
              'policy': 'Explicit public-source numeric evidence only; JPEGs and PNGs omitted. Source snapshots are for review, not automatic overwrite.',
              'archive': target.name, 'bytes': target.stat().st_size,
              'sha256': sha(target.read_bytes()), 'members': rows, 'omitted': omitted}
    manifest.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'archive': target.name, 'bytes': result['bytes'],
                      'verifiedMembers': len(rows), 'omitted': len(omitted)}))


if __name__ == '__main__':
    main()
