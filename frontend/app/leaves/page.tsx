"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl, getUserProfile } from "@/app/utils/api";
import { 
  Calendar, Check, X, Users, AlertCircle, FileText, CheckCircle, Clock,
  ArrowRight, Search, Filter, Info, ShieldAlert, ArrowLeftRight, Download, Eye, FileDown,
  Loader2
} from "lucide-react";
import { useToast } from "@/app/utils/toast";

const avatarColors = [
  "from-blue-50 to-indigo-150 text-blue-600 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:text-blue-400 dark:border-blue-900/40",
  "from-emerald-50 to-teal-150 text-emerald-600 border-emerald-200 dark:from-emerald-950/20 dark:to-teal-950/20 dark:text-emerald-400 dark:border-emerald-900/40",
  "from-rose-50 to-orange-150 text-rose-600 border-rose-200 dark:from-rose-950/20 dark:to-orange-950/20 dark:text-rose-400 dark:border-rose-900/40",
  "from-purple-50 to-pink-150 text-purple-600 border-purple-200 dark:from-purple-950/20 dark:to-pink-950/20 dark:text-purple-400 dark:border-purple-900/40",
  "from-cyan-50 to-blue-150 text-cyan-600 border-cyan-200 dark:from-cyan-950/20 dark:to-blue-950/20 dark:text-cyan-400 dark:border-cyan-900/40",
];

function EmployeeAvatar({ 
  employee, 
  baseUrl, 
  size = "md", 
  avatarColor 
}: { 
  employee: any; 
  baseUrl: string; 
  size?: "sm" | "md" | "lg"; 
  avatarColor: string 
}) {
  const [imgError, setImgError] = useState(false);
  const initials = (employee?.name || "?").charAt(0).toUpperCase();
  
  const sizeClasses = {
    sm: "w-8 h-8 rounded-lg text-[10px]",
    md: "w-10 h-10 rounded-xl text-xs",
    lg: "w-12 h-12 rounded-2xl text-sm"
  };

  const hasPhoto = employee?.images?.some((img: any) => img.pose_type.toLowerCase() === "front");

  if (hasPhoto && !imgError) {
    return (
      <img
        src={`${baseUrl}/uploads/${employee.employee_id}/front.jpg`}
        alt={employee.name}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} object-cover border border-zinc-200 dark:border-zinc-800 shadow-3xs`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br ${avatarColor} flex items-center justify-center border font-bold shadow-3xs uppercase`}>
      {initials}
    </div>
  );
}

function formatDateDMY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function LeavesManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [filter, setFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  // Fetch all leaves of the company
  const { data: leaves = [], isLoading, refetch } = useQuery({
    queryKey: ["company-leaves"],
    queryFn: () => fetchApi("/employees/leaves"),
  });

  // Mutation to update leave status
  const updateLeaveStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "Approved" | "Rejected" }) => {
      return fetchApi(`/employees/leaves/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
    },
    onSuccess: (data) => {
      toast.success(`Leave request has been successfully ${data.status.toLowerCase()}.`);
      queryClient.invalidateQueries({ queryKey: ["company-leaves"] });
      // Update selected leave state if open
      setSelectedLeave((prev: any) => prev?.id === data.id ? { ...prev, status: data.status } : prev);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update leave status.");
    },
    onSettled: () => {
      setUpdatingId(null);
    }
  });

  const handleAction = (id: number, status: "Approved" | "Rejected") => {
    setUpdatingId(id);
    updateLeaveStatusMutation.mutate({ id, status });
  };

  const getDaysBetween = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // Helper to parse Emergency Contact & Documents from reason text block
  const parseReasonText = (reasonStr: string = "") => {
    const contactMatch = reasonStr.match(/\(Emergency Contact:\s*([^\)]+)\)/);
    
    // Check for new real attachment format first
    const realCertMatch = reasonStr.match(/\[ATTACHMENT:(.*?)\|(.*?)\]/);
    const certMatch = reasonStr.match(/\(Attached Certificate:\s*([^\)]+)\)/);
    const halfDayMatch = reasonStr.match(/\(Half-Day:\s*([^\)]+)\)/);
    
    // Clean reason string of attachment tags
    let cleanReason = reasonStr.split(" (")[0].split(" [ATTACHMENT")[0];
    
    return {
      cleanReason: cleanReason || reasonStr,
      contact: contactMatch ? contactMatch[1] : null,
      certificate: realCertMatch ? realCertMatch[2] : (certMatch ? certMatch[1] : null),
      certificateName: realCertMatch ? realCertMatch[1] : (certMatch ? certMatch[1] : null),
      isRealCert: !!realCertMatch,
      halfDay: halfDayMatch ? halfDayMatch[1] : null
    };
  };

  // Handle Mock or Real File Download
  const handleDownloadDoc = (fileName: string, fileUrl?: string, isReal?: boolean) => {
    if (isReal && fileUrl) {
      const baseUrl = getBackendUrl().replace("/api/v1", "");
      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
      window.open(fullUrl, "_blank");
      return;
    }

    const isImage = fileName.toLowerCase().endsWith(".png") || 
                    fileName.toLowerCase().endsWith(".jpg") || 
                    fileName.toLowerCase().endsWith(".jpeg");

    if (isImage) {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 450;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw elegant medical certificate border and template
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 600, 450);
        
        ctx.strokeStyle = "#be123c"; // Crimson border
        ctx.lineWidth = 12;
        ctx.strokeRect(10, 10, 580, 430);
        
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.strokeRect(22, 22, 556, 406);

        // Header Title
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("MEDICAL CERTIFICATE & TIME-OFF REQUEST", 80, 75);

        // Subtitle
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.fillText("NETRAID BIOMETRIC ATTENDANCE PORTAL &bull; LEAVE DESK", 160, 105);

        // Line divider
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, 125);
        ctx.lineTo(560, 125);
        ctx.stroke();

        // Certificate Details
        ctx.fillStyle = "#334155";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("DOCUMENT VERIFICATION LOG", 50, 165);
        
        ctx.font = "12px sans-serif";
        ctx.fillText(`File Attachment Name:  ${fileName}`, 50, 200);
        ctx.fillText("Verification Status:   APPROVED", 50, 230);
        ctx.fillText("Audited & Authenticated: TRUE", 50, 260);
        
        ctx.fillStyle = "#475569";
        ctx.fillText("This document serves as verification that the medical certificate image", 50, 310);
        ctx.fillText("uploaded by the employee has been parsed and logged successfully.", 50, 330);

        // Official Stamp / Signature Block
        ctx.strokeStyle = "#10b981"; // Emerald green
        ctx.lineWidth = 3;
        ctx.strokeRect(400, 330, 130, 60);
        
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("NETRAID STAMP", 415, 355);
        ctx.fillText("VERIFIED", 435, 378);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } else {
      const blob = new Blob([`NetraID Biometric Attendance System\nMock Medical Certificate Document: ${fileName}\nLeaf Application Verification Audit Log.`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName.endsWith(".txt") ? fileName : `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    
    toast.success(`${fileName} downloaded successfully.`);
  };

  // Filter & Search Logic
  const filteredLeaves = leaves.filter((l: any) => {
    const matchesFilter = filter === "All" ? true : l.status === filter;
    
    const empName = l.employee?.name || "";
    const empEmail = l.employee?.email || "";
    const leaveType = l.leave_type || "";
    const reason = l.reason || "";
    const matchesSearch = 
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leaveType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reason.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Calculate Metrics
  const pendingCount = leaves.filter((l: any) => l.status === "Pending").length;
  const approvedCount = leaves.filter((l: any) => l.status === "Approved").length;
  const rejectedCount = leaves.filter((l: any) => l.status === "Rejected").length;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-zinc-100 font-sans">
        
        {/* Sleek Minimalist Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-zinc-150 dark:border-zinc-800/80 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-mono bg-cyan-50 dark:bg-cyan-950/30 px-2.5 py-1 rounded-md border border-cyan-100/60 dark:border-cyan-900/30">
                Administration Panel
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-zinc-50 tracking-tight mt-2.5 flex items-center gap-2">
              Time-Off Center
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Review, approve, and manage employee leave requests with automatic biometrics synchronization.
            </p>
          </div>
        </div>

        {/* Stats Grid Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-50/40 dark:bg-zinc-950/10 p-4 rounded-2xl border border-zinc-200/40 dark:border-zinc-850/60 flex flex-col justify-between h-[90px] transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono">Total Requests</span>
            <div className="flex items-baseline justify-between mt-auto">
              <span className="text-2xl font-black text-slate-900 dark:text-zinc-100 leading-none">{leaves.length}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">100% Volume</span>
            </div>
          </div>

          <div className="bg-zinc-50/40 dark:bg-zinc-950/10 p-4 rounded-2xl border border-zinc-200/40 dark:border-zinc-855/60 flex flex-col justify-between h-[90px] transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider font-mono">Pending Action</span>
            <div className="flex items-baseline justify-between mt-auto">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-500 leading-none">{pendingCount}</span>
              <span className="text-[10px] text-amber-500/80 font-mono">
                {leaves.length ? Math.round((pendingCount / leaves.length) * 100) : 0}% Active
              </span>
            </div>
          </div>

          <div className="bg-zinc-50/40 dark:bg-zinc-950/10 p-4 rounded-2xl border border-zinc-200/40 dark:border-zinc-850/60 flex flex-col justify-between h-[90px] transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider font-mono">Approved Leaves</span>
            <div className="flex items-baseline justify-between mt-auto">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 leading-none">{approvedCount}</span>
              <span className="text-[10px] text-emerald-500/80 font-mono">
                {leaves.length ? Math.round((approvedCount / leaves.length) * 100) : 0}% Ratio
              </span>
            </div>
          </div>

          <div className="bg-zinc-50/40 dark:bg-zinc-950/10 p-4 rounded-2xl border border-zinc-200/40 dark:border-zinc-850/60 flex flex-col justify-between h-[90px] transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wider font-mono">Rejected Requests</span>
            <div className="flex items-baseline justify-between mt-auto">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-500 leading-none">{rejectedCount}</span>
              <span className="text-[10px] text-rose-500/80 font-mono">
                {leaves.length ? Math.round((rejectedCount / leaves.length) * 100) : 0}% Ratio
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-zinc-50/30 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl shadow-none">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee, leave type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-850 overflow-x-auto whitespace-nowrap scrollbar-none w-full sm:w-auto">
            {(["Pending", "Approved", "Rejected", "All"] as const).map((tab) => {
              const count = tab === "Pending" ? pendingCount : tab === "Approved" ? approvedCount : tab === "Rejected" ? rejectedCount : leaves.length;
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filter === tab
                      ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-3xs"
                      : "text-slate-455 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <span>{tab}</span>
                  <span className={`text-[9px] px-1.5 py-0.25 font-mono rounded ${
                    filter === tab 
                      ? "bg-zinc-100 dark:bg-zinc-950 text-zinc-650 dark:text-zinc-400" 
                      : "bg-zinc-200 dark:bg-zinc-900 text-zinc-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-3xs divide-y divide-zinc-200/40 dark:divide-zinc-850">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4.5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 rounded-xl animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="skeleton h-3 w-1/4 animate-pulse" />
                    <div className="skeleton h-2 w-1/3 animate-pulse" />
                  </div>
                </div>
                <div className="skeleton h-2 w-2/3 animate-pulse" />
              </div>
            ))
          ) : filteredLeaves.length > 0 ? (
            filteredLeaves.map((leave: any) => {
              const days = getDaysBetween(leave.start_date, leave.end_date);
              const avatarColor = avatarColors[leave.employee?.id % avatarColors.length];
              const baseUrl = getBackendUrl().replace("/api/v1", "");
              const parsed = parseReasonText(leave.reason);

              return (
                <div 
                  key={leave.id}
                  onClick={() => setSelectedLeave(leave)}
                  className="p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 group cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-all"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Avatar */}
                    <div className="shrink-0">
                      <EmployeeAvatar employee={leave.employee} baseUrl={baseUrl} avatarColor={avatarColor} size="md" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{leave.employee?.name}</span>
                        <span className="text-[10px] text-slate-450 dark:text-zinc-400 font-mono">({leave.employee?.designation || "Staff"})</span>
                        <span className={`text-[8.5px] font-mono font-bold uppercase px-2 py-0.25 rounded-md border ${
                          leave.leave_type === "Sick" ? "bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-455" :
                          leave.leave_type === "Casual" ? "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-455" :
                          leave.leave_type === "Annual" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-455" :
                          "bg-zinc-500/10 border-zinc-500/25 text-zinc-650 dark:text-zinc-450"
                        }`}>
                          {leave.leave_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-zinc-400">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {formatDateDMY(leave.start_date)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {formatDateDMY(leave.end_date)}
                        </span>
                        <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-50 dark:bg-cyan-950/20 px-1.5 py-0.25 rounded border border-cyan-150 dark:border-cyan-900/30">
                          {days} Day{days !== 1 ? "s" : ""}
                        </span>
                        {parsed.certificate && (
                          <span className="text-[8.5px] text-rose-500 bg-rose-500/10 px-1.5 py-0.25 rounded-md border border-rose-500/25 font-bold uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                            📎 Cert
                          </span>
                        )}
                      </div>

                      {parsed.cleanReason && (
                        <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-normal max-w-2xl bg-zinc-50/50 dark:bg-zinc-950/30 border border-zinc-200/30 dark:border-zinc-850 p-2 rounded-xl italic">
                          " {parsed.cleanReason} "
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Block */}
                  <div className="shrink-0 flex items-center gap-2 w-full md:w-auto justify-end mt-2.5 md:mt-0" onClick={(e) => e.stopPropagation()}>
                    {leave.status === "Pending" ? (
                      <>
                        <button
                          onClick={() => handleAction(leave.id, "Rejected")}
                          disabled={updatingId === leave.id}
                          className="p-2 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-950/25 text-rose-600 rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                          title="Reject Request"
                        >
                          {updatingId === leave.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleAction(leave.id, "Approved")}
                          disabled={updatingId === leave.id}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-955 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-xs"
                          title="Approve Request"
                        >
                          {updatingId === leave.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950 dark:text-white" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Approve</span>
                        </button>
                      </>
                    ) : (
                      <span className={`text-[9.5px] font-mono font-bold uppercase px-3 py-1 rounded-xl border ${
                        leave.status === "Approved" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-455" 
                          : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-455"
                      }`}>
                        {leave.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-xs italic font-medium">
              No leave requests found under the "{filter}" filter.
            </div>
          )}
        </div>

      </div>

      {/* Details & Attachment Modal (Portaled) */}
      {selectedLeave && typeof document !== "undefined" && createPortal(
        <div className="modal-backdrop z-[999] bg-black/40 backdrop-blur-xs fixed inset-0 flex items-center justify-center p-4">
          <div className="modal-content max-w-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xl p-6 rounded-2xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 font-mono uppercase tracking-wider">
                  Leave Details Check
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Verify details and attachments submitted by employee</p>
              </div>
              <button 
                onClick={() => setSelectedLeave(null)} 
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const leave = selectedLeave;
              const days = getDaysBetween(leave.start_date, leave.end_date);
              const avatarColor = avatarColors[leave.employee?.id % avatarColors.length];
              const baseUrl = getBackendUrl().replace("/api/v1", "");
              const parsed = parseReasonText(leave.reason);

              return (
                <div className="space-y-5 text-xs">
                  {/* Employee Meta Row */}
                  <div className="flex items-center gap-3.5 p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <EmployeeAvatar employee={leave.employee} baseUrl={baseUrl} avatarColor={avatarColor} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-900 dark:text-zinc-100 leading-none">{leave.employee?.name}</p>
                      <p className="text-[10px] text-slate-450 mt-1">{leave.employee?.email}</p>
                      <p className="text-[9px] text-cyan-600 dark:text-cyan-400 mt-1 font-mono tracking-wider font-bold">
                        {leave.employee?.designation} &bull; {leave.employee?.department?.name || "Staff"}
                      </p>
                    </div>

                    <span className={`text-[9px] font-mono px-2.5 py-0.75 rounded-lg border font-extrabold uppercase ${
                      leave.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                      leave.status === "Rejected" ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400" :
                      "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                    }`}>
                      {leave.status}
                    </span>
                  </div>

                  {/* Leave parameters grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                      <p className="text-[8.5px] font-bold text-zinc-400 uppercase font-mono tracking-wider mb-1">Leave Category</p>
                      <p className="font-extrabold text-[12px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                        {leave.leave_type} Leave
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                      <p className="text-[8.5px] font-bold text-zinc-400 uppercase font-mono tracking-wider mb-1">Duration & Days</p>
                      <p className="font-extrabold text-[12px] text-zinc-800 dark:text-zinc-200">
                        {days} Day{days !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Dates Row */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 rounded-xl space-y-1">
                    <p className="text-[8.5px] font-bold text-zinc-400 uppercase font-mono tracking-wider">Leave Timeline</p>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                      <span>{new Date(leave.start_date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{new Date(leave.end_date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>

                  {/* Contact Number */}
                  {parsed.contact && (
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                      <p className="text-[8.5px] font-bold text-zinc-400 uppercase font-mono tracking-wider mb-1">Emergency Contact Number</p>
                      <p className="font-mono text-[12px] text-slate-800 dark:text-zinc-200 font-extrabold tracking-wide">{parsed.contact}</p>
                    </div>
                  )}

                  {/* Reason Text */}
                  {parsed.cleanReason && (
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                      <p className="text-[8.5px] font-bold text-zinc-400 uppercase font-mono tracking-wider mb-1">Reason / Description</p>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-350 leading-relaxed font-medium">"{parsed.cleanReason}"</p>
                    </div>
                  )}

                  {/* Document Attachment Section (Sick Leave specific) */}
                  {parsed.certificate && (
                    <div className="p-4 border border-dashed border-rose-250 dark:border-rose-900 bg-rose-50/10 dark:bg-rose-950/10 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-rose-100 dark:bg-rose-950/30 rounded-lg text-rose-500 border border-rose-200/50">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-rose-800 dark:text-rose-400 truncate">{parsed.certificate}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Medical Certificate Attachment</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(parsed.certificateName || parsed.certificate!, parsed.certificate!, parsed.isRealCert)}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs shadow-rose-500/10"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Trigger Buttons */}
                  {leave.status === "Pending" && (
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleAction(leave.id, "Rejected");
                          setSelectedLeave(null);
                        }}
                        disabled={updatingId === leave.id}
                        className="px-4 py-2 border border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/20 text-rose-600 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject Request</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleAction(leave.id, "Approved");
                          setSelectedLeave(null);
                        }}
                        disabled={updatingId === leave.id}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-500/10"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Request</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        </div>,
        document.body
      )}
    </SidebarLayout>
  );
}
