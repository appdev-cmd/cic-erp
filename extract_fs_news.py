import json
import re

news_inserts = []
with open('cic14005_cic_fs_2026-04-12_14-16-36.sql', 'r', encoding='utf-8', errors='replace') as f:
    for line in f:
        if line.startswith('INSERT INTO `fs_news`'):
            news_inserts.append(line)

with open('fs_news_data.txt', 'w', encoding='utf-8') as out:
    for insert in news_inserts:
        out.write(insert)
