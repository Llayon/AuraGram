(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramSession = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createIndexedDBStore(indexedDB) {
    let opening;
    const encoded = new WeakMap();
    function open() {
      if (!opening) opening = new Promise((resolve, reject) => {
        if (!indexedDB) { reject(new Error('Storage unavailable')); return; }
        const request = indexedDB.open('auragram-session', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('session');
        request.onerror = () => reject(request.error);
        let blocked = false;
        request.onblocked = () => { blocked = true; reject(new Error('Storage blocked')); };
        request.onsuccess = () => {
          const db = request.result;
          if (blocked) { db.close(); return; }
          db.onversionchange = () => { db.close(); opening = null; };
          resolve(db);
        };
      }).catch(error => { opening = null; throw error; });
      return opening;
    }
    async function transaction(mode, operation) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('session', mode);
        let value;
        tx.oncomplete = () => resolve(value);
        // onerror may precede tx.error; report only the final abort/commit.
        tx.onabort = () => reject(tx.error || new Error('Storage transaction failed'));
        operation(tx.objectStore('session'), result => { value = result; });
      });
    }
    return {
      read: async () => {
        const record = await transaction('readonly', (store, done) => {
          const request = store.get('current');
          request.onsuccess = () => done(request.result || null);
        });
        if (record && record.bytes instanceof ArrayBuffer && record.bytes.byteLength > 0 && record.bytes.byteLength <= 15 * 1024 * 1024) {
          const {bytes, type, ...metadata} = record;
          return {...metadata, blob: new Blob([bytes], {type: typeof type === 'string' ? type : ''})};
        }
        return record;
      },
      write: async record => {
        // Encoded bytes avoid Blob persistence failures in some WebKit builds.
        // Cache one conversion per immutable source Blob across slider saves.
        if (!encoded.has(record.blob)) encoded.set(record.blob, record.blob.arrayBuffer());
        const bytes = await encoded.get(record.blob);
        const {blob, ...metadata} = record;
        return transaction('readwrite', store => store.put({...metadata, bytes, type:blob.type}, 'current'));
      },
      clear: () => transaction('readwrite', store => store.delete('current'))
    };
  }

  // Serialize commits and deletion. A revision guard rejects queued stale work;
  // deletion follows an already active transaction, so it always wins.
  function createSessionController({store, snapshot, onStatus = () => {}, delay = 500}) {
    let enabled = false, revision = 0, consentRevision = 0, timer, queue = Promise.resolve();
    let source = null, name = '', settings = null;
    function enqueue(operation) {
      const result = queue.then(operation);
      queue = result.catch(() => {});
      return result;
    }
    function valid(record) {
      return record && record.version === 1 && record.enabled === true &&
        record.blob instanceof Blob && record.blob.size > 0 && record.blob.size <= 15 * 1024 * 1024 &&
        record.settings && typeof record.settings === 'object' && !Array.isArray(record.settings);
    }
    async function restore() {
      const start = revision;
      const consent = consentRevision;
      try {
        const record = await enqueue(() => store.read());
        if (consent !== consentRevision) return null;
        if (!record) return null;
        if (!valid(record)) { onStatus('invalid'); return null; }
        enabled = true;
        if (start !== revision) { schedule(); return null; }
        onStatus('restoring');
        return {...record, settings: snapshot(record.settings)};
      } catch (error) { if (consent === consentRevision) onStatus('error', error); return null; }
    }
    function schedule() {
      clearTimeout(timer);
      const current = ++revision;
      if (!enabled) return;
      if (!source) { onStatus('waiting'); return; }
      onStatus('pending');
      timer = setTimeout(() => {
        const record = {version: 1, enabled: true, blob: source, name, settings: snapshot(settings)};
        enqueue(async () => {
          if (current !== revision || !enabled) return;
          onStatus('saving');
          try {
            if (!valid(record)) throw new Error('Invalid session source');
            await store.write(record);
            if (current === revision && enabled) onStatus('saved');
          } catch (error) { if (current === revision) onStatus('error', error); }
        });
      }, delay);
    }
    function update(blob, value, label = '') { source = blob; settings = snapshot(value); name = label; schedule(); }
    async function clear() {
      enabled = false; const consent = ++consentRevision; revision++; clearTimeout(timer); onStatus('clearing');
      try { await enqueue(() => store.clear()); if (consent === consentRevision) onStatus('off'); return true; }
      catch (error) { if (consent === consentRevision) onStatus('error', error); return false; }
    }
    function enable(value) {
      if (!value) return clear();
      consentRevision++; enabled = true; schedule(); return Promise.resolve(true);
    }
    function cancelRestore() { revision++; }
    return {restore, update, enable, clear, cancelRestore, enabled: () => enabled};
  }
  return {createIndexedDBStore, createSessionController};
});
