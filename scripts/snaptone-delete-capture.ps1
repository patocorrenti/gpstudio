# Forward Valeton Suite through a loopMIDI port and log SnapTone delete SysEx.
# Create a loopMIDI port named "GP Capture" first, with Suite closed.
#   powershell -ExecutionPolicy Bypass -File .\snaptone-delete-capture.ps1 --list
#   powershell -ExecutionPolicy Bypass -File .\snaptone-delete-capture.ps1 --bridge

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) {
    $python = Get-Command python -ErrorAction SilentlyContinue
}
if (-not $python) {
    Write-Error "Python 3 is not on PATH. Install it from https://www.python.org/downloads/ and enable 'Add python.exe to PATH'."
}

$pyArgs = @()
if ($python.Name -like "py*") {
    $pyArgs = @("-3")
}

& $python.Source @pyArgs -m pip install --disable-pip-version-check python-rtmidi
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $python.Source @pyArgs .\snaptone-delete-capture.py @args
exit $LASTEXITCODE
