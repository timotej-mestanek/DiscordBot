export type BlackMarketCrate = {
  id: string;
  name: string;
  previewImageUrl: string | null;
  openingVideoGoldUrl: string | null;
  openingVideoNormalUrl: string | null;
  quantity: number;
  requiresKey: boolean;
  keyQuantity: number;
  available: boolean;
};

export type BlackMarketKey = {
  crateId: string;
  crateName: string;
  quantity: number;
};

export type BlackMarketLevel = {
  level: number;
  imageUrl: string;
  upgradeCost: number | null;
  description: string;
};

export type BlackMarketInventoryItem = {
  id: string;
  name: string;
  group: string;
  itemType: "normal" | "progressive";
  imageUrl: string;
  useInputLabel: string | null;
  useInput: string | null;
  currentLevel: number;
  isEquipped: boolean;
  expiresAt: string | null;
  maxLevel: number;
  levels: BlackMarketLevel[];
};
