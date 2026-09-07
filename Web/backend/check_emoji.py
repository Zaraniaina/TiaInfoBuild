import os, re, glob

base = r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src'
files = glob.glob(os.path.join(base, '**', '*.tsx'), recursive=True)
files += glob.glob(os.path.join(base, '**', '*.ts'), recursive=True)

emoji_pattern = re.compile(
    "[\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002702-\U000027B0"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "]+", flags=re.UNICODE)

total = 0
for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    matches = emoji_pattern.findall(content)
    if matches:
        rel = f.replace(base + '\\', '')
        print(f'{rel}: {len(matches)} emoji')
        total += len(matches)
print(f'\nTotal remaining emoji: {total}')
