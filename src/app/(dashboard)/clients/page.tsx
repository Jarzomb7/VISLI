"use client";

import { useEffect, useState, useCallback } from "react";

interface Client {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  licenses: {
    id: string;
    licenseKey: string;
    domain: string;
    status: string;
    plan: string;
    expiresAt: string;
  }[];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "15", search });
      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();
      setClients(data.clients || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 pt-8 lg:pt-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">Clients</h1>
        <p className="mt-1 text-sm text-white/40">View all registered clients and their licenses</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="glass-input pl-10"
            placeholder="Search clients..."
          />
        </div>
      </div>

      {/* Client List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="glass-card h-20 animate-pulse" />
          ))
        ) : clients.length === 0 ? (
          <div className="glass-card px-6 py-16 text-center text-sm text-white/30">
            No clients found.
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="glass-card-hover overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === client.id ? null : client.id)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-white/40">
                    {client.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80">{client.email}</p>
                    <p className="text-[11px] text-white/25">
                      {client.licenses.length} license{client.licenses.length !== 1 ? "s" : ""} &middot;
                      Joined {new Date(client.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {client.licenses.some((l) => l.status === "active") && (
                    <span className="status-active">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      active
                    </span>
                  )}
                  <svg
                    className={`h-4 w-4 text-white/20 transition-transform duration-200 ${expanded === client.id ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {/* Expanded licenses */}
              {expanded === client.id && client.licenses.length > 0 && (
                <div className="border-t border-white/[0.05] px-6 py-4 animate-fade-in">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/20">Key</th>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/20">Domain</th>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/20">Status</th>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/20">Plan</th>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/20">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.licenses.map((lic) => (
                        <tr key={lic.id} className="border-t border-white/[0.03]">
                          <td className="py-2.5">
                            <code className="font-mono text-[11px] text-[#5f83f4]">{lic.licenseKey}</code>
                          </td>
                          <td className="py-2.5 text-xs text-white/50">{lic.domain}</td>
                          <td className="py-2.5">
                            <span className={`status-${lic.status} !text-[10px]`}>
                              <span className={`h-1 w-1 rounded-full ${
                                lic.status === "active" ? "bg-emerald-400" :
                                lic.status === "expired" ? "bg-red-400" : "bg-amber-400"
                              }`} />
                              {lic.status}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="text-[11px] text-white/40 uppercase">{lic.plan}</span>
                          </td>
                          <td className="py-2.5 text-xs text-white/30">
                            {new Date(lic.expiresAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-white/30">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
