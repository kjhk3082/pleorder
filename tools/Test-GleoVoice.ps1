param([string]$ArtifactDirectory='.cache/gleo-e2e',[switch]$Background,[ValidateSet('delivery','pickup','card-retry','reject')][string]$Case='delivery')
$ErrorActionPreference='Stop'
$adb=Join-Path $env:USERPROFILE 'Android/Sdk/platform-tools/adb.exe'
New-Item -ItemType Directory -Force $ArtifactDirectory | Out-Null
$expressionFile=Join-Path $ArtifactDirectory 'expression.js'
function Invoke-Device([string]$Expression){
    $processId=''
    for($attempt=0;$attempt -lt 20 -and -not $processId;$attempt++){
        $processId=([string](& $adb -s emulator-5554 shell pidof dev.pleorder.app)).Trim()
        if(-not $processId){Start-Sleep -Milliseconds 500}
    }
    if(-not $processId){throw 'Pleorder process is not running'}
    & $adb -s emulator-5554 forward tcp:9223 ('localabstract:webview_devtools_remote_'+$processId) | Out-Null
    [IO.File]::WriteAllText((Join-Path (Get-Location) $expressionFile),$Expression)
    $output=& node tools/device-eval.cjs --file $expressionFile
    if($LASTEXITCODE -ne 0){throw 'Device evaluation failed'}
    return ($output -join "`n" | ConvertFrom-Json)
}
function Read-TestState {
    Invoke-Device '(()=>{const r=JSON.parse(Native.loadState());return {draft:r.draft?.id,total:r.draft?.total,orders:r.orders.length,transactions:r.payments.transactions.length,selectedCard:r.payments.selected,stage:r.orders[0]?.stage,payment:r.orders[0]?.payment?.status,orderTotal:r.orders[0]?.total,mode:r.orders[0]?.mode}})()'
}
$originalState=Invoke-Device 'new Promise((resolve,reject)=>{const started=Date.now();const check=()=>{if(window.Pleorder)resolve(Native.loadState());else if(Date.now()-started>8000)reject(Error("Pleorder not ready"));else setTimeout(check,100)};check()})'
$original=$originalState|ConvertFrom-Json
if($original.version -ne 1 -or -not $original.payments.methods){throw 'Invalid original state'}
$backupPath=Join-Path (Get-Location) (Join-Path $ArtifactDirectory 'original-state.json')
[IO.File]::WriteAllText($backupPath,$originalState)
if([IO.File]::ReadAllText($backupPath) -cne $originalState){throw 'Backup verification failed'}
Write-Output 'Verified complete original-state backup; restoration is guaranteed by finally.'
try {
    Invoke-Device @'
(()=>{const base=JSON.parse(Native.loadState());const r=new PleorderCore.OrderRepository();Object.assign(r,{origin:base.origin,home:base.home,savedPlaces:base.savedPlaces,routeMetrics:base.routeMetrics});r.preferences={...base.preferences,catalogMode:'real'};r.simulation={paused:true,rate:1,savedWall:Date.now()};Native.saveState(r.serialize());Pleorder.receiveNative({type:'external-state',state:r.serialize()});return {orders:r.orders.length,card:r.payments.selected};})()
'@ | ConvertTo-Json -Compress | Write-Output
    if($Background){& $adb -s emulator-5554 shell am start --user 10 -a android.settings.SETTINGS; Start-Sleep -Seconds 2}
    # Refresh the assistant's conversation against the empty, isolated test state.
    & python tools/emulator-audio-test.py .cache/voice/status.pcm --target gleo
    Start-Sleep -Seconds 7
    $steps=switch($Case){
        'pickup' {@('pickup','confirm','status')}
        'card-retry' {@('order','card-b','confirm','card-a','confirm','status')}
        'reject' {@('order','decline')}
        default {@('order','confirm','status')}
    }
    $step=0
    foreach($fixture in $steps){
        $step++
        & python tools/emulator-audio-test.py ('.cache/voice/'+$fixture+'.pcm') --target gleo
        if($LASTEXITCODE -ne 0){throw 'Audio injection failed'}
        Start-Sleep -Seconds 7
        $state=Read-TestState
        [IO.File]::WriteAllText((Join-Path (Get-Location) (Join-Path $ArtifactDirectory ($step.ToString()+'-'+$fixture+'-state.json'))),($state|ConvertTo-Json))
        Write-Output ($fixture+': '+($state|ConvertTo-Json -Compress))
        & node tools/device-eval.cjs --screenshot (Join-Path $ArtifactDirectory ($fixture+'.png'))
        & python -c "import subprocess,pathlib,sys;pathlib.Path(sys.argv[1]).write_bytes(subprocess.check_output([sys.argv[2],'-s','emulator-5554','exec-out','screencap','-p']))" (Join-Path $ArtifactDirectory ($fixture+'-system.png')) $adb
        if($fixture -in @('order','pickup') -and -not $state.draft){throw 'Gleo did not create a draft'}
        if($fixture -in @('card-a','card-b') -and $state.orders -ne 0){throw 'A card change must not create an order'}
        if($fixture -eq 'decline' -and ($state.orders -ne 0 -or $state.draft)){throw 'Gleo did not discard the unpaid order'}
        if($fixture -eq 'confirm'){
            if($Case -eq 'card-retry' -and $step -eq 3){if($state.orders -ne 0){throw 'Card B must be declined'}}
            elseif($state.orders -ne 1 -or $state.payment -ne 'paid'){throw 'Gleo did not approve exactly one payment'}
        }
        if($Case -eq 'pickup' -and $state.orders -gt 0 -and $state.mode -ne 'pickup'){throw 'Pickup became delivery'}
    }
} finally {
    $restored=[IO.File]::ReadAllText($backupPath)
    $expression='(()=>{const state='+($restored|ConvertTo-Json -Compress)+';Native.saveState(state);Pleorder.receiveNative({type:"external-state",state});return JSON.parse(Native.loadState()).orders.length})()'
    $count=Invoke-Device $expression
    if($count -ne $original.orders.Count){throw 'Restored order count mismatch'}
    Write-Output ('Original state restored; orders='+$count)
    if($Background){& $adb -s emulator-5554 shell am start --user 10 -n dev.pleorder.app/.DrivingActivity | Out-Null}
}
