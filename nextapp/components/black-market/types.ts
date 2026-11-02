export type BlackMarketCrate = {
  id: string;
  name: string;
  previewImageUrl: string | null;
  textureUrl: string | null;
  quantity: number;
  requiresKey: boolean;
  keyQuantity: number;
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
  itemType: "normal" | "progressive";
  imageUrl: string;
  currentLevel: number;
  isEquipped: boolean;
  expiresAt: string | null;
  maxLevel: number;
  levels: BlackMarketLevel[];
};
