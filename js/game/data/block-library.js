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
      id: 'stone_stairs',
      label: 'Stone Stairs',
      shape: 'stairs',
      textureKey: 'stonebrick',
      fallbackTexture: './assets/Blocks/stonebrick.png',
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
    {
      id: 'lantern',
      label: 'Lantern',
      shape: 'cube',
      textureKey: 'wood',
      fallbackTexture: './assets/block/wood.webp',
      inventory: true,
      color: 0xffc15c,
    },
  ];

  const byId = {};
  for (const block of BLOCK_LIBRARY) {
    byId[block.id] = block;
  }

  window.MC_BLOCK_LIBRARY = BLOCK_LIBRARY;
  window.MC_BLOCK_BY_ID = byId;
})();
