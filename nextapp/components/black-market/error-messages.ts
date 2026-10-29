export const ERROR_MESSAGES: Record<string, string> = {
  NO_CRATES: "You don't have any of this crate left.",
  CRATE_NOT_FOUND: "This crate is no longer available.",
  CRATE_INACTIVE: "This crate is not currently available.",
  NO_ITEMS_IN_CRATE: "This crate doesn't contain any items yet.",
  NOT_OWNED: "You don't own this item.",
  MAX_LEVEL: "This item is already at its maximum level.",
  NOT_ENOUGH_EGGS: "You don't have enough golden eggs.",
  LEVEL_DATA_MISSING: "Upgrade data for this item is missing.",
  UNAUTHENTICATED: "Please sign in again to use the Black Market.",
  FORBIDDEN: "This action isn't allowed for your account.",
  INTERNAL_ERROR: "The action couldn't be completed. Please try again.",
};

export function errorMessage(code: string) {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}
