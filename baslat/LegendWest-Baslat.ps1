# Legend of the West - açılış kurulumu
# Ön (ana) ekranda kasa uygulaması, arka (2.) ekranda müşteri ekranı; hepsi kiosk-printing ile.
# Ekran koordinatları otomatik algılanır (çözünürlükten bağımsız).

Start-Sleep -Seconds 6   # açılışta ekranlar otursun

Add-Type -AssemblyName System.Windows.Forms

$base = "https://naziftanriover.github.io/yuvarlak-bar"

# Chrome yolunu bul
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { $chrome = "chrome.exe" }

# Bayrakların uygulanması için Chrome'u temiz başlat
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. ekranı (müşteri) bul
$sec = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1

# 1) MÜŞTERİ EKRANI — ilk pencere (bayraklar bu pencereye uygulanır): 2. ekranı kaplar
if ($sec) {
  $x = $sec.Bounds.X; $y = $sec.Bounds.Y
  $w = $sec.Bounds.Width; $h = $sec.Bounds.Height
  Start-Process $chrome -ArgumentList @(
    "--kiosk-printing",
    "--no-first-run",
    "--disable-session-crashed-bubble",
    "--window-position=$x,$y",
    "--window-size=$w,$h",
    "--app=$base/musteri.html"
  )
  Start-Sleep -Seconds 4
}

# 2) KASA UYGULAMASI — aynı profilde yeni pencere (ana ekran); canlı bağlantı + kiosk-printing miras alınır
Start-Process $chrome -ArgumentList @(
  "--new-window",
  "$base/giris.html"
)
