import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { auth, thesesApi, ApiError } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import LogoutButton from "@/components/LogoutButton";

/**
 * Dashboard — the post-login landing page.
 *
 * We use React Suspense to isolate the data fetching. Because the user's
 * session cookie is required, this data is inherently dynamic. In Next.js 16
 * with cacheComponents, dynamic data must be wrapped in a Suspense boundary
 * so the static shell (header/footer) can render instantly while the user
 * data streams in.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

// The actual data-fetching component
async function DashboardContent() { 
  // Get cookies from the incoming browser request
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
    
  console.log("🍪 Forwarding cookies to Django:", cookieHeader);
  let user;
  try {
    // This fetch happens on the server. It relies on the cookies passed from the client.
    // Pass the cookies to Django
    user = await auth.me({ Cookie: cookieHeader });
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      redirect("/login");
    }
    throw err;
  }

  const { results: theses } = await thesesApi.list({ Cookie: cookieHeader });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-pac-navy/60">
            Welcome back, {user.full_name || user.username}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy mt-1">
            {user.role === "student"
              ? "My Thesis"
              : user.role === "supervisor"
              ? "Theses I Supervise"
              : "All Theses"}
          </h1>
        </div>
        <LogoutButton />
      </div>

      {theses.length === 0 ? (
        <div className="rounded-lg border border-pac-navy/10 bg-white p-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl text-pac-navy">
            No theses yet
          </p>
          <p className="text-pac-navy/60 text-sm mt-2">
            {user.role === "student"
              ? "Your thesis will appear here once it has been registered."
              : "Theses assigned to you will appear here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {theses.map((t) => (
            <li key={t.id}>
              <Link
                href={`/theses/${t.id}`}
                className="block rounded-lg border border-pac-navy/10 bg-white p-5 hover:border-pac-gold transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-pac-navy">{t.title}</h2>
                    <p className="text-sm text-pac-navy/60 mt-1">
                      Student: {t.student.full_name} · Supervisor:{" "}
                      {t.supervisor?.full_name ?? "Unassigned"}
                    </p>
                  </div>
                  <StatusBadge status={t.status} label={t.status_display} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Fallback UI shown while the server fetches the user session and theses.
 * It roughly mimics the final layout to prevent jarring layout shifts.
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-pac-navy/10 rounded"></div>
          <div className="h-8 w-48 bg-pac-navy/20 rounded"></div>
        </div>
        <div className="h-9 w-24 bg-pac-navy/10 rounded"></div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-pac-navy/10 bg-white/50"></div>
        ))}
      </div>
    </div>
  );
}