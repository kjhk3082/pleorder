"""Upload README media without posting an issue/comment.

Uses the same endpoint as github/cli internal/attachments/client.go (v2.103.3).
Credentials stay in memory; returned repository-scoped URL is safe for Markdown.
"""
import argparse,json,os,pathlib,subprocess,urllib.request,urllib.parse
p=argparse.ArgumentParser();p.add_argument('video');p.add_argument('--output',required=True);a=p.parse_args()
video=pathlib.Path(a.video)
if video.stat().st_size>10_000_000:raise SystemExit('Use an H.264 preview below the free-plan 10 MB limit')
c=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'})
token=dict(x.split('=',1) for x in c.stdout.splitlines() if '=' in x)['password']
def request(url,data=None):
    assert urllib.parse.urlparse(url).hostname in ['api.github.com','uploads.github.com']
    r=urllib.request.Request(url,data=data,headers={'Authorization':'Bearer '+token,'Content-Type':'application/octet-stream','Accept':'application/vnd.github+json','User-Agent':'Pleorder-media-publisher'})
    with urllib.request.urlopen(r,timeout=120) as response:return json.load(response)
repo=request('https://api.github.com/repos/kjhk3082/pleorder')
assert repo.get('permissions',{}).get('push'),'Repository write permission required'
url='https://uploads.github.com/user-attachments/assets?'+urllib.parse.urlencode({'name':video.name,'content_type':'video/mp4','repository_id':repo['id']})
result=request(url,video.read_bytes());asset=result['url']
assert asset.startswith('https://github.com/user-attachments/assets/')
pathlib.Path(a.output).write_text(json.dumps({'url':asset,'source':str(video),'size':video.stat().st_size},ensure_ascii=False,indent=2),encoding='utf-8')
print(asset)
