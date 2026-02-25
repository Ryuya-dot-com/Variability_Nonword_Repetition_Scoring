/**
 * app.js - main controller for Nonword Repetition scoring app.
 */
const App = (() => {
  let _dataset = null;
  let _participants = [];
  let _items = [];
  let _audioKey = null;
  let _loadGeneration = 0;
  let _setupListenersAttached = false;
  let _scoringListenersAttached = false;

  async function init() {
    try {
      await DataLoader.loadManifest();
      _items = DataLoader.getTrialTemplate();
    } catch (e) {
      document.body.innerHTML = `<div style="padding:24px;color:#ef4444;">` +
        `<h2>Failed to load manifest</h2><p>${e.message}</p>` +
        `<p>Run: <code>python3 build/prepare-data.py</code></p></div>`;
      return;
    }

    renderSetupScreen();
    setupKeyboardShortcuts();
  }

  function renderSetupScreen() {
    document.getElementById('setup-screen').style.display = '';
    document.getElementById('scoring-screen').style.display = 'none';

    renderDatasetSelector();
    renderParticipantSelector();

    if (!_setupListenersAttached) {
      _setupListenersAttached = true;

      document.getElementById('dataset-selector').addEventListener('change', () => {
        renderParticipantSelector();
        checkResume();
      });

      document.getElementById('select-all-btn').addEventListener('click', () => {
        document.querySelectorAll('#participant-selector input[type="checkbox"]').forEach(cb => {
          cb.checked = true;
        });
        updateStartButton();
      });

      document.getElementById('deselect-all-btn').addEventListener('click', () => {
        document.querySelectorAll('#participant-selector input[type="checkbox"]').forEach(cb => {
          cb.checked = false;
        });
        updateStartButton();
      });

      document.getElementById('participant-selector').addEventListener('change', updateStartButton);
      document.getElementById('rater-id').addEventListener('input', () => {
        updateStartButton();
        checkResume();
      });

      document.getElementById('start-btn').addEventListener('click', startScoring);
      document.getElementById('resume-btn').addEventListener('click', resumeScoring);
    }

    updateStartButton();
    checkResume();
  }

  function renderDatasetSelector() {
    const container = document.getElementById('dataset-selector');
    const datasets = DataLoader.getDatasets();

    container.innerHTML = '';
    datasets.forEach((ds, i) => {
      const label = document.createElement('label');
      label.innerHTML =
        `<input type="radio" name="dataset" value="${ds.id}" ${i === 0 ? 'checked' : ''}>` +
        `<span>${ds.label} (${ds.participants.length} participants)</span>`;
      container.appendChild(label);
    });
  }

  function renderParticipantSelector() {
    const container = document.getElementById('participant-selector');
    const ds = DataLoader.getDataset(getSelectedDatasetId());
    if (!ds) return;

    container.innerHTML = '';

    ds.participants.forEach(p => {
      const label = document.createElement('label');
      const timingTag = p.timing === 'mixed' ? '' : ` [${p.timing}]`;
      label.innerHTML = `<input type="checkbox" value="${p.key}" checked> ${p.id}${timingTag}`;
      container.appendChild(label);
    });

    document.getElementById('participant-count').textContent = ds.participants.length;
  }

  function getSelectedDatasetId() {
    const checked = document.querySelector('input[name="dataset"]:checked');
    return checked ? checked.value : null;
  }

  function getSelectedParticipantKeys() {
    return Array.from(document.querySelectorAll('#participant-selector input[type="checkbox"]:checked'))
      .map(cb => cb.value);
  }

  function updateStartButton() {
    const rater = document.getElementById('rater-id').value.trim();
    const selected = getSelectedParticipantKeys();
    document.getElementById('start-btn').disabled = !rater || selected.length === 0;
  }

  function checkResume() {
    const rater = document.getElementById('rater-id').value.trim();
    const datasetId = getSelectedDatasetId();
    const section = document.getElementById('resume-section');

    if (!rater || !datasetId) {
      section.style.display = 'none';
      return;
    }

    const existing = State.load(rater, datasetId);
    if (!existing) {
      section.style.display = 'none';
      return;
    }

    const scored = State.getAssignedScoredCount(_items.length);
    document.getElementById('resume-info').textContent =
      `${existing.assignedParticipants.length} participants assigned, ${scored} items scored. ` +
      `Last saved: ${new Date(existing.lastSaved).toLocaleString()}`;
    section.style.display = 'block';
  }

  function startScoring() {
    const rater = document.getElementById('rater-id').value.trim();
    const datasetId = getSelectedDatasetId();
    const participantKeys = getSelectedParticipantKeys();

    State.create(rater, datasetId, participantKeys);
    enterScoringScreen(datasetId, participantKeys, 0, 0);
  }

  function resumeScoring() {
    const state = State.get();
    if (!state) return;

    enterScoringScreen(
      state.datasetId,
      state.assignedParticipants,
      state.currentParticipantIndex,
      state.currentItemIndex
    );
  }

  function enterScoringScreen(datasetId, participantKeys, startPIndex, startIIndex) {
    _dataset = DataLoader.getDataset(datasetId);
    _items = DataLoader.getTrialTemplate();
    _participants = participantKeys
      .map(k => DataLoader.getParticipantByKey(k))
      .filter(Boolean);

    if (!_dataset || _participants.length === 0) {
      alert('No participants available for scoring.');
      return;
    }

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('scoring-screen').style.display = '';
    document.getElementById('dataset-label').textContent = _dataset.label;

    WaveformViewer.init();
    ScoringUI.init(() => {
      Navigation.updateProgress();
      showSaveStatus();
    });

    if (!_scoringListenersAttached) {
      _scoringListenersAttached = true;

      document.getElementById('back-to-setup').addEventListener('click', () => {
        ScoringUI.saveCurrentScore();
        WaveformViewer.destroy();
        _audioKey = null;
        renderSetupScreen();
      });

      document.getElementById('play-btn').addEventListener('click', () => {
        WaveformViewer.play();
        updatePlayButton();
      });

      document.getElementById('stop-btn').addEventListener('click', () => {
        WaveformViewer.stop();
        updatePlayButton();
      });

      document.getElementById('playback-speed').addEventListener('change', e => {
        WaveformViewer.setPlaybackRate(parseFloat(e.target.value));
      });

      document.getElementById('export-participant').addEventListener('click', () => {
        Export.exportCurrentParticipant(_dataset, _items);
      });

      document.getElementById('export-all-csv').addEventListener('click', () => {
        Export.exportSelectedCSV(_dataset, _participants, _items);
      });
    }

    Navigation.init(_dataset, _participants, _items, {
      onNavigate: loadItem,
      onParticipantComplete: (participant, dataset, items) => {
        Export.showParticipantExportPopup(participant, dataset, items);
      }
    });

    const safeP = Math.min(startPIndex, _participants.length - 1);
    const safeI = Math.min(startIIndex, _items.length - 1);
    _audioKey = null;
    Navigation.navigate(safeP, safeI);
  }

  async function loadItem(_pIndex, _iIndex, participant, item) {
    const generation = ++_loadGeneration;

    ScoringUI.renderItem(participant, item, _items.length);

    const audioKey = `${participant.key}:${item.slide}`;
    if (audioKey === _audioKey) {
      updatePlayButton();
      return;
    }

    const audioUrl = DataLoader.getAudioUrl(participant, item.slide);

    try {
      await WaveformViewer.loadAudio(audioUrl);
      if (generation !== _loadGeneration) return;
      _audioKey = audioKey;
      updatePlayButton();
    } catch (e) {
      if (generation !== _loadGeneration) return;
      console.error('Audio load failed:', e);
      alert(`Audio load failed: ${audioUrl}`);
    }
  }

  function updatePlayButton() {
    const btn = document.getElementById('play-btn');
    if (!btn) return;
    btn.textContent = WaveformViewer.isPlaying() ? 'Pause' : 'Play';
  }

  function showSaveStatus() {
    const el = document.getElementById('save-status');
    el.textContent = 'Saving...';
    el.style.color = 'var(--warn)';
    setTimeout(() => {
      el.textContent = 'Saved';
      el.style.color = 'var(--ok)';
    }, 500);
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (document.getElementById('scoring-screen').style.display === 'none') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          WaveformViewer.play();
          updatePlayButton();
          break;
        case '0':
          ScoringUI.scoreByKey('0');
          break;
        case '1':
          ScoringUI.scoreByKey('1');
          break;
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          Navigation.nextItem();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          Navigation.prevItem();
          break;
        case 'PageDown':
          e.preventDefault();
          Navigation.nextParticipant();
          break;
        case 'PageUp':
          e.preventDefault();
          Navigation.prevParticipant();
          break;
        case 'n':
        case 'N':
          document.getElementById('item-notes').focus();
          break;
        case '+':
        case '=':
          WaveformViewer.zoomIn();
          break;
        case '-':
          WaveformViewer.zoomOut();
          break;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
