"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, parseDateTime } from "@/app/utils/api";
import { 
  History, Search, RefreshCw, ChevronLeft, ChevronRight, 
  ShieldAlert, Activity, Key, UserPlus, Sliders, Laptop, Trash2
} from "lucide-react";
import { useToast } from "@/app/utils/toast";


export default function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const [search, setSearch] = useState("");

  const { data: logs, isLoading, isPlaceholderData, refetch } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => fetchApi(`/audit/?skip=${page * limit}&limit=${limit}`),
    placeholderData: (prev) => prev
  });

  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearLogs = async () => {
    setIsDeleting(true);
    try {
      await fetchApi("/audit/", { method: "DELETE" });
      toast.success("Audit logs cleared successfully.");
      setShowClearConfirm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear audit logs");
    } finally {
      setIsDeleting(false);
    }
  };



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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={isDeleting}
              className="text-[12px] h-10 px-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white hover:opacity-90 active:scale-95 shadow-md shadow-red-950/20 border border-red-500/20 cursor-pointer transition-all font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </button>
            <button
              onClick={() => refetch()}
              className="btn-ghost text-[12px] h-9.5 px-4 flex items-center gap-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </button>
          </div>
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

      {/* Clear Logs Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop z-50">
          <div className="modal-content max-w-sm border border-red-500/10 shadow-[0_12px_40px_rgba(239,68,68,0.12)]">
            <div className="flex flex-col items-center text-center p-2 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center text-rose-500 shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Confirm Clear Logs</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Are you absolutely sure you want to clear all system audit logs?
                </p>
                <p className="text-[10.5px] text-rose-650 font-medium bg-rose-500/5 border border-rose-500/10 rounded-xl p-2.5 mt-3 leading-normal">
                  Warning: All existing system activity and audit logs will be permanently cleared. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2.5 w-full pt-2 border-t border-zinc-100">
                <button 
                  type="button" 
                  onClick={() => setShowClearConfirm(false)} 
                  disabled={isDeleting}
                  className="flex-1 btn-ghost h-9.5 text-[12px] rounded-xl cursor-pointer hover:bg-zinc-100 text-zinc-700 font-medium border border-zinc-200"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleClearLogs}
                  disabled={isDeleting}
                  className="flex-1 bg-gradient-to-r from-red-650 to-rose-600 hover:opacity-90 active:scale-95 text-white font-bold text-[12px] rounded-xl cursor-pointer h-10 flex items-center justify-center gap-2 shadow-md shadow-rose-950/15 border border-rose-500/10 transition-all"
                >
                  {isDeleting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Clear Logs"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
