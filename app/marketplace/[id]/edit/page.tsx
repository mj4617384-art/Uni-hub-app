"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const categories = ["electronics", "books", "fashion", "others"];

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("others");
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("title, description, price, category, image_urls")
        .eq("id", id)
        .single();
      if (error || !data) {
        setError("Listing not found.");
      } else {
        setTitle(data.title);
        setDescription(data.description ?? "");
        setPrice(String(data.price));
        setCategory(data.category);
        setExistingUrls(data.image_urls ?? []);
      }
      setFetching(false);
    }
    load();
  }, [id]);

  const totalPhotos = existingUrls.length + newFiles.length;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const combined = [...newFiles, ...selected].slice(0, 5 - existingUrls.length);
    setNewFiles(combined);
    setNewPreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function removeExisting(index: number) {
    setExistingUrls(existingUrls.filter((_, i) => i !== index));
  }

  function removeNew(index: number) {
    const updated = newFiles.filter((_, i) => i !== index);
    setNewFiles(updated);
    setNewPreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/auth");
      return;
    }

    const uploadedUrls: string[] = [];
    for (const file of newFiles) {
      const ext = file.name.split(".").pop();
      const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marketplace-images")
        .upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        setLoading(false);
        return;
      }
      const { data: publicUrl } = supabase.storage
        .from("marketplace-images")
        .getPublicUrl(path);
      uploadedUrls.push(publicUrl.publicUrl);
    }

    const { error } = await supabase
      .from("marketplace_items")
      .update({
        title,
        description,
        price: Number(price),
        category,
        image_urls: [...existingUrls, ...uploadedUrls],
      })
      .eq("id", id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/marketplace");
  }

  async function handleDelete() {
    setLoading(true);
    const { error } = await supabase.from("marketplace_items").delete().eq("id", id);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/marketplace");
  }

  if (fetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pt-5 pb-10">
      <button onClick={() => router.back()} aria-label="Back" className="mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <h1 className="text-xl font-semibold">Edit Listing</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Photos ({totalPhotos}/5)</span>
          <div className="flex flex-wrap gap-3">
            {existingUrls.map((src, i) => (
              <div key={`existing-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-hub-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExisting(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {newPreviews.map((src, i) => (
              <div key={`new-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-hub-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`New photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNew(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {totalPhotos < 5 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hub-border text-hub-textDim">
                <span className="text-xl leading-none">+</span>
                <span className="text-[10px]">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Price (₦)</span>
          <input
            required
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block text-hub-textDim">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded-xl border border-red-400/40 py-3.5 text-center font-medium text-red-400 disabled:opacity-60"
        >
          Delete Listing
        </button>
      </form>
    </main>
  );
}
