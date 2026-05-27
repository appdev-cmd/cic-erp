# -*- coding: utf-8 -*-
file_path = r"d:\CIC ERP\components\AIAssistant.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ('bg-slate-50 dark:bg-slate-950/40', 'bg-slate-50 dark:bg-slate-900'),
    ('bg-white dark:bg-slate-850', 'bg-slate-50 dark:bg-slate-800'),
    ('text-[10px] text-emerald-600 dark:text-emerald-450 font-mono', 'text-[10px] text-emerald-600 dark:text-emerald-400 font-mono'),
    ('text-[10px] text-rose-600 dark:text-rose-450 mt-1 leading-normal', 'text-[10px] text-rose-600 dark:text-rose-400 mt-1 leading-normal'),
    ('text-slate-650', 'text-slate-600')
]

fixed_count = 0
for typo, fix in replacements:
    occurrences = content.count(typo)
    if occurrences > 0:
        content = content.replace(typo, fix)
        print(f"Replaced '{typo}' with '{fix}' ({occurrences} times)")
        fixed_count += occurrences

if fixed_count > 0:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully corrected modal color issues!")
else:
    print("No typos found.")
