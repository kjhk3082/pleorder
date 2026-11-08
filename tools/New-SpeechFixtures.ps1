param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
if(-not $OutputDirectory){$OutputDirectory=Join-Path (Split-Path -Parent $PSScriptRoot) '.cache\voice'}
New-Item -ItemType Directory -Force -Path $OutputDirectory|Out-Null
Add-Type -AssemblyName System.Speech
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice=$speaker.GetInstalledVoices()|Where-Object {$_.VoiceInfo.Culture.Name -eq 'ko-KR'}|Select-Object -First 1
if(-not $voice){throw 'A Korean Windows speech voice is required for synthesized QA fixtures.'}
$speaker.SelectVoice($voice.VoiceInfo.Name)
$format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
foreach($entry in @(@('order','플레오더에서 새 주문을 시작해 줘. 치킨 한 마리 집으로 배달해 줘'),@('pickup','플레오더에서 치킨 한 마리 새로 주문해 줘. 가게에서 직접 픽업할게'),@('confirm','플레오더 주문 결제 승인해 줘'),@('status','플레오더 주문 상태 알려 줘'),@('decline','플레오더 주문 결제하지 마. 담아 둔 주문 취소해 줘'),@('card-a','플레오더 주문 결제 카드를 에이 카드로 바꿔 줘'),@('card-b','플레오더 주문 결제 카드를 비 카드로 바꿔 줘'),@('cancel','플레오더 주문 취소'))){
 $wav=Join-Path $OutputDirectory ($entry[0]+'.wav');$pcm=Join-Path $OutputDirectory ($entry[0]+'.pcm')
 $speaker.SetOutputToWaveFile($wav,$format);$speaker.Speak($entry[1]);$speaker.SetOutputToNull()
 $reader=New-Object IO.BinaryReader([IO.File]::OpenRead($wav));try{$reader.BaseStream.Position=12;while($reader.BaseStream.Position -lt $reader.BaseStream.Length){$id=[Text.Encoding]::ASCII.GetString($reader.ReadBytes(4));$count=$reader.ReadInt32();if($id -eq 'data'){[IO.File]::WriteAllBytes($pcm,$reader.ReadBytes($count));break};$reader.BaseStream.Position+=$count+($count%2)}}finally{$reader.Dispose()}
 Write-Output ('QA_FIXTURE='+$pcm)
}
$speaker.Dispose()
