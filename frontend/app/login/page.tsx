"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, ApiError } from "@/lib/api";

/**
 * Login page.
 *
 * A Client Component because it holds form state and calls the API
 * on submit. On success we redirect based on the returned role.
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.login(username, password);
      // Full navigation, not client-side push — ensures the whole app
      // re-renders with the new session cookie present.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      // Surface the actual reason so we're not debugging blind.
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Invalid username or password.");
        } else if (err.status === 403) {
          setError("Session or CSRF error. Try clearing cookies and reloading.");
        } else {
          setError(`Login failed (HTTP ${err.status}): ${err.message}`);
        }
      } else {
        // This will catch our "Failed to fetch CSRF token" error
        setError(`Error: ${(err as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center mb-8">
        <p className="uppercase tracking-[0.3em] text-pac-gold text-xs font-semibold">
          Pan Africa Christian University
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy mt-2">
          Sign in
        </h1>
        <p className="text-pac-navy/60 text-sm mt-1">
          Use your PAC staff or student credentials.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-pac-navy/10 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-pac-navy mb-1"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-pac-navy/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pac-gold"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-pac-navy mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-pac-navy/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pac-gold"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-pac-navy text-white py-2.5 font-medium hover:bg-pac-navyLight transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}