import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

HTML_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'RawWebsite')

ORDER_PAT  = re.compile(r'<a [^>]*href=["\'][^"\']*(?:order|doordash|ubereats|grubhub|toasttab)[^"\']*["\'][^>]*>', re.I)
PHONE_PAT  = re.compile(r'<a [^>]*href=["\']tel:[^"\']*["\'][^>]*>', re.I)
MAPS_PAT   = re.compile(r'<a [^>]*href=["\'][^"\']*maps\.google[^"\']*["\'][^>]*>', re.I)
MENU_BTN   = re.compile(r'<a [^>]*class=["\'][^"\']*btn[^"\']*["\'][^>]*href=["\'][^"\']*menu[^"\']*["\'][^>]*>', re.I)

def add_event(event, tag):
    if 'trackEvent' in tag:
        return tag
    return tag.replace('<a ', "<a onclick=\"trackEvent('" + event + "',{source:'website',page:location.pathname})\" ", 1)

def instrument(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    orig = html

    if 'analytics.js' not in html:
        html = html.replace('</head>', '    <script src="analytics.js"></script>\n</head>', 1)

    html = ORDER_PAT.sub(lambda m: add_event('order_click', m.group(0)), html)
    html = PHONE_PAT.sub(lambda m: add_event('phone_click', m.group(0)), html)
    html = MAPS_PAT.sub(lambda m: add_event('directions_click', m.group(0)), html)
    html = MENU_BTN.sub(lambda m: add_event('menu_click', m.group(0)), html)

    if html != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        return True
    return False

changed, total = [], 0
for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    total += 1
    if instrument(os.path.join(HTML_DIR, fname)):
        changed.append(fname)

print(f"Modified: {len(changed)}/{total} files")
for f in changed:
    print(f"  + {f}")
