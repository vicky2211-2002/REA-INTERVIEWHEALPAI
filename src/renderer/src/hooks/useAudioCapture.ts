import { useCallback, useRef } from 'react';

export interface CaptureOptions {
  systemAudio: boolean;
  microphone: boolean;
  micDeviceId?: string;
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
}

/**
 * Captures system (loopback) and/or microphone audio in the renderer using
 * Web Audio, resamples to 16 kHz mono s16le and streams it to the main process.
 *
 * This is how a desktop assistant captures "what the interviewer says" without
 * requiring Stereo Mix or a virtual cable.
 */
export function useAudioCapture() {
  const contextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sinkRef = useRef<GainNode | null>(null);
  const runningRef = useRef(false);

  const stop = useCallback(async () => {
    runningRef.current = false;
    try {
      processorRef.current?.disconnect();
      processorRef.current = null;
      sinkRef.current?.disconnect();
      sinkRef.current = null;
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      streamsRef.current = [];
      if (contextRef.current) {
        await contextRef.current.close().catch(() => undefined);
        contextRef.current = null;
      }
    } catch (error) {
      console.warn('[Audio] stop failed', error);
    }
  }, []);

  const start = useCallback(
    async (options: CaptureOptions) => {
      if (runningRef.current) return;
      const { systemAudio, microphone, micDeviceId, onLevel, onError } = options;

      try {
        const context = new AudioContext({ sampleRate: 16000 });
        contextRef.current = context;

        const sources: MediaStreamAudioSourceNode[] = [];

        if (systemAudio) {
          const loopback = await window.electronAPI.getLoopbackSource();
          if (!loopback) throw new Error('No screen source available for system audio.');

          const desktopStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // Electron loopback capture (no Stereo Mix required)
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: loopback.id,
              },
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: loopback.id,
              },
            },
          } as unknown as MediaStreamConstraints);

          // Video track is only a by-product of the capture request.
          desktopStream.getVideoTracks().forEach((track) => track.stop());
          streamsRef.current.push(desktopStream);
          sources.push(context.createMediaStreamSource(desktopStream));
        }

        if (microphone) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
          });
          streamsRef.current.push(micStream);
          sources.push(context.createMediaStreamSource(micStream));
        }

        if (sources.length === 0) {
          throw new Error('Enable system audio or microphone in Settings → Audio.');
        }

        const processor = context.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const sink = context.createGain();
        sink.gain.value = 0; // keep the graph alive without echoing audio back
        sinkRef.current = sink;

        sources.forEach((source) => {
          const gain = context.createGain();
          gain.gain.value = sources.length > 1 ? 0.7 : 1;
          source.connect(gain).connect(processor);
        });

        processor.connect(sink).connect(context.destination);

        processor.onaudioprocess = (event) => {
          if (!runningRef.current) return;
          const input = event.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          let sum = 0;
          for (let i = 0; i < input.length; i += 1) {
            const sample = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            sum += sample * sample;
          }
          const rms = Math.sqrt(sum / input.length);
          onLevel?.(Math.min(1, rms * 6));
          window.electronAPI.sendAudioChunk(pcm.buffer);
        };

        runningRef.current = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Audio] start failed:', message);
        onError?.(message);
        await stop();
        throw error;
      }
    },
    [stop],
  );

  return { start, stop, isRunning: () => runningRef.current };
}
