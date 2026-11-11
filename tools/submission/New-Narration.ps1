$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$destination=Join-Path $root '.cache\submission\narration'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'video-plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Heami Desktop');$speaker.Rate=0
$format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
try {
 foreach($chapter in $plan){
  if(!$chapter.narration){continue}
  $speaker.SetOutputToWaveFile((Join-Path $destination ($chapter.id+'.wav')),$format)
  $speaker.Speak($chapter.narration);$speaker.SetOutputToNull()
 }
} finally {$speaker.Dispose()}
