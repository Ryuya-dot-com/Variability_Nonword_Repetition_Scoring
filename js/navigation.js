/**
 * navigation.js - participant/item navigation.
 */
const Navigation = (() => {
  let _dataset = null;
  let _participants = [];
  let _items = [];
  let _pIndex = 0;
  let _iIndex = 0;
  let _onNavigate = null;
  let _onParticipantComplete = null;

  function init(dataset, participants, items, handlers) {
    _dataset = dataset;
    _participants = participants;
    _items = items;
    _pIndex = 0;
    _iIndex = 0;
    _onNavigate = handlers.onNavigate;
    _onParticipantComplete = handlers.onParticipantComplete;

    document.getElementById('prev-item').addEventListener('click', prevItem);
    document.getElementById('next-item').addEventListener('click', nextItem);
    document.getElementById('prev-participant').addEventListener('click', prevParticipant);
    document.getElementById('next-participant').addEventListener('click', nextParticipant);
    document.getElementById('jump-unscored').addEventListener('click', jumpToUnscored);
  }

  function setPosition(pIndex, iIndex) {
    _pIndex = pIndex;
    _iIndex = iIndex;
  }

  function navigate(pIndex, iIndex) {
    _pIndex = pIndex;
    _iIndex = iIndex;

    State.setPosition(_pIndex, _iIndex);
    updateIndicators();

    const participant = _participants[_pIndex];
    const item = _items[_iIndex];
    if (_onNavigate) _onNavigate(_pIndex, _iIndex, participant, item);
  }

  function maybeHandleParticipantComplete(participant) {
    if (!participant) return;
    if (State.isParticipantComplete(participant.key, _items.length)) {
      if (_onParticipantComplete) _onParticipantComplete(participant, _dataset, _items);
    }
  }

  function nextItem() {
    ScoringUI.saveCurrentScore();
    const currentParticipant = getCurrentParticipant();

    if (_iIndex < _items.length - 1) {
      navigate(_pIndex, _iIndex + 1);
      return;
    }

    maybeHandleParticipantComplete(currentParticipant);

    if (_pIndex < _participants.length - 1) {
      navigate(_pIndex + 1, 0);
    }
  }

  function prevItem() {
    ScoringUI.saveCurrentScore();

    if (_iIndex > 0) {
      navigate(_pIndex, _iIndex - 1);
      return;
    }

    if (_pIndex > 0) {
      navigate(_pIndex - 1, _items.length - 1);
    }
  }

  function nextParticipant() {
    ScoringUI.saveCurrentScore();
    maybeHandleParticipantComplete(getCurrentParticipant());
    if (_pIndex < _participants.length - 1) {
      navigate(_pIndex + 1, 0);
    }
  }

  function prevParticipant() {
    ScoringUI.saveCurrentScore();
    if (_pIndex > 0) {
      navigate(_pIndex - 1, 0);
    }
  }

  function jumpToUnscored() {
    ScoringUI.saveCurrentScore();

    const startP = _pIndex;
    const startI = _iIndex + 1;

    for (let pi = startP; pi < _participants.length; pi += 1) {
      const p = _participants[pi];
      const iStart = pi === startP ? startI : 0;

      for (let ii = iStart; ii < _items.length; ii += 1) {
        const score = State.getScore(p.key, _items[ii].index);
        if (!score || score.accuracy == null) {
          navigate(pi, ii);
          return;
        }
      }
    }

    for (let pi = 0; pi <= startP; pi += 1) {
      const p = _participants[pi];
      const iEnd = pi === startP ? _iIndex : _items.length;

      for (let ii = 0; ii < iEnd; ii += 1) {
        const score = State.getScore(p.key, _items[ii].index);
        if (!score || score.accuracy == null) {
          navigate(pi, ii);
          return;
        }
      }
    }
  }

  function getCurrentParticipant() {
    return _participants[_pIndex] || null;
  }

  function getCurrentItem() {
    return _items[_iIndex] || null;
  }

  function updateIndicators() {
    const participant = getCurrentParticipant();
    const item = getCurrentItem();

    document.getElementById('item-indicator').textContent = `Item ${_iIndex + 1}/${_items.length}`;

    if (participant) {
      document.getElementById('participant-indicator').textContent =
        `P ${participant.id} [${participant.timing}] (${_pIndex + 1}/${_participants.length})`;
    }

    if (item) {
      document.title = `Nonword Scorer - P${participant.id} - Slide${item.slide} Trial${item.trial}`;
    }

    updateProgress();
  }

  function updateProgress() {
    const total = _participants.length * _items.length;
    const scored = State.getAssignedScoredCount(_items.length);
    const pct = total > 0 ? (scored / total) * 100 : 0;

    document.getElementById('progress-bar').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${scored} / ${total} scored`;
  }

  return {
    init,
    setPosition,
    navigate,
    nextItem,
    prevItem,
    nextParticipant,
    prevParticipant,
    jumpToUnscored,
    getCurrentParticipant,
    getCurrentItem,
    updateProgress
  };
})();
