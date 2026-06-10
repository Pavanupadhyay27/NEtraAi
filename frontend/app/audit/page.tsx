"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, parseDateTime } from "@/app/utils/api";
import { 
  History, Search, RefreshCw, ChevronLeft, ChevronRight, 
  ShieldAlert, Activity, Key, UserPlus, Sliders, Laptop
} from "lucide-react";

export default function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const [search, setSearch] = useState("");

  const { data: logs, isLoading, isPlaceholderData, refetch } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => fetchApi(`/audit/?skip=${page * limit}&limit=${limit}`),
    placeholderData: (prev) => prev
  });

  const filteredLogs = logs?.filter((log: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const actionMatch = log.action?.toLowerCase().includes(term);
    const userMatch = log.user?.email?.toLowerCase().includes(term);
    const detailsMatch = log.details?.toLowerCase().includes(term);
    return actionMatch || userMatch || detailsMatch;
  });

  // Helper to map log actions to modern icons
  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("login") || act.includes("auth")) return <Key className="w-4 h-4 text-emerald-600" />;
    if (act.includes("create") || act.includes("enroll")) return <UserPlus className="w-4 h-4 text-blue-600" />;
    if (act.includes("delete")) return <ShieldAlert className="w-4 h-4 text-rose-600" />;
    if (act.includes("setting") || act.includes("update")) return <Sliders className="w-4 h-4 text-amber-600" />;
    return <Activity className="w-4 h-4 text-zinc-500" />;
  };

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-700" />
              System Audit Logs
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Track admin dashboard actions, user activities, and kiosk alerts.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-ghost text-[12px] h-9.5 px-4 flex items-center gap-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Logs
          </button>
        </div>

        {/* Filter Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by action, email, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field h-9.5 pl-10 text-[12.5px] bg-white border-zinc-200 focus:border-zinc-800 text-zinc-900 rounded-xl transition-all w-full shadow-sm"
          />
        </div>

        {/* Audit Log Table */}
        <div className="glass-card rounded-2xl border border-zinc-200 overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 uppercase tracking-wider font-mono text-[10px] font-bold">
                  <th className="py-3 px-5 w-[140px]">Timestamp</th>
                  <th className="py-3 px-5 w-[180px]">Action</th>
                  <th className="py-3 px-5 w-[220px]">Actor</th>
                  <th className="py-3 px-5">Details</th>
                  <th className="py-3 px-5 w-[140px]">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 text-zinc-700">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-4 px-5">
                          <div className="skeleton h-4 w-28" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !filteredLogs || filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-zinc-400 font-medium font-mono">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-zinc-500 text-[11px]">
                        {log.timestamp ? parseDateTime(log.timestamp)?.toLocaleString() : "—"}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-zinc-100 border border-zinc-200/80">
                            {getActionIcon(log.action)}
                          </div>
                          <span className="font-semibold text-zinc-900">{log.action}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-zinc-650 font-medium">
                        {log.user?.email || <span className="text-zinc-400 italic">System / Anonymous</span>}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-600 pr-8">
                        {log.details}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-zinc-500 text-[11px] flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-zinc-400" />
                        {log.ip_address || "Local"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-mono">
              Page {page + 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((old) => Math.max(old - 1, 0))}
                disabled={page === 0}
                className="btn-ghost p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (logs && logs.length === limit) {
                    setPage((old) => old + 1);
                  }
                }}
                disabled={!logs || logs.length < limit || isPlaceholderData}
                className="btn-ghost p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-50 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
