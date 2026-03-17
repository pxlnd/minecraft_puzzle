import { LOCAL_STORAGE_KEY } from './resources.js';
import { SceneState } from './scene-state.js';
import { SceneRenderer } from './renderer.js';

const canvas = document.getElementById('runtimeCanvas');
const jsonInput = document.getElementById('jsonInput');
const applyBtn = document.getElementById('applyBtn');
const loadLastBtn = document.getElementById('loadLastBtn');
const fitBtn = document.getElementById('fitBtn');

const state = new SceneState();
const renderer = new SceneRenderer(canvas, state, { mode: 'runtime' });
renderer.setMode('runtime');
renderer.setGridVisible(false);

let needsRender = true;

function setNeedsRender() {
  needsRender = true;
}

function loop() {
  if (needsRender) {
    renderer.render();
    needsRender = false;
  }
  requestAnimationFrame(loop);
}

function loadFromText(text) {
  try {
    state.importJSON(text);
    jsonInput.value = state.exportJSON(true);
    renderer.resetViewToFit();
    setNeedsRender();
  } catch (error) {
    alert(`Runtime import error: ${error.message}`);
  }
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    alert('No saved editor scene in localStorage');
    return;
  }
  loadFromText(raw);
}

applyBtn.addEventListener('click', () => {
  loadFromText(jsonInput.value);
});

loadLastBtn.addEventListener('click', loadFromLocalStorage);
fitBtn.addEventListener('click', () => {
  renderer.resetViewToFit();
  setNeedsRender();
});

canvas.addEventListener('wheel', (event) => {
  const zoomDelta = event.deltaY > 0 ? -0.05 : 0.05;
  renderer.setView({ zoom: renderer.view.zoom + zoomDelta });
  setNeedsRender();
}, { passive: true });

let dragging = false;
let dragStart = null;
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    panX: renderer.view.panX,
    panY: renderer.view.panY,
  };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging || !dragStart) {
    return;
  }
  renderer.setView({
    panX: dragStart.panX + (event.clientX - dragStart.x),
    panY: dragStart.panY + (event.clientY - dragStart.y),
  });
  setNeedsRender();
});

canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  dragStart = null;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  dragging = false;
  dragStart = null;
});

window.addEventListener('resize', setNeedsRender);

(function init() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    loadFromText(raw);
  } else {
    const fallback = {
      meta: { name: 'runtime_scene', width: 720, height: 1280, gridSize: 40, snapToGrid: false, version: 1 },
      objects: [],
    };
    state.replaceScene(fallback, true);
    jsonInput.value = state.exportJSON(true);
    renderer.resetViewToFit();
    setNeedsRender();
  }
  loop();
})();
