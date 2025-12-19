// src/pages/login.js
import { useState } from "react";
import { useRouter } from "next/router";
import { login } from "../lib/api";

/**
 * Login page for existing users.
 */
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);

      if (result.error) {
        setError(result.error);
        return;
      }

      localStorage.setItem("waw_token", result.token);
      router.push("/dashboard");
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-4xl grid gap-10 md:grid-cols-[1.1fr,0.9fr] items-center">
        {/* Left: why login / what you get */}
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">
            Welcome back
          </h1>
          <p className="text-sm md:text-base text-zinc-300">
            Your eyes have a rhythm. When you stare at a screen, that rhythm
            slows down and your eyes dry out long before you feel it.
          </p>
          <p className="text-sm md:text-base text-zinc-400">
            When you sign in, you get a personal blink dashboard that shows how
            your eyes behave through the day, so you can catch strain early and
            keep your focus sharp.
          </p>
          <button
            type="button"
            onClick={() => router.push("/register")}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            New here? Create a free account
          </button>
        </section>

        {/* Right: login form */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm mx-auto space-y-4 bg-zinc-900 p-6 rounded-lg border border-zinc-700"
        >
          <h2 className="text-xl font-semibold text-center">Sign in</h2>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-white text-black text-sm font-medium disabled:bg-zinc-500"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
