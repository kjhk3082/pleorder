$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$destination=Join-Path (Split-Path -Parent $PSScriptRoot) '..\.cache\submission\voice'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Heami Desktop')
$speaker.Rate=-1
$format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
$phrases=@{order='비빔밥 한 개 배달해 줘';confirm='결제 승인';status='주문 상태 알려 줘';place='롯데호텔 서울';detail='구백구십구 동 구천구백구십구 호'}
try {
 foreach($name in $phrases.Keys){
  $speaker.SetOutputToWaveFile((Join-Path $destination ($name+'.wav')),$format)
  $speaker.Speak($phrases[$name]);$speaker.SetOutputToNull()
 }
} finally {$speaker.Dispose()}
