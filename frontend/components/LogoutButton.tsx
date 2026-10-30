"use client";

import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";
import { useState } from "react";

/**
 * Logs the user out and returns them to the landing page.
 * The router.refresh() is essential — it forces Server Components to
 * re-render without the session, so the header/dashboard update.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await auth.logout();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm rounded-md border border-pac-navy/20 px-3 py-1.5 text-pac-navy hover:bg-pac-navy hover:text-white transition-colors disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}