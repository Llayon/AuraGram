"""Assemble original-only, local review materials for development sources."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


ROOT = Path(__file__).resolve().parents[1]
LOCAL_OUT = ROOT / 'tests/visual/out'
INSTRUCTIONS = ROOT / 'tests/visual/lash-development-review-instructions.md'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def local_evidence(name):
    return (ROOT / name).resolve(strict=True).relative_to(LOCAL_OUT.resolve())


def build_packet(selection, output):
    config = json.loads(selection.read_bytes())
    census = (LOCAL_OUT / local_evidence(config['census'])).read_bytes()
    summary = json.loads((ROOT / config['censusSummary']).read_bytes())
    if sha256(census) != summary['censusSHA256']:
        raise ValueError('Census digest mismatch')
    inventory = json.loads(census)
    if not inventory['consistent']:
        raise ValueError('Inconsistent source census')
    by_file = {record['file']: record for record in inventory['sources']}
    selected = config['sources']
    if not selected or len(set(selected)) != len(selected):
        raise ValueError('Source selection is empty or repeated')
    for file in selected:
        record = by_file.get(file)
        if not record or record['split'] != 'development' or not record['bothEnginesReady']:
            raise ValueError(f'Ineligible development source: {file}')
        if file != Path(file).name or '/' in file or '\\' in file:
            raise ValueError(f'Unsafe source name: {file}')

    files = {'README.md': INSTRUCTIONS.read_bytes()}
    index = []
    for file in selected:
        record = by_file[file]
        acquired = next(item for item in record['acquisition'] if item['status'] == 'downloaded')
        log_path = LOCAL_OUT / local_evidence(acquired['input'])
        log_bytes = log_path.read_bytes()
        if sha256(log_bytes) != inventory['inputs'][acquired['input']]:
            raise ValueError(f'Changed acquisition inventory: {file}')
        log = json.loads(log_bytes)
        original_path = (log_path.parent / file).resolve(strict=True)
        original_path.relative_to(LOCAL_OUT.resolve())
        original = original_path.read_bytes()
        digest = sha256(original)
        if digest != record['sourceSHA256'] or digest != acquired['sha256']:
            raise ValueError(f'Changed original JPEG: {file}')
        attribution = next(item for item in log['records'] if item['file'] == file)
        index.append({'file': file, 'sha256': digest, 'bytes': len(original),
                      'page': attribution['page'], 'author': attribution.get('author'), 'license': log['license']})
        files[f'originals/{file}'] = original
        files[f'annotations/{Path(file).stem}.json'] = json_bytes({
            'file': file, 'sourceSHA256': digest, 'coordinateSpace': 'original-source-pixels',
            'originalOnly': True, 'reviewer': '', 'role': None, 'evaluatedEyes': [], 'excludedEyes': {},
            'eyes': {side: {'tips': [], 'ambiguities': [], 'protectedRegions': []} for side in ('left', 'right')},
            'notes': ''})
    files['index.json'] = json_bytes({'split': 'development', 'sources': index})

    with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
        for name, data in files.items():
            entry = zipfile.ZipInfo(name)
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, data)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None or any(archive.read(name) != data for name, data in files.items()):
            raise ValueError('Review packet verification failed')
    return {'sources': len(index), 'members': len(files), 'archiveSHA256': sha256(output.read_bytes())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('selection', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    # Keep the packet under the ignored local evidence directory.
    output = args.output.resolve()
    output.relative_to(LOCAL_OUT.resolve())
    print(json.dumps(build_packet(args.selection, output)))


if __name__ == '__main__':
    main()
