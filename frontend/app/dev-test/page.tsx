"use client";

import { useState } from "react";
import { auth, ApiError, ensureCsrf } from "@/lib/api";

/**
 * Throwaway page for manually testing the auth flow from the browser.
 * Delete once login is confirmed working — it's a development aid.
 */
export default function DevTestPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const append = (msg: string) => setLog((l) => [...l, msg]);

  async function testCsrf() {
    try {
      const token = await ensureCsrf();
      append(`✅ CSRF token obtained: ${token.slice(0, 12)}...`);
    } catch (e) {
      append(`❌ CSRF failed: ${(e as Error).message}`);
    }
  }

  async function testLogin() {
    try {
      const user = await auth.login(username, password);
      append(`✅ Logged in as ${user.username} (${user.role})`);
    } catch (e) {
      if (e instanceof ApiError) append(`❌ Login failed [${e.status}]: ${e.message}`);
      else append(`❌ Login error: ${(e as Error).message}`);
    }
  }

  async function testMe() {
    try {
      const me = await auth.me();
      append(`✅ /me/ -> ${me.username} (${me.role})`);
    } catch (e) {
      if (e instanceof ApiError) append(`❌ /me/ failed [${e.status}]: ${e.message}`);
      else append(`❌ /me/ error: ${(e as Error).message}`);
    }
  }

  async function testLogout() {
    try {
      await auth.logout();
      append("✅ Logged out");
    } catch (e) {
      append(`❌ Logout failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 py-10">
      <h1 className="text-2xl font-bold text-pac-navy">Auth Dev Test</h1>
      <p className="text-sm text-pac-navy/60">
        Open DevTools → Application → Cookies → http://127.0.0.1:8000 to watch
        <code className="mx-1">csrftoken</code> and <code>sessionid</code> appear.
      </p>

      <div className="space-y-2">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={testCsrf} className="border px-3 py-1.5 rounded">1. Get CSRF</button>
        <button onClick={testLogin} className="border px-3 py-1.5 rounded">2. Login</button>
        <button onClick={testMe} className="border px-3 py-1.5 rounded">3. Call /me/</button>
        <button onClick={testLogout} className="border px-3 py-1.5 rounded">4. Logout</button>
      </div>

      <pre className="bg-pac-navy text-pac-cream text-xs rounded p-4 whitespace-pre-wrap min-h-[120px]">
        {log.join("\n") || "No actions yet."}
      </pre>
    </div>
  );
}