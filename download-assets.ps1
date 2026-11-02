# LAST ZONE - 무료 실사 에셋 다운로드 (CC0 / MIT 무료 에셋)
# 이미 받은 파일은 건너뛰므로 여러 번 실행해도 됩니다.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = 'https://dl.polyhaven.org/file/ph-assets'

$textures = @('sparse_grass', 'dirt', 'coast_sand_01', 'asphalt_02',
  'white_plaster_02', 'red_brick_03', 'weathered_brown_planks', 'wood_floor', 'grey_roof_tiles_02',
  'concrete_floor_worn_001', 'corrugated_iron', 'plywood', 'rock_face_03')
$hdris = @('kloofendal_48d_partly_cloudy_puresky', 'belfast_sunset_puresky')

$list = New-Object System.Collections.ArrayList
foreach ($id in $textures) {
  foreach ($m in @('diff', 'nor_gl', 'arm')) {
    [void]$list.Add(@("$base/Textures/jpg/1k/$id/${id}_${m}_1k.jpg", "assets\tex\$id\${id}_${m}_1k.jpg"))
  }
}
foreach ($id in $hdris) {
  [void]$list.Add(@("$base/HDRIs/hdr/1k/${id}_1k.hdr", "assets\hdri\${id}_1k.hdr"))
  # 4k 원본은 하늘 배경 이미지(_bg.jpg)를 만들 때만 씁니다
  [void]$list.Add(@("$base/HDRIs/hdr/4k/${id}_4k.hdr", "assets\_src\${id}_4k.hdr"))
}

# ---- 나무·덤불 생성기 EZ-Tree (MIT, https://github.com/dgreenheck/ez-tree) ----
[void]$list.Add(@('https://cdn.jsdelivr.net/npm/@dgreenheck/ez-tree@1.1.0/build/ez-tree.es.js', 'vendor\ez-tree.es.js'))
[void]$list.Add(@('https://cdn.jsdelivr.net/npm/@dgreenheck/ez-tree@1.1.0/LICENSE', 'vendor\ez-tree.LICENSE.txt'))

# ---- 권총: Poly Haven Service Pistol (CC0) ----
$pp = "$base/Models"
[void]$list.Add(@("$pp/gltf/1k/service_pistol/service_pistol_1k.gltf", 'assets\models\pistol\service_pistol_1k.gltf'))
[void]$list.Add(@("$pp/gltf/4k/service_pistol/service_pistol.bin", 'assets\models\pistol\service_pistol.bin'))
foreach ($m in @('diff', 'nor_gl', 'arm')) {
  [void]$list.Add(@("$pp/jpg/1k/service_pistol/service_pistol_${m}_1k.jpg", "assets\models\pistol\textures\service_pistol_${m}_1k.jpg"))
}

# ---- 소총·산탄총 원본 (OpenGameArt, CC0) ----
$oga = 'https://opengameart.org/sites/default/files'
[void]$list.Add(@("$oga/m4a1_0.zip", 'assets\_src\guns\m4a1.zip'))
[void]$list.Add(@("$oga/myShotgun.zip", 'assets\_src\guns\semiauto_shotgun.zip'))

# ---- 군인 캐릭터 원본: Microsoft Rocketbox (MIT) ----
$rb = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/0943055db6ec570bcef9f2c8b41c9e5467c808f9/Assets/Avatars/Professions'
$soldiers = @{
  'Military_Male_01'   = @('sm002_body_color_acu', 'sm002_body_normal', 'sm002_equipment_color_acu', 'sm002_equipment_normal', 'sm002_head_color', 'sm002_head_normal', 'sm002_helmet_color_acu', 'sm002_helmet_normal');
  'Military_Male_03'   = @('sm004_body_color_acu', 'sm004_body_normal', 'sm004_equipment_color_acu', 'sm004_equipment_normal', 'sm004_head_color', 'sm004_head_normal', 'sm004_helmet_color_acu', 'sm004_helmet_normal');
  'Military_Female_01' = @('sf003_body_color_acu', 'sf003_body_normal', 'sf003_equipment_color_acu', 'sf003_equipment_normal', 'sf003_head_color', 'sf003_head_normal', 'sf003_helmet_color_acu', 'sf003_helmet_normal')
}
foreach ($n in $soldiers.Keys) {
  [void]$list.Add(@("$rb/$n/Export/$n.fbx", "assets\_src\rocketbox\$n\$n.fbx"))
  foreach ($t in $soldiers[$n]) { [void]$list.Add(@("$rb/$n/Textures/$t.tga", "assets\_src\rocketbox\$n\$t.tga")) }
}
[void]$list.Add(@('https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/0943055db6ec570bcef9f2c8b41c9e5467c808f9/LICENSE.md', 'assets\_src\rocketbox\LICENSE.md'))

Write-Host ''
Write-Host '  LAST ZONE 실사 에셋 다운로드 (Poly Haven · Rocketbox · OpenGameArt · EZ-Tree)' -ForegroundColor Cyan
Write-Host ''
$i = 0; $fail = 0
foreach ($item in $list) {
  $i++
  $url = $item[0]; $dst = Join-Path $root $item[1]
  $name = Split-Path -Leaf $dst
  if ((Test-Path $dst) -and ((Get-Item $dst).Length -gt 0)) { Write-Host ("  [{0,2}/{1}] 있음  {2}" -f $i, $list.Count, $name) -ForegroundColor DarkGray; continue }
  $dir = Split-Path -Parent $dst
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  try {
    Invoke-WebRequest -Uri $url -OutFile "$dst.part" -UseBasicParsing
    Move-Item -Force "$dst.part" $dst
    Write-Host ("  [{0,2}/{1}] 완료  {2}" -f $i, $list.Count, $name) -ForegroundColor Green
  } catch {
    $fail++
    if (Test-Path "$dst.part") { Remove-Item -Force "$dst.part" }
    Write-Host ("  [{0,2}/{1}] 실패  {2}  ({3})" -f $i, $list.Count, $name, $_.Exception.Message) -ForegroundColor Red
  }
}
Write-Host ''
if ($fail -eq 0) { Write-Host '  모두 받았습니다. start.bat 으로 게임을 실행하세요.' -ForegroundColor Cyan }
else { Write-Host "  $fail 개 실패 - 인터넷 연결을 확인하고 다시 실행하세요." -ForegroundColor Yellow }
Write-Host ''
