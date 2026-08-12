"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CampusSkyline from "@/components/CampusSkyline";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "signup";
type SignupStep = 1 | 2 | 3 | 4;

const FACULTIES = [
  "Faculty of Science",
  "Faculty of Engineering",
  "Faculty of Arts",
  "Faculty of Social Sciences",
  "Faculty of Law",
  "Faculty of Education",
  "Faculty of Management Sciences",
  "Faculty of Medicine",
  "Faculty of Agriculture",
];

const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"];
const GENDERS = ["Male", "Female"];

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup - step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // signup - step 2 (OTP)
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // signup - step 3
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [level, setLevel] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");

  // signup - step 4
  const [gender, setGender] = useState("");
  const [homeAddress, setHomeAddress] = useState("");

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

  function validateStep1() {
    if (!firstName.trim() || !lastName.trim()) return "Please enter your first and last name.";
    if (!signupEmail.trim()) return "Please enter your university email.";
    if (signupPassword.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  function validateStep3() {
    if (!phoneNumber.trim()) return "Please enter your phone number.";
    if (!dateOfBirth.trim()) return "Please enter your date of birth.";
    if (!matricNumber.trim()) return "Please enter your matric number.";
    if (!level.trim()) return "Please enter your level.";
    if (!faculty.trim()) return "Please enter your faculty.";
    if (!department.trim()) return "Please enter your department.";
    return null;
  }

  function validateStep4() {
    if (!gender.trim()) return "Please enter your gender.";
    if (!homeAddress.trim()) return "Please enter your home address.";
    return null;
  }

  // Step 1 -> create the auth account, Supabase emails the OTP, move to step 2
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setSignupStep(2);
    startResendCooldown();
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: signupEmail });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    startResendCooldown();
  }

  // Step 2 -> verify the OTP code, move to step 3
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.trim().length < 6) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: signupEmail,
      token: otpCode.trim(),
      type: "signup",
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setSignupStep(3);
  }

  function goToStep4(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep3();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSignupStep(4);
  }

  // Step 4 -> save full profile, done
  async function handleFinishSignup(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep4();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      setError("Session expired — please log in again.");
      setMode("login");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userData.user.id,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        date_of_birth: dateOfBirth,
        matric_number: matricNumber,
        level,
        faculty,
        department,
        gender,
        home_address: homeAddress,
      },
      { onConflict: "id" }
    );

    setLoading(false);
    if (profileError) {
      setError(
        profileError.message.includes("matric_number")
          ? "That matric number is already registered."
          : profileError.message
      );
      return;
    }

    router.push("/home");
  }

  function resetSignup() {
    setSignupStep(1);
    setError(null);
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

      <div className="flex-1 overflow-y-auto rounded-t-xl2 bg-hub-card px-6 pt-6 pb-8 -mt-6 relative">
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
              <button
                className="text-hub-accentLight"
                onClick={() => {
                  setMode("signup");
                  resetSignup();
                }}
              >
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
            <p className="mt-1 text-sm text-hub-textDim">Step {signupStep} of 4</p>

            {signupStep === 1 && (
              <form onSubmit={handleCreateAccount} className="mt-6 flex flex-col gap-4">
                <div className="flex gap-3">
                  <Field label="First Name" placeholder="Enter first name" value={firstName} onChange={setFirstName} />
                  <Field label="Last Name" placeholder="Enter last name" value={lastName} onChange={setLastName} />
                </div>
                <Field
                  label="University Email"
                  type="email"
                  placeholder="name@university.edu"
                  value={signupEmail}
                  onChange={setSignupEmail}
                />
                <PasswordField
                  label="Password"
                  show={showPassword}
                  onToggle={() => setShowPassword((s) => !s)}
                  placeholder="At least 6 characters"
                  value={signupPassword}
                  onChange={setSignupPassword}
                />

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
                >
                  {loading ? "Sending code..." : "Continue"}
                </button>
              </form>
            )}

            {signupStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="mt-6 flex flex-col gap-4">
                <p className="text-sm text-hub-textDim">
                  We sent a 6-digit code to <span className="text-white">{signupEmail}</span>. Enter it below to
                  verify your email.
                </p>
                <Field
                  label="Verification Code"
                  placeholder="123456"
                  value={otpCode}
                  onChange={setOtpCode}
                />

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-hub-accentLight disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </form>
            )}

            {signupStep === 3 && (
              <form onSubmit={goToStep4} className="mt-6 flex flex-col gap-4">
                <Field label="Phone Number" placeholder="080X XXX XXXX" value={phoneNumber} onChange={setPhoneNumber} />
                <Field label="Date of Birth" type="date" placeholder="" value={dateOfBirth} onChange={setDateOfBirth} />
                <Field label="Matric Number" placeholder="e.g. 20/1234" value={matricNumber} onChange={setMatricNumber} />
                <ComboField label="Level" value={level} onChange={setLevel} options={LEVELS} placeholder="e.g. 200 Level" />
                <ComboField label="Faculty" value={faculty} onChange={setFaculty} options={FACULTIES} placeholder="e.g. Faculty of Science" />
                <Field label="Department" placeholder="e.g. Computer Science" value={department} onChange={setDepartment} />

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  className="mt-2 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white"
                >
                  Continue
                </button>
              </form>
            )}

            {signupStep === 4 && (
              <form onSubmit={handleFinishSignup} className="mt-6 flex flex-col gap-4">
                <ComboField label="Gender" value={gender} onChange={setGender} options={GENDERS} placeholder="e.g. Male" />
                <Field label="Home Address" placeholder="Enter your home address" value={homeAddress} onChange={setHomeAddress} />

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep(3);
                      setError(null);
                    }}
                    className="flex-1 rounded-xl border border-hub-border py-3.5 text-center font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl bg-hub-accent py-3.5 text-center font-medium text-white disabled:opacity-60"
                  >
                    {loading ? "Finishing..." : "Create Account"}
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-hub-textDim">
              Already have an account?{" "}
              <button
                className="text-hub-accentLight"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
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

function ComboField({
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
  const [open, setOpen] = useState(false);
  const filtered = options.filter((opt) => opt.toLowerCase().includes(value.toLowerCase()));

  return (
    <label className="relative block text-sm">
      <span className="mb-1.5 block text-hub-textDim">{label}</span>
      <div className="relative">
        <input
          type="text"
          value={value}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-xl border border-hub-border bg-hub-card2 px-4 py-3 pr-10 text-white outline-none focus:border-hub-accentLight"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-hub-textDim"
          aria-label="Toggle options"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-hub-border bg-hub-card2 shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="block w-full px-4 py-2.5 text-left text-white hover:bg-hub-bg"
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-4 py-2.5 text-hub-textDim">No match — keep typing your own</div>
          )}
        </div>
      )}
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
