export type UserIdentity = { id: string; name: string; points: number };

export type UserRow = {
  key: string;
  displayName: string;
  accountId: string | null;
  isTwitchFollower: boolean;
  goldenEggs: number | null;
  discord: UserIdentity | null;
  twitch: UserIdentity | null;
  shopInventory: Array<{ productId: string; name: string; quantity: number }>;
  blackMarketInventory: Array<{
    itemId: string;
    name: string;
    level: number;
    group: string;
    equipped: boolean;
  }>;
  crateInventory: Array<{ crateId: string; name: string; quantity: number }>;
};

export type UsersData = {
  users: UserRow[];
  shopProducts: Array<{ id: string; name: string }>;
  blackMarketItems: Array<{ id: string; name: string; group: string }>;
  crates: Array<{ id: string; name: string }>;
};

export type PointCurrency = "discord" | "twitch_custom";
export type InventoryAction =
  | {
      action: "shop-item" | "crate-item" | "black-market-item";
      itemId: string;
      operation: "add" | "remove";
      accountId: string;
    }
  | {
      action: "adjust-points";
      providerUserId: string;
      currency: PointCurrency;
      delta: number;
      reason: string;
    };
