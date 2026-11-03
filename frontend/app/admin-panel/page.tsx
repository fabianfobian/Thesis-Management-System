import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { auth, thesesApi, usersApi, ApiError } from "@/lib/api";
import AssignCommitteeForm from "@/components/AssignCommitteeForm";

export default function AdminPanelPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-white rounded-lg"></div>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  let user, theses, supervisors;
  try {
    user = await auth.me({ Cookie: cookieHeader });
    if (user.role !== "admin") redirect("/dashboard"); // Kick out non-admins
    
    const thesesRes = await thesesApi.list({ Cookie: cookieHeader });
    const supRes = await usersApi.listSupervisors({ Cookie: cookieHeader });
    
    theses = thesesRes.results;
    supervisors = supRes.results;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) redirect("/login");
    throw err;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy">
        Admin Panel: Committee Assignment
      </h1>
      
      <div className="space-y-4">
        {theses.map((thesis) => (
          <div key={thesis.id} className="bg-white border border-pac-navy/10 rounded-lg p-6 shadow-sm">
            <h2 className="font-semibold text-pac-navy text-lg">{thesis.title}</h2>
            <p className="text-sm text-pac-navy/60 mb-4">Student: {thesis.student.full_name}</p>
            
            {/* The form component */}
            <AssignCommitteeForm 
              thesis={thesis} 
              supervisors={supervisors} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}