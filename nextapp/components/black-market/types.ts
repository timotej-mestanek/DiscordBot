export type BlackMarketCrate = {
  id: string;
  name: string;
  previewImageUrl: string | null;
  quantity: number;
};

export type BlackMarketLevel = {
  level: number;
  imageUrl: string;
  upgradeCost: number | null;
};

export type BlackMarketInventoryItem = {
  id: string;
  name: string;
  group: string;
  currentLevel: number;
  isEquipped: boolean;
  maxLevel: number;
  levels: BlackMarketLevel[];
};
