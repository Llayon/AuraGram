$ErrorActionPreference = 'Stop'
$folder = Join-Path $PSScriptRoot 'out/dataset'
$entries = @(
  @{name='freckles-blonde';page='https://unsplash.com/photos/a-young-woman-with-blonde-hair-and-freckles-BxcLsxRvFIg';author='Kateryna Hliznitsova';image='photo-1772615492602-9ca30b030217'},
  @{name='eyeglasses';page='https://unsplash.com/photos/portrait-photo-of-woman-wearing-eyeglasses-Arq71XxDVGI';author='Kirill Balobanov';image='photo-1532442312344-38696bc5294d'},
  @{name='hair-occlusion';page='https://unsplash.com/photos/womans-hair-covering-her-left-eye-AU8LGUIhDD4';author='Juli Kosolapova';image='photo-1565470921607-2fabedd2dd86'}
)
$records = @()
foreach ($entry in $entries) {
  $target = Join-Path $folder ($entry.name+'.jpg')
  # Primary image links were verified through the public source pages.
  # Source HTML returns401 to this CLI; the public image CDN is accessible.
  $imageBase = 'https://images.unsplash.com/'+$entry.image
  $imageUrl = $imageBase+'?w=2400&q=95'
  if (-not (Test-Path -LiteralPath $target)) { Invoke-WebRequest -Uri $imageUrl -OutFile $target }
  $records += @{file=$entry.name+'.jpg';page=$entry.page;author=$entry.author;imageUrl=$imageUrl;license='https://unsplash.com/license';sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash;categories='Pending visual inspection; do not infer eyelash colour or makeup from filename'}
}
$records | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $folder 'recovery-sources.json')
