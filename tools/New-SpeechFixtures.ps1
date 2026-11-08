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
foreach($entry in @(@('order','비빔밥 한 개 집으로 배달해 줘'),@('confirm','이대로 주문'))){
 $wav=Join-Path $OutputDirectory ($entry[0]+'.wav');$pcm=Join-Path $OutputDirectory ($entry[0]+'.pcm')
 $speaker.SetOutputToWaveFile($wav,$format);$speaker.Speak($entry[1]);$speaker.SetOutputToNull()
 $reader=New-Object IO.BinaryReader([IO.File]::OpenRead($wav));try{$reader.BaseStream.Position=12;while($reader.BaseStream.Position -lt $reader.BaseStream.Length){$id=[Text.Encoding]::ASCII.GetString($reader.ReadBytes(4));$count=$reader.ReadInt32();if($id -eq 'data'){[IO.File]::WriteAllBytes($pcm,$reader.ReadBytes($count));break};$reader.BaseStream.Position+=$count+($count%2)}}finally{$reader.Dispose()}
 Write-Output ('QA_FIXTURE='+$pcm)
}
$speaker.Dispose()
