(function () {
  const CARRIER_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
  const PIECE_GEOMETRY = new THREE.BoxGeometry(0.32, 0.32, 0.32);

  const TEMP_A = new THREE.Vector3();
  const TEMP_B = new THREE.Vector3();
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
      id: 'door',
      label: 'Door',
      shape: 'door',
      textureKey: 'wood',
      fallbackTexture: './assets/block/minecraft_oak_door_item.png',
      doorTopTextureKey: 'wood',
      doorBottomTextureKey: 'wood',
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
  const LEVEL_CATALOG = Array.isArray(window.MC_LEVELS) && window.MC_LEVELS.length > 0
    ? window.MC_LEVELS
    : [FALLBACK_LEVEL_DEF];
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
  const doorBlockDef = getBlockDefinition('door');
  const doorFallback = doorBlockDef ? doorBlockDef.fallbackTexture : './assets/block/minecraft_oak_door_item.png';
  const doorTopPath = resolveTexturePath(
    doorBlockDef ? doorBlockDef.doorTopTextureKey : 'doorTop',
    './assets/oak_door_top.png',
  ) || resolveTexturePath('door', doorFallback) || resolveTexturePath('wood', '');
  const doorBottomPath = resolveTexturePath(
    doorBlockDef ? doorBlockDef.doorBottomTextureKey : 'doorBottom',
    './assets/oak_door_bottom.png',
  ) || resolveTexturePath('door', doorFallback) || resolveTexturePath('wood', '');
  const DOOR_TEXTURES = {
    top: doorTopPath ? loadTexture(doorTopPath, { pixelated: true }) : (BLOCK_TEXTURES.wood || BLOCK_TEXTURES.stone),
    bottom: doorBottomPath
      ? loadTexture(doorBottomPath, { pixelated: true })
      : (BLOCK_TEXTURES.wood || BLOCK_TEXTURES.stone),
  };
  const DOOR_MODEL_PATH = './assets/minecraft_door.glb';
  const ENABLE_DOOR_GLB = true;
  const DOOR_MODEL_STATE = {
    template: null,
    unitHeight: 1,
    loading: false,
    failed: false,
  };

  function createOpaqueDoorMaterial(texture) {
    return new THREE.MeshStandardMaterial({
      map: texture || null,
      color: 0xd2a36f,
      roughness: 0.88,
      metalness: 0.04,
      transparent: false,
      alphaTest: 0.2,
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
            node.material = createOpaqueDoorMaterial(texture);
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

    const targetHeight = variant === 'piece'
      ? size
      : (variant === 'carrier' ? size * 0.92 : size * 0.98);
    const scale = targetHeight / Math.max(1e-6, DOOR_MODEL_STATE.unitHeight);

    const clone = DOOR_MODEL_STATE.template.clone(true);
    clone.scale.multiplyScalar(scale);
    clone.rotation.y = Math.PI * 0.5;
    return clone;
  }

  function createDoorPanelGeometry(width, height, thickness = 0.1) {
    return new THREE.BoxGeometry(
      Math.max(0.02, thickness),
      Math.max(0.02, height),
      Math.max(0.02, width),
    );
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
      const modelMesh = createDoorModelMesh(size, variant);
      if (modelMesh) {
        return modelMesh;
      }
      let mesh;
      if (variant === 'piece') {
        mesh = new THREE.Mesh(createDoorPanelGeometry(size * 0.58, size, size * 0.12), material);
      } else if (variant === 'carrier') {
        mesh = new THREE.Mesh(createDoorPanelGeometry(size * 0.62, size * 0.92, size * 0.14), material);
      } else {
        mesh = new THREE.Mesh(createDoorPanelGeometry(size * 0.68, size * 0.98, size * 0.16), material);
      }
      return mesh;
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
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          continue;
        }
        const key = `${x}:${y}:${z}`;
        if (unique.has(key)) {
          continue;
        }
        unique.add(key);
        this.slots.push({
          type,
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

    reserveNext(type, origin = null, forward = null) {
      let selectedIndex = -1;
      let selectedDistanceSq = Infinity;
      const hasOrigin = origin && Number.isFinite(origin.x) && Number.isFinite(origin.z);
      const sideX = hasOrigin ? origin.x - this.center.x : 0;
      const sideZ = hasOrigin ? origin.z - this.center.z : 0;
      const sideLen = Math.hypot(sideX, sideZ);
      const nx = sideLen > 1e-6 ? sideX / sideLen : 0;
      const nz = sideLen > 1e-6 ? sideZ / sideLen : 0;
      const hasForward = forward && Number.isFinite(forward.x) && Number.isFinite(forward.z);
      const fwdLen = hasForward ? Math.hypot(forward.x, forward.z) : 0;
      const fx = fwdLen > 1e-6 ? forward.x / fwdLen : 0;
      const fz = fwdLen > 1e-6 ? forward.z / fwdLen : 0;
      for (let i = 0; i < this.slots.length; i += 1) {
        const slot = this.slots[i];
        if (slot.state !== 'free') {
          continue;
        }
        if (slot.type !== type) {
          continue;
        }
        if (hasOrigin) {
          const slotSideX = slot.position.x - this.center.x;
          const slotSideZ = slot.position.z - this.center.z;
          const sideDot = (slotSideX * sideX) + (slotSideZ * sideZ);
          if (sideDot < 0) {
            continue;
          }
          // Keep targets only in the near-side cone (about 60 deg around outward normal).
          const slotSideLen = Math.hypot(slotSideX, slotSideZ);
          if (slotSideLen > 1e-6 && sideLen > 1e-6) {
            const sx = slotSideX / slotSideLen;
            const sz = slotSideZ / slotSideLen;
            const cosAngle = (sx * nx) + (sz * nz);
            if (cosAngle < 0.5) {
              continue;
            }
          }
        }
        if (hasOrigin && fwdLen > 1e-6) {
          const toSlotX = slot.position.x - origin.x;
          const toSlotZ = slot.position.z - origin.z;
          const toLen = Math.hypot(toSlotX, toSlotZ);
          if (toLen > 1e-6) {
            const tx = toSlotX / toLen;
            const tz = toSlotZ / toLen;
            const forwardDot = (tx * fx) + (tz * fz);
            // Only targets in front of the moving cart.
            if (forwardDot <= 0.1) {
              continue;
            }
          }
        }
        const distanceSq = hasOrigin
          ? slot.position.distanceToSquared(origin)
          : slot.position.distanceToSquared(this.center);
        if (distanceSq < selectedDistanceSq) {
          selectedDistanceSq = distanceSq;
          selectedIndex = i;
        }
      }
      if (selectedIndex >= 0) {
        this.slots[selectedIndex].state = 'reserved';
        return { index: selectedIndex, position: this.slots[selectedIndex].position.clone() };
      }
      return null;
    }

    hasFreeSlotForType(type) {
      return this.slots.some((slot) => slot.state === 'free' && slot.type === type);
    }

    commit(index) {
      const slot = this.slots[index];
      if (!slot || slot.state !== 'reserved') {
        return false;
      }

      slot.state = 'built';

      const mesh = createBlockMesh(
        slot.type,
        this.cellSize,
        this.createMaterial(slot.type, 0xffffff),
        'placed',
      );
      mesh.position.copy(slot.position);
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
      for (const slot of this.slots) {
        counts[slot.type] = (counts[slot.type] || 0) + 1;
      }
      return counts;
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
      if (this.onChange) this.onChange();
    }

    clear() {
      for (const item of this.cells.values()) {
        this.group.remove(item.mesh);
      }
      this.cells.clear();
      if (this.onChange) this.onChange();
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
      if (this.onChange) this.onChange();
    }

    exportData() {
      return Array.from(this.cells.values())
        .map(({ type, x, z, yaw }) => ({ type, x, z, yaw }))
        .sort((a, b) => (a.z - b.z) || (a.x - b.x));
    }

    loadData(data) {
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
      if (this.onChange) this.onChange();
    }
  }

  class WorldInventoryController {
    constructor(scene, slotConfigs) {
      this.scene = scene;
      this.group = new THREE.Group();
      this.slots = new Map();
      this.interactiveMeshes = [];
      this.pointerRaycaster = new THREE.Raycaster();
      this.pointerNdc = new THREE.Vector2();

      const layout = slotConfigs.filter((config) => !config.empty);
      const spacing = 2.55;
      const startZ = -((layout.length - 1) * spacing) * 0.5;
      const baseX = 9.8;

      for (let i = 0; i < layout.length; i += 1) {
        const config = layout[i];
        const slotZ = startZ + i * spacing;

        const clickPad = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 1, 1.8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        clickPad.position.set(baseX, 0.5, slotZ);
        clickPad.userData.blockId = config.id;
        this.group.add(clickPad);

        this.interactiveMeshes.push(clickPad);
        this.slots.set(config.id, {
          id: config.id,
          clickPad,
          anchor: new THREE.Vector3(baseX, 1.02, slotZ),
          disabled: false,
          locked: false,
        });
      }

      this.scene.add(this.group);
    }

    getSlotAnchor(id) {
      const slot = this.slots.get(id);
      return slot ? slot.anchor.clone() : null;
    }

    registerCarrierMesh(id, mesh) {
      if (!mesh) {
        return;
      }
      mesh.userData.blockId = id;
      this.interactiveMeshes.push(mesh);
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
      const blocked = slot.disabled || slot.locked;
      slot.clickPad.userData.blocked = blocked;
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
            return obj.userData.blockId;
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

  function createBlockMaterial(type, color) {
    const blockDef = getBlockDefinition(type);
    const shape = blockDef && blockDef.shape ? blockDef.shape : 'cube';
    const map = BLOCK_TEXTURES[type] || null;
    const isDoor = shape === 'door';
    const baseColor = Number.isFinite(blockDef && blockDef.color) ? blockDef.color : color;
    const roughness = shape === 'pillar' || type === 'wood' ? 0.9 : 0.78;
    const metalness = type === 'stone' || type === 'stone_slab' ? 0.12 : 0.04;
    return new THREE.MeshStandardMaterial({
      map,
      color: map ? 0xffffff : baseColor,
      roughness,
      metalness,
      transparent: false,
      alphaTest: 0,
      side: isDoor ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  function ensureDoorShowcaseNearMinecart(scene, minecart) {
    if (!scene || !minecart) {
      return null;
    }
    const existing = scene.getObjectByName('door-showcase-near-minecart');
    if (existing) {
      return existing;
    }
    const mesh = createDoorModelMesh(1.25, 'placed');
    if (!mesh) {
      return null;
    }

    const cartPos = minecart.group.position.clone();
    const forward = minecart.getForward(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) {
      forward.set(0, 0, 1);
    } else {
      forward.normalize();
    }
    const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

    mesh.name = 'door-showcase-near-minecart';
    mesh.position.copy(cartPos)
      .add(side.multiplyScalar(1.7))
      .add(forward.multiplyScalar(-0.3));
    mesh.position.y = 1.0;
    mesh.rotation.y = Math.atan2(forward.x, forward.z);
    scene.add(mesh);
    return mesh;
  }

  class BlockController {
    constructor(options) {
      this.scene = options.scene;
      this.minecart = options.minecartController;
      this.buildManager = options.buildManager;

      this.id = options.id;
      this.type = options.type;
      this.color = options.color;
      this.count = options.count;

      this.onCountChange = options.onCountChange;
      this.onCycleFinish = options.onCycleFinish;

      this.state = 'idle';
      this.phaseTime = 0;
      this.spawnTimer = 0;
      this.idleTime = Math.random() * Math.PI * 2;
      this.idleSeed = Math.random() * Math.PI * 2;

      this.launchDuration = 0.62;
      this.dispatchDuration = 8.1;
      this.currentDispatchDuration = this.dispatchDuration;
      this.returnDuration = 0.68;
      this.spawnInterval = 0.46;

      this.uiAnchor = new THREE.Vector3();
      this.launchFrom = new THREE.Vector3();
      this.returnFrom = new THREE.Vector3();

      this.projectiles = [];

      this.mesh = createBlockMesh(
        this.type,
        1,
        createBlockMaterial(this.type, this.color),
        'carrier',
      );
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;

      if (this.type !== 'door') {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(CARRIER_GEOMETRY),
          new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.42 }),
        );
        this.mesh.add(edges);
      }

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

    setUiAnchor(position) {
      this.uiAnchor.copy(position);
      this.mesh.position.copy(this.uiAnchor);
      this.mesh.position.y += 0.52;
    }

    canStartCycle() {
      return this.state === 'idle' && this.count > 0 && !this.minecart.isMoving();
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
        this.mesh.rotation.set(0, 0, 0);
      }
      this.updateCountVisual();
    }

    startCycle() {
      if (!this.canStartCycle()) {
        return false;
      }

      this.state = 'launching';
      this.phaseTime = 0;
      this.spawnTimer = 0;

      this.launchFrom.copy(this.mesh.position);

      return true;
    }

    update(dt) {
      this.updateProjectiles(dt);

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
        this.state = 'dispatching';
        this.phaseTime = 0;
        this.spawnTimer = 0;
      }
    }

    updateDispatching(dt) {
      this.phaseTime += dt;
      if (this.count <= 0 || !this.buildManager.hasFreeSlotForType(this.type)) {
        this.phaseTime = this.dispatchDuration;
      }

      const cargoPos = this.minecart.getCargoAnchor(TEMP_A);
      const cargoForward = this.minecart.getForward(TEMP_B);
      this.mesh.position.copy(cargoPos);
      this.mesh.rotation.set(0, 0, 0);

      this.spawnTimer += dt;
      while (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer -= this.spawnInterval;
        const spawnResult = this.spawnPiece(cargoPos, cargoForward);
        if (spawnResult === 'finished' || spawnResult === 'depleted') {
          this.spawnTimer = 0;
          this.phaseTime = this.dispatchDuration;
          break;
        }
        if (spawnResult === 'waiting-side') {
          break;
        }
      }

      if (this.phaseTime >= this.currentDispatchDuration || !this.minecart.isMoving()) {
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
      const bob = 0.5 + Math.sin(this.idleTime * 2.1 + this.idleSeed) * 0.1;
      this.mesh.position.copy(this.uiAnchor);
      this.mesh.position.y += bob;
      this.mesh.rotation.y += dt * 0.82;
      this.mesh.rotation.x = Math.sin(this.idleTime * 1.25 + this.idleSeed) * 0.05;
    }

    spawnPiece(origin, forward) {
      if (this.count <= 0) {
        return 'depleted';
      }

      if (!this.buildManager.hasFreeSlotForType(this.type)) {
        return 'finished';
      }

      const reserved = this.buildManager.reserveNext(this.type, origin || this.mesh.position, forward || null);
      if (!reserved) {
        return 'waiting-side';
      }

      this.count -= 1;
      this.updateCountVisual();
      if (this.onCountChange) {
        this.onCountChange(this.id, this.count);
      }

      const piece = createBlockMesh(
        this.type,
        0.32,
        createBlockMaterial(this.type, this.color),
        'piece',
      );
      piece.castShadow = true;
      piece.receiveShadow = true;
      piece.position.copy(origin || this.mesh.position);
      this.scene.add(piece);

      this.projectiles.push({
        mesh: piece,
        from: (origin || this.mesh.position).clone(),
        to: reserved.position,
        index: reserved.index,
        progress: 0,
        duration: 0.09,
      });

      return 'spawned';
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
        const projectile = this.projectiles[i];
        projectile.progress += dt / projectile.duration;

        if (projectile.progress >= 1) {
          this.scene.remove(projectile.mesh);
          disposeObject3D(projectile.mesh);
          this.buildManager.commit(projectile.index);
          this.projectiles.splice(i, 1);
          continue;
        }

        const eased = easeOutCubic(projectile.progress);
        projectile.mesh.position.lerpVectors(projectile.from, projectile.to, eased);
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

      this.enabled = false;
      this.selectedType = DEFAULT_BLOCK_ID;
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

    setLayer(layer) {
      this.layer = Math.max(0, Math.min(8, Math.floor(layer)));
      if (this.hoverCell) {
        this.updateHoverMesh();
      }
    }

    getCellKey(x, y, z) {
      return `${x}:${y}:${z}`;
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
        if (this.selectedType === 'erase') {
          this.hoverCell = { x: cell.x, y: cell.y, z: cell.z };
          this.updateHoverMesh();
          return;
        }

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
          const ny = cell.y + this._dominantNormal.y;
          const nz = cell.z + this._dominantNormal.z;
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

    placeAtHover() {
      if (!this.enabled || !this.hoverCell) {
        return;
      }

      const { x, y, z } = this.hoverCell;
      const key = this.getCellKey(x, y, z);

      if (this.selectedType === 'erase') {
        const existing = this.cells.get(key) || this.getTopBlockInColumn(x, z);
        if (existing) {
          this.group.remove(existing.mesh);
          disposeObject3D(existing.mesh);
          this.cells.delete(this.getCellKey(existing.x, existing.y, existing.z));
        }
        return;
      }

      let targetY = y;
      const existing = this.cells.get(key);
      if (existing) {
        const top = this.getTopBlockInColumn(x, z);
        targetY = Math.min(8, (top ? top.y : y) + 1);
      }
      const targetKey = this.getCellKey(x, targetY, z);
      const targetExisting = this.cells.get(targetKey);
      if (targetExisting) {
        this.group.remove(targetExisting.mesh);
        disposeObject3D(targetExisting.mesh);
      }

      const mesh = createBlockMesh(
        this.selectedType,
        this.boxSize,
        this.createMaterial(this.selectedType, 0xffffff),
        'placed',
      );
      mesh.position.copy(this.cellToPosition(x, targetY, z));
      attachCellUserData(mesh, { x, y: targetY, z });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.cells.set(targetKey, { type: this.selectedType, x, y: targetY, z, mesh });
    }

    placeBlock(type, x, y, z) {
      if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ || y < 0 || y > 8) {
        return;
      }
      const key = this.getCellKey(x, y, z);
      const existing = this.cells.get(key);
      if (existing) {
        this.group.remove(existing.mesh);
        disposeObject3D(existing.mesh);
      }

      const mesh = createBlockMesh(
        type,
        this.boxSize,
        this.createMaterial(type, 0xffffff),
        'placed',
      );
      mesh.position.copy(this.cellToPosition(x, y, z));
      attachCellUserData(mesh, { x, y, z });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.cells.set(key, { type, x, y, z, mesh });
    }

    clear() {
      for (const entry of this.cells.values()) {
        this.group.remove(entry.mesh);
        disposeObject3D(entry.mesh);
      }
      this.cells.clear();
    }

    exportJSON() {
      const blocks = Array.from(this.cells.values())
        .map(({ type, x, y, z }) => ({ type, x, y, z }))
        .sort((a, b) => (a.y - b.y) || (a.z - b.z) || (a.x - b.x));
      return JSON.stringify({ blocks }, null, 2);
    }

    loadJSON(data) {
      this.clear();
      const list = data && Array.isArray(data.blocks) ? data.blocks : [];
      for (const block of list) {
        this.placeBlock(block.type || DEFAULT_BLOCK_ID, Number(block.x), Number(block.y), Number(block.z));
      }
    }
  }

  const BLOCK_CONFIGS = INVENTORY_BLOCK_DEFS.map((blockDef) => ({
    id: blockDef.id,
    label: blockDef.label || blockDef.id,
    type: blockDef.id,
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
  const LEGACY_RAILS_STORAGE_KEYS = ['prototype:rails_layout_v2', 'prototype:rails_layout_v1'];
  const debugEditor = document.getElementById('debug-editor');
  let uiHidden = false;
  let flyCamEnabled = false;
  let flyCamRestoreState = null;
  let syncCameraInputsFromState = null;
  let flyLookActive = false;
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
      x: -90.00000000000003,
      y: 42.13759477388825,
      z: 90.00000000000003,
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

  function saveSceneLayout() {
    try {
      const snapshot = {
        version: 2,
        levelId: activeLevelId,
        blocks: getEditorBlocksSnapshot(),
        rails: railEditor.exportData(),
        minecart: {
          speed: minecart.getSpeed(),
        },
        camera: exportCameraDebugState(),
      };
      localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Failed to save scene to localStorage', error);
    }
  }

  function handleRailLayoutChange() {
    trackController.setRailLayout(railEditor.exportData());
    saveSceneLayout();
  }

  function autoPlaceRails() {
    const autoRails = buildRailLayoutFromCurve(trackController.defaultCurve);
    railEditor.loadData(autoRails);
    trackController.setRailLayout(railEditor.exportData());
    saveSceneLayout();
  }

  function loadDefaultRails() {
    const levelData = cloneLevelData(LEVELS_BY_ID.get(activeLevelId) || FALLBACK_LEVEL_DEF);
    const rails = normalizeRails(levelData.rails);
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
      const iy = Math.max(0, Math.min(8, Math.round(y)));
      const iz = Math.round(z);
      const key = `${ix}:${iy}:${iz}`;
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      normalized.push({
        type,
        x: ix,
        y: iy,
        z: iz,
      });
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

  function centerBlocksInEditorBounds(blocksList, editorRef) {
    const blocks = normalizeBlocks(blocksList);
    if (blocks.length === 0) {
      return [];
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const block of blocks) {
      minX = Math.min(minX, block.x);
      maxX = Math.max(maxX, block.x);
      minZ = Math.min(minZ, block.z);
      maxZ = Math.max(maxZ, block.z);
    }

    const srcCenterX = (minX + maxX) * 0.5;
    const srcCenterZ = (minZ + maxZ) * 0.5;
    const dstCenterX = (editorRef.minX + editorRef.maxX) * 0.5;
    const dstCenterZ = (editorRef.minZ + editorRef.maxZ) * 0.5;
    const shiftX = Math.round(dstCenterX - srcCenterX);
    const shiftZ = Math.round(dstCenterZ - srcCenterZ);

    const centered = [];
    const used = new Set();
    for (const block of blocks) {
      const x = block.x + shiftX;
      const z = block.z + shiftZ;
      if (x < editorRef.minX || x > editorRef.maxX || z < editorRef.minZ || z > editorRef.maxZ) {
        continue;
      }
      const key = `${x}:${block.y}:${z}`;
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      centered.push({
        type: block.type,
        x,
        y: block.y,
        z,
      });
    }

    return centered;
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

    try {
      return JSON.parse(payload);
    } catch (_errorA) {
      try {
        // JS-like object fallback: unquoted keys + single quotes.
        const withQuotedKeys = payload.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
        const relaxed = withQuotedKeys.replace(/'/g, '"');
        return JSON.parse(relaxed);
      } catch (_errorB) {
        try {
          // JSONC/JS-ish fallback: comments + trailing commas.
          const noComments = payload
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
          const noTrailingCommas = noComments.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(noTrailingCommas);
        } catch (_errorC) {
          try {
            // Final fallback for JS literal objects/arrays.
            return Function(`"use strict"; return (${payload});`)();
          } catch (_errorD) {
            throw new Error('Unsupported JSON format');
          }
        }
      }
    }
  }

  function extractRailsFromArbitraryText(raw) {
    const text = String(raw || '');
    const chunks = text.match(/\{[^{}]*\}/g) || [];
    const rails = [];
    for (const chunk of chunks) {
      const typeMatch = chunk.match(/\btype\b\s*[:=]\s*["']?(straight|corner)["']?/i);
      const xMatch = chunk.match(/\bx\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
      const zMatch = chunk.match(/\bz\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
      const yawMatch = chunk.match(/\b(?:yaw|rotation|rot)\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
      if (!typeMatch || !xMatch || !zMatch) {
        continue;
      }
      const type = String(typeMatch[1]).toLowerCase();
      if (type !== 'straight' && type !== 'corner') {
        continue;
      }
      rails.push({
        type,
        x: Number(xMatch[1]),
        z: Number(zMatch[1]),
        yaw: yawMatch ? Number(yawMatch[1]) : 0,
      });
    }
    return normalizeRails(rails);
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

  function restoreSceneLayout() {
    try {
      const raw = localStorage.getItem(SCENE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const levelData = cloneLevelData(LEVELS_BY_ID.get(parsed && parsed.levelId) || INITIAL_LEVEL_DATA);
        activeLevelId = levelData.id;
        const blocks = normalizeBlocks(parsed && parsed.blocks);
        const rails = normalizeRails(parsed && parsed.rails);
        const speed = Number(parsed && parsed.minecart && parsed.minecart.speed);
        const cameraSettings = normalizeCameraSettings(parsed && parsed.camera);

        const sceneData = {
          blocks: blocks.length > 0 ? blocks : normalizeBlocks(levelData.blocks),
          rails: rails.length > 0 ? rails : normalizeRails(levelData.rails),
        };
        editor.loadJSON(sceneData);
        buildManager.loadFromLevel(sceneData);
        railEditor.loadData(sceneData.rails);
        trackController.setRailLayout(railEditor.exportData());
        if (Number.isFinite(speed) && speed > 0) {
          minecart.setSpeed(speed);
        } else {
          minecart.setSpeed(levelData.minecartSpeed);
        }
        if (cameraSettings) {
          Object.assign(cameraDebugState, cameraSettings);
          applyCameraDebugState();
        } else if (levelData.camera) {
          const defaultLevelCamera = normalizeCameraSettings(levelData.camera);
          if (defaultLevelCamera) {
            Object.assign(cameraDebugState, defaultLevelCamera);
            applyCameraDebugState();
          }
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
        saveSceneLayout();
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
    const levelData = cloneLevelData(LEVELS_BY_ID.get(activeLevelId) || INITIAL_LEVEL_DATA);
    const sceneData = {
      blocks: normalizeBlocks(levelData.blocks),
      rails: normalizeRails(levelData.rails),
    };
    editor.loadJSON(sceneData);
    buildManager.loadFromLevel(sceneData);
    minecart.setSpeed(levelData.minecartSpeed);
    if (levelData.camera) {
      const levelCamera = normalizeCameraSettings(levelData.camera);
      if (levelCamera) {
        Object.assign(cameraDebugState, levelCamera);
        applyCameraDebugState();
      }
    }
    loadDefaultRails();
  }
  minecart.snapToNearestPoint(new THREE.Vector3(9.8, trackController.pathY, 0));
  ensureDoorModelLoading();
  ensureDoorShowcaseNearMinecart(scene, minecart);

  let activeBlockId = null;

  function handleSlotClick(id) {
    if (editor.isEnabled()) {
      return;
    }

    if (activeBlockId !== null) {
      return;
    }

    const controller = blocks.get(id);
    if (!controller || !controller.canStartCycle()) {
      return;
    }

    const started = controller.startCycle();
    if (!started) {
      return;
    }

    activeBlockId = id;
    refreshUiLockState();
  }

  function handleCountChange(id, count) {
    worldInventory.setCount(id, count);
  }

  function handleCycleFinish(id) {
    if (activeBlockId === id) {
      activeBlockId = null;
    }
    refreshUiLockState();
  }

  function getLevelCountsByType() {
    return buildManager.getSlotTypeCounts();
  }

  const worldInventory = new WorldInventoryController(scene, BLOCK_CONFIGS);
  const blocks = new Map();
  const initialCountsByType = getLevelCountsByType();

  for (const config of BLOCK_CONFIGS) {
    const controller = new BlockController({
      scene,
      minecartController: minecart,
      buildManager,
      id: config.id,
      type: config.type,
      color: config.color,
      count: initialCountsByType[config.type] || 0,
      onCountChange: handleCountChange,
      onCycleFinish: handleCycleFinish,
    });

    const anchor = worldInventory.getSlotAnchor(config.id);
    if (anchor) {
      controller.setUiAnchor(anchor);
    }
    worldInventory.registerCarrierMesh(config.id, controller.mesh);
    blocks.set(config.id, controller);
  }

  function syncBlockCountsFromLevel() {
    const countsByType = getLevelCountsByType();
    for (const controller of blocks.values()) {
      controller.setCount(countsByType[controller.type] || 0);
    }
  }

  function refreshUiLockState() {
    worldInventory.setCycleLock(activeBlockId);

    for (const [id, controller] of blocks.entries()) {
      const disabled = controller.getCount() <= 0 || (activeBlockId !== null && activeBlockId !== id);
      worldInventory.setDisabled(id, disabled);
      worldInventory.setCount(id, controller.getCount());
    }
  }

  function bindDebugEditorUI() {
    const enabledInput = document.getElementById('editor-enabled');
    const blockSelect = document.getElementById('editor-block');
    const levelSelect = document.getElementById('level-select');
    const levelLoadBtn = document.getElementById('level-load');
    const levelExportModuleBtn = document.getElementById('level-export-module');
    const layerInput = document.getElementById('editor-layer');
    const clearBtn = document.getElementById('editor-clear');
    const railEnabledInput = document.getElementById('rail-enabled');
    const railTypeSelect = document.getElementById('rail-type');
    const railRotSelect = document.getElementById('rail-rot');
    const minecartSpeedInput = document.getElementById('minecart-speed');
    const railClearBtn = document.getElementById('rail-clear');
    const railAutoBtn = document.getElementById('rail-auto');
    const railExportBtn = document.getElementById('rail-export');
    const railImportBtn = document.getElementById('rail-import');
    const blocksImportCenterBtn = document.getElementById('blocks-import-center');
    const exportBtn = document.getElementById('editor-export');
    const applyBtn = document.getElementById('editor-apply');
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
    const cameraCopyBtn = document.getElementById('cam-copy');

    function populateBlockSelect() {
      blockSelect.innerHTML = '';
      for (const blockDef of BLOCK_LIBRARY) {
        const option = document.createElement('option');
        option.value = blockDef.id;
        option.textContent = blockDef.label || blockDef.id;
        blockSelect.appendChild(option);
      }
      const eraseOption = document.createElement('option');
      eraseOption.value = 'erase';
      eraseOption.textContent = 'Erase';
      blockSelect.appendChild(eraseOption);
    }

    function populateLevelSelect() {
      if (!levelSelect) {
        return;
      }
      levelSelect.innerHTML = '';
      for (const level of LEVEL_CATALOG) {
        if (!level || !level.id) {
          continue;
        }
        const option = document.createElement('option');
        option.value = level.id;
        option.textContent = level.name || level.id;
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

    function loadSelectedLevel(levelId) {
      const levelData = cloneLevelData(LEVELS_BY_ID.get(levelId) || INITIAL_LEVEL_DATA);
      activeLevelId = levelData.id;

      const sceneData = {
        blocks: normalizeBlocks(levelData.blocks),
        rails: normalizeRails(levelData.rails),
      };
      editor.loadJSON(sceneData);
      buildManager.loadFromLevel(sceneData);
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

    enabledInput.addEventListener('change', () => {
      editor.setEnabled(enabledInput.checked);
    });

    if (levelLoadBtn && levelSelect) {
      levelLoadBtn.addEventListener('click', () => {
        if (activeBlockId !== null) {
          window.alert('Finish active block cycle first, then load another level.');
          return;
        }
        loadSelectedLevel(levelSelect.value);
      });
    }

    if (levelExportModuleBtn) {
      levelExportModuleBtn.addEventListener('click', async () => {
        const exported = JSON.parse(editor.exportJSON());
        const payload = {
          id: `${activeLevelId || 'new_level'}_copy`,
          name: 'New Level',
          blocks: Array.isArray(exported.blocks) ? exported.blocks : [],
          rails: railEditor.exportData(),
          minecart: { speed: minecart.getSpeed() },
        };
        const moduleText = [
          '(function () {',
          `  window.registerMinecraftLevel(${JSON.stringify(payload, null, 2)});`,
          '})();',
        ].join('\n');
        try {
          await navigator.clipboard.writeText(moduleText);
        } catch (error) {
          console.warn('Clipboard write failed, showing module text in prompt', error);
        }
        window.prompt('Level module JS', moduleText);
      });
    }

    blockSelect.addEventListener('change', () => {
      editor.setType(blockSelect.value);
    });

    layerInput.addEventListener('change', () => {
      editor.setLayer(Number(layerInput.value));
      layerInput.value = String(editor.layer);
    });

    clearBtn.addEventListener('click', () => {
      editor.clear();
      saveSceneLayout();
    });
    railEnabledInput.addEventListener('change', () => {
      railEditor.setEnabled(railEnabledInput.checked);
    });
    railTypeSelect.addEventListener('change', () => {
      railEditor.setType(railTypeSelect.value);
    });
    railRotSelect.addEventListener('change', () => {
      railEditor.setRotationDeg(Number(railRotSelect.value));
    });
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
    railExportBtn.addEventListener('click', async () => {
      const text = JSON.stringify({ rails: railEditor.exportData() }, null, 2);
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.warn('Clipboard write failed, showing rails JSON in prompt', error);
      }
      window.prompt('Rails JSON', text);
    });
    railImportBtn.addEventListener('click', () => {
      if (activeBlockId !== null) {
        window.alert('Finish active block cycle first, then import rails.');
        return;
      }
      const raw = window.prompt('Paste Rails JSON ({"rails":[...]} or plain array)');
      if (!raw) {
        return;
      }
      try {
        const parsed = parseJsonLoose(raw);
        const rails = normalizeRails(pickRailsPayload(parsed));
        if (rails.length === 0) {
          const extractedRails = extractRailsFromArbitraryText(raw);
          if (extractedRails.length === 0) {
            window.alert('No valid rails found in JSON.');
            return;
          }
          railEditor.loadData(extractedRails);
          trackController.setRailLayout(railEditor.exportData());
          saveSceneLayout();
          window.alert(`Imported rails: ${extractedRails.length}`);
          return;
        }
        railEditor.loadData(rails);
        trackController.setRailLayout(railEditor.exportData());
        saveSceneLayout();
        window.alert(`Imported rails: ${rails.length}`);
      } catch (error) {
        const extractedRails = extractRailsFromArbitraryText(raw);
        if (extractedRails.length > 0) {
          railEditor.loadData(extractedRails);
          trackController.setRailLayout(railEditor.exportData());
          saveSceneLayout();
          window.alert(`Imported rails: ${extractedRails.length}`);
          return;
        }
        console.warn('Failed to import rails JSON', error);
        const reason = error && error.message ? `\nReason: ${error.message}` : '';
        window.alert(`Failed to import rails JSON.${reason}`);
      }
    });
    blocksImportCenterBtn.addEventListener('click', () => {
      if (activeBlockId !== null) {
        window.alert('Finish active block cycle first, then import blocks.');
        return;
      }
      const raw = window.prompt('Paste Blocks JSON ({"blocks":[...]} or plain array)');
      if (!raw) {
        return;
      }
      try {
        const parsed = parseJsonLoose(raw);
        const blocksRaw = pickBlocksPayload(parsed);
        const centered = centerBlocksInEditorBounds(blocksRaw, editor);
        if (centered.length === 0) {
          window.alert('No valid blocks found (or all blocks are outside editor bounds).');
          return;
        }

        const data = {
          blocks: centered,
          rails: railEditor.exportData(),
        };
        editor.loadJSON(data);
        buildManager.loadFromLevel(data);
        syncBlockCountsFromLevel();
        refreshUiLockState();
        saveSceneLayout();
        window.alert(`Imported blocks (centered): ${centered.length}`);
      } catch (error) {
        console.warn('Failed to import blocks JSON', error);
        const reason = error && error.message ? `\nReason: ${error.message}` : '';
        window.alert(`Failed to import blocks JSON.${reason}`);
      }
    });

    exportBtn.addEventListener('click', async () => {
      const payload = {
        levelId: activeLevelId,
        blocks: JSON.parse(editor.exportJSON()).blocks || [],
        rails: railEditor.exportData(),
        minecart: { speed: minecart.getSpeed() },
      };
      const text = JSON.stringify(payload, null, 2);
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.warn('Clipboard write failed, showing JSON in prompt', error);
      }
      window.prompt('Level JSON', text);
    });

    applyBtn.addEventListener('click', () => {
      if (activeBlockId !== null) {
        return;
      }
      const data = {
        blocks: JSON.parse(editor.exportJSON()).blocks || [],
        rails: railEditor.exportData(),
      };
      buildManager.loadFromLevel(data);
      syncBlockCountsFromLevel();
      refreshUiLockState();
      saveSceneLayout();
    });
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
    cameraCopyBtn.addEventListener('click', async () => {
      const text = JSON.stringify(exportCameraDebugState(), null, 2);
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.warn('Clipboard write failed, showing camera JSON in prompt', error);
      }
      window.prompt('Camera JSON', text);
    });

    populateBlockSelect();
    populateLevelSelect();
    if (levelSelect) {
      levelSelect.value = activeLevelId;
    }
    blockSelect.value = blockSelect.value || DEFAULT_BLOCK_ID;
    editor.setType(blockSelect.value);
    editor.setLayer(Number(layerInput.value));
    railEditor.setType(railTypeSelect.value);
    railEditor.setRotationDeg(Number(railRotSelect.value));
    minecartSpeedInput.value = String(minecart.getSpeed());
    syncCameraInputsFromState = setCameraInputsFromState;
    setCameraInputsFromState();
  }

  function tryInventoryClick(event) {
    const pickedId = worldInventory.pickBlockId(event.clientX, event.clientY, camera, canvas);
    if (!pickedId) {
      return false;
    }
    handleSlotClick(pickedId);
    return true;
  }

  function step(dt) {
    updateFlyCamera(dt);
    minecart.update(dt);
    ensureDoorShowcaseNearMinecart(scene, minecart);
    for (const controller of blocks.values()) {
      controller.update(dt);
    }

    renderer.render(scene, camera);
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
    if (editor.isEnabled() && event.buttons === 1 && editor.selectedType === 'erase') {
      editor.placeAtHover();
      saveSceneLayout();
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (flyCamEnabled && event.button === 2) {
      flyLookActive = true;
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (railEditor.isEnabled()) {
      if (event.button === 0) {
        railEditor.placeAtEvent(event);
      } else if (event.button === 2) {
        railEditor.removeAtEvent(event);
      }
      return;
    }
    if (event.button !== 0) {
      return;
    }

    if (!editor.isEnabled() && tryInventoryClick(event)) {
      return;
    }

    editor.updateHoverFromPointer(event);
    editor.placeAtHover();
    saveSceneLayout();
  });
  canvas.addEventListener('contextmenu', (event) => {
    if (railEditor.isEnabled() || flyCamEnabled) {
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointerup', (event) => {
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

  refreshUiLockState();
  applyUiVisibility();
  bindDebugEditorUI();
  animate();
})();
