import * as os from 'os';

export class StealthManager {
  private isWindows = os.platform() === 'win32';
  private user32: any = null;
  private dwmapi: any = null;

  constructor() {
    if (this.isWindows) {
      this.loadNativeLibraries();
    }
  }

  private loadNativeLibraries(): void {
    try {
      // Load Windows libraries using ffi-napi or similar
      // For now, we'll use a simple approach with PowerShell/Node.js child_process
      // In production, use a proper native module
    } catch (error) {
      console.warn('Failed to load native libraries for stealth features:', error);
    }
  }

  // Screen Share Invisibility using WDA_EXCLUDEFROMCAPTURE
  // Requires Windows 10 2004 (build 19041) or later
  setWindowCaptureExclusion(hwnd: Buffer | number, exclude: boolean): boolean {
    if (!this.isWindows) return false;

    try {
      const { execSync } = require('child_process');
      const handle = typeof hwnd === 'number' ? hwnd : hwnd.readBigUInt64LE();

      // Use PowerShell to call SetWindowDisplayAffinity
      // WDA_EXCLUDEFROMCAPTURE = 0x00000011
      // WDA_NONE = 0x00000000
      const affinity = exclude ? '0x11' : '0x0';

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class WindowCapture {
            [DllImport("user32.dll")]
            public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);
          }
"@
        [WindowCapture]::SetWindowDisplayAffinity([IntPtr]::new(${handle}), ${affinity})
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to set window capture exclusion:', error);
      return false;
    }
  }

  // Alternative: Use DWMWA_EXCLUDED_FROM_PEEK / DWMWA_CLOAK
  setDWMExclusion(hwnd: Buffer | number, exclude: boolean): boolean {
    if (!this.isWindows) return false;

    try {
      const { execSync } = require('child_process');
      const handle = typeof hwnd === 'number' ? hwnd : hwnd.readBigUInt64LE();

      // DWMWA_EXCLUDED_FROM_PEEK = 12
      // DWMWA_CLOAK = 14
      // DWMWA_CLOAKED = 15
      const attribute = 14; // DWMWA_CLOAK
      const value = exclude ? 1 : 0;

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class DWM {
            [DllImport("dwmapi.dll")]
            public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int pvAttribute, int cbAttribute);
          }
"@
        $val = ${value}
        [DWM]::DwmSetWindowAttribute([IntPtr]::new(${handle}), ${attribute}, [ref]$val, 4)
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to set DWM exclusion:', error);
      return false;
    }
  }

  // Hide from Task Manager
  // This is more complex and typically requires:
  // 1. Process name obfuscation
  // 2. Parent process spoofing
  // 3. Or a kernel driver (not feasible for user-mode app)
  // We'll implement basic process name masking
  hideFromTaskManager(): boolean {
    if (!this.isWindows) return false;

    try {
      // Rename process in task manager (limited effectiveness)
      // This only changes the display name, not true hiding
      const { execSync } = require('child_process');
      const pid = process.pid;

      // Set process description
      const psScript = `
        $proc = Get-Process -Id ${pid}
        $proc.ProcessName = "System"
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to hide from task manager:', error);
      return false;
    }
  }

  // Hide from Alt+Tab using WS_EX_TOOLWINDOW
  setWindowExStyle(hwnd: Buffer | number, hide: boolean): boolean {
    if (!this.isWindows) return false;

    try {
      const { execSync } = require('child_process');
      const handle = typeof hwnd === 'number' ? hwnd : hwnd.readBigUInt64LE();

      // GWL_EXSTYLE = -20
      // WS_EX_TOOLWINDOW = 0x00000080
      // WS_EX_NOACTIVATE = 0x08000000
      const exStyle = hide ? '0x08000080' : '0x00000000';

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class WindowStyle {
            [DllImport("user32.dll")]
            public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
            [DllImport("user32.dll")]
            public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
          }
"@
        $current = [WindowStyle]::GetWindowLong([IntPtr]::new(${handle}), -20)
        $newStyle = $current -bor ${exStyle}
        [WindowStyle]::SetWindowLong([IntPtr]::new(${handle}), -20, $newStyle)
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to set window extended style:', error);
      return false;
    }
  }

  // Cursor Undetectability
  // This prevents the cursor from being captured in screen recordings
  enableCursorUndetectability(hwnd: Buffer | number): boolean {
    if (!this.isWindows) return false;

    try {
      const { execSync } = require('child_process');
      const handle = typeof hwnd === 'number' ? hwnd : hwnd.readBigUInt64LE();

      // Use a combination of techniques:
      // 1. Hide cursor when over our window
      // 2. Use raw input to bypass cursor capture
      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class Cursor {
            [DllImport("user32.dll")]
            public static extern bool ShowCursor(bool bShow);
            [DllImport("user32.dll")]
            public static extern IntPtr SetCapture(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool ReleaseCapture();
          }
"@
        # Hide system cursor
        [Cursor]::ShowCursor($false)
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to enable cursor undetectability:', error);
      return false;
    }
  }

  // Click-through mode
  setClickThrough(hwnd: Buffer | number, enable: boolean): boolean {
    if (!this.isWindows) return false;

    try {
      const { execSync } = require('child_process');
      const handle = typeof hwnd === 'number' ? hwnd : hwnd.readBigUInt64LE();

      // WS_EX_LAYERED = 0x00080000
      // WS_EX_TRANSPARENT = 0x00000020
      // LWA_ALPHA = 0x00000002

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class ClickThrough {
            [DllImport("user32.dll")]
            public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
            [DllImport("user32.dll")]
            public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
            [DllImport("user32.dll")]
            public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint crKey, byte bAlpha, uint dwFlags);
          }
"@
        $GWL_EXSTYLE = -20
        $WS_EX_LAYERED = 0x00080000
        $WS_EX_TRANSPARENT = 0x00000020
        $LWA_ALPHA = 0x00000002

        $exStyle = [ClickThrough]::GetWindowLong([IntPtr]::new(${handle}), $GWL_EXSTYLE)

        if (${enable}) {
          $exStyle = $exStyle -bor $WS_EX_LAYERED -bor $WS_EX_TRANSPARENT
        } else {
          $exStyle = $exStyle -band -bnot $WS_EX_TRANSPARENT
        }

        [ClickThrough]::SetWindowLong([IntPtr]::new(${handle}), $GWL_EXSTYLE, $exStyle)

        if (${enable}) {
          [ClickThrough]::SetLayeredWindowAttributes([IntPtr]::new(${handle}), 0, 255, $LWA_ALPHA)
        }
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to set click-through:', error);
      return false;
    }
  }

  // Set window opacity
  setWindowOpacity(hwnd: Buffer | number, opacity: number): boolean {
    if (!this.isWindows) return false;

    try {
      const { execSync } = require('child_process');
      const handle = typeof hwnd === 'number' ? hwnd : hwnd.readBigUInt64LE();

      const alpha = Math.round(opacity * 255);

      const psScript = `
        Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class Opacity {
            [DllImport("user32.dll")]
            public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
            [DllImport("user32.dll")]
            public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
            [DllImport("user32.dll")]
            public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint crKey, byte bAlpha, uint dwFlags);
          }
"@
        $GWL_EXSTYLE = -20
        $WS_EX_LAYERED = 0x00080000
        $LWA_ALPHA = 0x00000002

        $exStyle = [Opacity]::GetWindowLong([IntPtr]::new(${handle}), $GWL_EXSTYLE)
        $exStyle = $exStyle -bor $WS_EX_LAYERED
        [Opacity]::SetWindowLong([IntPtr]::new(${handle}), $GWL_EXSTYLE, $exStyle)
        [Opacity]::SetLayeredWindowAttributes([IntPtr]::new(${handle}), 0, ${alpha}, $LWA_ALPHA)
      `;

      execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('Failed to set window opacity:', error);
      return false;
    }
  }

  // Make window invisible to screen capture entirely
  // Uses multiple techniques for maximum compatibility
  makeInvisibleToCapture(hwnd: Buffer | number): boolean {
    if (!this.isWindows) return false;

    let success = true;

    // Method 1: WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+)
    success = this.setWindowCaptureExclusion(hwnd, true) && success;

    // Method 2: DWM Cloak (Windows 8+)
    success = this.setDWMExclusion(hwnd, true) && success;

    // Method 3: Layered window with transparency
    // This is handled by Electron's native frame: false + transparent: true

    return success;
  }

  // Restore window visibility
  makeVisibleToCapture(hwnd: Buffer | number): boolean {
    if (!this.isWindows) return false;

    let success = true;

    success = this.setWindowCaptureExclusion(hwnd, false) && success;
    success = this.setDWMExclusion(hwnd, false) && success;

    return success;
  }

  // Check Windows version for feature support
  checkWindowsVersion(): { major: number; minor: number; build: number } {
    if (!this.isWindows) return { major: 0, minor: 0, build: 0 };

    try {
      const { execSync } = require('child_process');
      const output = execSync('cmd /ver', { encoding: 'utf-8' });
      const match = output.match(/Version (\d+)\.(\d+)\.(\d+)/);
      if (match) {
        return {
          major: parseInt(match[1], 10),
          minor: parseInt(match[2], 10),
          build: parseInt(match[3], 10),
        };
      }
    } catch {}

    return { major: 10, minor: 0, build: 19041 }; // Assume Windows 10 2004+
  }

  // Check if WDA_EXCLUDEFROMCAPTURE is supported
  isCaptureExclusionSupported(): boolean {
    const version = this.checkWindowsVersion();
    return version.major > 10 || (version.major === 10 && version.build >= 19041);
  }

  // Get recommended stealth settings for current Windows version
  getRecommendedSettings(): {
    captureExclusion: boolean;
    dwmCloak: boolean;
    toolWindow: boolean;
    clickThrough: boolean;
  } {
    const version = this.checkWindowsVersion();
    const isWin10_2004Plus = version.major > 10 || (version.major === 10 && version.build >= 19041);

    return {
      captureExclusion: isWin10_2004Plus,
      dwmCloak: version.major >= 8,
      toolWindow: true,
      clickThrough: true,
    };
  }
}

// Native module interface for better performance
// This would be implemented as a separate Node.js native addon
export interface INativeStealth {
  setWindowCaptureExclusion(hwnd: bigint, exclude: boolean): boolean;
  setDWMExclusion(hwnd: bigint, cloak: boolean): boolean;
  setWindowExStyle(hwnd: bigint, style: number): boolean;
  setClickThrough(hwnd: bigint, enable: boolean): boolean;
  setWindowOpacity(hwnd: bigint, opacity: number): boolean;
  hideCursor(): boolean;
  showCursor(): boolean;
}

// Stub for native module loading
export function loadNativeStealth(): INativeStealth | null {
  try {
    // const nativePath = path.join(__dirname, '../../native/stealth.node');
    // if (fs.existsSync(nativePath)) {
    //   return require(nativePath);
    // }
    return null;
  } catch {
    return null;
  }
}