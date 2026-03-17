import { ASSETS, DEFAULT_SCENE_META, LOCAL_STORAGE_KEY } from './resources.js';
import { SceneState } from './scene-state.js';
import { SceneRenderer } from './renderer.js';
import { createEditorUI } from './ui.js';

const CUSTOM_ASSETS_STORAGE_KEY = 'scene_builder:custom_assets';

const NUMERIC_PROPS = new Set([
  'x',
  'y',
  'width',
  'height',
  'scaleX',
  'scaleY',
  'rotation',
  'alpha',
  'zIndex',
  'originX',
  'originY',
]);

const BOOLEAN_PROPS = new Set(['visible', 'flipX', 'flipY']);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isInputLike(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function snap(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

function parsePastedJSON(text) {
  if (!text || !text.trim()) {
    return null;
  }
  return JSON.parse(text);
}

function isImageFile(file) {
  if (!file) {
    return false;
  }
  if (String(file.type || '').startsWith('image/')) {
    return true;
  }
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || '');
}

const state = new SceneState();
const ui = createEditorUI();
const renderer = new SceneRenderer(ui.el.sceneCanvas, state, { mode: 'editor' });
const assetCatalog = [...ASSETS];

const editor = {
  selectionIds: [],
  clipboard: [],
  interaction: null,
  pointer: { x: 0, y: 0, worldX: 0, worldY: 0 },
  rafId: 0,
  needsRender: true,
  hasLoadedFromStorage: false,
  spacePressed: false,
};

function setNeedsRender() {
  editor.needsRender = true;
}

function requestRenderLoop() {
  const loop = () => {
    if (editor.needsRender) {
      renderer.setSelection(editor.selectionIds);
      renderer.render();
      editor.needsRender = false;
    }
    editor.rafId = requestAnimationFrame(loop);
  };
  loop();
}

function setStatus(text) {
  ui.setStatus(text);
}

function rerenderAssets() {
  ui.renderAssetList(assetCatalog, addAssetObject);
}

function createAssetIdFromName(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'asset';
  return `${base}_${Date.now().toString(36)}`;
}

function persistCustomAssets() {
  const custom = assetCatalog
    .filter((asset) => asset.isCustom)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type || 'image',
      src: asset.src,
      width: asset.width || 256,
      height: asset.height || 256,
    }));
  localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(custom));
}

function loadCustomAssets() {
  try {
    const raw = localStorage.getItem(CUSTOM_ASSETS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }
    for (const item of parsed) {
      if (!item?.src || !item?.name) {
        continue;
      }
      assetCatalog.push({
        id: item.id || createAssetIdFromName(item.name),
        name: item.name,
        type: item.type || 'image',
        src: item.src,
        width: Number(item.width) || 256,
        height: Number(item.height) || 256,
        isCustom: true,
      });
    }
  } catch (_) {
    // ignore invalid persisted asset list
  }
}

function readImageSizeFromFile(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth || 256, height: image.naturalHeight || 256, previewSrc: objectUrl });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 256, height: 256, previewSrc: '' });
    };
    image.src = objectUrl;
  });
}

async function addAssetsFromFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => isImageFile(file));
  if (!files.length) {
    setStatus('Выберите image-файлы');
    return;
  }

  let addedCount = 0;
  let skippedCount = 0;
  const addedAssets = [];
  for (const file of files) {
    const guessedSrc = `./assets/${file.name}`;
    const already = assetCatalog.some((asset) => asset.src === guessedSrc);
    if (already) {
      skippedCount += 1;
      continue;
    }
    const size = await readImageSizeFromFile(file);
    const asset = {
      id: createAssetIdFromName(file.name),
      name: file.name,
      type: 'image',
      src: guessedSrc,
      previewSrc: size.previewSrc,
      width: size.width,
      height: size.height,
      isCustom: true,
    };
    assetCatalog.push(asset);
    addedAssets.push(asset);
    addedCount += 1;
  }

  if (!addedCount) {
    setStatus('Новых ассетов нет: файлы уже были в списке');
    return;
  }

  persistCustomAssets();
  ui.el.assetSearch.value = '';
  rerenderAssets();
  addAssetObject(addedAssets[0]);

  const skippedInfo = skippedCount ? `, пропущено дубликатов: ${skippedCount}` : '';
  setStatus(`Добавлено ассетов: ${addedCount}${skippedInfo}. Первый ассет добавлен на сцену.`);
}

function getSelectedObjects() {
  return state.getObjectsByIds(editor.selectionIds);
}

function getPrimarySelection() {
  if (editor.selectionIds.length !== 1) {
    return null;
  }
  return state.getObjectById(editor.selectionIds[0]);
}

function setSelection(ids) {
  const allIds = new Set(state.scene.objects.map((obj) => obj.id));
  editor.selectionIds = ids.filter((id) => allIds.has(id));
  refreshRightPanel();
  setNeedsRender();
}

function clearSelection() {
  setSelection([]);
}

function refreshRightPanel() {
  const validIds = new Set(state.scene.objects.map((obj) => obj.id));
  editor.selectionIds = editor.selectionIds.filter((id) => validIds.has(id));
  const primary = getPrimarySelection();
  ui.setSelectionInfo(editor.selectionIds, primary);
  ui.setProperties(primary);
  ui.setSceneMeta(state.scene.meta);
  ui.setUndoRedo(state.canUndo(), state.canRedo());
}

function refreshJSONArea() {
  ui.setJSONArea(state.exportJSON(true));
}

function saveToLocalStorage() {
  try {
    state.saveToLocalStorage(LOCAL_STORAGE_KEY);
    editor.hasLoadedFromStorage = true;
  } catch (error) {
    setStatus(`Local save error: ${error.message}`);
  }
}

function applyMutation(description, mutate, opts = {}) {
  const before = state.captureSnapshot();
  mutate();
  const changed = state.commitIfChanged(before);

  if (!changed && !opts.forceRefresh) {
    return false;
  }

  if (changed) {
    saveToLocalStorage();
    setStatus(description);
  }

  if (opts.refreshJSON !== false) {
    refreshJSONArea();
  }
  refreshRightPanel();
  setNeedsRender();
  return changed;
}

function addAssetObject(asset) {
  const meta = state.scene.meta;
  const centerWorld = renderer.screenToWorld(ui.el.sceneCanvas.clientWidth * 0.5, ui.el.sceneCanvas.clientHeight * 0.5);
  const x = clamp(centerWorld.x, 0, meta.width);
  const y = clamp(centerWorld.y, 0, meta.height);

  applyMutation(`Added ${asset.name}`, () => {
    const object = state.createObjectFromAsset(asset, x, y);
    state.addObject(object);
    setSelection([object.id]);
  });
}

function deleteSelection() {
  if (!editor.selectionIds.length) {
    return;
  }

  const toDelete = [...editor.selectionIds];
  applyMutation('Deleted selection', () => {
    state.removeObjects(toDelete);
    clearSelection();
  });
}

function duplicateSelection() {
  if (!editor.selectionIds.length) {
    return;
  }

  applyMutation('Duplicated selection', () => {
    const clones = state.duplicateObjects(editor.selectionIds);
    setSelection(clones.map((obj) => obj.id));
  });
}

function copySelection() {
  const objects = getSelectedObjects();
  editor.clipboard = objects.map((obj) => {
    const clone = deepClone(obj);
    delete clone.id;
    delete clone.zIndex;
    return clone;
  });
  setStatus(`Copied ${editor.clipboard.length} object(s)`);
}

function pasteSelection() {
  if (!editor.clipboard.length) {
    return;
  }

  applyMutation('Pasted selection', () => {
    const createdIds = [];
    for (const raw of editor.clipboard) {
      const object = state.addObject({
        ...raw,
        id: state.generateId('obj'),
        name: `${raw.name || 'object'}_paste`,
        x: Number(raw.x) + 20,
        y: Number(raw.y) + 20,
      });
      createdIds.push(object.id);
    }
    setSelection(createdIds);
  });
}

function nudgeSelection(dx, dy) {
  if (!editor.selectionIds.length) {
    return;
  }

  const gridSize = state.scene.meta.gridSize;
  const shouldSnap = state.scene.meta.snapToGrid;

  applyMutation('Moved selection', () => {
    state.updateObjects(editor.selectionIds, (obj) => {
      let x = obj.x + dx;
      let y = obj.y + dy;
      if (shouldSnap) {
        x = snap(x, gridSize);
        y = snap(y, gridSize);
      }
      return { x, y };
    });
  });
}

function applyPropertyChange(prop) {
  const primary = getPrimarySelection();
  if (!primary) {
    return;
  }

  const value = ui.readProperty(prop);
  if (value === undefined) {
    return;
  }

  applyMutation(`Updated ${prop}`, () => {
    if (prop === 'zIndex') {
      state.setObjectZIndex(primary.id, Number(value));
      return;
    }

    const patch = {};
    if (NUMERIC_PROPS.has(prop)) {
      patch[prop] = Number(value);
    } else if (BOOLEAN_PROPS.has(prop)) {
      patch[prop] = Boolean(value);
    } else {
      patch[prop] = value;
    }
    state.updateObject(primary.id, patch);
  });
}

function applySceneMetaChanges() {
  const patch = ui.readSceneMeta();
  applyMutation('Scene settings updated', () => {
    state.setMetaPatch(patch);
  });
}

function layerAction(actionName) {
  if (!editor.selectionIds.length) {
    return;
  }

  const actions = {
    bringForward: () => state.bringForward(editor.selectionIds),
    sendBackward: () => state.sendBackward(editor.selectionIds),
    bringToFront: () => state.bringToFront(editor.selectionIds),
    sendToBack: () => state.sendToBack(editor.selectionIds),
  };

  applyMutation(actionName, () => {
    actions[actionName]();
  });
}

function setZoomFromPercent(percent, anchorScreen = null) {
  const previousZoom = renderer.view.zoom;
  const targetZoom = clamp(percent / 100, 0.1, 4);

  if (!anchorScreen) {
    renderer.setView({ zoom: targetZoom });
  } else {
    const worldBefore = renderer.screenToWorld(anchorScreen.x, anchorScreen.y);
    renderer.setView({ zoom: targetZoom });
    renderer.setView({
      panX: anchorScreen.x - worldBefore.x * targetZoom,
      panY: anchorScreen.y - worldBefore.y * targetZoom,
    });
  }

  if (previousZoom !== targetZoom) {
    ui.setZoom(targetZoom * 100);
    setNeedsRender();
  }
}

function importFromJSONText(text) {
  try {
    const parsed = parsePastedJSON(text);
    if (!parsed) {
      throw new Error('JSON is empty');
    }

    applyMutation('Scene imported', () => {
      state.replaceScene(parsed, true);
      clearSelection();
      state.clearHistory();
    }, { refreshJSON: false, forceRefresh: true });

    refreshJSONArea();
    renderer.resetViewToFit();
    ui.setZoom(renderer.view.zoom * 100);
    saveToLocalStorage();
  } catch (error) {
    setStatus(`Import error: ${error.message}`);
  }
}

async function copyJSONToClipboard() {
  const json = state.exportJSON(true);
  ui.setJSONArea(json);
  try {
    await navigator.clipboard.writeText(json);
    setStatus('Scene JSON copied');
  } catch (_) {
    setStatus('Clipboard blocked, JSON left in text area');
  }
}

function saveJSONFile() {
  const json = state.exportJSON(true);
  ui.setJSONArea(json);
  const safeName = state.scene.meta.name.replace(/[^a-zA-Z0-9_-]+/g, '_');
  downloadText(`${safeName || 'scene'}.json`, json);
  setStatus('Scene JSON saved');
}

function resetScene() {
  applyMutation('New scene created', () => {
    state.replaceScene({ meta: DEFAULT_SCENE_META, objects: [] }, true);
    clearSelection();
  });

  renderer.resetViewToFit();
  ui.setZoom(renderer.view.zoom * 100);
  refreshJSONArea();
}

function restoreLastScene() {
  try {
    const loaded = state.loadFromLocalStorage(LOCAL_STORAGE_KEY);
    if (!loaded) {
      setStatus('No saved scene in localStorage');
      return;
    }

    state.clearHistory();
    clearSelection();
    refreshRightPanel();
    refreshJSONArea();
    renderer.resetViewToFit();
    ui.setZoom(renderer.view.zoom * 100);
    setStatus('Scene restored from localStorage');
    setNeedsRender();
  } catch (error) {
    setStatus(`Restore error: ${error.message}`);
  }
}

function handlePointerDown(event) {
  const canvasRect = ui.el.sceneCanvas.getBoundingClientRect();
  const screen = { x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top };
  const world = renderer.screenToWorld(screen.x, screen.y);

  editor.pointer = { x: screen.x, y: screen.y, worldX: world.x, worldY: world.y };

  if (event.button === 1 || event.altKey || editor.spacePressed) {
    editor.interaction = {
      type: 'pan',
      startScreen: screen,
      startView: { ...renderer.view },
    };
    return;
  }

  const handle = renderer.getHandleAtScreen(screen.x, screen.y);
  if (handle && event.button === 0) {
    const object = state.getObjectById(handle.objectId);
    if (!object) {
      return;
    }

    const centerScreen = renderer.worldToScreen(object.x, object.y);
    const pointerScreen = { x: screen.x, y: screen.y };
    const before = state.captureSnapshot();

    if (handle.type === 'scale') {
      editor.interaction = {
        type: 'scale',
        objectId: object.id,
        before,
        centerScreen,
        startDistance: SceneRenderer.distance(centerScreen, pointerScreen),
        startScaleX: object.scaleX,
        startScaleY: object.scaleY,
      };
      return;
    }

    if (handle.type === 'rotate') {
      editor.interaction = {
        type: 'rotate',
        objectId: object.id,
        before,
        centerScreen,
        startAngle: SceneRenderer.angleFromCenter(centerScreen, pointerScreen),
        startRotation: object.rotation,
      };
      return;
    }
  }

  const hit = renderer.hitTest(world.x, world.y);

  if (!hit) {
    if (!event.shiftKey) {
      clearSelection();
    }

    editor.interaction = {
      type: 'pan',
      startScreen: screen,
      startView: { ...renderer.view },
    };
    setNeedsRender();
    return;
  }

  if (event.shiftKey) {
    if (editor.selectionIds.includes(hit.id)) {
      setSelection(editor.selectionIds.filter((id) => id !== hit.id));
    } else {
      setSelection([...editor.selectionIds, hit.id]);
    }
    return;
  }

  if (!editor.selectionIds.includes(hit.id)) {
    setSelection([hit.id]);
  }

  const startPositions = new Map();
  for (const obj of getSelectedObjects()) {
    startPositions.set(obj.id, { x: obj.x, y: obj.y });
  }

  editor.interaction = {
    type: 'drag',
    before: state.captureSnapshot(),
    startWorld: world,
    startPositions,
  };
}

function handlePointerMove(event) {
  const canvasRect = ui.el.sceneCanvas.getBoundingClientRect();
  const screen = { x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top };
  const world = renderer.screenToWorld(screen.x, screen.y);

  editor.pointer = { x: screen.x, y: screen.y, worldX: world.x, worldY: world.y };

  renderer.setHoverWorld(world);
  ui.setMouse(world);

  const it = editor.interaction;
  if (!it) {
    const handle = renderer.getHandleAtScreen(screen.x, screen.y);
    const hit = renderer.hitTest(world.x, world.y);

    if (handle?.type === 'rotate') {
      ui.el.sceneCanvas.style.cursor = 'crosshair';
    } else if (handle?.type === 'scale') {
      ui.el.sceneCanvas.style.cursor = 'nwse-resize';
    } else if (hit) {
      ui.el.sceneCanvas.style.cursor = 'move';
    } else {
      ui.el.sceneCanvas.style.cursor = 'default';
    }

    setNeedsRender();
    return;
  }

  if (it.type === 'pan') {
    const dx = screen.x - it.startScreen.x;
    const dy = screen.y - it.startScreen.y;
    renderer.setView({
      panX: it.startView.panX + dx,
      panY: it.startView.panY + dy,
    });
    setNeedsRender();
    return;
  }

  if (it.type === 'drag') {
    const dx = world.x - it.startWorld.x;
    const dy = world.y - it.startWorld.y;
    const shouldSnap = state.scene.meta.snapToGrid;
    const gridSize = state.scene.meta.gridSize;

    state.updateObjects(editor.selectionIds, (obj) => {
      const start = it.startPositions.get(obj.id);
      if (!start) {
        return null;
      }
      let x = start.x + dx;
      let y = start.y + dy;
      if (shouldSnap) {
        x = snap(x, gridSize);
        y = snap(y, gridSize);
      }
      return { x, y };
    });

    refreshRightPanel();
    setNeedsRender();
    return;
  }

  if (it.type === 'scale') {
    const object = state.getObjectById(it.objectId);
    if (!object) {
      return;
    }

    const currentDistance = SceneRenderer.distance(it.centerScreen, screen);
    const factor = Math.max(0.02, currentDistance / Math.max(0.001, it.startDistance));

    state.updateObject(object.id, {
      scaleX: it.startScaleX * factor,
      scaleY: it.startScaleY * factor,
    });
    refreshRightPanel();
    setNeedsRender();
    return;
  }

  if (it.type === 'rotate') {
    const object = state.getObjectById(it.objectId);
    if (!object) {
      return;
    }

    const currentAngle = SceneRenderer.angleFromCenter(it.centerScreen, screen);
    const delta = currentAngle - it.startAngle;
    state.updateObject(object.id, {
      rotation: it.startRotation + delta,
    });

    refreshRightPanel();
    setNeedsRender();
  }
}

function handlePointerUp() {
  const it = editor.interaction;
  editor.interaction = null;
  ui.el.sceneCanvas.style.cursor = 'default';

  if (!it) {
    return;
  }

  if (it.before) {
    const changed = state.commitIfChanged(it.before);
    if (changed) {
      saveToLocalStorage();
      refreshJSONArea();
      refreshRightPanel();
    }
  }

  setNeedsRender();
}

function bindPropertyInputs() {
  for (const prop of ui.propertyInputs.keys()) {
    const input = ui.propertyInputs.get(prop);
    input.addEventListener('change', () => applyPropertyChange(prop));
    if (input.type === 'text') {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          applyPropertyChange(prop);
        }
      });
    }
  }
}

function bindSceneInputs() {
  const onSceneChange = () => applySceneMetaChanges();
  ui.el.sceneName.addEventListener('change', onSceneChange);
  ui.el.sceneWidth.addEventListener('change', onSceneChange);
  ui.el.sceneHeight.addEventListener('change', onSceneChange);
  ui.el.gridSize.addEventListener('change', onSceneChange);
  ui.el.snapToggle.addEventListener('change', onSceneChange);
  ui.el.showGridToggle.addEventListener('change', () => {
    renderer.setGridVisible(ui.el.showGridToggle.checked);
    setNeedsRender();
  });
}

function handleHotkeys(event) {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const key = event.key.toLowerCase();
  const targetIsInput = isInputLike(event.target);

  if (targetIsInput) {
    if (event.key === 'Escape') {
      event.target.blur();
    }
    return;
  }

  if (mod && key === 's') {
    event.preventDefault();
    saveJSONFile();
    return;
  }

  if (mod && key === 'd') {
    event.preventDefault();
    duplicateSelection();
    return;
  }

  if (mod && key === 'c') {
    event.preventDefault();
    copySelection();
    return;
  }

  if (mod && key === 'v') {
    event.preventDefault();
    pasteSelection();
    return;
  }

  if (mod && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      if (state.redo()) {
        saveToLocalStorage();
        refreshRightPanel();
        refreshJSONArea();
        setNeedsRender();
      }
    } else if (state.undo()) {
      saveToLocalStorage();
      refreshRightPanel();
      refreshJSONArea();
      setNeedsRender();
    }
    return;
  }

  if (mod && key === 'y') {
    event.preventDefault();
    if (state.redo()) {
      saveToLocalStorage();
      refreshRightPanel();
      refreshJSONArea();
      setNeedsRender();
    }
    return;
  }

  if (event.code === 'Space') {
    editor.spacePressed = true;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSelection();
    return;
  }

  let step = 1;
  if (event.shiftKey) {
    step = 10;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    nudgeSelection(-step, 0);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    nudgeSelection(step, 0);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    nudgeSelection(0, -step);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    nudgeSelection(0, step);
  }
}

function bindUIEvents() {
  ui.el.assetSearch.addEventListener('input', () => {
    rerenderAssets();
  });
  ui.el.assetFileInput.addEventListener('change', async () => {
    await addAssetsFromFiles(ui.el.assetFileInput.files);
    ui.el.assetFileInput.value = '';
  });

  ui.el.duplicateBtn.addEventListener('click', duplicateSelection);
  ui.el.deleteBtn.addEventListener('click', deleteSelection);

  ui.el.undoBtn.addEventListener('click', () => {
    if (state.undo()) {
      saveToLocalStorage();
      refreshRightPanel();
      refreshJSONArea();
      setNeedsRender();
      setStatus('Undo');
    }
  });

  ui.el.redoBtn.addEventListener('click', () => {
    if (state.redo()) {
      saveToLocalStorage();
      refreshRightPanel();
      refreshJSONArea();
      setNeedsRender();
      setStatus('Redo');
    }
  });

  ui.el.bringForwardBtn.addEventListener('click', () => layerAction('bringForward'));
  ui.el.sendBackwardBtn.addEventListener('click', () => layerAction('sendBackward'));
  ui.el.bringToFrontBtn.addEventListener('click', () => layerAction('bringToFront'));
  ui.el.sendToBackBtn.addEventListener('click', () => layerAction('sendToBack'));

  ui.el.copyJsonBtn.addEventListener('click', copyJSONToClipboard);
  ui.el.saveJsonBtn.addEventListener('click', saveJSONFile);
  ui.el.loadJsonBtn.addEventListener('click', () => importFromJSONText(ui.getJSONArea()));
  ui.el.restoreLastBtn.addEventListener('click', restoreLastScene);
  ui.el.newSceneBtn.addEventListener('click', resetScene);

  ui.el.zoomRange.addEventListener('input', () => {
    setZoomFromPercent(Number(ui.el.zoomRange.value));
  });

  ui.el.fitViewBtn.addEventListener('click', () => {
    renderer.resetViewToFit();
    ui.setZoom(renderer.view.zoom * 100);
    setNeedsRender();
  });

  ui.el.sceneCanvas.addEventListener('pointerdown', (event) => {
    ui.el.sceneCanvas.setPointerCapture(event.pointerId);
    handlePointerDown(event);
  });

  ui.el.sceneCanvas.addEventListener('pointermove', handlePointerMove);

  ui.el.sceneCanvas.addEventListener('pointerup', (event) => {
    ui.el.sceneCanvas.releasePointerCapture(event.pointerId);
    handlePointerUp(event);
  });

  ui.el.sceneCanvas.addEventListener('pointercancel', handlePointerUp);

  ui.el.sceneCanvas.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const dir = event.deltaY > 0 ? -1 : 1;
      const zoom = clamp(renderer.view.zoom + dir * 0.05, 0.1, 4);
      setZoomFromPercent(zoom * 100, { x: event.offsetX, y: event.offsetY });
      return;
    }

    renderer.setView({
      panX: renderer.view.panX - event.deltaX * 0.35,
      panY: renderer.view.panY - event.deltaY * 0.35,
    });
    setNeedsRender();
  }, { passive: false });

  window.addEventListener('keydown', handleHotkeys);
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      editor.spacePressed = false;
    }
  });
  window.addEventListener('blur', () => {
    editor.spacePressed = false;
  });
  window.addEventListener('resize', () => {
    setNeedsRender();
  });

  bindPropertyInputs();
  bindSceneInputs();
}

function initializeScene() {
  let loaded = false;
  try {
    loaded = state.loadFromLocalStorage(LOCAL_STORAGE_KEY);
  } catch (error) {
    setStatus(`Load error: ${error.message}`);
  }

  if (!loaded) {
    state.replaceScene({ meta: DEFAULT_SCENE_META, objects: [] }, true);
    state.clearHistory();
  }

  renderer.setGridVisible(true);
  renderer.resetViewToFit();
  ui.setZoom(renderer.view.zoom * 100);

  loadCustomAssets();
  rerenderAssets();
  refreshRightPanel();
  refreshJSONArea();
  setNeedsRender();

  if (loaded) {
    setStatus('Loaded from localStorage');
  } else {
    setStatus('New scene');
  }
}

function bootstrap() {
  bindUIEvents();
  initializeScene();
  requestRenderLoop();
}

bootstrap();
