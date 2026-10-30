"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import {
  createCrate,
  deleteCrate,
  updateCrate,
} from "@/lib/black-market/admin-actions";
import type { AdminActionResult } from "@/lib/black-market/admin-actions";

export type AdminCrate = {
  id: string;
  name: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  previewImageUrl: string | null;
  textureUrl: string | null;
  inventoryCount: number;
  itemCount: number;
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function ModelUpload({
  crateId,
  value,
  onChange,
}: {
  crateId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Artist exports: Y-up, unit scale, a hinged "lid" node, and <5 MB target (15 MB hard limit).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Choose a binary glTF (.glb) file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("3D models must be no larger than 15 MB.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(crateId)) {
      setError("Enter a valid crate ID before uploading its model.");
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", "crate-model");
    formData.set("crateId", crateId);
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const result: { url?: string; error?: string } = await response.json();
      if (!response.ok || !result.url) {
        setError(result.error ?? "Could not upload the 3D model.");
        return;
      }
      onChange(result.url);
    } catch (uploadError) {
      console.error("Black Market crate model upload failed:", uploadError);
      setError("Could not upload the 3D model.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-zinc-200">3D Model (.glb)</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">
          {value ? "3D model uploaded" : "No model; users see the 2D opening."}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
        >
          {busy ? "Uploading…" : value ? "Replace model" : "Upload .glb"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-800 hover:text-red-300">
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".glb,model/gltf-binary"
          className="sr-only"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
        />
      </div>
      <p className="text-xs text-zinc-500">Binary glTF 2.0, maximum 15 MB; model stored at black-market/crates/{crateId || "{id}"}/model.glb.</p>
      <p className="text-xs text-zinc-500">Artist guidance: Y-up, unit scale, and a node named &quot;lid&quot; for lid animation; aim for under 5 MB (15 MB hard limit). Crates without a model use the 2D opening.</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

function dateInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function actionError(result: AdminActionResult) {
  if (result.type === "success") return "";
  const messages: Record<string, string> = {
    FORBIDDEN: "You do not have permission to change crates.",
    VALIDATION_ERROR: "Check the crate details and date range.",
    NOT_FOUND: "This crate no longer exists. Refresh and try again.",
    CONFLICT: "A crate with this ID already exists.",
    CONFIRMATION_REQUIRED: "Confirm the deletion to continue.",
    INTERNAL_ERROR: "The crate could not be saved.",
  };
  return messages[result.code];
}

export default function CrateManager({
  editCrate,
}: {
  editCrate?: AdminCrate;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(editCrate?.previewImageUrl ?? "");
  const [textureUrl, setTextureUrl] = useState(editCrate?.textureUrl ?? "");
  const [crateId, setCrateId] = useState(editCrate?.id ?? "");

  const initialValues = editCrate;

  async function toggleActive() {
    if (!initialValues) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateCrate(initialValues.id, {
        id: initialValues.id,
        name: initialValues.name,
        active: !initialValues.active,
        startsAt: initialValues.startsAt,
        endsAt: initialValues.endsAt,
        previewImageUrl: initialValues.previewImageUrl,
        textureUrl: initialValues.textureUrl,
      });
      const message = actionError(result);
      if (message) {
        setError(message);
      } else {
        router.refresh();
      }
    } catch (toggleError) {
      console.error("Black Market crate visibility update failed:", toggleError);
      setError("Could not change crate visibility.");
    } finally {
      setBusy(false);
    }
  }

  async function save(formData: FormData) {
    setBusy(true);
    setError("");
    const rawStarts = String(formData.get("startsAt") ?? "");
    const rawEnds = String(formData.get("endsAt") ?? "");
    const input = {
      id: String(formData.get("id") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      active: formData.get("active") === "on",
      startsAt: dateInput(rawStarts),
      endsAt: dateInput(rawEnds),
      previewImageUrl: previewUrl || null,
      textureUrl: textureUrl || null,
    };
    try {
      const result = initialValues
        ? await updateCrate(initialValues.id, input)
        : await createCrate(input);
      const message = actionError(result);
      if (message) {
        setError(message);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      console.error("Black Market crate save failed:", saveError);
      setError("The crate could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initialValues) return;
    const warning = initialValues.inventoryCount > 0
      ? ` This also removes ${initialValues.inventoryCount} users' crate inventory records.`
      : "";
    if (!window.confirm(`Delete crate "${initialValues.name}"?${warning} This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await deleteCrate(initialValues.id);
      const message = actionError(result);
      if (message) {
        setError(message);
        return;
      }
      router.refresh();
    } catch (removeError) {
      console.error("Black Market crate deletion failed:", removeError);
      setError("The crate could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  if (!editCrate) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500"
        >
          Create Crate
        </button>
        {open && (
          <CrateForm
            busy={busy}
            error={error}
            crateId={crateId}
            onCrateIdChange={setCrateId}
            previewUrl={previewUrl}
            textureUrl={textureUrl}
            onPreviewChange={setPreviewUrl}
            onTextureChange={setTextureUrl}
            onClose={() => setOpen(false)}
            onSubmit={save}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleActive()}
        aria-label={`${editCrate.active ? "Deactivate" : "Activate"} ${editCrate.name}`}
        className={`rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${
          editCrate.active
            ? "border-emerald-900 text-emerald-300 hover:bg-emerald-950/40"
            : "border-zinc-700 text-zinc-400 hover:border-emerald-900 hover:text-emerald-300"
        }`}
      >
        {editCrate.active ? "Active" : "Inactive"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="rounded-lg border border-red-900 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-50"
      >
        Delete
      </button>
      </div>
      {error && !open && <span role="alert" className="max-w-48 text-right text-xs text-red-300">{error}</span>}
      {open && (
        <CrateForm
          crate={editCrate}
          busy={busy}
          error={error}
          crateId={crateId}
          onCrateIdChange={setCrateId}
          previewUrl={previewUrl}
          textureUrl={textureUrl}
          onPreviewChange={setPreviewUrl}
          onTextureChange={setTextureUrl}
          onClose={() => setOpen(false)}
          onSubmit={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function CrateForm({
  crate,
  busy,
  error,
  crateId,
  onCrateIdChange,
  previewUrl,
  textureUrl,
  onPreviewChange,
  onTextureChange,
  onClose,
  onSubmit,
  onDelete,
}: {
  crate?: AdminCrate;
  busy: boolean;
  error: string;
  crateId: string;
  onCrateIdChange: (value: string) => void;
  previewUrl: string;
  textureUrl: string;
  onPreviewChange: (value: string) => void;
  onTextureChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <form
        action={onSubmit}
        className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{crate ? "Edit crate" : "Create crate"}</h2>
            <p className="mt-1 text-sm text-zinc-400">Set schedule and artwork.</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-300">
            <span className="block">ID (slug)</span>
            <input
              name="id"
              required
              maxLength={64}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={crateId}
              onChange={(event) => onCrateIdChange(event.currentTarget.value)}
              readOnly={!!crate || !!textureUrl}
              placeholder="summer-crate"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white read-only:text-zinc-500"
            />
          </label>
          <label className="space-y-2 text-sm text-zinc-300">
            <span className="block">Name</span>
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={crate?.name}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-2 text-sm text-zinc-300">
            <span className="block">Starts at</span>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={localDateTime(crate?.startsAt ?? null)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-2 text-sm text-zinc-300">
            <span className="block">Ends at</span>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={localDateTime(crate?.endsAt ?? null)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input type="checkbox" name="active" defaultChecked={crate?.active ?? true} />
          Active and visible to users
        </label>
        <ImageUpload type="crate-preview" label="Preview image" value={previewUrl} onChange={onPreviewChange} />
        <ModelUpload crateId={crateId} value={textureUrl} onChange={onTextureChange} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-4">
          {onDelete && (
            <button type="button" disabled={busy} onClick={onDelete} className="mr-auto rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50">
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
            {busy ? "Saving…" : "Save crate"}
          </button>
        </div>
      </form>
    </div>
  );
}
