(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.AuraGramEditorUI = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createEditorUI({
    state,
    PRESETS,
    BEAUTY_TOOLS,
    FX_LIST,
    ADJUSTMENTS,
    createLashesState,
    getActiveCorrectionCount,
    triggerHaptic,
    showToast,
    renderFilterThumbnails,
    requestPreviewRender,
    updateCorrectionIndicator
  }) {
    // --- Carousels --------------------------------------------------------------
    function buildFilterCarousel() {
      const container = document.getElementById('tab-filters');
      if (!container) return;
      container.innerHTML = '';
      PRESETS.forEach(p => {
        const active = state.activePreset === p.id;
        const btn = document.createElement('button');
        btn.className = 'flex flex-col items-center shrink-0 group transition transform active:scale-95';
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.innerHTML =
          `<div class="relative w-14 h-14 rounded-2xl overflow-hidden border-2 transition ${active ? 'border-pink-500 shadow-lg shadow-pink-500/30 scale-105' : 'border-white/10 opacity-80 group-hover:opacity-100'}">` +
          `<canvas data-thumb="${p.id}" width="64" height="64" class="w-full h-full object-cover block bg-zinc-900"></canvas>` +
          `<span class="absolute bottom-0.5 right-0.5 px-1 py-0.2 text-[7px] font-bold uppercase rounded bg-black/75 text-white">${p.badge}</span></div>` +
          `<span class="text-[10px] mt-1 font-medium ${active ? 'text-pink-400 font-semibold' : 'text-zinc-400'}">${p.name}</span>`;
        btn.addEventListener('click', () => {
          triggerHaptic('light');
          state.activePreset = p.id;
          document.getElementById('activeFilterName').textContent = p.name;
          if (p.id === 'normal') {
            const n = getActiveCorrectionCount(state);
            if (n > 0) showToast(`Original: цвет нейтрален, коррекции (${n}) продолжают действовать`);
          }
          buildFilterCarousel();
          renderFilterThumbnails();
          updateSliderUI();
          requestPreviewRender();
          updateCorrectionIndicator();
        });
        container.appendChild(btn);
      });
    }

    function buildBeautyCarousel() {
      const container = document.getElementById('tab-beauty');
      if (!container) return;
      container.innerHTML = '';
      BEAUTY_TOOLS.forEach(tool => {
        const active = state.activeBeautyKey === tool.key;
        const val = state.beauty[tool.key];
        const isModified = val > 0;
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center justify-center shrink-0 w-24 py-1.5 rounded-2xl border transition active:scale-95 ${active ? 'bg-pink-500/20 border-pink-500 text-white shadow-lg shadow-pink-500/15' : 'bg-white/5 border-white/10 text-zinc-400'}`;
        btn.innerHTML =
          `<div class="relative"><i aria-hidden="true" class="ph-fill ${tool.icon} text-lg ${active ? 'text-pink-400' : ''}"></i>` +
          `${isModified ? '<span class="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500"></span>' : ''}</div>` +
          `<span class="text-[10px] font-medium mt-0.5 text-center px-1 truncate w-full">${tool.name}</span>` +
          `<span class="text-[10px] font-bold ${isModified ? 'text-pink-400' : 'text-zinc-500'}">${val}${tool.unit}</span>`;
        btn.addEventListener('click', () => {
          triggerHaptic('light');
          state.activeBeautyKey = tool.key;
          updateSliderUI();
          buildBeautyCarousel();
        });
        container.appendChild(btn);
      });
      // G1c: lash tool — three independent params behind one entry. The single
      // main slider cannot drive them, so selecting it opens #lashPanel.
      {
        const l = state.lashes || createLashesState();
        const active = state.activeBeautyKey === 'lashes';
        const modified = (l.density > 0 || l.length > 0 || l.definition > 0);
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center justify-center shrink-0 w-24 py-1.5 rounded-2xl border transition active:scale-95 ${active ? 'bg-pink-500/20 border-pink-500 text-white shadow-lg shadow-pink-500/15' : 'bg-white/5 border-white/10 text-zinc-400'}`;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.innerHTML =
          `<div class="relative"><i aria-hidden="true" class="ph-fill ph-eye text-lg ${active ? 'text-pink-400' : ''}"></i>` +
          `${modified ? '<span class="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500"></span>' : ''}</div>` +
          `<span class="text-[10px] font-medium mt-0.5 text-center px-1 truncate w-full">Ресницы</span>` +
          `<span class="text-[9px] font-mono ${modified ? 'text-pink-400 font-bold' : 'text-zinc-500'}">${l.density}/${l.length}/${l.definition}</span>`;
        btn.addEventListener('click', () => {
          triggerHaptic('light');
          state.activeBeautyKey = 'lashes';
          updateSliderUI();
          buildBeautyCarousel();
        });
        container.appendChild(btn);
      }
    }

    function buildFXCarousel() {
      const container = document.getElementById('tab-fx');
      if (!container) return;
      container.innerHTML = '';
      FX_LIST.forEach(fx => {
        const active = state.activeFX === fx.id;
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center justify-center shrink-0 w-24 py-2 rounded-2xl border transition active:scale-95 ${active ? 'bg-violet-500/20 border-violet-500 text-white shadow-lg shadow-violet-500/15' : 'bg-white/5 border-white/10 text-zinc-400'}`;
        btn.innerHTML = `<i aria-hidden="true" class="ph-fill ${fx.icon} text-xl"></i><span class="text-[10px] font-medium mt-1 text-center px-1 truncate w-full">${fx.name}</span>`;
        btn.addEventListener('click', () => {
          triggerHaptic('light');
          state.activeFX = fx.id;
          buildFXCarousel();
          requestPreviewRender();
          updateCorrectionIndicator();
        });
        container.appendChild(btn);
      });
    }

    function buildAdjustCarousel() {
      const container = document.getElementById('tab-adjust');
      if (!container) return;
      container.innerHTML = '';
      ADJUSTMENTS.forEach(adj => {
        const active = state.activeAdjustKey === adj.key;
        const val = state.adjustments[adj.key];
        const isModified = val !== adj.default;
        const btn = document.createElement('button');
        btn.dataset.adjustment = adj.key;
        btn.setAttribute('aria-pressed', String(active));
        btn.className = `flex flex-col items-center justify-center shrink-0 w-20 py-1.5 rounded-2xl border transition active:scale-95 ${active ? 'bg-violet-500/20 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-zinc-400'}`;
        btn.innerHTML =
          `<div class="relative"><i aria-hidden="true" class="ph ${adj.icon} text-lg ${active ? 'text-violet-300' : 'text-zinc-400'}"></i>` +
          `${isModified ? '<span class="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400"></span>' : ''}</div>` +
          `<span class="text-[10px] font-medium mt-0.5 truncate w-full px-1 text-center">${adj.name}</span>` +
          `<span class="text-[9px] font-mono ${isModified ? 'text-violet-300 font-bold' : 'text-zinc-500'}">${val}${adj.unit}</span>`;
        btn.addEventListener('click', () => {
          triggerHaptic('light');
          state.activeAdjustKey = adj.key;
          updateSliderUI();
          buildAdjustCarousel();
        });
        container.appendChild(btn);
      });
    }

    // --- Slider & tabs -----------------------------------------------------------
    const sliderContainer = document.getElementById('sliderContainer');
    const sliderLabel = document.getElementById('sliderLabel');
    const mainSlider = document.getElementById('mainSlider');
    const sliderValue = document.getElementById('sliderValue');
    // G1c lash panel (three independent sliders; hidden unless lashes active).
    const lashPanel = document.getElementById('lashPanel');
    const LASH_PARAMS = [
      { key: 'density', name: 'Густота', input: 'lashDensity', value: 'lashDensityVal' },
      { key: 'length', name: 'Длина', input: 'lashLength', value: 'lashLengthVal' },
      { key: 'definition', name: 'Выразительность', input: 'lashDefinition', value: 'lashDefinitionVal' }
    ];

    function syncLashPanel() {
      if (!lashPanel) return;
      const l = state.lashes || createLashesState();
      LASH_PARAMS.forEach(p => {
        const el = document.getElementById(p.input);
        const val = document.getElementById(p.value);
        if (el) el.value = l[p.key];
        if (val) val.textContent = `${l[p.key]}%`;
      });
    }

    function updateSliderUI() {
      if (!sliderContainer) return;
      const lashesActive = state.currentTab === 'beauty' && state.activeBeautyKey === 'lashes';
      if (lashPanel) {
        lashPanel.classList.toggle('hidden', !lashesActive);
        lashPanel.classList.toggle('flex', lashesActive);
      }
      if (state.currentTab === 'filters') {
        sliderContainer.classList.remove('hidden');
        sliderLabel.textContent = 'Сила фильтра';
        mainSlider.min = 0; mainSlider.max = 100;
        mainSlider.value = state.presetIntensity;
        sliderValue.textContent = `${state.presetIntensity}%`;
      } else if (state.currentTab === 'beauty') {
        if (lashesActive) {
          sliderContainer.classList.add('hidden');
          syncLashPanel();
        } else {
          sliderContainer.classList.remove('hidden');
          const tool = BEAUTY_TOOLS.find(t => t.key === state.activeBeautyKey);
          if (tool) {
            sliderLabel.textContent = tool.name;
            mainSlider.min = tool.min; mainSlider.max = tool.max;
            mainSlider.value = state.beauty[tool.key];
            sliderValue.textContent = `${state.beauty[tool.key]}${tool.unit}`;
          }
        }
      } else if (state.currentTab === 'adjust') {
        sliderContainer.classList.remove('hidden');
        const adj = ADJUSTMENTS.find(a => a.key === state.activeAdjustKey);
        if (adj) {
          sliderLabel.textContent = adj.name;
          mainSlider.min = adj.min; mainSlider.max = adj.max;
          mainSlider.value = state.adjustments[adj.key];
          sliderValue.textContent = `${state.adjustments[adj.key]}${adj.unit}`;
        }
      } else {
        sliderContainer.classList.add('hidden');
      }
    }

    if (mainSlider) {
      mainSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (state.currentTab === 'filters') {
          state.presetIntensity = val;
          sliderValue.textContent = `${val}%`;
        } else if (state.currentTab === 'beauty') {
          if (state.activeBeautyKey === 'lashes') return; // driven by #lashPanel
          const tool = BEAUTY_TOOLS.find(t => t.key === state.activeBeautyKey);
          state.beauty[state.activeBeautyKey] = val;
          sliderValue.textContent = `${val}${tool ? tool.unit : '%'}`;
          buildBeautyCarousel();
        } else if (state.currentTab === 'adjust') {
          const adj = ADJUSTMENTS.find(a => a.key === state.activeAdjustKey);
          state.adjustments[state.activeAdjustKey] = val;
          sliderValue.textContent = `${val}${adj ? adj.unit : ''}`;
          buildAdjustCarousel();
        }
        requestPreviewRender(); // rAF-coalesced (Phase 2)
        updateCorrectionIndicator();
      });
    }

    // G1c: lash sliders — render only, never inference (L19).
    LASH_PARAMS.forEach(p => {
      const el = document.getElementById(p.input);
      if (!el) return;
      el.addEventListener('input', (e) => {
        const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
        if (!state.lashes) state.lashes = createLashesState();
        state.lashes[p.key] = val; // independent: beauty.eyes untouched (L17)
        const valEl = document.getElementById(p.value);
        if (valEl) valEl.textContent = `${val}%`;
        buildBeautyCarousel();
        requestPreviewRender();
        updateCorrectionIndicator();
      });
    });

    document.querySelectorAll('.nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        triggerHaptic('light');
        const target = tabBtn.getAttribute('data-tab');
        state.currentTab = target;
        document.querySelectorAll('.nav-tab').forEach(b => {
          b.classList.remove('text-violet-400', 'font-semibold');
          b.classList.add('text-zinc-400');
        });
        tabBtn.classList.add('text-violet-400', 'font-semibold');
        tabBtn.classList.remove('text-zinc-400');
        ['filters', 'beauty', 'fx', 'adjust', 'extras'].forEach(id => {
          const el = document.getElementById(`tab-${id}`);
          if (!el) return;
          if (id === target) { el.classList.remove('hidden'); el.classList.add('flex'); }
          else { el.classList.add('hidden'); el.classList.remove('flex'); }
        });
        updateSliderUI();
      });
    });

    document.querySelectorAll('.stamp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerHaptic('light');
        state.stampMode = btn.getAttribute('data-stamp');
        document.querySelectorAll('.stamp-btn').forEach(b => {
          b.className = 'stamp-btn px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 shrink-0';
          b.setAttribute('aria-pressed', 'false');
        });
        btn.className = 'stamp-btn px-3 py-2 rounded-xl border border-violet-500 bg-violet-500/20 text-xs font-medium text-white shrink-0';
        btn.setAttribute('aria-pressed', 'true');
        requestPreviewRender();
        updateCorrectionIndicator();
      });
    });

    const captionInput = document.getElementById('customCaption');
    if (captionInput) {
      captionInput.addEventListener('input', (e) => {
        state.caption = e.target.value;
        requestPreviewRender();
        updateCorrectionIndicator();
      });
    }


    return {buildFilterCarousel,buildBeautyCarousel,buildFXCarousel,buildAdjustCarousel,updateSliderUI};
  }
  return {createEditorUI};
});
