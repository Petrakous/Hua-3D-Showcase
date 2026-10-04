$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$bucket = 'hua-3d-assets'
$items = @(
    'assets/indoors/ceremonial-hall/generated_lods/lod4.sog',
    'assets/indoors/ceremonial-hall/generated_lods/lod3.sog',
    'assets/indoors/ceremonial-hall/generated_lods/lod2.sog',
    'assets/indoors/ceremonial-hall/generated_lods/lod1.sog',
    'assets/indoors/geo-entrance/generated_lods/lod4.sog',
    'assets/indoors/geo-entrance/generated_lods/lod3.sog',
    'assets/indoors/geo-entrance/generated_lods/lod2.sog',
    'assets/indoors/geo-entrance/generated_lods/lod1.sog',
    'assets/indoors/library/generated_lods/lod4.sog',
    'assets/indoors/library/generated_lods/lod3.sog',
    'assets/indoors/library/generated_lods/lod2.sog',
    'assets/indoors/library/generated_lods/lod1.sog',
    'assets/dit/pc-lab/generated_lods/lod4.sog',
    'assets/dit/pc-lab/generated_lods/lod3.sog',
    'assets/dit/pc-lab/generated_lods/lod2.sog',
    'assets/dit/pc-lab/generated_lods/lod1.sog'
)

Write-Host "Uploading $($items.Count) LOD files to Cloudflare R2."
Write-Host 'Safe to stop at any time with Ctrl+C; completed objects remain uploaded.'

for ($index = 0; $index -lt $items.Count; $index++) {
    $key = $items[$index]
    $localPath = Join-Path $projectRoot (Join-Path 'dist-r2-assets' $key)

    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
        throw "Missing local file: $localPath"
    }

    $sizeMiB = [Math]::Round((Get-Item -LiteralPath $localPath).Length / 1MB, 2)
    Write-Host "[$($index + 1)/$($items.Count)] $key ($sizeMiB MiB)"

    & npx.cmd --yes wrangler@latest r2 object put "$bucket/$key" `
        --remote `
        --file $localPath `
        --content-type 'application/octet-stream' `
        --cache-control 'public, max-age=31536000, immutable' `
        --force

    if ($LASTEXITCODE -ne 0) {
        throw "Upload failed for $key (exit code $LASTEXITCODE)."
    }
}

Write-Host 'UPLOAD_COMPLETE: all 16 LOD files uploaded.'
