$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $root "apps\desktop\release"
$unpackedRoot = Join-Path $releaseRoot "win-unpacked"
$workRoot = Join-Path $releaseRoot "iexpress-build"
$payloadZip = Join-Path $workRoot "payload.zip"
$installCmd = Join-Path $workRoot "install.cmd"
$sedPath = Join-Path $workRoot "openclaw-exoskeleton.sed"
$targetExeBase = Join-Path $releaseRoot "OpenClaw-Exoskeleton-Setup.exe"
$targetExe = $targetExeBase

if (!(Test-Path $unpackedRoot)) {
  throw "Missing win-unpacked output at $unpackedRoot. Build the desktop package first."
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
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\OpenClaw Exoskeleton.lnk'); $s.TargetPath='%APPDIR%\OpenClaw-Exoskeleton.exe'; $s.WorkingDirectory='%APPDIR%'; $s.IconLocation='%APPDIR%\OpenClaw-Exoskeleton.exe,0'; $s.Save()"
start "" "%APPDIR%\OpenClaw-Exoskeleton.exe"
endlocal
'@

Set-Content -Path $installCmd -Value $installCmdBody -Encoding ASCII

$sedBody = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=OpenClaw Exoskeleton installation completed. A desktop shortcut was created.
TargetName=$targetExe
FriendlyName=OpenClaw Exoskeleton Setup
AppLaunched=install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=install.cmd
UserQuietInstCmd=install.cmd
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$workRoot
[SourceFiles0]
install.cmd=
payload.zip=
"@

Set-Content -Path $sedPath -Value $sedBody -Encoding ASCII

if (Test-Path $targetExeBase) {
  try {
    Remove-Item $targetExeBase -Force -ErrorAction Stop
  } catch {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $targetExe = Join-Path $releaseRoot "OpenClaw-Exoskeleton-Setup-$stamp.exe"
    $sedBody = $sedBody -replace [regex]::Escape($targetExeBase), [System.Text.RegularExpressions.Regex]::Escape($targetExe).Replace("\\", "\")
    Set-Content -Path $sedPath -Value $sedBody -Encoding ASCII
  }
}

Start-Process -FilePath "$env:WINDIR\System32\iexpress.exe" -ArgumentList "/N `"$sedPath`"" -Wait -NoNewWindow

if (!(Test-Path $targetExe)) {
  throw "IExpress did not produce the expected installer at $targetExe."
}

Write-Output "Created installer: $targetExe"
