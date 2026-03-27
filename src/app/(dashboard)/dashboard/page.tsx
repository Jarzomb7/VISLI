"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  totalClients: number;
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  recentLicenses: {
    id: string;
    licenseKey: string;
    domain: string;
    status: string;
    plan: string;
    expiresAt: string;
    createdAt: string;
    client: { email: string } | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8 pt-8 lg:pt-0">
          <div className="h-8 w-48 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/[0.04] animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Clients",
      value: data?.totalClients ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      color: "from-blue-500/20 to-blue-600/10",
      iconColor: "text-blue-400",
    },
    {
      label: "Total Licenses",
      value: data?.totalLicenses ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ),
      color: "from-purple-500/20 to-purple-600/10",
      iconColor: "text-purple-400",
    },
    {
      label: "Active Licenses",
      value: data?.activeLicenses ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "from-emerald-500/20 to-emerald-600/10",
      iconColor: "text-emerald-400",
    },
    {
      label: "Expired Licenses",
      value: data?.expiredLicenses ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
      color: "from-red-500/20 to-red-600/10",
      iconColor: "text-red-400",
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 pt-8 lg:pt-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-white/40">
          License management overview for VISLI
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="glass-card-hover p-6"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/30">
                  {stat.label}
                </p>
                <p className="mt-3 font-display text-3xl font-bold text-white">
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                <span className={stat.iconColor}>{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Licenses */}
      <div className="glass-card">
        <div className="border-b border-white/[0.05] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-white">
            Recent Licenses
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  License Key
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.recentLicenses.map((license) => (
                <tr
                  key={license.id}
                  className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-6 py-4">
                    <code className="font-mono text-xs text-[#5f83f4]">
                      {license.licenseKey}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {license.domain}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`status-${license.status}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        license.status === "active" ? "bg-emerald-400" :
                        license.status === "expired" ? "bg-red-400" : "bg-amber-400"
                      }`} />
                      {license.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-white/50 uppercase">
                      {license.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/40">
                    {new Date(license.expiresAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!data?.recentLicenses || data.recentLicenses.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-white/30">
                    No licenses yet. Create your first license to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
