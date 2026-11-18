import { EventEmitter } from 'events';
import { Settings, TranscriptSegment } from '@shared/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, execFile } from 'child_process';
import { whisperBinDir, modelsDir, bundledModelsDir } from '../paths';

const MODEL_URLS: Record<string, string> = {
  'ggml-tiny.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  'ggml-base.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'ggml-small.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'ggml-medium.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  'ggml-large-v3.bin': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
};

/**
 * Local whisper.cpp transcription.
 * Models: bundled read-only copy if present, otherwise downloaded once into userData.
 * Audio: raw s16le 16kHz mono is wrapped in a WAV container before decoding.
 */
export class WhisperTranscriber extends EventEmitter {
  private settings: Settings;
  private whisperProcess: any = null;
  private isInitialized = false;
  private isProcessing = false;
  private audioBuffer: Buffer[] = [];
  private bufferDuration = 0;
  private readonly BUFFER_TARGET_MS = 3000;
  private readonly SAMPLE_RATE = 16000;
  private readonly BYTES_PER_SAMPLE = 2;
  private segmentId = 0;
  private languageCode = 'en';
  private downloading: Promise<string> | null = null;

  onTranscript: ((segment: TranscriptSegment) => void) | null = null;
  onStatus: ((status: { status: 'loading' | 'ready' | 'error'; progress?: number; error?: string }) => void) | null = null;

  constructor(settings: Settings) {
    super();
    this.settings = settings;
    this.languageCode = this.mapLanguage(settings.whisperLanguage || 'en');
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
    this.languageCode = this.mapLanguage(settings.whisperLanguage || 'en');
    if (this.isInitialized) {
      void this.initialize();
    }
  }

  private mapLanguage(lang: string): string {
    const langMap: Record<string, string> = {
      english: 'en', spanish: 'es', french: 'fr', german: 'de',
      italian: 'it', portuguese: 'pt', russian: 'ru', chinese: 'zh',
      japanese: 'ja', korean: 'ko', arabic: 'ar', hindi: 'hi',
      auto: 'auto',
    };
    return langMap[lang.toLowerCase()] || lang;
  }

  /**
   * Resolve the binary + an already-present model file. Never downloads here:
   * a multi-GB download at startup would block the whole app window.
   * Missing models are fetched lazily on first transcription (see getModelPath).
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.emitStatus({ status: 'loading', progress: 0 });

    try {
      const whisperPath = await this.getWhisperBinary();
      if (!whisperPath) {
        throw new Error('whisper.cpp binary not found. Reinstall the app.');
      }

      const existing = this.findExistingModel();
      this.isInitialized = true;

      if (existing) {
        this.emitStatus({ status: 'ready', progress: 100 });
        console.log('[Whisper] ready:', path.basename(existing));
      } else {
        // Loaded but model not on disk yet — downloaded on first use.
        this.emitStatus({ status: 'loading', progress: 0 });
        console.log('[Whisper] binary ready, model', this.modelFilename(), 'will download on first use');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Whisper] init error:', message);
      this.emitStatus({ status: 'error', error: message });
      throw error;
    }
  }

  /** Bundled copy first, then a previously downloaded copy. No network. */
  private findExistingModel(): string | null {
    const name = this.modelFilename();
    const bundled = path.join(bundledModelsDir(), name);
    if (fs.existsSync(bundled)) return bundled;
    const local = path.join(modelsDir(), name);
    if (fs.existsSync(local)) return local;
    return null;
  }

  private async getWhisperBinary(): Promise<string | null> {
    const candidates = [
      path.join(whisperBinDir(), 'whisper-cli.exe'),
      path.join(whisperBinDir(), 'main.exe'),
      path.join(whisperBinDir(), 'whisper.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('whisper-cli', ['--help'], { timeout: 5000 }, (err) => (err ? reject(err) : resolve()));
      });
      return 'whisper-cli';
    } catch {
      return null;
    }
  }

  private modelFilename(): string {
    return `ggml-${this.settings.whisperModel || 'base'}.bin`;
  }

  private async getModelPath(): Promise<string> {
    const existing = this.findExistingModel();
    if (existing) return existing;
    const downloaded = await this.downloadModel(this.modelFilename());
    this.emitStatus({ status: 'ready', progress: 100 });
    return downloaded;
  }

  private async downloadModel(modelName: string): Promise<string> {
    if (this.downloading) return this.downloading;

    this.downloading = (async () => {
      const url = MODEL_URLS[modelName];
      if (!url) throw new Error(`Unknown Whisper model: ${modelName}`);

      const target = path.join(modelsDir(), modelName);
      const tmp = `${target}.part`;
      this.emitStatus({ status: 'loading', progress: 5 });
      console.log('[Whisper] downloading model', modelName);

      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`Model download failed (${res.status})`);

      const total = Number(res.headers.get('content-length') || 0);
      let got = 0;
      const out = fs.createWriteStream(tmp);

      // Node 18+ ReadableStream is async-iterable
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        const buf = Buffer.from(chunk as Uint8Array);
        got += buf.length;
        out.write(buf);
        if (total) {
          this.emitStatus({ status: 'loading', progress: 5 + Math.floor((got / total) * 90) });
        }
      }
      await new Promise<void>((resolve, reject) => out.end((err?: Error) => (err ? reject(err) : resolve())));
      fs.renameSync(tmp, target);
      this.emitStatus({ status: 'loading', progress: 95 });
      console.log('[Whisper] model saved:', target);
      return target;
    })();

    try {
      return await this.downloading;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.emitStatus({ status: 'error', error: msg });
      throw e;
    } finally {
      this.downloading = null;
    }
  }

  /** Wrap raw PCM in a minimal WAV header so whisper.cpp can decode it. */
  private writeWav(pcm: Buffer, file: string): void {
    const header = Buffer.alloc(44);
    const byteRate = this.SAMPLE_RATE * this.BYTES_PER_SAMPLE;
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(this.SAMPLE_RATE, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(this.BYTES_PER_SAMPLE, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(file, Buffer.concat([header, pcm]));
  }

  async processAudio(audioData: Buffer): Promise<void> {
    if (!this.isInitialized || this.isProcessing) return;

    this.audioBuffer.push(audioData);
    this.bufferDuration += (audioData.length / this.BYTES_PER_SAMPLE / this.SAMPLE_RATE) * 1000;

    // Never let the backlog grow unbounded (e.g. while a model is downloading)
    while (this.bufferDuration > 60000 && this.audioBuffer.length > 1) {
      const dropped = this.audioBuffer.shift();
      if (!dropped) break;
      this.bufferDuration -= (dropped.length / this.BYTES_PER_SAMPLE / this.SAMPLE_RATE) * 1000;
    }

    if (this.bufferDuration >= this.BUFFER_TARGET_MS) {
      await this.transcribeBuffer();
    }
  }

  private async transcribeBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0 || this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pcm = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];
      this.bufferDuration = 0;

      // Silence gate: whisper.cpp happily "hears" words in noise, which shows
      // up as phantom segments ("you", "Thank you.") between questions.
      if (this.isSilent(pcm)) return;

      const tempDir = path.join(os.tmpdir(), 'interview-copilot-whisper');
      fs.mkdirSync(tempDir, { recursive: true });
      const wavFile = path.join(tempDir, `audio_${Date.now()}.wav`);
      this.writeWav(pcm, wavFile);

      const whisperPath = await this.getWhisperBinary();
      const modelPath = await this.getModelPath();
      if (!whisperPath) throw new Error('whisper.cpp binary not available');

      const text = await this.runWhisper(whisperPath, modelPath, wavFile);
      try { fs.unlinkSync(wavFile); } catch {}

      if (text.trim() && !this.isHallucination(text)) {
        this.onTranscript?.(this.createTranscriptSegment({ text }));
      }
    } catch (error) {
      console.error('[Whisper] transcription error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /** RMS of 16-bit PCM below ~ -50 dBFS is treated as silence. */
  private isSilent(pcm: Buffer): boolean {
    const samples = Math.floor(pcm.length / 2);
    if (samples === 0) return true;
    let sum = 0;
    // Sample at most ~24k points; enough for a stable RMS estimate.
    const step = Math.max(1, Math.floor(samples / 24000));
    let counted = 0;
    for (let i = 0; i < samples; i += step) {
      const value = pcm.readInt16LE(i * 2) / 32768;
      sum += value * value;
      counted += 1;
    }
    const rms = Math.sqrt(sum / counted);
    return rms < 0.004;
  }

  private runWhisper(binary: string, modelPath: string, wavFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Note: -pp/--print-progress is a boolean flag in whisper.cpp — never pass
      // a value, otherwise it is parsed as an extra input file.
      const args = [
        '-m', modelPath,
        '-f', wavFile,
        '-l', this.languageCode,
        '-nt',
        '-np',
      ];

      if (this.settings.whisperDevice !== 'cuda') {
        args.push('--no-gpu');
      }

      const child = spawn(binary, args, { windowsHide: true });
      this.whisperProcess = child;

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));

      child.on('error', reject);
      child.on('close', (code) => {
        this.whisperProcess = null;
        const out = stdout.trim();
        if (code === 0) return resolve(this.cleanText(out));
        if (out) return resolve(this.cleanText(out));
        reject(new Error(`whisper.cpp exited ${code}: ${stderr.slice(-300)}`));
      });
    });
  }

  /** Short filler output whisper.cpp produces on music/noise rather than speech. */
  private isHallucination(text: string): boolean {
    const normalized = text.trim().toLowerCase().replace(/[.!?,]+$/, '');
    if (normalized.length === 0) return true;
    const fillers = ['you', 'thank you', 'thanks', 'bye', 'okay', 'hmm', 'mm', 'music', 'applause', 'silence'];
    if (fillers.includes(normalized)) return true;
    // Whisper annotates non-speech as [MUSIC], (silence), etc.
    if (/^[\[(].*[\])]$/.test(normalized)) return true;
    return false;
  }

  private cleanText(raw: string): string {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^\[[\d:.\s\->]+\]$/.test(l))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createTranscriptSegment(result: { text: string }): TranscriptSegment {
    const now = Date.now();
    return {
      id: `seg_${++this.segmentId}_${now}`,
      speaker: this.detectSpeaker(result.text),
      text: result.text.trim(),
      timestamp: now,
      confidence: 0.9,
      isFinal: true,
    };
  }

  private detectSpeaker(text: string): 'interviewer' | 'candidate' | 'system' {
    const questionPatterns = [/\?$/, /^(what|how|why|when|where|who|which|can you|could you|tell me|describe)\b/i];
    return questionPatterns.some((p) => p.test(text)) ? 'interviewer' : 'candidate';
  }

  private emitStatus(status: { status: 'loading' | 'ready' | 'error'; progress?: number; error?: string }) {
    this.onStatus?.(status);
  }

  async shutdown(): Promise<void> {
    if (this.whisperProcess) {
      try { this.whisperProcess.kill(); } catch {}
      this.whisperProcess = null;
    }
    this.isInitialized = false;
  }
}
