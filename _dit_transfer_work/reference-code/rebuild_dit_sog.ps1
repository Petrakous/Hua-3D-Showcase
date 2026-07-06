[CmdletBinding()]
param(
    [string]$InputSog = "C:\mipmap-desktop\669a019e-32f1-487b-96c7-83c8f07d707b\DIT\DIT-20260610_1\result\3D\gs_full_Transformed.sog",
    [string]$Viewer = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Viewer)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $Viewer = Split-Path -Parent $scriptDirectory
}

$SplatTransform = Join-Path $env:APPDATA "npm\splat-transform.cmd"
$SogRoot = Join-Path $Viewer "PLYs\DIT"
$FullSog = Join-Path $SogRoot "DIT.sog"
$LodRoot = Join-Path $SogRoot "generated_lods"
$StreamRoot = Join-Path $SogRoot "output_lod"
$StagedDitRoot = Join-Path $Viewer "dist-r2-assets\assets\dit\main"
$StageScript = Join-Path $Viewer "scripts\stage_r2_assets.mjs"

function Assert-File([string]$Path, [string]$Description) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description not found: $Path"
    }
}

function Assert-UnderRoot([string]$Path, [string]$Root) {
    $resolvedPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    if (-not $resolvedPath.StartsWith($resolvedRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify path outside viewer root: $resolvedPath"
    }
}

function Invoke-Checked([string]$Description, [string]$Command, [string[]]$Arguments) {
    Write-Host ""
    Write-Host "=== $Description ===" -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE. Re-run this script to resume."
    }
}

Assert-File $InputSog "Clean transformed SOG"
Assert-File $SplatTransform "splat-transform"
Assert-File $StageScript "DIT staging script"
Assert-UnderRoot $SogRoot $Viewer
Assert-UnderRoot $StagedDitRoot $Viewer

New-Item -ItemType Directory -Force $SogRoot, $LodRoot | Out-Null

$sourceItem = Get-Item -LiteralPath $InputSog
$replaceFullSog = $true
if (Test-Path -LiteralPath $FullSog -PathType Leaf) {
    $targetItem = Get-Item -LiteralPath $FullSog
    $replaceFullSog = $targetItem.Length -ne $sourceItem.Length
}

if ($replaceFullSog) {
    Write-Host "Installing clean DIT.sog ($([math]::Round($sourceItem.Length / 1MB, 2)) MB)..." -ForegroundColor Yellow
    Copy-Item -LiteralPath $InputSog -Destination $FullSog -Force
} else {
    Write-Host "Clean DIT.sog is already installed." -ForegroundColor Green
}

$lodSpecs = @(
    @{ Name = "lod1.sog"; Percent = "50%"; MaxRatio = 0.70 },
    @{ Name = "lod2.sog"; Percent = "25%"; MaxRatio = 0.40 },
    @{ Name = "lod3.sog"; Percent = "12.5%"; MaxRatio = 0.25 },
    @{ Name = "lod4.sog"; Percent = "6.25%"; MaxRatio = 0.15 }
)
$fullSize = (Get-Item -LiteralPath $FullSog).Length

foreach ($spec in $lodSpecs) {
    $output = Join-Path $LodRoot $spec.Name
    $valid = $false
    if (Test-Path -LiteralPath $output -PathType Leaf) {
        $outputItem = Get-Item -LiteralPath $output
        $ratio = $outputItem.Length / $fullSize
        $valid = $ratio -gt 0.01 -and $ratio -le $spec.MaxRatio -and
            $outputItem.LastWriteTimeUtc -ge (Get-Item -LiteralPath $FullSog).LastWriteTimeUtc
    }
    if ($valid -and -not $replaceFullSog) {
        Write-Host "Keeping $($spec.Name)." -ForegroundColor Green
        continue
    }

    Invoke-Checked "Build $($spec.Name) at $($spec.Percent) on CPU" $SplatTransform @(
        "--overwrite", "--gpu", "cpu", $FullSog,
        "--filter-nan", "--decimate", $spec.Percent, "--morton-order", $output
    )
}

# A new source can produce fewer chunks. Remove the old tree so stale chunks
# cannot be staged or uploaded alongside the clean reconstruction.
if (Test-Path -LiteralPath $StreamRoot) {
    Remove-Item -LiteralPath $StreamRoot -Recurse -Force
}
New-Item -ItemType Directory -Force $StreamRoot | Out-Null

$lodFiles = @($FullSog) + ($lodSpecs | ForEach-Object { Join-Path $LodRoot $_.Name })
$streamArgs = @("--overwrite")
for ($index = 0; $index -lt $lodFiles.Count; $index++) {
    $streamArgs += @($lodFiles[$index], "--lod", "$index")
}
$streamArgs += (Join-Path $StreamRoot "lod-meta.json")
Invoke-Checked "Build clean streamed multi-LOD SOG" $SplatTransform $streamArgs

# Recreate only DIT's local deployment mirror. GLB resolves from the original
# HuaDITDusk.glb; collision resolves from the already-built DIT_collision.glb.
if (Test-Path -LiteralPath $StagedDitRoot) {
    Remove-Item -LiteralPath $StagedDitRoot -Recurse -Force
}
Push-Location $Viewer
try {
    Invoke-Checked "Stage clean DIT assets for localhost" "node" @($StageScript, "--scene", "dit-main")
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Clean DIT SOG rebuild complete ===" -ForegroundColor Green
Get-ChildItem -LiteralPath $SogRoot -Recurse -File |
    Where-Object { $_.Extension -in '.sog', '.json' } |
    Select-Object FullName, @{N='SizeMB';E={[math]::Round($_.Length / 1MB, 2)}} |
    Format-Table -AutoSize

Write-Host "Kept: original HuaDITDusk.glb and existing GLBs\DIT_collision.glb."
Write-Host "Next: hard-refresh localhost and recalibrate the clean SOG if needed."
