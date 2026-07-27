param(
    [ValidateSet("Inspect", "Build")]
    [string]$Mode = "Build",
    [double]$VoxelSize = 0.5,
    [int]$TargetFaces = 80000,
    [int64]$MaxDenseVoxels = 25000000,
    [switch]$Overwrite
)

$ErrorActionPreference = "Stop"
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Split-Path -Parent $scriptDirectory
$blenderCandidates = @(
    (Get-Command blender -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe",
    "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe",
    "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not $blenderCandidates) {
    throw "Blender was not found. Install Blender 4.5+ or add blender.exe to PATH."
}

$blender = $blenderCandidates[0]
$inputGlb = Join-Path $repositoryRoot "dist-r2-assets\assets\outdoors\campus-day\glb\hd.glb"
$pilotDirectory = Join-Path $repositoryRoot ".collision-pilot\campus-day"
$voxelTag = $VoxelSize.ToString("0.###", [Globalization.CultureInfo]::InvariantCulture).Replace(".", "p")
$faceTag = $TargetFaces.ToString()
$runName = "campus-day-structural-v$voxelTag-f$faceTag"
$outputGlb = Join-Path $pilotDirectory "$runName.glb"
$reportJson = Join-Path $pilotDirectory "$runName.report.json"
$logPath = Join-Path $pilotDirectory "$runName.log"
$blenderScript = Join-Path $scriptDirectory "build_collision_proxy_blender.py"

if (-not (Test-Path -LiteralPath $inputGlb)) {
    throw "Input GLB was not found: $inputGlb"
}

New-Item -ItemType Directory -Path $pilotDirectory -Force | Out-Null

$arguments = @(
    "--background",
    "--factory-startup",
    "--python", $blenderScript,
    "--",
    "--input", $inputGlb,
    "--output", $outputGlb,
    "--report", $reportJson,
    "--voxel-size", $VoxelSize.ToString([Globalization.CultureInfo]::InvariantCulture),
    "--target-faces", $TargetFaces.ToString(),
    "--max-dense-voxels", $MaxDenseVoxels.ToString()
)

if ($Mode -eq "Inspect") {
    $arguments += "--inspect-only"
}
if ($Overwrite) {
    $arguments += "--overwrite"
}

Write-Host "Blender: $blender"
Write-Host "Mode: $Mode"
Write-Host "Input: $inputGlb"
Write-Host "Output: $outputGlb"
Write-Host "Voxel size: $VoxelSize m"
Write-Host "Target faces: $TargetFaces"
Write-Host "Log: $logPath"
Write-Host ""

$started = Get-Date
& $blender @arguments 2>&1 | Tee-Object -FilePath $logPath
$exitCode = $LASTEXITCODE
$elapsed = (Get-Date) - $started

Write-Host ""
Write-Host ("Elapsed: {0:hh\:mm\:ss}" -f $elapsed)
Write-Host "Report: $reportJson"
if ($Mode -eq "Build") {
    Write-Host "Output: $outputGlb"
}

if ($exitCode -ne 0) {
    throw "Blender pilot failed with exit code $exitCode. Send the log and report files to Codex."
}
