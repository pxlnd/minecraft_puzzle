import { DEFAULT_SCENE_META } from './resources.js';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeObject(input) {
  const width = Math.max(1, isFiniteNumber(input.width, 100));
  const height = Math.max(1, isFiniteNumber(input.height, 100));
  return {
    id: String(input.id || ''),
    name: String(input.name || 'object'),
    type: String(input.type || 'image'),
    src: String(input.src || ''),
    x: isFiniteNumber(input.x, 0),
    y: isFiniteNumber(input.y, 0),
    width,
    height,
    scaleX: isFiniteNumber(input.scaleX, 1),
    scaleY: isFiniteNumber(input.scaleY, 1),
    rotation: isFiniteNumber(input.rotation, 0),
    alpha: clamp(isFiniteNumber(input.alpha, 1), 0, 1),
    zIndex: isFiniteNumber(input.zIndex, 0),
    originX: clamp(isFiniteNumber(input.originX, 0.5), 0, 1),
    originY: clamp(isFiniteNumber(input.originY, 0.5), 0, 1),
    flipX: Boolean(input.flipX),
    flipY: Boolean(input.flipY),
    visible: input.visible !== false,
  };
}

function normalizeMeta(meta) {
  return {
    name: String(meta?.name || DEFAULT_SCENE_META.name),
    width: Math.max(1, isFiniteNumber(meta?.width, DEFAULT_SCENE_META.width)),
    height: Math.max(1, isFiniteNumber(meta?.height, DEFAULT_SCENE_META.height)),
    gridSize: Math.max(2, isFiniteNumber(meta?.gridSize, DEFAULT_SCENE_META.gridSize)),
    snapToGrid: Boolean(meta?.snapToGrid),
    version: isFiniteNumber(meta?.version, 1),
  };
}

export class SceneState {
  constructor(initialScene = null) {
    this._maxHistory = 120;
    this._undoStack = [];
    this._redoStack = [];
    this.idCounter = 1;
    this.scene = this._createEmptyScene();

    if (initialScene) {
      this.replaceScene(initialScene, false);
    }
  }

  _createEmptyScene() {
    return {
      meta: deepClone(DEFAULT_SCENE_META),
      objects: [],
    };
  }

  _currentSnapshot() {
    return {
      scene: deepClone(this.scene),
      idCounter: this.idCounter,
    };
  }

  captureSnapshot() {
    return this._currentSnapshot();
  }

  _restoreSnapshot(snapshot) {
    this.scene = deepClone(snapshot.scene);
    this.idCounter = snapshot.idCounter;
  }

  _equalsSnapshot(snapshot) {
    return JSON.stringify(this._currentSnapshot()) === JSON.stringify(snapshot);
  }

  commitIfChanged(beforeSnapshot) {
    if (!beforeSnapshot) {
      return false;
    }
    if (this._equalsSnapshot(beforeSnapshot)) {
      return false;
    }

    this._undoStack.push(beforeSnapshot);
    if (this._undoStack.length > this._maxHistory) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
    return true;
  }

  canUndo() {
    return this._undoStack.length > 0;
  }

  canRedo() {
    return this._redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) {
      return false;
    }
    const current = this._currentSnapshot();
    const previous = this._undoStack.pop();
    this._redoStack.push(current);
    this._restoreSnapshot(previous);
    return true;
  }

  redo() {
    if (!this.canRedo()) {
      return false;
    }
    const current = this._currentSnapshot();
    const next = this._redoStack.pop();
    this._undoStack.push(current);
    this._restoreSnapshot(next);
    return true;
  }

  clearHistory() {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }

  replaceScene(sceneData, clearHistory = true) {
    const meta = normalizeMeta(sceneData?.meta || {});
    const rawObjects = Array.isArray(sceneData?.objects) ? sceneData.objects : [];
    const objects = rawObjects.map((obj, index) => sanitizeObject({ ...obj, zIndex: index }));

    this.scene = {
      meta,
      objects,
    };

    let maxId = 0;
    for (const obj of objects) {
      const n = Number(String(obj.id).replace(/\D+/g, ''));
      if (Number.isFinite(n)) {
        maxId = Math.max(maxId, n);
      }
    }
    this.idCounter = maxId + 1;

    this.normalizeZIndices(false);
    if (clearHistory) {
      this.clearHistory();
    }
  }

  setMetaPatch(patch) {
    this.scene.meta = normalizeMeta({ ...this.scene.meta, ...patch });
  }

  generateId(prefix = 'obj') {
    const id = `${prefix}_${this.idCounter}`;
    this.idCounter += 1;
    return id;
  }

  createObjectFromAsset(asset, x, y) {
    const width = Math.max(1, Number(asset.width) || 100);
    const height = Math.max(1, Number(asset.height) || 100);

    return sanitizeObject({
      id: this.generateId('obj'),
      name: `${asset.name}_${this.idCounter - 1}`,
      type: asset.type || 'image',
      src: asset.src,
      x,
      y,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      alpha: 1,
      zIndex: this.scene.objects.length,
      originX: 0.5,
      originY: 0.5,
      flipX: false,
      flipY: false,
      visible: true,
    });
  }

  addObject(objectData) {
    const object = sanitizeObject(objectData);
    if (!object.id) {
      object.id = this.generateId('obj');
    }
    if (!object.name) {
      object.name = object.id;
    }
    object.zIndex = this.scene.objects.length;
    this.scene.objects.push(object);
    this.normalizeZIndices(false);
    return object;
  }

  getObjectById(id) {
    return this.scene.objects.find((obj) => obj.id === id) || null;
  }

  getObjectsByIds(ids) {
    const set = new Set(ids);
    return this.scene.objects.filter((obj) => set.has(obj.id));
  }

  updateObject(id, patch) {
    const object = this.getObjectById(id);
    if (!object) {
      return null;
    }
    Object.assign(object, patch);
    const sanitized = sanitizeObject(object);
    Object.assign(object, sanitized);
    return object;
  }

  updateObjects(ids, updater) {
    const idSet = new Set(ids);
    let count = 0;
    for (const obj of this.scene.objects) {
      if (!idSet.has(obj.id)) {
        continue;
      }
      const patch = typeof updater === 'function' ? updater(obj) : updater;
      if (!patch) {
        continue;
      }
      Object.assign(obj, patch);
      const sanitized = sanitizeObject(obj);
      Object.assign(obj, sanitized);
      count += 1;
    }
    return count;
  }

  removeObjects(ids) {
    const idSet = new Set(ids);
    const previousLength = this.scene.objects.length;
    this.scene.objects = this.scene.objects.filter((obj) => !idSet.has(obj.id));
    this.normalizeZIndices(false);
    return previousLength - this.scene.objects.length;
  }

  duplicateObjects(ids, offset = { x: 24, y: 24 }) {
    const originals = this.getObjectsByIds(ids).sort((a, b) => a.zIndex - b.zIndex);
    const clones = [];

    for (const src of originals) {
      const clone = sanitizeObject({
        ...src,
        id: this.generateId('obj'),
        name: `${src.name}_copy`,
        x: src.x + offset.x,
        y: src.y + offset.y,
      });
      clone.zIndex = this.scene.objects.length + clones.length;
      clones.push(clone);
    }

    this.scene.objects.push(...clones);
    this.normalizeZIndices(false);
    return clones;
  }

  normalizeZIndices(sortByCurrent = true) {
    if (sortByCurrent) {
      this.scene.objects.sort((a, b) => a.zIndex - b.zIndex);
    }
    this.scene.objects.forEach((obj, index) => {
      obj.zIndex = index;
    });
  }

  bringForward(ids) {
    this._moveByStep(ids, 1);
  }

  sendBackward(ids) {
    this._moveByStep(ids, -1);
  }

  bringToFront(ids) {
    const idSet = new Set(ids);
    const selected = this.scene.objects.filter((o) => idSet.has(o.id));
    const other = this.scene.objects.filter((o) => !idSet.has(o.id));
    this.scene.objects = [...other, ...selected];
    this.normalizeZIndices(false);
  }

  sendToBack(ids) {
    const idSet = new Set(ids);
    const selected = this.scene.objects.filter((o) => idSet.has(o.id));
    const other = this.scene.objects.filter((o) => !idSet.has(o.id));
    this.scene.objects = [...selected, ...other];
    this.normalizeZIndices(false);
  }

  _moveByStep(ids, step) {
    const idSet = new Set(ids);
    this.normalizeZIndices(true);

    if (step > 0) {
      for (let i = this.scene.objects.length - 2; i >= 0; i -= 1) {
        const curr = this.scene.objects[i];
        const next = this.scene.objects[i + 1];
        if (idSet.has(curr.id) && !idSet.has(next.id)) {
          this.scene.objects[i] = next;
          this.scene.objects[i + 1] = curr;
        }
      }
    } else {
      for (let i = 1; i < this.scene.objects.length; i += 1) {
        const prev = this.scene.objects[i - 1];
        const curr = this.scene.objects[i];
        if (idSet.has(curr.id) && !idSet.has(prev.id)) {
          this.scene.objects[i - 1] = curr;
          this.scene.objects[i] = prev;
        }
      }
    }

    this.normalizeZIndices(false);
  }

  setObjectZIndex(id, targetIndex) {
    this.normalizeZIndices(true);
    const fromIndex = this.scene.objects.findIndex((obj) => obj.id === id);
    if (fromIndex < 0) {
      return false;
    }

    const clamped = Math.max(0, Math.min(this.scene.objects.length - 1, Math.round(targetIndex)));
    if (fromIndex === clamped) {
      return false;
    }

    const [item] = this.scene.objects.splice(fromIndex, 1);
    this.scene.objects.splice(clamped, 0, item);
    this.normalizeZIndices(false);
    return true;
  }

  toSerializableScene() {
    this.normalizeZIndices(true);
    return {
      meta: deepClone(this.scene.meta),
      objects: this.scene.objects.map((obj) => sanitizeObject(obj)),
    };
  }

  exportJSON(pretty = true) {
    return JSON.stringify(this.toSerializableScene(), null, pretty ? 2 : 0);
  }

  importJSON(text) {
    const parsed = JSON.parse(text);
    this.replaceScene(parsed, true);
    return this.toSerializableScene();
  }

  saveToLocalStorage(storageKey) {
    localStorage.setItem(storageKey, this.exportJSON(false));
  }

  loadFromLocalStorage(storageKey) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return false;
    }
    this.importJSON(raw);
    return true;
  }
}
