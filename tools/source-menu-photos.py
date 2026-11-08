"""Fetch the photo belonging to each already verified official menu, not search guesses."""
import concurrent.futures, html, json, re, urllib.parse, urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'app/src/main/assets/web'
catalog=json.loads((root/'brand-menus.json').read_text(encoding='utf-8'))
dest=root/'images/official';dest.mkdir(parents=True,exist_ok=True)
def photo(item):
    try:
        raw=urllib.request.urlopen(item['sourceUrl'],timeout=15).read().decode('utf-8',errors='replace')
        match=re.search(r'<div\b[^>]*\bid="container"[^>]*\bimgSrc="([^"]+)"',raw,re.I)
        if not match:return None
        url=urllib.parse.urljoin('https://www.kyochon.com',html.unescape(match[1]))
        url=urllib.parse.quote(url,safe=':/?=&%')
        data=urllib.request.urlopen(url,timeout=15).read()
        ext='.png' if data.startswith(b'\x89PNG') else '.jpg' if data.startswith(b'\xff\xd8') else None
        if not ext or len(data)>3000000:return None
        name='kyochon-'+item['id']+ext;(dest/name).write_bytes(data)
        return item['id'],{'image':'images/official/'+name,'imageSource':url,'imageSourcePage':item['sourceUrl']}
    except Exception:return None
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=dict(x for x in pool.map(photo,catalog['kyochon']['items']) if x)
for item in catalog['kyochon']['items']:
    if item['id'] in results:item.update(results[item['id']])
(root/'brand-menus.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Official menu photos:',len(results),'of',len(catalog['kyochon']['items']))
