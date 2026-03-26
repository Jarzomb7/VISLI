"use client";

import { useEffect, useState, useCallback } from "react";
import { getLicenses, updateLicense } from "@/lib/api";

interface License {
  id: string;
  licenseKey: string;
  apiKey: string;
  domain: string | null;
  status: string;
  plan: string;
  killSwitch: boolean;
  expiresAt: string | null;
  lastValidated: string | null;
  createdAt: string;
  userEmail: string;
  smsUsage: { used: number; limit: number } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [smsModal, setSmsModal] = useState<{ id: string; userId?: string } | null>(null);
  const [smsValue, setSmsValue] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getLicenses(page, search, statusFilter);
      setLicenses(data.licenses);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, action: string, extra?: Record<string, unknown>) {
    setActionLoading(id);
    try {
      await updateLicense(id, { action, ...extra });
      await load(pagination.page);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSmsSubmit() {
    if (!smsModal) return;
    const val = parseInt(smsValue);
    if (isNaN(val) || val < 0) return alert("Nieprawidłowa wartość");
    await handleAction(smsModal.id, "update_sms", { smsLimit: val });
    setSmsModal(null);
    setSmsValue("");
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    INACTIVE: "bg-gray-50 text-gray-500 border-gray-200",
    SUSPENDED: "bg-red-50 text-red-700 border-red-200",
    EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Licencje</h1>
        <p className="text-sm text-gray-500 mt-1">Zarządzaj licencjami klientów</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Szukaj (klucz, domena, email)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="flex-1 max-w-sm px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); }}
          className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Wszystkie statusy</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <button onClick={() => load()} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition">
          Szukaj
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Klucz licencji</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Domena</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">SMS</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Wygasa</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Ładowanie...</td></tr>
              ) : licenses.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Brak licencji</td></tr>
              ) : (
                licenses.map((lic) => (
                  <tr key={lic.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-900 font-medium">{lic.userEmail}</td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded-md">{lic.licenseKey}</code>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{lic.domain || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[lic.status] || "bg-gray-50 text-gray-500"}`}>
                        {lic.status}
                        {lic.killSwitch && " ⚡"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 font-medium">{lic.plan}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {lic.smsUsage ? `${lic.smsUsage.used}/${lic.smsUsage.limit}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString("pl-PL") : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        {lic.status !== "ACTIVE" && (
                          <ActionBtn label="Aktywuj" color="green" loading={actionLoading === lic.id} onClick={() => handleAction(lic.id, "activate")} />
                        )}
                        {lic.status === "ACTIVE" && (
                          <ActionBtn label="Deaktywuj" color="amber" loading={actionLoading === lic.id} onClick={() => handleAction(lic.id, "deactivate")} />
                        )}
                        {!lic.killSwitch ? (
                          <ActionBtn label="Kill" color="red" loading={actionLoading === lic.id} onClick={() => { if (confirm("Na pewno aktywować kill switch?")) handleAction(lic.id, "kill"); }} />
                        ) : (
                          <ActionBtn label="Unkill" color="blue" loading={actionLoading === lic.id} onClick={() => handleAction(lic.id, "unkill")} />
                        )}
                        <ActionBtn label="SMS" color="gray" loading={false} onClick={() => { setSmsModal({ id: lic.id }); setSmsValue(String(lic.smsUsage?.limit || 100)); }} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Strona {pagination.page} z {pagination.totalPages} · {pagination.total} rekordów
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

      {/* SMS Modal */}
      {smsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSmsModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Zmień limit SMS</h3>
            <input
              type="number"
              min="0"
              value={smsValue}
              onChange={(e) => setSmsValue(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              placeholder="Nowy limit SMS"
            />
            <div className="flex gap-3">
              <button onClick={() => setSmsModal(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-200 transition">
                Anuluj
              </button>
              <button onClick={handleSmsSubmit} className="flex-1 py-2.5 bg-brand-600 text-white font-medium text-sm rounded-xl hover:bg-brand-700 transition">
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }: { label: string; color: string; loading: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
    red: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    gray: "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition disabled:opacity-40 ${colors[color] || colors.gray}`}
    >
      {label}
    </button>
  );
}
