"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getLocalDateString } from "@/app/utils/api";
import { 
  FileText, Calendar, Download, Loader2, CheckCircle2, 
  FileSpreadsheet, FileDown, CalendarDays, User, Layers, ChevronDown, Check
} from "lucide-react";

const REPORT_TYPES = [
  { value: "daily",    label: "Daily Punch Summary",    desc: "Per-day punch logs for all staff", icon: FileText },
  { value: "weekly",   label: "Weekly Timesheets",      desc: "Weekly hours and punch history", icon: Calendar },
  { value: "monthly",  label: "Monthly Salary Ledger",  desc: "Monthly attendance & late statistics", icon: CalendarDays },
  { value: "employee", label: "Staff Profile Report",   desc: "Detailed record for a specific employee", icon: User },
];

const FORMATS = [
  { value: "xlsx", label: "Excel Sheet",  desc: ".xlsx Workbook" },
  { value: "pdf",  label: "PDF Report",   desc: ".pdf Format" },
  { value: "csv",  label: "CSV Flatfile", desc: ".csv Flat data" },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("daily");
  const [format, setFormat] = useState("xlsx");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return getLocalDateString(d);
  });
  const [endDate, setEndDate] = useState(() => getLocalDateString());
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => fetchApi("/departments/") });
  const { data: employees } = useQuery({ queryKey: ["employees-list"], queryFn: () => fetchApi("/employees/") });

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true); setSuccess(false);
    try {
      const params = [`report_type=${reportType}`, `format=${format}`, `start_date=${startDate}`, `end_date=${endDate}`];
      if (employeeId) params.push(`employee_id=${employeeId}`);
      if (departmentId) params.push(`department_id=${departmentId}`);
      const blob: Blob = await fetchApi(`/reports/export?${params.join("&")}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `netraid_${reportType}_${startDate}_${endDate}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to generate report.");
    } finally {
      setExporting(false);
    }
  };

  const inputCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all w-full";
  const selectCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all appearance-none cursor-pointer w-full pr-8";

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl page-enter">
        {/* Header */}
        <div className="pb-5 border-b border-white/5">
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Reports & Export</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Compile and generate compliance-ready corporate records in PDF, Excel, or CSV format.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-2 glass-card rounded-2xl border border-white/6 p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 bg-white/[0.005]">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                <FileDown className="w-4 h-4 text-zinc-700" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Export Parameters</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">Specify report criteria and format</p>
              </div>
            </div>

            <form onSubmit={handleExport} className="space-y-6">
              {/* Report Type */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Report Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REPORT_TYPES.map(rt => {
                    const Icon = rt.icon;
                    const isActive = reportType === rt.value;
                    return (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => setReportType(rt.value)}
                        className={`text-left p-3.5 rounded-xl border flex gap-3 transition-all cursor-pointer ${
                          isActive
                            ? "bg-zinc-50 border-zinc-300 text-zinc-950 shadow-sm"
                            : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                          isActive ? "bg-zinc-900 border-zinc-900 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-400"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold leading-tight">{rt.label}</p>
                          <p className="text-[9.5px] mt-1 opacity-70 leading-normal">{rt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Output Format
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {FORMATS.map(f => {
                    const isActive = format === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFormat(f.value)}
                        className={`text-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                            : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                        }`}
                      >
                        <p className="text-[12.5px] font-bold uppercase tracking-wider">{f.label}</p>
                        <p className="text-[9.5px] opacity-60 mt-1">{f.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className={`${inputCls} !pl-10 h-10`} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className={`${inputCls} !pl-10 h-10`} />
                  </div>
                </div>
              </div>

              {/* Optional filters */}
              <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-white/5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Department <span className="opacity-50 normal-case">(optional)</span>
                  </label>
                  <div className="relative">
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={`${selectCls} h-10`}>
                      <option value="">All Departments</option>
                      {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Staff Member <span className="opacity-50 normal-case">(optional)</span>
                  </label>
                  <div className="relative">
                    <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${selectCls} h-10`}>
                      <option value="">All Employees</option>
                      {employees?.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={exporting}
                className="btn-primary w-full h-11 flex items-center justify-center gap-2.5 text-[13px] rounded-xl cursor-pointer shadow-sm"
              >
                {exporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating Export File...</span></>
                ) : (
                  <><Download className="w-4 h-4" /><span>Compile & Download Report</span></>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4 md:col-span-1">
            <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4.5 bg-white/[0.005]">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-zinc-700" />
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Audit Protocols</h3>
              </div>
              <div className="space-y-3.5 text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                {[
                  "Reports compile directly from the master SQL presence ledgers.",
                  "Cosine similarity confidence scores are detailed for raw logs.",
                  "Grace periods and overtime values recalculate dynamically.",
                  "Failed anti-spoof events are highlighted in transaction files.",
                ].map((note, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {success && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-250 text-emerald-800 animate-fadeInUp">
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider">Report Generated</p>
                  <p className="text-[11px] text-emerald-950 mt-1 leading-relaxed">
                    The requested file was generated and saved to your device. Check your downloads directory.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
