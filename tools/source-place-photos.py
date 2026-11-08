"""Import photos from reviewed public primary-source pages; never guess search images.

Each entry retains its page, original image URL and branch/brand scope. This is
a curated demo asset import, not a license grant or a general web scraper.
"""
import concurrent.futures
import html
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'app/src/main/assets/web'
DEST = WEB / 'images/official'


def get(url):
    return urllib.request.urlopen(url, timeout=15).read()


def page_html(key, url):
    cache=ROOT / '.cache' / f'photo-{key}.html'
    if cache.exists():
        return cache.read_text(encoding='utf-8')
    return get(url).decode('utf-8',errors='replace')


def save_photo(key, number, name, image, page, kind='brand'):
    image = urllib.parse.quote(html.unescape(image), safe=':/?=&%[]')
    try:
        data = get(image)
        ext = '.jpg' if data.startswith(b'\xff\xd8') else '.png' if data.startswith(b'\x89PNG') else None
        if not ext or len(data) > 4_000_000:
            return None
        file = f'{key}-{number}{ext}'
        (DEST / file).write_bytes(data)
        return dict(image='images/official/'+file, name=html.unescape(name),
                    sourcePage=page, imageSource=image, kind=kind,
                    retrievedAt=date.today().isoformat())
    except Exception:
        return None


def main():
    DEST.mkdir(exist_ok=True, parents=True)
    brands = []
    page = 'https://www.starbucks.co.kr/menu/drink_view.do?product_cd=110563'
    doc = page_html('starbucks',page)
    graph = next(json.loads(s)['@graph'] for s in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', doc, re.S) if '@graph' in s)
    product = next(p for p in graph if p.get('@type') == 'Product')
    photo = save_photo('starbucks', product['sku'], product['name'], product['image'][0], page)
    if photo:
        brands.append(dict(brand='스타벅스', aliases=['스타벅스','starbucks'], photos=[photo]))

    page = 'https://www.mega-mgccoffee.com/menu/menu.php?category=1&menu_category1=1&menu_category2=1&page=1'
    doc = page_html('mega-coffee',page)
    entries=[]
    for block in re.findall(r'<a class="inner_modal_open">(.*?)</a>',doc,re.S):
        name=re.search(r'<b>(.*?)</b>',block,re.S).group(1).strip()
        image=re.search(r'<img src="([^"]+)',block).group(1)
        entries.append((name,image))
    # Keep the evergreen Americano first rather than a seasonal collaboration.
    entries.sort(key=lambda p: (p[0]!='아메리카노',p[0]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        photos=list(filter(None,pool.map(lambda e:save_photo('mega',e[0],*e[1],page),enumerate(entries))))
    if photos:
        brands.append(dict(brand='메가MGC커피',aliases=['메가mgc커피','메가커피','메가엠지씨커피','megacoffee'],photos=photos))

    page='https://ediya.com/contents/drink.html'
    doc=page_html('ediya',page)
    entries=re.findall(r'<a[^>]+show_nutri\([^>]*><img src="(/files/menu/[^"]+)"[^>]*>.*?<div class="menu_tt">\s*<a[^>]+><span>(.*?)</span>',doc,re.S)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        photos=list(filter(None,pool.map(lambda e:save_photo('ediya',e[0],e[1][1],'https://ediya.com'+e[1][0],page),enumerate(entries))))
    if photos:
        brands.append(dict(brand='이디야커피',aliases=['이디야','ediya'],photos=photos))

    page='https://mt.bbq.co.kr/menu/menuView.asp?midx=2247'
    doc=page_html('bbq',page)
    match=re.search(r'<img src="(https://img.bbq.co.kr[^\"]+/pc/[^\"]+)" alt="([^\"]+)"',doc)
    if match:
        photo=save_photo('bbq','2247',match[2],match[1],page)
        if photo:
            brands.append(dict(brand='BBQ',aliases=['bbq','비비큐'],photos=[photo]))

    output=dict(retrievedAt=date.today().isoformat(),brands=brands,places=[])
    (WEB/'place-photos.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'brands':len(brands),'photos':sum(len(b['photos']) for b in brands)}))


if __name__ == '__main__':
    main()
