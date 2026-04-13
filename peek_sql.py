import json
import re

with open('cic14005_cic_fs_2026-04-12_14-16-36.sql', 'r', encoding='utf-8', errors='ignore') as f, open('fs_news_sample.txt', 'w', encoding='utf-8') as out:
    for line in f:
        if line.startswith('INSERT INTO `fs_news`'):
            out.write("Found INSERT INTO fs_news\n")
            out.write(line[:1000] + '\n')
            break
