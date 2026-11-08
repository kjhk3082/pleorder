param([switch]$Install)
$ErrorActionPreference='Stop'
$env:JAVA_HOME=Join-Path $env:USERPROFILE 'Android\jdk21\jdk-21.0.13.0.2+1'
$env:ANDROID_HOME=Join-Path $env:USERPROFILE 'Android\Sdk'
$sourceRoot=Split-Path -Parent $PSScriptRoot
$buildRoot=Join-Path $env:USERPROFILE 'Android\projects\Pleorder'
foreach($item in @('settings.gradle','build.gradle','gradle.properties','app')){
 $source=Join-Path $sourceRoot $item
 foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
  if($file.FullName -match '\\(build|\.gradle)\\'){continue}
  $relative=[IO.Path]::GetRelativePath($sourceRoot,$file.FullName)
  $destination=Join-Path $buildRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination)|Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
 }
}
$gradle=Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.11.1-bin\bpt9gzteqjrbo1mjrsomdt32c\gradle-8.11.1\bin\gradle.bat'
& $gradle -p $buildRoot :app:assembleDebug --no-daemon --console=plain
if($LASTEXITCODE -ne 0){throw 'Pleorder build failed'}
$apk=Join-Path $buildRoot 'app\build\outputs\apk\debug\app-debug.apk'
Write-Output "PLEORDER_APK=$apk"
if($Install){
 $adb=Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
 & $adb -s emulator-5554 install -r $apk
 if($LASTEXITCODE -ne 0){throw 'Install failed'}
 # Pleos caches each task's DO status. Recreate tasks after manifest updates.
 & $adb -s emulator-5554 shell am force-stop --user current dev.pleorder.app
 & $adb -s emulator-5554 shell am start --user current -W -n dev.pleorder.app/.DrivingActivity
}
