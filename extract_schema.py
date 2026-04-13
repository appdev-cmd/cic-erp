import sys

schema = []
in_table = False
with open('cic14005_cic_fs_2026-04-12_14-16-36.sql', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if line.startswith('CREATE TABLE `fs_news`'):
            in_table = True
        
        if in_table:
            schema.append(line)
            if line.strip().endswith(';'):
                break

with open('fs_news_schema.sql', 'w', encoding='utf-8') as out:
    out.write(''.join(schema))
