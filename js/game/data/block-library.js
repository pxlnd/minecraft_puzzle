(function () {
  const BLOCK_LIBRARY = [
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
    {
      id: 'stone_slab',
      label: 'Stone Slab',
      shape: 'slab',
      textureKey: 'stone',
      fallbackTexture: './assets/block/minecraft_stone.png',
      inventory: true,
      color: 0xa5a9af,
    },
    {
      id: 'wood_pillar',
      label: 'Wood Pillar',
      shape: 'pillar',
      textureKey: 'wood',
      fallbackTexture: './assets/block/wood.webp',
      inventory: true,
      color: 0xb88952,
    },
    {
      id: 'wood_stairs',
      label: 'Wood Stairs',
      shape: 'stairs',
      textureKey: 'wood',
      fallbackTexture: './assets/block/wood.webp',
      inventory: true,
      color: 0xb88952,
    },
  ];

  const byId = {};
  for (const block of BLOCK_LIBRARY) {
    byId[block.id] = block;
  }

  window.MC_BLOCK_LIBRARY = BLOCK_LIBRARY;
  window.MC_BLOCK_BY_ID = byId;
})();
