import sys

tables = set()
with open('cic14005_cic_fs_2026-04-12_14-16-36.sql', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if line.startswith('CREATE TABLE '):
            parts = line.split(' ')
            if len(parts) >= 3:
                tables.add(parts[2].replace('`', '').strip())

matched = sorted(t for t in tables if 'news' in t.lower() or 'post' in t.lower() or 'content' in t.lower() or 'art' in t.lower())
for t in matched:
    print(t)
