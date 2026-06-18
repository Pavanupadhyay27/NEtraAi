"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { useToast } from "@/app/utils/toast";
import { fetchApi, parseDateTime, getLocalDateString, getBackendUrl } from "@/app/utils/api";
import { Clock, Search, Edit3, Calendar, Activity, AlertTriangle, X, CheckCircle2, ChevronDown, Check } from "lucide-react";

type Tab = "feed" | "logs";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Present: "badge-emerald",
    Late: "badge-amber",
    Absent: "badge-rose",
    "Half Day": "badge-indigo",
    "On Leave": "badge-slate",
    "Work From Home": "badge-blue",
    Holiday: "badge-slate",
  };
  
  const statusColor = map[status] || "badge-slate";
  
  return (
    <span className={`badge ${statusColor} flex items-center gap-1 w-fit`}>
      {status === "Present" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      {status === "Late" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
      {status}
    </span>
  );
}

function EmployeeAvatar({ emp, avatarColor, size = "md" }: { emp: any; avatarColor: string; size?: "sm" | "md" }) {
  const [error, setError] = useState(false);
  const hasFrontImage = emp.images?.some((img: any) => img.pose_type.toLowerCase() === "front");

  const sizeCls = size === "sm" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-[11px]";

  if (hasFrontImage && !error) {
    const baseUrl = getBackendUrl().replace("/api/v1", "");
    return (
      <img
        src={`${baseUrl}/uploads/${emp.employee_id}/front.jpg`}
        alt={emp.name}
        className={`${size === "sm" ? "w-8 h-8" : "w-10 h-10"} rounded-lg object-cover border border-zinc-250 shadow-sm shrink-0`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${sizeCls} rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 border font-bold shadow-sm`}>
      {emp.name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [statusVal, setStatusVal] = useState("Present");
  const [emergencyAllowed, setEmergencyAllowed] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchApi("/departments/")
  });

  const { data: attendanceFeed, isLoading: loadingFeed } = useQuery({
    queryKey: ["attendance-feed", selectedDate, deptFilter],
    queryFn: () => {
      let params = [`date_val=${selectedDate}`];
      if (deptFilter) params.push(`department_id=${deptFilter}`);
      return fetchApi(`/attendance/daily?${params.join("&")}`);
    }
  });

  const { data: rawLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ["raw-logs", selectedDate],
    queryFn: () => fetchApi(`/attendance/logs?date_str=${selectedDate}`)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      fetchApi(`/attendance/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-feed"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowEditDialog(false);
      setEditingRecord(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update attendance.")
  });

  const handleEditClick = (record: any) => {
    setEditingRecord(record);
    const fmt = (d: string | null) => {
      if (!d) return "";
      const dt = parseDateTime(d);
      if (!dt) return "";
      return `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
    };
    setCheckInTime(fmt(record.check_in));
    setCheckOutTime(fmt(record.check_out));
    setStatusVal(record.status);
    setEmergencyAllowed(record.emergency_allowed || false);
    setShowEditDialog(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const combine = (t: string) => {
      if (!t) return null;
      const [yr, mo, dy] = selectedDate.split("-").map(Number);
      const [hr, mn] = t.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${yr}-${pad(mo)}-${pad(dy)}T${pad(hr)}:${pad(mn)}:00`;
    };
    updateMutation.mutate({
      id: editingRecord.id,
      payload: { 
        status: statusVal, 
        check_in: combine(checkInTime), 
        check_out: combine(checkOutTime),
        emergency_allowed: emergencyAllowed
      }
    });
  };

  const filtered = attendanceFeed?.filter((r: any) =>
    r.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    r.employee.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all w-full";
  const selectCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all appearance-none cursor-pointer w-full pr-8";

  // Avatar gradient styles
  const avatarColors = [
    "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/15",
    "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/15",
    "from-rose-500/20 to-orange-500/20 text-rose-400 border-rose-500/15",
    "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/15",
    "from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/15",
  ];

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/5">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Attendance Ledger</h1>
          </div>
          
          {/* Tab switcher */}
          <div className="flex items-center p-1 bg-zinc-100 border border-zinc-200 rounded-2xl self-start sm:self-center shrink-0">
            {(["feed", "logs"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-slate-550 hover:text-slate-800"
                }`}
              >
                {tab === "feed" ? (
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Daily Ledger</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Raw Scan Logs</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4.5 rounded-2xl bg-white/[0.015] border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          <div className="relative col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by employee name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} !pl-10 h-10`}
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`${inputCls} !pl-10 h-10`}
            />
          </div>

          <div className="relative">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={`${selectCls} h-10`}
            >
              <option value="">All Departments</option>
              {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        {activeTab === "feed" ? (
          <div className="glass-card rounded-2xl border border-white/6 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 bg-white/[0.005]">
              <p className="text-[11px] text-slate-500 font-mono">
                {loadingFeed ? "Fetching..." : `${filtered?.length || 0} ledger records for ${selectedDate}`}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left py-3.5 px-5">Employee</th>
                    <th className="text-left py-3.5 px-5">Check In</th>
                    <th className="text-left py-3.5 px-5">Check Out</th>
                    <th className="text-left py-3.5 px-5">Work Hours</th>
                    <th className="text-left py-3.5 px-5">Status</th>
                    <th className="text-center py-3.5 px-5 w-[100px]">Override</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFeed ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-4 px-5"><div className="skeleton h-4 w-20" /></td>
                      ))}</tr>
                    ))
                  ) : filtered?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-slate-600" />
                          </div>
                          <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider">No Records</p>
                          <p className="text-[11px] text-slate-600 leading-relaxed">No presence records registered for this date.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered?.map((rec: any) => {
                      const avatarColor = avatarColors[rec.employee.id % avatarColors.length];
                      return (
                        <tr key={rec.id}>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar emp={rec.employee} avatarColor={avatarColor} />
                              <div>
                                <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{rec.employee.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{rec.employee.employee_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {rec.check_in ? parseDateTime(rec.check_in)?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : <span className="text-slate-400 italic">n/a</span>}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {rec.check_out ? parseDateTime(rec.check_out)?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : <span className="text-slate-400 italic">n/a</span>}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {rec.working_hours ? (
                              <span className="font-semibold text-[var(--text-primary)]">{rec.working_hours.toFixed(1)} hrs</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5"><StatusBadge status={rec.status} /></td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={() => handleEditClick(rec)}
                              className="p-2 rounded-xl text-slate-500 hover:text-blue-400 hover:bg-blue-500/8 border border-transparent hover:border-blue-500/15 transition-all cursor-pointer"
                              title="Manual override attendance status"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/6 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 bg-white/[0.005]">
              <p className="text-[11px] text-slate-500 font-mono">
                {loadingLogs ? "Fetching..." : `${rawLogs?.length || 0} swipe events for ${selectedDate}`}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left py-3.5 px-5 whitespace-nowrap">Timestamp</th>
                    <th className="text-left py-3.5 px-5 whitespace-nowrap">Identity Profile</th>
                    <th className="text-left py-3.5 px-5 whitespace-nowrap">Terminal</th>
                    <th className="text-left py-3.5 px-5 whitespace-nowrap">Confidence</th>
                    <th className="text-left py-3.5 px-5 whitespace-nowrap">Liveness</th>
                    <th className="text-left py-3.5 px-5 whitespace-nowrap">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLogs ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-4 px-5"><div className="skeleton h-4 w-20" /></td>
                      ))}</tr>
                    ))
                  ) : rawLogs?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                          <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-slate-600" />
                          </div>
                          <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider">No logs</p>
                          <p className="text-[11px] text-slate-600 leading-relaxed">No terminal camera logs registered for this date.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rawLogs?.map((log: any) => {
                      const isSuccess = log.status === "Match Success";
                      const isSpoof = log.is_spoof;
                      const avatarColor = log.employee ? avatarColors[log.employee.id % avatarColors.length] : "";
                      return (
                        <tr key={log.id}>
                          <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            <div className="font-semibold text-slate-700">
                              {parseDateTime(log.timestamp)?.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {parseDateTime(log.timestamp)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            {log.employee ? (
                              <div className="flex items-center gap-2.5">
                                <EmployeeAvatar emp={log.employee} avatarColor={avatarColor} size="sm" />
                                <div>
                                  <p className="text-[12.5px] font-semibold text-slate-900 leading-none">{log.employee.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-1 leading-none">{log.employee.employee_id}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-dashed border-slate-200 shrink-0">
                                  <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <div>
                                  <p className="text-[12.5px] font-medium text-slate-400 italic leading-none">Unknown Identity</p>
                                  <p className="text-[10px] text-slate-350 font-mono mt-1 leading-none">External Scan</p>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-mono text-slate-600 font-semibold uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              {log.camera}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-[11.5px] whitespace-nowrap">
                            {log.confidence ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${log.confidence >= 0.75 ? "bg-emerald-500" : log.confidence >= 0.60 ? "bg-amber-500" : "bg-rose-500"}`} />
                                  <span className="font-semibold text-slate-700">
                                    {(log.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${log.confidence >= 0.75 ? "bg-emerald-500" : log.confidence >= 0.60 ? "bg-amber-500" : "bg-rose-500"}`}
                                    style={{ width: `${log.confidence * 100}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-[11.5px] whitespace-nowrap">
                            {log.liveness_score ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${log.liveness_score >= 0.85 ? "bg-emerald-500" : log.liveness_score >= 0.70 ? "bg-amber-500" : "bg-rose-500"}`} />
                                  <span className="font-semibold text-slate-700">
                                    {(log.liveness_score * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${log.liveness_score >= 0.85 ? "bg-emerald-500" : log.liveness_score >= 0.70 ? "bg-amber-500" : "bg-rose-500"}`}
                                    style={{ width: `${log.liveness_score * 100}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span className={`badge ${
                              isSuccess 
                                ? "badge-emerald" 
                                : isSpoof 
                                  ? "badge-rose animate-pulse" 
                                  : log.status.toLowerCase().includes("lock") 
                                    ? "badge-rose" 
                                    : "badge-amber"
                            } flex items-center gap-1.5 w-fit font-bold`}>
                              {isSpoof && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                              {isSuccess ? "Matched" : isSpoof ? "Liveness Failed" : log.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Override Modal */}
      {showEditDialog && editingRecord && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Manual Override</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingRecord.employee.name} · {selectedDate}
                </p>
              </div>
              <button 
                onClick={() => setShowEditDialog(false)} 
                className="p-2 rounded-xl hover:bg-white/6 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Check-In</label>
                  <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Check-Out</label>
                  <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} className={inputCls} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Override</label>
                <div className="relative">
                  <select value={statusVal} onChange={(e) => setStatusVal(e.target.value)} className={selectCls}>
                    {["Present","Absent","Late","Half Day","On Leave","Work From Home","Holiday"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-55 border border-zinc-150 space-y-1 mt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={emergencyAllowed}
                    onChange={() => setEmergencyAllowed(!emergencyAllowed)}
                    className="w-4 h-4 rounded border-slate-350 text-slate-950 bg-white focus:ring-slate-500/50 cursor-pointer"
                  />
                  <span className="text-[12px] font-bold text-slate-800">Allow Emergency Re-entry (Bypass Lock)</span>
                </label>
                <p className="text-[10px] text-slate-500 leading-normal pl-6.5">
                  Allows employee to scan again at the kiosk today after check-out. The lock will automatically re-apply upon their next scan.
                </p>
              </div>
              
              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setShowEditDialog(false)} 
                  className="btn-ghost h-9.5 px-4 text-[12px] rounded-xl cursor-pointer hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updateMutation.isPending} 
                  className="btn-primary h-9.5 px-5 text-[12px] flex items-center gap-2 rounded-xl cursor-pointer"
                >
                  {updateMutation.isPending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
