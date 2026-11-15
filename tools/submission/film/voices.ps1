param([ValidateSet('driver','narrator','all')][string]$Role='all')
$ErrorActionPreference='Stop'
$film=$PSScriptRoot
$roles=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $film 'voices.json') | ConvertFrom-Json
$vault=Join-Path $env:LOCALAPPDATA 'Pleorder/credentials/elevenlabs.dpapi'
function Get-FilmApiKey {
    if ($env:ELEVENLABS_API_KEY) { return $env:ELEVENLABS_API_KEY }
    if (-not (Test-Path -LiteralPath $vault -PathType Leaf)) {
        throw "No saved voice credential at $vault for this Windows user."
    }
    $secure=ConvertTo-SecureString ([IO.File]::ReadAllText($vault))
    try { return [Net.NetworkCredential]::new('',$secure).Password }
    finally { $secure.Dispose() }
}
$headers=@{}
$utf8=[Text.UTF8Encoding]::new($false)
try {
    foreach($entry in $roles.psobject.Properties){
        if($Role -ne 'all' -and $entry.Name -ne $Role){continue}
        $voice=$entry.Value
        $out=Join-Path $film ('narration/'+$entry.Name)
        [void][IO.Directory]::CreateDirectory($out)
        foreach($part in $voice.lines.psobject.Properties){
            $phrases=@($part.Value)
            $spoken=@($phrases|ForEach-Object {$_.Replace('플레오더','플레 오더').Replace('Gleo','글레오')})
            $words=$spoken -join ' '
            $body=[ordered]@{text=$words;model_id='eleven_multilingual_v2';language_code='ko';voice_settings=$voice.settings} | ConvertTo-Json -Compress -Depth 6
            $hashBytes=[Security.Cryptography.SHA256]::Create().ComputeHash($utf8.GetBytes($voice.id+$body))
            $hash=[BitConverter]::ToString($hashBytes).Replace('-','').ToLowerInvariant()
            $mp3=Join-Path $out ($part.Name+'.mp3')
            $meta=Join-Path $out ($part.Name+'.json')
            if((Test-Path -LiteralPath $meta) -and (Test-Path -LiteralPath $mp3)){
                $previous=Get-Content -Raw -Encoding UTF8 -LiteralPath $meta | ConvertFrom-Json
                if($previous.sourceHash -eq $hash){continue}
            }
            if (-not $headers.Count) { $headers['xi-api-key']=Get-FilmApiKey }
            $uri='https://api.elevenlabs.io/v1/text-to-speech/'+$voice.id+'/with-timestamps?output_format=mp3_44100_128'
            try{$result=Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $utf8.GetBytes($body) -MaximumRedirection 0 -TimeoutSec 90}
            catch{throw ('ElevenLabs returned HTTP '+[int]$_.Exception.Response.StatusCode+' for '+$part.Name)}
            $ali=$result.alignment
            if(-not $result.audio_base64 -or ($ali.characters -join '') -cne $words){throw ('Missing alignment for '+$part.Name)}
            $pos=0
            $cues=@(for($idx=0;$idx -lt $spoken.Count;$idx++){
                $last=$pos+$spoken[$idx].Length-1
                [ordered]@{text=$phrases[$idx];startMs=[int][Math]::Round($ali.character_start_times_seconds[$pos]*1000);endMs=[int][Math]::Round($ali.character_end_times_seconds[$last]*1000);timestampMs=$null;confidence=$null}
                $pos=$last+2
            })
            [IO.File]::WriteAllBytes($mp3,[Convert]::FromBase64String($result.audio_base64))
            $data=[ordered]@{voice=$voice.name;sourceHash=$hash;cues=$cues}
            [IO.File]::WriteAllText($meta,($data|ConvertTo-Json -Depth 7),$utf8)
            Write-Output ($entry.Name+' '+$part.Name+' '+$cues[-1].endMs+' ms')
        }
    }
}finally{$headers.Clear()}
