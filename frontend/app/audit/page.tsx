"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, parseDateTime } from "@/app/utils/api";
import { 
  History, Search, RefreshCw, ChevronLeft, ChevronRight, 
  ShieldAlert, Activity, Key, UserPlus, Sliders, Laptop, Trash2,
  Lock, AlertTriangle, ShieldCheck, CheckCircle2, FileText
} from "lucide-react";
import { useToast } from "@/app/utils/toast";

export default function AuditLogsPage() {
  const queryClient = useQueryClient();
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
      setPage(0);
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
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
    const ipMatch = log.ip_address?.toLowerCase().includes(term);
    return actionMatch || userMatch || detailsMatch || ipMatch;
  });

  // Calculate statistics metrics
  const totalCount = logs?.length || 0;
  const loginCount = logs?.filter((l: any) => l.action?.toLowerCase().includes("login") || l.action?.toLowerCase().includes("auth")).length || 0;
  const configCount = logs?.filter((l: any) => l.action?.toLowerCase().includes("setting") || l.action?.toLowerCase().includes("update")).length || 0;
  const alertCount = logs?.filter((l: any) => l.action?.toLowerCase().includes("delete") || l.action?.toLowerCase().includes("spoof") || l.action?.toLowerCase().includes("clear")).length || 0;

  // Helper to map log actions to modern icons and badge colors
  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("login") || act.includes("auth")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Key className="w-3.5 h-3.5 text-emerald-500" /> {action}
        </span>
      );
    }
    if (act.includes("create") || act.includes("enroll") || act.includes("add")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <UserPlus className="w-3.5 h-3.5 text-blue-500" /> {action}
        </span>
      );
    }
    if (act.includes("delete") || act.includes("clear") || act.includes("remove")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> {action}
        </span>
      );
    }
    if (act.includes("setting") || act.includes("update") || act.includes("policy")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Sliders className="w-3.5 h-3.5 text-amber-500" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
        <Activity className="w-3.5 h-3.5 text-cyan-500" /> {action}
      </span>
    );
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter pb-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                <History className="w-5 h-5" />
              </div>
              System Audit Logs & Security Telemetry
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
              Complete immutable event history, administrative action trails, and device authentication logs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700/60 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-70"
            >
              <RefreshCw 
                className={`w-3.5 h-3.5 text-cyan-500 inline-block ${isRefreshing ? "animate-spin spin-icon" : ""}`}
                style={isRefreshing ? { animation: "spin-360 0.8s linear infinite", transformOrigin: "center" } : {}}
              />
              Refresh Logs
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Audit History
            </button>
          </div>
        </div>

        {/* Audit Stats Counter Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          
          <div className="tech-card-3d-minimal p-3.5 space-y-1">
            <div className="flex justify-between items-center text-zinc-450 dark:text-zinc-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Recorded Events</span>
              <FileText className="w-3.5 h-3.5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{totalCount}</p>
          </div>

          <div className="tech-card-3d-minimal p-3.5 space-y-1">
            <div className="flex justify-between items-center text-zinc-450 dark:text-zinc-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Auth & Logins</span>
              <Key className="w-3.5 h-3.5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{loginCount}</p>
          </div>

          <div className="tech-card-3d-minimal p-3.5 space-y-1">
            <div className="flex justify-between items-center text-zinc-450 dark:text-zinc-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Config Updates</span>
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{configCount}</p>
          </div>

          <div className="tech-card-3d-minimal p-3.5 space-y-1">
            <div className="flex justify-between items-center text-zinc-450 dark:text-zinc-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Critical Alerts</span>
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{alertCount}</p>
          </div>

        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by action, email, details, or IP address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "2.4rem" }}
              className="w-full h-10 pr-3.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          <span className="text-xs font-mono font-bold text-zinc-400 self-end sm:self-center">
            Showing Page {page + 1} ({filteredLogs?.length || 0} entries)
          </span>
        </div>

        {/* Audit Log Data Table Container */}
        <div className="tech-card-3d-minimal overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-mono text-[10px] font-bold">
                  <th className="py-3.5 px-5 w-[160px]">Timestamp</th>
                  <th className="py-3.5 px-5 w-[200px]">Action Performed</th>
                  <th className="py-3.5 px-5 w-[220px]">Actor Email</th>
                  <th className="py-3.5 px-5">Event Details</th>
                  <th className="py-3.5 px-5 w-[140px] text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {isLoading ? (
                  Array.from({ length: 7 }).map((_, i) => (
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
                    <td colSpan={5} className="py-20 text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                        <History className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No audit logs found</h3>
                        <p className="text-[10px] text-zinc-400">Try adjusting your search filters or refresh logs</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-zinc-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">
                        {log.timestamp ? parseDateTime(log.timestamp)?.toLocaleString() : "—"}
                      </td>
                      <td className="py-3.5 px-5">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-zinc-100">
                        {log.user?.email || <span className="text-zinc-400 dark:text-zinc-500 italic font-normal">System / Automated</span>}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-300 pr-6 leading-relaxed">
                        {log.details}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-zinc-500 dark:text-zinc-400 text-[11px] text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700/50">
                          <Laptop className="w-3 h-3 text-zinc-400" />
                          {log.ip_address || "Internal"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Clean Dark Mode Adaptive Footer Pagination */}
          <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-bold">
              Page {page + 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((old) => Math.max(old - 1, 0))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-40 transition-all cursor-pointer"
                title="Previous Page"
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
                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-40 transition-all cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Clear Logs Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop z-[9999]">
          <div className="modal-content max-w-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Confirm Clear Audit Logs</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to permanently clear all security audit records?
                </p>
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-left w-full">
                ⚠️ Warning: All existing historical telemetry logs will be deleted from the database. This action cannot be reversed.
              </p>
              <div className="flex gap-2 w-full pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => setShowClearConfirm(false)} 
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleClearLogs}
                  disabled={isDeleting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer py-2.5 flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  {isDeleting ? "Clearing..." : "Yes, Clear All Logs"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </SidebarLayout>
  );
}
