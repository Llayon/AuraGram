"""Package this experiment's generated evidence, preserving raw hashes.
Original JPEGs stay local; public source URLs and SHA256 are in downloads.json.
No root-level user photos or unrelated prior experiment folders are included.
"""
import hashlib, json, re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/visual/out'
DEST = ROOT / 'tests/visual/spatial-ending-evidence'
PATTERN = re.compile(r'(?:spatial-(?:cohort-\d+|screen-(?:chromium|webkit)-\d+|supplement-\d+|supplement-screen-(?:chromium|webkit)-\d+|label-review-\d+)|native-(?:real-\d+|real-views-\d+|cell-real-\d+|cell-real-views-\d+|path-browser-\d+\.json|cell-legacy-browser-\d+\.json)|side-closure-browser-\d+\.json|proximal-(?:corridor-\d+|diagnosis-views-\d+)|mask-scope-\d+-\d+(?:\.failed-protocol\.json)?|baseline-association-views-\d+|multiscale-native-real-\d+|scale-correspondence-real-\d+|local-ending-(?:real|views)-\d+|distal-body-(?:real|ending)-\d+)')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    DEST.mkdir(exist_ok=True)
    target = DEST / 'observation-evidence-01.zip'
    manifest_file = DEST / 'manifest.json'
    if target.exists() or manifest_file.exists():
        raise RuntimeError('Evidence package already exists; do not overwrite frozen output')
    files, originals, omitted_views = [], [], []
    for entry in sorted(OUT.iterdir()):
        if not PATTERN.fullmatch(entry.name):
            continue
        for file in sorted(entry.rglob('*')) if entry.is_dir() else [entry]:
            if not file.is_file():
                continue
            if file.suffix.lower() in ('.jpg', '.jpeg'):
                originals.append({'path': file.relative_to(ROOT).as_posix(), 'bytes': file.stat().st_size, 'sha256': sha(file.read_bytes()), 'packaged': False})
            elif file.suffix.lower() == '.png' and not entry.name.startswith(('spatial-label-review-', 'proximal-diagnosis-views-', 'baseline-association-views-', 'local-ending-views-')):
                omitted_views.append({'path': file.relative_to(OUT).as_posix(), 'bytes': file.stat().st_size, 'sha256': sha(file.read_bytes()), 'packaged': False})
            elif file.suffix.lower() in ('.json', '.png', '.txt', '.html', '.mjs', '.cjs', '.js'):
                files.append(file)
    rows, parts = [], []
    archive = None
    try:
        for file in files:
            if archive is None or archive.fp.tell() >= 16 * 1024 * 1024:
                if archive:
                    archive.close()
                target = DEST / ('observation-evidence-%02d.zip' % (len(parts) + 1))
                archive = zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED, compresslevel=9)
                parts.append(target)
            data = file.read_bytes()
            name = file.relative_to(OUT).as_posix()
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 14, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
            rows.append({'archive': target.name, 'archivePath': name, 'bytes': len(data), 'sha256': sha(data)})
    finally:
        if archive:
            archive.close()
    for part in parts:
        with zipfile.ZipFile(part) as archive:
            for row in [r for r in rows if r['archive'] == part.name]:
                if sha(archive.read(row['archivePath'])) != row['sha256']:
                    raise RuntimeError('Archive verification failed: ' + row['archivePath'])
        if part.stat().st_size >= 95 * 1024 * 1024:
            raise RuntimeError('Part exceeds reviewable single-file bound')
    manifest = {'schema': 'spatial-evidence-package-v2', 'date': '2026-11-14', 'restoreDirectory': 'tests/visual/out', 'scope': 'All numeric generated data and exact recorded source snapshots; selected source/probe views', 'originals': originals, 'omittedSourceViews': omitted_views, 'originalPolicy': 'Original JPEGs and most full screening PNGs omitted from distributed package, retained locally. Rebuild views from recorded public source URLs and require the original SHA256. No root-level user photos included.', 'archives': [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in parts], 'members': rows}
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'members': len(rows), 'omittedOriginals': len(originals), 'omittedViews': len(omitted_views), 'archives': manifest['archives']}))

if __name__ == '__main__':
    main()
