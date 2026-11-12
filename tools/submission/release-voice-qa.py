"""Exercise the non-debuggable APK using accessibility UI and emulator microphone.

No JS command injection or debug-only app hooks. Audio is synthetic test input.
"""
import argparse,os,pathlib,re,subprocess,time,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/submission/release-voice';OUT.mkdir(parents=True,exist_ok=True)
ADB=str(pathlib.Path(os.environ['USERPROFILE'])/'Android/Sdk/platform-tools/adb.exe')
SERIAL=os.environ.get('ANDROID_SERIAL','emulator-5556')
def adb(*args,timeout=20):
    return subprocess.check_output([ADB,'-s',SERIAL,*args],timeout=timeout)
def dump(name='ui'):
    raw=adb('exec-out','uiautomator','dump','/dev/tty',timeout=25).decode('utf-8',errors='replace')
    xml=raw[raw.index('<?xml'):raw.index('</hierarchy>')+12]
    (OUT/(name+'.xml')).write_text(xml,encoding='utf-8')
    return ET.fromstring(xml)
def summary(tree):
    for n in tree.iter('node'):
        a=n.attrib
        if a.get('text') or a.get('content-desc'):
            print(a.get('resource-id',''),a.get('text') or a.get('content-desc'),a.get('bounds',''),flush=True)
def tap(target):
    tree=dump()
    nodes=[n for n in tree.iter('node') if target in [n.get('resource-id'),n.get('text'),n.get('content-desc')]]
    nodes=[n for n in nodes if n.get('enabled')=='true']
    if not nodes:raise RuntimeError('UI target missing: '+target)
    n=nodes[0];x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    if x2<=x1 or y2<=y1:raise RuntimeError('UI target outside viewport: '+target)
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def screenshot(name):
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
def voice(name,target):
    ready=OUT/'microphone-ready'
    ready.unlink(missing_ok=True)
    emulator_serial=os.environ.get('PLEORDER_EMULATOR_SERIAL','emulator-5556')
    injector=subprocess.Popen([os.sys.executable,str(ROOT/'tools/emulator-audio-test.py'),str(ROOT/'.cache/submission/voice'/(name+'.pcm')),'--target','none','--serial',emulator_serial,'--ready-file',str(ready)])
    try:
        time.sleep(1)
        tap(target)
        deadline=time.monotonic()+20
        while time.monotonic()<deadline:
            tree=dump('ready')
            if any(n.get('text','').startswith('듣고 있어요') for n in tree.iter('node')):break
            time.sleep(.4)
        else:raise RuntimeError('Speech UI did not become ready')
        ready.touch()
        rc=injector.wait(timeout=35)
        print('INJECTOR_EXIT',rc,flush=True)
        time.sleep(4)
        summary(dump(name));screenshot(name)
        (OUT/(name+'.log')).write_bytes(adb('logcat','-d','PleorderSpeech:I','AndroidRuntime:E','*:S'))
        if rc:raise RuntimeError('Microphone injection failed; retained UI is not proof of success')
    finally:
        if injector.poll() is None:
            injector.terminate();injector.wait(timeout=5)
        ready.unlink(missing_ok=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['dump','tap','voice','screen']);p.add_argument('target',nargs='?',default='ui');p.add_argument('--button',default='micButton');a=p.parse_args()
    if a.action=='dump':summary(dump(a.target))
    elif a.action=='tap':tap(a.target)
    elif a.action=='screen':screenshot(a.target)
    else:voice(a.target,a.button)
