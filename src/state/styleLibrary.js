(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramStyles = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'auragram.styles.v1';
  const MAX_STYLES = 20;
  const MAX_NAME_LENGTH = 32;
  const MAX_STORAGE_LENGTH = 64 * 1024;

  function fail(code) { const error = new Error(code); error.code = code; throw error; }
  function styleName(value) {
    if (typeof value !== 'string') return fail('invalid-name');
    const name = value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || Array.from(name).length > MAX_NAME_LENGTH) return fail('invalid-name');
    return name;
  }
  function createStyleLibrary({getStorage, snapshot, makeId = () => {
    if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }}) {
    // A style never contains a photo, geometry, UI state or a photo's caption.
    function processingSettings(value) { const {caption, ...settings} = snapshot(value); return settings; }
    function access(operation) {
      try {
        const storage = getStorage();
        if (!storage) return fail('storage-unavailable');
        return operation(storage);
      } catch (error) {
        if (error.code && typeof error.code === 'string') throw error;
        return fail(error.name === 'QuotaExceededError' ? 'storage-full' : 'storage-unavailable');
      }
    }
    function list() {
      const raw = access(storage => storage.getItem(STORAGE_KEY));
      if (raw === null) return [];
      if (raw.length > MAX_STORAGE_LENGTH) return fail('invalid-library');
      let data;
      try { data = JSON.parse(raw); } catch (error) { return fail('invalid-library'); }
      if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > MAX_STYLES) return fail('invalid-library');
      const ids = new Set(), names = new Set();
      return data.items.map(item => {
        if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) ||
          !item.settings || typeof item.settings !== 'object' || Array.isArray(item.settings)) return fail('invalid-library');
        let name;
        try { name = styleName(item.name); } catch (error) { return fail('invalid-library'); }
        if (ids.has(item.id) || names.has(name.toLocaleLowerCase('ru'))) return fail('invalid-library');
        ids.add(item.id); names.add(name.toLocaleLowerCase('ru'));
        return {id:item.id, name, settings:processingSettings(item.settings)};
      });
    }
    function write(items) {
      const raw = JSON.stringify({version:1, items});
      if (raw.length > MAX_STORAGE_LENGTH) return fail('storage-full');
      access(storage => storage.setItem(STORAGE_KEY, raw));
    }
    function uniqueName(items, name, exceptId) {
      if (items.some(item => item.id !== exceptId && item.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) return fail('duplicate-name');
    }
    function add(name, state) {
      const items = list(); name = styleName(name); uniqueName(items, name);
      if (items.length >= MAX_STYLES) return fail('library-full');
      const id = makeId();
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || items.some(item => item.id === id)) return fail('invalid-id');
      const item = {id, name, settings:processingSettings(state)};
      write([...items, item]); return item;
    }
    function change(id, transform) {
      const items = list(), index = items.findIndex(item => item.id === id);
      if (index < 0) return fail('missing-style');
      const next = transform(items[index], items);
      if (next) items[index] = next; else items.splice(index, 1);
      write(items); return next;
    }
    return {
      list, add,
      rename: (id, name) => change(id, (item, items) => {
        name = styleName(name); uniqueName(items, name, id); return {...item, name};
      }),
      update: (id, state) => change(id, item => ({...item, settings:processingSettings(state)})),
      remove: id => change(id, () => null),
      clear: () => access(storage => storage.removeItem(STORAGE_KEY)),
      processingSettings
    };
  }
  return {createStyleLibrary, styleName, STORAGE_KEY, MAX_STYLES, MAX_NAME_LENGTH};
});
