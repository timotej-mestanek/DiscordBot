"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type UploadType = "crate-preview" | "crate-texture" | "item-level";

export default function ImageUpload({
  type,
  value,
  onChange,
  label,
}: {
  type: UploadType;
  value: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be no larger than 5 MB.");
      return;
    }

    setBusy(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", type);
    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const result: { url?: string; error?: string } = await response.json();
      if (!response.ok || !result.url) {
        setError(result.error ?? "Could not upload the image.");
        return;
      }
      onChange(result.url);
    } catch (uploadError) {
      console.error("Black Market image upload failed:", uploadError);
      setError("Could not upload the image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-zinc-200">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <Image
            src={value}
            alt={`${label} preview`}
            width={96}
            height={72}
            unoptimized
            className="h-[4.5rem] w-24 rounded-lg border border-zinc-700 object-cover"
          />
        ) : (
          <div className="flex h-[4.5rem] w-24 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500">
            No image
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                setError("");
                onChange("");
              }}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-800 hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <p className="text-xs text-zinc-500">PNG, JPEG, or WebP; maximum 5 MB.</p>
    </div>
  );
}
