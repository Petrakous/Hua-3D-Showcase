[CmdletBinding()]
param(
    [string]$SourceStagingRoot = '',
    [switch]$Force,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$outputStagingRoot = Join-Path $repoRoot 'dist-r2-assets'

if ([string]::IsNullOrWhiteSpace($SourceStagingRoot)) {
    if (-not [string]::IsNullOrWhiteSpace($env:HUA_SOG_SOURCE_STAGING_ROOT)) {
        $SourceStagingRoot = $env:HUA_SOG_SOURCE_STAGING_ROOT
    } else {
        $SourceStagingRoot = $outputStagingRoot
    }
}

$SourceStagingRoot = [System.IO.Path]::GetFullPath($SourceStagingRoot)
$toolRoot = Join-Path $outputStagingRoot '.lod-tools'
$workRoot = Join-Path $outputStagingRoot '.lod-work'
$logRoot = Join-Path $outputStagingRoot 'lod-generation-logs'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logRoot "four-scene-lods-$timestamp.log"
$checkpointPath = Join-Path $logRoot 'four-scene-lods-checkpoint.json'

$scenes = @(
    [pscustomobject]@{
        Id = 'pc-lab'
        Label = 'PC Lab'
        SourceRelative = 'assets\dit\pc-lab\sog\source.sog'
        OutputRelative = 'assets\dit\pc-lab\generated_lods'
    },
    [pscustomobject]@{
        Id = 'ceremonial-hall'
        Label = 'Ceremonial Hall'
        SourceRelative = 'assets\indoors\ceremonial-hall\sog\source.sog'
        OutputRelative = 'assets\indoors\ceremonial-hall\generated_lods'
    },
    [pscustomobject]@{
        Id = 'geo-entrance'
        Label = 'GEO Entrance'
        SourceRelative = 'assets\indoors\geo-entrance\sog\source.sog'
        OutputRelative = 'assets\indoors\geo-entrance\generated_lods'
    },
    [pscustomobject]@{
        Id = 'library'
        Label = 'Library'
        SourceRelative = 'assets\indoors\library\sog\source.sog'
        OutputRelative = 'assets\indoors\library\generated_lods'
    }
)

# Smallest tiers first: a safe stop still leaves the most useful mobile files complete.
$tiers = @(
    [pscustomobject]@{ Name = 'lod4'; Percent = 5; Label = 'Fast' },
    [pscustomobject]@{ Name = 'lod3'; Percent = 10; Label = 'Light' },
    [pscustomobject]@{ Name = 'lod2'; Percent = 25; Label = 'Balanced' },
    [pscustomobject]@{ Name = 'lod1'; Percent = 50; Label = 'High' }
)

function Write-Step {
    param([string]$Message)
    $now = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$now] $Message" -ForegroundColor Cyan
}

function Read-SogMetadata {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "SOG file not found: $Path"
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $archive.Entries | Where-Object FullName -eq 'meta.json' | Select-Object -First 1
        if (-not $entry) {
            throw "SOG does not contain meta.json: $Path"
        }
        $reader = [System.IO.StreamReader]::new($entry.Open())
        try {
            $metadata = $reader.ReadToEnd() | ConvertFrom-Json
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }

    $file = Get-Item -LiteralPath $Path
    if ($file.Length -le 1024 -or [long]$metadata.count -le 0) {
        throw "Invalid SOG payload or Gaussian count: $Path"
    }

    return [pscustomobject]@{
        Count = [long]$metadata.count
        Bytes = [long]$file.Length
        Version = $metadata.version
    }
}

function Invoke-CheckedProcess {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$Description
    )

    Write-Step $Description
    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Description failed with exit code $exitCode"
    }
}

function Save-Checkpoint {
    param([array]$Completed, [string]$State, [string]$Message)

    $payload = [ordered]@{
        updatedAt = (Get-Date).ToString('o')
        state = $State
        message = $Message
        completed = $Completed
        logPath = $logPath
    }
    $payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $checkpointPath -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $outputStagingRoot, $toolRoot, $workRoot, $logRoot | Out-Null
Start-Transcript -LiteralPath $logPath -Force | Out-Null

$completed = @()
$sourceHashes = @{}
$exitCode = 0

try {
    Clear-Host
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ' HUA 3D - FOUR SCENE MOBILE LOD GENERATION' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'SAFE STOP: Press Ctrl+C once.' -ForegroundColor Yellow
    Write-Host 'Completed .sog files remain valid. Only the active tier is retried next time.' -ForegroundColor Yellow
    Write-Host 'Original source.sog files are opened read-only and are never overwritten.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host "Log: $logPath"
    Write-Host "Checkpoint: $checkpointPath"
    Write-Host ''

    foreach ($scene in $scenes) {
        $sourcePath = Join-Path $SourceStagingRoot $scene.SourceRelative
        $sourceMeta = Read-SogMetadata -Path $sourcePath
        $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
        $sourceHashes[$scene.Id] = $sourceHash
        Write-Step ("Source OK: {0} | {1:N0} Gaussians | {2:N2} MB | SHA256 {3}" -f $scene.Label, $sourceMeta.Count, ($sourceMeta.Bytes / 1MB), $sourceHash.Substring(0, 12))
    }

    $packageDir = Join-Path $toolRoot 'node_modules\@playcanvas\splat-transform'
    $packageJsonPath = Join-Path $packageDir 'package.json'
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        Invoke-CheckedProcess -FilePath 'npm.cmd' -Arguments @('install', '--prefix', $toolRoot, '--no-audit', '--no-fund', '@playcanvas/splat-transform') -Description 'Installing the official PlayCanvas splat-transform tool locally'
    }

    $package = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    $binRelative = if ($package.bin -is [string]) { $package.bin } else { $package.bin.'splat-transform' }
    $cliPath = Join-Path $packageDir $binRelative
    if (-not (Test-Path -LiteralPath $cliPath)) {
        throw "splat-transform CLI entry point not found: $cliPath"
    }
    Write-Step "Using @playcanvas/splat-transform $($package.version)"

    Save-Checkpoint -Completed $completed -State 'running' -Message 'Generation started.'

    $totalJobs = $scenes.Count * $tiers.Count
    $jobNumber = 0

    foreach ($scene in $scenes) {
        $sourcePath = Join-Path $SourceStagingRoot $scene.SourceRelative
        $sourceMeta = Read-SogMetadata -Path $sourcePath
        $sceneOutput = Join-Path $outputStagingRoot $scene.OutputRelative
        $sceneWork = Join-Path $workRoot $scene.Id
        New-Item -ItemType Directory -Force -Path $sceneOutput, $sceneWork | Out-Null

        Write-Host ''
        Write-Host "========== $($scene.Label) ==========" -ForegroundColor Green

        foreach ($tier in $tiers) {
            $jobNumber += 1
            $finalSog = Join-Path $sceneOutput "$($tier.Name).sog"
            $pendingSog = Join-Path $sceneWork "$($tier.Name).pending.sog"
            $temporaryPly = Join-Path $sceneWork "$($tier.Name).decimated.ply"

            if ((-not $Force) -and (Test-Path -LiteralPath $finalSog)) {
                try {
                    $existingMeta = Read-SogMetadata -Path $finalSog
                    Write-Step ("[{0}/{1}] Reusing verified {2} {3}: {4:N0} Gaussians" -f $jobNumber, $totalJobs, $scene.Label, $tier.Label, $existingMeta.Count)
                    $completed += [ordered]@{ scene = $scene.Id; tier = $tier.Name; count = $existingMeta.Count; bytes = $existingMeta.Bytes; reused = $true }
                    Save-Checkpoint -Completed $completed -State 'running' -Message "Reused $($scene.Id) $($tier.Name)."
                    continue
                } catch {
                    Write-Host "Existing output is incomplete and will be regenerated: $finalSog" -ForegroundColor Yellow
                }
            }

            Remove-Item -LiteralPath $pendingSog, $temporaryPly -Force -ErrorAction SilentlyContinue

            Write-Host ''
            Write-Host ("[{0}/{1}] {2} - {3} ({4}% of source)" -f $jobNumber, $totalJobs, $scene.Label, $tier.Label, $tier.Percent) -ForegroundColor Magenta
            Invoke-CheckedProcess -FilePath 'node.exe' -Arguments @($cliPath, '--memory', $sourcePath, '--decimate', "$($tier.Percent)%", $temporaryPly) -Description 'Decimating to a temporary PLY'
            Invoke-CheckedProcess -FilePath 'node.exe' -Arguments @($cliPath, '--memory', $temporaryPly, $pendingSog) -Description 'Encoding the temporary PLY as SOG'

            $pendingMeta = Read-SogMetadata -Path $pendingSog
            $expectedCount = [math]::Round($sourceMeta.Count * ($tier.Percent / 100.0))
            $countTolerance = [math]::Max(64, [math]::Round($expectedCount * 0.02))
            if ([math]::Abs($pendingMeta.Count - $expectedCount) -gt $countTolerance) {
                throw "Unexpected Gaussian count for $($scene.Id) $($tier.Name): got $($pendingMeta.Count), expected about $expectedCount"
            }

            Move-Item -LiteralPath $pendingSog -Destination $finalSog -Force
            Remove-Item -LiteralPath $temporaryPly -Force -ErrorAction SilentlyContinue
            $finalHash = (Get-FileHash -LiteralPath $finalSog -Algorithm SHA256).Hash
            $completed += [ordered]@{
                scene = $scene.Id
                tier = $tier.Name
                label = $tier.Label
                percent = $tier.Percent
                count = $pendingMeta.Count
                bytes = $pendingMeta.Bytes
                sha256 = $finalHash
                path = $finalSog
            }
            Save-Checkpoint -Completed $completed -State 'running' -Message "Completed $($scene.Id) $($tier.Name)."
            Write-Step ("VERIFIED: {0} | {1:N0} Gaussians | {2:N2} MB | SHA256 {3}" -f $finalSog, $pendingMeta.Count, ($pendingMeta.Bytes / 1MB), $finalHash.Substring(0, 12))
        }

        $currentSourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
        if ($currentSourceHash -ne $sourceHashes[$scene.Id]) {
            throw "Source integrity check failed for $($scene.Label). The original hash changed."
        }
        Write-Step "Original source rechecked unchanged: $($scene.Label)"
    }

    Save-Checkpoint -Completed $completed -State 'complete' -Message 'All 16 LOD files were generated and verified.'
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ' ALL 16 LOD FILES GENERATED AND VERIFIED' -ForegroundColor Green
    Write-Host ' Return to Codex and say: finished' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
} catch {
    $exitCode = 1
    Save-Checkpoint -Completed $completed -State 'stopped-or-failed' -Message $_.Exception.Message
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host ' GENERATION STOPPED OR FAILED SAFELY' -ForegroundColor Red
    Write-Host " $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ' Completed tiers are intact. Run the launcher again to resume.' -ForegroundColor Yellow
    Write-Host ' Return to Codex and tell me what the terminal shows.' -ForegroundColor Yellow
    Write-Host '============================================================' -ForegroundColor Red
} finally {
    try { Stop-Transcript | Out-Null } catch {}
}

if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Terminal is paused for inspection. Press Enter only when you want to close it'
}

exit $exitCode
