"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ICONS = [
  { key: "academic", label: "Academic", emoji: "🎓" },
  { key: "tech", label: "Technology", emoji: "💻" },
  { key: "sports", label: "Sports", emoji: "⚽" },
  { key: "gaming", label: "Gaming", emoji: "🎮" },
];

const CATEGORIES = [
  "Academic",
  "Technology",
  "Sports",
  "Entertainment",
  "Gaming",
  "Faculty",
  "Department",
  "Social",
  "Other",
];

const DESCRIPTION_MAX = 160;
const RULES_MAX = 200;

export default function CreateCommunityPage() {
  const router = useRouter();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [iconKey, setIconKey] = useState<string>(ICONS[0].key);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [scope, setScope] = useState<"campus" | "all">("campus");
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhotoPick(file: File) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a community name.");
      return;
    }
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/auth");
      return;
    }

    let photoUrl: string | null = null;
    if (photoFile) {
      const path = `${userData.user.id}/${Date.now()}-${photoFile.name}`;
      const { error: upErr } = await supabase.storage.from("community-photos").upload(path, photoFile);
      if (upErr) {
        setLoading(false);
        setError("Photo upload failed: " + upErr.message);
        return;
      }
      const { data: urlData } = supabase.storage.from("community-photos").getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const { data: community, error: createErr } = await supabase
      .from("communities")
      .insert({
        creator_id: userData.user.id,
        name: name.trim(),
        description: description.trim() || null,
        photo_url: photoUrl,
        icon_key: photoUrl ? null : iconKey,
        category,
        privacy,
        scope,
        rules: rules.trim() || null,
      })
      .select()
      .single();

    if (createErr) {
      setLoading(false);
      setError(createErr.message);
      return;
    }

    // Creator becomes Owner and a member, in the same step — the group
    // space itself is just this community row plus this membership; there's
    // no separate "create the chat" step.
    const { error: memberErr } = await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: userData.user.id,
      role: "owner",
    });

    setLoading(false);
    if (memberErr) {
      setError(memberErr.message);
      return;
    }

    router.push(`/communities/${community.id}`);
  }

  return (
    <main className="min-h-screen bg-hub-bg px-5 pt-5 pb-10">
      <button onClick={() => router.back()} aria-label="Back" className="mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <h1 className="text-xl font-semibold text-white">Create Community</h1>
      <p className="mt-1 text-sm text-hub-textDim">Start a space for people who share your interests.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-white">Community Photo</p>
          <p className="mb-2 text-xs text-hub-textDim">Add a photo or choose from our icons</p>
          <div className="flex gap-2 overflow-x-auto">
            <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-hub-border bg-hub-card2">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <PhotoIcon />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handlePhotoPick(e.target.files[0]); }}
              />
            </label>
            {ICONS.map((icon) => (
              <button
                key={icon.key}
                type="button"
                onClick={() => { setIconKey(icon.key); setPhotoFile(null); setPhotoPreview(null); }}
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border text-2xl ${
                  !photoPreview && iconKey === icon.key ? "border-hub-accentLight bg-hub-accentLight/10" : "border-hub-border bg-hub-card2"
                }`}
              >
                {icon.emoji}
              </button>
            ))}
          </div>
        </div>

        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-white">Community Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cyber Security Hub"
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-white">Description</span>
          <p className="mb-1.5 text-xs text-hub-textDim">Tell people what this community is about, what they can discuss and who it's meant for.</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            placeholder="A community for..."
            rows={3}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
          <p className="mt-1 text-right text-[11px] text-hub-textDim">{description.length}/{DESCRIPTION_MAX}</p>
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-white">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <span className="mb-1.5 block font-medium text-white">Community Type</span>
          <p className="mb-2 text-xs text-hub-textDim">Decide who can join your community</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPrivacy("public")}
              className={`rounded-xl border p-3 text-left ${privacy === "public" ? "border-hub-accentLight bg-hub-accentLight/10" : "border-hub-border bg-hub-card2"}`}
            >
              <p className="text-sm font-medium text-white">Public</p>
              <p className="mt-0.5 text-[11px] text-hub-textDim">Anyone on UniHub can join</p>
            </button>
            <button
              type="button"
              onClick={() => setPrivacy("private")}
              className={`rounded-xl border p-3 text-left ${privacy === "private" ? "border-hub-accentLight bg-hub-accentLight/10" : "border-hub-border bg-hub-card2"}`}
            >
              <p className="text-sm font-medium text-white">Private</p>
              <p className="mt-0.5 text-[11px] text-hub-textDim">Members need approval to join</p>
            </button>
          </div>
        </div>

        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-white">Community Scope</span>
          <p className="mb-1.5 text-xs text-hub-textDim">Choose who can discover this community</p>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "campus" | "all")}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          >
            <option value="campus">My Campus — only students from your university</option>
            <option value="all">All of UniHub</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-white">Community Rules (optional)</span>
          <p className="mb-1.5 text-xs text-hub-textDim">Set basic rules members should follow.</p>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value.slice(0, RULES_MAX))}
            placeholder="e.g. No spam, Respect other members, No unrelated posts..."
            rows={3}
            className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
          />
          <p className="mt-1 text-right text-[11px] text-hub-textDim">{rules.length}/{RULES_MAX}</p>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Community"}
        </button>
      </form>
    </main>
  );
}

function PhotoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-hub-textDim">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
