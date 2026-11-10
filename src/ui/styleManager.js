(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramStyleManager = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createStyleManager({library, getState, isReady, applyStyle, showToast, storageKey}) {
    const dialog = document.getElementById('styleDialog');
    const list = document.getElementById('styleList');
    const status = document.getElementById('styleStatus');
    const form = document.getElementById('styleForm');
    const input = document.getElementById('styleName');
    const submit = document.getElementById('btnSaveStyle');
    const cancelRename = document.getElementById('btnCancelStyleRename');
    const reset = document.getElementById('btnResetStyleLibrary');
    let editingId = null;
    const messages = {
      'invalid-name':'Введите название от 1 до 32 символов.',
      'duplicate-name':'Стиль с таким названием уже есть. Выберите другое название.',
      'library-full':'Сохранено 20 стилей. Удалите один, чтобы добавить новый.',
      'missing-style':'Стиль уже удалён. Список обновлён.',
      'invalid-library':'Библиотека повреждена или имеет другую версию. Можно очистить её и создать новую.',
      'storage-full':'Не хватает места для сохранения. Существующие стили сохранены.',
      'storage-unavailable':'Сохранение стилей недоступно в этом браузере. Редактирование фото работает.'
    };
    function announce(message, error = false) { status.textContent = message; status.dataset.error = String(error); }
    function errorMessage(error) { return messages[error.code] || 'Не удалось сохранить стиль. Повторите попытку.'; }
    function stopRename() {
      editingId = null; input.value = ''; submit.textContent = 'Сохранить текущий стиль'; cancelRename.hidden = true;
    }
    function button(text, label, action) {
      const element = document.createElement('button'); element.type = 'button';
      element.textContent = text; element.setAttribute('aria-label', label); element.addEventListener('click', action);
      return element;
    }
    function run(operation, message) {
      try { operation(); render(); announce(message); return true; }
      catch (error) { render(); announce(errorMessage(error), true); return false; }
    }
    function render() {
      list.replaceChildren(); reset.hidden = true;
      let items;
      try { items = library.list(); submit.disabled = false; }
      catch (error) {
        submit.disabled = true; reset.hidden = error.code !== 'invalid-library';
        announce(errorMessage(error), true); return false;
      }
      if (editingId && !items.some(item => item.id === editingId)) stopRename();
      if (!items.length) {
        const empty = document.createElement('li'); empty.textContent = 'Пока нет сохранённых стилей.'; list.append(empty);
      }
      for (const item of items) {
        const row = document.createElement('li'); row.className = 'style-row'; row.dataset.styleId = item.id;
        const apply = button(item.name, 'Применить стиль «' + item.name + '»', () => {
          // Re-read immediately: a style can be updated/deleted in another tab.
          try {
            const current = library.list().find(value => value.id === item.id);
            if (!current) { render(); announce(messages['missing-style'], true); return; }
            if (!isReady()) { announce('Сначала загрузите фото.', true); return; }
            applyStyle(current.settings); dialog.close(); showToast('Стиль «' + current.name + '» применён');
          } catch (error) { announce(errorMessage(error), true); }
        });
        apply.className = 'style-apply'; row.append(apply);
        const actions = document.createElement('div'); actions.className = 'style-actions';
        actions.append(
          button('Обновить', 'Обновить стиль «' + item.name + '» текущими настройками', () => {
            if (!isReady()) { announce('Сначала загрузите фото.', true); return; }
            run(() => library.update(item.id, getState()), 'Настройки стиля обновлены.');
          }),
          button('Имя', 'Переименовать стиль «' + item.name + '»', () => {
            editingId = item.id; input.value = item.name; submit.textContent = 'Сохранить название';
            cancelRename.hidden = false; input.focus(); input.select(); announce('Введите новое название стиля.');
          }),
          button('Удалить', 'Удалить стиль «' + item.name + '»', () => {
            run(() => library.remove(item.id), 'Стиль удалён. Открытое фото не изменилось.');
          })
        );
        row.append(actions); list.append(row);
      }
      return true;
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!editingId && !isReady()) { announce('Сначала загрузите фото.', true); return; }
      const renamed = !!editingId;
      if (run(() => editingId ? library.rename(editingId, input.value) : library.add(input.value, getState()),
        renamed ? 'Название сохранено.' : 'Стиль сохранён на устройстве.')) stopRename();
    });
    cancelRename.addEventListener('click', () => { stopRename(); announce('Переименование отменено.'); });
    reset.addEventListener('click', () => run(() => { library.clear(); stopRename(); }, 'Библиотека очищена. Можно сохранять новые стили.'));
    document.getElementById('btnOpenStyles').addEventListener('click', () => {
      stopRename(); announce(''); render(); dialog.showModal();
    });
    document.getElementById('btnCloseStyles').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { stopRename(); document.getElementById('btnOpenStyles').focus(); });
    window.addEventListener('storage', event => {
      if (dialog.open && (event.key === storageKey || event.key === null) && render()) announce('Список стилей обновлён.');
    });
    return {render};
  }
  return {createStyleManager};
});
