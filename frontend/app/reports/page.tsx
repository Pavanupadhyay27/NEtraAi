"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getLocalDateString } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  FileText, Calendar, Download, Loader2, CheckCircle2, 
  FileSpreadsheet, FileDown, CalendarDays, User, Layers, ChevronDown
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

const COLUMNS_LIST = [
  "Date", "Employee ID", "Name", "Department", 
  "Check In", "Check Out", "Hours Worked", "Overtime", "Status"
];

export default function ReportsPage() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState("daily");
  const [format, setFormat] = useState("xlsx");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return getLocalDateString(d);
  });
  const [endDate, setEndDate] = useState(() => getLocalDateString());
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  
  // Custom Query Builder states
  const [selectedColumns, setSelectedColumns] = useState<string[]>(COLUMNS_LIST);
  const [minHours, setMinHours] = useState<string>("");
  const [maxHours, setMaxHours] = useState<string>("");
  
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Core list queries
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => fetchApi("/departments/") });
  const { data: employees } = useQuery({ queryKey: ["employees-list"], queryFn: () => fetchApi("/employees/") });

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true); setSuccess(false);
    try {
      const params = [
        `report_type=${reportType}`,
        `format=${format}`,
        `start_date=${startDate}`,
        `end_date=${endDate}`,
        `columns=${selectedColumns.join(",")}`
      ];
      if (employeeId) params.push(`employee_id=${employeeId}`);
      if (departmentId) params.push(`department_id=${departmentId}`);
      if (minHours) params.push(`min_hours=${minHours}`);
      if (maxHours) params.push(`max_hours=${maxHours}`);

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
      toast.error(err.message || "Failed to generate report.");
    } finally {
      setExporting(false);
    }
  };

  const inputCls = "input-field h-9.5 text-[12.5px] bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 text-zinc-900 dark:text-zinc-100 rounded-xl transition-all w-full focus:ring-2 focus:ring-cyan-500/10";
  const selectCls = "input-field h-9.5 text-[12.5px] bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 text-zinc-900 dark:text-zinc-100 rounded-xl transition-all appearance-none cursor-pointer w-full pr-8 focus:ring-2 focus:ring-cyan-500/10";

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl page-enter text-slate-850 dark:text-zinc-100">
        {/* Header */}
        <div className="pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Reports & Export</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-2 tech-card-3d-minimal bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-500">
                <FileDown className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Export Parameters</h2>
              </div>
            </div>

            <form onSubmit={handleExport} className="space-y-6">
              {/* Report Type */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                  Report Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-50 dark:bg-zinc-950/90 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
                  {REPORT_TYPES.map(rt => {
                    const Icon = rt.icon;
                    const isActive = reportType === rt.value;
                    return (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => setReportType(rt.value)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-white dark:bg-zinc-800 text-zinc-955 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-855 dark:hover:text-zinc-200"
                        }`}
                        title={rt.desc}
                      >
                        <Icon className="w-3.5 h-3.5 text-cyan-500" />
                        <span>{rt.label.replace(" Summary", "").replace(" Report", "").replace(" Ledger", "").replace("sheets", "s")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-455 dark:text-zinc-500 uppercase tracking-wider">
                  Output Format
                </label>
                <div className="grid grid-cols-3 gap-2 bg-zinc-50 dark:bg-zinc-955 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
                  {FORMATS.map(f => {
                    const isActive = format === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFormat(f.value)}
                        className={`flex flex-col items-center justify-center py-2 px-2 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-white dark:bg-zinc-800 text-zinc-955 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-855 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span className="uppercase tracking-wider">{f.label.split(" ")[0]}</span>
                        <span className="text-[8.5px] text-zinc-400 dark:text-zinc-500 font-normal">{f.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-550 pointer-events-none" />
                    <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className={`${inputCls} !pl-9 h-9.5`} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-550 pointer-events-none" />
                    <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className={`${inputCls} !pl-9 h-9.5`} />
                  </div>
                </div>
              </div>

              {/* Optional filters */}
              <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                    Department <span className="opacity-50 normal-case">(optional)</span>
                  </label>
                  <div className="relative">
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={`${selectCls} h-9.5`}>
                      <option value="">All Departments</option>
                      {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-550 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                    Staff Member <span className="opacity-50 normal-case">(optional)</span>
                  </label>
                  <div className="relative">
                    <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${selectCls} h-9.5`}>
                      <option value="">All Employees</option>
                      {employees?.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-550 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Collapsible Advanced Query Builder Panel */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between py-2 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955/20 hover:bg-zinc-50 dark:hover:bg-zinc-950/40 transition-colors text-[11px] font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Advanced Custom Query Builder</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
                </button>

                {showAdvanced && (
                  <div className="space-y-4 p-4.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-950/20 animate-fadeInUp">
                    {/* Column checkboxes */}
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                        Include Columns
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {COLUMNS_LIST.map((col) => {
                          const isChecked = selectedColumns.includes(col);
                          return (
                            <label
                              key={col}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/40 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    if (selectedColumns.length > 1) {
                                      setSelectedColumns(selectedColumns.filter(c => c !== col));
                                    } else {
                                      toast.error("Please select at least one column");
                                    }
                                  } else {
                                    setSelectedColumns([...selectedColumns, col]);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-cyan-600 focus:ring-cyan-500 bg-transparent cursor-pointer"
                              />
                              <span className="truncate">{col}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Working hours limits */}
                    <div className="grid grid-cols-2 gap-3.5 pt-2">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                          Min Hours Worked <span className="opacity-60 normal-case">(optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          placeholder="E.g. 4.0"
                          value={minHours}
                          onChange={(e) => setMinHours(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">
                          Max Hours Worked <span className="opacity-60 normal-case">(optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          placeholder="E.g. 9.5"
                          value={maxHours}
                          onChange={(e) => setMaxHours(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={exporting}
                className="w-full h-11 btn-skeuomorphic-white text-xs rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-sm !text-zinc-950 dark:!text-zinc-950"
              >
                {exporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin !text-zinc-950" /><span className="!text-zinc-950 font-bold">Generating Export File...</span></>
                ) : (
                  <><Download className="w-4 h-4 !text-zinc-950" /><span className="!text-zinc-950 font-bold">Compile & Download Report</span></>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4 md:col-span-1">
            <div className="tech-card-3d-minimal bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl p-5 space-y-4.5">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-cyan-500" />
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Audit Protocols</h3>
              </div>
              <div className="space-y-3.5 text-[11.5px] text-zinc-505 dark:text-zinc-400 leading-relaxed">
                {[
                  "Reports compile directly from the master SQL presence ledgers.",
                  "Custom column filtering dynamically adjusts Excel/PDF tables.",
                  "Grace periods and overtime values recalculate dynamically.",
                  "Failed anti-spoof events are highlighted in transaction files.",
                ].map((note, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 mt-1.5 shrink-0 animate-pulse" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {success && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 animate-fadeInUp">
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider">Report Generated</p>
                  <p className="text-[11px] text-emerald-950 dark:text-emerald-400 mt-1 leading-relaxed">
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
