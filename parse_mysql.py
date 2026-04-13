import json
import re

def parse_mysql_inserts(filename):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    records = []
    
    in_string = False
    escape_next = False
    in_tuple = False
    current_value = []
    current_tuple = []
    
    i = 0
    while i < len(content):
        c = content[i]
        
        if not in_string and c == '(' and not in_tuple:
            in_tuple = True
            current_tuple = []
            current_value = []
            i += 1
            continue
            
        if in_tuple:
            if escape_next:
                current_value.append(c)
                escape_next = False
            elif c == '\\':
                escape_next = True
            elif c == "'" and not in_string:
                in_string = True
            elif c == "'" and in_string:
                if i + 1 < len(content) and content[i+1] == "'":
                    current_value.append("'")
                    i += 1
                else:
                    in_string = False
            elif c == ',' and not in_string:
                val = ''.join(current_value).strip()
                current_tuple.append(val)
                current_value = []
            elif c == ')' and not in_string:
                val = ''.join(current_value).strip()
                current_tuple.append(val)
                records.append(current_tuple)
                current_tuple = []
                current_value = []
                in_tuple = False
            else:
                current_value.append(c)
                
        i += 1

    return records

records = parse_mysql_inserts('fs_news_data.txt')

# Writing to json
with open('fs_news_parsed_sample.json', 'w', encoding='utf-8') as out:
    json.dump(records, out, indent=2, ensure_ascii=False)
    print(f"Saved {len(records)} records")

