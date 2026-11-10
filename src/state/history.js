(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramHistory = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createHistory({read, write, onChange = () => {}, limit = 50}) {
    let past = [], future = [], pending = null;
    const copy = value => JSON.parse(JSON.stringify(value));
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function info() { return {canUndo: past.length > 0, canRedo: future.length > 0, past: past.length, future: future.length}; }
    function begin() { if (pending === null) pending = copy(read()); }
    function commit() {
      if (pending === null) return false;
      const before = pending; pending = null;
      if (equal(before, read())) return false;
      past.push(before);
      if (past.length > limit) past.shift();
      future = [];
      onChange(info());
      return true;
    }
    function undo() {
      commit();
      if (!past.length) return false;
      future.push(copy(read())); write(copy(past.pop())); onChange(info()); return true;
    }
    function redo() {
      commit();
      if (!future.length) return false;
      past.push(copy(read())); write(copy(future.pop())); onChange(info()); return true;
    }
    function clear() { pending = null; past = []; future = []; onChange(info()); }
    return {begin, commit, undo, redo, clear, info};
  }
  return {createHistory};
});
