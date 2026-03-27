"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface License {
  id: string;
  licenseKey: string;
  domain: string;
  status: string;
  plan: string;
  expiresAt: string;
  client: { id: string; email: string; name: string | null } | null;
}

export default function EditLicensePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<"basic" | "pro">("basic");
  const [status, setStatus] = useState<"active" | "expired" | "suspended">("active");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetch(`/api/licenses/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.license) {
          setLicense(data.license);
          setDomain(data.license.domain);
          setPlan(data.license.plan);
          setStatus(data.license.status);
          setExpiresAt(data.license.expiresAt.split("T")[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/licenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          plan,
          status,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update license");
        return;
      }

      router.push("/licenses");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in pt-8 lg:pt-0">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06] animate-pulse mb-8" />
        <div className="glass-card h-96 animate-pulse" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-white/40">License not found</p>
          <Link href="/licenses" className="btn-ghost mt-4 inline-block">
            Back to Licenses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 pt-8 lg:pt-0">
        <Link href="/licenses" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/30 transition-colors hover:text-white/60">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Licenses
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">Edit License</h1>
        <p className="mt-1 text-sm text-white/40">
          <code className="font-mono text-[#5f83f4]">{license.licenseKey}</code>
        </p>
      </div>

      <div className="glass-card w-full max-w-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/30">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="glass-input"
              required
            />
          </div>

          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-white/30">Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {(["basic", "pro"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                    plan === p
                      ? "border-[#3b5eee]/50 bg-[#3b5eee]/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <p className={`text-sm font-semibold uppercase ${plan === p ? "text-[#5f83f4]" : "text-white/50"}`}>{p}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-white/30">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(["active", "expired", "suspended"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-xl border px-3 py-2.5 text-center text-sm font-medium capitalize transition-all duration-200 ${
                    status === s
                      ? s === "active"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : s === "expired"
                        ? "border-red-500/50 bg-red-500/10 text-red-400"
                        : "border-amber-500/50 bg-amber-500/10 text-amber-400"
                      : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-white/[0.12]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/30">Expires At</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="glass-input"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/licenses" className="btn-ghost flex-1 text-center">Cancel</Link>
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
