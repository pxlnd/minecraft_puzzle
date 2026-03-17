function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '-';
}

export function createEditorUI() {
  const el = {
    assetSearch: document.getElementById('assetSearch'),
    assetList: document.getElementById('assetList'),
    addAssetFilesBtn: document.getElementById('addAssetFilesBtn'),
    assetFileInput: document.getElementById('assetFileInput'),
    sceneCanvas: document.getElementById('sceneCanvas'),
    canvasWrap: document.getElementById('canvasWrap'),
    statusText: document.getElementById('statusText'),
    selectionText: document.getElementById('selectionText'),
    mouseText: document.getElementById('mouseText'),

    sceneName: document.getElementById('sceneName'),
    sceneWidth: document.getElementById('sceneWidth'),
    sceneHeight: document.getElementById('sceneHeight'),
    gridSize: document.getElementById('gridSize'),
    snapToggle: document.getElementById('snapToggle'),
    showGridToggle: document.getElementById('showGridToggle'),

    selectionMeta: document.getElementById('selectionMeta'),
    propertyForm: document.getElementById('propertyForm'),

    jsonArea: document.getElementById('jsonArea'),

    undoBtn: document.getElementById('undoBtn'),
    redoBtn: document.getElementById('redoBtn'),
    duplicateBtn: document.getElementById('duplicateBtn'),
    deleteBtn: document.getElementById('deleteBtn'),

    bringForwardBtn: document.getElementById('bringForwardBtn'),
    sendBackwardBtn: document.getElementById('sendBackwardBtn'),
    bringToFrontBtn: document.getElementById('bringToFrontBtn'),
    sendToBackBtn: document.getElementById('sendToBackBtn'),

    saveJsonBtn: document.getElementById('saveJsonBtn'),
    copyJsonBtn: document.getElementById('copyJsonBtn'),
    loadJsonBtn: document.getElementById('loadJsonBtn'),
    restoreLastBtn: document.getElementById('restoreLastBtn'),
    newSceneBtn: document.getElementById('newSceneBtn'),

    zoomRange: document.getElementById('zoomRange'),
    zoomValue: document.getElementById('zoomValue'),
    fitViewBtn: document.getElementById('fitViewBtn'),
  };

  const propertyInputs = new Map();
  el.propertyForm.querySelectorAll('[data-prop]').forEach((node) => {
    propertyInputs.set(node.dataset.prop, node);
  });

  return {
    el,
    propertyInputs,

    renderAssetList(assets, onClick) {
      const query = el.assetSearch.value.trim().toLowerCase();
      const filtered = query
        ? assets.filter((asset) => {
            const src = String(asset.src || '').toLowerCase();
            const previewSrc = String(asset.previewSrc || '').toLowerCase();
            return asset.name.toLowerCase().includes(query) || src.includes(query) || previewSrc.includes(query);
          })
        : assets;

      el.assetList.innerHTML = '';
      for (const asset of filtered) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'asset-item';
        const imageSrc = asset.previewSrc || asset.src;
        item.innerHTML = `
          <img src="${imageSrc}" alt="${asset.name}" />
          <div>
            <div class="name">${asset.name}</div>
            <div class="src">${asset.src}</div>
          </div>
        `;
        item.addEventListener('click', () => onClick(asset));
        el.assetList.appendChild(item);
      }
    },

    setStatus(text) {
      el.statusText.textContent = text;
    },

    setMouse(world) {
      el.mouseText.textContent = `x:${formatNumber(world.x, 1)} y:${formatNumber(world.y, 1)}`;
    },

    setSelectionInfo(selectionIds, object) {
      if (!selectionIds.length) {
        el.selectionText.textContent = 'No selection';
        el.selectionMeta.textContent = 'No object selected';
        return;
      }

      if (selectionIds.length > 1) {
        el.selectionText.textContent = `${selectionIds.length} objects`; 
        el.selectionMeta.textContent = `Multi-select (${selectionIds.length})`; 
        return;
      }

      el.selectionText.textContent = `${object?.name || selectionIds[0]} (${selectionIds[0]})`;
      el.selectionMeta.textContent = `id: ${object?.id || '-'} | src: ${object?.src || '-'}`;
    },

    setSceneMeta(meta) {
      el.sceneName.value = meta.name;
      el.sceneWidth.value = String(meta.width);
      el.sceneHeight.value = String(meta.height);
      el.gridSize.value = String(meta.gridSize);
      el.snapToggle.checked = Boolean(meta.snapToGrid);
    },

    readSceneMeta() {
      return {
        name: el.sceneName.value.trim() || 'scene_main',
        width: Number(el.sceneWidth.value) || 720,
        height: Number(el.sceneHeight.value) || 1280,
        gridSize: Number(el.gridSize.value) || 40,
        snapToGrid: el.snapToggle.checked,
      };
    },

    setProperties(object) {
      for (const [prop, input] of propertyInputs.entries()) {
        if (!object) {
          input.value = '';
          input.disabled = true;
          continue;
        }
        input.disabled = false;
        if (typeof object[prop] === 'boolean') {
          input.value = String(object[prop]);
        } else {
          input.value = String(object[prop]);
        }
      }
    },

    readProperty(prop) {
      const input = propertyInputs.get(prop);
      if (!input) {
        return undefined;
      }

      if (input.tagName === 'SELECT') {
        if (input.value === 'true') {
          return true;
        }
        if (input.value === 'false') {
          return false;
        }
        return input.value;
      }

      if (input.type === 'number') {
        const n = Number(input.value);
        return Number.isFinite(n) ? n : undefined;
      }
      return input.value;
    },

    setJSONArea(text) {
      el.jsonArea.value = text;
    },

    getJSONArea() {
      return el.jsonArea.value;
    },

    setZoom(percent) {
      const clamped = Math.max(10, Math.min(400, Math.round(percent)));
      el.zoomRange.value = String(clamped);
      el.zoomValue.textContent = `${clamped}%`;
    },

    setUndoRedo(canUndo, canRedo) {
      el.undoBtn.disabled = !canUndo;
      el.redoBtn.disabled = !canRedo;
    },
  };
}
