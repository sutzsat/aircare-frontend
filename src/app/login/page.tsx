"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wind } from "lucide-react";
import { login, ApiError } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(phone, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="rounded-full p-2.5 mb-3" style={{ backgroundColor: "var(--color-orange)" }}>
            <Wind className="text-white" size={22} />
          </div>
          <h1 className="font-[var(--font-display)] text-lg font-bold" style={{ color: "var(--color-navy)" }}>
            AirCare Challenge
          </h1>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>Staff Dashboard · latest build</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-5 bg-[var(--color-card)] border border-[var(--color-border)]"
        >
          {error && (
            <div className="mb-4 rounded-lg text-sm px-3 py-2" style={{ backgroundColor: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
              {error}
            </div>
          )}
          <label className="text-sm font-medium block mb-1.5">Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Registered phone number"
            className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)] mb-4"
          />
          <label className="text-sm font-medium block mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)] mb-5"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-orange)" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
