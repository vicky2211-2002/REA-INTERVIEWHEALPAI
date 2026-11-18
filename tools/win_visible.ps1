<#
  Reports whether a process still has any window with the WS_VISIBLE style.

    powershell -ExecutionPolicy Bypass -File tools/win_visible.ps1 -ProcessName InterviewCopilot

  Prints "NO VISIBLE WINDOWS" when the overlay is hidden (Show/Hide or Ctrl+\),
  otherwise a table of window handles, titles and IsWindowVisible.

  Chromium's PrintWindow() returns a blank bitmap, so this style check is the
  reliable way to prove hide/restore behavior.
#>
param([string]$ProcessName = "InterviewCopilot")

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WV {
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
}
"@

$pids = (Get-Process -Name $ProcessName -ErrorAction SilentlyContinue).Id
if (-not $pids) {
  "NO PROCESS NAMED $ProcessName"
  exit 1
}

$rows = @()
$cb = [WV+EnumProc] {
  param($h, $p)
  $wpid = 0
  [WV]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  if ($pids -contains $wpid) {
    $style = [WV]::GetWindowLong($h, -16)   # GWL_STYLE
    if (($style -band 0x10000000) -ne 0) {  # WS_VISIBLE
      $len = [WV]::GetWindowTextLength($h)
      $sb = New-Object System.Text.StringBuilder (($len + 2))
      [WV]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
      $script:rows += [pscustomobject]@{
        H       = $h
        Title   = $sb.ToString()
        Visible = [WV]::IsWindowVisible($h)
      }
    }
  }
  return $true
}

[WV]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null

if ($rows.Count -eq 0) {
  "NO VISIBLE WINDOWS"
} else {
  $rows | Format-Table -AutoSize | Out-String
}
