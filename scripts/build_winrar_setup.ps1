$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "apps\desktop\release"
$unpackedRoot = Join-Path $releaseRoot "win-unpacked"
$workRoot = Join-Path $releaseRoot "winrar-build"
$payloadZip = Join-Path $workRoot "payload.zip"
$installCmd = Join-Path $workRoot "install.cmd"
$installPs1 = Join-Path $workRoot "install.ps1"
$commentFile = Join-Path $workRoot "sfx-comment.txt"
$targetExeBase = Join-Path $releaseRoot "OpenClaw-Exoskeleton-Setup.exe"
$targetExe = $targetExeBase
$rarExe = "C:\Program Files\WinRAR\rar.exe"
$sfxModule = "C:\Program Files\WinRAR\Default.SFX"

if (!(Test-Path $unpackedRoot)) {
  throw "Missing win-unpacked output at $unpackedRoot. Build the desktop package first."
}

if (!(Test-Path $rarExe)) {
  throw "WinRAR CLI was not found at $rarExe."
}

if (!(Test-Path $sfxModule)) {
  throw "WinRAR SFX module was not found at $sfxModule."
}

if (Test-Path $workRoot) {
  Remove-Item $workRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $workRoot | Out-Null

Compress-Archive -Path (Join-Path $unpackedRoot "*") -DestinationPath $payloadZip -Force

$installCmdBody = @'
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
endlocal
'@
Set-Content -Path $installCmd -Value $installCmdBody -Encoding ASCII

$installPs1Body = @'
$ErrorActionPreference = "Stop"

$appDir = Join-Path $env:LOCALAPPDATA "Programs\OpenClawExoskeleton"
$desktopDir = [Environment]::GetFolderPath("Desktop")
$programsDir = [Environment]::GetFolderPath("Programs")
$startMenuDir = Join-Path $programsDir "OpenClaw Exoskeleton"
$payloadZip = Join-Path $PSScriptRoot "payload.zip"
$exePath = Join-Path $appDir "OpenClaw-Exoskeleton.exe"
$uninstallPath = Join-Path $appDir "uninstall.cmd"

New-Item -ItemType Directory -Path $appDir -Force | Out-Null
Expand-Archive -Path $payloadZip -DestinationPath $appDir -Force
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null

$uninstallBody = @(
  '@echo off',
  'setlocal',
  'start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1; Get-Process OpenClaw-Exoskeleton -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Remove-Item -Path ([IO.Path]::Combine([Environment]::GetFolderPath(''Desktop''),''OpenClaw Exoskeleton.lnk'')) -Force -ErrorAction SilentlyContinue; Remove-Item -Path ([IO.Path]::Combine([Environment]::GetFolderPath(''Desktop''),''Uninstall OpenClaw Exoskeleton.lnk'')) -Force -ErrorAction SilentlyContinue; $startMenuDir=[IO.Path]::Combine([Environment]::GetFolderPath(''Programs''),''OpenClaw Exoskeleton''); Remove-Item -Path $startMenuDir -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path $env:LOCALAPPDATA\Programs\OpenClawExoskeleton -Recurse -Force -ErrorAction SilentlyContinue"',
  'exit /b 0'
) -join "`r`n"
Set-Content -Path $uninstallPath -Value $uninstallBody -Encoding ASCII

$shell = New-Object -ComObject WScript.Shell

$appDesktop = $shell.CreateShortcut((Join-Path $desktopDir "OpenClaw Exoskeleton.lnk"))
$appDesktop.TargetPath = $exePath
$appDesktop.WorkingDirectory = $appDir
$appDesktop.IconLocation = "$exePath,0"
$appDesktop.Save()

$uninstallDesktop = $shell.CreateShortcut((Join-Path $desktopDir "Uninstall OpenClaw Exoskeleton.lnk"))
$uninstallDesktop.TargetPath = $uninstallPath
$uninstallDesktop.WorkingDirectory = $appDir
$uninstallDesktop.IconLocation = "$env:SystemRoot\System32\shell32.dll,31"
$uninstallDesktop.Save()

$appMenu = $shell.CreateShortcut((Join-Path $startMenuDir "OpenClaw Exoskeleton.lnk"))
$appMenu.TargetPath = $exePath
$appMenu.WorkingDirectory = $appDir
$appMenu.IconLocation = "$exePath,0"
$appMenu.Save()

$uninstallMenu = $shell.CreateShortcut((Join-Path $startMenuDir "Uninstall OpenClaw Exoskeleton.lnk"))
$uninstallMenu.TargetPath = $uninstallPath
$uninstallMenu.WorkingDirectory = $appDir
$uninstallMenu.IconLocation = "$env:SystemRoot\System32\shell32.dll,31"
$uninstallMenu.Save()

Start-Process -FilePath $exePath
'@
Set-Content -Path $installPs1 -Value $installPs1Body -Encoding ASCII

$commentBody = @'
;The comment below contains SFX script commands
Path=%TEMP%\OpenClawExoskeletonSetup
TempMode
Silent=0
Overwrite=1
Title=OpenClaw Exoskeleton Setup
Setup=install.cmd
'@
Set-Content -Path $commentFile -Value $commentBody -Encoding ASCII

if (Test-Path $targetExeBase) {
  try {
    Remove-Item $targetExeBase -Force -ErrorAction Stop
  } catch {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $targetExe = Join-Path $releaseRoot "OpenClaw-Exoskeleton-Setup-$stamp.exe"
  }
}

& $rarExe a -ep1 -sfx"$sfxModule" -z"$commentFile" $targetExe $installCmd $installPs1 $payloadZip

if (!(Test-Path $targetExe)) {
  throw "WinRAR SFX did not produce the expected installer at $targetExe."
}

Write-Output "Created installer: $targetExe"
