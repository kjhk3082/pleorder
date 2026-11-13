"""Record the release APK with official emulator console gear/speed controls."""
import pathlib,subprocess,urllib.request,json,threading,time,os
root=pathlib.Path(__file__).resolve().parents[2];out=root/'.cache/submission'
adb=str(pathlib.Path(os.environ['USERPROFILE'])/'Android/Sdk/platform-tools/adb.exe')
def ad(*args,timeout=15):return subprocess.check_output([adb,'-s','emulator-5556',*args],timeout=timeout)
def api(path,method='GET'):
    with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8088'+path,method=method),timeout=5) as r:return json.load(r)
done=threading.Event()
def heartbeat():
    while not done.is_set():
        try:api('/browser/session?client=pleorder-submission-qa','POST')
        except Exception:pass
        done.wait(.8)
thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
try:
    time.sleep(5)
    (out/'release-parked.png').write_bytes(ad('exec-out','screencap','-p'))
    recorder=subprocess.Popen([adb,'-s','emulator-5556','shell','screenrecord','--size','1920x1080','--bit-rate','5000000','--time-limit','30','/sdcard/pleorder-driving.mp4'])
    time.sleep(3);api('/vehicle/gear?gear=Drive','PUT');time.sleep(5)
    for name in ['idle','moving']:
        if name=='moving':api('/vehicle/controls?speed=30&accelerator=0&brake=0&steering=0','PUT');time.sleep(3)
        state=api('/vehicle/state');print(name,json.dumps({'gear':state.get('gear',{}).get('actual'),'speed':state.get('controls',{}).get('speed_kph')},ensure_ascii=False),flush=True)
        (out/('release-'+name+'.png')).write_bytes(ad('exec-out','screencap','-p'))
        (out/('release-'+name+'-ux.txt')).write_bytes(ad('shell','dumpsys','car_service','--services','CarUxRestrictionsManagerService'))
        time.sleep(4)
    api('/vehicle/controls?speed=0&accelerator=0&brake=0&steering=0','PUT');api('/vehicle/gear?gear=Park','PUT')
    recorder.wait(timeout=35)
    ad('pull','/sdcard/pleorder-driving.mp4',str(out/'recordings/16-driving.mp4'))
    ad('shell','rm','/sdcard/pleorder-driving.mp4')
    print('RELEASE_DRIVING_CAPTURED',flush=True)
finally:
    try:
        api('/vehicle/controls?speed=0&accelerator=0&brake=0&steering=0','PUT');api('/vehicle/gear?gear=Park','PUT');api('/browser/session?client=pleorder-submission-qa&closing=1','POST')
    except Exception:pass
    done.set();thread.join(timeout=2)
