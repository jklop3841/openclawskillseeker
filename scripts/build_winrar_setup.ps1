$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "apps\desktop\release"
$unpackedRoot = Join-Path $releaseRoot "win-unpacked"
$workRoot = Join-Path $releaseRoot "winrar-build"
$payloadZip = Join-Path $workRoot "payload.zip"
$installCmd = Join-Path $workRoot "install.cmd"
$commentFile = Join-Path $workRoot "sfx-comment.txt"
$targetExe = Join-Path $releaseRoot "OpenClaw-Exoskeleton-Setup.exe"
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
set "APPDIR=%LOCALAPPDATA%\Programs\OpenClawExoskeleton"
if not exist "%APPDIR%" mkdir "%APPDIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0payload.zip' -DestinationPath '%APPDIR%' -Force"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\OpenClaw机械外骨骼.lnk'); $s.TargetPath='%APPDIR%\OpenClaw机械外骨骼.exe'; $s.WorkingDirectory='%APPDIR%'; $s.IconLocation='%APPDIR%\OpenClaw机械外骨骼.exe,0'; $s.Save()"
start "" "%APPDIR%\OpenClaw机械外骨骼.exe"
endlocal
'@
Set-Content -Path $installCmd -Value $installCmdBody -Encoding ASCII

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

if (Test-Path $targetExe) {
  Remove-Item $targetExe -Force
}

& $rarExe a -ep1 -sfx"$sfxModule" -z"$commentFile" $targetExe $installCmd $payloadZip

if (!(Test-Path $targetExe)) {
  throw "WinRAR SFX did not produce the expected installer at $targetExe."
}

Write-Output "Created installer: $targetExe"
