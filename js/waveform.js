/**
 * waveform.js - playback/zoom wrapper.
 * Falls back to native <audio> when WaveSurfer is unavailable.
 */
const WaveformViewer = (() => {
  let wavesurfer = null;
  let minimapPlugin = null;
  let timelinePlugin = null;
  let audioEl = null;
  let _mode = 'wavesurfer';

  const containerEl = '#waveform-container';
  const BASE_PX_PER_SEC = 100;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 20;
  let _zoomLevel = 1;

  function init() {
    cleanup();

    bindZoomButtons();
    _zoomLevel = 1;
    updateZoomDisplay();

    if (!window.WaveSurfer || typeof window.WaveSurfer.create !== 'function') {
      initAudioFallback('WaveSurfer library not loaded');
      return;
    }

    try {
      wavesurfer = WaveSurfer.create({
        container: containerEl,
        waveColor: '#38bdf8',
        progressColor: '#0ea5e9',
        cursorColor: '#f8fafc',
        height: 150,
        // Keep absolute amplitude (no normalization) so the main view
        // matches the minimap impression and avoids visual exaggeration.
        normalize: false,
        minPxPerSec: BASE_PX_PER_SEC,
        autoScroll: true,
        autoCenter: true
      });

      try {
        minimapPlugin = wavesurfer.registerPlugin(
          WaveSurfer.Minimap.create({
            container: '#waveform-minimap',
            height: 30,
            waveColor: '#475569',
            progressColor: '#0284c7',
            cursorColor: '#f8fafc'
          })
        );
      } catch (e) {
        console.warn('Minimap plugin unavailable', e);
        minimapPlugin = null;
      }

      try {
        timelinePlugin = wavesurfer.registerPlugin(
          WaveSurfer.Timeline.create({
            container: '#waveform-timeline',
            style: { color: '#9ca3af', fontSize: '11px' },
            timeInterval: 0.5,
            primaryLabelInterval: 1
          })
        );
      } catch (e) {
        console.warn('Timeline plugin unavailable', e);
        timelinePlugin = null;
      }

      wavesurfer.on('audioprocess', updateTimeDisplay);
      wavesurfer.on('seeking', updateTimeDisplay);
      wavesurfer.on('ready', updateTimeDisplay);
      _mode = 'wavesurfer';
    } catch (e) {
      console.error('WaveSurfer init failed, falling back to native audio:', e);
      initAudioFallback('WaveSurfer init failed');
    }
  }

  function bindZoomButtons() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    if (zoomInBtn) zoomInBtn.onclick = zoomIn;
    if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
    if (zoomResetBtn) zoomResetBtn.onclick = zoomReset;
  }

  function initAudioFallback(reason) {
    _mode = 'audio';

    const container = document.querySelector(containerEl);
    if (!container) return;

    container.innerHTML = '';
    audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.preload = 'auto';
    audioEl.style.width = '100%';
    audioEl.style.margin = '8px 0';
    container.appendChild(audioEl);

    const timelineEl = document.getElementById('waveform-timeline');
    const minimapEl = document.getElementById('waveform-minimap');
    if (timelineEl) timelineEl.textContent = 'Waveform unavailable (native audio mode)';
    if (minimapEl) minimapEl.textContent = '';

    audioEl.addEventListener('timeupdate', updateTimeDisplay);
    audioEl.addEventListener('loadedmetadata', updateTimeDisplay);
    audioEl.addEventListener('ended', updateTimeDisplay);

    console.warn(`Waveform fallback active: ${reason}`);
    updateTimeDisplay();
  }

  function updateTimeDisplay() {
    const el = document.getElementById('waveform-time');
    if (!el) return;

    if (_mode === 'wavesurfer' && wavesurfer) {
      const current = wavesurfer.getCurrentTime().toFixed(3);
      const total = wavesurfer.getDuration().toFixed(3);
      el.textContent = `${current}s / ${total}s`;
      return;
    }

    if (_mode === 'audio' && audioEl) {
      const current = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
      const total = Number.isFinite(audioEl.duration) ? audioEl.duration : 0;
      el.textContent = `${current.toFixed(3)}s / ${total.toFixed(3)}s`;
      return;
    }

    el.textContent = '0.000s / 0.000s';
  }

  function loadAudio(url) {
    if (!wavesurfer && !audioEl) init();
    _zoomLevel = 1;
    updateZoomDisplay();

    if (_mode === 'audio' && audioEl) {
      return new Promise((resolve, reject) => {
        const onReady = () => {
          audioEl.removeEventListener('loadedmetadata', onReady);
          audioEl.removeEventListener('error', onError);
          updateTimeDisplay();
          resolve();
        };
        const onError = () => {
          audioEl.removeEventListener('loadedmetadata', onReady);
          audioEl.removeEventListener('error', onError);
          reject(new Error(`Audio load failed: ${url}`));
        };

        audioEl.pause();
        audioEl.src = url;
        audioEl.currentTime = 0;
        audioEl.addEventListener('loadedmetadata', onReady);
        audioEl.addEventListener('error', onError);
        audioEl.load();
      });
    }

    return new Promise((resolve, reject) => {
      wavesurfer.once('ready', () => {
        applyZoom();
        updateTimeDisplay();
        resolve();
      });
      wavesurfer.once('error', reject);
      wavesurfer.load(url);
    });
  }

  function zoomIn() {
    _zoomLevel = Math.min(_zoomLevel * 1.5, MAX_ZOOM);
    applyZoom();
  }

  function zoomOut() {
    _zoomLevel = Math.max(_zoomLevel / 1.5, MIN_ZOOM);
    applyZoom();
  }

  function zoomReset() {
    _zoomLevel = 1;
    applyZoom();
  }

  function applyZoom() {
    if (_mode === 'wavesurfer' && wavesurfer) {
      wavesurfer.zoom(_zoomLevel * BASE_PX_PER_SEC);
    }
    updateZoomDisplay();
  }

  function updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (!el) return;
    if (_mode === 'audio') {
      el.textContent = 'audio';
      return;
    }
    el.textContent = `${_zoomLevel.toFixed(1)}x`;
  }

  function play() {
    if (_mode === 'audio' && audioEl) {
      if (audioEl.paused) {
        audioEl.play().catch(err => console.warn('audio play failed', err));
      } else {
        audioEl.pause();
      }
      return;
    }

    if (wavesurfer) wavesurfer.playPause();
  }

  function stop() {
    if (_mode === 'audio' && audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      updateTimeDisplay();
      return;
    }

    if (wavesurfer) wavesurfer.stop();
  }

  function setPlaybackRate(rate) {
    if (_mode === 'audio' && audioEl) {
      audioEl.playbackRate = rate;
      return;
    }

    if (wavesurfer) wavesurfer.setPlaybackRate(rate);
  }

  function isPlaying() {
    if (_mode === 'audio' && audioEl) {
      return !audioEl.paused;
    }
    return wavesurfer ? wavesurfer.isPlaying() : false;
  }

  function cleanup() {
    if (wavesurfer) {
      wavesurfer.destroy();
      wavesurfer = null;
    }
    minimapPlugin = null;
    timelinePlugin = null;

    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
      audioEl.remove();
      audioEl = null;
    }
  }

  function destroy() {
    cleanup();
  }

  return {
    init,
    loadAudio,
    play,
    stop,
    setPlaybackRate,
    isPlaying,
    zoomIn,
    zoomOut,
    zoomReset,
    destroy
  };
})();
