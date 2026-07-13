"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wind, LogOut, UserPlus, Users as UsersIcon, Upload, Download } from "lucide-react";
import { getCurrentClaims, clearTokens } from "@/lib/auth";
import { listUsers, createUser, bulkImportRoUsers, UserRecord, BulkImportResult } from "@/lib/dashboardApi";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 bg-[var(--color-card)] border border-[var(--color-border)] ${className}`}>
      {children}
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Single-user create form state
  const [form, setForm] = useState({
    name: "", phone: "", email: "", password: "", role: "RO_USER", scope_type: "RO", scope_id: "",
  });

  // Bulk import state
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkImportResult[] | null>(null);

  useEffect(() => {
    const claims = getCurrentClaims();
    if (!claims) {
      router.push("/login");
      return;
    }
    if (claims.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }
    setAuthorized(true);
    refreshUsers();
  }, [router]);

  async function refreshUsers() {
    try {
      const res = await listUsers();
      setUsers(res.data.users);
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    try {
      await createUser({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
        role: form.role,
        scope_type: form.scope_type,
        scope_id: form.scope_id ? parseInt(form.scope_id) : undefined,
      });
      setSuccessMsg(`Created ${form.name}.`);
      setForm({ name: "", phone: "", email: "", password: "", role: "RO_USER", scope_type: "RO", scope_id: "" });
      refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    }
  }

  async function handleBulkImport() {
    setError("");
    setBulkResults(null);
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [erp_code, name, phone] = line.split(",").map((s) => s.trim());
        return { erp_code, name, phone };
      });

    if (rows.length === 0) {
      setError("Enter at least one row: erp_code,name,phone");
      return;
    }

    try {
      const res = await bulkImportRoUsers(rows);
      setBulkResults(res.data.results);
      refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed.");
    }
  }

  function downloadCredentialsCsv() {
    if (!bulkResults) return;
    const successRows = bulkResults.filter((r) => r.success);
    const csv = [
      "erp_code,phone,generated_password",
      ...successRows.map((r) => `${r.erp_code},${r.phone},${r.generated_password}`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ro_user_credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLogout() {
    clearTokens();
    router.push("/login");
  }

  if (!authorized || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "var(--color-muted)" }}>Loading…</div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--color-navy)" }}>
        <div className="flex items-center gap-2">
          <div className="rounded-full p-1.5" style={{ backgroundColor: "var(--color-orange)" }}>
            <Wind className="text-white" size={16} />
          </div>
          <div className="text-white text-sm font-bold font-[var(--font-display)]">User Management</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-white/80 hover:text-white text-xs">
            Back to Dashboard
          </button>
          <button onClick={handleLogout} className="text-white/80 hover:text-white flex items-center gap-1 text-xs">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="rounded-lg text-sm px-3 py-2" style={{ backgroundColor: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg text-sm px-3 py-2" style={{ backgroundColor: "var(--color-success-soft)", color: "var(--color-success)" }}>
            {successMsg}
          </div>
        )}

        {/* Single user creation */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={16} style={{ color: "var(--color-orange)" }} />
            <div className="text-sm font-semibold">Create a User</div>
          </div>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]" />
            <input required placeholder="Phone (10 digits)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]" />
            <input placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]" />
            <input required type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]">
              <option value="RO_USER">RO User</option>
              <option value="DISTRICT_ADMIN">District Admin</option>
              <option value="DO_ADMIN">DO Admin</option>
              <option value="STATE_ADMIN">State Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <select value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]">
              <option value="RO">RO</option>
              <option value="DISTRICT">District</option>
              <option value="DO">Divisional Office</option>
              <option value="STATE">State</option>
            </select>
            <input placeholder="Scope ID (RO/District/DO id, blank for State)" value={form.scope_id} onChange={(e) => setForm({ ...form, scope_id: e.target.value })} className="rounded-lg px-3 py-2 text-sm border border-[var(--color-border)] sm:col-span-2" />
            <button type="submit" className="sm:col-span-2 rounded-lg py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-orange)" }}>
              Create User
            </button>
          </form>
        </Card>

        {/* Bulk RO import */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Upload size={16} style={{ color: "var(--color-orange)" }} />
            <div className="text-sm font-semibold">Bulk Import RO Users</div>
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
            One row per line: <code>erp_code,name,phone</code> — e.g. <code>219578,Ramesh Kumar,9876543210</code>
          </p>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="219578,Ramesh Kumar,9876543210&#10;336658,Suresh Patel,9876543211"
            className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)] font-[var(--font-data)]"
          />
          <button onClick={handleBulkImport} className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-orange)" }}>
            Import
          </button>

          {bulkResults && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {bulkResults.filter((r) => r.success).length} succeeded, {bulkResults.filter((r) => !r.success).length} failed
                </div>
                <button onClick={downloadCredentialsCsv} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-orange)" }}>
                  <Download size={12} /> Download credentials CSV
                </button>
              </div>
              <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {bulkResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b" style={{ borderColor: "var(--color-border)" }}>
                    <span style={{ color: r.success ? "var(--color-success)" : "var(--color-danger)" }}>{r.success ? "✓" : "✗"}</span>
                    <span className="font-[var(--font-data)]">{r.erp_code}</span>
                    <span>{r.success ? `password: ${r.generated_password}` : r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Existing users list */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon size={16} style={{ color: "var(--color-orange)" }} />
            <div className="text-sm font-semibold">Existing Users ({users.length})</div>
          </div>
          <div className="text-xs space-y-1 max-h-64 overflow-y-auto">
            {users.map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: "var(--color-border)" }}>
                <span className="flex-1">{u.name}</span>
                <span style={{ color: "var(--color-muted)" }}>{u.phone}</span>
                <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-bg)" }}>{u.role}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
