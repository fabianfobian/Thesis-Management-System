import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="space-y-12">
      <section className="text-center space-y-4 py-10">
        <p className="uppercase tracking-[0.3em] text-pac-gold text-xs font-semibold">
          Pan Africa Christian University
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl font-bold text-pac-navy">
          Thesis Tracking System
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-pac-navy/70">
          Submit chapters, receive supervisor feedback, and follow your
          dissertation from proposal to defense — all in one place.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-pac-navy px-6 py-3 text-white font-medium hover:bg-pac-navyLight transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border-2 border-pac-gold text-pac-navy px-6 py-3 font-medium hover:bg-pac-gold hover:text-white transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-6">
        {[
          {
            title: "Students",
            body: "Submit proposals, upload chapters, and track feedback in real time.",
          },
          {
            title: "Supervisors",
            body: "Review drafts, annotate chapters, and approve progress step by step.",
          },
          {
            title: "Administrators",
            body: "Oversee every thesis, assign supervisors, and archive completed work.",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-lg border border-pac-navy/10 bg-white p-6 shadow-sm"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-pac-navy mb-2">
              {c.title}
            </h2>
            <p className="text-pac-navy/70 text-sm leading-relaxed">{c.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}