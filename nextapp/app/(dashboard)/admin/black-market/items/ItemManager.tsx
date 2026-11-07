"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createItem,
  deleteItem,
  updateItem,
} from "@/lib/black-market/admin-actions";
import type { AdminActionResult } from "@/lib/black-market/admin-actions";
import ImageUpload from "@/components/admin/ImageUpload";

export type AdminItem = {
  id: string;
  name: string;
  group: string;
  overlayConfig: unknown;
  itemType: "normal" | "progressive" | "golden_eggs";
  imageUrl: string;
  useInputLabel: string | null;
  maxLevel: number;
  expiry: "permanent" | "seven_days" | "thirty_days" | "event_end";
  shopEnabled: boolean;
  shopDiscordPrice: number | null;
  shopTwitchPrice: number | null;
  ownedCount: number;
};

type CrateOption = { id: string; name: string };
type CrateSettings = {
  selected: boolean;
  dropChance: string;
  goldenEggs: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isJsonValue)
  );
}

function actionError(result: AdminActionResult<unknown>) {
  if (result.type === "success") return "";
  const messages: Record<string, string> = {
    FORBIDDEN: "You do not have permission to change items.",
    VALIDATION_ERROR: "Check the item ID, name, group, image, level settings, and selected crate.",
    NOT_FOUND: "This item no longer exists. Refresh and try again.",
    CONFLICT: "This item conflicts with an existing item or crate reward.",
    ITEM_ID_CONFLICT: "An item with this ID already exists. Choose another ID, or delete the existing item first.",
    EGG_REWARD_EXISTS: "A Golden Eggs currency item already exists.",
    CRATE_REWARD_EXISTS: "That crate already has this Golden Eggs reward amount.",
    CONFIRMATION_REQUIRED: "Confirm the deletion to continue.",
    INTERNAL_ERROR: "The item could not be saved.",
  };
  return messages[result.code];
}

export default function ItemManager({
  item,
  crates,
}: {
  item?: AdminItem;
  crates: CrateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ownedCount, setOwnedCount] = useState(item?.ownedCount ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [itemType, setItemType] = useState<"normal" | "progressive" | "golden_eggs">(
    item?.itemType ?? "progressive",
  );
  const [group, setGroup] = useState(item?.group ?? "chat");
  const [overlayConfigText, setOverlayConfigText] = useState(
    JSON.stringify(item?.overlayConfig ?? { elements: [] }, null, 2),
  );
  const [shopEnabled, setShopEnabled] = useState(item?.shopEnabled ?? false);
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [crateSettings, setCrateSettings] = useState<Record<string, CrateSettings>>(
    Object.fromEntries(crates.map((crate) => [
      crate.id,
      { selected: false, dropChance: "1", goldenEggs: "10" },
    ])),
  );

  async function save(formData: FormData) {
    if (!imageUrl) {
      setError("Upload an image before saving the item.");
      return;
    }
    let overlayConfig: JsonObject | undefined;
    if (group === "overlay" && itemType === "progressive") {
      try {
        const parsed: unknown = JSON.parse(overlayConfigText);
        if (!isJsonObject(parsed)) {
          setError("Overlay configuration must be a JSON object.");
          return;
        }
        overlayConfig = parsed;
      } catch {
        setError("Overlay configuration must contain valid JSON.");
        return;
      }
    }
    setBusy(true);
    setError("");
    const sellInShop = shopEnabled && itemType !== "golden_eggs";
    const input = {
      id: String(formData.get("id") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      group: String(formData.get("group") ?? "").trim().toLowerCase(),
      itemType,
      ...(overlayConfig ? { overlay_config: overlayConfig } : {}),
      useInputLabel: itemType === "golden_eggs"
        ? null
        : String(formData.get("useInputLabel") ?? "").trim() || null,
      imageUrl,
      maxLevel: itemType === "progressive" ? Number(formData.get("maxLevel")) : 1,
      expiry: itemType === "normal"
        ? String(formData.get("expiry") ?? "permanent") as AdminItem["expiry"]
        : "permanent",
      shopEnabled: sellInShop,
      shopDiscordPrice: sellInShop && String(formData.get("shopDiscordPrice") ?? "")
        ? Number(formData.get("shopDiscordPrice"))
        : null,
      shopTwitchPrice: sellInShop && String(formData.get("shopTwitchPrice") ?? "")
        ? Number(formData.get("shopTwitchPrice"))
        : null,
      crateAssignments: item
        ? []
        : crates.flatMap((crate) => {
            const settings = crateSettings[crate.id];
            if (!settings?.selected) return [];
            return [{
              crateId: crate.id,
              dropChance: Number(settings.dropChance),
              goldenEggs: itemType === "golden_eggs"
                ? Number(settings.goldenEggs)
                : null,
            }];
          }),
    };
    try {
      const result = item ? await updateItem(item.id, input) : await createItem(input);
      const message = actionError(result);
      if (message) {
        setError(message);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      console.error("Black Market item save failed:", saveError);
      setError("The item could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || (ownedCount > 0 && !confirmDelete)) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteItem(item.id, confirmDelete);
      if (result.type === "error" && result.code === "CONFIRMATION_REQUIRED") {
        setOwnedCount(result.data.ownedCount);
        setConfirmDelete(true);
        return;
      }
      const message = actionError(result);
      if (message) {
        setError(message);
        return;
      }
      setConfirmDelete(false);
      setOpen(false);
      router.refresh();
    } catch (removeError) {
      console.error("Black Market item deletion failed:", removeError);
      setError("The item could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={item
          ? "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500"
          : "rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500"}
      >
        {item ? "Edit" : "Create Item"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            action={save}
            role="dialog"
            aria-modal="true"
            aria-label={item ? "Edit Black Market item" : "Create Black Market item"}
            className="app-fixed-dialog app-fixed-dialog--wide space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{item ? "Edit item" : "Create item"}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {item ? "Update the item image and settings." : "Choose the item type, image, and optional crate."}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">ID (slug)</span>
                <input
                  name="id"
                  required
                  maxLength={64}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  readOnly={!!item}
                  defaultValue={item?.id}
                  placeholder="golden-crown"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white read-only:text-zinc-500"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Name</span>
                <input name="name" required maxLength={100} defaultValue={item?.name} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Group</span>
                <select
                  name="group"
                  required
                  value={group}
                  onChange={(event) => setGroup(event.currentTarget.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                >
                  <option value="emote">Emote</option>
                  <option value="chat">Chat</option>
                  <option value="overlay">Overlay</option>
                </select>
              </label>
              {!item ? (
                <label className="space-y-2 text-sm text-zinc-300">
                  <span className="block">Item type</span>
                  <select
                    value={itemType}
                    onChange={(event) => setItemType(event.currentTarget.value as "normal" | "progressive" | "golden_eggs")}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  >
                    <option value="progressive">Progressive — has levels</option>
                    <option value="normal">Normal — no levels</option>
                    <option value="golden_eggs">Golden Eggs — currency, not inventory</option>
                  </select>
                </label>
              ) : (
                <div className="space-y-2 text-sm text-zinc-300">
                  <span className="block">Item type</span>
                  <p className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
                    {item.itemType === "progressive"
                      ? "Progressive"
                      : item.itemType === "golden_eggs"
                        ? "Golden Eggs currency"
                        : "Normal"}
                  </p>
                </div>
              )}
              {itemType !== "golden_eggs" && (
                <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
                  <span className="block">Optional text input when equipping</span>
                  <input
                    name="useInputLabel"
                    maxLength={100}
                    defaultValue={item?.useInputLabel ?? ""}
                    placeholder="For example: Enter the target username"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                  <span className="block text-xs text-zinc-500">
                    Leave blank if the user does not need to enter any text.
                  </span>
                </label>
              )}
              {itemType === "progressive" ? (
                <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Maximum level</span>
                <input name="maxLevel" type="number" min={1} max={100} required defaultValue={item?.maxLevel ?? 6} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
                </label>
              ) : <input type="hidden" name="maxLevel" value={1} />}
              {group === "overlay" && itemType === "progressive" && (
                <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
                  <span className="block">Overlay configuration (JSON)</span>
                  <textarea
                    value={overlayConfigText}
                    onChange={(event) => setOverlayConfigText(event.currentTarget.value)}
                    rows={12}
                    spellCheck={false}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-white"
                    placeholder={'{\n  "elements": []\n}'}
                  />
                  <span className="block text-xs text-zinc-500">
                    Define the overlay elements and their minimum levels.
                  </span>
                </label>
              )}
              {itemType === "normal" && (
                <label className="space-y-2 text-sm text-zinc-300">
                  <span className="block">Ownership duration</span>
                  <select
                    name="expiry"
                    defaultValue={item?.expiry ?? "permanent"}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  >
                    <option value="permanent">Permanent</option>
                    <option value="seven_days">7 days after obtaining</option>
                    <option value="thirty_days">30 days after obtaining</option>
                    <option value="event_end">Until the season / crate event ends</option>
                  </select>
                </label>
              )}
            </div>
            {itemType !== "golden_eggs" && (
              <fieldset className="rounded-xl border border-zinc-800 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <input
                      name="shopEnabled"
                      type="checkbox"
                      checked={shopEnabled}
                      onChange={(event) => setShopEnabled(event.currentTarget.checked)}
                    />
                    Sell this item in the Black Market Shop
                  </label>
                  {shopEnabled && (
                    <>
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        Discord
                        <input
                          name="shopDiscordPrice"
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Price"
                          defaultValue={item?.shopDiscordPrice ?? ""}
                          className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        Twitch
                        <input
                          name="shopTwitchPrice"
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Price"
                          defaultValue={item?.shopTwitchPrice ?? ""}
                          className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white"
                        />
                      </label>
                    </>
                  )}
                </div>
              </fieldset>
            )}
            <ImageUpload
              type="item-level"
              label={itemType === "progressive" ? "Item image (level 1)" : "Item image"}
              value={imageUrl}
              onChange={setImageUrl}
            />
            {itemType === "progressive" && item && (
              <p className="text-xs text-zinc-500">
                Higher level images and upgrade costs are managed on the item levels page.
              </p>
            )}
            {!item && crates.length > 0 && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-zinc-200">
                  Add to crates (optional; select any number)
                </legend>
                <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  {crates.map((crate) => {
                    const settings = crateSettings[crate.id];
                    return (
                      <div key={crate.id} className="space-y-2 rounded-lg border border-zinc-800 p-3">
                        <label className="flex items-center gap-2 text-sm text-zinc-200">
                          <input
                            type="checkbox"
                            checked={settings?.selected ?? false}
                            onChange={(event) => {
                              const selected = event.currentTarget.checked;
                              setCrateSettings((current) => ({
                                ...current,
                                [crate.id]: {
                                  ...current[crate.id],
                                  selected,
                                },
                              }));
                            }}
                          />
                          {crate.name}
                        </label>
                        {settings?.selected && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1 text-xs text-zinc-400">
                              <span className="block">Drop chance (%)</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                required
                                value={settings.dropChance}
                                onChange={(event) => {
                                  const dropChance = event.currentTarget.value;
                                  setCrateSettings((current) => ({
                                    ...current,
                                    [crate.id]: {
                                      ...current[crate.id],
                                      dropChance,
                                    },
                                  }));
                                }}
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                              />
                            </label>
                            {itemType === "golden_eggs" && (
                              <label className="space-y-1 text-xs text-zinc-400">
                                <span className="block">Egg amount</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={1_000_000_000}
                                  required
                                  value={settings.goldenEggs}
                                  onChange={(event) => {
                                    const goldenEggs = event.currentTarget.value;
                                    setCrateSettings((current) => ({
                                      ...current,
                                      [crate.id]: {
                                        ...current[crate.id],
                                        goldenEggs,
                                      },
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-4">
              {item && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ownedCount > 0 ? setConfirmDelete(true) : void remove()}
                  className="mr-auto rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
                {busy ? "Saving…" : "Save item"}
              </button>
            </div>
          </form>
          {confirmDelete && item && (
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-item-title" className="app-dialog-backdrop">
              <div className="app-confirm-dialog">
                <div className="app-confirm-copy">
                <p className="app-confirm-eyebrow">Destructive action</p>
                <h3 id="delete-item-title" className="text-xl font-bold text-red-200">Delete an owned item?</h3>
                <p className="text-sm leading-6 text-zinc-300">
                  <strong>{ownedCount} user{ownedCount === 1 ? "" : "s"}</strong> currently own this item. Deleting it permanently removes it from their inventories, removes it from crates, and deletes all level data.
                </p>
                {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="app-confirm-button app-confirm-cancel">
                    Keep item
                  </button>
                  <button type="button" disabled={busy} onClick={() => void remove()} className="app-confirm-button app-confirm-danger disabled:opacity-50">
                    {busy ? "Deleting…" : "Delete item and owned copies"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
