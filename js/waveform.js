/**
 * waveform.js - WaveSurfer wrapper for playback/zoom controls.
 */
const WaveformViewer = (() => {
  let wavesurfer = null;
  let minimapPlugin = null;
  let timelinePlugin = null;

  const containerEl = '#waveform-container';
  const BASE_PX_PER_SEC = 100;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 20;
  let _zoomLevel = 1;

  function init() {
    if (wavesurfer) wavesurfer.destroy();

    wavesurfer = WaveSurfer.create({
      container: containerEl,
      waveColor: '#38bdf8',
      progressColor: '#0ea5e9',
      cursorColor: '#f8fafc',
      height: 150,
      normalize: true,
      barWidth: 2,
      barGap: 1,
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

    _zoomLevel = 1;
    updateZoomDisplay();

    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    if (zoomInBtn) zoomInBtn.onclick = zoomIn;
    if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
    if (zoomResetBtn) zoomResetBtn.onclick = zoomReset;
  }

  function updateTimeDisplay() {
    if (!wavesurfer) return;
    const current = wavesurfer.getCurrentTime().toFixed(3);
    const total = wavesurfer.getDuration().toFixed(3);
    const el = document.getElementById('waveform-time');
    if (el) el.textContent = `${current}s / ${total}s`;
  }

  function loadAudio(url) {
    if (!wavesurfer) init();
    _zoomLevel = 1;
    updateZoomDisplay();

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
    if (!wavesurfer) return;
    wavesurfer.zoom(_zoomLevel * BASE_PX_PER_SEC);
    updateZoomDisplay();
  }

  function updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${_zoomLevel.toFixed(1)}x`;
  }

  function play() {
    if (wavesurfer) wavesurfer.playPause();
  }

  function stop() {
    if (wavesurfer) wavesurfer.stop();
  }

  function setPlaybackRate(rate) {
    if (wavesurfer) wavesurfer.setPlaybackRate(rate);
  }

  function isPlaying() {
    return wavesurfer ? wavesurfer.isPlaying() : false;
  }

  function destroy() {
    if (wavesurfer) {
      wavesurfer.destroy();
      wavesurfer = null;
    }
    minimapPlugin = null;
    timelinePlugin = null;
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
