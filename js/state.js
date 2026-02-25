/**
 * state.js - localStorage persistence for nonword repetition scoring.
 */
const State = (() => {
  let _state = null;
  let _saveTimeout = null;
  const STORAGE_PREFIX = 'nonwordScorer_';

  function storageKey(raterId, datasetId) {
    return `${STORAGE_PREFIX}${raterId}_${datasetId}`;
  }

  function create(raterId, datasetId, participantKeys) {
    _state = {
      raterId,
      datasetId,
      assignedParticipants: participantKeys,
      currentParticipantIndex: 0,
      currentItemIndex: 0,
      scores: {},
      exportedParticipants: {},
      lastSaved: new Date().toISOString()
    };
    save();
    return _state;
  }

  function load(raterId, datasetId) {
    try {
      const raw = localStorage.getItem(storageKey(raterId, datasetId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.exportedParticipants) parsed.exportedParticipants = {};
      _state = parsed;
      return _state;
    } catch (e) {
      console.error('Failed to load state:', e);
      return null;
    }
  }

  function get() {
    return _state;
  }

  function save() {
    if (!_state) return;
    _state.lastSaved = new Date().toISOString();
    try {
      localStorage.setItem(storageKey(_state.raterId, _state.datasetId), JSON.stringify(_state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  function debouncedSave() {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(save, 400);
  }

  function setPosition(participantIndex, itemIndex) {
    if (!_state) return;
    _state.currentParticipantIndex = participantIndex;
    _state.currentItemIndex = itemIndex;
    debouncedSave();
  }

  function scoreKey(participantKey, itemIndex) {
    return `${participantKey}_${itemIndex}`;
  }

  function getScore(participantKey, itemIndex) {
    if (!_state) return null;
    return _state.scores[scoreKey(participantKey, itemIndex)] || null;
  }

  function setScore(participantKey, itemIndex, data) {
    if (!_state) return;
    const key = scoreKey(participantKey, itemIndex);
    _state.scores[key] = {
      ...(_state.scores[key] || {}),
      ...data,
      scoredAt: new Date().toISOString()
    };
    debouncedSave();
  }

  function getParticipantScoredCount(participantKey, itemCount) {
    if (!_state) return 0;
    let count = 0;
    for (let i = 1; i <= itemCount; i += 1) {
      const s = getScore(participantKey, i);
      if (s && s.accuracy != null) count += 1;
    }
    return count;
  }

  function isParticipantComplete(participantKey, itemCount) {
    return getParticipantScoredCount(participantKey, itemCount) === itemCount;
  }

  function getAssignedScoredCount(itemCount) {
    if (!_state) return 0;
    return _state.assignedParticipants
      .reduce((sum, participantKey) => sum + getParticipantScoredCount(participantKey, itemCount), 0);
  }

  function markParticipantExported(participantKey) {
    if (!_state) return;
    _state.exportedParticipants[participantKey] = new Date().toISOString();
    debouncedSave();
  }

  function hasParticipantBeenExported(participantKey) {
    if (!_state) return false;
    return !!_state.exportedParticipants[participantKey];
  }

  function listSessions() {
    const sessions = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        sessions.push(data);
      } catch (_e) {
        // ignore
      }
    }
    return sessions;
  }

  return {
    create,
    load,
    get,
    save,
    debouncedSave,
    setPosition,
    getScore,
    setScore,
    getParticipantScoredCount,
    isParticipantComplete,
    getAssignedScoredCount,
    markParticipantExported,
    hasParticipantBeenExported,
    listSessions
  };
})();
