"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, usersApi, User } from "@/lib/api";
import Link from "next/link";

function getPasswordRules(password: string) {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "One number (0-9)", met: /\d/.test(password) },
    { label: "One special character (!@#$%^&*)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({ first_name: "", last_name: "", email: "", phone_number: "" });
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // Password States
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const me = await auth.me();
        setUser(me);
        setFormData({
          first_name: me.first_name || "",
          last_name: me.last_name || "",
          email: me.email || "",
          phone_number: me.phone_number || "",
        });
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const updated = await usersApi.updateProfile(formData);
      setUser(updated);
      setIsEditing(false);
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile." });
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordError("Password must be 8+ characters, with uppercase, lowercase, a number, and a symbol.");
      return;
    }
    // check all rules in one go
    const allRulesMet = getPasswordRules(newPassword).every(r => r.met);
    if (!allRulesMet) {
      setPasswordError("Please ensure all password requirements are met.");
      return;
    }

    setPasswordLoading(true);
    try {
      await auth.changePassword(oldPassword, newPassword);
      setMessage({ type: "success", text: "Password changed successfully!" });
      setShowPasswordForm(false);
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-pac-navy/60 hover:text-pac-gold">
          ← Back to Dashboard
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pac-navy mt-2">
          My Profile
        </h1>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* --- READ-ONLY VIEW --- */}
      {!isEditing ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-pac-navy/10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Full Name</p>
              <p className="font-medium text-pac-navy text-lg">{user.full_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Username</p>
              <p className="font-medium text-pac-navy">{user.username}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Email</p>
              <p className="font-medium text-pac-navy">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Phone Number</p>
              <p className="font-medium text-pac-navy">{user.phone_number || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Role</p>
              <p className="font-medium text-pac-navy capitalize">{user.role}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Registration Number</p>
              <p className="font-medium text-pac-navy">{user.registration_number || "Not provided"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-pac-navy/60 uppercase tracking-wider mb-1">Department</p>
              <p className="font-medium text-pac-navy">
                {user.department_details?.name || "Not Assigned"}
                {user.department_details?.school && <span className="text-pac-navy/60"> ({user.department_details.school})</span>}
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-pac-navy/10 flex flex-wrap gap-3">
            <button onClick={() => setIsEditing(true)} className="rounded-md bg-pac-navy text-white px-4 py-2 text-sm font-medium hover:bg-pac-navyLight">
              Edit Profile
            </button>
            <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="rounded-md bg-white border border-pac-navy/20 text-pac-navy px-4 py-2 text-sm font-medium hover:bg-pac-cream">
              Change Password
            </button>
          </div>
        </div>
      ) : (
        /* --- EDIT VIEW --- */
        <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-lg shadow-sm border border-pac-navy/10 space-y-4">
          <h2 className="text-lg font-semibold text-pac-navy mb-4">Edit Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pac-navy mb-1">First Name</label>
              <input required type="text" className="w-full rounded border p-2" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-pac-navy mb-1">Last Name</label>
              <input required type="text" className="w-full rounded border p-2" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Email</label>
            <input required type="email" className="w-full rounded border p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Phone Number</label>
            <input type="tel" className="w-full rounded border p-2" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 rounded-md bg-pac-navy text-white py-2 text-sm font-medium">Save Changes</button>
            <button type="button" onClick={() => setIsEditing(false)} className="flex-1 rounded-md bg-gray-100 text-pac-navy py-2 text-sm font-medium">Cancel</button>
          </div>
        </form>
      )}

      {/* --- PASSWORD CHANGE FORM --- */}
      {showPasswordForm && (
        <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-lg shadow-sm border border-pac-navy/10 space-y-4 mt-6">
          <h2 className="text-lg font-semibold text-pac-navy mb-4">Change Password</h2>
          {passwordError && <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{passwordError}</div>}
          <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Current Password</label>
            <input required type="password" className="w-full rounded border p-2" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
          </div>
          <div>
            <div>
                <label className="block text-sm font-medium text-pac-navy mb-1">New Password</label>
                <input 
                required 
                type="password" 
                className={`w-full rounded border p-2 ${newPassword && !getPasswordRules(newPassword).every(r => r.met) ? "border-red-300" : ""}`}
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                />
                
                {/* Real-time checklist */}
                {newPassword && (
                <ul className="mt-2 space-y-1">
                    {getPasswordRules(newPassword).map((rule, idx) => (
                    <li key={idx} className={`text-xs flex items-center gap-1.5 ${rule.met ? "text-emerald-600" : "text-gray-400"}`}>
                        {rule.met ? "✓" : "○"} {rule.label}
                    </li>
                    ))}
                </ul>
                )}
            </div>
          </div>
                    <div>
            <label className="block text-sm font-medium text-pac-navy mb-1">Confirm New Password</label>
            <div className="relative">
              <input 
                required 
                type="password" 
                className={`w-full rounded border p-2 ${confirmPassword && confirmPassword !== newPassword ? "border-red-300" : ""}`}
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
              />
              {confirmPassword && (
                <span className={`absolute right-3 top-2.5 text-sm font-medium ${confirmPassword === newPassword ? "text-emerald-600" : "text-red-500"}`}>
                  {confirmPassword === newPassword ? "✓ Match" : "✗ Mismatch"}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={passwordLoading} className="flex-1 rounded-md bg-emerald-600 text-white py-2 text-sm font-medium disabled:opacity-50">
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
            <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 rounded-md bg-gray-100 text-pac-navy py-2 text-sm font-medium">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}