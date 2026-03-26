"use client";

import { useEffect, useState, useCallback } from "react";
import { getUsers } from "@/lib/api";

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  licenses: {
    id: string;
    licenseKey: string;
    domain: string | null;
    status: string;
    plan: string;
    killSwitch: boolean;
  }[];
  subscription: { status: string; plan: string; currentPeriodEnd: string | null } | null;
  smsUsage: { used: number; limit: number; resetDate: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getUsers(page, search);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Użytkownicy</h1>
        <p className="text-sm text-gray-500 mt-1">Lista wszystkich klientów</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Szukaj po emailu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="flex-1 max-w-sm px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button onClick={() => load()} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition">
          Szukaj
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Ładowanie...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Brak użytkowników</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header Row */}
              <button
                onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {user.email[0].toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-400">
                      Zarejestrowany: {new Date(user.createdAt).toLocaleDateString("pl-PL")}
                      {user.role === "ADMIN" && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-bold">ADMIN</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {user.subscription && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      user.subscription.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {user.subscription.plan} · {user.subscription.status}
                    </span>
                  )}
                  <span className="text-gray-300 text-lg">{expanded === user.id ? "▾" : "▸"}</span>
                </div>
              </button>

              {/* Expanded details */}
              {expanded === user.id && (
                <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {/* Licenses */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Licencje</h4>
                      {user.licenses.length === 0 ? (
                        <p className="text-sm text-gray-400">Brak</p>
                      ) : (
                        user.licenses.map((lic) => (
                          <div key={lic.id} className="mb-2 p-3 bg-gray-50 rounded-xl">
                            <code className="text-xs font-mono block mb-1">{lic.licenseKey}</code>
                            <p className="text-xs text-gray-500">
                              {lic.domain || "brak domeny"} · {lic.status} · {lic.plan}
                              {lic.killSwitch && <span className="text-red-600 font-bold ml-1">⚡ KILL</span>}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Subscription */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Subskrypcja</h4>
                      {user.subscription ? (
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <p className="text-sm font-medium text-gray-900">{user.subscription.plan}</p>
                          <p className="text-xs text-gray-500">
                            Status: {user.subscription.status}
                          </p>
                          {user.subscription.currentPeriodEnd && (
                            <p className="text-xs text-gray-500">
                              Ważna do: {new Date(user.subscription.currentPeriodEnd).toLocaleDateString("pl-PL")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Brak subskrypcji</p>
                      )}
                    </div>

                    {/* SMS */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">SMS</h4>
                      {user.smsUsage ? (
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <p className="text-sm font-medium text-gray-900">
                            {user.smsUsage.used} / {user.smsUsage.limit}
                          </p>
                          <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (user.smsUsage.used / user.smsUsage.limit) * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Reset: {new Date(user.smsUsage.resetDate).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Brak danych SMS</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-gray-400">
            Strona {pagination.page} z {pagination.totalPages} · {pagination.total} użytkowników
          </p>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition">
              ← Wstecz
            </button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition">
              Dalej →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
