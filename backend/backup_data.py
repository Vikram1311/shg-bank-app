"""
SHG Bank — Manual Data Backup & Restore Tool

USAGE:
  python3 backup_data.py backup           # take a snapshot
  python3 backup_data.py restore <name>   # restore from a backup
  python3 backup_data.py list             # list all backups

All backups are saved to /app/data_backups/backup_YYYYMMDD_HHMMSS/
Each backup is a complete JSON dump of all collections.
"""
import asyncio
import os
import json
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Read env
ENV_PATH = os.path.join(os.path.dirname(__file__), '.env')
with open(ENV_PATH) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            os.environ[k] = v.strip('"')

BACKUP_ROOT = '/app/data_backups'
COLLECTIONS = ['members', 'loans', 'contributions', 'savings', 'penalties', 'notifications', 'settings']


async def backup():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = f'{BACKUP_ROOT}/backup_{ts}'
    os.makedirs(backup_dir, exist_ok=True)
    summary = {}
    for col_name in COLLECTIONS:
        docs = await db[col_name].find({}, {'_id': 0}).to_list(50000)
        with open(f'{backup_dir}/{col_name}.json', 'w', encoding='utf-8') as f:
            json.dump(docs, f, ensure_ascii=False, indent=2, default=str)
        summary[col_name] = len(docs)
    with open(f'{backup_dir}/_metadata.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'db_name': os.environ['DB_NAME'],
            'counts': summary,
        }, f, indent=2)
    print(f'✅ Backup saved: {backup_dir}')
    for k, v in summary.items():
        print(f'  {k:20s}: {v}')


async def restore(name):
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    backup_dir = f'{BACKUP_ROOT}/{name}' if not name.startswith('/') else name
    if not os.path.isdir(backup_dir):
        print(f'❌ Backup not found: {backup_dir}')
        return
    ans = input(f'⚠️  This will OVERWRITE current data with backup from {backup_dir}\nType YES to continue: ')
    if ans != 'YES':
        print('Cancelled.')
        return
    for col_name in COLLECTIONS:
        path = f'{backup_dir}/{col_name}.json'
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8') as f:
            docs = json.load(f)
        await db[col_name].delete_many({})
        if docs:
            await db[col_name].insert_many(docs)
        print(f'  Restored {len(docs)} {col_name}')
    print('✅ Restore complete')


def list_backups():
    if not os.path.isdir(BACKUP_ROOT):
        print('No backups yet.')
        return
    backups = sorted(os.listdir(BACKUP_ROOT), reverse=True)
    print(f'Found {len(backups)} backup(s):')
    for b in backups:
        meta_path = f'{BACKUP_ROOT}/{b}/_metadata.json'
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            counts = meta.get('counts', {})
            total = sum(counts.values())
            print(f'  {b}  ({total} records — {counts.get("members", 0)} members, {counts.get("loans", 0)} loans)')
        else:
            print(f'  {b}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'backup'
    if cmd == 'backup':
        asyncio.run(backup())
    elif cmd == 'restore' and len(sys.argv) > 2:
        asyncio.run(restore(sys.argv[2]))
    elif cmd == 'list':
        list_backups()
    else:
        print(__doc__)
