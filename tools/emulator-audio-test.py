"""Feed a synthesized 16-kHz mono S16 fixture through the emulator microphone.

Uses the installed emulator_controller.proto wire fields (AudioFormat/AudioPacket).
Local emulator authentication stays in memory. No cloud credentials are read.
Requires grpcio and protobuf. Start the AVD with -grpc 8554 -grpc-use-token.
"""
import argparse, os, pathlib, subprocess, threading, time, sys
local_deps=pathlib.Path(__file__).resolve().parent.parent/'.cache/voice-python'
if local_deps.is_dir():sys.path.insert(0,str(local_deps))
import grpc
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory, empty_pb2

p=argparse.ArgumentParser();p.add_argument('pcm');p.add_argument('--target',choices=['gleo','app','none'],default='gleo');p.add_argument('--tap',nargs=2);p.add_argument('--serial',default='emulator-5554');p.add_argument('--buffered',action='store_true');args=p.parse_args()
running=pathlib.Path(os.environ['LOCALAPPDATA'])/'Temp/avd/running'
configs=[]
for file in running.glob('pid_*.ini'):
    fields=dict(line.split('=',1) for line in file.read_text().splitlines() if '=' in line)
    if fields.get('port.serial')==args.serial.removeprefix('emulator-') and fields.get('grpc.port'):configs.append(fields)
if len(configs)!=1:raise SystemExit('Expected one authenticated emulator for '+args.serial)
config=configs[0];metadata=(('authorization','Bearer '+config['grpc.token']),)
fd=descriptor_pb2.FileDescriptorProto(name='audio_subset.proto',package='android.emulation.control',syntax='proto3')
for name,fields in [('AudioFormat',[('samplingRate',1,4,''),('channels',2,13,''),('format',3,13,''),('mode',4,13,'')]),('AudioPacket',[('format',1,11,'.android.emulation.control.AudioFormat'),('timestamp',2,4,''),('audio',3,12,'')])]:
    m=fd.message_type.add(name=name)
    for name,number,kind,type_name in fields:
        f=m.field.add(name=name,number=number,type=kind,label=1)
        if type_name:f.type_name=type_name
pool=descriptor_pool.DescriptorPool();pool.Add(fd)
Packet=message_factory.GetMessageClass(pool.FindMessageTypeByName('android.emulation.control.AudioPacket'))
data=b'\0'*25600+pathlib.Path(args.pcm).read_bytes()+b'\0'*64000
def packets():
    for offset in range(0,len(data),3200):
        packet=Packet(audio=data[offset:offset+3200],timestamp=int(time.time()*1e6))
        packet.format.samplingRate=16000;packet.format.format=1;packet.format.mode=0 if args.buffered else 1
        yield packet
        if not args.buffered:time.sleep(.1)
errors=[]
with grpc.insecure_channel('127.0.0.1:'+config['grpc.port']) as channel:
    inject=channel.stream_unary('/android.emulation.control.EmulatorController/injectAudio',request_serializer=lambda p:p.SerializeToString(),response_deserializer=empty_pb2.Empty.FromString)
    def feed():
        try:inject(packets(),metadata=metadata,timeout=20)
        except grpc.RpcError as e:errors.append(e.code().name)
    thread=threading.Thread(target=feed);thread.start();time.sleep(.2)
    adb=str(pathlib.Path(os.environ['USERPROFILE'])/'Android/Sdk/platform-tools/adb.exe')
    if args.target=='gleo':subprocess.run([adb,'-s',args.serial,'shell','cmd','voiceinteraction','show'],check=True,capture_output=True)
    elif args.target=='app':
        if not args.tap:raise SystemExit('--tap must be derived from a current UI tree')
        subprocess.run([adb,'-s',args.serial,'shell','input','tap',*args.tap],check=True,capture_output=True)
    thread.join()
if errors:raise SystemExit('AUDIO_INJECTION_FAILED '+','.join(errors))
print('AUDIO_INJECTED target='+args.target+' fixture='+pathlib.Path(args.pcm).name+' bytes='+str(len(data)))
