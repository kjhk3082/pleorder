"""Capture actual emulator speaker PCM through the documented streamAudio RPC."""
import argparse, os, pathlib, sys, time, wave
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'.cache/voice-python'))
import grpc
from google.protobuf import descriptor_pb2,descriptor_pool,message_factory
p=argparse.ArgumentParser();p.add_argument('output');p.add_argument('--seconds',type=float,default=70);p.add_argument('--serial',default='5556');p.add_argument('--rate',type=int,default=16000);p.add_argument('--stop-file',type=pathlib.Path);a=p.parse_args()
configs=[]
for f in (pathlib.Path(os.environ['LOCALAPPDATA'])/'Temp/avd/running').glob('pid_*.ini'):
    c=dict(x.split('=',1) for x in f.read_text().splitlines() if '=' in x)
    if c.get('port.serial')==a.serial and c.get('grpc.port'):configs.append(c)
if len(configs)!=1:raise SystemExit('Select one emulator')
c=configs[0];fd=descriptor_pb2.FileDescriptorProto(name='capture_audio.proto',package='android.emulation.control',syntax='proto3')
for name,fields in [('AudioFormat',[('samplingRate',1,4,''),('channels',2,13,''),('format',3,13,''),('mode',4,13,'')]),('AudioPacket',[('format',1,11,'.android.emulation.control.AudioFormat'),('timestamp',2,4,''),('audio',3,12,'')])]:
    m=fd.message_type.add(name=name)
    for name,num,kind,type_name in fields:
        f=m.field.add(name=name,number=num,type=kind,label=1)
        if type_name:f.type_name=type_name
pool=descriptor_pool.DescriptorPool();pool.Add(fd)
Format=message_factory.GetMessageClass(pool.FindMessageTypeByName('android.emulation.control.AudioFormat'))
Packet=message_factory.GetMessageClass(pool.FindMessageTypeByName('android.emulation.control.AudioPacket'))
rate=a.rate;result=bytearray(int(a.seconds*rate)*2);end=0;packets=0;start=time.monotonic()
first_timestamp=None
first_offset=0
previous_timestamp=None
with grpc.insecure_channel('127.0.0.1:'+c['grpc.port']) as channel:
    stream=channel.unary_stream('/android.emulation.control.EmulatorController/streamAudio',request_serializer=lambda m:m.SerializeToString(),response_deserializer=Packet.FromString)
    try:
        for packet in stream(Format(samplingRate=rate,format=1),metadata=(('authorization','Bearer '+c['grpc.token']),),timeout=a.seconds):
            if a.stop_file and a.stop_file.exists():break
            # AudioPacket.timestamp is the device capture time in microseconds. Network
            # delivery jitter must not create zero samples between adjacent voice packets.
            if first_timestamp is None:
                first_timestamp=packet.timestamp
                first_offset=max(0,round((time.monotonic()-start)*rate)*2-len(packet.audio))
            target=end
            if previous_timestamp is None or packet.timestamp-previous_timestamp>240000:
                target=max(end,first_offset+round((packet.timestamp-first_timestamp)*rate/1e6)*2)
            previous_timestamp=packet.timestamp
            n=min(len(packet.audio),len(result)-target)
            if n>0:result[target:target+n]=packet.audio[:n];end=target+n;packets+=1
    except grpc.RpcError as e:
        if e.code()!=grpc.StatusCode.DEADLINE_EXCEEDED:raise
with wave.open(a.output,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(result)
print('SPEAKER_CAPTURE_PACKETS',packets)
