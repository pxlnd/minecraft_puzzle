function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class SceneRenderer {
  constructor(canvas, sceneState, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sceneState = sceneState;
    this.mode = options.mode || 'editor';

    this.devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.view = {
      zoom: 0.6,
      panX: 80,
      panY: 80,
    };

    this.images = new Map();
    this.imageLoadQueue = new Set();

    this.hoverWorld = { x: 0, y: 0 };
    this.selectionIds = [];
    this.selectionBounds = null;
    this.showGrid = true;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setSelection(ids) {
    this.selectionIds = [...ids];
    this.selectionBounds = this.computeSelectionBounds();
  }

  setHoverWorld(world) {
    this.hoverWorld = world;
  }

  setGridVisible(visible) {
    this.showGrid = Boolean(visible);
  }

  setView(viewPatch) {
    this.view.zoom = clamp(viewPatch.zoom ?? this.view.zoom, 0.1, 4);
    this.view.panX = viewPatch.panX ?? this.view.panX;
    this.view.panY = viewPatch.panY ?? this.view.panY;
  }

  resetViewToFit(padding = 48) {
    const { width, height } = this.sceneState.scene.meta;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const zoomX = (w - padding * 2) / width;
    const zoomY = (h - padding * 2) / height;
    const zoom = clamp(Math.min(zoomX, zoomY), 0.1, 2);

    this.view.zoom = zoom;
    this.view.panX = (w - width * zoom) * 0.5;
    this.view.panY = (h - height * zoom) * 0.5;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const pixelW = Math.max(1, Math.floor(rect.width * this.devicePixelRatio));
    const pixelH = Math.max(1, Math.floor(rect.height * this.devicePixelRatio));
    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) {
      this.canvas.width = pixelW;
      this.canvas.height = pixelH;
    }
  }

  ensureImage(src) {
    if (!src) {
      return null;
    }
    if (this.images.has(src)) {
      return this.images.get(src);
    }
    if (this.imageLoadQueue.has(src)) {
      return null;
    }

    this.imageLoadQueue.add(src);
    const img = new Image();
    img.onload = () => {
      this.images.set(src, img);
      this.imageLoadQueue.delete(src);
    };
    img.onerror = () => {
      this.images.set(src, null);
      this.imageLoadQueue.delete(src);
    };
    img.src = src;
    return null;
  }

  worldToScreen(x, y) {
    return {
      x: x * this.view.zoom + this.view.panX,
      y: y * this.view.zoom + this.view.panY,
    };
  }

  screenToWorld(x, y) {
    return {
      x: (x - this.view.panX) / this.view.zoom,
      y: (y - this.view.panY) / this.view.zoom,
    };
  }

  transformLocalToWorld(obj, localX, localY) {
    const sx = obj.scaleX * (obj.flipX ? -1 : 1);
    const sy = obj.scaleY * (obj.flipY ? -1 : 1);
    const scaledX = localX * sx;
    const scaledY = localY * sy;

    const r = degToRad(obj.rotation);
    const c = Math.cos(r);
    const s = Math.sin(r);

    return {
      x: obj.x + scaledX * c - scaledY * s,
      y: obj.y + scaledX * s + scaledY * c,
    };
  }

  worldToObjectLocal(obj, worldX, worldY) {
    const dx = worldX - obj.x;
    const dy = worldY - obj.y;

    const r = degToRad(-obj.rotation);
    const c = Math.cos(r);
    const s = Math.sin(r);

    const rotatedX = dx * c - dy * s;
    const rotatedY = dx * s + dy * c;

    const sx = obj.scaleX * (obj.flipX ? -1 : 1);
    const sy = obj.scaleY * (obj.flipY ? -1 : 1);

    return {
      x: sx === 0 ? 0 : rotatedX / sx,
      y: sy === 0 ? 0 : rotatedY / sy,
    };
  }

  getObjectLocalBounds(obj) {
    const left = -obj.originX * obj.width;
    const top = -obj.originY * obj.height;
    return {
      left,
      top,
      right: left + obj.width,
      bottom: top + obj.height,
      width: obj.width,
      height: obj.height,
    };
  }

  getObjectWorldCorners(obj) {
    const b = this.getObjectLocalBounds(obj);
    return [
      this.transformLocalToWorld(obj, b.left, b.top),
      this.transformLocalToWorld(obj, b.right, b.top),
      this.transformLocalToWorld(obj, b.right, b.bottom),
      this.transformLocalToWorld(obj, b.left, b.bottom),
    ];
  }

  getObjectWorldAABB(obj) {
    const corners = this.getObjectWorldCorners(obj);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of corners) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  computeSelectionBounds() {
    if (!this.selectionIds.length) {
      return null;
    }
    const selected = this.sceneState.getObjectsByIds(this.selectionIds);
    if (!selected.length) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const obj of selected) {
      const b = this.getObjectWorldAABB(obj);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  getSelectionHandles() {
    if (this.selectionIds.length !== 1) {
      return null;
    }
    const obj = this.sceneState.getObjectById(this.selectionIds[0]);
    if (!obj) {
      return null;
    }

    const corners = this.getObjectWorldCorners(obj);
    const center = { x: obj.x, y: obj.y };

    const topMid = {
      x: (corners[0].x + corners[1].x) * 0.5,
      y: (corners[0].y + corners[1].y) * 0.5,
    };
    const dir = { x: topMid.x - center.x, y: topMid.y - center.y };
    const len = Math.max(0.0001, Math.hypot(dir.x, dir.y));
    const unit = { x: dir.x / len, y: dir.y / len };

    return {
      objectId: obj.id,
      center,
      scale: corners[2],
      rotate: {
        x: topMid.x + unit.x * 60,
        y: topMid.y + unit.y * 60,
      },
      topMid,
    };
  }

  getHandleAtScreen(screenX, screenY) {
    const handles = this.getSelectionHandles();
    if (!handles) {
      return null;
    }

    const threshold = 12;
    const points = [
      { type: 'scale', point: handles.scale },
      { type: 'rotate', point: handles.rotate },
    ];

    for (const item of points) {
      const p = this.worldToScreen(item.point.x, item.point.y);
      if (Math.hypot(p.x - screenX, p.y - screenY) <= threshold) {
        return {
          type: item.type,
          objectId: handles.objectId,
          center: handles.center,
        };
      }
    }

    return null;
  }

  hitTest(worldX, worldY) {
    const objects = [...this.sceneState.scene.objects].sort((a, b) => a.zIndex - b.zIndex);
    for (let i = objects.length - 1; i >= 0; i -= 1) {
      const obj = objects[i];
      if (!obj.visible || obj.alpha <= 0) {
        continue;
      }
      const local = this.worldToObjectLocal(obj, worldX, worldY);
      const b = this.getObjectLocalBounds(obj);
      if (local.x >= b.left && local.x <= b.right && local.y >= b.top && local.y <= b.bottom) {
        return obj;
      }
    }
    return null;
  }

  drawBackground() {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1e2026');
    grad.addColorStop(1, '#101116');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < canvas.height; y += 32 * this.devicePixelRatio) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGrid() {
    if (!this.showGrid) {
      return;
    }

    const { width, height, gridSize } = this.sceneState.scene.meta;
    const { ctx } = this;

    ctx.save();
    ctx.translate(this.view.panX * this.devicePixelRatio, this.view.panY * this.devicePixelRatio);
    ctx.scale(this.view.zoom * this.devicePixelRatio, this.view.zoom * this.devicePixelRatio);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1 / this.view.zoom;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSceneBounds() {
    const { ctx } = this;
    const { width, height } = this.sceneState.scene.meta;

    ctx.save();
    ctx.translate(this.view.panX * this.devicePixelRatio, this.view.panY * this.devicePixelRatio);
    ctx.scale(this.view.zoom * this.devicePixelRatio, this.view.zoom * this.devicePixelRatio);

    ctx.fillStyle = '#2d3240';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2 / this.view.zoom;
    ctx.strokeRect(0, 0, width, height);

    ctx.restore();
  }

  drawObjects() {
    const { ctx } = this;
    const objects = [...this.sceneState.scene.objects].sort((a, b) => a.zIndex - b.zIndex);

    ctx.save();
    ctx.translate(this.view.panX * this.devicePixelRatio, this.view.panY * this.devicePixelRatio);
    ctx.scale(this.view.zoom * this.devicePixelRatio, this.view.zoom * this.devicePixelRatio);

    for (const obj of objects) {
      if (!obj.visible || obj.alpha <= 0) {
        continue;
      }

      const image = this.ensureImage(obj.src);
      const local = this.getObjectLocalBounds(obj);

      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(degToRad(obj.rotation));
      ctx.scale(obj.scaleX * (obj.flipX ? -1 : 1), obj.scaleY * (obj.flipY ? -1 : 1));
      ctx.globalAlpha = obj.alpha;

      if (image) {
        ctx.drawImage(image, local.left, local.top, obj.width, obj.height);
      } else {
        ctx.fillStyle = 'rgba(255, 157, 66, 0.35)';
        ctx.fillRect(local.left, local.top, obj.width, obj.height);
        ctx.strokeStyle = 'rgba(255, 157, 66, 0.9)';
        ctx.lineWidth = 2 / this.view.zoom;
        ctx.strokeRect(local.left, local.top, obj.width, obj.height);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  drawSelection() {
    if (this.mode !== 'editor' || !this.selectionIds.length) {
      return;
    }

    const { ctx } = this;
    const selected = this.sceneState.getObjectsByIds(this.selectionIds);

    ctx.save();
    ctx.translate(this.view.panX * this.devicePixelRatio, this.view.panY * this.devicePixelRatio);
    ctx.scale(this.view.zoom * this.devicePixelRatio, this.view.zoom * this.devicePixelRatio);

    ctx.strokeStyle = 'rgba(67, 186, 255, 0.95)';
    ctx.lineWidth = 2 / this.view.zoom;

    for (const obj of selected) {
      const b = this.getObjectWorldAABB(obj);
      ctx.strokeRect(b.minX, b.minY, b.width, b.height);
    }

    const handles = this.getSelectionHandles();
    if (handles) {
      ctx.beginPath();
      ctx.moveTo(handles.topMid.x, handles.topMid.y);
      ctx.lineTo(handles.rotate.x, handles.rotate.y);
      ctx.stroke();

      const handleRadius = 8 / this.view.zoom;

      ctx.fillStyle = '#43baff';
      ctx.beginPath();
      ctx.arc(handles.scale.x, handles.scale.y, handleRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(handles.rotate.x, handles.rotate.y, handleRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawAxesInfo() {
    if (this.mode !== 'editor') {
      return;
    }

    const { ctx } = this;
    const screen = this.worldToScreen(this.hoverWorld.x, this.hoverWorld.y);

    ctx.save();
    ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(12, 12, 180, 28);
    ctx.fillStyle = '#e8ecf1';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(`x:${this.hoverWorld.x.toFixed(1)}  y:${this.hoverWorld.y.toFixed(1)}`, 18, 30);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(screen.x, 0);
    ctx.lineTo(screen.x, this.canvas.height / this.devicePixelRatio);
    ctx.moveTo(0, screen.y);
    ctx.lineTo(this.canvas.width / this.devicePixelRatio, screen.y);
    ctx.stroke();
    ctx.restore();
  }

  render() {
    this.resize();
    this.drawBackground();
    this.drawSceneBounds();
    this.drawGrid();
    this.drawObjects();
    this.drawSelection();
    this.drawAxesInfo();
  }

  static angleFromCenter(center, point) {
    return radToDeg(Math.atan2(point.y - center.y, point.x - center.x));
  }

  static distance(a, b) {
    return distance(a, b);
  }
}
