(function () {
  function buildBlocks() {
    const blocks = [];

    for (let z = -3; z <= 3; z += 1) {
      for (let x = -5; x <= 5; x += 1) {
        blocks.push({ type: 'stone', x, y: 0, z });
      }
    }

    for (let z = -2; z <= 2; z += 1) {
      blocks.push({ type: 'stone_slab', x: -2, y: 1, z });
      blocks.push({ type: 'stone_slab', x: 2, y: 1, z });
    }

    for (let y = 1; y <= 3; y += 1) {
      blocks.push({ type: 'wood_pillar', x: -4, y, z: -2 });
      blocks.push({ type: 'wood_pillar', x: 4, y, z: -2 });
      blocks.push({ type: 'wood_pillar', x: -4, y, z: 2 });
      blocks.push({ type: 'wood_pillar', x: 4, y, z: 2 });
    }

    blocks.push({ type: 'wood_stairs', x: -1, y: 1, z: 2 });
    blocks.push({ type: 'wood_stairs', x: 0, y: 1, z: 2 });
    blocks.push({ type: 'wood_stairs', x: 1, y: 1, z: 2 });
    blocks.push({ type: 'door', x: 0, y: 1, z: -2 });

    return blocks;
  }

  const rails = [
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

  window.registerMinecraftLevel({
    id: 'forms_showcase',
    name: 'Forms Showcase',
    blocks: buildBlocks(),
    rails,
    minecart: { speed: 10.5 },
  });
})();
