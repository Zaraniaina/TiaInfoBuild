import os, re
issues = []
for root in ['Web/frontend/src/pages', 'Web/frontend/src/components', 'Web/frontend/src/components/layout', 'Web/frontend/src/components/pointage', 'Web/frontend/src/components/ui']:
    for dirpath, _, files in os.walk(root):
        for f in files:
            if f.endswith('.tsx'):
                path = os.path.join(dirpath, f)
                lines = open(path, encoding='utf-8', errors='ignore').readlines()
                for i, line in enumerate(lines):
                    if "'<i" in line:
                        issues.append((path, i+1, line.strip()))
print('Remaining issues:', len(issues))
for issue in issues[:10]:
    print(issue[0], ': line', issue[1], ':', issue[2])
