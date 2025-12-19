// src/pages/register.js
import { useState } from "react";
import { useRouter } from "next/router";
import { register } from "../lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [consent, setConsent] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const desktopDownloadUrl = process.env.NEXT_PUBLIC_EYETRACKER_URL;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!name || !email || !password || !timezone) {
      setError("Name, email, password and region are required.");
      return;
    }

    if (!consent) {
      setError("You need to agree to use anonymized blink counts.");
      return;
    }

    setLoading(true);
    try {
      const result = await register(email, password, name, consent, timezone);
      if (result.error) {
        setError(result.error);
        return;
      }

      // success: hide form, show only 2 choices
      setInfo(
        "Account created. To start tracking, download the desktop app or go to login."
      );
    } catch (err) {
      console.error("Register error:", err);
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const showSuccess = !!info && !error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-4xl grid gap-10 md:grid-cols-[1.1fr,0.9fr] items-center">
        {/* Left copy */}
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">
            Give your eyes a dashboard
          </h1>
          <p className="text-sm md:text-base text-zinc-300">
            You blink without thinking about it. On a laptop, that unconscious
            blink pattern slows down and your eyes quietly take the hit.
          </p>
          <p className="text-sm md:text-base text-zinc-400">
            Create an account, then install the desktop tracker so your blink
            data can power your eye‑health dashboard.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Already have an account? Sign in
          </button>
        </section>

        {/* Right: either form or 2-option panel */}
        <div className="w-full max-w-sm mx-auto bg-zinc-900 p-6 rounded-lg border border-zinc-700">
          {!showSuccess && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-center">
                Create account
              </h2>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <div className="space-y-1">
                <label className="text-sm">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm">Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm">Region / time zone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-sm outline-none"
                >
                  <option value="">Select your region</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Europe/London">Europe (London)</option>
                  <option value="America/New_York">US (New York)</option>
                  <option value="America/Los_Angeles">
                    US (Los Angeles)
                  </option>
                  <option value="Asia/Singapore">Asia (Singapore)</option>
                </select>
              </div>

              <label className="flex items-start gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I agree that anonymized blink counts can be used to build my
                  eye‑health dashboard. No raw video is stored or sent.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded bg.white text-black text-sm font-medium disabled:bg-zinc-500 bg-white"
              >
                {loading ? "Creating account..." : "Register"}
              </button>
            </form>
          )}

          {showSuccess && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-center">
                You’re ready to go
              </h2>
              <p className="text-sm text-green-400 text-center">{info}</p>

              <div className="flex flex-col gap-2">
                {desktopDownloadUrl ? (
                  <a
                    href={desktopDownloadUrl}
                    download
                    className="w-full py-2 rounded bg-white text-black text-sm font-medium text-center"
                  >
                    Download desktop app
                  </a>
                ) : (
                  <p className="text-xs text-red-400 text-center">
                    Desktop download not available. Please contact support.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full py-2 rounded border border-zinc-600 text-sm"
                >
                  Go to login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
