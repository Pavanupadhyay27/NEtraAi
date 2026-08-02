"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl, parseDateTime, getLocalDateString } from "@/app/utils/api";
import { 
  Plus, Search, Trash2, Camera, Upload, FileSpreadsheet,
  X, Users, CheckCircle2, XCircle, ChevronDown, UserCheck, ShieldAlert,
  Download, Mail, Phone, Calendar, Briefcase, Clock, TrendingUp, MapPin,
  Eye, EyeOff, Shield
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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
  const [showPassword, setShowPassword] = useState(false);
  const [allowWfh, setAllowWfh] = useState(false);
  const [wfhAddress, setWfhAddress] = useState("");
  const [wfhLat, setWfhLat] = useState<number | null>(null);
  const [wfhLng, setWfhLng] = useState<number | null>(null);
  const [wfhGeocoding, setWfhGeocoding] = useState(false);
  const [wfhLockType, setWfhLockType] = useState<"auto" | "address">("address");
  const [isManualCoords, setIsManualCoords] = useState(false);

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

  const approveMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "Active" })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Employee approved successfully!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to approve employee.")
  });

  const resetForm = () => {
    setEmpId(""); setName(""); setEmail(""); setPhone(""); setDesignation("");
    setJoiningDate(getLocalDateString()); setStatusVal("Active");
    setDeptId(""); setCreateUserLogin(false); setPassword("");
    setAllowWfh(false); setWfhAddress(""); setWfhLat(null); setWfhLng(null);
    setWfhLockType("address");
    setIsManualCoords(false);
    setPhoneError(null);
    setSubmissionError(null);
  };

  // Auto-detect WFH coordinates when typing address
  useEffect(() => {
    if (isManualCoords) return;
    if (!allowWfh || !wfhAddress || wfhAddress.trim().length < 5) {
      setWfhLat(null); setWfhLng(null);
      return;
    }
    
    const delay = setTimeout(async () => {
      setWfhGeocoding(true);
      try {
        const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/geocode?address=${encodeURIComponent(wfhAddress)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.lat !== null && data.lng !== null) {
            setWfhLat(data.lat);
            setWfhLng(data.lng);
          } else {
            setWfhLat(null); setWfhLng(null);
          }
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setWfhGeocoding(false);
      }
    }, 800);
    
    return () => clearTimeout(delay);
  }, [wfhAddress, allowWfh, isManualCoords]);

  // Reverse geocode when manual coordinates change
  useEffect(() => {
    if (!isManualCoords || wfhLat === null || wfhLng === null) return;
    if (wfhLat < -90 || wfhLat > 90 || wfhLng < -180 || wfhLng > 180) return;
    if (isNaN(wfhLat) || isNaN(wfhLng)) return;

    const delay = setTimeout(async () => {
      setWfhGeocoding(true);
      try {
        const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/reverse-geocode?lat=${wfhLat}&lng=${wfhLng}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.address) {
            setWfhAddress(data.address);
          }
        }
      } catch (err) {
        console.error("Reverse geocoding manual input failed:", err);
      } finally {
        setWfhGeocoding(false);
      }
    }, 1200);

    return () => clearTimeout(delay);
  }, [wfhLat, wfhLng, isManualCoords]);

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

  const handleAvatarUpload = async (empId: number, file: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      await fetchApi(`/employees/${empId}/avatar`, { 
        method: "POST", 
        body: formData 
      });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Profile photo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    }
  };

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
      allow_wfh: allowWfh,
      wfh_address: allowWfh ? wfhAddress : null,
      wfh_lat: allowWfh ? wfhLat : null,
      wfh_lng: allowWfh ? wfhLng : null
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
            {employees?.some((emp: any) => selectedIds.includes(emp.id) && emp.status === "Pending Approval") && (
              <button
                onClick={async () => {
                  const pendingSelected = employees.filter((emp: any) => selectedIds.includes(emp.id) && emp.status === "Pending Approval");
                  for (const emp of pendingSelected) {
                    await approveMutation.mutateAsync(emp.id);
                  }
                  setSelectedIds([]);
                  toast.success(`Approved ${pendingSelected.length} employee accounts.`);
                }}
                disabled={approveMutation.isPending}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white border-transparent text-[12px] h-9.5 px-4 flex items-center gap-2 rounded-xl cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Approve Selected ({employees.filter((emp: any) => selectedIds.includes(emp.id) && emp.status === "Pending Approval").length})
              </button>
            )}
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
              <option value="Pending Approval">Pending Approval</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Table List Card */}
        <div className="tech-card-3d-minimal bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <p className="text-[11px] text-slate-500 font-mono">
              {loadingEmployees ? "Fetching..." : `${employees?.length || 0} registered personnel`}
            </p>
          </div>
          
          <div className="overflow-x-auto min-h-[350px]">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="py-3.5 px-4 w-[40px] text-center">
                    <input
                      type="checkbox"
                      checked={employees?.length > 0 && selectedIds.length === employees.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(employees.map((emp: any) => emp.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
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
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-4.5 px-5">
                          <div className="skeleton h-4 w-28" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : employees?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
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
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, emp.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== emp.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                        </td>
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
                          {emp.status === "Pending Approval" ? (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-500 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending Approval
                            </span>
                          ) : (
                            <span className={`badge ${emp.status === "Active" ? "badge-emerald" : "badge-slate"} flex items-center gap-1 w-fit`}>
                              {emp.status === "Active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {emp.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            {emp.status === "Pending Approval" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveMutation.mutate(emp.id);
                                }}
                                disabled={approveMutation.isPending}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold text-emerald-500 bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/15 hover:border-emerald-500/25 transition-all cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5 animate-pulse" />
                                Approve Account
                              </button>
                            ) : emp.images && emp.images.length > 0 ? (
                              <Link
                                href={`/enroll/${emp.id}`}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold text-emerald-500 bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/15 hover:border-emerald-500/25 transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Update Face ID
                              </Link>
                            ) : (
                              <Link
                                href={`/enroll/${emp.id}`}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold text-blue-400 bg-blue-500/8 hover:bg-blue-500/15 border border-blue-500/15 hover:border-blue-500/25 transition-all"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                Enroll
                              </Link>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const el = document.getElementById(`avatar-upload-${emp.id}`);
                                if (el) el.click();
                              }}
                              className="p-2 rounded-xl text-slate-600 hover:text-blue-400 hover:bg-blue-500/8 border border-transparent hover:border-blue-500/15 transition-all cursor-pointer"
                              title="Upload Avatar Manually"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                            <input 
                              type="file" 
                              id={`avatar-upload-${emp.id}`}
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAvatarUpload(emp.id, file);
                              }}
                            />
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
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        placeholder="Minimum 8 characters" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        className={`${inputCls} pr-10`} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </InputField>
                )}
              </div>

              {/* Attendance Location Policy */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Attendance & Location Policy
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    !allowWfh 
                      ? "bg-zinc-900/5 dark:bg-zinc-100/5 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" 
                      : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-450 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  }`}>
                    <div className="flex flex-col text-left">
                      <span className="text-[11.5px] font-bold">Office Bound</span>
                      <span className="text-[9.5px] opacity-75 mt-0.5">Strict Office Geofence</span>
                    </div>
                    <input 
                      type="radio" 
                      name="wfh_policy" 
                      checked={!allowWfh} 
                      onChange={() => { setAllowWfh(false); setWfhAddress(""); setWfhLat(null); setWfhLng(null); }}
                      className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-zinc-300 dark:border-zinc-700 bg-transparent cursor-pointer"
                    />
                  </label>

                  <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    allowWfh 
                      ? "bg-zinc-900/5 dark:bg-zinc-100/5 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" 
                      : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-450 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  }`}>
                    <div className="flex flex-col text-left">
                      <span className="text-[11.5px] font-bold">WFH / Remote</span>
                      <span className="text-[9.5px] opacity-75 mt-0.5">Bypasses Office Boundary</span>
                    </div>
                    <input 
                      type="radio" 
                      name="wfh_policy" 
                      checked={allowWfh} 
                      onChange={() => setAllowWfh(true)}
                      className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-zinc-300 dark:border-zinc-700 bg-transparent cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* WFH Options Dropdown & Textbox */}
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  allowWfh ? "max-h-[350px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
                }`}
              >
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      WFH GPS Verification Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => setWfhLockType("address")}
                        className={`py-2 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                          wfhLockType === "address"
                            ? "bg-white dark:bg-zinc-800 text-zinc-955 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-805 dark:hover:text-zinc-200"
                        }`}
                      >
                        Pre-Registered Address
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWfhLockType("auto");
                          setWfhAddress("");
                          setWfhLat(null);
                          setWfhLng(null);
                        }}
                        className={`py-2 px-2.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                          wfhLockType === "auto"
                            ? "bg-white dark:bg-zinc-800 text-zinc-955 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-805 dark:hover:text-zinc-200"
                        }`}
                      >
                        Auto-Lock on First Scan
                      </button>
                    </div>
                  </div>

                  {wfhLockType === "address" && (
                    <div className="space-y-4 animate-fadeInUp">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          Home Address (For WFH GPS Lock) *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.geolocation) {
                              setWfhGeocoding(true);
                              navigator.geolocation.getCurrentPosition(
                                async (position) => {
                                  const { latitude, longitude } = position.coords;
                                  setWfhLat(latitude);
                                  setWfhLng(longitude);
                                  try {
                                    const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/reverse-geocode?lat=${latitude}&lng=${longitude}`;
                                    const res = await fetch(url);
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.address) {
                                        setWfhAddress(data.address);
                                      }
                                    }
                                  } catch (err) {
                                    console.error("Reverse geocoding failed:", err);
                                  } finally {
                                    setWfhGeocoding(false);
                                  }
                                },
                                (err) => {
                                  setWfhGeocoding(false);
                                  toast.error("Geolocation denied or unavailable. Please enter coordinates manually.");
                                }
                              );
                            } else {
                              toast.error("Geolocation is not supported by your browser.");
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-cyan-600 hover:text-cyan-500 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Auto-Detect GPS
                        </button>
                      </div>

                      <textarea 
                        required={allowWfh && wfhLockType === "address"}
                        rows={2}
                        placeholder="e.g., 123 Main St, Springfield. Be specific for accurate GPS geocoding." 
                        value={wfhAddress}
                        onChange={(e) => setWfhAddress(e.target.value)} 
                        className="input-field text-[12.5px] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:border-slate-800 dark:focus:border-zinc-500 text-slate-900 dark:text-white rounded-xl transition-all w-full h-auto py-2.5 px-3.5 resize-none placeholder-zinc-400 dark:placeholder-zinc-650 shadow-inner" 
                      />

                      {/* Manual coordinate overrides */}
                      <label className="flex items-center gap-2 text-[10.5px] font-semibold text-zinc-650 dark:text-zinc-400 cursor-pointer select-none hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors border-t border-zinc-200/50 dark:border-zinc-800/60 pt-3">
                        <input
                          type="checkbox"
                          checked={isManualCoords}
                          onChange={(e) => {
                            const nextState = e.target.checked;
                            setIsManualCoords(nextState);
                            if (!nextState) {
                              setWfhLat(null);
                              setWfhLng(null);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-cyan-600 focus:ring-cyan-500 bg-transparent cursor-pointer"
                        />
                        <span>Set coordinates manually (GPS override)</span>
                      </label>

                      {isManualCoords ? (
                        <div className="grid grid-cols-2 gap-3.5 animate-fadeInUp">
                          <InputField label="Custom Latitude" required>
                            <input 
                              type="number" 
                              step="any" 
                              required 
                              placeholder="e.g. 28.6139" 
                              value={wfhLat !== null ? wfhLat : ""} 
                              onChange={(e) => setWfhLat(e.target.value ? parseFloat(e.target.value) : null)}
                              className="input-field text-[12.5px] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:border-slate-800 dark:focus:border-zinc-500 text-slate-900 dark:text-white rounded-xl transition-all w-full h-9.5 px-3.5"
                            />
                          </InputField>
                          <InputField label="Custom Longitude" required>
                            <input 
                              type="number" 
                              step="any" 
                              required 
                              placeholder="e.g. 77.2090" 
                              value={wfhLng !== null ? wfhLng : ""} 
                              onChange={(e) => setWfhLng(e.target.value ? parseFloat(e.target.value) : null)}
                              className="input-field text-[12.5px] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:border-slate-800 dark:focus:border-zinc-500 text-slate-900 dark:text-white rounded-xl transition-all w-full h-9.5 px-3.5"
                            />
                          </InputField>
                        </div>
                      ) : (
                        <div className="text-[10.5px] flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
                           {wfhGeocoding ? (
                             <span className="text-cyan-500 animate-pulse font-medium">Resolving geocode coordinates...</span>
                           ) : wfhLat && wfhLng ? (
                             <span className="text-emerald-500 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                               <MapPin className="w-3.5 h-3.5 animate-bounce" />
                               GPS Locked: {wfhLat.toFixed(6)}, {wfhLng.toFixed(6)}
                             </span>
                           ) : (
                             <span className="text-slate-450 dark:text-zinc-500 font-medium">Enter full address or auto-detect to lock GPS</span>
                           )}
                        </div>
                      )}
                    </div>
                  )}

                  {wfhLockType === "auto" && (
                    <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10 text-[11px] text-cyan-600 dark:text-cyan-400 animate-fadeInUp flex items-start gap-2.5 leading-relaxed">
                      <Shield className="w-4 h-4 shrink-0 mt-0.5 text-cyan-500" />
                      <span>
                        <strong>Auto-Lock Active:</strong> The system will automatically capture and register the employee's exact GPS coordinates upon their first punch-in. All subsequent punches will be locked to a 500-meter radius around that location.
                      </span>
                    </div>
                  )}
                </div>
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
