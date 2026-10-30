import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, thesesApi, ApiError } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import LogoutButton from "@/components/LogoutButton";

/**
 * Dashboard — the post-login landing page.
 *
 * Server Component: we call the API with the incoming request's cookies
 * (next/fetch forwards them automatically for same-origin-style calls
 * when `credentials: "include"` is set and the request comes from the
 * browser). If not authenticated, redirect to /login.
 */
export default async function DashboardPage() {
  let user;
  try {
    user = await auth.me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      redirect("/login");
    }
    throw err;
  }

  const { results: theses } = await thesesApi.list();

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