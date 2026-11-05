"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, User } from "@/lib/api";
import NotificationBell from "./NotificationBell";

export default function HeaderNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      try {
        const me = await auth.me();
        setUser(me);
      } catch {
        setUser(null); // Not logged in
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await auth.logout();
      setUser(null);
      //router.push("/");
      //router.refresh(); // Force server components to re-render without cookies
      window.location.href = "/"; // Use a hard redirect here as well 
    } finally {
      setLoggingOut(false);
    }
  }

  // Don't show anything until we know the auth state (prevents flickering)
  if (loading) {
    return <div className="h-6 w-24 bg-pac-navyLight animate-pulse rounded"></div>;
  }

  const isDashboard = pathname === "/dashboard";

  return (
    <div className="flex items-center gap-6">
      <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
        {user ? (
          <>
            {user.role === "admin" && (
              <>
                <Link 
                  href="/admin-panel" 
                  className="text-pac-gold font-semibold hover:text-pac-goldLight transition-colors"
                >
                  Admin Panel
                </Link>
                <span className="text-white/40">|</span>
              </>
            )}

            
            {/* Only render Dashboard link and separator if NOT on the dashboard */}
            {!isDashboard && (
              <>
                <Link 
                  href="/dashboard" 
                  className="hover:text-pac-gold transition-colors"
                >
                  Dashboard
                </Link>
                <span className="text-white/40">|</span>
              </>
            )}
            
            {/* User Name */}
            <span className="text-pac-goldLight">{user.full_name || user.username}</span>
            
            {/* White Separator Line */}
            <span className="text-white/40">|</span>
            
            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="hover:text-pac-gold transition-colors disabled:opacity-50"
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </>
        ) : (
          <Link href="/login" className="hover:text-pac-gold transition-colors">
            Sign in
          </Link>
        )}
      </nav>
      
      {/* Only show the bell if logged in */}
      {user && <NotificationBell />}
    </div>
  );
}