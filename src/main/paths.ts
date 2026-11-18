import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Central path resolution so the app works both in `npm run dev`/`npm start`
 * and inside a packaged (asar) build.
 */
export function resourcesRoot(): string {
  return app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources');
}

/** Directory containing whisper-cli.exe + DLLs (extraResources: "whisper") */
export function whisperBinDir(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'whisper');
  return path.join(app.getAppPath(), 'resources', 'whisper');
}

/** Writable directory for whisper model files (userData, never Program Files) */
export function modelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'whisper-models');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Bundled read-only models directory (extraResources: "whisper/models") */
export function bundledModelsDir(): string {
  return path.join(whisperBinDir(), 'models');
}

export function ffmpegPath(): string {
  return path.join(resourcesRoot(), 'ffmpeg', 'ffmpeg.exe');
}

export function rendererFile(name: string): string {
  return path.join(app.getAppPath(), 'dist', 'renderer', name);
}

export function preloadFile(): string {
  return path.join(app.getAppPath(), 'dist', 'preload', 'preload.js');
}

export function iconFile(): string {
  return path.join(resourcesRoot(), 'icon.png');
}

export function trayIconFile(): string {
  return path.join(resourcesRoot(), 'tray-icon.png');
}
