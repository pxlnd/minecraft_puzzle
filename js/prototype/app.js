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

  const BLOCK_TEXTURES = {
    stone: loadTexture(TEXTURE_DATA.stone || './assets/block/minecraft_stone.png', { pixelated: true }),
    wood: loadTexture(TEXTURE_DATA.wood || './assets/block/wood.webp', { pixelated: true }),
    grass: loadTexture(TEXTURE_DATA.grass || './assets/grass.png', { pixelated: true }),
  };

  function pixelHash(x, y, seed = 0) {
    const n = Math.sin((x + seed * 0.17) * 12.9898 + (y - seed * 0.11) * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function createPixelCanvasTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);

    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else if ('encoding' in texture) {
      texture.encoding = THREE.sRGBEncoding;
    }
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
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

  const TREE_TEXTURE_SET = createMinecraftTreeTextureSet();
  const DEFAULT_EDITOR_LEVEL = {
    blocks: [
      { type: 'stone', x: 6, y: 0, z: -3 },
      { type: 'stone', x: 6, y: 0, z: -2 },
      { type: 'stone', x: 6, y: 0, z: -1 },
      { type: 'stone', x: 6, y: 0, z: 0 },
      { type: 'stone', x: 6, y: 0, z: 1 },
      { type: 'stone', x: 6, y: 0, z: 2 },
      { type: 'stone', x: -4, y: 0, z: 3 },
      { type: 'stone', x: -3, y: 0, z: 3 },
      { type: 'stone', x: -2, y: 0, z: 3 },
      { type: 'stone', x: -1, y: 0, z: 3 },
      { type: 'stone', x: 0, y: 0, z: 3 },
      { type: 'stone', x: 1, y: 0, z: 3 },
      { type: 'stone', x: 2, y: 0, z: 3 },
      { type: 'stone', x: 3, y: 0, z: 3 },
      { type: 'stone', x: 4, y: 0, z: 3 },
      { type: 'stone', x: 5, y: 0, z: 3 },
      { type: 'stone', x: 6, y: 0, z: 3 },
    ],
  };

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
      this.sleeperSpacing = 0.42;

      this.curve = new RoundedRectTrackCurve(this.pathWidth, this.pathHeight, this.pathRadius, this.pathY);

      this.createMeshes();
    }

    createMeshes() {
      const centerGround = new THREE.Mesh(
        new THREE.PlaneGeometry(this.centerGroundWidth, this.centerGroundHeight),
        new THREE.MeshStandardMaterial({ color: 0x8a4f2c, roughness: 0.92, metalness: 0.02 }),
      );
      centerGround.rotation.x = -Math.PI * 0.5;
      centerGround.position.y = 0.03;
      centerGround.receiveShadow = true;
      this.scene.add(centerGround);

      const ballast = new THREE.Mesh(
        new THREE.TubeGeometry(this.curve, 320, 0.44, 12, true),
        new THREE.MeshStandardMaterial({ color: 0x5c4732, roughness: 0.96, metalness: 0.02 }),
      );
      ballast.castShadow = false;
      ballast.receiveShadow = true;
      this.scene.add(ballast);

      const sleepers = [];
      const sleeperCount = Math.max(24, Math.round(this.curve.perimeter / this.sleeperSpacing));
      for (let i = 0; i < sleeperCount; i += 1) {
        const t = i / sleeperCount;
        const point = this.curve.getPoint(t, new THREE.Vector3());
        const tangent = this.curve.getTangent(t, new THREE.Vector3());
        const nx = -tangent.z;
        const nz = tangent.x;
        const angle = Math.atan2(nx, nz);
        sleepers.push({
          x: point.x,
          y: this.pathY - 0.05,
          z: point.z,
          angle,
        });
      }

      const sleeperMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.74, 0.08, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x8b6b42, roughness: 0.95, metalness: 0.01 }),
        sleepers.length,
      );
      sleeperMesh.castShadow = true;
      sleeperMesh.receiveShadow = true;
      const sleeperMatrix = new THREE.Matrix4();
      const sleeperQuaternion = new THREE.Quaternion();
      for (let i = 0; i < sleepers.length; i += 1) {
        const s = sleepers[i];
        sleeperQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.angle);
        sleeperMatrix.compose(
          new THREE.Vector3(s.x, s.y, s.z),
          sleeperQuaternion,
          new THREE.Vector3(1, 1, 1),
        );
        sleeperMesh.setMatrixAt(i, sleeperMatrix);
      }
      sleeperMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(sleeperMesh);

      const railMaterial = new THREE.MeshStandardMaterial({
        color: 0xc4c7cc,
        roughness: 0.34,
        metalness: 0.78,
      });
      const leftRailCurve = new OffsetTrackCurve(this.curve, this.railGauge * 0.5, this.railHeight);
      const rightRailCurve = new OffsetTrackCurve(this.curve, -this.railGauge * 0.5, this.railHeight);
      const leftRail = new THREE.Mesh(new THREE.TubeGeometry(leftRailCurve, 360, 0.045, 8, true), railMaterial);
      const rightRail = new THREE.Mesh(new THREE.TubeGeometry(rightRailCurve, 360, 0.045, 8, true), railMaterial);
      leftRail.castShadow = false;
      leftRail.receiveShadow = true;
      rightRail.castShadow = false;
      rightRail.receiveShadow = true;
      this.scene.add(leftRail);
      this.scene.add(rightRail);
    }

    getPointAt(t, target = new THREE.Vector3()) {
      return this.curve.getPoint(t, target);
    }

    getTangentAt(t, target = new THREE.Vector3()) {
      return this.curve.getTangent(t, target);
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
    }

    loadFromLevel(data) {
      for (const mesh of this.builtMeshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.builtMeshes = [];
      this.slots = [];

      const list = data && Array.isArray(data.blocks) ? data.blocks : [];
      const unique = new Set();
      for (const item of list) {
        const x = Number(item.x);
        const y = Number(item.y);
        const z = Number(item.z);
        const type = item.type || 'stone';
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
    }

    reserveNext(type) {
      for (let i = 0; i < this.slots.length; i += 1) {
        if (this.slots[i].state !== 'free') {
          continue;
        }
        if (this.slots[i].type !== type) {
          continue;
        }
        this.slots[i].state = 'reserved';
        return { index: i, position: this.slots[i].position.clone() };
      }
      return null;
    }

    commit(index) {
      const slot = this.slots[index];
      if (!slot || slot.state !== 'reserved') {
        return false;
      }

      slot.state = 'built';

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.58, 0.58),
        this.createMaterial(slot.type, 0xffffff),
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
  }

  class UIController {
    constructor(container, slotConfigs, onSlotClick) {
      this.container = container;
      this.onSlotClick = onSlotClick;
      this.slots = new Map();

      for (const config of slotConfigs) {
        const element = document.createElement(config.empty ? 'div' : 'button');
        element.className = config.empty ? 'ui-slot empty' : 'ui-slot';

        if (config.empty) {
          this.container.appendChild(element);
          continue;
        }

        element.type = 'button';
        element.dataset.blockId = config.id;

        const label = document.createElement('span');
        label.className = 'slot-label';
        label.textContent = config.label;
        element.appendChild(label);

        const count = document.createElement('span');
        count.className = 'slot-count';
        count.textContent = String(config.count);
        element.appendChild(count);

        element.addEventListener('click', () => {
          this.onSlotClick(config.id);
        });

        this.container.appendChild(element);
        this.slots.set(config.id, { button: element, count });
      }
    }

    getSlotCenter(id) {
      const slot = this.slots.get(id);
      if (!slot) {
        return null;
      }

      const rect = slot.button.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.58,
      };
    }

    setCount(id, value) {
      const slot = this.slots.get(id);
      if (!slot) {
        return;
      }
      slot.count.textContent = String(value);
    }

    setDisabled(id, disabled) {
      const slot = this.slots.get(id);
      if (!slot) {
        return;
      }
      slot.button.disabled = disabled;
      slot.button.classList.toggle('disabled', disabled);
    }

    setCycleLock(activeId) {
      for (const [id, slot] of this.slots.entries()) {
        const locked = activeId !== null && id !== activeId;
        slot.button.classList.toggle('locked', locked);
      }
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
    const map = BLOCK_TEXTURES[type] || null;
    return new THREE.MeshStandardMaterial({
      map,
      color: map ? 0xffffff : color,
      roughness: type === 'wood' ? 0.9 : 0.78,
      metalness: type === 'stone' ? 0.12 : 0.04,
    });
  }

  class BlockController {
    constructor(options) {
      this.scene = options.scene;
      this.track = options.trackController;
      this.buildManager = options.buildManager;

      this.id = options.id;
      this.type = options.type;
      this.color = options.color;
      this.count = options.count;
      this.entryT = options.entryT || 0;

      this.onCountChange = options.onCountChange;
      this.onCycleFinish = options.onCycleFinish;

      this.state = 'idle';
      this.phaseTime = 0;
      this.loopProgress = 0;
      this.spawnTimer = 0;

      this.launchDuration = 0.62;
      this.orbitDuration = 8.1;
      this.returnDuration = 0.68;
      this.spawnInterval = 0.46;

      this.uiAnchor = new THREE.Vector3();
      this.launchFrom = new THREE.Vector3();
      this.launchTo = new THREE.Vector3();
      this.returnFrom = new THREE.Vector3();

      this.projectiles = [];

      this.mesh = new THREE.Mesh(CARRIER_GEOMETRY, createBlockMaterial(this.type, this.color));
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(CARRIER_GEOMETRY),
        new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.42 }),
      );
      this.mesh.add(edges);

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
      this.scene.add(this.mesh);
    }

    setUiAnchor(position) {
      this.uiAnchor.copy(position);
      if (this.state === 'idle' && this.count > 0) {
        this.mesh.position.copy(this.uiAnchor);
      }
    }

    canStartCycle() {
      return this.state === 'idle' && this.count > 0;
    }

    getCount() {
      return this.count;
    }

    startCycle() {
      if (!this.canStartCycle()) {
        return false;
      }

      this.state = 'launching';
      this.phaseTime = 0;
      this.loopProgress = 0;
      this.spawnTimer = 0;

      this.launchFrom.copy(this.mesh.position);
      this.launchTo.copy(this.track.getPointAt(this.entryT, TEMP_A));
      this.launchTo.y += this.track.blockLift;

      return true;
    }

    update(dt) {
      this.updateProjectiles(dt);

      if (this.state === 'launching') {
        this.updateLaunching(dt);
        return;
      }

      if (this.state === 'orbiting') {
        this.updateOrbiting(dt);
        return;
      }

      if (this.state === 'returning') {
        this.updateReturning(dt);
      }
    }

    updateLaunching(dt) {
      this.phaseTime += dt;
      const progress = Math.min(1, this.phaseTime / this.launchDuration);
      const eased = easeOutCubic(progress);

      this.mesh.position.lerpVectors(this.launchFrom, this.launchTo, eased);
      this.mesh.position.y += Math.sin(Math.PI * eased) * 1.35;

      if (progress >= 1) {
        this.state = 'orbiting';
        this.phaseTime = 0;
        this.loopProgress = 0;
        this.spawnTimer = 0;
      }
    }

    updateOrbiting(dt) {
      this.phaseTime += dt;
      this.loopProgress = Math.min(1, this.phaseTime / this.orbitDuration);

      const t = (this.entryT + this.loopProgress) % 1;
      const point = this.track.getPointAt(t, TEMP_A);
      this.mesh.position.set(point.x, point.y + this.track.blockLift, point.z);

      const tangent = this.track.getTangentAt(t, TEMP_B);
      LOOK_TARGET.copy(this.mesh.position).add(tangent);
      this.mesh.lookAt(LOOK_TARGET);

      this.spawnTimer += dt;
      while (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer -= this.spawnInterval;
        if (!this.spawnPiece()) {
          this.spawnTimer = 0;
          break;
        }
      }

      if (this.loopProgress >= 1) {
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
        }

        if (this.onCycleFinish) {
          this.onCycleFinish(this.id);
        }
      }
    }

    spawnPiece() {
      if (this.count <= 0) {
        return false;
      }

      const reserved = this.buildManager.reserveNext(this.type);
      if (!reserved) {
        return false;
      }

      this.count -= 1;
      this.updateCountVisual();
      if (this.onCountChange) {
        this.onCountChange(this.id, this.count);
      }

      const piece = new THREE.Mesh(
        PIECE_GEOMETRY,
        createBlockMaterial(this.type, this.color),
      );
      piece.castShadow = true;
      piece.receiveShadow = true;
      piece.position.copy(this.mesh.position);
      this.scene.add(piece);

      this.projectiles.push({
        mesh: piece,
        from: this.mesh.position.clone(),
        to: reserved.position,
        index: reserved.index,
        progress: 0,
        duration: 0.62 + Math.random() * 0.18,
      });

      return true;
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
        const projectile = this.projectiles[i];
        projectile.progress += dt / projectile.duration;

        if (projectile.progress >= 1) {
          this.scene.remove(projectile.mesh);
          projectile.mesh.geometry.dispose();
          projectile.mesh.material.dispose();
          this.buildManager.commit(projectile.index);
          this.projectiles.splice(i, 1);
          continue;
        }

        const eased = easeOutCubic(projectile.progress);
        projectile.mesh.position.lerpVectors(projectile.from, projectile.to, eased);
        projectile.mesh.position.y += Math.sin(Math.PI * eased) * 1.25;
        projectile.mesh.rotation.x += dt * 4;
        projectile.mesh.rotation.z += dt * 3.2;
      }
    }

    updateCountVisual() {
      drawCountTexture(this.countCanvas, this.countTexture, this.count, this.count <= 0);
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
      this.selectedType = 'stone';
      this.layer = 0;
      this.cells = new Map();
      this.raycaster = new THREE.Raycaster();
      this.mouseNdc = new THREE.Vector2();
      this.hoverCell = null;
      this.boxSize = this.cellSize * 0.92;

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
      this.grid.visible = value;
      this.hoverMesh.visible = value && this.hoverCell !== null;
    }

    isEnabled() {
      return this.enabled;
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

    worldToCell(world) {
      const gx = Math.round(world.x / this.cellSize);
      const gz = Math.round(world.z / this.cellSize);
      if (gx < this.minX || gx > this.maxX || gz < this.minZ || gz > this.maxZ) {
        return null;
      }
      return { x: gx, y: this.layer, z: gz };
    }

    updateHoverFromPointer(event) {
      if (!this.enabled) {
        this.hoverCell = null;
        this.hoverMesh.visible = false;
        return;
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
      if (!this.hoverCell || !this.enabled) {
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
        const existing = this.cells.get(key);
        if (existing) {
          this.group.remove(existing.mesh);
          existing.mesh.geometry.dispose();
          existing.mesh.material.dispose();
          this.cells.delete(key);
        }
        return;
      }

      const existing = this.cells.get(key);
      if (existing) {
        this.group.remove(existing.mesh);
        existing.mesh.geometry.dispose();
        existing.mesh.material.dispose();
      }

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(this.boxSize, this.boxSize, this.boxSize),
        this.createMaterial(this.selectedType, 0xffffff),
      );
      mesh.position.copy(this.cellToPosition(x, y, z));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.cells.set(key, { type: this.selectedType, x, y, z, mesh });
    }

    placeBlock(type, x, y, z) {
      if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ || y < 0 || y > 8) {
        return;
      }
      const key = this.getCellKey(x, y, z);
      const existing = this.cells.get(key);
      if (existing) {
        this.group.remove(existing.mesh);
        existing.mesh.geometry.dispose();
        existing.mesh.material.dispose();
      }

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(this.boxSize, this.boxSize, this.boxSize),
        this.createMaterial(type, 0xffffff),
      );
      mesh.position.copy(this.cellToPosition(x, y, z));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.cells.set(key, { type, x, y, z, mesh });
    }

    clear() {
      for (const entry of this.cells.values()) {
        this.group.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        entry.mesh.material.dispose();
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
        this.placeBlock(block.type || 'stone', Number(block.x), Number(block.y), Number(block.z));
      }
    }
  }

  const BLOCK_CONFIGS = [
    { id: 'stone', label: 'Stone', type: 'stone', color: 0xa5a9af, count: 18, entryT: 0.02 },
    { id: 'wood', label: 'Wood', type: 'wood', color: 0xc9a26d, count: 12, entryT: 0.02 },
    { id: 'grass', label: 'Grass', type: 'grass', color: 0x8bbf67, count: 9, entryT: 0.02 },
    { id: 'empty', label: 'Empty', empty: true },
  ];

  const canvas = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6e9f57);
  scene.fog = new THREE.Fog(0x6e9f57, 25, 50);

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
  const buildManager = new BuildManager(scene, {
    cellSize: 0.64,
    baseY: 0.34,
    createMaterial: createBlockMaterial,
  });
  buildManager.loadFromLevel(DEFAULT_EDITOR_LEVEL);
  const editor = new LevelEditor({
    scene,
    camera,
    canvas,
    cellSize: 0.64,
    baseY: 0.34,
    minX: -6,
    maxX: 6,
    minZ: -4,
    maxZ: 4,
    createMaterial: createBlockMaterial,
  });
  editor.loadJSON(DEFAULT_EDITOR_LEVEL);

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
    uiController.setCount(id, count);
  }

  function handleCycleFinish(id) {
    if (activeBlockId === id) {
      activeBlockId = null;
    }
    refreshUiLockState();
  }

  const uiController = new UIController(document.getElementById('slots'), BLOCK_CONFIGS, handleSlotClick);
  const blocks = new Map();

  for (const config of BLOCK_CONFIGS) {
    if (config.empty) {
      continue;
    }

    const controller = new BlockController({
      scene,
      trackController,
      buildManager,
      id: config.id,
      type: config.type,
      color: config.color,
      count: config.count,
      entryT: config.entryT,
      onCountChange: handleCountChange,
      onCycleFinish: handleCycleFinish,
    });

    blocks.set(config.id, controller);
  }

  const raycaster = new THREE.Raycaster();
  const mouseNdc = new THREE.Vector2();
  const anchorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.82);

  function screenToWorldOnAnchorPlane(x, y) {
    mouseNdc.x = (x / window.innerWidth) * 2 - 1;
    mouseNdc.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseNdc, camera);

    const point = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(anchorPlane, point);
    return hit ? point : null;
  }

  function syncUiAnchors() {
    for (const [id, controller] of blocks.entries()) {
      const center = uiController.getSlotCenter(id);
      if (!center) {
        continue;
      }

      const worldPoint = screenToWorldOnAnchorPlane(center.x, center.y);
      if (!worldPoint) {
        continue;
      }

      controller.setUiAnchor(worldPoint);
    }
  }

  function refreshUiLockState() {
    uiController.setCycleLock(activeBlockId);

    for (const [id, controller] of blocks.entries()) {
      const disabled = controller.getCount() <= 0 || (activeBlockId !== null && activeBlockId !== id);
      uiController.setDisabled(id, disabled);
      uiController.setCount(id, controller.getCount());
    }
  }

  function bindDebugEditorUI() {
    const enabledInput = document.getElementById('editor-enabled');
    const blockSelect = document.getElementById('editor-block');
    const layerInput = document.getElementById('editor-layer');
    const clearBtn = document.getElementById('editor-clear');
    const exportBtn = document.getElementById('editor-export');
    const applyBtn = document.getElementById('editor-apply');

    enabledInput.addEventListener('change', () => {
      editor.setEnabled(enabledInput.checked);
    });

    blockSelect.addEventListener('change', () => {
      editor.setType(blockSelect.value);
    });

    layerInput.addEventListener('change', () => {
      editor.setLayer(Number(layerInput.value));
      layerInput.value = String(editor.layer);
    });

    clearBtn.addEventListener('click', () => {
      editor.clear();
    });

    exportBtn.addEventListener('click', async () => {
      const text = editor.exportJSON();
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
      const data = JSON.parse(editor.exportJSON());
      buildManager.loadFromLevel(data);
    });

    editor.setType(blockSelect.value);
    editor.setLayer(Number(layerInput.value));
  }

  function step(dt) {
    syncUiAnchors();

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
      inventory: Array.from(blocks.entries()).map(([id, block]) => ({ id, count: block.getCount() })),
      build_progress: {
        built: buildManager.getBuiltCount(),
        total: buildManager.getTotalCount(),
      },
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
    syncUiAnchors();
  });

  canvas.addEventListener('pointermove', (event) => {
    editor.updateHoverFromPointer(event);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    editor.updateHoverFromPointer(event);
    editor.placeAtHover();
  });

  refreshUiLockState();
  syncUiAnchors();
  bindDebugEditorUI();
  animate();
})();
