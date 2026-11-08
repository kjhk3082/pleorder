import json,re,pathlib,html
root=pathlib.Path.cwd(); raw=json.loads((root/'.cache/places/seoul-osm.json').read_text(encoding='utf-8-sig')); rows=[]
for e in raw['elements']:
 t=e.get('tags',{}); n=t.get('name:ko') or t.get('name'); c=e.get('center',e); lat=c.get('lat'); lng=c.get('lon')
 if not n or not lat or not lng or t.get('route_ref') or t.get('highway') or t.get('public_transport') or t.get('disused')=='yes':continue
 if n.lower() in ['kill','none','null','restaurant','cafe']:continue
 cuisine=t.get('cuisine','');hint=(n+' '+cuisine).lower(); cat='음식점'
 for pattern,label in [('mexican|멕시|바토스','멕시칸'),('vietnamese|베트남|쌀국수','베트남'),('thai|태국','태국'),('indian|인도','인도'),('pizza|피자','피자'),('chinese|중화|중국|짜장|짬뽕|마라','중식'),('japanese|sushi|ramen|일식|라멘|초밥|스시','일식'),('salad|샐러드','샐러드'),('burger|버거','버거'),('chicken|치킨|닭강정','치킨'),('coffee|카페|커피','카페'),('korean|한식|국밥|찌개|냉면|비빔밥','한식')]:
  if re.search(pattern,hint):cat=label;break
 if t.get('amenity')=='cafe':cat='카페'
 address=' '.join(dict.fromkeys(filter(None,[t.get('addr:city'),t.get('addr:district'),t.get('addr:subdistrict'),t.get('addr:street'),t.get('addr:housenumber')])))
 rows.append([e['type'][0]+str(e['id']),n,round(lat,6),round(lng,6),cat,address,t.get('phone') or t.get('contact:phone',''),t.get('website') or t.get('contact:website',''),t.get('opening_hours',''),t.get('website:menu',''),cuisine,t.get('delivery',''),t.get('takeaway','')])
obj={'source':'OpenStreetMap contributors','license':'ODbL-1.0','retrievedAt':raw['osm3s']['timestamp_osm_base'],'area':'KR-11 Seoul','count':len(rows),'rows':rows}
p=root/'app/src/main/assets/web/seoul-places.json';p.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
text=(root/'.cache/places/kyochon.html').read_text(encoding='utf-8-sig');products=[]
for block in re.findall(r'<li>(.*?)</li>',text,re.S):
 name=re.search(r'<dt>(.*?)</dt>',block,re.S);price=re.search(r'class="money".*?<strong>([\d,]+)</strong>',block,re.S);link=re.search(r'href="(view.asp\?[^\"]+)"',block)
 if name and price and link:products.append({'id':re.search(r'id=(\d+)',link[1])[1],'name':html.unescape(re.sub('<[^>]+>','',name[1])).strip(),'price':int(price[1].replace(',','')),'sourceUrl':'https://www.kyochon.com/menu/'+html.unescape(link[1])})
unique=list({p['id']:p for p in products}.values());(root/'app/src/main/assets/web/brand-menus.json').write_text(json.dumps({'kyochon':{'source':'https://www.kyochon.com/menu/chicken.asp','retrievedAt':'2026-11-09','priceType':'권장소비자가격 · 매장별 상이','items':unique}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print({'places':len(rows),'officialKyochonItems':len(unique),'bytes':p.stat().st_size})
