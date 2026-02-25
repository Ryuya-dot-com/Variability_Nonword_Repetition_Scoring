/**
 * export.js - per-participant and bulk export.
 */
const Export = (() => {
  const _shownPopup = new Set();

  function safeName(value) {
    return String(value).replace(/[^A-Za-z0-9_-]/g, '_');
  }

  function hasSheetJs() {
    return typeof window.XLSX !== 'undefined' && window.XLSX && window.XLSX.utils;
  }

  function buildRows(participant, dataset, items, state) {
    return items.map(item => {
      const score = State.getScore(participant.key, item.index) || {};
      return {
        rater_id: state.raterId,
        dataset_id: dataset.id,
        dataset_label: dataset.label,
        timing: participant.timing,
        participant_id: participant.id,
        participant_key: participant.key,
        session_dir: participant.sessionDir,
        item_index: item.index,
        slide: item.slide,
        trial: item.trial,
        task: item.task,
        item: item.item,
        item_order_in_trial: item.itemOrderInTrial,
        item_order_in_slide: item.itemOrderInSlide,
        audio_file: DataLoader.getAudioFileName(participant, item.slide),
        accuracy: score.accuracy != null ? score.accuracy : '',
        note: score.note || '',
        scored_at: score.scoredAt || ''
      };
    });
  }

  function downloadParticipantExcel(participant, dataset, items) {
    const state = State.get();
    if (!state) return;

    const rows = buildRows(participant, dataset, items, state);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = [
      'nonword_scoring',
      safeName(state.raterId),
      safeName(dataset.id),
      safeName(participant.id),
      safeName(participant.timing),
      ts
    ].join('_');

    if (!hasSheetJs()) {
      const headers = Object.keys(rows[0] || {});
      const csvRows = [headers.join(',')];
      rows.forEach(row => {
        csvRows.push(headers.map(h => escapeCSV(row[h])).join(','));
      });
      downloadBlob(csvRows.join('\n'), `${base}.csv`, 'text/csv');
      State.markParticipantExported(participant.key);
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Scoring');
    XLSX.writeFile(wb, `${base}.xlsx`);
    State.markParticipantExported(participant.key);
  }

  function showParticipantExportPopup(participant, dataset, items) {
    if (State.hasParticipantBeenExported(participant.key)) return;

    const key = participant.key;
    if (_shownPopup.has(key)) return;
    _shownPopup.add(key);

    const overlay = document.createElement('div');
    overlay.className = 'export-popup-overlay';
    overlay.innerHTML = `
      <div class="export-popup">
        <h3>Participant ${participant.id} 完了</h3>
        <p>53項目の採点が完了しました。別ファイルとして保存しますか？</p>
        <div class="export-popup-buttons">
          <button class="btn btn-primary popup-download">Download</button>
          <button class="btn popup-skip">Skip</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.popup-download').addEventListener('click', () => {
      downloadParticipantExcel(participant, dataset, items);
      overlay.remove();
    });

    overlay.querySelector('.popup-skip').addEventListener('click', () => {
      overlay.remove();
    });
  }

  function exportCurrentParticipant(dataset, items) {
    const participant = Navigation.getCurrentParticipant();
    if (!participant) return;
    downloadParticipantExcel(participant, dataset, items);
  }

  function exportSelectedCSV(dataset, participants, items) {
    const state = State.get();
    if (!state) return;

    const headers = [
      'rater_id', 'dataset_id', 'dataset_label', 'timing',
      'participant_id', 'participant_key', 'session_dir',
      'item_index', 'slide', 'trial', 'task', 'item',
      'item_order_in_trial', 'item_order_in_slide',
      'audio_file', 'accuracy', 'note', 'scored_at'
    ];

    const rows = [headers.join(',')];

    participants.forEach(participant => {
      buildRows(participant, dataset, items, state).forEach(row => {
        rows.push(headers.map(h => escapeCSV(row[h])).join(','));
      });
    });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `nonword_scoring_${safeName(state.raterId)}_${safeName(dataset.id)}_${ts}.csv`;
    downloadBlob(rows.join('\n'), filename, 'text/csv');
  }

  function escapeCSV(value) {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    showParticipantExportPopup,
    downloadParticipantExcel,
    exportCurrentParticipant,
    exportSelectedCSV
  };
})();
