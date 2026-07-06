[CmdletBinding()]
param(
    [string]$Source = "C:\mipmap-desktop\669a019e-32f1-487b-96c7-83c8f07d707b\DIT\DIT-20260610_1\result",
    [string]$Viewer = "",
    [switch]$ForceRebuild,
    [switch]$SkipCollision
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Viewer)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $Viewer = Split-Path -Parent $scriptDirectory
}

$Ply = Join-Path $Source "3D\model-gs-ply\ue\gs_full.ply"
$GlbTiles = Join-Path $Source "3D\model-glb\Data"
$GlbOutput = Join-Path $Viewer "GLBs"
$SogOutput = Join-Path $Viewer "PLYs\DIT"
$LodOutput = Join-Path $SogOutput "generated_lods"
$StreamOutput = Join-Path $SogOutput "output_lod"
$FullSog = Join-Path $SogOutput "DIT.sog"
$SplatTransform = Join-Path $env:APPDATA "npm\splat-transform.cmd"
$CollisionScript = Join-Path $Viewer "scripts\make_collision.py"
$CollisionOutput = Join-Path $GlbOutput "DIT_collision.glb"
$FlatTiles = Join-Path $GlbOutput "DIT_tiles"

function Assert-File([string]$Path, [string]$Description) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description not found: $Path"
    }
}

function Invoke-Checked([string]$Description, [string]$Command, [string[]]$Arguments) {
    Write-Host ""
    Write-Host "=== $Description ===" -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Get-SizeMB([string]$Path) {
    return [math]::Round((Get-Item -LiteralPath $Path).Length / 1MB, 2)
}

Assert-File $Ply "Gaussian PLY"
Assert-File $FullSog "Full DIT SOG"
Assert-File $SplatTransform "splat-transform command"
Assert-File (Join-Path $GlbOutput "DIT.glb") "Optimized DIT GLB"

New-Item -ItemType Directory -Force $LodOutput, $StreamOutput | Out-Null

Write-Host "DIT source: $Source"
Write-Host "Viewer:     $Viewer"
Write-Host "Full SOG:   $(Get-SizeMB $FullSog) MB"
Write-Host ""
Write-Host "LOD decimation will use CPU to avoid the GPU's 2 GB storage-buffer limit." -ForegroundColor Yellow
Write-Host "This can take a long time for 15.1 million Gaussians. The script is resumable."

$lodSpecs = @(
    @{ Name = "lod1.sog"; Percent = "50%"; MaxRatio = 0.70 },
    @{ Name = "lod2.sog"; Percent = "25%"; MaxRatio = 0.40 },
    @{ Name = "lod3.sog"; Percent = "12.5%"; MaxRatio = 0.25 },
    @{ Name = "lod4.sog"; Percent = "6.25%"; MaxRatio = 0.15 }
)

$fullSize = (Get-Item -LiteralPath $FullSog).Length

foreach ($spec in $lodSpecs) {
    $output = Join-Path $LodOutput $spec.Name
    $validExisting = $false

    if ((Test-Path -LiteralPath $output -PathType Leaf) -and -not $ForceRebuild) {
        $ratio = (Get-Item -LiteralPath $output).Length / $fullSize
        $validExisting = $ratio -gt 0.01 -and $ratio -le $spec.MaxRatio
        if ($validExisting) {
            Write-Host "Keeping valid $($spec.Name) ($(Get-SizeMB $output) MB)." -ForegroundColor Green
        } else {
            Write-Host "Replacing invalid $($spec.Name) ($(Get-SizeMB $output) MB)." -ForegroundColor Yellow
        }
    }

    if (-not $validExisting) {
        $args = @(
            "--overwrite",
            "--gpu", "cpu",
            $Ply,
            "--filter-nan",
            "--decimate", $spec.Percent,
            "--morton-order",
            $output
        )
        Invoke-Checked "Build $($spec.Name) at $($spec.Percent) on CPU" $SplatTransform $args

        $ratio = (Get-Item -LiteralPath $output).Length / $fullSize
        if ($ratio -le 0.01 -or $ratio -gt $spec.MaxRatio) {
            throw "$($spec.Name) failed size validation: $(Get-SizeMB $output) MB (ratio $([math]::Round($ratio, 3)))."
        }
    }
}

$lodFiles = @($FullSog)
$lodFiles += $lodSpecs | ForEach-Object { Join-Path $LodOutput $_.Name }

for ($i = 0; $i -lt $lodFiles.Count; $i++) {
    Assert-File $lodFiles[$i] "LOD $i"
}

$LodMeta = Join-Path $StreamOutput "lod-meta.json"
if ($ForceRebuild -or -not (Test-Path -LiteralPath $LodMeta -PathType Leaf)) {
    $streamArgs = @("--overwrite")
    for ($i = 0; $i -lt $lodFiles.Count; $i++) {
        $streamArgs += @($lodFiles[$i], "--lod", "$i")
    }
    $streamArgs += $LodMeta
    Invoke-Checked "Build streamed multi-LOD SOG" $SplatTransform $streamArgs
} else {
    Write-Host "Keeping existing streamed dataset: $LodMeta" -ForegroundColor Green
}
Assert-File $LodMeta "Streamed LOD metadata"

if (-not $SkipCollision) {
    Assert-File $CollisionScript "Collision builder"
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        throw "Python is required for collision generation. Re-run with -SkipCollision to omit it."
    }

    if ($ForceRebuild -or -not (Test-Path -LiteralPath $CollisionOutput -PathType Leaf)) {
        New-Item -ItemType Directory -Force $FlatTiles | Out-Null
        $tiles = @(Get-ChildItem -LiteralPath $GlbTiles -Recurse -Filter "*.glb" -File)
        if ($tiles.Count -eq 0) {
            throw "No GLB tiles found under $GlbTiles"
        }
        foreach ($tile in $tiles) {
            Copy-Item -LiteralPath $tile.FullName -Destination (Join-Path $FlatTiles $tile.Name) -Force
        }
        Invoke-Checked "Build lightweight collision GLB" $python.Source @($CollisionScript, $FlatTiles, $CollisionOutput, "0.05")
    } else {
        Write-Host "Keeping existing collision GLB: $CollisionOutput" -ForegroundColor Green
    }
    Assert-File $CollisionOutput "DIT collision GLB"
}

Write-Host ""
Write-Host "=== DIT asset build complete ===" -ForegroundColor Green
$results = @(
    (Join-Path $GlbOutput "DIT.glb"),
    $FullSog
) + ($lodSpecs | ForEach-Object { Join-Path $LodOutput $_.Name }) + @($LodMeta)
if (-not $SkipCollision) { $results += $CollisionOutput }

$results | ForEach-Object {
    $item = Get-Item -LiteralPath $_
    [PSCustomObject]@{
        File = $item.FullName
        SizeMB = [math]::Round($item.Length / 1MB, 2)
    }
} | Format-Table -AutoSize

Write-Host "Next: add these assets to assets\manifest.json and viewer\sceneCatalog.js, then calibrate GLB/SOG alignment in the viewer."
