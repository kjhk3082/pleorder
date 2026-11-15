"""Upload authorized contest artifacts to this repository's GitHub Release.

Uses the existing Git credential helper in memory. Never prints or saves tokens.
"""
import argparse,json,pathlib,subprocess,urllib.request,urllib.error,urllib.parse,os,hashlib,zipfile
p=argparse.ArgumentParser();p.add_argument('--commit',required=True);p.add_argument('--draft',action='store_true');p.add_argument('--include-films',action='store_true');p.add_argument('--shortform',action='store_true');p.add_argument('--latest',action='store_true');p.add_argument('--notes-file',type=pathlib.Path);p.add_argument('--tag',default='contest-2026-11-12');a=p.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[2];repo='kjhk3082/pleorder';tag=a.tag
assert all(c.isalnum() or c in '-._' for c in tag),'Invalid tag'
env={**os.environ,'GIT_TERMINAL_PROMPT':'0'}
r=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True,env=env,cwd=ROOT)
credential=dict(line.split('=',1) for line in r.stdout.splitlines() if '=' in line)
token=credential.get('password');assert token,'Git credential unavailable'
def request(url,method='GET',data=None,ctype='application/json'):
    assert urllib.parse.urlparse(url).hostname in ('api.github.com','uploads.github.com')
    body=json.dumps(data,ensure_ascii=False).encode() if isinstance(data,dict) else data
    req=urllib.request.Request(url,data=body,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':ctype,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Pleorder-contest-publisher'})
    with urllib.request.urlopen(req,timeout=180) as response:return json.load(response)
base='https://api.github.com/repos/'+repo
try:release=request(base+'/releases/tags/'+tag)
except urllib.error.HTTPError as e:
    if e.code!=404:raise SystemExit('GitHub release read failed: '+str(e.code))
    pending=request(base+'/releases?per_page=100')
    release=next((item for item in pending if item['tag_name']==tag and item['draft']),None)
    if release is None:
        notes=a.notes_file.read_text(encoding='utf-8') if a.notes_file else '플레오더 공모전 제출본입니다. 설치용 APK와 시연 영상, 기획서 및 SHA-256을 아래에서 받을 수 있습니다.'
        release=request(base+'/releases','POST',{'tag_name':tag,'target_commitish':a.commit,'name':'플레오더 공모전 제출본 · '+tag.removeprefix('contest-'),'draft':a.draft or a.latest,'prerelease':not a.latest,'body':notes})
if release['draft'] and release['target_commitish']!=a.commit:
    raise SystemExit('Staged release points at a different commit.')
apk=ROOT/'apk/플레오더_플레오더_release.apk'
bundle=ROOT/'.cache/submission/pleorder_release.zip';bundle.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
    z.write(apk,apk.name)
files=[(apk,'pleorder_pleorder_release.apk'),(ROOT/'산출물/02_시연영상/플레오더_전체기능시연.mp4','pleorder_demo.mp4'),(ROOT/'산출물/01_기획서/플레오더_기획서.pdf','pleorder_proposal.pdf'),(ROOT/'산출물/03_검증자료/SHA256SUMS.txt','SHA256SUMS.txt'),(bundle,'pleorder_release.zip')]
if a.include_films:
    films=ROOT/'산출물/02_시연영상'
    files.extend([(films/'플레오더_대표시연.mp4','pleorder_film_1080p.mp4'),
                  (films/'플레오더_Gleo_실기시연.mp4','pleorder_gleo.mp4')])
if a.shortform:
    files.append((ROOT/'산출물/02_시연영상/플레오더_세로숏폼.mp4','pleorder_shortform_vertical.mp4'))
for f,remote_name in files:
    digest='sha256:'+hashlib.sha256(f.read_bytes()).hexdigest()
    existing=next((x for x in release['assets'] if x['name']==remote_name or x.get('label')==f.name),None)
    if existing:
        if existing.get('digest')!=digest:raise SystemExit('Existing release asset needs review before replacement: '+f.name)
        result=request(base+'/releases/assets/'+str(existing['id']),'PATCH',{'name':remote_name,'label':f.name})
        print('VERIFIED',result['name'],result['size'],flush=True)
        continue
    # GitHub normalizes Korean asset filenames; preserve the original in a ZIP.
    url=release['upload_url'].split('{')[0]+'?'+urllib.parse.urlencode({'name':remote_name,'label':f.name})
    result=request(url,'POST',f.read_bytes(),'application/octet-stream')
    if result.get('digest')!=digest:raise SystemExit('Uploaded asset checksum mismatch: '+f.name)
    print('UPLOADED',result['name'],result['size'],flush=True)
if a.latest and not a.draft:
    release=request(base+'/releases/'+str(release['id']),'PATCH',{'draft':False,'prerelease':False,'make_latest':'true'})
print('RELEASE_URL',release['html_url'],flush=True)
