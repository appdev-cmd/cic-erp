
import re, json

with open('fs_news_data.txt', 'r', encoding='utf-8') as f:
    sql = f.read()

# Naive approach to extract tuples:
# Find all occurrences of (...)
# Actually, let's use a regex that matches balanced parens, or simply split by '),(' 
# But strings might contain '),('
