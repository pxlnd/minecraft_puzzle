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

  const GROUND_GRASS_TEXTURE = loadTexture(TEXTURE_DATA.grass || './assets/grass.png', {
    repeatX: 4,
    repeatY: 4,
  });

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
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

      const theta = -Math.PI + d / r;
      return target.set(-halfW + r + r * Math.cos(theta), this.y, halfH - r + r * Math.sin(theta));
    }

    getTangent(t, target = new THREE.Vector3()) {
      const epsilon = 0.0005;
      const before = this.getPoint(t - epsilon, new THREE.Vector3());
      const after = this.getPoint(t + epsilon, new THREE.Vector3());
      return target.copy(after).sub(before).normalize();
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

      this.outerWidth = 16.8;
      this.outerHeight = 11.2;
      this.outerRadius = 2.05;

      this.innerWidth = 13.8;
      this.innerHeight = 8.2;
      this.innerRadius = 1.35;

      this.pathWidth = 15.3;
      this.pathHeight = 9.7;
      this.pathRadius = 1.7;

      this.pathY = 0.32;
      this.blockLift = 0.55;

      this.curve = new RoundedRectTrackCurve(this.pathWidth, this.pathHeight, this.pathRadius, this.pathY);

      this.createMeshes();
    }

    createMeshes() {
      const ringShape = new THREE.Shape();
      addRoundedRect(ringShape, this.outerWidth, this.outerHeight, this.outerRadius);

      const holePath = new THREE.Path();
      addRoundedRect(holePath, this.innerWidth, this.innerHeight, this.innerRadius);
      ringShape.holes.push(holePath);

      const contourGeometry = new THREE.ExtrudeGeometry(ringShape, {
        depth: 0.58,
        bevelEnabled: false,
        curveSegments: 28,
      });
      contourGeometry.rotateX(-Math.PI * 0.5);
      contourGeometry.translate(0, 0.02, 0);

      const contour = new THREE.Mesh(
        contourGeometry,
        new THREE.MeshStandardMaterial({
          color: 0xb8b8b8,
          roughness: 0.72,
          metalness: 0.06,
        }),
      );
      contour.receiveShadow = true;
      contour.castShadow = true;
      this.scene.add(contour);

      const centerGround = new THREE.Mesh(
        new THREE.PlaneGeometry(this.innerWidth - 0.35, this.innerHeight - 0.35),
        new THREE.MeshStandardMaterial({ color: 0x8a4f2c, roughness: 0.92, metalness: 0.02 }),
      );
      centerGround.rotation.x = -Math.PI * 0.5;
      centerGround.position.y = 0.03;
      centerGround.receiveShadow = true;
      this.scene.add(centerGround);

      const motionStrip = new THREE.Mesh(
        new THREE.TubeGeometry(this.curve, 220, 0.11, 10, true),
        new THREE.MeshStandardMaterial({ color: 0x7f7f7f, roughness: 0.8, metalness: 0.08 }),
      );
      motionStrip.castShadow = false;
      motionStrip.receiveShadow = true;
      this.scene.add(motionStrip);
    }

    getPointAt(t, target = new THREE.Vector3()) {
      return this.curve.getPoint(t, target);
    }

    getTangentAt(t, target = new THREE.Vector3()) {
      return this.curve.getTangent(t, target);
    }
  }

  function createHousePositions() {
    const unit = 0.64;
    const baseY = 0.34;
    const used = new Set();
    const result = [];

    function add(x, level, z) {
      const key = `${x}:${level}:${z}`;
      if (used.has(key)) {
        return;
      }
      used.add(key);
      result.push(new THREE.Vector3(x * unit, baseY + level * unit, z * unit));
    }

    // 1) Floor slab (12 blocks): x -2..1, z -1..1
    for (let z = -1; z <= 1; z += 1) {
      for (let x = -2; x <= 1; x += 1) {
        add(x, 0, z);
      }
    }

    // 2) First wall layer with doorway on the front (9 blocks)
    for (let x = -2; x <= 1; x += 1) {
      add(x, 1, -1); // back wall
      if (x !== -1) {
        add(x, 1, 1); // front wall with one-tile door gap
      }
    }
    add(-2, 1, 0);
    add(1, 1, 0);

    // 3) Second wall layer + front supports (8 blocks)
    for (let x = -2; x <= 1; x += 1) {
      add(x, 2, -1); // back wall top row
    }
    add(-2, 2, 0);
    add(1, 2, 0);
    add(-2, 2, 1);
    add(0, 2, 1);

    // 4) Roof body (6 blocks)
    for (let z = -1; z <= 0; z += 1) {
      for (let x = -1; x <= 1; x += 1) {
        add(x, 3, z);
      }
    }

    // 5) Roof cap (4 blocks)
    for (let z = -1; z <= 0; z += 1) {
      for (let x = 0; x <= 1; x += 1) {
        add(x, 4, z);
      }
    }

    return result;
  }

  class BuildManager {
    constructor(scene) {
      this.scene = scene;
      this.slots = createHousePositions().map((position) => ({ position, state: 'free' }));
      this.markerMeshes = [];
      this.builtMeshes = [];

      const markerGeometry = new THREE.BoxGeometry(0.58, 0.58, 0.58);
      for (const slot of this.slots) {
        const marker = new THREE.Mesh(
          markerGeometry,
          new THREE.MeshStandardMaterial({
            color: 0xd9c8b7,
            transparent: true,
            opacity: 0.12,
            roughness: 0.7,
            metalness: 0,
          }),
        );
        marker.position.copy(slot.position);
        this.scene.add(marker);
        this.markerMeshes.push(marker);
      }
    }

    reserveNext() {
      for (let i = 0; i < this.slots.length; i += 1) {
        if (this.slots[i].state !== 'free') {
          continue;
        }
        this.slots[i].state = 'reserved';
        this.markerMeshes[i].material.opacity = 0.03;
        return { index: i, position: this.slots[i].position.clone() };
      }
      return null;
    }

    commit(index, type, color) {
      const slot = this.slots[index];
      if (!slot || slot.state !== 'reserved') {
        return false;
      }

      slot.state = 'built';
      this.markerMeshes[index].visible = false;

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.58, 0.58),
        createBlockMaterial(type, color),
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

      const reserved = this.buildManager.reserveNext();
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
          this.buildManager.commit(projectile.index, this.type, this.color);
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

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xfff8e9, 0.92);
  directionalLight.position.set(8, 18, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left = -16;
  directionalLight.shadow.camera.right = 16;
  directionalLight.shadow.camera.top = 16;
  directionalLight.shadow.camera.bottom = -16;
  scene.add(directionalLight);

  const worldGround = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({
      map: GROUND_GRASS_TEXTURE,
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
    }),
  );
  worldGround.rotation.x = -Math.PI * 0.5;
  worldGround.position.y = 0;
  worldGround.receiveShadow = true;
  scene.add(worldGround);

  const trackController = new TrackController(scene);
  const buildManager = new BuildManager(scene);
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
