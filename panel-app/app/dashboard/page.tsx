"use client";

import { useEffect, useState } from "react";
import { getStats } from "@/lib/api";
import StatCard from "@/components/ui/StatCard";

interface Stats {
  totalUsers: number;
  totalLicenses: number;
  activeLicenses: number;
  suspendedLicenses: number;
  totalSmsUsed: number;
  activeSubscriptions: number;
  apiRequestsLast24h: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-red-500">Nie udało się załadować statystyk.</p>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Przegląd systemu Visli</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Użytkownicy"
          value={stats.totalUsers}
          sub="łącznie"
          accent="brand"
        />
        <StatCard
          label="Aktywne licencje"
          value={stats.activeLicenses}
          sub={`z ${stats.totalLicenses} łącznie`}
          accent="green"
        />
        <StatCard
          label="Zawieszone"
          value={stats.suspendedLicenses}
          sub="licencji"
          accent="red"
        />
        <StatCard
          label="Aktywne subskrypcje"
          value={stats.activeSubscriptions}
          accent="green"
        />
        <StatCard
          label="SMS wysłane"
          value={stats.totalSmsUsed.toLocaleString("pl-PL")}
          sub="łącznie"
          accent="amber"
        />
        <StatCard
          label="Zapytania API (24h)"
          value={stats.apiRequestsLast24h.toLocaleString("pl-PL")}
          sub="ostatnia doba"
          accent="brand"
        />
      </div>
    </div>
  );
}
