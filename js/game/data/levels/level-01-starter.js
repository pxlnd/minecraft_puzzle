(function () {
  function buildBlocks() {
    const blocks = [];

    for (let z = -4; z <= 5; z += 1) {
      for (let x = -4; x <= 4; x += 1) {
        blocks.push({ type: 'stone', x, y: 0, z });
      }
    }

    for (let x = -2; x <= 2; x += 1) {
      for (let z = -2; z <= 2; z += 1) {
        const isPerimeter = x === -2 || x === 2 || z === -2 || z === 2;
        if (!isPerimeter) {
          continue;
        }
        if (x === 0 && z === 2) {
          continue;
        }
        blocks.push({ type: 'wood_pillar', x, y: 1, z });
      }
    }

    for (let x = -2; x <= 2; x += 1) {
      for (let z = -2; z <= 2; z += 1) {
        const isPerimeter = x === -2 || x === 2 || z === -2 || z === 2;
        if (isPerimeter) {
          blocks.push({ type: 'wood', x, y: 2, z });
        }
      }
    }

    blocks.push({ type: 'door', x: 0, y: 1, z: 2 });
    blocks.push({ type: 'lantern', x: -1, y: 2, z: 2 });
    blocks.push({ type: 'lantern', x: 1, y: 2, z: 2 });

    for (let x = -1; x <= 1; x += 1) {
      for (let z = -1; z <= 1; z += 1) {
        blocks.push({ type: 'wood', x, y: 3, z });
      }
    }

    for (let x = -2; x <= 2; x += 1) {
      blocks.push({ type: 'wood_stairs', x, y: 3, z: -3 });
      blocks.push({ type: 'wood_stairs', x, y: 3, z: 3 });
    }
    for (let z = -2; z <= 2; z += 1) {
      blocks.push({ type: 'wood_stairs', x: -3, y: 3, z });
      blocks.push({ type: 'wood_stairs', x: 3, y: 3, z });
    }
    blocks.push({ type: 'wood_stairs', x: 0, y: 4, z: 0 });

    blocks.push({ type: 'stone_slab', x: 0, y: 0, z: 3 });
    blocks.push({ type: 'stone_slab', x: 0, y: 0, z: 4 });

    blocks.push({ type: 'stone', x: -1, y: 0, z: 5 });
    blocks.push({ type: 'stone', x: 0, y: 0, z: 5 });
    blocks.push({ type: 'stone', x: 1, y: 0, z: 5 });
    blocks.push({ type: 'stone', x: -1, y: 1, z: 5 });
    blocks.push({ type: 'stone', x: 1, y: 1, z: 5 });
    blocks.push({ type: 'stone', x: -1, y: 0, z: 6 });
    blocks.push({ type: 'stone', x: 0, y: 0, z: 6 });
    blocks.push({ type: 'stone', x: 1, y: 0, z: 6 });

    return blocks;
  }

  function buildRails() {
    const rails = [];
    const min = -7;
    const max = 7;

    for (let x = min + 1; x <= max - 1; x += 1) {
      rails.push({ type: 'straight', x, z: max, yaw: Math.PI * 0.5 });
    }
    for (let z = max - 1; z >= min + 1; z -= 1) {
      rails.push({ type: 'straight', x: max, z, yaw: 0 });
    }
    for (let x = max - 1; x >= min + 1; x -= 1) {
      rails.push({ type: 'straight', x, z: min, yaw: Math.PI * 0.5 });
    }
    for (let z = min + 1; z <= max - 1; z += 1) {
      rails.push({ type: 'straight', x: min, z, yaw: 0 });
    }

    rails.push({ type: 'corner', x: min, z: max, yaw: Math.PI * 1.5 });
    rails.push({ type: 'corner', x: max, z: max, yaw: 0 });
    rails.push({ type: 'corner', x: max, z: min, yaw: Math.PI * 0.5 });
    rails.push({ type: 'corner', x: min, z: min, yaw: Math.PI });
    return rails;
  }

  window.registerMinecraftLevel({
    id: 'starter_plaza',
    name: 'Small Starter House',
    blocks: buildBlocks(),
    rails: buildRails(),
    minecart: { speed: 11 },
  });
})();
