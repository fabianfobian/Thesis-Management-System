import type { ChapterStatus, ThesisStatus } from "@/lib/api";

/**
 * Colored pill for a workflow state.
 * Centralized here so the color vocabulary stays consistent across pages.
 */
const COLORS: Record<string, string> = {
  proposal:     "bg-blue-100 text-blue-800",
  in_progress:  "bg-amber-100 text-amber-800",
  under_review: "bg-purple-100 text-purple-800",
  revisions:    "bg-red-100 text-red-800",
  approved:     "bg-emerald-100 text-emerald-800",
  defended:     "bg-emerald-200 text-emerald-900",
  archived:     "bg-gray-200 text-gray-700",
  draft:        "bg-gray-100 text-gray-700",
  submitted:    "bg-blue-100 text-blue-800",
};

export default function StatusBadge({
  status,
  label,
}: {
  status: ThesisStatus | ChapterStatus;
  label?: string;
}) {
  const cls = COLORS[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${cls}`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}