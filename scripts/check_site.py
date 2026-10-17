"""Check static local references, including embedded iframe documents."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re

ROOT = Path(__file__).resolve().parents[1] / 'site'
errors = []
checked = 0

def reference(value, base, source):
    global checked
    value = value.strip()
    if not value or value.startswith(('#', '//')):
        return
    url = urlsplit(value)
    if url.scheme or not url.path:
        return
    target = (ROOT / unquote(url.path).lstrip('/') if url.path.startswith('/')
              else base / unquote(url.path)).resolve()
    checked += 1
    if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
        errors.append(f'{source}: missing or unsafe reference {value}')

class Document(HTMLParser):
    def __init__(self, base, source):
        super().__init__(convert_charrefs=True)
        self.base, self.source = base, source

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'href', 'poster'):
            if attrs.get(key):
                reference(attrs[key], self.base, self.source)
        if attrs.get('srcdoc'):
            parse(attrs['srcdoc'], self.base, self.source + ' iframe')
        if attrs.get('style'):
            css(attrs['style'], self.base, self.source)

def css(text, base, source):
    for value in re.findall(r'url\(\s*[\"\']?([^\"\')]+)', text):
        reference(value, base, source)

def parse(text, base, source):
    Document(base, source).feed(text)
    css(text, base, source)

for name in ('index.html', 'home.html', 'load-intro-v6-mobile.mp4'):
    if not (ROOT / name).is_file():
        errors.append(f'Missing entry file: {name}')
for path in ROOT.rglob('*'):
    if path.is_symlink():
        errors.append(f'Symlink in publish directory: {path}')
    elif path.is_file() and path.suffix in ('.html', '.css'):
        text = path.read_text(encoding='utf-8')
        if path.suffix == '.html':
            parse(text, path.parent, path.name)
        else:
            css(text, path.parent, path.name)
if errors:
    raise SystemExit('\n'.join(sorted(set(errors))))
print(f'PASS: {checked} local references; entry pages, video and embedded documents checked.')
