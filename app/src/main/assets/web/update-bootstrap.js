// Runs before preferences and app code: the old origin must remain untouched while migrating.
(function () {
  'use strict';
  window.AuraStorageMigrationPending = false;
  if (!window.AuraStorage) return;
  var bridge = window.AuraStorage;
  var undo = [];
  try {
    window.AuraStorageLaunchToken = bridge.getLaunchToken();
    var mode = bridge.getMigrationState();
    if (mode === 'legacy' || mode === 'complete') return;
    window.AuraStorageMigrationPending = true;
    var storage = window.localStorage;
    var snapshot;
    if (window.location.protocol === 'file:') {
      var entries = [];
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (key === null) throw new Error('Storage changed during backup');
        var value = storage.getItem(key);
        if (value === null) throw new Error('Storage changed during backup');
        entries.push([key, value]);
      }
      entries.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      snapshot = { schema: 1, entries: entries };
      if (!bridge.saveLegacySnapshot(JSON.stringify(snapshot))) throw new Error('Native backup failed');
      return; // Native code navigates only after the durable backup has been written.
    }
    snapshot = JSON.parse(bridge.getLegacySnapshot());
    if (!snapshot || snapshot.schema !== 1 || !Array.isArray(snapshot.entries)) throw new Error('Invalid backup');
    var seen = Object.create(null);
    snapshot.entries.forEach(function (entry) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string' || seen[entry[0]]) {
        throw new Error('Invalid backup entry');
      }
      seen[entry[0]] = true;
      undo.push([entry[0], storage.getItem(entry[0])]);
      storage.setItem(entry[0], entry[1]);
    });
    snapshot.entries.forEach(function (entry) {
      if (storage.getItem(entry[0]) !== entry[1]) throw new Error('Storage verification failed');
    });
    if (!bridge.confirmMigration(JSON.stringify(snapshot))) throw new Error('Migration confirmation failed');
    window.AuraStorageMigrationPending = false;
  } catch (error) {
    // Keep the backup and return to the still-intact file origin, including quota failures.
    for (var j = undo.length - 1; j >= 0; j--) {
      try {
        if (undo[j][1] === null) window.localStorage.removeItem(undo[j][0]);
        else window.localStorage.setItem(undo[j][0], undo[j][1]);
      } catch (_) {}
    }
    window.AuraStorageMigrationPending = true;
    bridge.migrationFailed(String(error && error.message || error));
  }
})();
