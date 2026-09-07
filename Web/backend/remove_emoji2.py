import os, glob

files = [
    r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\components\layout\Sidebar.tsx',
    r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\components\layout\Layout.tsx',
    r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\components\auth\RoleRedirect.tsx',
    r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\components\auth\ClientLoginPage.tsx',
    r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\pages\auth\ClientLoginPage.tsx',
    r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\pages\dashboard\DashboardPage.tsx',
]
files += glob.glob(r'd:\Tia_info_projet\projet 2\TiaInfoBuild\Web\frontend\src\pages\client\*.tsx')

replacements = {
    '\U0001F6A7': '<i className="bi bi-cone-striped"></i>',
    '\U0001F4CB': '<i className="bi bi-clipboard-check"></i>',
    '\U0001F4C5': '<i className="bi bi-calendar-week"></i>',
    '\u23F1\uFE0F': '<i className="bi bi-stopwatch"></i>',
    '\u26A0\uFE0F': '<i className="bi bi-exclamation-triangle"></i>',
    '\U0001F4F7': '<i className="bi bi-camera"></i>',
    '\U0001F514': '<i className="bi bi-bell"></i>',
    '\U0001F3D7\uFE0F': '<i className="bi bi-building"></i>',
    '\U0001F4CA': '<i className="bi bi-bar-chart"></i>',
    '\U0001F4DD': '<i className="bi bi-file-earmark-text"></i>',
    '\U0001F9F0': '<i className="bi bi-tools"></i>',
    '\U0001F4E6': '<i className="bi bi-box"></i>',
    '\U0001F4C1': '<i className="bi bi-folder"></i>',
    '\U0001F4AC': '<i className="bi bi-chat-dots"></i>',
    '\U0001F464': '<i className="bi bi-person"></i>',
    '\u2699\uFE0F': '<i className="bi bi-gear"></i>',
    '\U0001F4CD': '<i className="bi bi-geo-alt"></i>',
    '\u25B6\uFE0F': '<i className="bi bi-play-fill"></i>',
    '\u2705': '<i className="bi bi-check-lg"></i>',
    '\U0001F6AB': '<i className="bi bi-slash-circle"></i>',
    '\u274C': '<i className="bi bi-x-lg"></i>',
    '\U0001F4D0': '<i className="bi bi-rulers"></i>',
    '\U0001F9BA': '<i className="bi bi-shield-check"></i>',
    '\U0001F4C4': '<i className="bi bi-file-earmark"></i>',
    '\U0001F3E0': '<i className="bi bi-house"></i>',
    '\u2795': '<i className="bi bi-plus"></i>',
    '\u2715': '<i className="bi bi-x"></i>',
    '\U0001F504': '<i className="bi bi-arrow-clockwise"></i>',
    '\U0001F511': '<i className="bi bi-key"></i>',
    '\U0001F4E2': '<i className="bi bi-megaphone"></i>',
    '\U0001F6E1\uFE0F': '<i className="bi bi-shield"></i>',
    '\U0001F527': '<i className="bi bi-wrench"></i>',
    '\U0001F327\uFE0F': '<i className="bi bi-cloud-rain"></i>',
    '\U0001F6A8': '<i className="bi bi-exclamation-octagon"></i>',
    '\U0001F4B3': '<i className="bi bi-credit-card"></i>',
    '\U0001F9FE': '<i className="bi bi-receipt"></i>',
    '\U0001F4B2': '<i className="bi bi-currency-dollar"></i>',
    '\U0001F4B5': '<i className="bi bi-cash"></i>',
    '\u2709\uFE0F': '<i className="bi bi-envelope"></i>',
    '\U0001F4E7': '<i className="bi bi-envelope-open"></i>',
    '\U0001F48E': '<i className="bi bi-gem"></i>',
    '\u2728': '<i className="bi bi-stars"></i>',
    '\U0001F512': '<i className="bi bi-lock"></i>',
    '\U0001F3C6': '<i className="bi bi-trophy"></i>',
    '\U0001F680': '<i className="bi bi-rocket-takeoff"></i>',
}

total = 0
for f in files:
    if not os.path.exists(f):
        continue
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    count = 0
    for emoji, icon in replacements.items():
        c = content.count(emoji)
        if c:
            content = content.replace(emoji, icon)
            count += c
    if count:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        print(f'{os.path.basename(f)}: {count} emoji replaces')
        total += count
print(f'Total: {total} remplacements')
