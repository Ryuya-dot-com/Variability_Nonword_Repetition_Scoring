/**
 * scoring-ui.js - accuracy/notes controls for a single nonword item.
 */
const ScoringUI = (() => {
  let _initialized = false;
  let _onScoreChanged = null;
  let _currentParticipant = null;
  let _currentItem = null;

  function init(onScoreChanged) {
    _onScoreChanged = onScoreChanged;
    if (_initialized) return;
    _initialized = true;
    setupScoreButtons();
    setupNotesField();
  }

  function setupScoreButtons() {
    document.querySelectorAll('.btn-score').forEach(btn => {
      btn.addEventListener('click', () => {
        const score = parseInt(btn.dataset.score, 10);
        setAccuracyScore(score);
      });
    });
  }

  function setupNotesField() {
    const notes = document.getElementById('item-notes');
    if (!notes) return;
    notes.addEventListener('input', () => {
      saveCurrentScore();
      if (_onScoreChanged) _onScoreChanged();
    });
  }

  function renderItem(participant, item, itemCount) {
    _currentParticipant = participant;
    _currentItem = item;

    const wordEl = document.getElementById('item-word');
    const taskEl = document.getElementById('task-badge');
    const detailsEl = document.getElementById('trial-details');
    const audioFileEl = document.getElementById('audio-file-label');

    wordEl.textContent = item.item;
    taskEl.textContent = item.task;

    detailsEl.innerHTML =
      `Slide <strong>${item.slide}</strong> | Trial <strong>${item.trial}</strong> | ` +
      `Item <strong>${item.index}/${itemCount}</strong> | ` +
      `In Trial: <strong>${item.itemOrderInTrial}</strong>`;

    const audioFile = DataLoader.getAudioFileName(participant, item.slide);
    audioFileEl.textContent = `Audio: ${audioFile}`;

    const existing = State.getScore(participant.key, item.index);
    if (existing) {
      highlightScoreButton(existing.accuracy);
      document.getElementById('item-notes').value = existing.note || '';
    } else {
      clearScoreButtons();
      document.getElementById('item-notes').value = '';
    }
  }

  function getActiveScore() {
    const active = document.querySelector('.btn-score.active');
    return active ? parseInt(active.dataset.score, 10) : null;
  }

  function setAccuracyScore(score) {
    highlightScoreButton(score);
    saveCurrentScore();
    if (_onScoreChanged) _onScoreChanged();
  }

  function highlightScoreButton(score) {
    document.querySelectorAll('.btn-score').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.score, 10) === score);
    });
  }

  function clearScoreButtons() {
    document.querySelectorAll('.btn-score').forEach(btn => btn.classList.remove('active'));
  }

  function saveCurrentScore() {
    if (!_currentParticipant || !_currentItem) return;

    const accuracy = getActiveScore();
    const note = document.getElementById('item-notes').value.trim();

    if (accuracy == null && !note) return;

    State.setScore(_currentParticipant.key, _currentItem.index, {
      accuracy,
      note
    });
  }

  function scoreByKey(key) {
    if (key === '0') setAccuracyScore(0);
    if (key === '1') setAccuracyScore(1);
  }

  return {
    init,
    renderItem,
    saveCurrentScore,
    getActiveScore,
    scoreByKey
  };
})();
