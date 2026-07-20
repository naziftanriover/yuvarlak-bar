# Legend of the West - acilis kurulumu (iki ekran)
# Musteri ekrani arka (2.) ekranda, kasa uygulamasi on (ana) ekranda; hepsi kiosk-printing.
Start-Sleep -Seconds 8   # acilista ekranlar + sistem otursun

$U = "https://naziftanriover.github.io/yuvarlak-bar"

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { $chrome = "chrome.exe" }

Add-Type -AssemblyName System.Windows.Forms
$sec = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1

# Temiz baslangic (bayraklarin uygulanmasi icin)
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 1) MUSTERI EKRANI - ilk pencere (bayraklar uygulanir) -> 2. ekrani kaplar
if ($sec) {
  $x = $sec.Bounds.X; $y = $sec.Bounds.Y; $w = $sec.Bounds.Width; $h = $sec.Bounds.Height
  Start-Process $chrome -ArgumentList "--kiosk-printing","--no-first-run","--disable-session-crashed-bubble","--window-position=$x,$y","--window-size=$w,$h","--app=$U/musteri.html"
  Start-Sleep -Seconds 5
}

# 2) KASA UYGULAMASI - ayni profilde yeni pencere (canli baglanti + kiosk-printing miras alinir)
Start-Process $chrome -ArgumentList "--new-window","$U/giris.html"
Start-Sleep -Seconds 6

# 3) Kasa penceresini ana (on) ekrana tasi: Win+Shift+Sol, sonra Win+Yukari (buyut).
# (Zaten on ekrandaysa Win+Shift+Sol zararsizdir, oldugu yerde kalir.)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
}
"@
function Tus($vk, $down) { [K]::keybd_event($vk, 0, $(if ($down) { 0 } else { 2 }), [IntPtr]::Zero) }

Start-Sleep -Milliseconds 500
# Win + Shift + Sol
Tus 0x5B $true; Tus 0x10 $true; Tus 0x25 $true
Start-Sleep -Milliseconds 150
Tus 0x25 $false; Tus 0x10 $false; Tus 0x5B $false
Start-Sleep -Milliseconds 500
# Win + Yukari (buyut)
Tus 0x5B $true; Tus 0x26 $true
Start-Sleep -Milliseconds 150
Tus 0x26 $false; Tus 0x5B $false
