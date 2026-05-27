# -*- coding: utf-8 -*-
file_path = r"d:\CIC ERP\components\AIAssistant.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ('text-slate-850', 'text-slate-800'),
    ('hover:bg-slate-205', 'hover:bg-slate-200'),
    ('border-slate-150', 'border-slate-200'),
    ('dark:hover:bg-slate-850', 'dark:hover:bg-slate-800'),
    ('dark:border-indigo-850', 'dark:border-indigo-800'),
    ('dark:bg-slate-650', 'dark:bg-slate-700'),
    ('shadow-indigo-150', 'shadow-indigo-100'),
    ('border-emerald-250', 'border-emerald-200'),
    ('border-rose-250', 'border-rose-200'),
    ('text-emerald-650', 'text-emerald-600'),
    ('dark:text-rose-455', 'dark:text-rose-400'),
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
    print("Successfully corrected color typos!")
else:
    print("No typos found.")
