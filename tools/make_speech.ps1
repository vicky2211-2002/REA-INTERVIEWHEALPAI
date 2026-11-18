<#
  Synthesizes real speech to a 16 kHz mono 16-bit WAV so the audio/test pipeline
  has something deterministic to play.

    powershell -ExecutionPolicy Bypass -File tools/make_speech.ps1
    powershell -ExecutionPolicy Bypass -File tools/make_speech.ps1 -Text "..." -Out "$env:TEMP\custom.wav"

  Default output: %TEMP%\opencode\speech16k.wav

  Uses the built-in Windows SAPI voices (System.Speech). No extra install.
  Play it with:

    (New-Object Media.SoundPlayer "$env:TEMP\opencode\speech16k.wav").PlaySync()

  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 files as
  ANSI unless they have a BOM, so non-ASCII characters become parse errors.
#>
param(
  [string]$Text = "Thank you for joining. Could you walk me through a difficult technical decision you made last year, and what the outcome was?",
  [string]$Out = "$env:TEMP\opencode\speech16k.wav",
  [string]$VoiceName = ""
)

Add-Type -AssemblyName System.Speech

$dir = Split-Path -Parent $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

if ($VoiceName) {
  $match = $synth.GetInstalledVoices() |
    Where-Object { $_.VoiceInfo.Name -like "*$VoiceName*" } |
    Select-Object -First 1
  if ($match) {
    $synth.SelectVoice($match.VoiceInfo.Name)
    "voice: $($match.VoiceInfo.Name)"
  } else {
    "voice '$VoiceName' not installed - using default"
  }
}

$format = New-Object -TypeName System.Speech.AudioFormat.SpeechAudioFormatInfo -ArgumentList @(
  16000,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono
)

$synth.SetOutputToWaveFile($Out, $format)
$synth.Speak($Text)
$synth.SetOutputToNull()
$synth.Dispose()

if (-not (Test-Path $Out)) {
  "FAILED to write $Out"
  exit 1
}

$file = Get-Item $Out
$seconds = [math]::Round(($file.Length - 44) / 32000, 1)   # 16000 Hz * 2 bytes mono
"wrote: $($file.FullName)"
"format: 16000 Hz mono s16le | size: $([math]::Round($file.Length / 1KB, 1)) KB | approx $seconds s"
