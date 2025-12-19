// src/pages/register.js
import { useState } from "react";
import { useRouter } from "next/router";
import { register } from "../lib/api";

/**
 * Registration page for new users.
 * Requires: name, email, password, timezone, consent.
 */
export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // User’s region / timezone (IANA string).
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!name || !email || !password || !timezone) {
      setError("Name, email, password and region are required.");
      return;
    }

    setLoading(true);
    try {
      // Create account with timezone
      const result = await register(email, password, name, consent, timezone);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Do NOT auto-login; send user to login page
      setInfo("Account created. Please sign in with your email and password.");
      // Small delay so user sees the message, then redirect
      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch (err) {
      console.error("Register error:", err);
      setError(
        err.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-4xl grid gap-10 md:grid-cols-[1.1fr,0.9fr] items-center">
        {/* Left: why register / eye story */}
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">
            Give your eyes a dashboard
          </h1>
          <p className="text-sm md:text-base text-zinc-300">
            You blink without thinking about it. On a laptop, that unconscious
            blink pattern slows down and your eyes quietly take the hit.
          </p>
          <p className="text-sm md:text-base text-zinc-400">
            By creating an account, you get simple trends, risk levels, and
            gentle nudges from your blink data — tuned to your local time so
            mornings and late nights are interpreted correctly.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Already have an account? Sign in
          </button>
        </section>

        {/* Right: register form */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm mx-auto space-y-4 bg-zinc-900 p-6 rounded-lg border border-zinc-700"
        >
          <h2 className="text-xl font-semibold text-center">Create account</h2>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {info && !error && (
            <p className="text-sm text-green-400 text-center">{info}</p>
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

          {/* Region / timezone selector */}
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
              <option value="America/Los_Angeles">US (Los Angeles)</option>
              <option value="Asia/Singapore">Asia (Singapore)</option>
            </select>
            <p className="text-[11px] text-zinc-500">
              We align your blink patterns to your local day so mornings,
              work blocks and late sessions show up in the right place.
            </p>
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
            className="w-full py-2 rounded bg-white text-black text-sm font-medium disabled:bg-zinc-500"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
