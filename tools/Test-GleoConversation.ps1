param([ValidateSet('conversation','reservation','usual','multi','negative')][string]$Case='conversation',[switch]$Background)
$ErrorActionPreference='Stop'
$adb=Join-Path $env:USERPROFILE 'Android/Sdk/platform-tools/adb.exe'
$artifact=Join-Path (Get-Location) ('.cache/gleo-team-'+$Case)
New-Item -ItemType Directory -Force $artifact | Out-Null
function Eval([string]$Code){
 $appProcess=([string](& $adb -s emulator-5554 shell pidof dev.pleorder.app)).Trim()
 & $adb -s emulator-5554 forward tcp:9223 ('localabstract:webview_devtools_remote_'+$appProcess) | Out-Null
 $file=Join-Path $artifact 'expression.js';[IO.File]::WriteAllText($file,$Code)
 $out=& node tools/device-eval.cjs --file $file
 if($LASTEXITCODE -ne 0){throw 'App evaluation failed'}
 return ($out -join "`n"|ConvertFrom-Json)
}
function State { Eval '(()=>{const r=JSON.parse(Native.loadState());return {draft:r.draft?.id,quantity:r.draft?.items[0]?.quantity,option:r.draft?.items[0]?.options?.[0]?.id,total:r.draft?.total,stage:r.orders[0]?.stage,orderTotal:r.orders[0]?.total,orders:r.orders.length,transactions:r.payments.transactions.length,conversation:r.conversation?.stage,submitted:r.orders[0]?.submittedAt,payment:r.orders[0]?.payment?.status}})()' }
$backup=Eval 'Native.loadState()';$parsed=$backup|ConvertFrom-Json
if($parsed.version -ne 1){throw 'Invalid backup'}
[IO.File]::WriteAllText((Join-Path $artifact 'original-state.json'),$backup)
if([IO.File]::ReadAllText((Join-Path $artifact 'original-state.json')) -cne $backup){throw 'Backup mismatch'}
$fixtures=@{
 recommend='플레오더 집 주변 비빔밥 가게 추천해 줘';
 choose='플레오더 방금 안내한 목록에서 일 번으로 골라 줘';
 chooseOption='플레오더 방금 옵션 중에서 이 번을 골라 줘';
 quantity='플레오더 담아 둔 비빔밥 수량을 두 개로 바꿔 줘';
 confirm='플레오더 주문 결제 승인해 줘';
 status='플레오더 주문 상태 알려 줘';
 negative='플레오더 담아 둔 주문은 결제하지 말고 취소해 줘';
 order='플레오더 비빔밥 한 개 집으로 배달해 줘';
 reserve='플레오더 비빔밥 한 개 집으로 배달해 줘. 집 도착 시간에 맞춰 주문 예약해 줘';
 usual='플레오더 앱에서 평소에 자주 먹던 메뉴로 새 주문을 담아 줘';
 burger='플레오더 코너버거에서 치즈버거 한 개 새로 배달 주문해 줘';
 target='플레오더 코너버거 주문 번호 알려 줘'
}
Add-Type -AssemblyName System.Speech
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice=$speaker.GetInstalledVoices()|Where-Object {$_.VoiceInfo.Culture.Name -eq 'ko-KR'}|Select-Object -First 1
$speaker.SelectVoice($voice.VoiceInfo.Name)
$format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
try {
 foreach($name in $fixtures.Keys){
  $wav=Join-Path $artifact ($name+'.wav');$speaker.SetOutputToWaveFile($wav,$format);$speaker.Speak($fixtures[$name]);$speaker.SetOutputToNull()
  $reader=New-Object IO.BinaryReader([IO.File]::OpenRead($wav))
  try{$reader.BaseStream.Position=12;while($reader.BaseStream.Position -lt $reader.BaseStream.Length){$id=[Text.Encoding]::ASCII.GetString($reader.ReadBytes(4));$count=$reader.ReadInt32();if($id -eq 'data'){[IO.File]::WriteAllBytes((Join-Path $artifact ($name+'.pcm')),$reader.ReadBytes($count));break};$reader.BaseStream.Position+=$count+($count%2)}}finally{$reader.Dispose()}
 }
 $reservationSeed=if($Case -eq 'reservation'){'r.origin={id:"qa-origin",name:"테스트 출발지",lat:37.45,lng:126.7};r.preferences.locationSource="manual";r.routeMetrics={home:{key:[r.origin,r.home].map(p=>p.lat.toFixed(5)+","+p.lng.toFixed(5)).join(";"),etaAt:r.clock+3600000,duration:3600,distance:55000}};'}else{''}
 $seed=if($Case -eq 'usual'){3}else{0}
 Eval ('(()=>{const r=new PleorderCore.OrderRepository();r.preferences.catalogMode="demo";r.homeMinutes=60;'+$reservationSeed+'for(let i=0;i<'+$seed+';i++){r.prepare({items:[{menuId:"bibimbap",quantity:1}],mode:"delivery"});r.confirm(r.draft.id,true);r.advance(80);}r.startedAt=r.clock;r.simulation={paused:true,rate:1,savedWall:Date.now()};Native.saveState(r.serialize());Pleorder.receiveNative({type:"external-state",state:r.serialize()});return r.orders.length})()') | Out-Null
 if($Background){& $adb -s emulator-5554 shell am start --user current -a android.settings.SETTINGS | Out-Null}
 $steps=switch($Case){
  'conversation' {@('recommend','choose','choose','chooseOption','quantity','confirm','status')}
  'reservation' {@('reserve','confirm','status')}
  'usual' {@('usual','confirm','status')}
  'multi' {@('order','confirm','burger','confirm','target','status')}
  'negative' {@('order','negative')}
 }
 $index=0
 foreach($step in $steps){
  $index++
  $beforeCallback=(& $adb -s emulator-5554 logcat -d -s PleorderGleo:I | Select-String "CALLBACK .*status=" | Select-Object -Last 1).Line
  & python tools/emulator-audio-test.py (Join-Path $artifact ($step+'.pcm')) --target gleo
  if($LASTEXITCODE -ne 0){throw 'Microphone injection failed'}
  Start-Sleep -Seconds 8
  $afterCallback=(& $adb -s emulator-5554 logcat -d -s PleorderGleo:I | Select-String "CALLBACK .*status=" | Select-Object -Last 1).Line
  if(!$afterCallback -or $afterCallback -eq $beforeCallback -or $afterCallback -match "status=fail"){throw ("Gleo did not complete the app action: "+$step)}
  $s=State
  $s|ConvertTo-Json -Compress|Write-Output
  [IO.File]::WriteAllText((Join-Path $artifact ("$index-$step.json")),($s|ConvertTo-Json))
  & $adb -s emulator-5554 logcat -d -s PleorderGleo:I PleorderWeb:E PleorderNavi:I AndroidRuntime:E > (Join-Path $artifact 'app-log.txt')
  if($step -eq 'recommend' -and $s.conversation -ne 'stores'){throw 'Restaurant conversation did not start'}
  if($Case -eq 'conversation' -and $index -eq 2 -and $s.conversation -ne 'menus'){throw 'Restaurant selection did not open menus'}
  if($Case -eq 'conversation' -and $index -eq 3 -and $s.conversation -ne 'options'){throw 'Menu selection did not open options'}
  if($step -eq 'chooseOption' -and $s.option -ne 'none'){throw 'Requested option not selected'}
  if($step -eq 'quantity' -and ($s.quantity -ne 2 -or $s.total -ne 23000)){throw 'Quantity amendment failed'}
  if($step -in @('order','burger','reserve','usual') -and -not $s.draft){throw 'Expected draft missing'}
  if($step -eq 'negative' -and ($s.draft -or $s.orders -or $s.transactions)){throw 'Negative utterance caused an order/payment'}
  if($step -eq 'confirm'){
   $expected=if($Case -eq 'usual'){4}elseif($Case -eq 'multi' -and $index -eq 4){2}else{1}
   if($s.orders -ne $expected -or $s.payment -ne 'paid'){throw 'Payment was not approved exactly once'}
   if($Case -eq 'reservation' -and ($s.stage -ne 'reserved' -or $null -ne $s.submitted)){throw 'Reservation submitted prematurely'}
  }
 }
 if($Case -eq 'reservation' -and $Background){
  Eval '(()=>{const r=JSON.parse(Native.loadState());r.clock=r.orders[0].startAt-3000;r.simulation={paused:false,rate:1,savedWall:Date.now()};Native.saveState(JSON.stringify(r));Pleorder.receiveNative({type:"external-state",state:JSON.stringify(r)});return true})()' | Out-Null
  Start-Sleep -Seconds 10
  $tracking=Eval '(()=>{const r=JSON.parse(Native.loadState());return {submitted:r.orders[0].submittedAt,events:r.orders[0].events.filter(e=>e.kind==="submitted").length,transactions:r.payments.transactions.length}})()'
  if(!$tracking.submitted -or $tracking.events -ne 1 -or $tracking.transactions -ne 1){throw 'Background scheduler did not dispatch exactly once'}
  $tracking|ConvertTo-Json -Compress|Write-Output
 }
 Write-Output ('VOICE_CASE_PASS='+$Case)
} finally {
 $speaker.Dispose()
 Eval ('(()=>{const s='+($backup|ConvertTo-Json -Compress)+';Native.saveState(s);Pleorder.receiveNative({type:"external-state",state:s});return JSON.parse(Native.loadState()).orders.length})()') | Out-Null
 Write-Output 'Original app state restored.'
 if($Background){& $adb -s emulator-5554 shell am start --user current -n dev.pleorder.app/.DrivingActivity | Out-Null}
}
