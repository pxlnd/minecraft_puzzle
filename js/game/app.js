(function () {
  const CARRIER_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
  const PIECE_GEOMETRY = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const IMPACT_BURST_GEOMETRY = new THREE.SphereGeometry(1, 8, 8);
  const IMPACT_RING_GEOMETRY = new THREE.RingGeometry(0.55, 0.78, 28);
  const UNAVAILABLE_FLASH_COLOR = new THREE.Color(0xff4747);

  const TEMP_A = new THREE.Vector3();
  const TEMP_B = new THREE.Vector3();
  const TEMP_C = new THREE.Vector3();
  const LOOK_TARGET = new THREE.Vector3();
  const TEXTURE_LOADER = new THREE.TextureLoader();
  const TEXTURE_DATA = window.PROTOTYPE_TEXTURE_DATA || {};

  function loadTexture(path, options) {
    const settings = options || {};
    const texture = TEXTURE_LOADER.load(path);

    if ('colorSpace' in texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else if ('encoding' in texture) {
      texture.encoding = THREE.sRGBEncoding;
    }

    texture.anisotropy = 4;

    if (settings.pixelated) {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestMipmapNearestFilter;
    }

    if (settings.repeatX || settings.repeatY) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(settings.repeatX || 1, settings.repeatY || 1);
    }

    return texture;
  }

  function pixelHash(x, y, seed = 0) {
    const n = Math.sin((x + seed * 0.17) * 12.9898 + (y - seed * 0.11) * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function createPixelCanvasTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else if ('encoding' in texture) {
      texture.encoding = THREE.sRGBEncoding;
    }
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    draw(ctx, size, canvas, texture);
    return texture;
  }

  function paintPaletteNoise(ctx, size, palette, seed) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const n = pixelHash(x, y, seed);
        const idx = Math.min(palette.length - 1, Math.floor(n * palette.length));
        ctx.fillStyle = palette[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function createWaterFlowTexture() {
    const size = 32;
    const texture = createPixelCanvasTexture(size, (ctx) => {
      ctx.clearRect(0, 0, size, size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const n = pixelHash(x, y, 319);
          const waveA = Math.sin((x * 0.64) + (y * 0.84) + n * 3.1);
          const waveB = Math.sin((x * 1.18) - (y * 0.42) + n * 1.9);
          const strength = 0.5 + waveA * 0.22 + waveB * 0.12;
          const clamped = Math.max(0, Math.min(1, strength));
          const r = Math.round(70 + clamped * 42);
          const g = Math.round(126 + clamped * 58);
          const b = Math.round(188 + clamped * 62);
          const a = Math.round(180 + clamped * 52);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    });
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.6, 1.6);
    return texture;
  }

  function createFallbackBlocks() {
    const blocks = [];
    for (let z = -3; z <= 3; z += 1) {
      for (let x = -5; x <= 5; x += 1) {
        blocks.push({ type: 'stone', x, y: 0, z });
      }
    }
    return blocks;
  }

  function createFallbackRails() {
    return [
      { type: 'straight', x: -1, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 0, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 1, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 2, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 3, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 4, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 5, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 6, z: 5, yaw: Math.PI * 0.5 },
      { type: 'straight', x: 7, z: 5, yaw: Math.PI * 1.5 },
      { type: 'corner', x: 8, z: 5, yaw: 0 },
    ];
  }

  const FALLBACK_BLOCK_LIBRARY = [
    {
      id: 'stone',
      label: 'Stone',
      shape: 'cube',
      textureKey: 'stone',
      fallbackTexture: './assets/block/minecraft_stone.png',
      inventory: true,
      color: 0xa5a9af,
    },
    {
      id: 'wood',
      label: 'Wood',
      shape: 'cube',
      textureKey: 'wood',
      fallbackTexture: './assets/block/wood.webp',
      inventory: true,
      color: 0xc9a26d,
    },
    {
      id: 'grass',
      label: 'Grass',
      shape: 'cube',
      textureKey: 'grass',
      fallbackTexture: './assets/grass.png',
      inventory: true,
      color: 0x8bbf67,
    },
    {
      id: 'water',
      label: 'Water',
      shape: 'water',
      inventory: true,
      color: 0x4f86df,
    },
    {
      id: 'door',
      label: 'Door',
      shape: 'door',
      editorGroup: 'props',
      textureKey: 'wood',
      fallbackTexture: './assets/block/minecraft_oak_door_item.png',
      doorTopTextureKey: 'oak_door_top',
      doorBottomTextureKey: 'oak_door_bottom',
      inventory: true,
      color: 0x8a6435,
    },
  ];
  const BLOCK_LIBRARY = Array.isArray(window.MC_BLOCK_LIBRARY) && window.MC_BLOCK_LIBRARY.length > 0
    ? window.MC_BLOCK_LIBRARY
    : FALLBACK_BLOCK_LIBRARY;
  const DEFAULT_BLOCK_ID = BLOCK_LIBRARY[0] ? BLOCK_LIBRARY[0].id : 'stone';
  const BLOCK_DEFS_BY_ID = {};
  for (const blockDef of BLOCK_LIBRARY) {
    if (blockDef && blockDef.id) {
      BLOCK_DEFS_BY_ID[blockDef.id] = blockDef;
    }
  }
  const INVENTORY_BLOCK_DEFS = BLOCK_LIBRARY.filter((blockDef) => blockDef.inventory !== false);

  const FALLBACK_LEVEL_DEF = {
    id: 'fallback_level',
    name: 'Fallback Level',
    blocks: createFallbackBlocks(),
    rails: createFallbackRails(),
    minecart: { speed: 11 },
  };
  function normalizeLevelSourcePath(value) {
    return String(value || '').replace(/\\/g, '/').trim();
  }

  function isProjectLevel(level) {
    if (!level || !level.id) {
      return false;
    }
    const sourcePath = normalizeLevelSourcePath(level.__sourcePath);
    if (!sourcePath) {
      return false;
    }
    return /\/levels\/[^/]+\.js$/i.test(sourcePath);
  }

  function getProjectLevelLabel(level) {
    if (!isProjectLevel(level)) {
      return level && (level.name || level.id) ? (level.name || level.id) : '';
    }
    const sourcePath = normalizeLevelSourcePath(level.__sourcePath);
    const match = sourcePath.match(/\/levels\/([^/]+)\.js$/i);
    if (match && match[1]) {
      return match[1];
    }
    return level.name || level.id;
  }

  const REGISTERED_LEVELS = Array.isArray(window.MC_LEVELS) ? window.MC_LEVELS.filter(isProjectLevel) : [];
  const LEVEL_CATALOG = REGISTERED_LEVELS.length > 0 ? REGISTERED_LEVELS : [FALLBACK_LEVEL_DEF];
  const LEVELS_BY_ID = new Map();
  for (const level of LEVEL_CATALOG) {
    if (level && level.id) {
      LEVELS_BY_ID.set(level.id, level);
    }
  }

  function getBlockDefinition(type) {
    return BLOCK_DEFS_BY_ID[type] || BLOCK_DEFS_BY_ID[DEFAULT_BLOCK_ID] || BLOCK_LIBRARY[0];
  }

  function resolveTexturePath(textureKey, fallbackPath) {
    if (textureKey && typeof TEXTURE_DATA[textureKey] === 'string' && TEXTURE_DATA[textureKey]) {
      return TEXTURE_DATA[textureKey];
    }
    if (window.location.protocol === 'file:') {
      return '';
    }
    return fallbackPath || '';
  }

  const BLOCK_TEXTURES = {};
  for (const blockDef of BLOCK_LIBRARY) {
    const source = resolveTexturePath(blockDef.textureKey, blockDef.fallbackTexture);
    BLOCK_TEXTURES[blockDef.id] = source ? loadTexture(source, { pixelated: true }) : null;
  }
  const EDITOR_TEXTURE_MODE_AUTO = 'auto';
  const BLOCK_ROTATION_STEPS_DEG = [0, 90, 180, 270];
  const BLOCK_TEXTURE_KEYS = Array.from(new Set(
    BLOCK_LIBRARY
      .map((blockDef) => blockDef && blockDef.textureKey)
      .concat(Object.keys(TEXTURE_DATA || {}))
      .filter((key) => key && key !== 'railCornerOverlay'),
  ));
  const BLOCK_TEXTURES_BY_KEY = {};
  for (const textureKey of BLOCK_TEXTURE_KEYS) {
    const texturePath = resolveTexturePath(textureKey, '');
    BLOCK_TEXTURES_BY_KEY[textureKey] = texturePath ? loadTexture(texturePath, { pixelated: true }) : null;
  }
  const SHAPE_LABELS = {
    cube: 'Cube',
    slab: 'Slab',
    pillar: 'Pillar',
    stairs: 'Stairs',
    door: 'Door',
    water: 'Water',
  };
  const WATER_BLOCK_ID = 'water';
  const WATER_FLOW_TEXTURE = createWaterFlowTexture();
  const EDITOR_GROUP_PROPS = 'props';
  function getEditorGroup(blockDef) {
    if (!blockDef || typeof blockDef !== 'object') {
      return 'blocks';
    }
    return blockDef.editorGroup === EDITOR_GROUP_PROPS ? EDITOR_GROUP_PROPS : 'blocks';
  }
  const BLOCK_SHAPE_OPTIONS = [];
  const PROP_EDITOR_OPTIONS = [];
  const BLOCK_SHAPE_SET = new Set();
  for (const blockDef of BLOCK_LIBRARY) {
    if (!blockDef || !blockDef.id) {
      continue;
    }
    if (getEditorGroup(blockDef) === EDITOR_GROUP_PROPS) {
      PROP_EDITOR_OPTIONS.push({
        id: blockDef.id,
        type: blockDef.id,
        shape: blockDef.shape || 'cube',
        label: blockDef.label || blockDef.id,
        textureKey: blockDef.textureKey || '',
        fallbackTexture: blockDef.fallbackTexture || '',
      });
      continue;
    }
    const shape = blockDef.shape || 'cube';
    if (BLOCK_SHAPE_SET.has(shape)) {
      continue;
    }
    BLOCK_SHAPE_SET.add(shape);
    BLOCK_SHAPE_OPTIONS.push({
      id: shape,
      shape,
      type: blockDef.id,
      label: SHAPE_LABELS[shape] || shape,
    });
  }
  const SHAPE_PREVIEW_TEXTURE_KEY = BLOCK_TEXTURE_KEYS.includes('stone')
    ? 'stone'
    : (BLOCK_TEXTURE_KEYS[0] || '');
  const SHAPE_PREVIEW_TEXTURE_SOURCE = SHAPE_PREVIEW_TEXTURE_KEY
    ? resolveTexturePath(SHAPE_PREVIEW_TEXTURE_KEY, '')
    : '';

  function normalizeBlockRotationDeg(value) {
    let deg = Number(value);
    if (!Number.isFinite(deg)) {
      return 0;
    }
    if (Math.abs(deg) <= Math.PI * 2 + 1e-6) {
      deg = (deg * 180) / Math.PI;
    }
    let wrapped = ((deg % 360) + 360) % 360;
    let best = 0;
    let bestDist = Infinity;
    for (const candidate of BLOCK_ROTATION_STEPS_DEG) {
      const diff = Math.abs(wrapped - candidate);
      if (diff < bestDist) {
        bestDist = diff;
        best = candidate;
      }
    }
    if (wrapped > 315 || wrapped < 45) {
      return 0;
    }
    return best;
  }

  function normalizeEditorTextureKey(value) {
    if (value === undefined || value === null || value === '' || value === EDITOR_TEXTURE_MODE_AUTO) {
      return EDITOR_TEXTURE_MODE_AUTO;
    }
    const key = String(value);
    return Object.prototype.hasOwnProperty.call(BLOCK_TEXTURES_BY_KEY, key)
      ? key
      : EDITOR_TEXTURE_MODE_AUTO;
  }
  const doorBlockDef = getBlockDefinition('door');
  const doorTopPath = './assets/oak_door_top.png';
  const doorBottomPath = './assets/oak_door_bottom.png';
  const DOOR_TEXTURES = {
    top: loadTexture(doorTopPath, { pixelated: true }),
    bottom: loadTexture(doorBottomPath, { pixelated: true }),
  };
  const DOOR_MODEL_PATH = './assets/minecraft_door.glb';
  const ENABLE_DOOR_GLB = true;
  const DOOR_MODEL_STATE = {
    template: null,
    unitHeight: 1,
    loading: false,
    failed: false,
  };
  const DOOR_DEFAULT_DIMENSIONS = {
    offsetX: 0,
    liftY: 0.49,
    width: 1.02,
    height: 1.994,
    thickness: 0.122,
  };
  const DOOR_DIMENSIONS = { ...DOOR_DEFAULT_DIMENSIONS };

  function getDoorVariantScale(variant) {
    if (variant === 'piece') {
      return { width: 0.58 / 0.68, height: 2.8 / 2.744 };
    }
    if (variant === 'carrier') {
      return { width: 0.62 / 0.68, height: 2.576 / 2.744 };
    }
    if (variant === 'showcase') {
      return { width: 1, height: 2.8 / 2.744 };
    }
    return { width: 1, height: 1 };
  }

  function getDoorDimensionsForVariant(size, variant = 'placed') {
    const s = Number.isFinite(size) && size > 0 ? size : 1;
    const k = getDoorVariantScale(variant);
    return {
      offsetX: s * DOOR_DIMENSIONS.offsetX,
      liftY: s * DOOR_DIMENSIONS.liftY,
      width: s * DOOR_DIMENSIONS.width * k.width,
      height: s * DOOR_DIMENSIONS.height * k.height,
      thickness: s * DOOR_DIMENSIONS.thickness * k.width,
    };
  }

  function createDoorMaterial(texture) {
    return new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture ? 0xffffff : 0x8a6435,
      roughness: 0.88,
      metalness: 0.04,
      transparent: true,
      alphaTest: 0.35,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }

  function disposeObject3D(root) {
    if (!root) {
      return;
    }
    root.traverse((node) => {
      if (!node.isMesh) {
        return;
      }
      if (node.geometry) {
        node.geometry.dispose();
      }
      if (Array.isArray(node.material)) {
        for (const material of node.material) {
          if (material && typeof material.dispose === 'function') {
            material.dispose();
          }
        }
      } else if (node.material && typeof node.material.dispose === 'function') {
        node.material.dispose();
      }
    });
  }

  function ensureDoorModelLoading() {
    if (DOOR_MODEL_STATE.template || DOOR_MODEL_STATE.loading || DOOR_MODEL_STATE.failed) {
      return;
    }
    if (!THREE.GLTFLoader) {
      DOOR_MODEL_STATE.failed = true;
      console.warn('GLTFLoader is unavailable; fallback door panel is used.');
      return;
    }

    DOOR_MODEL_STATE.loading = true;
    const loader = new THREE.GLTFLoader();
    loader.load(
      DOOR_MODEL_PATH,
      (gltf) => {
        DOOR_MODEL_STATE.loading = false;
        const root = gltf && (gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null));
        if (!root) {
          DOOR_MODEL_STATE.failed = true;
          console.warn('Door model loaded but scene root is missing.');
          return;
        }

        const template = root.clone(true);
        template.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(template);
        if (box.isEmpty()) {
          DOOR_MODEL_STATE.failed = true;
          console.warn('Door model has empty bounds.');
          return;
        }

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
        template.position.sub(center);
        template.scale.setScalar(1 / maxDim);
        template.updateMatrixWorld(true);

        const normalizedBox = new THREE.Box3().setFromObject(template);
        DOOR_MODEL_STATE.unitHeight = Math.max(1e-6, normalizedBox.max.y - normalizedBox.min.y);
        template.position.y += -0.5 - normalizedBox.min.y;
        template.updateMatrixWorld(true);

        const midY = (normalizedBox.min.y + normalizedBox.max.y) * 0.5;
        template.traverse((node) => {
          if (node.isMesh) {
            const nodeBox = new THREE.Box3().setFromObject(node);
            const centerY = nodeBox.isEmpty() ? 0 : (nodeBox.min.y + nodeBox.max.y) * 0.5;
            const texture = centerY >= midY ? DOOR_TEXTURES.top : DOOR_TEXTURES.bottom;
            node.material = createDoorMaterial(texture);
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        DOOR_MODEL_STATE.template = template;
      },
      undefined,
      (error) => {
        DOOR_MODEL_STATE.loading = false;
        DOOR_MODEL_STATE.failed = true;
        console.warn('Failed to load door GLB. Fallback door panel is used.', error);
      },
    );
  }

  function createDoorModelMesh(size, variant = 'placed') {
    if (!ENABLE_DOOR_GLB) {
      return null;
    }
    ensureDoorModelLoading();
    if (!DOOR_MODEL_STATE.template) {
      return null;
    }

    const dims = getDoorDimensionsForVariant(size, variant);
    const targetHeight = dims.height;
    const scale = targetHeight / Math.max(1e-6, DOOR_MODEL_STATE.unitHeight);
    const defaultDims = {
      width: Math.max(1e-6, size * DOOR_DEFAULT_DIMENSIONS.width * getDoorVariantScale(variant).width),
      thickness: Math.max(1e-6, size * DOOR_DEFAULT_DIMENSIONS.thickness * getDoorVariantScale(variant).width),
    };
    const widthScale = dims.width / defaultDims.width;
    const thicknessScale = dims.thickness / defaultDims.thickness;

    const clone = DOOR_MODEL_STATE.template.clone(true);
    clone.scale.set(scale * widthScale, scale, scale * thicknessScale);
    clone.rotation.y = Math.PI * 0.5;
    clone.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    if (!scaledBox.isEmpty()) {
      clone.position.y += -0.5 - scaledBox.min.y;
    }
    return clone;
  }

  function createDoorPanelGeometry(width, height, thickness = 0.1) {
    return new THREE.BoxGeometry(
      Math.max(0.02, thickness),
      Math.max(0.02, height),
      Math.max(0.02, width),
    );
  }

  function createDoorFallbackMesh(size, variant = 'placed') {
    const group = new THREE.Group();
    const dims = getDoorDimensionsForVariant(size, variant);
    const width = dims.width;
    const height = dims.height;
    const thickness = Math.max(0.02, dims.thickness);
    const halfH = height * 0.5;
    const matTop = createDoorMaterial(DOOR_TEXTURES.top);
    const matBottom = createDoorMaterial(DOOR_TEXTURES.bottom);
    const top = new THREE.Mesh(createDoorPanelGeometry(width, halfH, thickness), matTop);
    const bottom = new THREE.Mesh(createDoorPanelGeometry(width, halfH, thickness), matBottom);
    top.position.set(0, halfH * 0.5, 0);
    bottom.position.set(0, -halfH * 0.5, 0);
    group.add(top);
    group.add(bottom);
    group.position.y += halfH - 0.5;
    group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return group;
  }

  function ensureDoorShowcaseNearMinecart(_scene, _minecart) {
    return null;
  }

  function removeDoorShowcase(scene) {
    if (!scene) {
      return null;
    }
    let group = scene.getObjectByName('door-showcase-near-minecart');
    if (!group) {
      return null;
    }
    scene.remove(group);
    disposeObject3D(group);
    return null;
  }

  function createStairsMesh(size, material, variant = 'placed') {
    const full = variant === 'piece' ? size * 0.72 : size;
    const group = new THREE.Group();
    const lowerStep = new THREE.Mesh(
      new THREE.BoxGeometry(full, full * 0.5, full),
      material,
    );
    lowerStep.position.y = -full * 0.25;
    const upperStep = new THREE.Mesh(
      new THREE.BoxGeometry(full, full * 0.5, full * 0.5),
      material,
    );
    upperStep.position.set(0, full * 0.25, full * 0.25);

    group.add(lowerStep);
    group.add(upperStep);
    group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return group;
  }

  function createBlockMesh(type, size, material, variant = 'placed') {
    const blockDef = getBlockDefinition(type);
    const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';

    if (shape === 'door') {
      const dims = getDoorDimensionsForVariant(size, variant);
      const modelMesh = createDoorModelMesh(size, variant);
      if (modelMesh) {
        if (variant === 'placed') {
          modelMesh.position.y += dims.liftY;
        }
        return modelMesh;
      }
      const fallbackMesh = createDoorFallbackMesh(size, variant);
      if (variant === 'placed') {
        fallbackMesh.position.y += dims.liftY;
      }
      return fallbackMesh;
    }

    if (shape === 'stairs') {
      return createStairsMesh(size, material, variant);
    }

    if (shape === 'slab') {
      let mesh;
      if (variant === 'piece') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 0.72, size * 0.36, size * 0.72), material);
      } else if (variant === 'carrier') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.55, size), material);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.5, size), material);
      }
      mesh.position.y -= size * 0.25;
      return mesh;
    }

    if (shape === 'water') {
      let mesh;
      if (variant === 'piece') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 0.72, size * 0.72, size * 0.72), material);
      } else if (variant === 'carrier') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
      }
      return mesh;
    }

    if (shape === 'pillar') {
      if (variant === 'piece') {
        return new THREE.Mesh(new THREE.BoxGeometry(size * 0.45, size * 0.72, size * 0.45), material);
      }
      if (variant === 'carrier') {
        return new THREE.Mesh(new THREE.BoxGeometry(size * 0.72, size, size * 0.72), material);
      }
      return new THREE.Mesh(new THREE.BoxGeometry(size * 0.62, size, size * 0.62), material);
    }

    if (variant === 'piece') {
      return new THREE.Mesh(PIECE_GEOMETRY, material);
    }
    if (variant === 'carrier') {
      return new THREE.Mesh(CARRIER_GEOMETRY, material);
    }
    return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material);
  }

  function setPlacedBlockWorldPosition(mesh, type, size, worldPosition) {
    if (!mesh || !worldPosition) {
      return;
    }
    mesh.position.copy(worldPosition);
    const blockDef = getBlockDefinition(type);
    const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';
    if (shape === 'door') {
      const dims = getDoorDimensionsForVariant(size, 'placed');
      mesh.position.x += dims.offsetX;
      mesh.position.y += dims.liftY;
    }
  }

  function attachCellUserData(root, cell) {
    if (!root || !cell) {
      return;
    }
    const payload = { x: cell.x, y: cell.y, z: cell.z };
    root.userData.cell = payload;
    if (typeof root.traverse === 'function') {
      root.traverse((node) => {
        if (node && node.userData) {
          node.userData.cell = payload;
        }
      });
    }
  }

  function createMinecraftGroundTextureSet() {
    const size = 16;
    const grassTopPalette = ['#4f8e45', '#5d9b4f', '#6aa85a', '#4a833f', '#78b766'];
    const grassSidePalette = ['#4a8a42', '#5c9a4f', '#6cab5f', '#3f7b38'];
    const dirtPalette = ['#5f452f', '#6d5036', '#7a5a3d', '#815f41', '#523c2a'];

    const top = createPixelCanvasTexture(size, (ctx) => {
      paintPaletteNoise(ctx, size, grassTopPalette, 13);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const patch = pixelHash(x, y, 29);
          if (patch > 0.9) {
            ctx.fillStyle = '#85c870';
            ctx.fillRect(x, y, 1, 1);
          } else if (patch < 0.06) {
            ctx.fillStyle = '#3f7437';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    const side = createPixelCanvasTexture(size, (ctx) => {
      paintPaletteNoise(ctx, size, dirtPalette, 41);
      for (let x = 0; x < size; x += 1) {
        const dripDepth = 2 + Math.floor(pixelHash(x, 0, 77) * 3);
        for (let y = 0; y < dripDepth; y += 1) {
          if (y === 0 || pixelHash(x, y, 85) > 0.22) {
            const n = pixelHash(x, y, 93);
            const idx = Math.min(grassSidePalette.length - 1, Math.floor(n * grassSidePalette.length));
            ctx.fillStyle = grassSidePalette[idx];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });

    const bottom = createPixelCanvasTexture(size, (ctx) => {
      paintPaletteNoise(ctx, size, dirtPalette, 57);
    });

    return { top, side, bottom };
  }

  const GROUND_TEXTURE_SET = createMinecraftGroundTextureSet();

  function createMinecraftTreeTextureSet() {
    const size = 16;
    const barkPalette = ['#5a4630', '#6a5338', '#7a6140', '#483926', '#34291c'];
    const leavesPalette = ['#245f2a', '#2f7635', '#3a8a41', '#1f5424', '#4a9b50'];

    const trunk = createPixelCanvasTexture(size, (ctx) => {
      paintPaletteNoise(ctx, size, barkPalette, 133);
      for (let x = 0; x < size; x += 1) {
        if (pixelHash(x, 0, 149) > 0.64) {
          for (let y = 0; y < size; y += 1) {
            if (pixelHash(x, y, 163) > 0.18) {
              ctx.fillStyle = '#2a2117';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    });

    const leaves = createPixelCanvasTexture(size, (ctx) => {
      ctx.clearRect(0, 0, size, size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const gap = pixelHash(x, y, 191);
          if (gap > 0.84) {
            continue;
          }
          const n = pixelHash(x, y, 173);
          const idx = Math.min(leavesPalette.length - 1, Math.floor(n * leavesPalette.length));
          ctx.fillStyle = leavesPalette[idx];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    });

    return { trunk, leaves };
  }

  function createMinecraftRailTextures() {
    const size = 32;
    const postProcessCornerTexture = (ctx2d) => {
      const image = ctx2d.getImageData(0, 0, size, size);
      const data = image.data;

      const railHi = [225, 229, 234];
      const railBase = [182, 188, 196];
      const railLo = [133, 139, 147];

      // Pass 1: snap semitransparent pixels to opaque and normalize gray rail tones.
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) {
          continue;
        }
        data[i + 3] = 255;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const isGray = max - min <= 14 && max >= 95;
        if (!isGray) {
          continue;
        }

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const tone = lum > 205 ? railHi : (lum < 140 ? railLo : railBase);
        data[i] = tone[0];
        data[i + 1] = tone[1];
        data[i + 2] = tone[2];
      }

      // Pass 2: fill tiny pinholes inside sleepers/rails.
      const src = new Uint8ClampedArray(data);
      for (let y = 1; y < size - 1; y += 1) {
        for (let x = 1; x < size - 1; x += 1) {
          const idx = (y * size + x) * 4;
          if (src[idx + 3] !== 0) {
            continue;
          }

          let count = 0;
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              if (ox === 0 && oy === 0) {
                continue;
              }
              const nIdx = ((y + oy) * size + (x + ox)) * 4;
              if (src[nIdx + 3] === 0) {
                continue;
              }
              count += 1;
              sumR += src[nIdx];
              sumG += src[nIdx + 1];
              sumB += src[nIdx + 2];
            }
          }

          if (count >= 6) {
            data[idx] = Math.round(sumR / count);
            data[idx + 1] = Math.round(sumG / count);
            data[idx + 2] = Math.round(sumB / count);
            data[idx + 3] = 255;
          }
        }
      }

      ctx2d.putImageData(image, 0, 0);
    };

    const straight = createPixelCanvasTexture(size, (ctx) => {
      ctx.clearRect(0, 0, size, size);

      for (let y = 2; y < size; y += 8) {
        ctx.fillStyle = '#5b432c';
        ctx.fillRect(4, y, size - 8, 3);
        ctx.fillStyle = '#8f6b42';
        ctx.fillRect(5, y, size - 10, 1);
        ctx.fillStyle = '#3f2f20';
        ctx.fillRect(5, y + 2, size - 10, 1);
      }

      const railXs = [6, 26];
      for (const x of railXs) {
        ctx.fillStyle = '#b6bcc4';
        ctx.fillRect(x - 1, 0, 3, size);
        ctx.fillStyle = '#e1e5ea';
        ctx.fillRect(x - 1, 0, 1, size);
        ctx.fillStyle = '#858b93';
        ctx.fillRect(x + 1, 0, 1, size);
      }
    });

    const corner = createPixelCanvasTexture(size, (ctx, _size, _canvas, texture) => {
      ctx.clearRect(0, 0, size, size);
      const cx = 0;
      const cy = 0;
      const drawRailCurve = (radius, baseColor, hiColor, loColor) => {
        for (let t = 0; t <= 1; t += 0.005) {
          const theta = t * Math.PI * 0.5;
          const x = Math.round(cx + radius * Math.cos(theta));
          const y = Math.round(cy + radius * Math.sin(theta));
          ctx.fillStyle = baseColor;
          ctx.fillRect(x - 1, y - 1, 3, 3);
          ctx.fillStyle = hiColor;
          ctx.fillRect(x - 1, y - 1, 1, 3);
          ctx.fillStyle = loColor;
          ctx.fillRect(x + 1, y - 1, 1, 3);
        }
      };

      // Keep the same offsets as straight rails (6 and 26 px from tile edges).
      drawRailCurve(26, '#b6bcc4', '#e1e5ea', '#858b93');
      drawRailCurve(6, '#b6bcc4', '#e1e5ea', '#858b93');

      const tieAngles = [14, 28, 42, 56, 70];
      const tieRadius = 16;
      for (const deg of tieAngles) {
        const theta = (deg * Math.PI) / 180;
        const x = cx + tieRadius * Math.cos(theta);
        const y = cy + tieRadius * Math.sin(theta);
        const tx = -Math.sin(theta);
        const ty = Math.cos(theta);
        const nx = Math.cos(theta);
        const ny = Math.sin(theta);

        // Draw sleepers across the rail gauge (normal direction), with small thickness along tangent.
        for (let s = -10; s <= 10; s += 1) {
          for (let w = -1; w <= 1; w += 1) {
            const px = Math.round(x + nx * s + tx * w);
            const py = Math.round(y + ny * s + ty * w);
            if (px < 0 || py < 0 || px >= size || py >= size) {
              continue;
            }
            if (w < 0) {
              ctx.fillStyle = '#8f6b42';
            } else if (w > 0) {
              ctx.fillStyle = '#3f2f20';
            } else {
              ctx.fillStyle = '#5b432c';
            }
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }

      const overlaySrc = TEXTURE_DATA.railCornerOverlay;
      const canUseOverlay = typeof overlaySrc === 'string' && overlaySrc.startsWith('data:image/');
      if (canUseOverlay) {
        const overlay = new Image();
        overlay.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(overlay, 0, 0, size, size);
          postProcessCornerTexture(ctx);
          texture.needsUpdate = true;
        };
        overlay.src = overlaySrc;
      } else {
        postProcessCornerTexture(ctx);
      }
    });

    return { straight, corner };
  }

  function createMinecartTexture() {
    const size = 32;
    return createPixelCanvasTexture(size, (ctx) => {
      ctx.clearRect(0, 0, size, size);
      const palette = ['#8a9098', '#979ea7', '#7f868f', '#757c85', '#a4acb5', '#6c737b'];
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const n = pixelHash(x, y, 91);
          const idx = Math.min(palette.length - 1, Math.floor(n * palette.length));
          ctx.fillStyle = palette[idx];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    });
  }

  const TREE_TEXTURE_SET = createMinecraftTreeTextureSet();
  const RAIL_TEXTURES = createMinecraftRailTextures();
  const MINECART_TEXTURE = createMinecartTexture();
  function cloneLevelData(level) {
    const source = level && typeof level === 'object' ? level : FALLBACK_LEVEL_DEF;
    const blocks = Array.isArray(source.blocks) ? source.blocks.map((block) => ({ ...block })) : createFallbackBlocks();
    const rails = Array.isArray(source.rails) ? source.rails.map((rail) => ({ ...rail })) : createFallbackRails();
    const minecartSpeed = source.minecart && Number.isFinite(source.minecart.speed) ? source.minecart.speed : 11;
    return {
      id: source.id || FALLBACK_LEVEL_DEF.id,
      name: source.name || source.id || 'Unnamed Level',
      blocks,
      rails,
      minecartSpeed,
      camera: source.camera && typeof source.camera === 'object' ? { ...source.camera } : null,
    };
  }

  const INITIAL_LEVEL_ID = LEVEL_CATALOG[0] && LEVEL_CATALOG[0].id ? LEVEL_CATALOG[0].id : FALLBACK_LEVEL_DEF.id;
  const INITIAL_LEVEL_DATA = cloneLevelData(LEVELS_BY_ID.get(INITIAL_LEVEL_ID) || FALLBACK_LEVEL_DEF);
  const DEFAULT_EDITOR_LEVEL = { blocks: INITIAL_LEVEL_DATA.blocks };
  const DEFAULT_RAILS_LAYOUT = INITIAL_LEVEL_DATA.rails;

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  function hashNoise2D(x, z) {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function valueNoise2D(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;
    const tx = smoothStep(x - x0);
    const tz = smoothStep(z - z0);
    const a = lerp(hashNoise2D(x0, z0), hashNoise2D(x1, z0), tx);
    const b = lerp(hashNoise2D(x0, z1), hashNoise2D(x1, z1), tx);
    return lerp(a, b, tz);
  }

  function normalizeAngle(a) {
    let v = a;
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    return v;
  }

  function createRailTileMaterial(texture) {
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.08,
      transparent: true,
      alphaTest: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }

  function createGroundBlockMaterial() {
    const side = new THREE.MeshStandardMaterial({
      map: GROUND_TEXTURE_SET.side,
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0,
    });
    const top = new THREE.MeshStandardMaterial({
      map: GROUND_TEXTURE_SET.top,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
    });
    const bottom = new THREE.MeshStandardMaterial({
      map: GROUND_TEXTURE_SET.bottom,
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
    });

    return [side, side, top, bottom, side, side];
  }

  function createTreeMaterials() {
    const trunk = new THREE.MeshStandardMaterial({
      map: TREE_TEXTURE_SET.trunk,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
    });
    const leaves = new THREE.MeshStandardMaterial({
      map: TREE_TEXTURE_SET.leaves,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      alphaTest: 0.35,
    });
    return { trunk, leaves };
  }

  function cellKey(x, z) {
    return `${x}:${z}`;
  }

  function createVoxelTerrain(scene) {
    const group = new THREE.Group();
    const halfSize = 28;
    const clearRadius = 11;
    const minLayer = -1;
    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blockMaterial = createGroundBlockMaterial();
    const transforms = [];
    const topLayerMap = new Map();

    for (let gx = -halfSize; gx <= halfSize; gx += 1) {
      for (let gz = -halfSize; gz <= halfSize; gz += 1) {
        const distance = Math.hypot(gx, gz);
        const base = valueNoise2D(gx * 0.15, gz * 0.15);
        const detail = valueNoise2D((gx + 73) * 0.31, (gz - 37) * 0.31);
        const noiseHeight = Math.round((base * 0.72 + detail * 0.28 - 0.46) * 6);
        let topLayer = distance <= clearRadius ? 0 : Math.max(0, noiseHeight);

        if (distance > clearRadius) {
          topLayer += Math.min(2, Math.floor((distance - clearRadius) * 0.12));
        }
        topLayerMap.set(cellKey(gx, gz), topLayer);

        for (let y = minLayer; y < topLayer; y += 1) {
          transforms.push({
            x: gx + 0.5,
            y: y + 0.5,
            z: gz + 0.5,
          });
        }
      }
    }

    const terrain = new THREE.InstancedMesh(blockGeometry, blockMaterial, transforms.length);
    terrain.castShadow = false;
    terrain.receiveShadow = true;
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < transforms.length; i += 1) {
      const t = transforms[i];
      matrix.makeTranslation(t.x, t.y, t.z);
      terrain.setMatrixAt(i, matrix);
    }
    terrain.instanceMatrix.needsUpdate = true;
    group.add(terrain);
    scene.add(group);
    return {
      group,
      halfSize,
      clearRadius,
      topLayerMap,
    };
  }

  function createVoxelTrees(scene, terrainData) {
    const { halfSize, clearRadius, topLayerMap } = terrainData;
    const { trunk: trunkMaterial, leaves: leavesMaterial } = createTreeMaterials();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const trunkTransforms = [];
    const leafTransforms = [];
    const treeAnchors = [];
    const minTreeDistance = 4;

    for (let gx = -halfSize + 3; gx <= halfSize - 3; gx += 1) {
      for (let gz = -halfSize + 3; gz <= halfSize - 3; gz += 1) {
        const distance = Math.hypot(gx, gz);
        if (distance <= clearRadius + 6 || distance >= halfSize - 2) {
          continue;
        }

        if (hashNoise2D(gx * 0.71 + 17, gz * 0.71 - 9) < 0.92) {
          continue;
        }

        let blocked = false;
        for (const prev of treeAnchors) {
          if (Math.abs(prev.x - gx) < minTreeDistance && Math.abs(prev.z - gz) < minTreeDistance) {
            blocked = true;
            break;
          }
        }
        if (blocked) {
          continue;
        }

        const topLayer = topLayerMap.get(cellKey(gx, gz));
        if (topLayer === undefined) {
          continue;
        }

        treeAnchors.push({ x: gx, z: gz });
        const trunkHeight = 3 + Math.floor(hashNoise2D(gx * 1.31, gz * 1.31) * 2);

        for (let i = 0; i < trunkHeight; i += 1) {
          trunkTransforms.push({
            x: gx + 0.5,
            y: topLayer + i + 0.5,
            z: gz + 0.5,
          });
        }

        const crownLevels = [
          { y: topLayer + trunkHeight, radius: 2 },
          { y: topLayer + trunkHeight + 1, radius: 2 },
          { y: topLayer + trunkHeight + 2, radius: 1 },
          { y: topLayer + trunkHeight + 3, radius: 0 },
        ];

        for (const level of crownLevels) {
          for (let dx = -level.radius; dx <= level.radius; dx += 1) {
            for (let dz = -level.radius; dz <= level.radius; dz += 1) {
              if (level.radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) {
                continue;
              }
              leafTransforms.push({
                x: gx + dx + 0.5,
                y: level.y + 0.5,
                z: gz + dz + 0.5,
              });
            }
          }
        }
      }
    }

    const treeGroup = new THREE.Group();
    const matrix = new THREE.Matrix4();

    if (trunkTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(geometry, trunkMaterial, trunkTransforms.length);
      trunks.castShadow = true;
      trunks.receiveShadow = true;
      for (let i = 0; i < trunkTransforms.length; i += 1) {
        const t = trunkTransforms[i];
        matrix.makeTranslation(t.x, t.y, t.z);
        trunks.setMatrixAt(i, matrix);
      }
      trunks.instanceMatrix.needsUpdate = true;
      treeGroup.add(trunks);
    }

    if (leafTransforms.length > 0) {
      const leaves = new THREE.InstancedMesh(geometry, leavesMaterial, leafTransforms.length);
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      for (let i = 0; i < leafTransforms.length; i += 1) {
        const t = leafTransforms[i];
        matrix.makeTranslation(t.x, t.y, t.z);
        leaves.setMatrixAt(i, matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
      treeGroup.add(leaves);
    }

    scene.add(treeGroup);
    return treeGroup;
  }

  class RoundedRectTrackCurve extends THREE.Curve {
    constructor(width, height, radius, y) {
      super();
      this.width = width;
      this.height = height;
      this.radius = radius;
      this.y = y;

      this.lineX = Math.max(0.001, width - 2 * radius);
      this.lineZ = Math.max(0.001, height - 2 * radius);
      this.arcLength = Math.PI * radius * 0.5;
      this.perimeter = 2 * (this.lineX + this.lineZ) + 4 * this.arcLength;
    }

    getPoint(t, target = new THREE.Vector3()) {
      const wrapped = ((t % 1) + 1) % 1;
      let d = wrapped * this.perimeter;

      const halfW = this.width * 0.5;
      const halfH = this.height * 0.5;
      const r = this.radius;

      if (d <= this.lineX) {
        return target.set(-halfW + r + d, this.y, halfH);
      }
      d -= this.lineX;

      if (d <= this.arcLength) {
        const theta = Math.PI * 0.5 - d / r;
        return target.set(halfW - r + r * Math.cos(theta), this.y, halfH - r + r * Math.sin(theta));
      }
      d -= this.arcLength;

      if (d <= this.lineZ) {
        return target.set(halfW, this.y, halfH - r - d);
      }
      d -= this.lineZ;

      if (d <= this.arcLength) {
        const theta = 0 - d / r;
        return target.set(halfW - r + r * Math.cos(theta), this.y, -halfH + r + r * Math.sin(theta));
      }
      d -= this.arcLength;

      if (d <= this.lineX) {
        return target.set(halfW - r - d, this.y, -halfH);
      }
      d -= this.lineX;

      if (d <= this.arcLength) {
        const theta = -Math.PI * 0.5 - d / r;
        return target.set(-halfW + r + r * Math.cos(theta), this.y, -halfH + r + r * Math.sin(theta));
      }
      d -= this.arcLength;

      if (d <= this.lineZ) {
        return target.set(-halfW, this.y, -halfH + r + d);
      }
      d -= this.lineZ;

      const theta = Math.PI - d / r;
      return target.set(-halfW + r + r * Math.cos(theta), this.y, halfH - r + r * Math.sin(theta));
    }

    getTangent(t, target = new THREE.Vector3()) {
      const epsilon = 0.0005;
      const before = this.getPoint(t - epsilon, new THREE.Vector3());
      const after = this.getPoint(t + epsilon, new THREE.Vector3());
      return target.copy(after).sub(before).normalize();
    }
  }

  class OffsetTrackCurve extends THREE.Curve {
    constructor(baseCurve, offset, yOffset = 0) {
      super();
      this.baseCurve = baseCurve;
      this.offset = offset;
      this.yOffset = yOffset;
      this._point = new THREE.Vector3();
      this._tangent = new THREE.Vector3();
    }

    getPoint(t, target = new THREE.Vector3()) {
      const p = this.baseCurve.getPoint(t, this._point);
      const tan = this.baseCurve.getTangent(t, this._tangent);
      let nx = -tan.z;
      let nz = tan.x;
      const len = Math.hypot(nx, nz) || 1;
      nx /= len;
      nz /= len;
      return target.set(
        p.x + nx * this.offset,
        p.y + this.yOffset,
        p.z + nz * this.offset,
      );
    }

    getTangent(t, target = new THREE.Vector3()) {
      return this.baseCurve.getTangent(t, target);
    }
  }

  const RAIL_DIRECTIONS = [
    { dx: 0, dz: -1 }, // north
    { dx: 1, dz: 0 }, // east
    { dx: 0, dz: 1 }, // south
    { dx: -1, dz: 0 }, // west
  ];

  function rotateDirectionIndex(baseIndex, quarterTurns) {
    return (baseIndex + quarterTurns + 4) % 4;
  }

  function directionIndexToPoint(x, z, dirIndex) {
    const d = RAIL_DIRECTIONS[dirIndex];
    return {
      x: x + d.dx * 0.5,
      z: z + d.dz * 0.5,
    };
  }

  function pointKey(point) {
    return `${point.x.toFixed(4)}:${point.z.toFixed(4)}`;
  }

  function buildRailPath(layout, y) {
    const list = Array.isArray(layout) ? layout : [];
    const rotateVecFormulaA = (dx, dz, yaw) => {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      return { dx: dx * c + dz * s, dz: -dx * s + dz * c };
    };
    const rotateVecFormulaB = (dx, dz, yaw) => {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      return { dx: dx * c - dz * s, dz: dx * s + dz * c };
    };

    const variants = [
      { rotate: rotateVecFormulaA, corner: [{ dx: 0, dz: -1 }, { dx: -1, dz: 0 }] },
      { rotate: rotateVecFormulaA, corner: [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }] },
      { rotate: rotateVecFormulaB, corner: [{ dx: 0, dz: -1 }, { dx: -1, dz: 0 }] },
      { rotate: rotateVecFormulaB, corner: [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }] },
    ];

    const tryBuild = (variant) => {
      const segments = [];
      const nodes = new Map();
      const usedCells = new Set();

      const snapDir = (v) => {
        const sx = Math.abs(v.dx) > 0.5 ? Math.sign(v.dx) : 0;
        const sz = Math.abs(v.dz) > 0.5 ? Math.sign(v.dz) : 0;
        return { dx: sx, dz: sz };
      };

      const addNodeRef = (point, segmentIndex, endIndex) => {
        const key = pointKey(point);
        let node = nodes.get(key);
        if (!node) {
          node = { key, x: point.x, z: point.z, links: [] };
          nodes.set(key, node);
        }
        node.links.push({ segmentIndex, endIndex });
        return key;
      };

      for (const item of list) {
        const x = Math.round(Number(item.x));
        const z = Math.round(Number(item.z));
        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          continue;
        }
        const cellKey = `${x}:${z}`;
        if (usedCells.has(cellKey)) {
          continue;
        }
        usedCells.add(cellKey);

        const type = item.type === 'corner' ? 'corner' : 'straight';
        const yaw = Number(item.yaw) || 0;
        const baseA = { dx: 0, dz: -1 };
        const baseB = type === 'straight' ? { dx: 0, dz: 1 } : variant.corner[1];

        const d0 = snapDir(variant.rotate(baseA.dx, baseA.dz, yaw));
        const d1 = snapDir(variant.rotate(baseB.dx, baseB.dz, yaw));
        if ((d0.dx === 0 && d0.dz === 0) || (d1.dx === 0 && d1.dz === 0)) {
          return null;
        }

        const p0 = { x: x + d0.dx * 0.5, z: z + d0.dz * 0.5 };
        const p1 = { x: x + d1.dx * 0.5, z: z + d1.dz * 0.5 };
        const segment = {
          type,
          points: [p0, p1],
          center: null,
          nodeKeys: ['', ''],
        };

        if (type === 'corner') {
          segment.center = {
            x: x + Math.sign(d0.dx + d1.dx) * 0.5,
            z: z + Math.sign(d0.dz + d1.dz) * 0.5,
          };
        }

        const segmentIndex = segments.length;
        segment.nodeKeys[0] = addNodeRef(p0, segmentIndex, 0);
        segment.nodeKeys[1] = addNodeRef(p1, segmentIndex, 1);
        segments.push(segment);
      }

      if (segments.length < 2 || nodes.size < 2) {
        return null;
      }
      for (const node of nodes.values()) {
        if (node.links.length !== 2) {
          return null;
        }
      }

      const sortedKeys = Array.from(nodes.keys()).sort();
      const startKey = sortedKeys[0];
      let currentKey = startKey;
      let prevSegmentIndex = -1;
      const ordered = [];

      for (let i = 0; i < segments.length + 1; i += 1) {
        const node = nodes.get(currentKey);
        if (!node) {
          return null;
        }
        const link = node.links.find((entry) => entry.segmentIndex !== prevSegmentIndex);
        if (!link) {
          return null;
        }

        const seg = segments[link.segmentIndex];
        const fromEnd = link.endIndex;
        const toEnd = fromEnd === 0 ? 1 : 0;
        const nextKey = seg.nodeKeys[toEnd];
        ordered.push({ segment: seg, fromEnd, toEnd });
        prevSegmentIndex = link.segmentIndex;
        currentKey = nextKey;
        if (currentKey === startKey) {
          break;
        }
      }

      if (currentKey !== startKey || ordered.length !== segments.length) {
        return null;
      }

      return ordered;
    };

    let directedBase = null;
    for (const variant of variants) {
      directedBase = tryBuild(variant);
      if (directedBase) {
        break;
      }
    }
    if (!directedBase) {
      return null;
    }

    const directed = directedBase.map((entry) => {
      const seg = entry.segment;
      if (seg.type === 'straight') {
        return { ...entry, length: 1 };
      }
      return { ...entry, length: Math.PI * 0.5 * 0.5 };
    });

    const totalLength = directed.reduce((sum, seg) => sum + seg.length, 0);
    if (totalLength <= 0.0001) {
      return null;
    }

    const pointAtDirected = (item, u) => {
      const from = item.segment.points[item.fromEnd];
      const to = item.segment.points[item.toEnd];
      if (item.segment.type === 'straight') {
        return { x: lerp(from.x, to.x, u), z: lerp(from.z, to.z, u) };
      }
      const c = item.segment.center;
      const a0 = Math.atan2(from.z - c.z, from.x - c.x);
      const a1 = Math.atan2(to.z - c.z, to.x - c.x);
      const delta = normalizeAngle(a1 - a0);
      const a = a0 + delta * u;
      return { x: c.x + Math.cos(a) * 0.5, z: c.z + Math.sin(a) * 0.5 };
    };

    return {
      perimeter: totalLength,
      getPoint(t, target = new THREE.Vector3()) {
        const wrapped = ((t % 1) + 1) % 1;
        let d = wrapped * totalLength;
        for (const seg of directed) {
          if (d <= seg.length) {
            const p = pointAtDirected(seg, seg.length > 0 ? d / seg.length : 0);
            return target.set(p.x, y, p.z);
          }
          d -= seg.length;
        }
        const last = directed[directed.length - 1];
        const p = pointAtDirected(last, 1);
        return target.set(p.x, y, p.z);
      },
      getTangent(t, target = new THREE.Vector3()) {
        const epsilon = 0.0005;
        const before = this.getPoint(t - epsilon, TEMP_A);
        const after = this.getPoint(t + epsilon, TEMP_B);
        return target.copy(after).sub(before).normalize();
      },
    };
  }

  function buildRailLayoutFromCurve(curve) {
    if (!curve || typeof curve.getPoint !== 'function') {
      return [];
    }

    const perimeter = Math.max(0.001, Number(curve.perimeter) || 1);
    const sampleCount = Math.max(240, Math.ceil(perimeter * 36));
    const cells = new Map();

    const getCell = (x, z) => {
      const key = `${x}:${z}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = { x, z, counts: [0, 0, 0, 0] };
        cells.set(key, cell);
      }
      return cell;
    };

    const dirFromDelta = (dx, dz) => {
      if (dx === 1 && dz === 0) return 1; // east
      if (dx === -1 && dz === 0) return 3; // west
      if (dx === 0 && dz === 1) return 2; // south
      if (dx === 0 && dz === -1) return 0; // north
      return -1;
    };

    const connectCells = (ax, az, bx, bz) => {
      const dx = Math.max(-1, Math.min(1, bx - ax));
      const dz = Math.max(-1, Math.min(1, bz - az));
      const dirA = dirFromDelta(dx, dz);
      const dirB = dirFromDelta(-dx, -dz);
      if (dirA < 0 || dirB < 0) {
        return;
      }
      const a = getCell(ax, az);
      const b = getCell(bx, bz);
      a.counts[dirA] += 1;
      b.counts[dirB] += 1;
    };

    const samples = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleCount;
      const p = curve.getPoint(t, TEMP_A);
      samples.push({ x: Math.round(p.x), z: Math.round(p.z), t });
    }

    for (let i = 0; i < sampleCount; i += 1) {
      const a = samples[i];
      const b = samples[(i + 1) % sampleCount];
      if (a.x === b.x && a.z === b.z) {
        continue;
      }

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (Math.abs(dx) + Math.abs(dz) === 1) {
        connectCells(a.x, a.z, b.x, b.z);
        continue;
      }

      if (Math.abs(dx) === 1 && Math.abs(dz) === 1) {
        const tangent = curve.getTangent(a.t, TEMP_B);
        if (Math.abs(tangent.x) >= Math.abs(tangent.z)) {
          connectCells(a.x, a.z, b.x, a.z);
          connectCells(b.x, a.z, b.x, b.z);
        } else {
          connectCells(a.x, a.z, a.x, b.z);
          connectCells(a.x, b.z, b.x, b.z);
        }
      }
    }

    const pairToQuarterTurns = (d0, d1) => {
      const dirs = [d0, d1].sort((a, b) => a - b);
      const straightVertical = dirs[0] === 0 && dirs[1] === 2;
      const straightHorizontal = dirs[0] === 1 && dirs[1] === 3;
      if (straightVertical) {
        return { type: 'straight', quarterTurns: 0 };
      }
      if (straightHorizontal) {
        return { type: 'straight', quarterTurns: 1 };
      }

      const base = [0, 3]; // north + west
      for (let q = 0; q < 4; q += 1) {
        const a = rotateDirectionIndex(base[0], q);
        const b = rotateDirectionIndex(base[1], q);
        const rotated = [a, b].sort((x, y) => x - y);
        if (rotated[0] === dirs[0] && rotated[1] === dirs[1]) {
          return { type: 'corner', quarterTurns: q };
        }
      }
      return null;
    };

    const rails = [];
    for (const cell of cells.values()) {
      const activeDirs = [];
      for (let dir = 0; dir < 4; dir += 1) {
        if (cell.counts[dir] > 0) {
          activeDirs.push({ dir, weight: cell.counts[dir] });
        }
      }
      if (activeDirs.length < 2) {
        continue;
      }

      activeDirs.sort((a, b) => b.weight - a.weight || a.dir - b.dir);
      const chosen = pairToQuarterTurns(activeDirs[0].dir, activeDirs[1].dir);
      if (!chosen) {
        continue;
      }

      rails.push({
        type: chosen.type,
        x: cell.x,
        z: cell.z,
        yaw: chosen.quarterTurns * (Math.PI * 0.5),
      });
    }

    rails.sort((a, b) => (a.z - b.z) || (a.x - b.x));
    return rails;
  }

  function addRoundedRect(path, width, height, radius) {
    const hw = width * 0.5;
    const hh = height * 0.5;

    path.moveTo(-hw + radius, -hh);
    path.lineTo(hw - radius, -hh);
    path.absarc(hw - radius, -hh + radius, radius, -Math.PI * 0.5, 0, false);
    path.lineTo(hw, hh - radius);
    path.absarc(hw - radius, hh - radius, radius, 0, Math.PI * 0.5, false);
    path.lineTo(-hw + radius, hh);
    path.absarc(-hw + radius, hh - radius, radius, Math.PI * 0.5, Math.PI, false);
    path.lineTo(-hw, -hh + radius);
    path.absarc(-hw + radius, -hh + radius, radius, Math.PI, Math.PI * 1.5, false);
  }

  function createRoundedRectPadGeometry(width, depth, radius) {
    const shape = new THREE.Shape();
    addRoundedRect(shape, width, depth, radius);
    return new THREE.ShapeGeometry(shape);
  }

  class TrackController {
    constructor(scene) {
      this.scene = scene;

      this.pathWidth = 15.3;
      this.pathHeight = 9.7;
      this.pathRadius = 1.7;

      this.centerGroundWidth = 13.45;
      this.centerGroundHeight = 7.85;
      this.pathY = 0.2;
      this.blockLift = 0.55;
      this.railGauge = 0.54;
      this.railHeight = 0.08;
      this.sleeperSpacing = 1.8;

      this.defaultCurve = new RoundedRectTrackCurve(this.pathWidth, this.pathHeight, this.pathRadius, this.pathY);
      this.curve = this.defaultCurve;
      this.usingRailLayout = false;

      this.createMeshes();
    }

    createMeshes() {
      // Rails are rendered by RailDebugEditor.
    }

    getPointAt(t, target = new THREE.Vector3()) {
      return this.curve.getPoint(t, target);
    }

    getTangentAt(t, target = new THREE.Vector3()) {
      return this.curve.getTangent(t, target);
    }

    setRailLayout(layout) {
      const customPath = buildRailPath(layout, this.pathY);
      if (customPath) {
        this.curve = customPath;
        this.usingRailLayout = true;
      } else {
        this.curve = this.defaultCurve;
        this.usingRailLayout = false;
      }
    }
  }

  class BuildManager {
    constructor(scene, options) {
      this.scene = scene;
      this.cellSize = options.cellSize;
      this.baseY = options.baseY;
      this.createMaterial = options.createMaterial;
      this.slots = [];
      this.builtMeshes = [];
      this.shadowPlane = null;
      this.center = new THREE.Vector3(0, this.baseY, 0);
    }

    resolveInventoryKey(type, textureKey) {
      const normalizedTextureKey = normalizeEditorTextureKey(textureKey);
      const typeDef = getBlockDefinition(type);
      const typeShape = typeDef && typeDef.shape ? typeDef.shape : 'cube';
      if (normalizedTextureKey && normalizedTextureKey !== EDITOR_TEXTURE_MODE_AUTO) {
        const matchingDef = BLOCK_LIBRARY.find((blockDef) => (
          blockDef
          && blockDef.id
          && blockDef.inventory !== false
          && (blockDef.shape || 'cube') === typeShape
          && blockDef.textureKey === normalizedTextureKey
        ));
        if (matchingDef && matchingDef.id) {
          return matchingDef.id;
        }
      }
      return type;
    }

    loadFromLevel(data) {
      for (const mesh of this.builtMeshes) {
        this.scene.remove(mesh);
        disposeObject3D(mesh);
      }
      this.builtMeshes = [];
      if (this.shadowPlane) {
        this.scene.remove(this.shadowPlane);
        disposeObject3D(this.shadowPlane);
        this.shadowPlane = null;
      }
      this.slots = [];

      const list = data && Array.isArray(data.blocks) ? data.blocks : [];
      const unique = new Set();
      for (const item of list) {
        const x = Number(item.x);
        const y = Number(item.y);
        const z = Number(item.z);
        const type = item.type || DEFAULT_BLOCK_ID;
        const textureKey = normalizeEditorTextureKey(
          item.textureKey !== undefined ? item.textureKey : item.texture,
        );
        const rotYDeg = normalizeBlockRotationDeg(
          item.rotYDeg !== undefined ? item.rotYDeg
            : (item.rotY !== undefined ? item.rotY : (item.rot !== undefined ? item.rot : item.rotation)),
        );
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          continue;
        }
        // Allow multiple block kinds in the same cell (for example base block + prop).
        // Deduplicate only identical entries.
        const key = `${x}:${y}:${z}:${type}:${textureKey}:${rotYDeg}`;
        if (unique.has(key)) {
          continue;
        }
        unique.add(key);
        this.slots.push({
          type,
          textureKey,
          rotYDeg,
          inventoryKey: this.resolveInventoryKey(type, textureKey),
          position: new THREE.Vector3(
            x * this.cellSize,
            this.baseY + y * this.cellSize,
            z * this.cellSize,
          ),
          state: 'free',
        });
      }

      if (this.slots.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const slot of this.slots) {
          minX = Math.min(minX, slot.position.x);
          maxX = Math.max(maxX, slot.position.x);
          minY = Math.min(minY, slot.position.y);
          maxY = Math.max(maxY, slot.position.y);
          minZ = Math.min(minZ, slot.position.z);
          maxZ = Math.max(maxZ, slot.position.z);
        }
        this.center.set(
          (minX + maxX) * 0.5,
          (minY + maxY) * 0.5,
          (minZ + maxZ) * 0.5,
        );

        const orderedSlots = this.slots
          .map((slot, index) => {
            const dx = slot.position.x - this.center.x;
            const dz = slot.position.z - this.center.z;
            return {
              index,
              y: slot.position.y,
              ring: Math.max(Math.abs(dx), Math.abs(dz)),
              angle: Math.atan2(dz, dx),
              radialSq: (dx * dx) + (dz * dz),
            };
          })
          .sort((a, b) => (
            (a.y - b.y)
            || (a.ring - b.ring)
            || (a.angle - b.angle)
            || (a.radialSq - b.radialSq)
            || (a.index - b.index)
          ));

        for (let rank = 0; rank < orderedSlots.length; rank += 1) {
          this.slots[orderedSlots[rank].index].buildOrder = rank;
        }

        const pad = this.cellSize * 1.1;
        const width = Math.max(this.cellSize, (maxX - minX) + this.cellSize + pad);
        const depth = Math.max(this.cellSize, (maxZ - minZ) + this.cellSize + pad);
        const catcher = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth),
          new THREE.ShadowMaterial({ opacity: 0.36 }),
        );
        catcher.rotation.x = -Math.PI * 0.5;
        catcher.position.set(
          (minX + maxX) * 0.5,
          this.baseY - this.cellSize * 0.5 + 0.01,
          (minZ + maxZ) * 0.5,
        );
        catcher.receiveShadow = true;
        this.scene.add(catcher);
        this.shadowPlane = catcher;
      }
    }

    reserveNext(inventoryKey, origin = null, forward = null, laneLock = null) {
      void forward;
      const hasOrigin = origin && Number.isFinite(origin.x) && Number.isFinite(origin.z);
      const EPS_Y = this.cellSize * 0.01;

      let globalMinFreeY = Infinity;
      for (let i = 0; i < this.slots.length; i += 1) {
        const slot = this.slots[i];
        if (slot.state !== 'free') {
          continue;
        }
        if (slot.position.y < globalMinFreeY) {
          globalMinFreeY = slot.position.y;
        }
      }
      if (!Number.isFinite(globalMinFreeY)) {
        return null;
      }

      const sideX = hasOrigin ? (origin.x - this.center.x) : 0;
      const sideZ = hasOrigin ? (origin.z - this.center.z) : 0;
      const sideLen = Math.hypot(sideX, sideZ);
      const nsx = sideLen > 1e-6 ? sideX / sideLen : 0;
      const nsz = sideLen > 1e-6 ? sideZ / sideLen : 0;

      const inwardX = hasOrigin ? (this.center.x - origin.x) : 0;
      const inwardZ = hasOrigin ? (this.center.z - origin.z) : 0;
      const inwardLen = Math.hypot(inwardX, inwardZ);
      const nix = inwardLen > 1e-6 ? inwardX / inwardLen : 0;
      const niz = inwardLen > 1e-6 ? inwardZ / inwardLen : 0;

      const minSideCos = -0.12;
      // Allow a short grace zone behind the cart so near-missed cells are still filled
      // in the same pass instead of waiting for the next lap.
      const strictMinInwardProjection = -this.cellSize * 0.9;
      const hasLaneLock = Boolean(
        laneLock
          && (laneLock.axis === 'x' || laneLock.axis === 'z')
          && Number.isFinite(laneLock.value),
      );
      const laneTolerance = this.cellSize * 0.34;

      const pickCandidate = (strictOpposite) => {
        let selectedIndex = -1;
        let selectedLateralSq = Infinity;
        let selectedInwardProjection = Infinity;
        let selectedLaneDelta = Infinity;
        let selectedOrder = Infinity;
        let selectedDistanceSq = Infinity;

        for (let i = 0; i < this.slots.length; i += 1) {
          const slot = this.slots[i];
          if (slot.state !== 'free') {
            continue;
          }
          if (slot.inventoryKey !== inventoryKey) {
            continue;
          }
          if (slot.position.y > globalMinFreeY + EPS_Y) {
            continue;
          }

          let laneDelta = 0;
          if (hasLaneLock) {
            const slotLaneValue = laneLock.axis === 'x' ? slot.position.x : slot.position.z;
            laneDelta = Math.abs(slotLaneValue - laneLock.value);
            if (laneDelta > laneTolerance) {
              continue;
            }
          }

          if (hasOrigin && sideLen > 1e-6) {
            const slotSideX = slot.position.x - this.center.x;
            const slotSideZ = slot.position.z - this.center.z;
            const slotSideLen = Math.hypot(slotSideX, slotSideZ);
            if (slotSideLen > this.cellSize * 0.16) {
              const nslotX = slotSideX / slotSideLen;
              const nslotZ = slotSideZ / slotSideLen;
              const sideCos = (nslotX * nsx) + (nslotZ * nsz);
              if (sideCos < minSideCos) {
                continue;
              }
            }
          }

          let inwardProjection = 0;
          let effectiveInwardProjection = 0;
          let lateralSq = 0;
          if (hasOrigin && inwardLen > 1e-6) {
            const toSlotX = slot.position.x - origin.x;
            const toSlotZ = slot.position.z - origin.z;
            inwardProjection = (toSlotX * nix) + (toSlotZ * niz);
            if (strictOpposite && inwardProjection < strictMinInwardProjection) {
              continue;
            }
            effectiveInwardProjection = Math.max(0, inwardProjection);
            const toSlotLenSq = (toSlotX * toSlotX) + (toSlotZ * toSlotZ);
            lateralSq = Math.max(0, toSlotLenSq - (inwardProjection * inwardProjection));
          }

          const dx = hasOrigin ? (slot.position.x - origin.x) : (slot.position.x - this.center.x);
          const dz = hasOrigin ? (slot.position.z - origin.z) : (slot.position.z - this.center.z);
          const distanceSq = (dx * dx) + (dz * dz);
          const order = Number.isFinite(slot.buildOrder) ? slot.buildOrder : Number.MAX_SAFE_INTEGER;

          if (hasLaneLock) {
            if (
              effectiveInwardProjection < selectedInwardProjection - 1e-6
              || (
                Math.abs(effectiveInwardProjection - selectedInwardProjection) <= 1e-6
                && (
                  laneDelta < selectedLaneDelta - 1e-6
                  || (
                    Math.abs(laneDelta - selectedLaneDelta) <= 1e-6
                    && (
                      order < selectedOrder
                      || (
                        order === selectedOrder
                        && distanceSq < selectedDistanceSq - 1e-6
                      )
                    )
                  )
                )
              )
            ) {
              selectedIndex = i;
              selectedLateralSq = lateralSq;
              selectedInwardProjection = effectiveInwardProjection;
              selectedLaneDelta = laneDelta;
              selectedOrder = order;
              selectedDistanceSq = distanceSq;
            }
          } else if (
            lateralSq < selectedLateralSq - 1e-6
            || (
              Math.abs(lateralSq - selectedLateralSq) <= 1e-6
              && (
                effectiveInwardProjection < selectedInwardProjection - 1e-6
                || (
                  Math.abs(effectiveInwardProjection - selectedInwardProjection) <= 1e-6
                  && (
                    order < selectedOrder
                    || (
                      order === selectedOrder
                      && distanceSq < selectedDistanceSq - 1e-6
                    )
                  )
                )
              )
            )
          ) {
            selectedIndex = i;
            selectedLateralSq = lateralSq;
            selectedInwardProjection = effectiveInwardProjection;
            selectedLaneDelta = laneDelta;
            selectedOrder = order;
            selectedDistanceSq = distanceSq;
          }
        }

        return selectedIndex;
      };

      let selectedIndex = pickCandidate(true);
      if (selectedIndex < 0) {
        // If strict opposite window has passed, still finish nearby same-side cells.
        selectedIndex = pickCandidate(false);
      }

      if (selectedIndex >= 0) {
        this.slots[selectedIndex].state = 'reserved';
        return { index: selectedIndex, position: this.slots[selectedIndex].position.clone() };
      }
      return null;
    }

    getCurrentLayerFreeY() {
      let globalMinFreeY = Infinity;
      for (const slot of this.slots) {
        if (slot.state !== 'free') {
          continue;
        }
        if (slot.position.y < globalMinFreeY) {
          globalMinFreeY = slot.position.y;
        }
      }
      return Number.isFinite(globalMinFreeY) ? globalMinFreeY : null;
    }

    getCurrentLayerFreeSlotsOrdered() {
      const minY = this.getCurrentLayerFreeY();
      if (!Number.isFinite(minY)) {
        return [];
      }
      const EPS_Y = this.cellSize * 0.01;
      return this.slots
        .filter((slot) => slot.state === 'free' && slot.position.y <= minY + EPS_Y)
        .slice()
        .sort((a, b) => {
          const aOrder = Number.isFinite(a.buildOrder) ? a.buildOrder : Number.MAX_SAFE_INTEGER;
          const bOrder = Number.isFinite(b.buildOrder) ? b.buildOrder : Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder;
        });
    }

    getNextRequiredInventoryKey() {
      const slot = this.getNextRequiredSlot();
      if (!slot) {
        return null;
      }
      return slot.inventoryKey || null;
    }

    getNextRequiredSlot() {
      const orderedLayerSlots = this.getCurrentLayerFreeSlotsOrdered();
      if (orderedLayerSlots.length === 0) {
        return null;
      }
      return orderedLayerSlots[0];
    }

    hasFreeSlotForType(inventoryKey) {
      return this.slots.some((slot) => slot.state === 'free' && slot.inventoryKey === inventoryKey);
    }

    getFreeSlotCountForType(inventoryKey) {
      let count = 0;
      for (const slot of this.slots) {
        if (slot.state === 'free' && slot.inventoryKey === inventoryKey) {
          count += 1;
        }
      }
      return count;
    }

    hasPlaceableSlotForType(inventoryKey) {
      const orderedLayerSlots = this.getCurrentLayerFreeSlotsOrdered();
      for (const slot of orderedLayerSlots) {
        if (slot && slot.inventoryKey === inventoryKey) {
          return true;
        }
      }
      return false;
    }

    commit(index) {
      const slot = this.slots[index];
      if (!slot) {
        return false;
      }
      // Keep placement resilient to race/order glitches when projectile reaches target.
      if (slot.state === 'built') {
        return true;
      }
      if (slot.state !== 'reserved' && slot.state !== 'free') {
        return false;
      }

      slot.state = 'built';

      const mesh = createBlockMesh(
        slot.type,
        this.cellSize,
        this.createMaterial(slot.type, 0xffffff, { textureKey: slot.textureKey }),
        'placed',
      );
      setPlacedBlockWorldPosition(mesh, slot.type, this.cellSize, slot.position);
      mesh.rotation.y = (slot.rotYDeg || 0) * (Math.PI / 180);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.builtMeshes.push(mesh);

      return true;
    }

    getBuiltCount() {
      return this.slots.reduce((count, slot) => count + (slot.state === 'built' ? 1 : 0), 0);
    }

    getTotalCount() {
      return this.slots.length;
    }

    getSlotTypeCounts() {
      const counts = {};
      for (const item of this.getCurrentLayerQueue()) {
        counts[item.id] = item.count;
      }
      return counts;
    }

    getSlotInventoryStats() {
      const stats = {};
      for (const item of this.getCurrentLayerQueue()) {
        stats[item.id] = {
          count: item.count,
          type: item.type,
          textureKey: item.textureKey,
        };
      }
      return stats;
    }

    getCurrentLayerQueue() {
      const queue = [];
      const byInventoryKey = new Map();
      for (const slot of this.getCurrentLayerFreeSlotsOrdered()) {
        if (!slot || !slot.inventoryKey) {
          continue;
        }
        let entry = byInventoryKey.get(slot.inventoryKey);
        if (!entry) {
          entry = {
            id: slot.inventoryKey,
            count: 0,
            type: slot.type,
            textureKey: slot.textureKey,
          };
          byInventoryKey.set(slot.inventoryKey, entry);
          queue.push(entry);
        }
        entry.count += 1;
        if (
          entry.textureKey === EDITOR_TEXTURE_MODE_AUTO
          && slot.textureKey
          && slot.textureKey !== EDITOR_TEXTURE_MODE_AUTO
        ) {
          entry.textureKey = slot.textureKey;
          entry.type = slot.type;
        }
      }
      return queue;
    }

    setVisible(visible) {
      const isVisible = Boolean(visible);
      for (const mesh of this.builtMeshes) {
        mesh.visible = isVisible;
      }
      if (this.shadowPlane) {
        this.shadowPlane.visible = isVisible;
      }
    }
  }

  class RailDebugEditor {
    constructor(options) {
      this.scene = options.scene;
      this.camera = options.camera;
      this.canvas = options.canvas;
      this.baseY = options.baseY;
      this.onChange = options.onChange || null;

      this.enabled = false;
      this.selectedType = 'straight';
      this.selectedYaw = 0;
      this.cells = new Map();
      this.suspendChangeEvents = 0;
      this.group = new THREE.Group();
      this.scene.add(this.group);

      this.raycaster = new THREE.Raycaster();
      this.mouseNdc = new THREE.Vector2();
      this.railGeometry = new THREE.PlaneGeometry(1, 1);
      this.railGeometry.rotateX(-Math.PI * 0.5);
      this.materials = {
        straight: createRailTileMaterial(RAIL_TEXTURES.straight),
        corner: createRailTileMaterial(RAIL_TEXTURES.corner),
      };
    }

    notifyChange() {
      if (this.suspendChangeEvents > 0) {
        return;
      }
      if (this.onChange) this.onChange();
    }

    setEnabled(value) {
      this.enabled = value;
    }

    isEnabled() {
      return this.enabled;
    }

    setType(type) {
      this.selectedType = type === 'corner' ? 'corner' : 'straight';
    }

    setRotationDeg(deg) {
      this.selectedYaw = ((Number(deg) || 0) * Math.PI) / 180;
    }

    getCellKey(x, z) {
      return `${x}:${z}`;
    }

    eventToCell(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouseNdc, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.baseY);
      const point = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(plane, point);
      if (!hit) {
        return null;
      }
      return {
        x: Math.round(point.x),
        z: Math.round(point.z),
      };
    }

    placeAtEvent(event) {
      if (!this.enabled) return;
      const cell = this.eventToCell(event);
      if (!cell) return;
      this.placeRail(this.selectedType, cell.x, cell.z, this.selectedYaw);
    }

    removeAtEvent(event) {
      if (!this.enabled) return;
      const cell = this.eventToCell(event);
      if (!cell) return;
      const key = this.getCellKey(cell.x, cell.z);
      const existing = this.cells.get(key);
      if (!existing) return;
      this.group.remove(existing.mesh);
      this.cells.delete(key);
      this.notifyChange();
    }

    clear() {
      for (const item of this.cells.values()) {
        this.group.remove(item.mesh);
      }
      this.cells.clear();
      this.notifyChange();
    }

    placeRail(type, x, z, yaw) {
      const key = this.getCellKey(x, z);
      const existing = this.cells.get(key);
      if (existing) {
        this.group.remove(existing.mesh);
      }

      const safeType = type === 'corner' ? 'corner' : 'straight';
      const safeYaw = Number.isFinite(yaw) ? yaw : 0;
      const mesh = new THREE.Mesh(
        this.railGeometry,
        safeType === 'corner' ? this.materials.corner : this.materials.straight,
      );
      mesh.position.set(x, this.baseY + 0.01, z);
      mesh.rotation.y = safeYaw;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      this.group.add(mesh);
      this.cells.set(key, { mesh, type: safeType, x, z, yaw: safeYaw });
      this.notifyChange();
    }

    exportData() {
      return Array.from(this.cells.values())
        .map(({ type, x, z, yaw }) => ({ type, x, z, yaw }))
        .sort((a, b) => (a.z - b.z) || (a.x - b.x));
    }

    loadData(data) {
      this.suspendChangeEvents += 1;
      try {
        this.clear();
        const list = Array.isArray(data) ? data : [];
        for (const item of list) {
          const x = Number(item.x);
          const z = Number(item.z);
          const yaw = Number(item.yaw);
          if (!Number.isFinite(x) || !Number.isFinite(z)) {
            continue;
          }
          this.placeRail(item.type, Math.round(x), Math.round(z), Number.isFinite(yaw) ? yaw : 0);
        }
      } finally {
        this.suspendChangeEvents = Math.max(0, this.suspendChangeEvents - 1);
      }
      this.notifyChange();
    }
  }

  class WorldInventoryController {
    constructor(scene, camera, slotConfigs) {
      this.scene = scene;
      this.camera = camera;
      this.group = new THREE.Group();
      this.slots = new Map();
      this.interactiveMeshes = [];
      this.pointerRaycaster = new THREE.Raycaster();
      this.pointerNdc = new THREE.Vector2();
      this.layoutSpacing = 2.55;
      this.layoutBaseZ = -9.8;
      this.slotPadGeometry = createRoundedRectPadGeometry(2.12, 2.12, 0.36);
      this.slotPadMaterial = new THREE.MeshStandardMaterial({
        color: 0x0f0f12,
        roughness: 0.95,
        metalness: 0.03,
        transparent: true,
        opacity: 0.88,
      });

      const layout = slotConfigs.filter((config) => !config.empty);
      const startX = -((layout.length - 1) * this.layoutSpacing) * 0.5;

      for (let i = 0; i < layout.length; i += 1) {
        const config = layout[i];
        const slotX = startX + i * this.layoutSpacing;

        const clickPad = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 1, 1.8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        clickPad.position.set(slotX, 0.5, this.layoutBaseZ);
        clickPad.userData.blockId = config.id;
        this.group.add(clickPad);

        const visualPad = new THREE.Mesh(this.slotPadGeometry, this.slotPadMaterial.clone());
        visualPad.rotation.x = -Math.PI * 0.5;
        visualPad.position.set(slotX, 0.02, this.layoutBaseZ);
        visualPad.receiveShadow = true;
        this.group.add(visualPad);

        this.interactiveMeshes.push(clickPad);
        this.slots.set(config.id, {
          id: config.id,
          clickPad,
          visualPad,
          anchor: new THREE.Vector3(slotX, 1.02, this.layoutBaseZ),
          disabled: false,
          locked: false,
          visible: true,
        });
      }

      this.scene.add(this.group);
    }

    getGroupPosition(target = new THREE.Vector3()) {
      return target.copy(this.group.position);
    }

    setGroupPosition(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return;
      }
      this.group.position.set(x, 0, z);
    }

    setGroupYawDeg(deg) {
      const safeDeg = Number.isFinite(Number(deg)) ? Number(deg) : 0;
      this.group.rotation.y = (safeDeg * Math.PI) / 180;
    }

    setVisibleSlots(ids) {
      const visibleSet = new Set(Array.isArray(ids) ? ids : []);
      const ordered = [];
      for (const slot of this.slots.values()) {
        if (visibleSet.has(slot.id)) {
          ordered.push(slot);
        }
      }
      if (ordered.length === 0) {
        for (const slot of this.slots.values()) {
          ordered.push(slot);
        }
      }
      const startX = -((ordered.length - 1) * this.layoutSpacing) * 0.5;
      for (let i = 0; i < ordered.length; i += 1) {
        const slot = ordered[i];
        const slotX = startX + i * this.layoutSpacing;
        slot.anchor.set(slotX, 1.02, this.layoutBaseZ);
        slot.clickPad.position.set(slotX, 0.5, this.layoutBaseZ);
        if (slot.visualPad) {
          slot.visualPad.position.set(slotX, 0.02, this.layoutBaseZ);
        }
        slot.visible = true;
        slot.clickPad.visible = true;
        if (slot.visualPad) {
          slot.visualPad.visible = true;
        }
      }
      for (const slot of this.slots.values()) {
        if (ordered.includes(slot)) {
          continue;
        }
        slot.visible = false;
        slot.clickPad.visible = false;
        if (slot.visualPad) {
          slot.visualPad.visible = false;
        }
      }
      for (const slot of this.slots.values()) {
        this.applySlotState(slot);
      }
    }

    setQueueLayout(layoutItems) {
      const layoutMap = new Map();
      const list = Array.isArray(layoutItems) ? layoutItems : [];
      for (const item of list) {
        if (!item || !item.id || !Number.isFinite(item.x) || !Number.isFinite(item.z)) {
          continue;
        }
        layoutMap.set(item.id, {
          x: item.x,
          z: item.z,
          visible: item.visible !== false,
        });
      }

      for (const slot of this.slots.values()) {
        const layout = layoutMap.get(slot.id);
        if (!layout) {
          slot.visible = false;
          slot.clickPad.visible = false;
          continue;
        }
        slot.anchor.set(layout.x, 1.02, layout.z);
        slot.clickPad.position.set(layout.x, 0.5, layout.z);
        if (slot.visualPad) {
          slot.visualPad.position.set(layout.x, 0.02, layout.z);
        }
        slot.visible = layout.visible;
        slot.clickPad.visible = layout.visible;
        if (slot.visualPad) {
          slot.visualPad.visible = layout.visible;
        }
      }

      for (const slot of this.slots.values()) {
        this.applySlotState(slot);
      }
    }

    getSlotAnchor(id) {
      const slot = this.slots.get(id);
      if (!slot) {
        return null;
      }
      return this.group.localToWorld(slot.anchor.clone());
    }

    registerCarrierMesh(id, mesh) {
      if (!mesh) {
        return;
      }
      mesh.userData.blockId = id;
      this.interactiveMeshes.push(mesh);
    }

    replaceCarrierMesh(id, oldMesh, newMesh) {
      if (!newMesh) {
        return;
      }
      newMesh.userData.blockId = id;
      if (oldMesh) {
        const idx = this.interactiveMeshes.indexOf(oldMesh);
        if (idx >= 0) {
          this.interactiveMeshes[idx] = newMesh;
          return;
        }
      }
      this.interactiveMeshes.push(newMesh);
    }

    setCount(_id, _value) {
      // Count is rendered directly on the floating cube sprite.
    }

    setDisabled(id, disabled) {
      const slot = this.slots.get(id);
      if (!slot) {
        return;
      }
      slot.disabled = disabled;
      this.applySlotState(slot);
    }

    setCycleLock(activeId) {
      for (const slot of this.slots.values()) {
        slot.locked = activeId !== null && activeId !== slot.id;
        this.applySlotState(slot);
      }
    }

    applySlotState(slot) {
      const blocked = slot.disabled || slot.locked || !slot.visible;
      slot.clickPad.userData.blocked = blocked;
      if (slot.visualPad && slot.visualPad.material) {
        const material = slot.visualPad.material;
        material.opacity = blocked ? 0.56 : 0.9;
        material.color.setHex(blocked ? 0x0a0a0d : 0x111116);
      }
    }

    pickInventoryHit(clientX, clientY, camera, canvas) {
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.pointerRaycaster.setFromCamera(this.pointerNdc, camera);
      const hits = this.pointerRaycaster.intersectObjects(this.interactiveMeshes, false);
      return hits.length > 0 ? hits[0] : null;
    }

    pickBlockId(clientX, clientY, camera, canvas) {
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.pointerRaycaster.setFromCamera(this.pointerNdc, camera);
      const hits = this.pointerRaycaster.intersectObjects(this.interactiveMeshes, false);
      for (const hit of hits) {
        let obj = hit.object;
        while (obj) {
          if (obj.userData && obj.userData.blockId) {
            const id = obj.userData.blockId;
            const slot = this.slots.get(id);
            if (
              slot
              && slot.visible
              && slot.clickPad
              && slot.clickPad.visible
              && !slot.clickPad.userData.blocked
            ) {
              return id;
            }
            break;
          }
          obj = obj.parent;
        }
      }
      return null;
    }
  }

  function drawCountTexture(canvas, texture, count, disabled) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = disabled ? 'rgba(30,30,30,0.72)' : 'rgba(20,20,20,0.72)';
    const r = 24;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 134px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), w * 0.5, h * 0.55);

    texture.needsUpdate = true;
  }

  function createBlockMaterial(type, color, options = null) {
    const blockDef = getBlockDefinition(type);
    const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';
    const textureKey = normalizeEditorTextureKey(options && options.textureKey);
    const isWater = type === 'water';
    const map = isWater
      ? WATER_FLOW_TEXTURE
      : (textureKey !== EDITOR_TEXTURE_MODE_AUTO
      ? (BLOCK_TEXTURES_BY_KEY[textureKey] || BLOCK_TEXTURES[type] || null)
      : (BLOCK_TEXTURES[type] || null));
    const isDoor = shape === 'door';
    const baseColor = Number.isFinite(blockDef && blockDef.color) ? blockDef.color : color;
    const roughness = shape === 'pillar' || type === 'wood' ? 0.9 : 0.78;
    const metalness = type === 'stone' || type === 'stone_slab' ? 0.12 : 0.04;
    return new THREE.MeshStandardMaterial({
      map,
      color: isWater ? 0x74a7ff : (map ? 0xffffff : baseColor),
      roughness: isWater ? 0.28 : roughness,
      metalness: isWater ? 0.01 : metalness,
      transparent: isWater,
      opacity: isWater ? 0.72 : 1,
      alphaTest: 0,
      side: isDoor ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: isWater ? true : !isWater,
    });
  }

  class BlockController {
    constructor(options) {
      this.scene = options.scene;
      this.minecart = options.minecartController;
      this.buildManager = options.buildManager;

      this.id = options.id;
      this.type = options.type;
      this.textureKey = normalizeEditorTextureKey(options.textureKey);
      this.color = options.color;
      this.count = options.count;
      this.onReplaceMesh = typeof options.onReplaceMesh === 'function' ? options.onReplaceMesh : null;

      this.onCountChange = options.onCountChange;
      this.onCycleFinish = options.onCycleFinish;

      this.state = 'idle';
      this.phaseTime = 0;
      this.spawnTimer = 0;
      this.stickyLane = null;
      this.idleTime = Math.random() * Math.PI * 2;
      this.idleSeed = Math.random() * Math.PI * 2;
      this.idleRotationY = Math.random() * Math.PI * 2;
      this.idleYawOffsetRad = 0;

      this.launchDuration = 0.62;
      this.dispatchDuration = 8.1;
      this.currentDispatchDuration = this.dispatchDuration;
      this.returnDuration = 0.68;
      // Base cadence is tuned for speed ~= 10 and then auto-scales with cart speed.
      this.spawnInterval = 0.2;
      this.minSpawnInterval = 0.04;
      this.maxSpawnInterval = 0.34;
      this.activeSpawnInterval = this.spawnInterval;

      this.uiAnchor = new THREE.Vector3();
      this.launchFrom = new THREE.Vector3();
      this.returnFrom = new THREE.Vector3();

      this.projectiles = [];
      this.impactBursts = [];
      this.unavailableFlashDuration = 1;
      this.unavailableFlashTime = 0;
      this.unavailableFlashPhase = Math.random() * Math.PI * 2;
      this.unavailableTintBindings = [];

      this.mesh = this.createCarrierMesh();
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.refreshUnavailableTintBindings();

      this.countCanvas = document.createElement('canvas');
      this.countCanvas.width = 256;
      this.countCanvas.height = 256;
      this.countTexture = new THREE.CanvasTexture(this.countCanvas);

      this.countSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.countTexture, transparent: true, depthWrite: false }),
      );
      this.countSprite.scale.set(0.64, 0.64, 1);
      this.countSprite.position.set(0, 0.62, 0.54);
      this.mesh.add(this.countSprite);

      this.updateCountVisual();
      this.mesh.visible = this.count > 0;
      this.scene.add(this.mesh);
    }

    createCarrierMesh() {
      const mesh = createBlockMesh(
        this.type,
        1,
        createBlockMaterial(this.type, this.color, { textureKey: this.textureKey }),
        'carrier',
      );
      if (this.type !== 'door') {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(CARRIER_GEOMETRY),
          new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.42 }),
        );
        mesh.add(edges);
      }
      return mesh;
    }

    rebuildMeshes() {
      const oldMesh = this.mesh;
      const nextMesh = this.createCarrierMesh();
      nextMesh.castShadow = true;
      nextMesh.receiveShadow = true;
      nextMesh.position.copy(oldMesh.position);
      nextMesh.rotation.copy(oldMesh.rotation);
      nextMesh.visible = oldMesh.visible;
      nextMesh.add(this.countSprite);
      this.mesh = nextMesh;
      this.scene.add(nextMesh);
      this.scene.remove(oldMesh);
      this.refreshUnavailableTintBindings();
      if (this.onReplaceMesh) {
        this.onReplaceMesh(oldMesh, nextMesh);
      }
      disposeObject3D(oldMesh);

      for (const projectile of this.projectiles) {
        if (!projectile || !projectile.mesh) {
          continue;
        }
        const oldProjectileMesh = projectile.mesh;
        const nextProjectileMesh = createBlockMesh(
          this.type,
          0.32,
          createBlockMaterial(this.type, this.color, { textureKey: this.textureKey }),
          'piece',
        );
        nextProjectileMesh.castShadow = true;
        nextProjectileMesh.receiveShadow = true;
        nextProjectileMesh.position.copy(oldProjectileMesh.position);
        nextProjectileMesh.rotation.copy(oldProjectileMesh.rotation);
        nextProjectileMesh.scale.copy(oldProjectileMesh.scale);
        nextProjectileMesh.visible = oldProjectileMesh.visible;
        projectile.mesh = nextProjectileMesh;
        this.scene.add(nextProjectileMesh);
        this.scene.remove(oldProjectileMesh);
        disposeObject3D(oldProjectileMesh);
      }
    }

    setAppearance(type, textureKey) {
      const nextType = type || this.type;
      const nextTextureKey = normalizeEditorTextureKey(textureKey);
      const sameType = nextType === this.type;
      const sameTexture = nextTextureKey === this.textureKey;
      if (sameType && sameTexture) {
        return;
      }
      this.type = nextType;
      this.textureKey = nextTextureKey;
      this.rebuildMeshes();
    }

    setUiAnchor(position) {
      this.uiAnchor.copy(position);
      this.mesh.position.copy(this.uiAnchor);
      this.mesh.position.y += 0.52;
    }

    setIdleYawOffsetDeg(deg) {
      const normalized = Number.isFinite(Number(deg)) ? Number(deg) : 0;
      this.idleYawOffsetRad = (normalized * Math.PI) / 180;
      if (this.state === 'idle') {
        this.mesh.rotation.y = this.idleRotationY + this.idleYawOffsetRad;
      }
    }

    canStartCycle() {
      return this.state === 'idle'
        && this.count > 0
        && !this.minecart.isMoving()
        && this.buildManager.hasPlaceableSlotForType(this.id);
    }

    shouldShowUnavailableFeedback() {
      return this.state === 'idle'
        && this.count > 0
        && !this.minecart.isMoving()
        && !this.buildManager.hasPlaceableSlotForType(this.id);
    }

    triggerUnavailableFeedback() {
      if (!this.shouldShowUnavailableFeedback()) {
        return false;
      }
      this.unavailableFlashTime = this.unavailableFlashDuration;
      return true;
    }

    getCount() {
      return this.count;
    }

    setCount(count) {
      const next = Math.max(0, Math.floor(Number(count) || 0));
      this.count = next;
      this.mesh.visible = next > 0;
      if (next > 0 && this.state === 'depleted') {
        this.state = 'idle';
        this.mesh.position.copy(this.uiAnchor);
        this.mesh.position.y += 0.52;
        this.mesh.rotation.set(0, this.idleRotationY + this.idleYawOffsetRad, 0);
      }
      this.updateCountVisual();
    }

    startCycle() {
      if (!this.canStartCycle()) {
        return false;
      }

      this.unavailableFlashTime = 0;
      this.applyUnavailableTint(0);
      this.state = 'launching';
      this.phaseTime = 0;
      this.spawnTimer = 0;
      this.activeSpawnInterval = this.spawnInterval;
      this.stickyLane = null;

      this.launchFrom.copy(this.mesh.position);

      return true;
    }

    getSideKeyAtPosition(position) {
      if (!position || !this.buildManager || !this.buildManager.center) {
        return null;
      }
      const dx = position.x - this.buildManager.center.x;
      const dz = position.z - this.buildManager.center.z;
      if (Math.abs(dx) >= Math.abs(dz)) {
        return dx >= 0 ? 'x+' : 'x-';
      }
      return dz >= 0 ? 'z+' : 'z-';
    }

    createLaneLock(sideKey, targetPosition) {
      if (!sideKey || !targetPosition) {
        return null;
      }
      if (sideKey === 'x+' || sideKey === 'x-') {
        return { sideKey, axis: 'z', value: targetPosition.z };
      }
      return { sideKey, axis: 'x', value: targetPosition.x };
    }

    computeCycleSpawnInterval(dispatchDuration) {
      const duration = Number.isFinite(dispatchDuration) ? dispatchDuration : this.dispatchDuration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return this.spawnInterval;
      }
      const speed = Math.max(0.001, this.minecart.getSpeed());
      // Keep near-opposite coverage dense enough at high speeds.
      const travelPerShot = this.buildManager.cellSize * 1.25;
      const speedInterval = travelPerShot / speed;
      return THREE.MathUtils.clamp(speedInterval, this.minSpawnInterval, this.maxSpawnInterval);
    }

    update(dt) {
      this.updateUnavailableFeedback(dt);
      this.updateProjectiles(dt);
      this.updateImpactBursts(dt);

      if (this.state === 'launching') {
        this.updateLaunching(dt);
        return;
      }

      if (this.state === 'dispatching') {
        this.updateDispatching(dt);
        return;
      }

      if (this.state === 'returning') {
        this.updateReturning(dt);
        return;
      }

      if (this.state === 'idle' && this.count > 0) {
        this.updateIdle(dt);
      }
    }

    updateLaunching(dt) {
      this.phaseTime += dt;
      const progress = Math.min(1, this.phaseTime / this.launchDuration);
      const eased = easeOutCubic(progress);
      const launchTo = this.minecart.getCargoAnchor(TEMP_A);

      this.mesh.position.lerpVectors(this.launchFrom, launchTo, eased);
      this.mesh.position.y += Math.sin(Math.PI * eased) * 1.35;

      if (progress >= 1) {
        this.currentDispatchDuration = this.minecart.startSingleLap();
        this.activeSpawnInterval = this.computeCycleSpawnInterval(this.currentDispatchDuration);
        this.state = 'dispatching';
        this.phaseTime = 0;
        this.spawnTimer = 0;
      }
    }

    updateDispatching(dt) {
      this.phaseTime += dt;

      const cargoPos = this.minecart.getCargoAnchor(TEMP_A);
      const cargoForward = this.minecart.getForward(TEMP_B);
      this.mesh.position.copy(cargoPos);
      this.mesh.rotation.set(0, 0, 0);

      if (this.count > 0 && this.buildManager.hasPlaceableSlotForType(this.id)) {
        const interval = Math.max(this.minSpawnInterval, this.activeSpawnInterval || this.spawnInterval);
        this.spawnTimer += dt;
        if (this.spawnTimer >= interval) {
          this.spawnTimer -= interval;
          const spawnResult = this.spawnPiece(cargoPos, cargoForward);
          if (spawnResult === 'finished' || spawnResult === 'depleted') {
            this.spawnTimer = 0;
          } else if (spawnResult === 'waiting-side') {
            this.spawnTimer = Math.min(this.spawnTimer, interval * 0.5);
          }
        }
      }

      if (this.phaseTime >= this.currentDispatchDuration || !this.minecart.isMoving()) {
        const hasMoreWork = this.count > 0 && this.buildManager.hasPlaceableSlotForType(this.id);
        if (hasMoreWork) {
          this.currentDispatchDuration = this.minecart.startSingleLap();
          this.activeSpawnInterval = this.computeCycleSpawnInterval(this.currentDispatchDuration);
          this.phaseTime = 0;
          this.spawnTimer = 0;
          return;
        }

        this.state = 'returning';
        this.phaseTime = 0;
        this.returnFrom.copy(this.mesh.position);
      }
    }

    updateReturning(dt) {
      this.phaseTime += dt;
      const progress = Math.min(1, this.phaseTime / this.returnDuration);
      const eased = easeInOutCubic(progress);

      this.mesh.position.lerpVectors(this.returnFrom, this.uiAnchor, eased);
      this.mesh.position.y += Math.sin(Math.PI * eased) * 1.1;

      if (progress >= 1) {
        this.mesh.rotation.set(0, 0, 0);
        if (this.count <= 0) {
          this.state = 'depleted';
          this.mesh.visible = false;
        } else {
          this.state = 'idle';
          this.mesh.position.copy(this.uiAnchor);
          this.mesh.position.y += 0.52;
        }

        if (this.onCycleFinish) {
          this.onCycleFinish(this.id);
        }
      }
    }

    updateIdle(dt) {
      this.idleTime += dt;
      this.idleRotationY += dt * 0.82;
      const bob = 0.5 + Math.sin(this.idleTime * 2.1 + this.idleSeed) * 0.1;
      this.mesh.position.copy(this.uiAnchor);
      this.mesh.position.y += bob;
      if (this.unavailableFlashTime > 0) {
        const progress = Math.max(0, Math.min(1, this.unavailableFlashTime / this.unavailableFlashDuration));
        const shakeAmp = 0.11 * progress;
        const shakeX = Math.sin((this.idleTime * 48) + this.unavailableFlashPhase) * shakeAmp;
        const shakeZ = Math.cos((this.idleTime * 44) + this.unavailableFlashPhase * 0.7) * shakeAmp;
        this.mesh.position.x += shakeX;
        this.mesh.position.z += shakeZ;
      }
      this.mesh.rotation.y = this.idleRotationY + this.idleYawOffsetRad;
      this.mesh.rotation.x = Math.sin(this.idleTime * 1.25 + this.idleSeed) * 0.05;
    }

    updateUnavailableFeedback(dt) {
      if (this.unavailableFlashTime <= 0) {
        this.applyUnavailableTint(0);
        return;
      }
      this.unavailableFlashTime = Math.max(0, this.unavailableFlashTime - dt);
      const progress = Math.max(0, Math.min(1, this.unavailableFlashTime / this.unavailableFlashDuration));
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin((1 - progress) * Math.PI * 8));
      this.applyUnavailableTint(progress * pulse);
    }

    refreshUnavailableTintBindings() {
      this.unavailableTintBindings = [];
      this.mesh.traverse((node) => {
        if (!node || !node.material) {
          return;
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (!material || !material.emissive || typeof material.emissive.clone !== 'function') {
            continue;
          }
          this.unavailableTintBindings.push({
            material,
            baseEmissive: material.emissive.clone(),
            baseEmissiveIntensity: Number.isFinite(material.emissiveIntensity) ? material.emissiveIntensity : 1,
          });
        }
      });
    }

    applyUnavailableTint(strength) {
      if (!this.unavailableTintBindings || this.unavailableTintBindings.length === 0) {
        return;
      }
      const s = Math.max(0, Math.min(1, strength));
      for (const entry of this.unavailableTintBindings) {
        const material = entry.material;
        material.emissive.copy(entry.baseEmissive).lerp(UNAVAILABLE_FLASH_COLOR, s * 0.92);
        if (Number.isFinite(entry.baseEmissiveIntensity)) {
          material.emissiveIntensity = entry.baseEmissiveIntensity + s * 0.7;
        }
      }
    }

    spawnPiece(origin, forward) {
      if (this.count <= 0) {
        return 'depleted';
      }

      if (!this.buildManager.hasPlaceableSlotForType(this.id)) {
        return 'finished';
      }

      const spawnOrigin = origin || this.mesh.position;
      const sideKey = this.getSideKeyAtPosition(spawnOrigin);
      if (this.stickyLane && sideKey && this.stickyLane.sideKey !== sideKey) {
        this.stickyLane = null;
      }

      let reserved = this.buildManager.reserveNext(
        this.id,
        spawnOrigin,
        forward || null,
        this.stickyLane,
      );
      if (!reserved && this.stickyLane) {
        // Current lane is done or unavailable; unlock and pick a new lane.
        this.stickyLane = null;
        reserved = this.buildManager.reserveNext(
          this.id,
          spawnOrigin,
          forward || null,
          null,
        );
      }
      if (!reserved) {
        return 'waiting-side';
      }
      if (!this.stickyLane) {
        this.stickyLane = this.createLaneLock(sideKey, reserved.position);
      }

      this.count -= 1;
      this.updateCountVisual();
      if (this.onCountChange) {
        this.onCountChange(this.id, this.count);
      }

      const piece = createBlockMesh(
        this.type,
        0.32,
        createBlockMaterial(this.type, this.color, { textureKey: this.textureKey }),
        'piece',
      );
      piece.castShadow = true;
      piece.receiveShadow = true;
      const from = (origin || this.mesh.position).clone();
      piece.position.copy(from);
      piece.scale.set(1.24, 0.72, 1.24);
      this.scene.add(piece);

      const distance = from.distanceTo(reserved.position);
      const important = this.isImportantBlockType();
      const trail = this.createProjectileTrail(from, important);

      this.projectiles.push({
        mesh: piece,
        from,
        to: reserved.position,
        index: reserved.index,
        progress: 0,
        duration: Math.min(0.24, 0.09 + distance * 0.015),
        arcHeight: 0,
        important,
        trail,
        targetScale: this.getProjectileTargetScale(),
      });

      return 'spawned';
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
        const projectile = this.projectiles[i];
        projectile.progress += dt / projectile.duration;

        if (projectile.progress >= 1) {
          this.spawnImpactBurst(projectile.to, projectile.important);
          this.disposeProjectileTrail(projectile);
          this.scene.remove(projectile.mesh);
          disposeObject3D(projectile.mesh);
          this.buildManager.commit(projectile.index);
          this.projectiles.splice(i, 1);
          continue;
        }

        const t = Math.min(1, Math.max(0, projectile.progress));
        const eased = t;
        projectile.mesh.position.lerpVectors(projectile.from, projectile.to, eased);
        const growth = Math.min(1, Math.pow(t * 1.08, 0.68));
        const baseScale = lerp(1, projectile.targetScale, growth);
        const squashIntro = t < 0.12 ? (1 - (t / 0.12)) : 0;
        const settleKick = t > 0.84
          ? Math.sin(((t - 0.84) / 0.16) * Math.PI) * (projectile.important ? 0.22 : 0.14)
          : 0;
        const sxz = baseScale * (1 + squashIntro * 0.2 + settleKick);
        const sy = baseScale * (1 - squashIntro * 0.24 - settleKick * 0.34);
        projectile.mesh.scale.set(sxz, Math.max(0.18, sy), sxz);

        this.updateProjectileTrail(projectile);
      }
    }

    isImportantBlockType() {
      const blockDef = getBlockDefinition(this.type);
      const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';
      return shape === 'door'
        || shape === 'pillar'
        || this.type === 'lantern'
        || getEditorGroup(blockDef) === EDITOR_GROUP_PROPS;
    }

    getProjectileTargetScale() {
      const blockDef = getBlockDefinition(this.type);
      const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';
      if (shape === 'slab') {
        return 2.35;
      }
      if (shape === 'door') {
        return 3.65;
      }
      if (shape === 'pillar' || shape === 'stairs' || shape === 'water') {
        return 4.05;
      }
      return 3.12;
    }

    createProjectileTrail(startPosition, important) {
      const points = [];
      const pointCount = important ? 9 : 7;
      for (let i = 0; i < pointCount; i += 1) {
        points.push(startPosition.clone());
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: important ? 0xffcf74 : 0xa9d9ff,
        transparent: true,
        opacity: important ? 0.96 : 0.72,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);

      return { line, geometry, material, points };
    }

    updateProjectileTrail(projectile) {
      const trail = projectile && projectile.trail;
      if (!trail) {
        return;
      }

      const points = trail.points;
      for (let i = 0; i < points.length - 1; i += 1) {
        points[i].copy(points[i + 1]);
      }
      points[points.length - 1].copy(projectile.mesh.position);
      trail.geometry.setFromPoints(points);
      trail.material.opacity = (1 - projectile.progress) * (projectile.important ? 0.96 : 0.72);
    }

    disposeProjectileTrail(projectile) {
      const trail = projectile && projectile.trail;
      if (!trail) {
        return;
      }
      this.scene.remove(trail.line);
      trail.geometry.dispose();
      trail.material.dispose();
      projectile.trail = null;
    }

    spawnImpactBurst(position, important) {
      const material = new THREE.MeshBasicMaterial({
        color: important ? 0xffb347 : 0xffffff,
        transparent: true,
        opacity: important ? 0.95 : 0.78,
        depthWrite: false,
      });
      const burst = new THREE.Mesh(IMPACT_BURST_GEOMETRY, material);
      burst.position.copy(position);
      burst.scale.setScalar(0.14);
      this.scene.add(burst);

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: important ? 0xffcf74 : 0xb9ecff,
        transparent: true,
        opacity: important ? 0.82 : 0.62,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(IMPACT_RING_GEOMETRY, ringMaterial);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.copy(position);
      ring.position.y += 0.02;
      ring.scale.setScalar(0.22);
      this.scene.add(ring);

      this.impactBursts.push({
        mesh: burst,
        material,
        ring,
        ringMaterial,
        life: 0,
        duration: important ? 0.34 : 0.26,
        maxScale: important ? 0.86 : 0.62,
      });
    }

    updateImpactBursts(dt) {
      for (let i = this.impactBursts.length - 1; i >= 0; i -= 1) {
        const burst = this.impactBursts[i];
        burst.life += dt;
        const t = burst.life / burst.duration;

        if (t >= 1) {
          this.scene.remove(burst.mesh);
          burst.material.dispose();
          if (burst.ring) {
            this.scene.remove(burst.ring);
          }
          if (burst.ringMaterial) {
            burst.ringMaterial.dispose();
          }
          this.impactBursts.splice(i, 1);
          continue;
        }

        const eased = easeOutCubic(Math.max(0, Math.min(1, t)));
        const scale = lerp(0.14, burst.maxScale, eased);
        burst.mesh.scale.setScalar(scale);
        burst.mesh.position.y += dt * 0.24;
        burst.material.opacity = (1 - eased) * 0.85;
        if (burst.ring && burst.ringMaterial) {
          const ringScale = lerp(0.22, burst.maxScale * 2.25, eased);
          burst.ring.scale.setScalar(ringScale);
          burst.ring.position.y += dt * 0.04;
          burst.ringMaterial.opacity = (1 - eased) * 0.8;
        }
      }
    }

    updateCountVisual() {
      drawCountTexture(this.countCanvas, this.countTexture, this.count, this.count <= 0);
    }
  }

  class MinecartController {
    constructor(options) {
      this.scene = options.scene;
      this.track = options.trackController;
      this.t = Number.isFinite(options.startT) ? options.startT : 0.01;
      this.speed = Number.isFinite(options.speed) ? options.speed : 4.62; // world units / second
      this.direction = 1; // counterclockwise
      this.isRolling = false;
      this.remainingDistance = 0;

      const metalMat = new THREE.MeshStandardMaterial({
        map: MINECART_TEXTURE,
        color: 0xffffff,
        roughness: 0.62,
        metalness: 0.22,
      });
      const innerMat = new THREE.MeshStandardMaterial({
        color: 0x2f3439,
        roughness: 0.88,
        metalness: 0.06,
      });

      this.group = new THREE.Group();
      const halfW = 0.44;
      const halfL = 0.58;
      const wallH = 0.30;
      const wallT = 0.10;
      const bottomT = 0.09;

      const bottom = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, bottomT, halfL * 2), metalMat);
      bottom.position.y = bottomT * 0.5;
      this.group.add(bottom);

      const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, halfL * 2), metalMat);
      left.position.set(-halfW + wallT * 0.5, bottomT + wallH * 0.5, 0);
      this.group.add(left);

      const right = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, halfL * 2), metalMat);
      right.position.set(halfW - wallT * 0.5, bottomT + wallH * 0.5, 0);
      this.group.add(right);

      const front = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - wallT * 2, wallH, wallT), metalMat);
      front.position.set(0, bottomT + wallH * 0.5, halfL - wallT * 0.5);
      this.group.add(front);

      const back = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - wallT * 2, wallH, wallT), metalMat);
      back.position.set(0, bottomT + wallH * 0.5, -halfL + wallT * 0.5);
      this.group.add(back);

      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2 - wallT * 2, 0.02, halfL * 2 - wallT * 2),
        innerMat,
      );
      inner.position.set(0, bottomT + 0.015, 0);
      this.group.add(inner);

      this.group.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      this.scene.add(this.group);
      this._lookTarget = new THREE.Vector3();
      this._cargoLocal = new THREE.Vector3(0, 0.44, 0);
      this.group.scale.setScalar(1.6);
      this.syncToTrackPosition();
    }

    isMoving() {
      return this.isRolling;
    }

    startSingleLap() {
      const perimeter = Math.max(0.001, this.track.curve.perimeter || 1);
      this.remainingDistance = perimeter;
      this.isRolling = true;
      return perimeter / Math.max(0.001, this.speed);
    }

    setSpeed(speed) {
      if (!Number.isFinite(speed)) {
        return;
      }
      if (speed <= 0) {
        return;
      }
      this.speed = speed;
    }

    getSpeed() {
      return this.speed;
    }

    snapToNearestPoint(target, sampleCount = 720) {
      if (!target) {
        return;
      }

      const samples = Math.max(32, sampleCount | 0);
      let bestT = this.t;
      let bestDistSq = Infinity;
      const probe = new THREE.Vector3();
      for (let i = 0; i < samples; i += 1) {
        const t = i / samples;
        this.track.getPointAt(t, probe);
        const dx = probe.x - target.x;
        const dy = probe.y - target.y;
        const dz = probe.z - target.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestT = t;
        }
      }
      this.t = bestT;
      this.syncToTrackPosition();
    }

    update(dt) {
      const perimeter = Math.max(0.001, this.track.curve.perimeter || 1);

      if (this.isRolling) {
        const maxStep = this.speed * dt;
        const step = Math.min(maxStep, this.remainingDistance);
        this.remainingDistance = Math.max(0, this.remainingDistance - step);
        this.t = (this.t + this.direction * (step / perimeter)) % 1;
        if (this.t < 0) {
          this.t += 1;
        }
        if (this.remainingDistance <= 1e-4) {
          this.isRolling = false;
          this.remainingDistance = 0;
        }
      }

      this.syncToTrackPosition();
    }

    syncToTrackPosition() {
      const p = this.track.getPointAt(this.t, TEMP_A);
      const tangent = this.track.getTangentAt(this.t, TEMP_B).multiplyScalar(this.direction);
      this.group.position.set(p.x, p.y + 0.02, p.z);
      this._lookTarget.copy(this.group.position).add(tangent);
      this.group.lookAt(this._lookTarget);
    }

    getCargoAnchor(target = new THREE.Vector3()) {
      target.copy(this._cargoLocal);
      return this.group.localToWorld(target);
    }

    getForward(target = new THREE.Vector3()) {
      return this.group.getWorldDirection(target).normalize();
    }
  }

  class LevelEditor {
    constructor(options) {
      this.scene = options.scene;
      this.camera = options.camera;
      this.canvas = options.canvas;
      this.cellSize = options.cellSize;
      this.baseY = options.baseY;
      this.minX = options.minX;
      this.maxX = options.maxX;
      this.minZ = options.minZ;
      this.maxZ = options.maxZ;
      this.createMaterial = options.createMaterial;
      this.onChange = options.onChange || null;
      this.suspendChangeEvents = 0;

      this.enabled = false;
      this.selectedType = DEFAULT_BLOCK_ID;
      this.selectedTextureKey = EDITOR_TEXTURE_MODE_AUTO;
      this.selectedRotationDeg = 0;
      this.layer = 0;
      this.cells = new Map();
      this.raycaster = new THREE.Raycaster();
      this.mouseNdc = new THREE.Vector2();
      this.hoverCell = null;
      this.boxSize = this.cellSize;
      this.contentVisible = true;
      this._normalMatrix = new THREE.Matrix3();
      this._worldNormal = new THREE.Vector3();
      this._dominantNormal = new THREE.Vector3();
      this.waterFlowAccumulator = 0;
      this.waterFlowStepSec = 0.22;
      this.waterMaxSpreadLevel = 12;
      this.waterFlowNeedsRebuild = true;
      this.waterVisualTime = 0;

      this.group = new THREE.Group();
      this.scene.add(this.group);

      this.grid = this.createGrid();
      this.grid.visible = false;
      this.scene.add(this.grid);

      this.hoverMesh = new THREE.Mesh(
        new THREE.BoxGeometry(this.boxSize, this.boxSize, this.boxSize),
        new THREE.MeshStandardMaterial({
          color: 0xf2cf7d,
          transparent: true,
          opacity: 0.35,
          roughness: 0.5,
          metalness: 0,
        }),
      );
      this.hoverMesh.visible = false;
      this.scene.add(this.hoverMesh);
    }

    notifyChange() {
      if (this.suspendChangeEvents > 0) {
        return;
      }
      if (this.onChange) {
        this.onChange();
      }
    }

    createGrid() {
      const group = new THREE.Group();
      const sizeX = (this.maxX - this.minX + 1) * this.cellSize;
      const sizeZ = (this.maxZ - this.minZ + 1) * this.cellSize;
      const helper = new THREE.GridHelper(sizeX, this.maxX - this.minX + 1, 0xbcae93, 0x7f725f);
      helper.rotation.x = Math.PI * 0.5;
      helper.position.set(
        ((this.minX + this.maxX) * 0.5) * this.cellSize,
        this.baseY - this.cellSize * 0.5 + 0.002,
        ((this.minZ + this.maxZ) * 0.5) * this.cellSize,
      );
      helper.scale.set(1, sizeZ / sizeX, 1);
      group.add(helper);
      return group;
    }

    setEnabled(value) {
      this.enabled = value;
      this.grid.visible = this.contentVisible && value;
      this.hoverMesh.visible = this.contentVisible && value && this.hoverCell !== null;
    }

    isEnabled() {
      return this.enabled;
    }

    setVisible(value) {
      this.contentVisible = Boolean(value);
      this.group.visible = this.contentVisible;
      this.grid.visible = this.contentVisible && this.enabled;
      this.hoverMesh.visible = this.contentVisible && this.enabled && this.hoverCell !== null;
    }

    setType(type) {
      this.selectedType = type;
    }

    setTextureKey(textureKey) {
      this.selectedTextureKey = normalizeEditorTextureKey(textureKey);
    }

    setRotationDeg(rotationDeg) {
      this.selectedRotationDeg = normalizeBlockRotationDeg(rotationDeg);
    }

    setLayer(layer) {
      this.layer = Math.max(0, Math.min(8, Math.floor(layer)));
      if (this.hoverCell) {
        this.updateHoverMesh();
      }
    }

    getCellKey(x, y, z) {
      return `${x}:${y}:${z}`;
    }

    getVerticalStepForType(type) {
      const blockDef = getBlockDefinition(type);
      const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';
      return shape === 'slab' ? 0.5 : 1;
    }

    getVerticalStepForEntry(entry) {
      if (!entry) {
        return 1;
      }
      return this.getVerticalStepForType(entry.type);
    }

    isWaterType(type) {
      return type === WATER_BLOCK_ID;
    }

    isWaterEntry(entry) {
      return Boolean(entry) && this.isWaterType(entry.type);
    }

    isWaterSourceEntry(entry) {
      return this.isWaterEntry(entry) && entry.waterSource !== false;
    }

    markWaterFlowDirty() {
      this.waterFlowNeedsRebuild = true;
    }

    isCellSolid(x, y, z) {
      const key = this.getCellKey(x, y, z);
      const entry = this.cells.get(key);
      return Boolean(entry) && !this.isWaterEntry(entry);
    }

    hasAnyCell(x, y, z) {
      return this.cells.has(this.getCellKey(x, y, z));
    }

    hasWaterCell(x, y, z) {
      const entry = this.cells.get(this.getCellKey(x, y, z));
      return this.isWaterEntry(entry);
    }

    isCellSupportedForWater(x, y, z) {
      if (y <= 0) {
        return true;
      }
      return this.isCellSolid(x, y - 1, z);
    }

    isContainedByWallsAt(x, y, z) {
      if (!this.isCellSupportedForWater(x, y, z)) {
        return false;
      }
      const directions = [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
      ];
      for (const dir of directions) {
        let cx = x;
        let cz = z;
        let blockedByWall = false;
        for (let step = 0; step < 32; step += 1) {
          cx += dir.dx;
          cz += dir.dz;
          if (cx < this.minX || cx > this.maxX || cz < this.minZ || cz > this.maxZ) {
            return false;
          }
          if (!this.isCellSupportedForWater(cx, y, cz)) {
            return false;
          }
          if (this.isCellSolid(cx, y, cz)) {
            blockedByWall = true;
            break;
          }
        }
        if (!blockedByWall) {
          return false;
        }
      }
      return true;
    }

    hasOpenDropNeighbor(entry) {
      if (!entry) {
        return false;
      }
      const sides = [
        { x: entry.x + 1, y: entry.y, z: entry.z },
        { x: entry.x - 1, y: entry.y, z: entry.z },
        { x: entry.x, y: entry.y, z: entry.z + 1 },
        { x: entry.x, y: entry.y, z: entry.z - 1 },
      ];
      for (const side of sides) {
        if (side.x < this.minX || side.x > this.maxX || side.z < this.minZ || side.z > this.maxZ) {
          continue;
        }
        if (this.hasAnyCell(side.x, side.y, side.z)) {
          continue;
        }
        if (!this.isCellSupportedForWater(side.x, side.y, side.z)) {
          return true;
        }
      }
      return false;
    }

    canSpreadSidewaysFrom(entry) {
      if (!entry || entry.waterLevel >= this.waterMaxSpreadLevel) {
        return false;
      }
      if (entry.y <= 0) {
        return false;
      }
      if (!this.isCellSupportedForWater(entry.x, entry.y, entry.z)) {
        return false;
      }
      return this.isContainedByWallsAt(entry.x, entry.y, entry.z) || this.hasOpenDropNeighbor(entry);
    }

    upsertCell(type, x, y, z, options = null) {
      if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ || y < 0 || y > 8) {
        return null;
      }
      const textureKey = normalizeEditorTextureKey(options && (options.textureKey !== undefined ? options.textureKey : options.texture));
      const rotYDeg = normalizeBlockRotationDeg(options && (
        options.rotYDeg !== undefined ? options.rotYDeg
          : (options.rotationDeg !== undefined ? options.rotationDeg : (options.rotation !== undefined ? options.rotation : options.rotY))
      ));
      const key = this.getCellKey(x, y, z);
      const existing = this.cells.get(key);
      if (existing) {
        this.group.remove(existing.mesh);
        disposeObject3D(existing.mesh);
      }

      const mesh = createBlockMesh(
        type,
        this.boxSize,
        this.createMaterial(type, 0xffffff, { textureKey }),
        'placed',
      );
      setPlacedBlockWorldPosition(mesh, type, this.boxSize, this.cellToPosition(x, y, z));
      mesh.rotation.y = (rotYDeg * Math.PI) / 180;
      attachCellUserData(mesh, { x, y, z });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const entry = { type, textureKey, rotYDeg, x, y, z, mesh };
      if (this.isWaterType(type)) {
        entry.waterSource = options && options.waterSource !== undefined ? Boolean(options.waterSource) : true;
        entry.waterLevel = Math.max(0, Math.floor(Number(options && options.waterLevel) || 0));
      }
      this.cells.set(key, entry);
      return entry;
    }

    getTopBlockInColumn(x, z) {
      let top = null;
      for (const entry of this.cells.values()) {
        if (entry.x !== x || entry.z !== z) {
          continue;
        }
        if (!top || entry.y > top.y) {
          top = entry;
        }
      }
      return top;
    }

    cellToPosition(x, y, z) {
      return new THREE.Vector3(
        x * this.cellSize,
        this.baseY + y * this.cellSize,
        z * this.cellSize,
      );
    }

    simulateWaterStep() {
      const additions = new Map();
      const waters = [];
      for (const entry of this.cells.values()) {
        if (this.isWaterEntry(entry)) {
          waters.push(entry);
        }
      }
      waters.sort((a, b) => b.y - a.y);

      const propose = (x, y, z, level) => {
        if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ || y < 0 || y > 8) {
          return;
        }
        const key = this.getCellKey(x, y, z);
        if (this.hasAnyCell(x, y, z) || additions.has(key)) {
          return;
        }
        additions.set(key, { x, y, z, level: Math.max(0, Math.floor(level)) });
      };

      for (const water of waters) {
        const belowY = water.y - 1;
        if (belowY >= 0 && !this.hasAnyCell(water.x, belowY, water.z)) {
          propose(water.x, belowY, water.z, water.waterLevel || 0);
          continue;
        }
        if (!this.canSpreadSidewaysFrom(water)) {
          continue;
        }
        const nextLevel = (water.waterLevel || 0) + 1;
        if (nextLevel > this.waterMaxSpreadLevel) {
          continue;
        }
        const sides = [
          { x: water.x + 1, y: water.y, z: water.z },
          { x: water.x - 1, y: water.y, z: water.z },
          { x: water.x, y: water.y, z: water.z + 1 },
          { x: water.x, y: water.y, z: water.z - 1 },
        ];
        for (const side of sides) {
          const supported = this.isCellSupportedForWater(side.x, side.y, side.z);
          if (supported) {
            if (!this.isContainedByWallsAt(side.x, side.y, side.z)) {
              continue;
            }
          }
          propose(side.x, side.y, side.z, nextLevel);
        }
      }

      let changed = false;
      for (const add of additions.values()) {
        this.upsertCell(WATER_BLOCK_ID, add.x, add.y, add.z, {
          waterSource: false,
          waterLevel: add.level,
          textureKey: EDITOR_TEXTURE_MODE_AUTO,
          rotYDeg: 0,
        });
        changed = true;
      }

      const reachable = new Set();
      const queue = [];
      for (const [key, entry] of this.cells.entries()) {
        if (this.isWaterSourceEntry(entry)) {
          reachable.add(key);
          queue.push({ x: entry.x, y: entry.y, z: entry.z });
          entry.waterLevel = 0;
        }
      }
      const neighbors = [
        { dx: 1, dy: 0, dz: 0 },
        { dx: -1, dy: 0, dz: 0 },
        { dx: 0, dy: 1, dz: 0 },
        { dx: 0, dy: -1, dz: 0 },
        { dx: 0, dy: 0, dz: 1 },
        { dx: 0, dy: 0, dz: -1 },
      ];
      while (queue.length > 0) {
        const cur = queue.shift();
        for (const n of neighbors) {
          const nx = cur.x + n.dx;
          const ny = cur.y + n.dy;
          const nz = cur.z + n.dz;
          if (nx < this.minX || nx > this.maxX || nz < this.minZ || nz > this.maxZ || ny < 0 || ny > 8) {
            continue;
          }
          const key = this.getCellKey(nx, ny, nz);
          if (reachable.has(key)) {
            continue;
          }
          if (!this.hasWaterCell(nx, ny, nz)) {
            continue;
          }
          reachable.add(key);
          queue.push({ x: nx, y: ny, z: nz });
        }
      }

      for (const [key, entry] of Array.from(this.cells.entries())) {
        if (!this.isWaterEntry(entry) || this.isWaterSourceEntry(entry) || reachable.has(key)) {
          continue;
        }
        this.group.remove(entry.mesh);
        disposeObject3D(entry.mesh);
        this.cells.delete(key);
        changed = true;
      }

      if (changed) {
        this.notifyChange();
      }
    }

    updateWaterVisuals(dt) {
      this.waterVisualTime += Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const t = this.waterVisualTime;
      WATER_FLOW_TEXTURE.offset.x = (t * 0.055) % 1;
      WATER_FLOW_TEXTURE.offset.y = (t * 0.095) % 1;
      WATER_FLOW_TEXTURE.needsUpdate = true;
    }

    update(dt) {
      this.updateWaterVisuals(dt);
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      this.waterFlowAccumulator += delta;
      if (!this.waterFlowNeedsRebuild && this.waterFlowAccumulator < this.waterFlowStepSec) {
        return;
      }
      this.waterFlowAccumulator = 0;
      this.waterFlowNeedsRebuild = false;
      this.simulateWaterStep();
    }

    intersectGround(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouseNdc, this.camera);

      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.baseY);
      const point = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(plane, point);
      return hit ? point : null;
    }

    setRayFromPointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    }

    getHoveredBlockHit(event) {
      this.setRayFromPointer(event);
      const hits = this.raycaster.intersectObjects(this.group.children, true);
      for (const hit of hits) {
        let probe = hit.object || null;
        let data = null;
        while (probe && !data) {
          data = probe.userData && probe.userData.cell ? probe.userData.cell : null;
          probe = data ? null : probe.parent;
        }
        if (!data) {
          continue;
        }
        hit.object.userData.cell = data;
        return hit;
      }
      return null;
    }

    worldToCell(world) {
      const gx = Math.round(world.x / this.cellSize);
      const gz = Math.round(world.z / this.cellSize);
      if (gx < this.minX || gx > this.maxX || gz < this.minZ || gz > this.maxZ) {
        return null;
      }
      return { x: gx, y: this.layer, z: gz };
    }

    updateHoverFromPointer(event) {
      if (!this.enabled || !this.contentVisible) {
        this.hoverCell = null;
        this.hoverMesh.visible = false;
        return;
      }

      const blockHit = this.getHoveredBlockHit(event);
      if (blockHit) {
        const cell = blockHit.object.userData.cell;
        if (blockHit.face) {
          this._normalMatrix.getNormalMatrix(blockHit.object.matrixWorld);
          this._worldNormal.copy(blockHit.face.normal).applyMatrix3(this._normalMatrix).normalize();

          const ax = Math.abs(this._worldNormal.x);
          const ay = Math.abs(this._worldNormal.y);
          const az = Math.abs(this._worldNormal.z);
          this._dominantNormal.set(0, 0, 0);
          if (ay >= ax && ay >= az) {
            this._dominantNormal.y = Math.sign(this._worldNormal.y) || 1;
          } else if (ax >= az) {
            this._dominantNormal.x = Math.sign(this._worldNormal.x) || 1;
          } else {
            this._dominantNormal.z = Math.sign(this._worldNormal.z) || 1;
          }

          const nx = cell.x + this._dominantNormal.x;
          let ny = cell.y + this._dominantNormal.y;
          const nz = cell.z + this._dominantNormal.z;
          if (this._dominantNormal.y > 0) {
            const hitEntry = this.cells.get(this.getCellKey(cell.x, cell.y, cell.z)) || null;
            ny = cell.y + this.getVerticalStepForEntry(hitEntry);
          }
          if (
            nx >= this.minX && nx <= this.maxX &&
            nz >= this.minZ && nz <= this.maxZ &&
            ny >= 0 && ny <= 8
          ) {
            this.hoverCell = { x: nx, y: ny, z: nz };
            this.updateHoverMesh();
            return;
          }
        }
      }

      const world = this.intersectGround(event);
      if (!world) {
        this.hoverCell = null;
        this.hoverMesh.visible = false;
        return;
      }

      const cell = this.worldToCell(world);
      if (!cell) {
        this.hoverCell = null;
        this.hoverMesh.visible = false;
        return;
      }

      this.hoverCell = cell;
      this.updateHoverMesh();
    }

    updateHoverMesh() {
      if (!this.hoverCell || !this.enabled || !this.contentVisible) {
        this.hoverMesh.visible = false;
        return;
      }
      this.hoverMesh.visible = true;
      this.hoverMesh.position.copy(this.cellToPosition(this.hoverCell.x, this.hoverCell.y, this.hoverCell.z));
    }

    removeAtEvent(event) {
      if (!this.enabled || !this.contentVisible) {
        return false;
      }
      const blockHit = this.getHoveredBlockHit(event);
      if (blockHit) {
        const cell = blockHit.object && blockHit.object.userData ? blockHit.object.userData.cell : null;
        if (cell) {
          const hitKey = this.getCellKey(cell.x, cell.y, cell.z);
          const hitEntry = this.cells.get(hitKey) || null;
          if (hitEntry) {
            this.group.remove(hitEntry.mesh);
            disposeObject3D(hitEntry.mesh);
            this.cells.delete(this.getCellKey(hitEntry.x, hitEntry.y, hitEntry.z));
            this.markWaterFlowDirty();
            this.notifyChange();
            return true;
          }
        }
      }

      const world = this.intersectGround(event);
      if (!world) {
        return false;
      }
      const cell = this.worldToCell(world);
      if (!cell) {
        return false;
      }
      const existing = this.getTopBlockInColumn(cell.x, cell.z);
      if (!existing) {
        return false;
      }
      this.group.remove(existing.mesh);
      disposeObject3D(existing.mesh);
      this.cells.delete(this.getCellKey(existing.x, existing.y, existing.z));
      this.markWaterFlowDirty();
      this.notifyChange();
      return true;
    }

    placeAtHover() {
      if (!this.enabled || !this.hoverCell) {
        return;
      }

      const { x, y, z } = this.hoverCell;
      const key = this.getCellKey(x, y, z);

      let targetY = y;
      const existing = this.cells.get(key);
      if (existing) {
        const top = this.getTopBlockInColumn(x, z);
        targetY = Math.min(8, (top ? top.y : y) + this.getVerticalStepForEntry(top || existing));
      }
      const targetKey = this.getCellKey(x, targetY, z);
      const targetExisting = this.cells.get(targetKey);
      if (targetExisting) {
        this.group.remove(targetExisting.mesh);
        disposeObject3D(targetExisting.mesh);
      }
      this.upsertCell(this.selectedType, x, targetY, z, {
        textureKey: this.selectedTextureKey,
        rotYDeg: this.selectedRotationDeg,
        waterSource: this.isWaterType(this.selectedType),
        waterLevel: 0,
      });
      this.markWaterFlowDirty();
      this.notifyChange();
    }

    placeBlock(type, x, y, z, options = null) {
      this.upsertCell(type, x, y, z, options);
      this.markWaterFlowDirty();
    }

    clear(shouldNotify = true) {
      for (const entry of this.cells.values()) {
        this.group.remove(entry.mesh);
        disposeObject3D(entry.mesh);
      }
      this.cells.clear();
      this.markWaterFlowDirty();
      if (shouldNotify) {
        this.notifyChange();
      }
    }

    exportJSON() {
      const blocks = Array.from(this.cells.values())
        .map((entry) => {
          const {
            type, textureKey, rotYDeg, x, y, z,
          } = entry;
          const block = { type, x, y, z };
          if (this.isWaterEntry(entry) && entry.waterSource === false) {
            block.waterSource = false;
          }
          if (textureKey && textureKey !== EDITOR_TEXTURE_MODE_AUTO) {
            block.texture = textureKey;
          }
          if (rotYDeg) {
            block.rotYDeg = rotYDeg;
          }
          return block;
        })
        .sort((a, b) => (a.y - b.y) || (a.z - b.z) || (a.x - b.x));
      return JSON.stringify({ blocks }, null, 2);
    }

    loadJSON(data) {
      this.suspendChangeEvents += 1;
      this.clear(false);
      const list = data && Array.isArray(data.blocks) ? data.blocks : [];
      for (const block of list) {
        this.placeBlock(block.type || DEFAULT_BLOCK_ID, Number(block.x), Number(block.y), Number(block.z), block);
      }
      this.suspendChangeEvents = Math.max(0, this.suspendChangeEvents - 1);
      this.notifyChange();
    }

    refreshDoorMeshes() {
      for (const entry of this.cells.values()) {
        if (!entry || entry.type !== 'door' || !entry.mesh) {
          continue;
        }
        const oldMesh = entry.mesh;
        const nextMesh = createBlockMesh(
          entry.type,
          this.boxSize,
          this.createMaterial(entry.type, 0xffffff, { textureKey: entry.textureKey }),
          'placed',
        );
        setPlacedBlockWorldPosition(
          nextMesh,
          entry.type,
          this.boxSize,
          this.cellToPosition(entry.x, entry.y, entry.z),
        );
        nextMesh.rotation.copy(oldMesh.rotation);
        nextMesh.visible = oldMesh.visible;
        attachCellUserData(nextMesh, { x: entry.x, y: entry.y, z: entry.z });
        nextMesh.castShadow = true;
        nextMesh.receiveShadow = true;
        this.group.add(nextMesh);
        this.group.remove(oldMesh);
        disposeObject3D(oldMesh);
        entry.mesh = nextMesh;
      }
    }
  }

  const BLOCK_CONFIGS = INVENTORY_BLOCK_DEFS.map((blockDef) => ({
    id: blockDef.id,
    label: blockDef.label || blockDef.id,
    type: blockDef.id,
    textureKey: normalizeEditorTextureKey(blockDef.textureKey),
    color: Number.isFinite(blockDef.color) ? blockDef.color : 0xffffff,
    count: 0,
  }));
  const BLOCK_TYPE_SET = new Set(BLOCK_LIBRARY.map((blockDef) => blockDef.id));
  let activeLevelId = INITIAL_LEVEL_DATA.id;

  const canvas = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6e9f57);
  scene.fog = null;

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(14.5, 16, 14.5);
  camera.lookAt(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.02);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xd9efff, 0x84ad62, 0.62);
  scene.add(hemiLight);

  const directionalLight = new THREE.DirectionalLight(0xfff8e9, 1.24);
  directionalLight.position.set(8, 18, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left = -16;
  directionalLight.shadow.camera.right = 16;
  directionalLight.shadow.camera.top = 16;
  directionalLight.shadow.camera.bottom = -16;
  scene.add(directionalLight);

  const terrainData = createVoxelTerrain(scene);
  createVoxelTrees(scene, terrainData);

  const trackController = new TrackController(scene);
  const minecart = new MinecartController({
    scene,
    trackController,
    startT: 0.126,
    speed: INITIAL_LEVEL_DATA.minecartSpeed,
  });
  const buildManager = new BuildManager(scene, {
    cellSize: 1,
    baseY: 0.5,
    createMaterial: createBlockMaterial,
  });
  buildManager.loadFromLevel(DEFAULT_EDITOR_LEVEL);
  const editor = new LevelEditor({
    scene,
    camera,
    canvas,
    cellSize: 1,
    baseY: 0.5,
    minX: -6,
    maxX: 6,
    minZ: -4,
    maxZ: 4,
    createMaterial: createBlockMaterial,
  });
  editor.loadJSON(DEFAULT_EDITOR_LEVEL);
  const SCENE_STORAGE_KEY = 'minecraft_puzzle:scene_layout_v2';
  const SELECTED_LEVEL_STORAGE_KEY = 'minecraft_puzzle:selected_level_id_v1';
  const LEGACY_RAILS_STORAGE_KEYS = ['prototype:rails_layout_v2', 'prototype:rails_layout_v1'];
  const RAIL_LOOP_SIZE_PRESETS = {
    '12': { minX: -5, maxX: 6, minZ: -3, maxZ: 3 },
    '14': { minX: -6, maxX: 7, minZ: -4, maxZ: 4 },
    '16': { minX: -7, maxX: 8, minZ: -5, maxZ: 5 },
    '18': { minX: -8, maxX: 9, minZ: -6, maxZ: 6 },
    '20': { minX: -9, maxX: 10, minZ: -7, maxZ: 7 },
  };
  let railLoopSizeX = '16';
  let railLoopSizeY = '16';

  function normalizeRailLoopSizeValue(value) {
    if (value === 'small') {
      return '14';
    }
    if (value === 'large') {
      return '16';
    }
    const normalized = String(value || '').trim();
    return Object.prototype.hasOwnProperty.call(RAIL_LOOP_SIZE_PRESETS, normalized) ? normalized : '16';
  }

  function buildRailLoopFromBounds(bounds) {
    const minX = Math.round(bounds.minX);
    const maxX = Math.round(bounds.maxX);
    const minZ = Math.round(bounds.minZ);
    const maxZ = Math.round(bounds.maxZ);
    const rails = [];

    rails.push({ type: 'corner', x: minX, z: minZ, yaw: Math.PI });
    for (let x = minX + 1; x <= maxX - 1; x += 1) {
      rails.push({ type: 'straight', x, z: minZ, yaw: Math.PI * 0.5 });
    }
    rails.push({ type: 'corner', x: maxX, z: minZ, yaw: Math.PI * 0.5 });

    for (let z = minZ + 1; z <= maxZ - 1; z += 1) {
      rails.push({ type: 'straight', x: minX, z, yaw: 0 });
      rails.push({ type: 'straight', x: maxX, z, yaw: 0 });
    }

    rails.push({ type: 'corner', x: minX, z: maxZ, yaw: Math.PI * 1.5 });
    for (let x = minX + 1; x <= maxX - 1; x += 1) {
      rails.push({ type: 'straight', x, z: maxZ, yaw: Math.PI * 0.5 });
    }
    rails.push({ type: 'corner', x: maxX, z: maxZ, yaw: 0 });

    return rails;
  }

  function getDefaultUserRails(size) {
    const normalizedX = normalizeRailLoopSizeValue(size && size.x !== undefined ? size.x : railLoopSizeX);
    const normalizedY = normalizeRailLoopSizeValue(size && size.y !== undefined ? size.y : railLoopSizeY);
    const presetX = RAIL_LOOP_SIZE_PRESETS[normalizedX] || RAIL_LOOP_SIZE_PRESETS['16'];
    const presetY = RAIL_LOOP_SIZE_PRESETS[normalizedY] || RAIL_LOOP_SIZE_PRESETS['16'];
    return normalizeRails(buildRailLoopFromBounds({
      minX: presetX.minX,
      maxX: presetX.maxX,
      minZ: presetY.minZ,
      maxZ: presetY.maxZ,
    }));
  }
  const debugEditor = document.getElementById('debug-editor');
  const inventoryMoveEnabledInput = document.getElementById('inventory-move-enabled');
  const DEFAULT_INVENTORY_ZONE = {
    x: 21.24,
    z: 0.01,
    angleDeg: 90,
  };
  let uiHidden = false;
  let flyCamEnabled = false;
  let flyCamRestoreState = null;
  let syncCameraInputsFromState = null;
  let flyLookActive = false;
  let inventoryMoveEnabled = false;
  let inventorySpinAngleDeg = DEFAULT_INVENTORY_ZONE.angleDeg;
  let inventoryZoneX = DEFAULT_INVENTORY_ZONE.x;
  let inventoryZoneZ = DEFAULT_INVENTORY_ZONE.z;
  let draggingInventory = false;
  const inventoryDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const inventoryDragPoint = new THREE.Vector3();
  const inventoryDragOffset = new THREE.Vector3();
  const inventoryDragRaycaster = new THREE.Raycaster();
  let flyYawDeg = 0;
  let flyPitchDeg = 0;
  const flyMoveState = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    KeyQ: false,
    KeyE: false,
    ShiftLeft: false,
    ShiftRight: false,
  };
  const RAD_TO_DEG = 180 / Math.PI;
  const DEG_TO_RAD = Math.PI / 180;
  const DEFAULT_CAMERA_DEBUG = {
    useLookAt: true,
    position: { x: 50.1, y: 53.9, z: 0 },
    rotationDeg: {
      x: -47.862405226111754,
      y: 90.00000000000003,
      z: -9.481268497239976e-15,
    },
    target: { x: 0.7, y: -0.7, z: 0 },
    fov: 15,
    near: 0.1,
    far: 100.1,
    zoom: 1.18,
    focus: 9.8,
    filmGauge: 0,
    filmOffset: 0,
  };
  const cameraDebugState = JSON.parse(JSON.stringify(DEFAULT_CAMERA_DEBUG));

  function toFiniteNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function normalizeSpinAngleDeg(value) {
    const raw = Number(value);
    if (!Number.isFinite(raw)) {
      return 0;
    }
    const wrapped = ((raw % 360) + 360) % 360;
    return Math.round(wrapped);
  }

  function exportCameraDebugState() {
    return {
      useLookAt: Boolean(cameraDebugState.useLookAt),
      position: {
        x: toFiniteNumber(cameraDebugState.position.x, DEFAULT_CAMERA_DEBUG.position.x),
        y: toFiniteNumber(cameraDebugState.position.y, DEFAULT_CAMERA_DEBUG.position.y),
        z: toFiniteNumber(cameraDebugState.position.z, DEFAULT_CAMERA_DEBUG.position.z),
      },
      rotationDeg: {
        x: toFiniteNumber(cameraDebugState.rotationDeg.x, DEFAULT_CAMERA_DEBUG.rotationDeg.x),
        y: toFiniteNumber(cameraDebugState.rotationDeg.y, DEFAULT_CAMERA_DEBUG.rotationDeg.y),
        z: toFiniteNumber(cameraDebugState.rotationDeg.z, DEFAULT_CAMERA_DEBUG.rotationDeg.z),
      },
      target: {
        x: toFiniteNumber(cameraDebugState.target.x, DEFAULT_CAMERA_DEBUG.target.x),
        y: toFiniteNumber(cameraDebugState.target.y, DEFAULT_CAMERA_DEBUG.target.y),
        z: toFiniteNumber(cameraDebugState.target.z, DEFAULT_CAMERA_DEBUG.target.z),
      },
      fov: toFiniteNumber(cameraDebugState.fov, DEFAULT_CAMERA_DEBUG.fov),
      near: toFiniteNumber(cameraDebugState.near, DEFAULT_CAMERA_DEBUG.near),
      far: toFiniteNumber(cameraDebugState.far, DEFAULT_CAMERA_DEBUG.far),
      zoom: toFiniteNumber(cameraDebugState.zoom, DEFAULT_CAMERA_DEBUG.zoom),
      focus: toFiniteNumber(cameraDebugState.focus, DEFAULT_CAMERA_DEBUG.focus),
      filmGauge: toFiniteNumber(cameraDebugState.filmGauge, DEFAULT_CAMERA_DEBUG.filmGauge),
      filmOffset: toFiniteNumber(cameraDebugState.filmOffset, DEFAULT_CAMERA_DEBUG.filmOffset),
    };
  }

  function applyCameraDebugState() {
    camera.position.set(
      toFiniteNumber(cameraDebugState.position.x, DEFAULT_CAMERA_DEBUG.position.x),
      toFiniteNumber(cameraDebugState.position.y, DEFAULT_CAMERA_DEBUG.position.y),
      toFiniteNumber(cameraDebugState.position.z, DEFAULT_CAMERA_DEBUG.position.z),
    );
    if (cameraDebugState.useLookAt) {
      camera.lookAt(
        toFiniteNumber(cameraDebugState.target.x, DEFAULT_CAMERA_DEBUG.target.x),
        toFiniteNumber(cameraDebugState.target.y, DEFAULT_CAMERA_DEBUG.target.y),
        toFiniteNumber(cameraDebugState.target.z, DEFAULT_CAMERA_DEBUG.target.z),
      );
      cameraDebugState.rotationDeg.x = camera.rotation.x * RAD_TO_DEG;
      cameraDebugState.rotationDeg.y = camera.rotation.y * RAD_TO_DEG;
      cameraDebugState.rotationDeg.z = camera.rotation.z * RAD_TO_DEG;
    } else {
      camera.rotation.set(
        toFiniteNumber(cameraDebugState.rotationDeg.x, DEFAULT_CAMERA_DEBUG.rotationDeg.x) * DEG_TO_RAD,
        toFiniteNumber(cameraDebugState.rotationDeg.y, DEFAULT_CAMERA_DEBUG.rotationDeg.y) * DEG_TO_RAD,
        toFiniteNumber(cameraDebugState.rotationDeg.z, DEFAULT_CAMERA_DEBUG.rotationDeg.z) * DEG_TO_RAD,
      );
    }
    camera.fov = THREE.MathUtils.clamp(toFiniteNumber(cameraDebugState.fov, DEFAULT_CAMERA_DEBUG.fov), 1, 179);
    camera.near = Math.max(0.01, toFiniteNumber(cameraDebugState.near, DEFAULT_CAMERA_DEBUG.near));
    camera.far = Math.max(camera.near + 0.01, toFiniteNumber(cameraDebugState.far, DEFAULT_CAMERA_DEBUG.far));
    camera.zoom = Math.max(0.01, toFiniteNumber(cameraDebugState.zoom, DEFAULT_CAMERA_DEBUG.zoom));
    camera.focus = Math.max(0.01, toFiniteNumber(cameraDebugState.focus, DEFAULT_CAMERA_DEBUG.focus));
    camera.filmGauge = Math.max(1, toFiniteNumber(cameraDebugState.filmGauge, DEFAULT_CAMERA_DEBUG.filmGauge));
    camera.filmOffset = toFiniteNumber(cameraDebugState.filmOffset, DEFAULT_CAMERA_DEBUG.filmOffset);
    camera.updateProjectionMatrix();
  }

  function normalizeCameraSettings(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const source = {
      ...DEFAULT_CAMERA_DEBUG,
      ...raw,
      position: { ...DEFAULT_CAMERA_DEBUG.position, ...(raw.position || {}) },
      rotationDeg: { ...DEFAULT_CAMERA_DEBUG.rotationDeg, ...(raw.rotationDeg || {}) },
      target: { ...DEFAULT_CAMERA_DEBUG.target, ...(raw.target || {}) },
    };
    return {
      useLookAt: Boolean(source.useLookAt),
      position: {
        x: toFiniteNumber(source.position.x, DEFAULT_CAMERA_DEBUG.position.x),
        y: toFiniteNumber(source.position.y, DEFAULT_CAMERA_DEBUG.position.y),
        z: toFiniteNumber(source.position.z, DEFAULT_CAMERA_DEBUG.position.z),
      },
      rotationDeg: {
        x: toFiniteNumber(source.rotationDeg.x, DEFAULT_CAMERA_DEBUG.rotationDeg.x),
        y: toFiniteNumber(source.rotationDeg.y, DEFAULT_CAMERA_DEBUG.rotationDeg.y),
        z: toFiniteNumber(source.rotationDeg.z, DEFAULT_CAMERA_DEBUG.rotationDeg.z),
      },
      target: {
        x: toFiniteNumber(source.target.x, DEFAULT_CAMERA_DEBUG.target.x),
        y: toFiniteNumber(source.target.y, DEFAULT_CAMERA_DEBUG.target.y),
        z: toFiniteNumber(source.target.z, DEFAULT_CAMERA_DEBUG.target.z),
      },
      fov: toFiniteNumber(source.fov, DEFAULT_CAMERA_DEBUG.fov),
      near: toFiniteNumber(source.near, DEFAULT_CAMERA_DEBUG.near),
      far: toFiniteNumber(source.far, DEFAULT_CAMERA_DEBUG.far),
      zoom: toFiniteNumber(source.zoom, DEFAULT_CAMERA_DEBUG.zoom),
      focus: toFiniteNumber(source.focus, DEFAULT_CAMERA_DEBUG.focus),
      filmGauge: toFiniteNumber(source.filmGauge, DEFAULT_CAMERA_DEBUG.filmGauge),
      filmOffset: toFiniteNumber(source.filmOffset, DEFAULT_CAMERA_DEBUG.filmOffset),
    };
  }

  function isTextInputFocused() {
    const active = document.activeElement;
    if (!active) {
      return false;
    }
    const tag = String(active.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || active.isContentEditable;
  }

  function setFlyMoveKey(code, pressed) {
    if (!(code in flyMoveState)) {
      return false;
    }
    flyMoveState[code] = pressed;
    return true;
  }

  function clearFlyMoveState() {
    for (const code of Object.keys(flyMoveState)) {
      flyMoveState[code] = false;
    }
  }

  function syncFlyAnglesFromCamera() {
    flyPitchDeg = camera.rotation.x * RAD_TO_DEG;
    flyYawDeg = camera.rotation.y * RAD_TO_DEG;
  }

  function syncCameraDebugFromCameraObject() {
    cameraDebugState.useLookAt = false;
    cameraDebugState.position.x = camera.position.x;
    cameraDebugState.position.y = camera.position.y;
    cameraDebugState.position.z = camera.position.z;
    cameraDebugState.rotationDeg.x = camera.rotation.x * RAD_TO_DEG;
    cameraDebugState.rotationDeg.y = camera.rotation.y * RAD_TO_DEG;
    cameraDebugState.rotationDeg.z = camera.rotation.z * RAD_TO_DEG;
  }

  function setFlyCamEnabled(enabled) {
    const next = Boolean(enabled);
    if (next === flyCamEnabled) {
      return;
    }
    flyCamEnabled = next;
    if (flyCamEnabled) {
      flyCamRestoreState = exportCameraDebugState();
      camera.rotation.order = 'YXZ';
      syncFlyAnglesFromCamera();
      clearFlyMoveState();
      return;
    }
    flyLookActive = false;
    clearFlyMoveState();
    if (!flyCamRestoreState) {
      return;
    }
    Object.assign(cameraDebugState, normalizeCameraSettings(flyCamRestoreState));
    applyCameraDebugState();
    if (typeof syncCameraInputsFromState === 'function') {
      syncCameraInputsFromState();
    }
    saveSceneLayout();
  }

  function updateFlyCamera(dt) {
    if (!flyCamEnabled) {
      return;
    }
    const up = Number(flyMoveState.KeyE) - Number(flyMoveState.KeyQ);
    const forward = Number(flyMoveState.KeyW) - Number(flyMoveState.KeyS);
    const right = Number(flyMoveState.KeyD) - Number(flyMoveState.KeyA);
    if (up === 0 && forward === 0 && right === 0) {
      return;
    }
    const speedMultiplier = flyMoveState.ShiftLeft || flyMoveState.ShiftRight ? 2.4 : 1;
    const speed = 11 * speedMultiplier;
    const delta = speed * dt;
    const forwardDir = new THREE.Vector3();
    camera.getWorldDirection(forwardDir);
    const rightDir = new THREE.Vector3().crossVectors(forwardDir, camera.up).normalize();
    camera.position.addScaledVector(forwardDir, forward * delta);
    camera.position.addScaledVector(rightDir, right * delta);
    camera.position.addScaledVector(camera.up, up * delta);
    syncCameraDebugFromCameraObject();
    if (typeof syncCameraInputsFromState === 'function') {
      syncCameraInputsFromState();
    }
  }

  function applyUiVisibility() {
    debugEditor.style.display = uiHidden ? 'none' : '';
    const visible = !uiHidden;
    editor.setVisible(visible);
    buildManager.setVisible(visible);
  }

  function getEditorBlocksSnapshot() {
    try {
      const parsed = JSON.parse(editor.exportJSON());
      return Array.isArray(parsed.blocks) ? parsed.blocks : [];
    } catch (error) {
      console.warn('Failed to export editor blocks', error);
      return [];
    }
  }

  function getBuildSettingsSnapshot() {
    return {
      targetBlocks: getEditorBlocksSnapshot(),
    };
  }

  function resolveBuildTargetBlocks(raw) {
    if (!raw || typeof raw !== 'object') {
      return [];
    }
    if (raw.build && Array.isArray(raw.build.targetBlocks)) {
      return normalizeBlocks(raw.build.targetBlocks);
    }
    return normalizeBlocks(raw.blocks);
  }

  function handleEditorBlocksChange() {
    const targetBlocks = getEditorBlocksSnapshot();
    buildManager.loadFromLevel({ blocks: targetBlocks });
    if (typeof syncBlockCountsFromLevel === 'function') {
      syncBlockCountsFromLevel();
    }
    if (typeof refreshUiLockState === 'function') {
      refreshUiLockState();
    }
    saveSceneLayout();
  }

  function getCurrentSceneSnapshot() {
    const currentRails = normalizeRails(railEditor.exportData());
    const safeRails = currentRails.length > 0 ? currentRails : getDefaultUserRails();
    const inventoryPos = worldInventory.getGroupPosition(TEMP_A);
    return {
      version: 5,
      levelId: activeLevelId,
      blocks: getEditorBlocksSnapshot(),
      build: getBuildSettingsSnapshot(),
      railLoopSizeX: normalizeRailLoopSizeValue(railLoopSizeX),
      railLoopSizeY: normalizeRailLoopSizeValue(railLoopSizeY),
      rails: safeRails,
      minecart: {
        speed: minecart.getSpeed(),
      },
      inventory: {
        x: toFiniteNumber(inventoryPos.x, 0),
        z: toFiniteNumber(inventoryPos.z, 0),
        spinAngleDeg: normalizeSpinAngleDeg(inventorySpinAngleDeg),
      },
      camera: exportCameraDebugState(),
    };
  }

  function saveSceneLayout() {
    try {
      localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(getCurrentSceneSnapshot()));
      if (activeLevelId && LEVELS_BY_ID.has(activeLevelId)) {
        localStorage.setItem(SELECTED_LEVEL_STORAGE_KEY, activeLevelId);
      }
    } catch (error) {
      console.warn('Failed to save scene to localStorage', error);
    }
  }

  function getStoredActiveLevelId() {
    try {
      const raw = String(localStorage.getItem(SELECTED_LEVEL_STORAGE_KEY) || '').trim();
      if (!raw) {
        return '';
      }
      return LEVELS_BY_ID.has(raw) ? raw : '';
    } catch (error) {
      console.warn('Failed to restore selected level from localStorage', error);
      return '';
    }
  }

  function handleRailLayoutChange() {
    trackController.setRailLayout(railEditor.exportData());
    saveSceneLayout();
  }

  function autoPlaceRails() {
    loadDefaultRails();
  }

  function loadDefaultRails() {
    const rails = getDefaultUserRails({ x: railLoopSizeX, y: railLoopSizeY });
    railEditor.loadData(rails.length > 0 ? rails : DEFAULT_RAILS_LAYOUT);
    trackController.setRailLayout(railEditor.exportData());
    saveSceneLayout();
  }

  function normalizeBlocks(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    const normalized = [];
    const allowedTypes = BLOCK_TYPE_SET;
    const used = new Set();
    for (const block of list) {
      if (!block || typeof block !== 'object') {
        continue;
      }
      const x = Number(block.x);
      const y = Number(block.y);
      const z = Number(block.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      const type = allowedTypes.has(block.type) ? block.type : DEFAULT_BLOCK_ID;
      const ix = Math.round(x);
      const iy = Math.max(0, Math.min(8, Math.round(y * 2) / 2));
      const iz = Math.round(z);
      const textureKey = normalizeEditorTextureKey(
        block.textureKey !== undefined ? block.textureKey : block.texture,
      );
      const rotYDeg = normalizeBlockRotationDeg(
        block.rotYDeg !== undefined ? block.rotYDeg
          : (block.rotY !== undefined ? block.rotY : (block.rot !== undefined ? block.rot : block.rotation)),
      );
      const key = `${ix}:${iy}:${iz}:${type}:${textureKey}:${rotYDeg}`;
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      const normalizedBlock = {
        type,
        x: ix,
        y: iy,
        z: iz,
      };
      if (type === WATER_BLOCK_ID && block.waterSource === false) {
        normalizedBlock.waterSource = false;
      }
      if (textureKey !== EDITOR_TEXTURE_MODE_AUTO) {
        normalizedBlock.texture = textureKey;
      }
      if (rotYDeg) {
        normalizedBlock.rotYDeg = rotYDeg;
      }
      normalized.push(normalizedBlock);
    }
    return normalized;
  }

  function parseRailYaw(rail) {
    const yawCandidate = rail && (
      rail.yaw !== undefined ? rail.yaw
        : (rail.rotation !== undefined ? rail.rotation : rail.rot)
    );
    let yaw = Number(yawCandidate);
    if (!Number.isFinite(yaw)) {
      return 0;
    }
    // If value looks like degrees (common in imported editor payloads), convert to radians.
    if (Math.abs(yaw) > Math.PI * 2 + 1e-6) {
      yaw = (yaw * Math.PI) / 180;
    }
    return yaw;
  }

  function normalizeRails(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    const normalized = [];
    const used = new Set();
    for (const rail of list) {
      if (!rail || typeof rail !== 'object') {
        continue;
      }
      const x = Number(rail.x);
      const z = Number(rail.z);
      const yaw = parseRailYaw(rail);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        continue;
      }
      if (rail.type !== 'straight' && rail.type !== 'corner') {
        continue;
      }
      const key = `${Math.round(x)}:${Math.round(z)}`;
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      normalized.push({
        type: rail.type,
        x: Math.round(x),
        z: Math.round(z),
        yaw,
      });
    }
    return normalized;
  }

  function stripCodeFences(raw) {
    const text = String(raw || '')
      .replace(/^\uFEFF/, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
    const fenced = text.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/);
    return fenced ? fenced[1].trim() : text;
  }

  function sliceToJsonLike(text) {
    const src = String(text || '').trim();
    if (!src) {
      return '';
    }
    const firstBrace = src.indexOf('{');
    const firstBracket = src.indexOf('[');
    let start = -1;
    if (firstBrace >= 0 && firstBracket >= 0) {
      start = Math.min(firstBrace, firstBracket);
    } else {
      start = Math.max(firstBrace, firstBracket);
    }
    if (start < 0) {
      return src;
    }
    const endBrace = src.lastIndexOf('}');
    const endBracket = src.lastIndexOf(']');
    const end = Math.max(endBrace, endBracket);
    if (end >= start) {
      return src.slice(start, end + 1).trim();
    }
    return src.slice(start).trim();
  }

  function extractLiteralPayload(raw) {
    const text = stripCodeFences(raw).trim();
    if (!text) {
      return '';
    }
    // Support "const data = {...};" / "data = [...] ;"
    const assignMatch = text.match(/^(?:const|let|var)?\s*[a-zA-Z_$][\w$]*\s*=\s*([\s\S]+)$/);
    const candidate = (assignMatch ? assignMatch[1] : text).trim();
    return sliceToJsonLike(candidate.replace(/;\s*$/, ''));
  }

  function parseJsonLoose(raw) {
    const payload = extractLiteralPayload(raw);
    if (!payload) {
      throw new Error('Empty payload');
    }
    // Recover common copy/paste corruption like: 1.5707...5707963267948966
    const sanitizedPayload = payload.replace(/(-?\d+(?:\.\d+)?)\s*\.\.\.\s*-?\d+(?:\.\d+)?/g, '$1');

    try {
      return JSON.parse(sanitizedPayload);
    } catch (_errorA) {
      try {
        // JS-like object fallback: unquoted keys + single quotes.
        const withQuotedKeys = sanitizedPayload.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
        const relaxed = withQuotedKeys.replace(/'/g, '"');
        return JSON.parse(relaxed);
      } catch (_errorB) {
        try {
          // JSONC/JS-ish fallback: comments + trailing commas.
          const noComments = sanitizedPayload
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
          const noTrailingCommas = noComments.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(noTrailingCommas);
        } catch (_errorC) {
          try {
            // Final fallback for JS literal objects/arrays.
            return Function(`"use strict"; return (${sanitizedPayload});`)();
          } catch (_errorD) {
            throw new Error('Unsupported JSON format');
          }
        }
      }
    }
  }

  function pickRailsPayload(parsed) {
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (Array.isArray(parsed.rails)) {
      return parsed.rails;
    }
    if (parsed.data && Array.isArray(parsed.data.rails)) {
      return parsed.data.rails;
    }
    return null;
  }

  function pickBlocksPayload(parsed) {
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (Array.isArray(parsed.blocks)) {
      return parsed.blocks;
    }
    if (parsed.data && Array.isArray(parsed.data.blocks)) {
      return parsed.data.blocks;
    }
    return null;
  }

  function toSlug(value, fallback) {
    const safe = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return safe || fallback;
  }

  function makeTimestampTag() {
    const date = new Date();
    const pad2 = (v) => String(v).padStart(2, '0');
    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  }

  function triggerTextDownload(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function saveTextToFile(filename, content, mime, extensions) {
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Minecraft Puzzle Data',
            accept: {
              [mime || 'text/plain']: extensions && extensions.length > 0 ? extensions : ['.txt'],
            },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          return;
        }
        console.warn('showSaveFilePicker failed, fallback to download', error);
      }
    }
    triggerTextDownload(filename, content, mime);
  }

  function tryExtractRegisterCallPayload(raw) {
    const text = String(raw || '');
    const marker = 'registerMinecraftLevel(';
    const markerIndex = text.indexOf(marker);
    if (markerIndex < 0) {
      return '';
    }
    const start = markerIndex + marker.length;
    let depth = 0;
    let inString = false;
    let quote = '';
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === quote) {
          inString = false;
          quote = '';
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        quote = ch;
        continue;
      }
      if (ch === '(' || ch === '{' || ch === '[') {
        depth += 1;
        continue;
      }
      if (ch === ')' || ch === '}' || ch === ']') {
        if (depth === 0 && ch === ')') {
          return text.slice(start, i).trim();
        }
        depth = Math.max(0, depth - 1);
      }
    }
    return '';
  }

  function parseLevelFileData(raw) {
    const registerPayload = tryExtractRegisterCallPayload(raw);
    if (registerPayload) {
      return parseJsonLoose(registerPayload);
    }
    const exportDefault = String(raw || '').match(/export\s+default\s+([\s\S]+?)\s*;?\s*$/);
    if (exportDefault && exportDefault[1]) {
      return parseJsonLoose(exportDefault[1]);
    }
    return parseJsonLoose(raw);
  }

  function normalizeSceneSnapshotPayload(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const levelData = cloneLevelData(LEVELS_BY_ID.get(raw.levelId) || INITIAL_LEVEL_DATA);
    const hasBlocksField = Object.prototype.hasOwnProperty.call(raw, 'blocks');
    const hasBuildTargetField = Boolean(
      raw.build
      && typeof raw.build === 'object'
      && Object.prototype.hasOwnProperty.call(raw.build, 'targetBlocks'),
    );
    const blocks = normalizeBlocks(raw.blocks);
    const buildTargetBlocks = resolveBuildTargetBlocks(raw);
    const legacyRailLoopSize = normalizeRailLoopSizeValue(raw.railLoopSize);
    const snapshotRailLoopSizeX = normalizeRailLoopSizeValue(
      raw.railLoopSizeX !== undefined ? raw.railLoopSizeX : legacyRailLoopSize,
    );
    const snapshotRailLoopSizeY = normalizeRailLoopSizeValue(
      raw.railLoopSizeY !== undefined ? raw.railLoopSizeY : legacyRailLoopSize,
    );
    const rails = normalizeRails(raw.rails);
    const speed = Number(raw.minecart && raw.minecart.speed);
    const inventoryX = Number(raw.inventory && raw.inventory.x);
    const inventoryZ = Number(raw.inventory && raw.inventory.z);
    const hasInventoryAngle = raw.inventory && raw.inventory.spinAngleDeg !== undefined;
    const inventorySpinAngleDeg = hasInventoryAngle
      ? normalizeSpinAngleDeg(raw.inventory.spinAngleDeg)
      : DEFAULT_INVENTORY_ZONE.angleDeg;
    const cameraSettings = normalizeCameraSettings(raw.camera);
    const effectiveBlocks = hasBlocksField ? blocks : normalizeBlocks(levelData.blocks);
    const effectiveBuildTargetBlocks = hasBuildTargetField
      ? buildTargetBlocks
      : (hasBlocksField ? blocks : normalizeBlocks(levelData.blocks));
    return {
      levelId: levelData.id,
      blocks: effectiveBlocks,
      buildTargetBlocks: effectiveBuildTargetBlocks,
      railLoopSizeX: snapshotRailLoopSizeX,
      railLoopSizeY: snapshotRailLoopSizeY,
      rails: rails.length > 0 ? rails : (normalizeRails(levelData.rails).length > 0 ? normalizeRails(levelData.rails) : getDefaultUserRails({ x: snapshotRailLoopSizeX, y: snapshotRailLoopSizeY })),
      minecartSpeed: Number.isFinite(speed) && speed > 0 ? speed : levelData.minecartSpeed,
      inventoryPosition: {
        x: Number.isFinite(inventoryX) ? inventoryX : DEFAULT_INVENTORY_ZONE.x,
        z: Number.isFinite(inventoryZ) ? inventoryZ : DEFAULT_INVENTORY_ZONE.z,
      },
      inventorySpinAngleDeg,
      camera: cameraSettings || normalizeCameraSettings(levelData.camera),
    };
  }

  function normalizeLevelPayload(raw, fallbackId) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const id = String(raw.id || '').trim() || fallbackId;
    const name = String(raw.name || '').trim() || id;
    const blocks = normalizeBlocks(pickBlocksPayload(raw));
    const rails = normalizeRails(pickRailsPayload(raw));
    const speed = Number(raw.minecart && raw.minecart.speed);
    const camera = normalizeCameraSettings(raw.camera);
    return {
      id,
      name,
      blocks,
      rails,
      minecart: {
        speed: Number.isFinite(speed) && speed > 0 ? speed : 11,
      },
      camera: camera || null,
    };
  }

  function parseIncrementalLevelNumber(value) {
    const text = String(value || '').trim().toLowerCase();
    const match = text.match(/^(\d+)\s*(?:lvl|level|лвл)$/i);
    if (!match) {
      return null;
    }
    const n = Number(match[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function getNextIncrementalLevelName() {
    let maxN = 0;
    for (const level of LEVEL_CATALOG) {
      if (!level) {
        continue;
      }
      const fromName = parseIncrementalLevelNumber(level.name);
      if (fromName && fromName > maxN) {
        maxN = fromName;
      }
      const fromId = parseIncrementalLevelNumber(String(level.id || '').replace(/[_-]+/g, ' '));
      if (fromId && fromId > maxN) {
        maxN = fromId;
      }
    }
    return `${maxN + 1} lvl`;
  }

  function levelNameFromFilename(filename) {
    const base = String(filename || '').replace(/\.[^./\\]+$/, '').trim();
    if (!base) {
      return '';
    }
    return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function upsertRuntimeLevel(levelRaw) {
    const level = normalizeLevelPayload(levelRaw, `imported_level_${makeTimestampTag()}`);
    if (!level) {
      return null;
    }
    const existingIndex = LEVEL_CATALOG.findIndex((item) => item && item.id === level.id);
    if (existingIndex >= 0) {
      LEVEL_CATALOG[existingIndex] = level;
    } else {
      LEVEL_CATALOG.push(level);
    }
    LEVELS_BY_ID.set(level.id, level);
    return level;
  }

  function restoreSceneLayout() {
    try {
      const raw = localStorage.getItem(SCENE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = normalizeSceneSnapshotPayload(parsed);
        if (!normalized) {
          return false;
        }
        activeLevelId = normalized.levelId;
        railLoopSizeX = normalized.railLoopSizeX;
        railLoopSizeY = normalized.railLoopSizeY;
        const sceneData = {
          blocks: normalized.blocks,
          rails: normalized.rails,
        };
        editor.loadJSON(sceneData);
        buildManager.loadFromLevel({ blocks: normalized.buildTargetBlocks });
        railEditor.loadData(sceneData.rails);
        trackController.setRailLayout(railEditor.exportData());
        minecart.setSpeed(normalized.minecartSpeed);
        inventoryZoneX = normalized.inventoryPosition.x;
        inventoryZoneZ = normalized.inventoryPosition.z;
        inventorySpinAngleDeg = normalizeSpinAngleDeg(normalized.inventorySpinAngleDeg);
        if (normalized.camera) {
          Object.assign(cameraDebugState, normalized.camera);
          applyCameraDebugState();
        }
        return true;
      }
    } catch (error) {
      console.warn('Failed to restore scene from localStorage', error);
    }

    try {
      for (const key of LEGACY_RAILS_STORAGE_KEYS) {
        const rawRails = localStorage.getItem(key);
        if (!rawRails) {
          continue;
        }
        const legacyRails = normalizeRails(JSON.parse(rawRails));
        if (legacyRails.length === 0) {
          continue;
        }
        const levelData = cloneLevelData(LEVELS_BY_ID.get(activeLevelId) || INITIAL_LEVEL_DATA);
        const sceneData = {
          blocks: normalizeBlocks(levelData.blocks),
          rails: legacyRails,
        };
        editor.loadJSON(sceneData);
        buildManager.loadFromLevel(sceneData);
        railEditor.loadData(sceneData.rails);
        trackController.setRailLayout(railEditor.exportData());
        minecart.setSpeed(levelData.minecartSpeed);
        return true;
      }
    } catch (error) {
      console.warn('Failed to restore legacy rails from localStorage', error);
    }

    return false;
  }

  const railEditor = new RailDebugEditor({
    scene,
    camera,
    canvas,
    baseY: trackController.pathY,
    onChange: handleRailLayoutChange,
  });
  if (!restoreSceneLayout()) {
    const storedLevelId = getStoredActiveLevelId();
    if (storedLevelId) {
      activeLevelId = storedLevelId;
    }
    const levelData = cloneLevelData(LEVELS_BY_ID.get(activeLevelId) || INITIAL_LEVEL_DATA);
    const levelRails = normalizeRails(levelData.rails);
    const sceneData = {
      blocks: normalizeBlocks(levelData.blocks),
      rails: levelRails.length > 0 ? levelRails : getDefaultUserRails(),
    };
    editor.loadJSON(sceneData);
    buildManager.loadFromLevel({ blocks: normalizeBlocks(levelData.blocks) });
    railEditor.loadData(sceneData.rails);
    trackController.setRailLayout(railEditor.exportData());
    minecart.setSpeed(levelData.minecartSpeed);
    if (levelData.camera) {
      const levelCamera = normalizeCameraSettings(levelData.camera);
      if (levelCamera) {
        Object.assign(cameraDebugState, levelCamera);
        applyCameraDebugState();
      }
    }
  }
  minecart.snapToNearestPoint(new THREE.Vector3(9.8, trackController.pathY, 0));
  ensureDoorModelLoading();
  removeDoorShowcase(scene);
  ensureDoorShowcaseNearMinecart(scene, minecart);

  let activeBlockId = null;
  const FRONT_SLOT_COUNT = 3;
  const FRONT_SLOT_SPACING = 2.55;
  const FRONT_SLOT_Z = -9.8;
  const BACK_COLS = 3;
  const BACK_COL_SPACING = 2.35;
  const BACK_ROW_SPACING = 2.35;
  const BACK_START_Z = FRONT_SLOT_Z - 2.35;
  const inventoryFrontSlots = new Array(FRONT_SLOT_COUNT).fill(null);
  let inventoryBackSlots = [];
  let pendingBackToFrontId = null;
  let pendingBackToFrontSlot = -1;
  let pendingClickBlockId = null;
  let pendingQueueLayoutRefresh = false;

  function getInventoryZone(id) {
    if (inventoryFrontSlots.includes(id)) {
      return 'front';
    }
    if (inventoryBackSlots.includes(id)) {
      return 'back';
    }
    return 'hidden';
  }

  function getFirstFreeFrontSlotIndex() {
    for (let i = 0; i < inventoryFrontSlots.length; i += 1) {
      if (!inventoryFrontSlots[i]) {
        return i;
      }
    }
    return -1;
  }

  function findBackSlotIndexById(id) {
    for (let i = 0; i < inventoryBackSlots.length; i += 1) {
      if (inventoryBackSlots[i] === id) {
        return i;
      }
    }
    return -1;
  }

  function allocateBackSlotForId(id) {
    const existingIndex = findBackSlotIndexById(id);
    if (existingIndex >= 0) {
      return existingIndex;
    }
    for (let i = 0; i < inventoryBackSlots.length; i += 1) {
      if (!inventoryBackSlots[i]) {
        inventoryBackSlots[i] = id;
        return i;
      }
    }
    inventoryBackSlots.push(id);
    return inventoryBackSlots.length - 1;
  }

  function removeIdFromInventoryZones(id) {
    for (let i = 0; i < inventoryFrontSlots.length; i += 1) {
      if (inventoryFrontSlots[i] === id) {
        inventoryFrontSlots[i] = null;
      }
    }
    const backIndex = findBackSlotIndexById(id);
    if (backIndex >= 0) {
      inventoryBackSlots[backIndex] = null;
    }
  }

  function applyInventoryQueueLayout() {
    const layoutItems = [];
    const frontCenter = (FRONT_SLOT_COUNT - 1) * 0.5;
    for (let i = 0; i < FRONT_SLOT_COUNT; i += 1) {
      const id = inventoryFrontSlots[i];
      if (!id) {
        continue;
      }
      layoutItems.push({
        id,
        x: (i - frontCenter) * FRONT_SLOT_SPACING,
        z: FRONT_SLOT_Z,
        visible: true,
      });
    }

    for (let index = 0; index < inventoryBackSlots.length; index += 1) {
      const id = inventoryBackSlots[index];
      if (!id) {
        continue;
      }
      const row = Math.floor(index / BACK_COLS);
      const col = index % BACK_COLS;
      const colCenter = (BACK_COLS - 1) * 0.5;
      layoutItems.push({
        id,
        x: (col - colCenter) * BACK_COL_SPACING,
        z: BACK_START_Z - (row * BACK_ROW_SPACING),
        visible: true,
      });
    }

    worldInventory.setQueueLayout(layoutItems);
    syncInventoryAnchors();
  }

  function syncInventoryQueueState(activeIdsOrdered) {
    const activeIds = Array.isArray(activeIdsOrdered) ? activeIdsOrdered.slice() : [];
    const activeSet = new Set(activeIds);

    const seenFront = new Set();
    for (let i = 0; i < inventoryFrontSlots.length; i += 1) {
      const id = inventoryFrontSlots[i];
      const controller = id ? blocks.get(id) : null;
      const isValid = Boolean(
        id
          && !seenFront.has(id)
          && activeSet.has(id)
          && controller
          && controller.getCount() > 0,
      );
      if (!isValid) {
        inventoryFrontSlots[i] = null;
      } else {
        seenFront.add(id);
      }
    }

    for (let i = 0; i < inventoryBackSlots.length; i += 1) {
      const id = inventoryBackSlots[i];
      if (!id) {
        continue;
      }
      const isValid = (
        !seenFront.has(id)
        && activeSet.has(id)
        && blocks.has(id)
        && blocks.get(id).getCount() > 0
      );
      if (!isValid) {
        inventoryBackSlots[i] = null;
      }
    }

    for (const id of activeIds) {
      if (pendingBackToFrontId && id === pendingBackToFrontId) {
        continue;
      }
      if (seenFront.has(id) || findBackSlotIndexById(id) >= 0) {
        continue;
      }
      allocateBackSlotForId(id);
    }

    if (pendingBackToFrontId && !activeSet.has(pendingBackToFrontId)) {
      pendingBackToFrontId = null;
      pendingBackToFrontSlot = -1;
    }
  }

  function handleSlotClick(id) {
    if (editor.isEnabled()) {
      return;
    }

    const controller = blocks.get(id);
    if (!controller) {
      return;
    }

    const zone = getInventoryZone(id);
    if (zone !== 'front' && zone !== 'back') {
      controller.triggerUnavailableFeedback();
      return;
    }
    if (zone === 'back' && getFirstFreeFrontSlotIndex() < 0) {
      controller.triggerUnavailableFeedback();
      return;
    }
    if (activeBlockId !== null || minecart.isMoving()) {
      pendingClickBlockId = id;
      return;
    }
    if (!controller.canStartCycle()) {
      controller.triggerUnavailableFeedback();
      return;
    }

    const started = controller.startCycle();
    if (!started) {
      return;
    }

    if (zone === 'back') {
      const freeFrontSlot = getFirstFreeFrontSlotIndex();
      if (freeFrontSlot >= 0) {
        pendingBackToFrontId = id;
        pendingBackToFrontSlot = freeFrontSlot;
      }
    }

    activeBlockId = id;
    pendingClickBlockId = null;
    refreshUiLockState();
  }

  function handleCountChange(id, count) {
    worldInventory.setCount(id, count);
  }

  function handleCycleFinish(id) {
    if (activeBlockId === id) {
      activeBlockId = null;
    }
    if (pendingBackToFrontId === id && pendingBackToFrontSlot >= 0) {
      const slotIndex = pendingBackToFrontSlot;
      const backIndex = findBackSlotIndexById(id);
      if (backIndex >= 0) {
        inventoryBackSlots[backIndex] = null;
      }
      if (slotIndex < inventoryFrontSlots.length && !inventoryFrontSlots[slotIndex]) {
        inventoryFrontSlots[slotIndex] = id;
      }
      pendingBackToFrontId = null;
      pendingBackToFrontSlot = -1;
    }
    if (pendingQueueLayoutRefresh) {
      pendingQueueLayoutRefresh = false;
    }
    applyInventoryQueueLayout();
    refreshUiLockState();
    if (pendingClickBlockId) {
      const queuedId = pendingClickBlockId;
      pendingClickBlockId = null;
      handleSlotClick(queuedId);
    }
  }

  function getLevelCountsByType() {
    return buildManager.getSlotTypeCounts();
  }

  const worldInventory = new WorldInventoryController(scene, camera, BLOCK_CONFIGS);
  worldInventory.setGroupPosition(inventoryZoneX, inventoryZoneZ);
  const blocks = new Map();
  const initialCountsByType = getLevelCountsByType();

  function syncInventoryAnchors() {
    if (activeBlockId !== null) {
      return;
    }
    for (const [id, controller] of blocks.entries()) {
      if (!controller) {
        continue;
      }
      const anchor = worldInventory.getSlotAnchor(id);
      if (!anchor) {
        continue;
      }
      controller.setUiAnchor(anchor);
    }
  }

  function applyInventorySpinAngle() {
    worldInventory.setGroupYawDeg(inventorySpinAngleDeg);
    syncInventoryAnchors();
  }

  for (const config of BLOCK_CONFIGS) {
    const controller = new BlockController({
      scene,
      minecartController: minecart,
      buildManager,
      id: config.id,
      type: config.type,
      textureKey: config.textureKey,
      color: config.color,
      count: initialCountsByType[config.id] || 0,
      onCountChange: handleCountChange,
      onCycleFinish: handleCycleFinish,
      onReplaceMesh: (oldMesh, nextMesh) => worldInventory.replaceCarrierMesh(config.id, oldMesh, nextMesh),
    });

    const anchor = worldInventory.getSlotAnchor(config.id);
    if (anchor) {
      controller.setUiAnchor(anchor);
    }
    worldInventory.registerCarrierMesh(config.id, controller.mesh);
    blocks.set(config.id, controller);
  }
  worldInventory.setVisibleSlots(
    BLOCK_CONFIGS
      .map((config) => config.id)
      .filter((id) => (initialCountsByType[id] || 0) > 0),
  );
  syncInventoryAnchors();
  applyInventorySpinAngle();
  let lastBuiltCount = buildManager.getBuiltCount();

  function syncBlockCountsFromLevel() {
    const activeQueue = buildManager.getCurrentLayerQueue();
    const statsByType = buildManager.getSlotInventoryStats();
    const activeIdsOrdered = activeQueue
      .map((entry) => entry.id)
      .filter((id) => {
        const stat = statsByType[id];
        return Boolean(stat) && stat.count > 0;
      });
    for (const controller of blocks.values()) {
      const stat = statsByType[controller.id] || null;
      const count = stat ? stat.count : 0;
      if (stat) {
        controller.setAppearance(stat.type || controller.type, stat.textureKey);
      }
      controller.setCount(count);
      if (count <= 0) {
        removeIdFromInventoryZones(controller.id);
      }
    }
    syncInventoryQueueState(activeIdsOrdered);
    if (activeBlockId !== null || minecart.isMoving()) {
      pendingQueueLayoutRefresh = true;
    } else {
      pendingQueueLayoutRefresh = false;
      applyInventoryQueueLayout();
    }
    lastBuiltCount = buildManager.getBuiltCount();
  }

  function refreshUiLockState() {
    worldInventory.setCycleLock(activeBlockId);
    const frontIsFull = getFirstFreeFrontSlotIndex() < 0;

    for (const [id, controller] of blocks.entries()) {
      const zone = getInventoryZone(id);
      const disabled = controller.getCount() <= 0
        || zone === 'hidden'
        || (zone === 'back' && frontIsFull)
        || (activeBlockId !== null && activeBlockId !== id);
      worldInventory.setDisabled(id, disabled);
      worldInventory.setCount(id, controller.getCount());
    }
  }

  function flushPendingClick() {
    if (!pendingClickBlockId || editor.isEnabled()) {
      return;
    }
    if (activeBlockId !== null || minecart.isMoving()) {
      return;
    }
    const queuedId = pendingClickBlockId;
    pendingClickBlockId = null;
    handleSlotClick(queuedId);
  }

  function refreshDoorCarrierMeshes() {
    for (const controller of blocks.values()) {
      if (!controller || controller.type !== 'door') {
        continue;
      }
      controller.rebuildMeshes();
    }
  }

  function bindDebugEditorUI() {
    const enabledInput = document.getElementById('editor-enabled');
    const shapeSelectHost = document.getElementById('editor-shape-select');
    const propsSelectHost = document.getElementById('editor-props-select');
    const textureSelectHost = document.getElementById('editor-texture-select');
    const blockRotYSelect = document.getElementById('editor-rot-y');
    const inventorySpinAngleInput = document.getElementById('inventory-spin-angle');
    const inventoryZoneXInput = document.getElementById('inventory-zone-x');
    const inventoryZoneZInput = document.getElementById('inventory-zone-z');
    const levelSelect = document.getElementById('level-select');
    const levelLoadBtn = document.getElementById('level-load');
    const levelSaveFileBtn = document.getElementById('level-save-file');
    const levelOpenFileBtn = document.getElementById('level-open-file');
    const levelFileInput = document.getElementById('level-file-input');
    const clearBuildingBtn = document.getElementById('editor-clear-building');
    const railEnabledInput = document.getElementById('rail-enabled');
    const railTypeSelect = document.getElementById('rail-type');
    const railRotSelect = document.getElementById('rail-rot');
    const railRingSizeXSelect = document.getElementById('rail-ring-size-x');
    const railRingSizeYSelect = document.getElementById('rail-ring-size-y');
    const minecartSpeedInput = document.getElementById('minecart-speed');
    const railClearBtn = document.getElementById('rail-clear');
    const railAutoBtn = document.getElementById('rail-auto');
    const sceneExportFileBtn = document.getElementById('scene-export-file');
    const sceneImportFileBtn = document.getElementById('scene-import-file');
    const sceneFileInput = document.getElementById('scene-file-input');
    const doorOffsetXInput = document.getElementById('door-offset-x');
    const doorLiftYInput = document.getElementById('door-lift-y');
    const doorWidthInput = document.getElementById('door-width');
    const doorHeightInput = document.getElementById('door-height');
    const doorThicknessInput = document.getElementById('door-thickness');
    const cameraFlyEnabledInput = document.getElementById('cam-fly-enabled');
    const cameraLookAtEnabledInput = document.getElementById('cam-lookat-enabled');
    const cameraPosXInput = document.getElementById('cam-pos-x');
    const cameraPosYInput = document.getElementById('cam-pos-y');
    const cameraPosZInput = document.getElementById('cam-pos-z');
    const cameraRotXInput = document.getElementById('cam-rot-x');
    const cameraRotYInput = document.getElementById('cam-rot-y');
    const cameraRotZInput = document.getElementById('cam-rot-z');
    const cameraTargetXInput = document.getElementById('cam-target-x');
    const cameraTargetYInput = document.getElementById('cam-target-y');
    const cameraTargetZInput = document.getElementById('cam-target-z');
    const cameraFovInput = document.getElementById('cam-fov');
    const cameraNearInput = document.getElementById('cam-near');
    const cameraFarInput = document.getElementById('cam-far');
    const cameraZoomInput = document.getElementById('cam-zoom');
    const cameraFocusInput = document.getElementById('cam-focus');
    const cameraFilmGaugeInput = document.getElementById('cam-film-gauge');
    const cameraFilmOffsetInput = document.getElementById('cam-film-offset');
    const cameraResetBtn = document.getElementById('cam-reset');
    let shapeDropdownApi = null;
    let propsDropdownApi = null;
    let textureDropdownApi = null;
    const BLOCK_NONE_VALUE = '__none_block__';
    const PROP_NONE_VALUE = '__none_prop__';

    function createPreviewSelect(root, options, initialValue, onChange) {
      if (!root) {
        return {
          setValue() {},
          getValue() { return initialValue; },
        };
      }
      let selectedValue = initialValue;
      root.innerHTML = '';
      root.classList.remove('is-open');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'debug-preview-toggle';

      const toggleThumb = document.createElement('span');
      toggleThumb.className = 'debug-preview-thumb';
      const toggleLabel = document.createElement('span');
      const toggleCaret = document.createElement('span');
      toggleCaret.className = 'debug-preview-caret';
      toggleCaret.textContent = '▼';
      toggle.appendChild(toggleThumb);
      toggle.appendChild(toggleLabel);
      toggle.appendChild(toggleCaret);

      const menu = document.createElement('div');
      menu.className = 'debug-preview-menu';
      root.appendChild(toggle);
      root.appendChild(menu);

      function applyThumb(thumb, option) {
        thumb.className = 'debug-preview-thumb';
        if (option.shapeClass) {
          thumb.classList.add(option.shapeClass);
        }
        thumb.style.backgroundImage = option.previewSrc ? `url("${option.previewSrc}")` : '';
      }

      function renderMenu() {
        menu.innerHTML = '';
        for (const option of options) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'debug-preview-option';
          if (option.value === selectedValue) {
            btn.classList.add('is-active');
          }
          const thumb = document.createElement('span');
          applyThumb(thumb, option);
          const label = document.createElement('span');
          label.textContent = option.label;
          btn.appendChild(thumb);
          btn.appendChild(label);
          btn.addEventListener('click', () => {
            selectedValue = option.value;
            renderToggle();
            renderMenu();
            root.classList.remove('is-open');
            if (onChange) {
              onChange(selectedValue);
            }
          });
          menu.appendChild(btn);
        }
      }

      function renderToggle() {
        const option = options.find((item) => item.value === selectedValue) || options[0];
        if (!option) {
          return;
        }
        selectedValue = option.value;
        applyThumb(toggleThumb, option);
        toggleLabel.textContent = option.label;
      }

      toggle.addEventListener('click', () => {
        root.classList.toggle('is-open');
      });
      document.addEventListener('click', (event) => {
        if (!root.contains(event.target)) {
          root.classList.remove('is-open');
        }
      });

      renderToggle();
      renderMenu();
      return {
        setValue(value) {
          const hasValue = options.some((option) => option.value === value);
          selectedValue = hasValue ? value : (options[0] ? options[0].value : value);
          renderToggle();
          renderMenu();
        },
        getValue() {
          return selectedValue;
        },
      };
    }

    function populateLevelSelect() {
      if (!levelSelect) {
        return;
      }
      levelSelect.innerHTML = '';
      const visibleLevels = LEVEL_CATALOG.filter(isProjectLevel);
      const levelsToRender = visibleLevels.length > 0 ? visibleLevels : LEVEL_CATALOG.filter((level) => level && level.id === FALLBACK_LEVEL_DEF.id);
      for (const level of levelsToRender) {
        if (!level || !level.id) {
          continue;
        }
        const option = document.createElement('option');
        option.value = level.id;
        option.textContent = getProjectLevelLabel(level);
        levelSelect.appendChild(option);
      }
      levelSelect.value = activeLevelId;
    }

    function setCameraInputsFromState() {
      cameraFlyEnabledInput.checked = flyCamEnabled;
      cameraLookAtEnabledInput.checked = Boolean(cameraDebugState.useLookAt);
      cameraPosXInput.value = cameraDebugState.position.x.toFixed(3);
      cameraPosYInput.value = cameraDebugState.position.y.toFixed(3);
      cameraPosZInput.value = cameraDebugState.position.z.toFixed(3);
      cameraRotXInput.value = cameraDebugState.rotationDeg.x.toFixed(3);
      cameraRotYInput.value = cameraDebugState.rotationDeg.y.toFixed(3);
      cameraRotZInput.value = cameraDebugState.rotationDeg.z.toFixed(3);
      cameraTargetXInput.value = cameraDebugState.target.x.toFixed(3);
      cameraTargetYInput.value = cameraDebugState.target.y.toFixed(3);
      cameraTargetZInput.value = cameraDebugState.target.z.toFixed(3);
      cameraFovInput.value = cameraDebugState.fov.toFixed(3);
      cameraNearInput.value = cameraDebugState.near.toFixed(3);
      cameraFarInput.value = cameraDebugState.far.toFixed(3);
      cameraZoomInput.value = cameraDebugState.zoom.toFixed(3);
      cameraFocusInput.value = cameraDebugState.focus.toFixed(3);
      cameraFilmGaugeInput.value = cameraDebugState.filmGauge.toFixed(3);
      cameraFilmOffsetInput.value = cameraDebugState.filmOffset.toFixed(3);
    }

    function commitCameraFromInputs() {
      if (flyCamEnabled) {
        return;
      }
      cameraDebugState.useLookAt = Boolean(cameraLookAtEnabledInput.checked);
      cameraDebugState.position.x = toFiniteNumber(cameraPosXInput.value, cameraDebugState.position.x);
      cameraDebugState.position.y = toFiniteNumber(cameraPosYInput.value, cameraDebugState.position.y);
      cameraDebugState.position.z = toFiniteNumber(cameraPosZInput.value, cameraDebugState.position.z);
      cameraDebugState.rotationDeg.x = toFiniteNumber(cameraRotXInput.value, cameraDebugState.rotationDeg.x);
      cameraDebugState.rotationDeg.y = toFiniteNumber(cameraRotYInput.value, cameraDebugState.rotationDeg.y);
      cameraDebugState.rotationDeg.z = toFiniteNumber(cameraRotZInput.value, cameraDebugState.rotationDeg.z);
      cameraDebugState.target.x = toFiniteNumber(cameraTargetXInput.value, cameraDebugState.target.x);
      cameraDebugState.target.y = toFiniteNumber(cameraTargetYInput.value, cameraDebugState.target.y);
      cameraDebugState.target.z = toFiniteNumber(cameraTargetZInput.value, cameraDebugState.target.z);
      cameraDebugState.fov = toFiniteNumber(cameraFovInput.value, cameraDebugState.fov);
      cameraDebugState.near = toFiniteNumber(cameraNearInput.value, cameraDebugState.near);
      cameraDebugState.far = toFiniteNumber(cameraFarInput.value, cameraDebugState.far);
      cameraDebugState.zoom = toFiniteNumber(cameraZoomInput.value, cameraDebugState.zoom);
      cameraDebugState.focus = toFiniteNumber(cameraFocusInput.value, cameraDebugState.focus);
      cameraDebugState.filmGauge = toFiniteNumber(cameraFilmGaugeInput.value, cameraDebugState.filmGauge);
      cameraDebugState.filmOffset = toFiniteNumber(cameraFilmOffsetInput.value, cameraDebugState.filmOffset);
      applyCameraDebugState();
      setCameraInputsFromState();
      saveSceneLayout();
    }

    function setDoorInputsFromState() {
      if (doorOffsetXInput) {
        doorOffsetXInput.value = DOOR_DIMENSIONS.offsetX.toFixed(3);
      }
      if (doorLiftYInput) {
        doorLiftYInput.value = DOOR_DIMENSIONS.liftY.toFixed(3);
      }
      if (doorWidthInput) {
        doorWidthInput.value = DOOR_DIMENSIONS.width.toFixed(3);
      }
      if (doorHeightInput) {
        doorHeightInput.value = DOOR_DIMENSIONS.height.toFixed(3);
      }
      if (doorThicknessInput) {
        doorThicknessInput.value = DOOR_DIMENSIONS.thickness.toFixed(3);
      }
    }

    function commitDoorFromInputs() {
      DOOR_DIMENSIONS.offsetX = toFiniteNumber(doorOffsetXInput && doorOffsetXInput.value, DOOR_DIMENSIONS.offsetX);
      DOOR_DIMENSIONS.liftY = toFiniteNumber(doorLiftYInput && doorLiftYInput.value, DOOR_DIMENSIONS.liftY);
      DOOR_DIMENSIONS.width = Math.max(0.02, toFiniteNumber(doorWidthInput && doorWidthInput.value, DOOR_DIMENSIONS.width));
      DOOR_DIMENSIONS.height = Math.max(0.1, toFiniteNumber(doorHeightInput && doorHeightInput.value, DOOR_DIMENSIONS.height));
      DOOR_DIMENSIONS.thickness = Math.max(0.02, toFiniteNumber(doorThicknessInput && doorThicknessInput.value, DOOR_DIMENSIONS.thickness));
      setDoorInputsFromState();
      editor.refreshDoorMeshes();
      refreshDoorCarrierMeshes();
      saveSceneLayout();
    }

    function loadSelectedLevel(levelId) {
      const levelData = cloneLevelData(LEVELS_BY_ID.get(levelId) || INITIAL_LEVEL_DATA);
      activeLevelId = levelData.id;
      const levelRails = normalizeRails(levelData.rails);

      const sceneData = {
        blocks: normalizeBlocks(levelData.blocks),
        rails: levelRails.length > 0 ? levelRails : getDefaultUserRails({ x: railLoopSizeX, y: railLoopSizeY }),
      };
      editor.loadJSON(sceneData);
      buildManager.loadFromLevel({ blocks: sceneData.blocks });
      railEditor.loadData(sceneData.rails);
      trackController.setRailLayout(railEditor.exportData());
      minecart.setSpeed(levelData.minecartSpeed);
      minecartSpeedInput.value = String(minecart.getSpeed());

      if (levelData.camera) {
        const levelCamera = normalizeCameraSettings(levelData.camera);
        if (levelCamera) {
          Object.assign(cameraDebugState, levelCamera);
          applyCameraDebugState();
          setCameraInputsFromState();
        }
      }

      minecart.snapToNearestPoint(new THREE.Vector3(9.8, trackController.pathY, 0));
      syncBlockCountsFromLevel();
      refreshUiLockState();
      saveSceneLayout();
      if (levelSelect) {
        levelSelect.value = activeLevelId;
      }
    }

    function applySceneSnapshotToRuntime(snapshot, options) {
      const normalized = normalizeSceneSnapshotPayload(snapshot);
      if (!normalized) {
        return false;
      }
      activeLevelId = normalized.levelId;
      const sceneData = {
        blocks: normalized.blocks,
        rails: normalized.rails,
      };
      railLoopSizeX = normalized.railLoopSizeX;
      railLoopSizeY = normalized.railLoopSizeY;
      if (railRingSizeXSelect) {
        railRingSizeXSelect.value = railLoopSizeX;
      }
      if (railRingSizeYSelect) {
        railRingSizeYSelect.value = railLoopSizeY;
      }
      editor.loadJSON(sceneData);
      buildManager.loadFromLevel({ blocks: normalized.buildTargetBlocks });
      railEditor.loadData(sceneData.rails);
      trackController.setRailLayout(railEditor.exportData());
      minecart.setSpeed(normalized.minecartSpeed);
      minecartSpeedInput.value = String(minecart.getSpeed());
      inventoryZoneX = normalized.inventoryPosition.x;
      inventoryZoneZ = normalized.inventoryPosition.z;
      worldInventory.setGroupPosition(inventoryZoneX, inventoryZoneZ);
      inventorySpinAngleDeg = normalizeSpinAngleDeg(normalized.inventorySpinAngleDeg);
      applyInventorySpinAngle();
      syncInventoryAnchors();
      if (inventorySpinAngleInput) {
        inventorySpinAngleInput.value = String(inventorySpinAngleDeg);
      }
      const inventoryZoneXInput = document.getElementById('inventory-zone-x');
      const inventoryZoneZInput = document.getElementById('inventory-zone-z');
      if (inventoryZoneXInput) {
        inventoryZoneXInput.value = inventoryZoneX.toFixed(2);
      }
      if (inventoryZoneZInput) {
        inventoryZoneZInput.value = inventoryZoneZ.toFixed(2);
      }
      if (normalized.camera) {
        Object.assign(cameraDebugState, normalized.camera);
        applyCameraDebugState();
        setCameraInputsFromState();
      }
      minecart.snapToNearestPoint(new THREE.Vector3(9.8, trackController.pathY, 0));
      syncBlockCountsFromLevel();
      refreshUiLockState();
      if (!options || options.persist !== false) {
        saveSceneLayout();
      }
      if (levelSelect) {
        levelSelect.value = activeLevelId;
      }
      return true;
    }

    function buildCurrentLevelPayload() {
      const current = LEVELS_BY_ID.get(activeLevelId);
      const resolvedName = current && current.name
        ? String(current.name).trim()
        : String(activeLevelId || '').trim();
      const safeName = resolvedName || getNextIncrementalLevelName();
      const stableId = activeLevelId && LEVELS_BY_ID.has(activeLevelId)
        ? activeLevelId
        : toSlug(safeName, 'new_level');
      return {
        id: stableId,
        name: safeName,
        blocks: getEditorBlocksSnapshot(),
        rails: normalizeRails(railEditor.exportData()),
        minecart: { speed: minecart.getSpeed() },
        camera: exportCameraDebugState(),
      };
    }

    enabledInput.addEventListener('change', () => {
      editor.setEnabled(enabledInput.checked);
    });
    if (inventoryMoveEnabledInput) {
      inventoryMoveEnabledInput.checked = inventoryMoveEnabled;
      inventoryMoveEnabledInput.addEventListener('change', () => {
        inventoryMoveEnabled = Boolean(inventoryMoveEnabledInput.checked);
        if (!inventoryMoveEnabled) {
          draggingInventory = false;
        }
      });
    }
    if (inventorySpinAngleInput) {
      inventorySpinAngleInput.value = String(inventorySpinAngleDeg);
      inventorySpinAngleInput.addEventListener('input', () => {
        inventorySpinAngleDeg = normalizeSpinAngleDeg(inventorySpinAngleInput.value);
        inventorySpinAngleInput.value = String(inventorySpinAngleDeg);
        applyInventorySpinAngle();
        saveSceneLayout();
      });
      inventorySpinAngleInput.addEventListener('change', () => {
        inventorySpinAngleDeg = normalizeSpinAngleDeg(inventorySpinAngleInput.value);
        inventorySpinAngleInput.value = String(inventorySpinAngleDeg);
        applyInventorySpinAngle();
        saveSceneLayout();
      });
    }
    function syncInventoryZoneInputs() {
      if (inventoryZoneXInput) {
        inventoryZoneXInput.value = inventoryZoneX.toFixed(2);
      }
      if (inventoryZoneZInput) {
        inventoryZoneZInput.value = inventoryZoneZ.toFixed(2);
      }
    }
    function applyInventoryZonePosition() {
      worldInventory.setGroupPosition(inventoryZoneX, inventoryZoneZ);
      syncInventoryAnchors();
    }
    syncInventoryZoneInputs();
    if (inventoryZoneXInput) {
      inventoryZoneXInput.addEventListener('input', () => {
        inventoryZoneX = toFiniteNumber(inventoryZoneXInput.value, inventoryZoneX);
        applyInventoryZonePosition();
        syncInventoryZoneInputs();
        saveSceneLayout();
      });
      inventoryZoneXInput.addEventListener('change', () => {
        inventoryZoneX = toFiniteNumber(inventoryZoneXInput.value, inventoryZoneX);
        applyInventoryZonePosition();
        syncInventoryZoneInputs();
        saveSceneLayout();
      });
    }
    if (inventoryZoneZInput) {
      inventoryZoneZInput.addEventListener('input', () => {
        inventoryZoneZ = toFiniteNumber(inventoryZoneZInput.value, inventoryZoneZ);
        applyInventoryZonePosition();
        syncInventoryZoneInputs();
        saveSceneLayout();
      });
      inventoryZoneZInput.addEventListener('change', () => {
        inventoryZoneZ = toFiniteNumber(inventoryZoneZInput.value, inventoryZoneZ);
        applyInventoryZonePosition();
        syncInventoryZoneInputs();
        saveSceneLayout();
      });
    }

    if (levelLoadBtn && levelSelect) {
      levelLoadBtn.addEventListener('click', () => {
        if (activeBlockId !== null) {
          window.alert('Finish active block cycle first, then load another level.');
          return;
        }
        loadSelectedLevel(levelSelect.value);
      });
    }
    if (levelSelect) {
      levelSelect.addEventListener('change', () => {
        if (activeBlockId !== null) {
          return;
        }
        loadSelectedLevel(levelSelect.value);
      });
    }

    if (levelSaveFileBtn) {
      levelSaveFileBtn.addEventListener('click', async () => {
        const payload = buildCurrentLevelPayload();
        activeLevelId = payload.id;
        upsertRuntimeLevel(payload);
        populateLevelSelect();
        if (levelSelect) {
          levelSelect.value = activeLevelId;
        }
        const moduleText = [
          '(function () {',
          `  window.registerMinecraftLevel(${JSON.stringify(payload, null, 2)});`,
          '})();',
        ].join('\n');
        const filename = 'finder.js';
        await saveTextToFile(filename, moduleText, 'text/javascript;charset=utf-8', ['.js']);
        saveSceneLayout();
      });
    }

    if (levelOpenFileBtn && levelFileInput) {
      levelOpenFileBtn.addEventListener('click', () => {
        levelFileInput.value = '';
        levelFileInput.click();
      });
      levelFileInput.addEventListener('change', async () => {
        const file = levelFileInput.files && levelFileInput.files[0];
        if (!file) {
          return;
        }
        try {
          const raw = await file.text();
          const parsed = parseLevelFileData(raw);
          const filenameLevelName = levelNameFromFilename(file.name);
          const fallbackName = filenameLevelName || getNextIncrementalLevelName();
          const fallbackId = toSlug(fallbackName, `imported_level_${makeTimestampTag()}`);
          const normalized = normalizeLevelPayload(parsed, fallbackId);
          if (!normalized || normalized.blocks.length === 0) {
            window.alert('Level file is invalid or has no valid blocks.');
            return;
          }
          normalized.id = fallbackId;
          normalized.name = fallbackName;
          const upserted = upsertRuntimeLevel(normalized);
          if (!upserted) {
            window.alert('Failed to import level file.');
            return;
          }
          populateLevelSelect();
          loadSelectedLevel(upserted.id);
          window.alert(`Level imported: ${upserted.id}`);
        } catch (error) {
          console.warn('Failed to import level file', error);
          window.alert(`Failed to import level file.\nReason: ${error && error.message ? error.message : 'Unknown error'}`);
        } finally {
          levelFileInput.value = '';
        }
      });
    }

    if (blockRotYSelect) {
      blockRotYSelect.addEventListener('change', () => {
        const rotationDeg = normalizeBlockRotationDeg(blockRotYSelect.value);
        blockRotYSelect.value = String(rotationDeg);
        editor.setRotationDeg(rotationDeg);
      });
    }
    if (clearBuildingBtn) {
      clearBuildingBtn.addEventListener('click', () => {
        if (activeBlockId !== null) {
          window.alert('Finish active block cycle first, then clear building.');
          return;
        }
        editor.clear();
      });
    }

    railEnabledInput.addEventListener('change', () => {
      railEditor.setEnabled(railEnabledInput.checked);
    });
    railTypeSelect.addEventListener('change', () => {
      railEditor.setType(railTypeSelect.value);
    });
    railRotSelect.addEventListener('change', () => {
      railEditor.setRotationDeg(Number(railRotSelect.value));
    });
    if (railRingSizeXSelect) {
      railRingSizeXSelect.addEventListener('change', () => {
        railLoopSizeX = normalizeRailLoopSizeValue(railRingSizeXSelect.value);
        railRingSizeXSelect.value = railLoopSizeX;
        saveSceneLayout();
      });
    }
    if (railRingSizeYSelect) {
      railRingSizeYSelect.addEventListener('change', () => {
        railLoopSizeY = normalizeRailLoopSizeValue(railRingSizeYSelect.value);
        railRingSizeYSelect.value = railLoopSizeY;
        saveSceneLayout();
      });
    }
    minecartSpeedInput.addEventListener('change', () => {
      const speed = Number(minecartSpeedInput.value);
      minecart.setSpeed(speed);
      minecartSpeedInput.value = String(minecart.getSpeed());
      saveSceneLayout();
    });
    railClearBtn.addEventListener('click', () => {
      railEditor.clear();
    });
    railAutoBtn.addEventListener('click', () => {
      autoPlaceRails();
    });
    if (sceneExportFileBtn) {
      sceneExportFileBtn.addEventListener('click', async () => {
        const snapshot = getCurrentSceneSnapshot();
        const text = JSON.stringify(snapshot, null, 2);
        const filename = `scene_${toSlug(snapshot.levelId, 'level')}_${makeTimestampTag()}.json`;
        await saveTextToFile(filename, text, 'application/json;charset=utf-8', ['.json']);
      });
    }

    if (sceneImportFileBtn && sceneFileInput) {
      sceneImportFileBtn.addEventListener('click', () => {
        sceneFileInput.value = '';
        sceneFileInput.click();
      });
      sceneFileInput.addEventListener('change', async () => {
        const file = sceneFileInput.files && sceneFileInput.files[0];
        if (!file) {
          return;
        }
        try {
          const raw = await file.text();
          const parsed = parseJsonLoose(raw);
          if (activeBlockId !== null) {
            window.alert('Finish active block cycle first, then import scene.');
            return;
          }
          const applied = applySceneSnapshotToRuntime(parsed);
          if (!applied) {
            window.alert('Invalid scene file.');
            return;
          }
          window.alert('Scene imported.');
        } catch (error) {
          console.warn('Failed to import scene file', error);
          window.alert(`Failed to import scene file.\nReason: ${error && error.message ? error.message : 'Unknown error'}`);
        } finally {
          sceneFileInput.value = '';
        }
      });
    }

    setDoorInputsFromState();
    for (const input of [
      doorOffsetXInput,
      doorLiftYInput,
      doorWidthInput,
      doorHeightInput,
      doorThicknessInput,
    ]) {
      if (!input) {
        continue;
      }
      input.addEventListener('input', commitDoorFromInputs);
      input.addEventListener('change', commitDoorFromInputs);
    }

    cameraFlyEnabledInput.addEventListener('change', () => {
      setFlyCamEnabled(cameraFlyEnabledInput.checked);
      setCameraInputsFromState();
    });
    for (const input of [
      cameraLookAtEnabledInput,
      cameraPosXInput,
      cameraPosYInput,
      cameraPosZInput,
      cameraRotXInput,
      cameraRotYInput,
      cameraRotZInput,
      cameraTargetXInput,
      cameraTargetYInput,
      cameraTargetZInput,
      cameraFovInput,
      cameraNearInput,
      cameraFarInput,
      cameraZoomInput,
      cameraFocusInput,
      cameraFilmGaugeInput,
      cameraFilmOffsetInput,
    ]) {
      input.addEventListener('input', commitCameraFromInputs);
      input.addEventListener('change', commitCameraFromInputs);
    }
    cameraResetBtn.addEventListener('click', () => {
      Object.assign(cameraDebugState, JSON.parse(JSON.stringify(DEFAULT_CAMERA_DEBUG)));
      applyCameraDebugState();
      setCameraInputsFromState();
      saveSceneLayout();
    });

    const shapeOptions = [{
      value: BLOCK_NONE_VALUE,
      label: 'None',
      shapeClass: 'shape-cube',
      previewSrc: '',
      blockType: '',
    }].concat(BLOCK_SHAPE_OPTIONS.map((option) => ({
      value: option.id,
      label: option.label,
      shapeClass: `shape-${option.shape}`,
      previewSrc: SHAPE_PREVIEW_TEXTURE_SOURCE,
      blockType: option.type,
    })));
    const propsOptions = [{
      value: PROP_NONE_VALUE,
      label: 'None',
      shapeClass: 'shape-cube',
      previewSrc: '',
      blockType: '',
    }].concat(PROP_EDITOR_OPTIONS.map((option) => ({
      value: option.id,
      label: option.label,
      shapeClass: `shape-${option.shape || 'cube'}`,
      previewSrc: resolveTexturePath(option.textureKey, option.fallbackTexture),
      blockType: option.type,
    })));
    const textureOptions = BLOCK_TEXTURE_KEYS.map((textureKey) => ({
      value: textureKey,
      label: textureKey,
      shapeClass: 'shape-cube',
      previewSrc: resolveTexturePath(textureKey, ''),
      textureKey,
    }));

    const initialShape = shapeOptions[1] ? shapeOptions[1].value : BLOCK_NONE_VALUE;
    const initialProp = PROP_NONE_VALUE;
    const initialTexture = textureOptions[0] ? textureOptions[0].value : EDITOR_TEXTURE_MODE_AUTO;

    shapeDropdownApi = createPreviewSelect(shapeSelectHost, shapeOptions, initialShape, (shapeId) => {
      if (shapeId === BLOCK_NONE_VALUE) {
        return;
      }
      const selected = shapeOptions.find((option) => option.value === shapeId);
      if (!selected) {
        return;
      }
      if (propsDropdownApi) {
        propsDropdownApi.setValue(PROP_NONE_VALUE);
      }
      editor.setType(selected.blockType || DEFAULT_BLOCK_ID);
    });
    if (propsOptions.length > 1) {
      propsDropdownApi = createPreviewSelect(propsSelectHost, propsOptions, initialProp, (propId) => {
        if (propId === PROP_NONE_VALUE) {
          return;
        }
        const selected = propsOptions.find((option) => option.value === propId);
        if (!selected) {
          return;
        }
        if (shapeDropdownApi) {
          shapeDropdownApi.setValue(BLOCK_NONE_VALUE);
        }
        if (textureDropdownApi) {
          textureDropdownApi.setValue(EDITOR_TEXTURE_MODE_AUTO);
        }
        editor.setTextureKey(EDITOR_TEXTURE_MODE_AUTO);
        editor.setType(selected.blockType || DEFAULT_BLOCK_ID);
      });
    } else {
      propsDropdownApi = {
        setValue() {},
        getValue() { return ''; },
      };
      if (propsSelectHost) {
        propsSelectHost.innerHTML = '';
      }
    }
    textureDropdownApi = createPreviewSelect(textureSelectHost, textureOptions, initialTexture, (textureKey) => {
      editor.setTextureKey(normalizeEditorTextureKey(textureKey));
    });

    populateLevelSelect();
    if (levelSelect) {
      levelSelect.value = activeLevelId;
    }
    const selectedShapeOption = shapeOptions.find((option) => option.value === shapeDropdownApi.getValue()) || null;
    const selectedPropOption = propsOptions.find((option) => option.value === propsDropdownApi.getValue()) || null;
    if (selectedPropOption && selectedPropOption.value !== PROP_NONE_VALUE) {
      editor.setType(selectedPropOption.blockType || DEFAULT_BLOCK_ID);
    } else if (selectedShapeOption && selectedShapeOption.value !== BLOCK_NONE_VALUE) {
      editor.setType(selectedShapeOption.blockType || DEFAULT_BLOCK_ID);
    } else {
      editor.setType(DEFAULT_BLOCK_ID);
    }
    const selectedTextureOption = textureOptions.find((option) => option.value === textureDropdownApi.getValue()) || null;
    editor.setTextureKey(selectedTextureOption ? selectedTextureOption.textureKey : EDITOR_TEXTURE_MODE_AUTO);
    if (blockRotYSelect) {
      blockRotYSelect.value = '0';
      editor.setRotationDeg(0);
    }
    editor.setLayer(0);
    railEditor.setType(railTypeSelect.value);
    railEditor.setRotationDeg(Number(railRotSelect.value));
    if (railRingSizeXSelect) {
      railRingSizeXSelect.value = railLoopSizeX;
    }
    if (railRingSizeYSelect) {
      railRingSizeYSelect.value = railLoopSizeY;
    }
    minecartSpeedInput.value = String(minecart.getSpeed());
    syncCameraInputsFromState = setCameraInputsFromState;
    setCameraInputsFromState();
  }

  function tryInventoryClick(event) {
    if (inventoryMoveEnabled) {
      return false;
    }
    const pickedId = worldInventory.pickBlockId(event.clientX, event.clientY, camera, canvas);
    if (!pickedId) {
      return false;
    }
    handleSlotClick(pickedId);
    return true;
  }

  function step(dt) {
    updateFlyCamera(dt);
    editor.update(dt);
    minecart.update(dt);
    removeDoorShowcase(scene);
    ensureDoorShowcaseNearMinecart(scene, minecart);
    for (const controller of blocks.values()) {
      controller.update(dt);
    }
    const builtCountNow = buildManager.getBuiltCount();
    if (builtCountNow !== lastBuiltCount) {
      lastBuiltCount = builtCountNow;
      syncBlockCountsFromLevel();
      refreshUiLockState();
    }
    if (pendingQueueLayoutRefresh && activeBlockId === null && !minecart.isMoving()) {
      pendingQueueLayoutRefresh = false;
      applyInventoryQueueLayout();
      refreshUiLockState();
    }
    flushPendingClick();

    renderer.render(scene, camera);
  }

  function getPointerPlanePoint(event, plane, target) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    inventoryDragRaycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    return inventoryDragRaycaster.ray.intersectPlane(plane, target);
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
  }

  window.render_game_to_text = function () {
    const payload = {
      axes: 'x right, z down-screen, y up',
      active_block: activeBlockId,
      editor: {
        enabled: editor.isEnabled(),
        placed_blocks: editor.cells.size,
      },
      level: {
        id: activeLevelId,
      },
      inventory: Array.from(blocks.entries()).map(([id, block]) => ({ id, count: block.getCount() })),
      build_progress: {
        built: buildManager.getBuiltCount(),
        total: buildManager.getTotalCount(),
      },
      camera: exportCameraDebugState(),
    };
    return JSON.stringify(payload);
  };

  window.advanceTime = function (ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      step(1 / 60);
    }
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (draggingInventory) {
      const hit = getPointerPlanePoint(event, inventoryDragPlane, inventoryDragPoint);
      if (hit) {
        inventoryZoneX = inventoryDragPoint.x + inventoryDragOffset.x;
        inventoryZoneZ = inventoryDragPoint.z + inventoryDragOffset.z;
        worldInventory.setGroupPosition(inventoryZoneX, inventoryZoneZ);
        const inventoryZoneXInput = document.getElementById('inventory-zone-x');
        const inventoryZoneZInput = document.getElementById('inventory-zone-z');
        if (inventoryZoneXInput) {
          inventoryZoneXInput.value = inventoryZoneX.toFixed(2);
        }
        if (inventoryZoneZInput) {
          inventoryZoneZInput.value = inventoryZoneZ.toFixed(2);
        }
        syncInventoryAnchors();
      }
      return;
    }
    if (flyCamEnabled && flyLookActive) {
      const sensitivity = 0.18;
      flyYawDeg -= event.movementX * sensitivity;
      flyPitchDeg -= event.movementY * sensitivity;
      flyPitchDeg = THREE.MathUtils.clamp(flyPitchDeg, -89, 89);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(flyPitchDeg * DEG_TO_RAD, flyYawDeg * DEG_TO_RAD, 0);
      syncCameraDebugFromCameraObject();
      if (typeof syncCameraInputsFromState === 'function') {
        syncCameraInputsFromState();
      }
      saveSceneLayout();
      return;
    }
    editor.updateHoverFromPointer(event);
    if (editor.isEnabled() && event.buttons === 2) {
      if (editor.removeAtEvent(event)) {
        saveSceneLayout();
      }
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (railEditor.isEnabled()) {
      if (event.button === 0) {
        railEditor.placeAtEvent(event);
      } else if (event.button === 2) {
        railEditor.removeAtEvent(event);
      }
      return;
    }
    if (event.button === 2 && editor.isEnabled()) {
      if (editor.removeAtEvent(event)) {
        saveSceneLayout();
      }
      return;
    }
    if (flyCamEnabled && event.button === 2) {
      flyLookActive = true;
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) {
      return;
    }

    if (inventoryMoveEnabled) {
      if (activeBlockId !== null) {
        window.alert('Finish active block cycle first, then move block zone.');
        return;
      }
      const inventoryHit = worldInventory.pickInventoryHit(event.clientX, event.clientY, camera, canvas);
      if (inventoryHit) {
        const hit = getPointerPlanePoint(event, inventoryDragPlane, inventoryDragPoint);
        if (hit) {
          const current = worldInventory.getGroupPosition(TEMP_C);
          inventoryDragOffset.set(current.x - inventoryDragPoint.x, 0, current.z - inventoryDragPoint.z);
          draggingInventory = true;
          canvas.setPointerCapture(event.pointerId);
        }
        return;
      }
    }

    if (!editor.isEnabled() && tryInventoryClick(event)) {
      return;
    }

    editor.updateHoverFromPointer(event);
    editor.placeAtHover();
    saveSceneLayout();
  });
  canvas.addEventListener('contextmenu', (event) => {
    if (railEditor.isEnabled() || editor.isEnabled() || flyCamEnabled) {
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button === 0 && draggingInventory) {
      draggingInventory = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      saveSceneLayout();
      return;
    }
    if (event.button === 2) {
      flyLookActive = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (flyCamEnabled && !isTextInputFocused() && setFlyMoveKey(event.code, true)) {
      event.preventDefault();
      return;
    }
    if (event.code !== 'Space' || event.repeat) {
      return;
    }
    event.preventDefault();
    uiHidden = !uiHidden;
    applyUiVisibility();
  });
  window.addEventListener('keyup', (event) => {
    if (flyCamEnabled && setFlyMoveKey(event.code, false)) {
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('blur', () => {
    flyLookActive = false;
    clearFlyMoveState();
  });

  syncBlockCountsFromLevel();
  refreshUiLockState();
  editor.onChange = handleEditorBlocksChange;
  applyUiVisibility();
  bindDebugEditorUI();
  animate();
})();
