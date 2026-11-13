param([switch]$Install, [switch]$Release)
$ErrorActionPreference='Stop'
$env:JAVA_HOME=Join-Path $env:USERPROFILE 'Android\jdk21\jdk-21.0.13.0.2+1'
$env:ANDROID_HOME=Join-Path $env:USERPROFILE 'Android\Sdk'
$sourceRoot=Split-Path -Parent $PSScriptRoot
$buildRoot=Join-Path $env:USERPROFILE 'Android\projects\Pleorder'
foreach($item in @('settings.gradle','build.gradle','gradle.properties','app')){
 $source=Join-Path $sourceRoot $item
 foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
  if($file.FullName -match '\\(build|\.gradle)\\'){continue}
  $relative=$file.FullName.Substring($sourceRoot.Length).TrimStart([char]'\',[char]'/')
  $destination=Join-Path $buildRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination)|Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
 }
}
# Never copy an entire local credential object into assets. Only this public ID.
$mapConfig=Join-Path $sourceRoot '.local\naver-maps.json'
$localCertificate=Join-Path $sourceRoot '.local\preview-cert.pem'
$debugRoot=Join-Path $buildRoot 'app\src\debug'
if(!(Test-Path -LiteralPath $localCertificate) -and (Test-Path -LiteralPath (Join-Path $debugRoot 'res\xml\pleorder_debug_network.xml'))){
 [IO.File]::WriteAllText((Join-Path $debugRoot 'AndroidManifest.xml'),'<manifest xmlns:android="http://schemas.android.com/apk/res/android" />')
}
if(Test-Path -LiteralPath $mapConfig){
 $mapId=[string]((Get-Content -LiteralPath $mapConfig -Raw | ConvertFrom-Json).naverClientId)
 if($mapId -notmatch '^[a-zA-Z0-9_-]{5,80}$'){throw 'Invalid public Naver Maps ID'}
 $publicMap=@{naverClientId=$mapId}
 if((Test-Path -LiteralPath $localCertificate) -and !$Release){
  $publicMap.routeEndpoint='https://10.0.2.2:4174/api/directions'
  # Trust this local certificate only for the emulator's host, in debug builds.
  $debugRoot=Join-Path $buildRoot 'app\src\debug'
  New-Item -ItemType Directory -Force -Path (Join-Path $debugRoot 'res\raw'),(Join-Path $debugRoot 'res\xml') | Out-Null
  Copy-Item -LiteralPath $localCertificate -Destination (Join-Path $debugRoot 'res\raw\pleorder_local_ca.pem') -Force
  [IO.File]::WriteAllText((Join-Path $debugRoot 'AndroidManifest.xml'),'<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:networkSecurityConfig="@xml/pleorder_debug_network" /></manifest>')
  [IO.File]::WriteAllText((Join-Path $debugRoot 'res\xml\pleorder_debug_network.xml'),'<network-security-config><domain-config cleartextTrafficPermitted="false"><domain>10.0.2.2</domain><trust-anchors><certificates src="@raw/pleorder_local_ca" /></trust-anchors></domain-config></network-security-config>')
 }
 $publicConfig=$publicMap | ConvertTo-Json -Compress
 [IO.File]::WriteAllText((Join-Path $buildRoot 'app\src\main\assets\web\map-config.json'),$publicConfig)
}
$gradle=Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.11.1-bin\bpt9gzteqjrbo1mjrsomdt32c\gradle-8.11.1\bin\gradle.bat'
$variant=if($Release){'release'}else{'debug'}
$task=if($Release){':app:assembleRelease'}else{':app:assembleDebug'}
& $gradle -p $buildRoot $task --no-daemon --console=plain
if($LASTEXITCODE -ne 0){throw 'Pleorder build failed'}
$apk=Join-Path $buildRoot "app\build\outputs\apk\$variant\app-$variant.apk"
if($Release){
 $releasePath=Join-Path $sourceRoot 'apk\플레오더_플레오더_release.apk'
 New-Item -ItemType Directory -Force -Path (Split-Path -Parent $releasePath)|Out-Null
 Copy-Item -LiteralPath $apk -Destination $releasePath -Force
}
Write-Output "PLEORDER_APK=$apk"
if($Install){
 $adb=Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
 & $adb -s emulator-5554 install -r $apk
 if($LASTEXITCODE -ne 0){throw 'Install failed'}
 # Recreate old tasks so Pleos re-evaluates the updated Activity metadata.
 & $adb -s emulator-5554 shell am force-stop --user current dev.pleorder.app
 & $adb -s emulator-5554 shell am start --user current -W -n dev.pleorder.app/.DrivingActivity
}
