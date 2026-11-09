"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, usersApi, Group, Department, User } from "@/lib/api";

export default function ManageUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "student",
    department: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const me = await auth.me();
        if (!me.is_superuser) {
          router.push("/dashboard"); // Kick out non-superusers
          return;
        }
        
        const [groupsData, deptsData] = await Promise.all([
          usersApi.listGroups(),
          usersApi.listDepartments()
        ]);
        
        setGroups(groupsData.results);
        setDepartments(deptsData.results);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    
    try {
      // 1. Send the form data to the backend
      const response = await usersApi.createUser({
        ...formData,
        department: formData.department ? Number(formData.department) : null,
      });
      
      // 2. Extract the generated password from the response
      const newPassword = (response as any).generated_password;
      
      // 3. Show the success message with the password
      setMessage({ 
        type: "success", 
        text: `User created successfully! Temporary Password: ${newPassword}. Please copy this now.` 
      });
      
      // 4. Reset the form
      setFormData({ username: "", email: "", first_name: "", last_name: "", role: "student", department: "" });
      
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create user." });
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      <div>
        <Link href="/admin-panel" className="text-sm text-pac-navy/60 hover:text-pac-gold">
          ← Back to Admin Panel
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy mt-2">
          Manage Users
        </h1>
        <p className="text-pac-navy/60 text-sm mt-1">
          Create student, supervisor, and custom admin accounts.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-md flex items-start gap-3 shadow-sm border ${
          message.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {/* Simple Icons */}
          {message.type === "success" ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          )}
          <div className="text-sm font-medium">
            {message.text}
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-sm border border-pac-navy/10 space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">First Name</label>
            <input required type="text" className="w-full rounded border p-2 focus:ring-2 focus:ring-pac-gold focus:outline-none" 
                   value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Last Name</label>
            <input required type="text" className="w-full rounded border p-2 focus:ring-2 focus:ring-pac-gold focus:outline-none" 
                   value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Username</label>
            <input required type="text" className="w-full rounded border p-2 focus:ring-2 focus:ring-pac-gold focus:outline-none" 
                   value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Email</label>
            <input required type="email" className="w-full rounded border p-2 focus:ring-2 focus:ring-pac-gold focus:outline-none" 
                   value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Role</label>
            <select className="w-full rounded border p-2 focus:ring-2 focus:ring-pac-gold focus:outline-none" 
                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
              <option value="student">Student</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Department</label>
            <select required className="w-full rounded border p-2 focus:ring-2 focus:ring-pac-gold focus:outline-none" 
                    value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
              <option value="">Select Department...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.school_name})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" disabled={creating} className="w-full rounded-md bg-pac-navy text-white py-2.5 font-medium hover:bg-pac-navyLight disabled:opacity-50 transition-colors">
            {creating ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}