export const ASSETS = [
  {
    id: 'grass',
    name: 'Grass',
    type: 'image',
    src: './assets/grass.png',
    width: 256,
    height: 256,
  },
  {
    id: 'floor',
    name: 'Floor',
    type: 'image',
    src: './assets/floor.jpg',
    width: 720,
    height: 320,
  },
  {
    id: 'border',
    name: 'Border',
    type: 'image',
    src: './assets/border.png',
    width: 720,
    height: 1280,
  },
  {
    id: 'reference',
    name: 'Reference',
    type: 'image',
    src: './assets/reference.png',
    width: 720,
    height: 1280,
  },
  {
    id: 'puzzle_placeholder',
    name: 'Puzzle Placeholder',
    type: 'image',
    src: './assets/puzzle_placeholder.svg',
    width: 520,
    height: 620,
  },
  {
    id: 'ui_top_placeholder',
    name: 'UI Top Placeholder',
    type: 'image',
    src: './assets/ui_top_placeholder.svg',
    width: 1024,
    height: 220,
  },
  {
    id: 'ui_left_placeholder',
    name: 'UI Left Placeholder',
    type: 'image',
    src: './assets/ui_left_placeholder.svg',
    width: 180,
    height: 580,
  },
  {
    id: 'ui_bottom_placeholder',
    name: 'UI Bottom Placeholder',
    type: 'image',
    src: './assets/ui_bottom_placeholder.svg',
    width: 960,
    height: 260,
  },
];

export const DEFAULT_SCENE_META = {
  name: 'scene_main',
  width: 720,
  height: 1280,
  gridSize: 40,
  snapToGrid: false,
  version: 1,
};

export const LOCAL_STORAGE_KEY = 'scene_builder:last_scene';
