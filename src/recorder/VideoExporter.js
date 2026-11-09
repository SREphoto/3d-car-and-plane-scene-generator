export const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16 Reels / TikTok', width: 1080, height: 1920, ratio: 9 / 16 },
  { id: '16:9', label: '16:9 YouTube / X', width: 1920, height: 1080, ratio: 16 / 9 },
  { id: '4:5', label: '4:5 IG Portrait', width: 1080, height: 1350, ratio: 4 / 5 },
  { id: '1:1', label: '1:1 Square', width: 1080, height: 1080, ratio: 1 },
];

export class VideoExporter {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.chunks = [];
    this.recordCanvas = document.createElement('canvas');
    this.recordCtx = this.recordCanvas.getContext('2d');
    this.startTime = 0;
    this.targetDuration = 0;
    this.onProgress = null;
    this.onComplete = null;
  }

  static getSupportedMimeType() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const mime of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  startRecording({
    sourceCanvas,
    aspectRatioId = '9:16',
    durationSec = 12,
    audioTrack = null,
    overlayTitle = '',
    onProgress,
    onComplete,
  }) {
    if (this.isRecording) return;

    const spec = ASPECT_RATIOS.find((a) => a.id === aspectRatioId) || ASPECT_RATIOS[0];
    this.recordCanvas.width = spec.width;
    this.recordCanvas.height = spec.height;
    this.sourceCanvas = sourceCanvas;
    this.overlayTitle = overlayTitle;
    this.targetDuration = durationSec;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.chunks = [];

    const stream = this.recordCanvas.captureStream(60);
    if (audioTrack) {
      stream.addTrack(audioTrack);
    }

    const mimeType = VideoExporter.getSupportedMimeType();
    const options = mimeType
      ? { mimeType, videoBitsPerSecond: 14_000_000 }
      : { videoBitsPerSecond: 14_000_000 };

    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      const finalMime = this.mediaRecorder.mimeType || mimeType || 'video/webm';
      const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(this.chunks, { type: finalMime });
      const url = URL.createObjectURL(blob);
      if (this.onComplete) {
        this.onComplete({
          url,
          blob,
          ext,
          aspectRatioId,
          durationSec: ((performance.now() - this.startTime) / 1000).toFixed(1),
        });
      }
    };

    this.isRecording = true;
    this.startTime = performance.now();
    this.mediaRecorder.start(100);
  }

  captureFrame() {
    if (!this.isRecording || !this.sourceCanvas) return;

    const sw = this.sourceCanvas.width;
    const sh = this.sourceCanvas.height;
    const dw = this.recordCanvas.width;
    const dh = this.recordCanvas.height;

    const srcAspect = sw / sh;
    const dstAspect = dw / dh;

    let sx = 0;
    let sy = 0;
    let sWidth = sw;
    let sHeight = sh;

    // Center-crop source WebGL canvas into target Social Media aspect ratio
    if (srcAspect > dstAspect) {
      sWidth = sh * dstAspect;
      sx = (sw - sWidth) * 0.5;
    } else {
      sHeight = sw / dstAspect;
      sy = (sh - sHeight) * 0.5;
    }

    this.recordCtx.drawImage(this.sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, dw, dh);

    // Subtle cinematic letterbox vignette & title badge
    if (this.overlayTitle) {
      const grad = this.recordCtx.createLinearGradient(0, dh - 140, 0, dh);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.65)');
      this.recordCtx.fillStyle = grad;
      this.recordCtx.fillRect(0, dh - 140, dw, 140);

      this.recordCtx.fillStyle = 'rgba(255,255,255,0.92)';
      this.recordCtx.font = '700 26px "Outfit", sans-serif';
      this.recordCtx.fillText(this.overlayTitle.toUpperCase(), 42, dh - 48);
    }

    const elapsedSec = (performance.now() - this.startTime) / 1000;
    if (this.onProgress) {
      this.onProgress({
        elapsedSec,
        totalSec: this.targetDuration,
        progress: Math.min(1, elapsedSec / Math.max(1, this.targetDuration)),
      });
    }

    if (elapsedSec >= this.targetDuration) {
      this.stopRecording();
    }
  }

  stopRecording() {
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}
