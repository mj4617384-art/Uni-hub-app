"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CampusSkyline from "@/components/CampusSkyline";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/home");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/home");
  }

  return (
    <main className="relative flex h-screen flex-col bg-hub-bg">
      <div className="relative h-56 shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#16244a] to-hub-bg" />
        <CampusSkyline className="absolute bottom-0 h-32 w-full" />
        <button
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 rounded-t-xl2 bg-hub-card px-6 pt-6 pb-8 -mt-6 relative">
        {mode === "login" ? (
          <>
            <h2 className="text-2xl font-semibold">
              Uni<span className="text-hub-accentLight">.hub</span> 👋
            </h2>
            <h3 className="mt-1 text-lg font-medium">Welcome back</h3>
            <p className="mt-1 text-sm text-hub-textDim">Sign in to continue to your campus.</p>

            <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
              <Field
                label="University Email"
                type="email"
                placeholder="name@university.edu"
                value={email}
                onChange={setEmail}
              />
              <PasswordField
                label="Password"
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                value={password}
                onChange={setPassword}
              />
              <div className="text-right">
                <button type="button" className="text-sm text-hub-accentLight">
                  Forgot password?
                </button>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <Divider />

            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-hub-border py-3.5 text-sm font-medium">
              🏛️ Continue with University SSO
            </button>

            <p className="mt-6 text-center text-sm text-hub-textDim">
              Don&apos;t have an account?{" "}
              <button className="text-hub-accentLight" onClick={() => { setMode("signup"); setError(null); }}>
                Create account
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">
              Uni<span className="text-hub-accentLight">.hub</span>
            </h2>
            <h3 className="mt-1 text-lg font-medium">Create your account</h3>
            <p className="mt-1 text-sm text-hub-textDim">
              Use your university email to join your campus community.
            </p>

            <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
              <div className="flex gap-3">
                <Field label="First Name" placeholder="Enter first name" value={firstName} onChange={setFirstName} />
                <Field label="Last Name" placeholder="Enter last name" value={lastName} onChange={setLastName} />
              </div>
              <Field
                label="University Email"
                type="email"
                placeholder="name@university.edu"
                value={email}
                onChange={setEmail}
              />
              <PasswordField
                label="Password"
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                placeholder="At least 6 characters"
                value={password}
                onChange={setPassword}
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-hub-textDim">
              Already have an account?{" "}
              <button className="text-hub-accentLight" onClick={() => { setMode("login"); setError(null); }}>
                Log in
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex-1 text-sm">
      <span className="mb-1.5 block text-hub-textDim">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 text-white outline-none focus:border-hub-accentLight"
      />
    </label>
  );
}

function PasswordField({
  label,
  show,
  onToggle,
  placeholder = "Enter your password",
  value,
  onChange,
}: {
  label: string;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1.5 block text-hub-textDim">{label}</span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 pr-11 text-white outline-none focus:border-hub-accentLight"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-hub-textDim"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4.5 10 8-.31.99-.84 2.02-1.56 3M6.6 6.6C4.3 8.05 2.6 10.2 2 12c1 3.5 5 8 10 8 1.35 0 2.63-.28 3.78-.78"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-hub-textDim">
      <div className="h-px flex-1 bg-hub-border" />
      or
      <div className="h-px flex-1 bg-hub-border" />
    </div>
  );
}
