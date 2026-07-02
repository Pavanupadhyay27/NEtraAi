"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl, parseDateTime, getLocalDateString } from "@/app/utils/api";
import { 
  Plus, Search, Trash2, Camera, Upload, FileSpreadsheet,
  X, Users, CheckCircle2, XCircle, ChevronDown, UserCheck, ShieldAlert,
  Download, Mail, Phone, Calendar, Briefcase, Clock, TrendingUp
} from "lucide-react";
import { useToast } from "@/app/utils/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Avatar gradient styles
const avatarColors = [
  "from-blue-50 to-indigo-150 text-blue-600 border-blue-200",
  "from-emerald-50 to-teal-150 text-emerald-600 border-emerald-200",
  "from-rose-50 to-orange-150 text-rose-600 border-rose-200",
  "from-purple-50 to-pink-150 text-purple-600 border-purple-200",
  "from-cyan-50 to-blue-150 text-cyan-600 border-cyan-200",
];

function EmployeeAvatar({ emp, className, size = "md" }: { emp: any; className?: string; size?: "sm" | "md" | "lg" }) {
  const [error, setError] = useState(false);
  const avatarColor = avatarColors[emp.id % avatarColors.length];
  const hasFrontImage = emp.images?.some((img: any) => img.pose_type.toLowerCase() === "front");
  
  const sizeClasses = {
    sm: "w-8 h-8 text-[10.5px] rounded-lg shrink-0",
    md: "w-10 h-10 text-xs rounded-xl shrink-0",
    lg: "w-14 h-14 text-lg rounded-2xl shrink-0",
  };
  const sc = sizeClasses[size];

  if (hasFrontImage && !error) {
    const baseUrl = getBackendUrl().replace("/api/v1", "");
    return (
      <img
        src={`${baseUrl}/uploads/${emp.employee_id}/front.jpg`}
        alt={emp.name}
        className={`${sc} object-cover border border-zinc-200 shadow-sm ${className || ""}`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${sc} bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 border font-bold shadow-sm ${className || ""}`}>
      {emp.name.charAt(0).toUpperCase()}
    </div>
  );
}

function InputField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label} {required && <span className="text-blue-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");

  const [empId, setEmpId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [designation, setDesignation] = useState("");
  const [joiningDate, setJoiningDate] = useState(getLocalDateString());
  const [statusVal, setStatusVal] = useState("Active");
  const [deptId, setDeptId] = useState("");
  const [createUserLogin, setCreateUserLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [allowWfh, setAllowWfh] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchApi("/departments/")
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", search, deptFilter, statusFilter],
    queryFn: () => {
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (deptFilter) params.push(`department_id=${deptFilter}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      return fetchApi(`/employees/${qs}`);
    }
  });


  const createMutation = useMutation({
    mutationFn: (payload: any) => fetchApi("/employees/", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (err: any) => {
      setSubmissionError(err.message || "Failed to create employee.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Employee record deleted successfully.");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete employee.")
  });

  const resetForm = () => {
    setEmpId(""); setName(""); setEmail(""); setPhone(""); setDesignation("");
    setJoiningDate(getLocalDateString()); setStatusVal("Active");
    setDeptId(""); setCreateUserLogin(false); setPassword("");
    setAllowWfh(false);
    setPhoneError(null);
    setSubmissionError(null);
  };

  // Live duplicate checking against loaded employees
  const getDuplicateWarning = () => {
    if (!employees) return null;
    
    if (empId.trim()) {
      const match = employees.find((e: any) => e.employee_id.toLowerCase() === empId.trim().toLowerCase());
      if (match) return `Employee ID "${empId}" is already assigned to ${match.name}.`;
    }
    
    if (name.trim()) {
      const match = employees.find((e: any) => e.name.toLowerCase() === name.trim().toLowerCase());
      if (match) return `An employee named "${name}" is already registered.`;
    }
    
    if (phone.trim()) {
      const cleanedInput = phone.replace(/[\s\-()]/g, "");
      if (cleanedInput) {
        const match = employees.find((e: any) => {
          if (!e.phone) return false;
          const cleanedExisting = e.phone.replace(/[\s\-()]/g, "");
          return cleanedExisting === cleanedInput;
        });
        if (match) return `Phone number is already registered to ${match.name}.`;
      }
    }
    
    return null;
  };

  const duplicateWarning = getDuplicateWarning();

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone) {
      const cleaned = phone.replace(/[\s\-()]/g, "");
      if (!/^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned)) {
        setPhoneError("Invalid Indian mobile number. Must be a 10-digit number starting with 6-9, optionally prefixed with +91, 91, or 0.");
        return;
      }
    }
    setPhoneError(null);

    const payload: any = {
      employee_id: empId, name, email, phone: phone || null,
      designation: designation || null, joining_date: joiningDate,
      status: statusVal, department_id: deptId ? parseInt(deptId) : null,
      create_user_login: createUserLogin,
      allow_wfh: allowWfh
    };
    if (createUserLogin) payload.password = password;
    createMutation.mutate(payload);
  };

  const handleDelete = (id: number, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  };

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setSubmitting(true); setImportMessage(null); setImportErrors([]);
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const res = await fetchApi("/employees/import-csv", { method: "POST", body: formData });
      setImportMessage(res.message);
      if (res.errors?.length > 0) setImportErrors(res.errors);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      setImportMessage(err.message || "Import failed.");
    } finally {
      setSubmitting(false);
    }
  };


  const inputCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all w-full";
  const selectCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all appearance-none cursor-pointer w-full pr-8";



  return (
    <>
      <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/5">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Staff Management</h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowImportDialog(true)}
              className="btn-ghost text-[12px] h-9.5 px-4 flex items-center gap-2 rounded-xl cursor-pointer hover:bg-white/[0.04]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAddDialog(true)}
              className="btn-primary text-[12px] h-9.5 px-4 flex items-center gap-2 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4.5 rounded-2xl bg-white/[0.015] border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          <div className="relative col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${selectCls} h-10`}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Table List Card */}
        <div className="glass-card rounded-2xl border border-white/6 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 bg-white/[0.005] flex items-center justify-between">
            <p className="text-[11px] text-slate-500 font-mono">
              {loadingEmployees ? "Fetching..." : `${employees?.length || 0} registered personnel`}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left py-3.5 px-5">Employee Info</th>
                  <th className="text-left py-3.5 px-5">Department</th>
                  <th className="text-left py-3.5 px-5">Designation</th>
                  <th className="text-left py-3.5 px-5">Status</th>
                  <th className="text-center py-3.5 px-5 w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingEmployees ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-4.5 px-5">
                          <div className="skeleton h-4 w-28" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : employees?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center">
                          <Users className="w-5 h-5 text-slate-600" />
                        </div>
                        <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider">No Records Found</p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">Modify your filters or click 'Add Employee' to register new personnel.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees?.map((emp: any) => {
                    const avatarColor = avatarColors[emp.id % avatarColors.length];
                    return (
                      <tr key={emp.id} className="group/row cursor-pointer hover:bg-white/[0.015]" onClick={() => router.push(`/employees/${emp.id}`)}>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar emp={emp} size="md" />
                            <div>
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{emp.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{emp.employee_id} · {emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-[12.5px] text-[var(--text-secondary)]">
                          {emp.department?.name || (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-[12.5px] text-[var(--text-secondary)]">
                          {emp.designation || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`badge ${emp.status === "Active" ? "badge-emerald" : "badge-slate"} flex items-center gap-1 w-fit`}>
                            {emp.status === "Active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/enroll/${emp.id}`}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold text-blue-400 bg-blue-500/8 hover:bg-blue-500/15 border border-blue-500/15 hover:border-blue-500/25 transition-all"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              Enroll
                            </Link>
                            <button
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="p-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/8 border border-transparent hover:border-rose-500/15 transition-all cursor-pointer"
                              title="Delete employee profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Add Employee Modal ─── */}
      {showAddDialog && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Register Employee</h3>
              </div>
              <button 
                onClick={() => { setShowAddDialog(false); resetForm(); }} 
                className="p-2 rounded-xl hover:bg-white/6 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {duplicateWarning && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs animate-fadeInUp">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="flex-1 space-y-1">
                    <p className="font-bold uppercase tracking-wider text-[9px] font-mono leading-none">Duplicate Detected</p>
                    <p className="leading-relaxed font-medium mt-1">{duplicateWarning}</p>
                  </div>
                </div>
              )}

              {submissionError && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs animate-fadeInUp">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <div className="flex-1 space-y-1">
                    <p className="font-bold uppercase tracking-wider text-[9px] font-mono leading-none">Registration Failed</p>
                    <p className="leading-relaxed font-medium mt-1">{submissionError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <InputField label="Employee ID" required>
                  <input type="text" required placeholder="EMP001" value={empId}
                    onChange={(e) => setEmpId(e.target.value)} className={inputCls} />
                </InputField>
                <InputField label="Full Name" required>
                  <input type="text" required placeholder="John Smith" value={name}
                    onChange={(e) => setName(e.target.value)} className={inputCls} />
                </InputField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <InputField label="Email" required>
                  <input type="email" required placeholder="john@company.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </InputField>
                <InputField label="Phone Number">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="+91 98765 43210" 
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneError) setPhoneError(null);
                      }} 
                      className={`${inputCls} ${phoneError ? "border-rose-500 focus:border-rose-500" : ""}`} 
                    />
                    {phoneError && (
                      <p className="text-[10px] text-rose-500 mt-1 font-medium leading-tight">{phoneError}</p>
                    )}
                  </div>
                </InputField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <InputField label="Department">
                  <div className="relative">
                    <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={selectCls}>
                      <option value="">Select Department</option>
                      {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </InputField>
                <InputField label="Designation">
                  <input type="text" placeholder="Software Engineer" value={designation}
                    onChange={(e) => setDesignation(e.target.value)} className={inputCls} />
                </InputField>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <InputField label="Joining Date">
                  <input type="date" value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)} className={inputCls} />
                </InputField>
                <InputField label="Status">
                  <div className="relative">
                    <select value={statusVal} onChange={(e) => setStatusVal(e.target.value)} className={selectCls}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </InputField>
              </div>

              {/* Login credentials */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={createUserLogin}
                    onChange={() => setCreateUserLogin(!createUserLogin)}
                    className="w-4 h-4 rounded border-white/10 text-blue-500 bg-[#060a12] focus:ring-blue-500/50 cursor-pointer"
                  />
                  <span className="text-[12px] font-semibold text-slate-700 select-none">Create Admin Dashboard Login</span>
                </label>
                {createUserLogin && (
                  <InputField label="Initial Password" required>
                    <input type="password" required placeholder="Minimum 8 characters" value={password}
                      onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                  </InputField>
                )}
              </div>

              {/* WFH Permission Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-[12.5px] font-bold text-slate-800">Work From Home (WFH) Allowed</p>
                  <p className="text-[10px] text-slate-450 mt-0.5">Bypasses geofenced location checks for this employee</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowWfh(!allowWfh)}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    allowWfh ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      allowWfh ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => { setShowAddDialog(false); resetForm(); }} 
                  className="btn-ghost h-9.5 px-4 text-[12px] rounded-xl cursor-pointer hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || !!duplicateWarning} 
                  className="btn-primary h-9.5 px-5 text-[12px] flex items-center gap-2 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /><span>Save Record</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Import CSV Modal ─── */}
      {showImportDialog && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Bulk Import via CSV</h3>
              </div>
              <button 
                onClick={() => { setShowImportDialog(false); setSelectedFile(null); setImportMessage(null); setImportErrors([]); }}
                className="p-2 rounded-xl hover:bg-white/6 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <label className="block">
                <div className={`relative border border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${selectedFile ? "border-blue-500/40 bg-blue-500/5" : "border-white/10 hover:border-white/20 bg-white/[0.015]"}`}>
                  <input type="file" accept=".csv" required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Upload className={`w-8 h-8 mx-auto mb-3.5 ${selectedFile ? "text-blue-400" : "text-slate-500"}`} />
                  <p className="text-[12.5px] font-semibold text-slate-700">
                    {selectedFile ? selectedFile.name : "Select CSV Flatfile"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Click or drag & drop CSV file"}
                  </p>
                </div>
              </label>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Required Headers</p>
                <code className="text-[10px] text-slate-700 font-mono leading-relaxed block break-all bg-slate-50 p-2 rounded-lg border border-slate-200">
                  employee_id, name, email, phone, designation, joining_date, department_code
                </code>
              </div>

              {importMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 text-blue-400 text-[11.5px] animate-fadeInUp">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{importMessage}</span>
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/8 border border-rose-500/20 text-rose-400 text-[10px] max-h-32 overflow-y-auto space-y-1 font-mono">
                  <p className="font-semibold uppercase tracking-wider mb-1">Import Exceptions:</p>
                  {importErrors.map((err, i) => <p key={i} className="opacity-85">{err}</p>)}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => { setShowImportDialog(false); setSelectedFile(null); setImportMessage(null); setImportErrors([]); }}
                  className="btn-ghost h-9.5 px-4 text-[12px] rounded-xl cursor-pointer hover:bg-white/[0.04]"
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  disabled={submitting || !selectedFile}
                  className="btn-primary h-9.5 px-5 text-[12px] flex items-center gap-2 rounded-xl cursor-pointer"
                >
                  {submitting ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Uploading...</span></>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" /><span>Process Import</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SidebarLayout>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="modal-backdrop z-50">
          <div className="modal-content max-w-sm border border-red-500/10 shadow-[0_12px_40px_rgba(239,68,68,0.12)]">
            <div className="flex flex-col items-center text-center p-2 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center text-rose-500 shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Are you absolutely sure you want to delete <span className="font-semibold text-[var(--text-primary)]">{deleteConfirmName}</span>?
                </p>
                <p className="text-[10.5px] text-rose-500 font-medium bg-rose-500/5 border border-rose-500/10 rounded-xl p-2.5 mt-3 leading-normal">
                  Warning: All facial biometric profile records and logs will be permanently deleted. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2.5 w-full pt-2 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => { setDeleteConfirmId(null); setDeleteConfirmName(""); }} 
                  className="flex-1 btn-ghost h-9.5 text-[12px] rounded-xl cursor-pointer hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-[12px] rounded-xl cursor-pointer h-9.5 flex items-center justify-center gap-2 shadow-md shadow-rose-950/20 border border-rose-500/20"
                >
                  {deleteMutation.isPending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Delete Record"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
