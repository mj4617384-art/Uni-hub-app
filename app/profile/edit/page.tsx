"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileForm = {
  first_name: string;
  last_name: string;
  username: string;
  bio: string;
  date_of_birth: string;
  gender: string;
  university: string;
  faculty: string;
  department: string;
  level: string;
  campus: string;
  graduation_year: string;
  website_url: string;
  instagram_handle: string;
  linkedin_url: string;
  twitter_handle: string;
  interests: string[];
  profile_visibility: string;
  follow_visibility: string;
  message_visibility: string;
  comment_visibility: string;
  show_university_info: boolean;
};

const FACULTY_OPTIONS = [
  "Faculty of Computing",
  "Faculty of Science",
  "Faculty of Engineering",
  "Faculty of Arts",
  "Faculty of Social Sciences",
  "Faculty of Law",
  "Faculty of Management Sciences",
  "Faculty of Education",
  "Faculty of Agriculture",
  "Faculty of Medicine",
];
const DEPARTMENT_OPTIONS = [
  "Computer Science",
  "Cyber Security",
  "Software Engineering",
  "Information Technology",
  "Mass Communication",
  "Accounting",
  "Economics",
  "Biochemistry",
  "Microbiology",
  "Law",
];
const LEVEL_OPTIONS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"];
const CAMPUS_OPTIONS = ["Lafia Campus"];
const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];
const VISIBILITY_OPTIONS = ["everyone", "people_i_follow", "no_one"];

function visibilityLabel(v: string) {
  if (v === "people_i_follow") return "People I follow";
  if (v === "no_one") return "No one";
  return "Everyone";
}

function SuggestField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = `list-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="mb-1 block text-xs text-hub-textDim">{label}</label>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

export default function EditProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [interestDraft, setInterestDraft] = useState("");
  const [addingInterest, setAddingInterest] = useState(false);

  const [form, setForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    username: "",
    bio: "",
    date_of_birth: "",
    gender: "",
    university: "",
    faculty: "",
    department: "",
    level: "",
    campus: "",
    graduation_year: "",
    website_url: "",
    instagram_handle: "",
    linkedin_url: "",
    twitter_handle: "",
    interests: [],
    profile_visibility: "everyone",
    follow_visibility: "everyone",
    message_visibility: "everyone",
    comment_visibility: "everyone",
    show_university_info: true,
  });

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUserId(data.user.id);

      const { data: p, error } = await supabase
        .from("profiles")
        .select(
          "first_name, last_name, username, bio, avatar_url, cover_url, date_of_birth, gender, university, faculty, department, level, campus, graduation_year, website_url, instagram_handle, linkedin_url, twitter_handle, interests, profile_visibility, follow_visibility, message_visibility, comment_visibility, show_university_info"
        )
        .eq("id", data.user.id)
        .single();

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      setAvatarUrl(p?.avatar_url ?? null);
      setCoverUrl(p?.cover_url ?? null);
      setForm({
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
        username: p?.username ?? "",
        bio: p?.bio ?? "",
        date_of_birth: p?.date_of_birth ?? "",
        gender: p?.gender ?? "",
        university: p?.university ?? "Federal University of Lafia",
        faculty: p?.faculty ?? "",
        department: p?.department ?? "",
        level: p?.level ?? "",
        campus: p?.campus ?? "Lafia Campus",
        graduation_year: p?.graduation_year ?? "",
        website_url: p?.website_url ?? "",
        instagram_handle: p?.instagram_handle ?? "",
        linkedin_url: p?.linkedin_url ?? "",
        twitter_handle: p?.twitter_handle ?? "",
        interests: p?.interests ?? [],
        profile_visibility: p?.profile_visibility ?? "everyone",
        follow_visibility: p?.follow_visibility ?? "everyone",
        message_visibility: p?.message_visibility ?? "everyone",
        comment_visibility: p?.comment_visibility ?? "everyone",
        show_university_info: p?.show_university_info ?? true,
      });
      setLoading(false);
    }
    init();
  }, [router]);

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAvatarChange(file: File) {
    if (!userId) return;
    setUploadingAvatar(true);
    const path = `${userId}/avatar-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("profile-images").upload(path, file);
    if (upErr) {
      alert("Avatar upload failed: " + upErr.message);
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl);
    setUploadingAvatar(false);
  }

  async function handleCoverChange(file: File) {
    if (!userId) return;
    setUploadingCover(true);
    const path = `${userId}/cover-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("profile-images").upload(path, file);
    if (upErr) {
      alert("Cover upload failed: " + upErr.message);
      setUploadingCover(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("profile-images").getPublicUrl(path);
    setCoverUrl(urlData.publicUrl);
    setUploadingCover(false);
  }

  function addInterest() {
    const tag = interestDraft.trim();
    if (!tag) return;
    if (form.interests.includes(tag)) {
      setInterestDraft("");
      setAddingInterest(false);
      return;
    }
    setField("interests", [...form.interests, tag]);
    setInterestDraft("");
    setAddingInterest(false);
  }

  function removeInterest(tag: string) {
    setField(
      "interests",
      form.interests.filter((i) => i !== tag)
    );
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!form.first_name.trim()) errors.first_name = "First name is required";
    if (!form.last_name.trim()) errors.last_name = "Last name is required";

    const uname = form.username.trim().toLowerCase();
    if (!uname) {
      errors.username = "Username is required";
    } else if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      errors.username = "3-20 characters: lowercase letters, numbers, underscores only";
    }

    if (form.bio.length > 250) errors.bio = "Bio must be 250 characters or fewer";

    if (form.graduation_year && !/^\d{4}$/.test(form.graduation_year.trim())) {
      errors.graduation_year = "Enter a 4-digit year, e.g. 2029";
    }

    if (form.website_url && !/^https?:\/\/.+/.test(form.website_url.trim())) {
      errors.website_url = "Include http:// or https://";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!userId) return;
    setSaveError(null);
    if (!validate()) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim() || null,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender.trim() || null,
        university: form.university.trim() || null,
        faculty: form.faculty.trim() || null,
        department: form.department.trim() || null,
        level: form.level.trim() || null,
        campus: form.campus.trim() || null,
        graduation_year: form.graduation_year.trim() || null,
        website_url: form.website_url.trim() || null,
        instagram_handle: form.instagram_handle.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        twitter_handle: form.twitter_handle.trim() || null,
        interests: form.interests,
        profile_visibility: form.profile_visibility,
        follow_visibility: form.follow_visibility,
        message_visibility: form.message_visibility,
        comment_visibility: form.comment_visibility,
        show_university_info: form.show_university_info,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setFieldErrors((prev) => ({ ...prev, username: "That username is already taken" }));
      } else {
        setSaveError(error.message);
      }
      return;
    }

    router.push("/profile");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-hub-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hub-border border-t-hub-accentLight" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-hub-bg pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hub-border bg-hub-bg px-4 py-3">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-white">
          <BackIcon /> Edit Profile
        </button>
        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
          className="text-sm font-medium text-hub-accentLight disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {saveError && <p className="mx-4 mt-3 text-xs text-red-400">{saveError}</p>}

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Photos */}
        <section className="rounded-xl border border-hub-border bg-hub-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <PhotoSectionIcon /> Profile Photo
          </h2>
          <div className="flex flex-col items-center">
            <div className="relative h-24 w-24">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-hub-card2 flex items-center justify-center text-2xl font-semibold text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  form.first_name.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-hub-accentLight text-white disabled:opacity-50"
              >
                <CameraIcon />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleAvatarChange(e.target.files[0]);
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-hub-textDim">{uploadingAvatar ? "Uploading..." : "JPG, PNG or GIF. Max size 5MB."}</p>
          </div>

          <h2 className="mb-3 mt-5 text-sm font-medium text-white">Cover Photo</h2>
          <div className="relative h-28 w-full overflow-hidden rounded-lg bg-hub-card2">
            {coverUrl && <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />}
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
            >
              <CameraIcon />
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleCoverChange(e.target.files[0]);
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-hub-textDim">{uploadingCover ? "Uploading..." : "JPG, PNG or GIF. Max size 10MB."}</p>
        </section>

        {/* Basic Information */}
        <section className="rounded-xl border border-hub-border bg-hub-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <UserSectionIcon /> Basic Information
          </h2>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-hub-textDim">First Name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setField("first_name", e.target.value)}
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white outline-none"
                />
                {fieldErrors.first_name && <p className="mt-1 text-[11px] text-red-400">{fieldErrors.first_name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-hub-textDim">Last Name</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setField("last_name", e.target.value)}
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white outline-none"
                />
                {fieldErrors.last_name && <p className="mt-1 text-[11px] text-red-400">{fieldErrors.last_name}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-hub-textDim">Username</label>
              <input
                value={form.username}
                onChange={(e) => setField("username", e.target.value.toLowerCase())}
                placeholder="e.g. philip_sobechukwu"
                className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
              />
              {fieldErrors.username && <p className="mt-1 text-[11px] text-red-400">{fieldErrors.username}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs text-hub-textDim">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setField("bio", e.target.value.slice(0, 250))}
                rows={4}
                placeholder="Tell people a bit about yourself..."
                className="w-full resize-none rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
              />
              <p className="mt-1 text-right text-[10px] text-hub-textDim">{form.bio.length}/250</p>
              {fieldErrors.bio && <p className="text-[11px] text-red-400">{fieldErrors.bio}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs text-hub-textDim">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setField("date_of_birth", e.target.value)}
                className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <SuggestField label="Gender (optional)" value={form.gender} onChange={(v) => setField("gender", v)} options={GENDER_OPTIONS} placeholder="Prefer not to say" />
          </div>
        </section>

        {/* University Information */}
        <section className="rounded-xl border border-hub-border bg-hub-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <CapIcon /> University Information
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-hub-textDim">University</label>
              <input
                value={form.university}
                onChange={(e) => setField("university", e.target.value)}
                className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <SuggestField label="Faculty" value={form.faculty} onChange={(v) => setField("faculty", v)} options={FACULTY_OPTIONS} />
            <SuggestField label="Department" value={form.department} onChange={(v) => setField("department", v)} options={DEPARTMENT_OPTIONS} />
            <SuggestField label="Level / Year" value={form.level} onChange={(v) => setField("level", v)} options={LEVEL_OPTIONS} />
            <SuggestField label="Campus" value={form.campus} onChange={(v) => setField("campus", v)} options={CAMPUS_OPTIONS} />
            <div>
              <label className="mb-1 block text-xs text-hub-textDim">Graduation Year (optional)</label>
              <input
                value={form.graduation_year}
                onChange={(e) => setField("graduation_year", e.target.value)}
                placeholder="2029"
                inputMode="numeric"
                maxLength={4}
                className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
              />
              {fieldErrors.graduation_year && <p className="mt-1 text-[11px] text-red-400">{fieldErrors.graduation_year}</p>}
            </div>
          </div>
        </section>

        {/* Social Links */}
        <section className="rounded-xl border border-hub-border bg-hub-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <LinkSectionIcon /> Social Links
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-hub-textDim">Website / Portfolio</label>
              <div className="flex items-center gap-2">
                <input
                  value={form.website_url}
                  onChange={(e) => setField("website_url", e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
                {form.website_url && (
                  <button onClick={() => setField("website_url", "")} className="shrink-0 text-hub-textDim">✕</button>
                )}
              </div>
              {fieldErrors.website_url && <p className="mt-1 text-[11px] text-red-400">{fieldErrors.website_url}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs text-hub-textDim">Instagram</label>
              <div className="flex items-center gap-2">
                <input
                  value={form.instagram_handle}
                  onChange={(e) => setField("instagram_handle", e.target.value)}
                  placeholder="@yourhandle"
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
                {form.instagram_handle && (
                  <button onClick={() => setField("instagram_handle", "")} className="shrink-0 text-hub-textDim">✕</button>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-hub-textDim">LinkedIn</label>
              <div className="flex items-center gap-2">
                <input
                  value={form.linkedin_url}
                  onChange={(e) => setField("linkedin_url", e.target.value)}
                  placeholder="linkedin.com/in/yourname"
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
                {form.linkedin_url && (
                  <button onClick={() => setField("linkedin_url", "")} className="shrink-0 text-hub-textDim">✕</button>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-hub-textDim">X (Twitter)</label>
              <div className="flex items-center gap-2">
                <input
                  value={form.twitter_handle}
                  onChange={(e) => setField("twitter_handle", e.target.value)}
                  placeholder="@yourhandle"
                  className="w-full rounded-lg border border-hub-border bg-hub-card2 px-3 py-2 text-sm text-white placeholder:text-hub-textDim outline-none"
                />
                {form.twitter_handle && (
                  <button onClick={() => setField("twitter_handle", "")} className="shrink-0 text-hub-textDim">✕</button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Interests */}
        <section className="rounded-xl border border-hub-border bg-hub-card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
            <HeartSectionIcon /> Interests
          </h2>
          <p className="mb-3 text-xs text-hub-textDim">Select your interests to personalize your experience.</p>
          <div className="flex flex-wrap gap-2">
            {form.interests.map((tag) => (
              <span key={tag} className="flex items-center gap-1.5 rounded-full border border-hub-accentLight/40 bg-hub-accentLight/10 px-3 py-1 text-xs text-hub-accentLight">
                {tag}
                <button onClick={() => removeInterest(tag)}>✕</button>
              </span>
            ))}
            {addingInterest ? (
              <input
                autoFocus
                value={interestDraft}
                onChange={(e) => setInterestDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addInterest();
                  if (e.key === "Escape") { setAddingInterest(false); setInterestDraft(""); }
                }}
                onBlur={addInterest}
                placeholder="Type and press Enter"
                className="w-32 rounded-full border border-hub-border bg-hub-card2 px-3 py-1 text-xs text-white placeholder:text-hub-textDim outline-none"
              />
            ) : (
              <button
                onClick={() => setAddingInterest(true)}
                className="rounded-full border border-dashed border-hub-border px-3 py-1 text-xs text-hub-textDim"
              >
                + Add more
              </button>
            )}
          </div>
        </section>

        {/* Privacy */}
        <section className="rounded-xl border border-hub-border bg-hub-card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
            <LockIcon /> Profile Privacy
          </h2>
          <p className="mb-3 text-[11px] text-hub-textDim">
            These save to your account now. They&apos;ll start actually restricting access once profile viewing and following are built — for now they&apos;re stored but not yet enforced.
          </p>
          <div className="flex flex-col gap-3">
            {[
              { key: "profile_visibility" as const, label: "Who can view my profile" },
              { key: "follow_visibility" as const, label: "Who can follow me" },
              { key: "message_visibility" as const, label: "Who can message me" },
              { key: "comment_visibility" as const, label: "Who can comment on my posts" },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <label className="text-xs text-hub-textDim">{row.label}</label>
                <select
                  value={form[row.key]}
                  onChange={(e) => setField(row.key, e.target.value)}
                  className="rounded-lg border border-hub-border bg-hub-card2 px-2 py-1.5 text-xs text-white outline-none"
                >
                  {VISIBILITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {visibilityLabel(o)}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-hub-border pt-3">
              <label className="text-xs text-hub-textDim">Show my university information</label>
              <button
                onClick={() => setField("show_university_info", !form.show_university_info)}
                className={`h-6 w-11 shrink-0 rounded-full transition-colors ${form.show_university_info ? "bg-hub-accentLight" : "bg-hub-card2 border border-hub-border"}`}
              >
                <span
                  className={`block h-4.5 w-4.5 rounded-full bg-white transition-transform ${form.show_university_info ? "translate-x-6" : "translate-x-1"}`}
                  style={{ height: "18px", width: "18px" }}
                />
              </button>
            </div>
          </div>
        </section>

        <button
          onClick={() => router.push("/profile")}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-hub-border py-2.5 text-sm text-hub-accentLight"
        >
          <EyeSmallIcon /> Preview Profile
        </button>
      </div>
    </main>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7l1.5-2.5h5L16 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function PhotoSectionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UserSectionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function CapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 11v6c0 1 3 3 7 3s7-2 7-3v-6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function LinkSectionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight">
      <path d="M9 15l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 6l1-1a4 4 0 015.7 5.7l-1 1M13 18l-1 1a4 4 0 01-5.7-5.7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function HeartSectionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight">
      <path d="M12 20s-7-4.35-9.5-8.5C.7 8 2.5 4.5 6 4.5c2 0 3.5 1.2 6 3.5 2.5-2.3 4-3.5 6-3.5 3.5 0 5.3 3.5 3.5 7C19 15.65 12 20 12 20z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-hub-accentLight">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function EyeSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
