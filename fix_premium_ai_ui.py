"""
fix_premium_ai_ui.py
--------------------
Adds the Premium AI CSS block to mi-core/ui/index.html and mobile.html,
and updates the HTML to use the new SVG logo + logo-wrap class.

Both files were missing:
  - The .mi-ai-logo SVG logo in the topbar
  - The logo-wrap class wrapping the logo + title
  - The premium icon CSS (.ic, .qi, .navbtn .ni, etc.)
  - The .logo-wrap CSS rule

This script (idempotent):
  1. Inserts a single clean premium CSS block just before </style>
  2. Updates HTML: adds SVG logo to topbar + wraps with logo-wrap
"""

from pathlib import Path
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(r'd:\Project\Master\mi-core\ui')

# ── Premium CSS block (compact single-line format) ───────────────────────────
PREMIUM_CSS = """
/* PREMIUM AI VISUAL */
.mi-ai-logo{width:44px;height:44px;flex-shrink:0;overflow:visible;filter:drop-shadow(0 0 20px rgba(79,142,247,.38)) drop-shadow(0 12px 28px rgba(0,0,0,.30))}
.mi-ai-logo .halo{fill:url(#miHalo);opacity:.92}.mi-ai-logo .shell{fill:url(#miLogoCore);stroke:rgba(255,255,255,.24);stroke-width:1.2}.mi-ai-logo .orbit{fill:none;stroke:url(#miOrbit);stroke-width:2.25;stroke-linecap:round;stroke-dasharray:18 7;opacity:.95}.mi-ai-logo .chip{fill:rgba(9,9,15,.64);stroke:rgba(255,255,255,.2);stroke-width:1}.mi-ai-logo .trace{fill:none;stroke:#06b6d4;stroke-width:1.45;stroke-linecap:round;opacity:.95}.mi-ai-logo .spark{fill:#e8eaf0}.mi-ai-logo .node{fill:#06b6d4;filter:drop-shadow(0 0 5px rgba(6,182,212,.8))}.mi-ai-logo .mark{fill:#fff;font-family:Inter,system-ui,sans-serif;font-size:20px;font-weight:950;letter-spacing:-1.6px}
.logo-wrap{display:flex;align-items:center;gap:10px}.logo-wrap .logo,.logo-wrap .topbar-title{line-height:1}
.ic,.qi,.navbtn .ni,.li-ic,.cc-ic,.chat-av{position:relative;display:inline-flex!important;align-items:center;justify-content:center;border-radius:10px;background:linear-gradient(135deg,rgba(79,142,247,.22),rgba(124,93,249,.14))!important;border:1px solid rgba(79,142,247,.24)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 22px rgba(0,0,0,.12);overflow:hidden;vertical-align:middle}
.ic,.qi,.navbtn .ni{color:transparent!important}.ic{width:26px!important;height:26px!important}.qi{width:30px!important;height:30px!important;margin-bottom:7px!important}.navbtn .ni{width:24px!important;height:24px!important;margin-bottom:2px}.li-ic,.cc-ic,.chat-av{color:var(--accent)!important}
.ic:before,.qi:before,.navbtn .ni:before{content:"";position:absolute;width:12px;height:12px;border-radius:4px;border:2px solid #4f8ef7;box-shadow:0 0 12px rgba(79,142,247,.48);transform:rotate(45deg)}
.ic:after,.qi:after,.navbtn .ni:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#06b6d4;right:5px;top:5px;box-shadow:0 0 10px rgba(6,182,212,.9)}
.ni.active .ic,.navbtn.active .ni{background:linear-gradient(135deg,rgba(79,142,247,.34),rgba(124,93,249,.22))!important;border-color:rgba(79,142,247,.48)!important}
"""

# ── SVG Logo for topbar ──────────────────────────────────────────────────────
SVG_LOGO = (
    '<svg class="mi-ai-logo" viewBox="0 0 64 64" role="img" aria-label="Mi AI logo">'
    '<defs><linearGradient id="miLogoCore" x1="10" y1="8" x2="54" y2="58">'
    '<stop stop-color="#4f8ef7"/><stop offset=".55" stop-color="#7c5df9"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>'
    '</defs><circle class="ring" cx="32" cy="32" r="26"/>'
    '<path class="core" d="M32 6 54 18v28L32 58 10 46V18L32 6Z"/>'
    '<path class="node" d="M17 20h6v6h-6zM41 20h6v6h-6zM17 38h6v6h-6zM41 38h6v6h-6z" opacity=".85"/>'
    '<path d="M23 23h18v4H23zM23 37h18v4H23zM20 26h4v12h-4zM40 26h4v12h-4z" fill="#0a0a0f" opacity=".38"/>'
    '<text class="mark" x="32" y="38" text-anchor="middle">Mi</text></svg>'
)


def fix_index_html(path: Path) -> dict:
    """Fix index.html: inject CSS + update HTML topbar."""
    f = open(path, 'rb')
    data = f.read()
    f.close()
    text = data.decode('utf-8', 'replace')

    changes = []

    # 1. Inject premium CSS before </style> (idempotent)
    if '.mi-ai-logo{width:44px' not in text:
        style_pos = text.rfind('</style>')
        if style_pos == -1:
            return {'error': 'No </style> found'}
        text = text[:style_pos] + PREMIUM_CSS + '\n' + text[style_pos:]
        changes.append('injected premium CSS')
    else:
        changes.append('premium CSS already present')

    # 2. Update topbar HTML: add SVG logo + logo-wrap (idempotent)
    if 'logo-wrap' not in text:
        # Find the logo div in HTML section (after </style>)
        body_start = text.rfind('</style>')
        if body_start == -1:
            body_start = 0
        html_part = text[body_start:]

        # Match the exact string from index.html
        old_block = (
            '<div class="tb-left">\n'
            '    <div class="logo">Mi<span> Executive</span></div>\n'
            '    <span class="tb-badge">'
        )
        new_block = (
            '<div class="tb-left">\n'
            '    <div class="logo-wrap">\n'
            '      ' + SVG_LOGO + '\n'
            '      <div class="logo">Mi<span> Executive</span></div>\n'
            '    </div>\n'
            '    <span class="tb-badge">'
        )
        if old_block in html_part:
            text = text[:body_start] + html_part.replace(old_block, new_block)
            changes.append('added SVG logo + logo-wrap in topbar')
        else:
            changes.append('topbar HTML already updated or changed')
    else:
        changes.append('logo-wrap already in HTML')

    result_text = text
    css_ok  = '.mi-ai-logo{width:44px' in result_text
    html_ok = 'logo-wrap' in result_text and SVG_LOGO[:20] in result_text

    return {
        'file': path.name,
        'changes': changes,
        'css_injected': css_ok,
        'html_updated': html_ok,
        'text': result_text,
    }


def fix_mobile_html(path: Path) -> dict:
    """Fix mobile.html: inject CSS only (no topbar SVG needed)."""
    f = open(path, 'rb')
    data = f.read()
    f.close()
    text = data.decode('utf-8', 'replace')

    changes = []

    # Inject premium CSS before </style> (idempotent)
    if '.mi-ai-logo{width:44px' not in text:
        style_pos = text.rfind('</style>')
        if style_pos == -1:
            return {'error': 'No </style> found'}
        text = text[:style_pos] + PREMIUM_CSS + '\n' + text[style_pos:]
        changes.append('injected premium CSS')
    else:
        changes.append('premium CSS already present')

    result_text = text
    css_ok = '.mi-ai-logo{width:44px' in result_text

    return {
        'file': path.name,
        'changes': changes,
        'css_injected': css_ok,
        'html_updated': True,
        'text': result_text,
    }


def main():
    print('=' * 60)
    print('fix_premium_ai_ui.py -- Premium AI UI Enhancement')
    print('=' * 60)

    results = []

    for fname, fixer in [
        ('index.html', fix_index_html),
        ('mobile.html', fix_mobile_html),
    ]:
        path = ROOT / fname
        if not path.exists():
            print(f'\n> {fname}: not found')
            continue

        print(f'\n> Processing {fname}...')
        r = fixer(path)

        if 'error' in r:
            print(f'  ERROR: {r["error"]}')
        else:
            f = open(path, 'wb')
            f.write(r['text'].encode('utf-8'))
            f.close()
            for c in r['changes']:
                print(f'  - {c}')
            print(f'  CSS OK: {r["css_injected"]}, HTML OK: {r.get("html_updated", True)}')
            print('  DONE')
        results.append(r)

    print('\n' + '=' * 60)
    all_ok = all(
        r.get('css_injected', False) and r.get('html_updated', False)
        for r in results
    )
    print('  All files OK:', all_ok)


if __name__ == '__main__':
    main()
