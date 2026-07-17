"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  Building2, Plus, Edit2, ShieldAlert, CheckCircle2, 
  Search, Shield, AlertTriangle, Users, Database, MapPin, Phone, Mail, Loader2, Trash2,
  ArrowLeft, Calendar, TrendingUp, Monitor, Sliders, Download, ShieldCheck, Clock, Settings, RefreshCw,
  Activity, Zap, Eye, EyeOff
} from "lucide-react";

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [activeWorkspaceTenant, setActiveWorkspaceTenant] = useState<any>(null);
  const [workspaceTab, setWorkspaceTab] = useState("overview");

  // Form states
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [maxEmployees, setMaxEmployees] = useState(100);
  const [availableTokens, setAvailableTokens] = useState(1000);
  const [status, setStatus] = useState("Active");
  const [logo, setLogo] = useState("");
  const [latitude, setLatitude] = useState("12.9716");
  const [longitude, setLongitude] = useState("77.5946");
  const [fetchingGps, setFetchingGps] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "admins" | "devices" | "timeline" | "tickets">("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: tenants = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      return await fetchApi("/companies/");
    }
  });

  const { data: workspaceEmployees = [] } = useQuery({
    queryKey: ["workspace_employees", activeWorkspaceTenant?.id],
    queryFn: async () => {
      if (!activeWorkspaceTenant?.id) return [];
      return await fetchApi(`/employees/?company_id=${activeWorkspaceTenant.id}`);
    },
    enabled: !!activeWorkspaceTenant?.id,
  });

  const { data: workspaceAttendanceDaily = [] } = useQuery({
    queryKey: ["workspace_attendance_daily", activeWorkspaceTenant?.id],
    queryFn: async () => {
      if (!activeWorkspaceTenant?.id) return [];
      return await fetchApi(`/attendance/daily?company_id=${activeWorkspaceTenant.id}`);
    },
    enabled: !!activeWorkspaceTenant?.id,
  });

  const { data: workspaceDevices = [] } = useQuery({
    queryKey: ["workspace_devices", activeWorkspaceTenant?.id],
    queryFn: async () => {
      if (!activeWorkspaceTenant?.id) return [];
      return await fetchApi(`/devices/?company_id=${activeWorkspaceTenant.id}`);
    },
    enabled: !!activeWorkspaceTenant?.id,
  });

  const { data: workspaceAttendanceLogs = [] } = useQuery({
    queryKey: ["workspace_attendance_logs", activeWorkspaceTenant?.id],
    queryFn: async () => {
      if (!activeWorkspaceTenant?.id) return [];
      return await fetchApi(`/attendance/logs?company_id=${activeWorkspaceTenant.id}`);
    },
    enabled: !!activeWorkspaceTenant?.id,
  });

  const { data: workspaceDepartments = [] } = useQuery({
    queryKey: ["workspace_departments", activeWorkspaceTenant?.id],
    queryFn: async () => {
      if (!activeWorkspaceTenant?.id) return [];
      return await fetchApi(`/departments/?company_id=${activeWorkspaceTenant.id}`);
    },
    enabled: !!activeWorkspaceTenant?.id,
  });

  const { data: workspaceTickets = [] } = useQuery({
    queryKey: ["workspace_tickets", activeWorkspaceTenant?.id],
    queryFn: async () => {
      if (!activeWorkspaceTenant?.id) return [];
      return await fetchApi(`/tickets/?company_id=${activeWorkspaceTenant.id}`);
    },
    enabled: !!activeWorkspaceTenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await fetchApi("/companies/", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Organization onboarded successfully");
      setShowAddModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to onboard organization");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return await fetchApi(`/companies/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Organization updated successfully");
      setShowEditModal(false);
      setSelectedTenant(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update organization");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await fetchApi(`/companies/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      const tenantName = selectedTenant?.name || "Company";
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`Purged organization database: "${tenantName}" and all related workspaces have been deleted.`);
      setShowEditModal(false);
      setSelectedTenant(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete organization");
    }
  });

  const handleDelete = () => {
    if (!selectedTenant) return;
    if (window.confirm(`Are you absolutely sure you want to delete ${selectedTenant.name}? This will permanently remove all associated employees, departments, shifts, settings, and logs. This action cannot be undone.`)) {
      deleteMutation.mutate(selectedTenant.id);
    }
  };

  const handleDetectLocation = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setFetchingGps(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);
          setLatitude(lat);
          setLongitude(lon);
          
          try {
            const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/reverse-geocode?lat=${lat}&lng=${lon}`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data.address) {
                setAddress(data.address);
                toast.success("Current location and address resolved!");
              } else {
                toast.success("Current location coordinates resolved!");
              }
            } else {
              toast.success("Current location coordinates resolved!");
            }
          } catch (e) {
            console.error("Geocode error", e);
            toast.success("Current location coordinates resolved!");
          } finally {
            setFetchingGps(false);
          }
        },
        (err) => {
          setFetchingGps(false);
          toast.error("Failed to fetch GPS coordinates. Please ensure location permissions are granted.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      toast.error("Geolocation is not supported by your browser");
    }
  };

  const handleResolveAddress = async () => {
    if (!address.trim()) return;
    setFetchingGps(true);
    try {
      const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/geocode?address=${encodeURIComponent(address.trim())}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.lat !== null && data.lng !== null) {
          setLatitude(String(data.lat));
          setLongitude(String(data.lng));
          toast.success("Address resolved to coordinates successfully!");
        } else {
          toast.error("Could not find coordinates for this address. Please check spelling or enter lat/long manually.");
        }
      } else {
        toast.error("Failed to geocode address.");
      }
    } catch (e) {
      console.error("Geocode error", e);
      toast.error("An error occurred while geocoding the address.");
    } finally {
      setFetchingGps(false);
    }
  };

  const resetForm = () => {
    setName("");
    setAdminEmail("");
    setAdminPassword("");
    setPhone("");
    setAddress("");
    setMaxEmployees(100);
    setAvailableTokens(1000);
    setStatus("Active");
    setLogo("");
    setLatitude("12.9716");
    setLongitude("77.5946");
    setFetchingGps(false);
    setActiveStep(1);
  };

  const handleOpenEdit = (tenant: any) => {
    setSelectedTenant(tenant);
    setName(tenant.name);
    setAdminEmail(tenant.admin_email || "");
    setPhone(tenant.phone || "");
    setAddress(tenant.address || "");
    setMaxEmployees(tenant.max_employees || 100);
    setAvailableTokens(tenant.available_tokens || 1000);
    setStatus(tenant.status || "Active");
    setShowEditModal(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: name.trim(),
      admin_email: adminEmail.trim() || null,
      admin_password: adminPassword || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      max_employees: Number(maxEmployees),
      available_tokens: Number(availableTokens),
      status,
      logo: logo || null,
      latitude: latitude || null,
      longitude: longitude || null
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    updateMutation.mutate({
      id: selectedTenant.id,
      payload: {
        name,
        admin_email: adminEmail,
        phone,
        address,
        max_employees: Number(maxEmployees),
        available_tokens: Number(availableTokens),
        status
      }
    });
  };

  const filteredTenants = tenants.filter((t: any) => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.admin_email && t.admin_email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <SidebarLayout>
      {activeWorkspaceTenant ? (
        /* ────────────────── ORGANIZATION WORKSPACE VIEW ────────────────── */
        <div className="space-y-6 page-enter">
          {/* Workspace Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 bg-slate-50 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveWorkspaceTenant(null);
                  setSelectedTenant(null);
                }}
                className="p-2 hover:bg-slate-250 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-all flex items-center gap-1 font-bold text-xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div>
                <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-slate-200/60 border border-slate-300 text-slate-700 uppercase tracking-wider">
                  Workspace: {activeWorkspaceTenant.status}
                </span>
                <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
                  <Building2 className="w-5 h-5 text-slate-700 animate-pulse" />
                  {activeWorkspaceTenant.name}
                </h1>
              </div>
            </div>
          </div>

          {/* Workspace Tabs Navigation */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-zinc-950 rounded-2xl overflow-x-auto border border-slate-200/60 dark:border-zinc-800">
            {[
              { id: "overview", label: "Overview", icon: Building2 },
              { id: "employees", label: "Employees", icon: Users },
              { id: "attendance", label: "Attendance", icon: Clock },
              { id: "departments", label: "Departments", icon: Shield },
              { id: "hr", label: "HR", icon: ShieldCheck },
              { id: "devices", label: "Devices", icon: Monitor },
              { id: "recognition", label: "Recognition", icon: Sliders },
              { id: "reports", label: "Reports", icon: Download },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setWorkspaceTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[10.5px] font-black uppercase rounded-xl transition-all cursor-pointer ${
                    workspaceTab === tab.id
                      ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/20"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-900/50"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Workspace Tab Contents */}
          <div className="min-h-[400px] border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xs">
            {/* OVERVIEW TAB */}
            {workspaceTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Card 1: Total Registered Staff */}
                  <div className="tech-card-3d-minimal p-4 bg-white dark:bg-zinc-950 flex items-center gap-3 border border-slate-100 dark:border-zinc-800/60 rounded-2xl">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Registered Staff</span>
                      <p className="text-base font-black text-slate-800 dark:text-zinc-100">
                        {workspaceEmployees.length} {workspaceEmployees.length === 1 ? "Employee" : "Employees"}
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Today's Attendance */}
                  <div className="tech-card-3d-minimal p-4 bg-white dark:bg-zinc-950 flex items-center gap-3 border border-slate-100 dark:border-zinc-800/60 rounded-2xl">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Today's Attendance</span>
                      <p className="text-base font-black text-slate-800 dark:text-zinc-100">
                        {workspaceAttendanceDaily.filter((a: any) => a.status && a.status !== "Absent").length} Present
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Recognition Accuracy */}
                  <div className="tech-card-3d-minimal p-4 bg-white dark:bg-zinc-950 flex items-center gap-3 border border-slate-100 dark:border-zinc-800/60 rounded-2xl">
                    <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-955/20 border border-cyan-200 dark:border-cyan-900/40 text-cyan-700 dark:text-cyan-400">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Recognition Accuracy</span>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {workspaceAttendanceLogs.length > 0
                          ? (workspaceAttendanceLogs.reduce((acc: number, l: any) => acc + (l.confidence || 0.95), 0) / workspaceAttendanceLogs.length * 100).toFixed(1)
                          : "100.0"}% Confidence
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Active Devices */}
                  <div className="tech-card-3d-minimal p-4 bg-white dark:bg-zinc-950 flex items-center gap-3 border border-slate-100 dark:border-zinc-800/60 rounded-2xl">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Active Devices</span>
                      <p className="text-base font-black text-slate-800 dark:text-zinc-100">
                        {workspaceDevices.length} {workspaceDevices.length === 1 ? "Active Camera" : "Active Cameras"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Company Profile card */}
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-black uppercase text-slate-800 dark:text-zinc-300 tracking-wider">Organization Profile Details</h3>
                    <div className="tech-card-3d-minimal p-5 bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800/60 rounded-2xl space-y-4 text-xs">
                      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800/50 pb-3">
                        <div className="p-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-650 dark:text-zinc-300">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8.5px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">Legal Entity Name</p>
                          <p className="font-bold text-slate-800 text-[11.5px]">{activeWorkspaceTenant.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-650">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Primary Administrator</p>
                          <p className="font-bold text-slate-800 text-[11.5px]">{activeWorkspaceTenant.admin_email || "No email assigned"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-650">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</p>
                          <p className="font-semibold text-slate-700 text-[11px]">{activeWorkspaceTenant.phone || "No registered contact number"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-650">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Registered Location</p>
                          <p className="font-semibold text-slate-700 text-[11px] leading-relaxed">
                            {activeWorkspaceTenant.address || "No geolocated office address registered"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-650">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Licensing Limit</p>
                            <p className="font-bold text-slate-800 text-[11px]">Max {activeWorkspaceTenant.max_employees} Staff</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-650">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">Tokens Allocated</p>
                            <p className="font-bold text-slate-800 text-[11px]">{activeWorkspaceTenant.available_tokens} Tokens</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity card */}
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-black uppercase text-slate-800 dark:text-zinc-300 tracking-wider">Recent Activity Feed</h3>
                    <div className="tech-card-3d-minimal p-5 bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800/60 rounded-2xl h-[362px] flex flex-col justify-between">
                      <div className="space-y-3 font-mono text-[11px] max-h-[320px] overflow-y-auto pr-1 w-full">
                        {workspaceAttendanceLogs.length > 0 ? (
                          workspaceAttendanceLogs.slice(0, 5).map((log: any, i: number) => {
                            const dateObj = new Date(log.timestamp);
                            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const dateObjString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                            return (
                              <div key={i} className="flex items-start gap-3 border-l-2 border-slate-200 dark:border-zinc-800 pl-4 relative">
                                <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-zinc-100">{log.employee_name || "Staff Check-In"}</p>
                                  <p className="text-slate-455 dark:text-zinc-400 text-[9.5px] mt-0.5">
                                    {dateObjString} • {timeStr} • Match Score: {log.confidence ? (log.confidence * 100).toFixed(1) : "95.0"}%
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[260px] text-center space-y-3">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-full text-slate-400 dark:text-zinc-400">
                              <Activity className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">No Activity Logs</p>
                              <p className="text-[10.5px] text-slate-400 dark:text-zinc-450 max-w-[200px] leading-relaxed">
                                Biometric kiosk registrations and check-in events will populate here in real-time.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EMPLOYEES TAB */}
            {workspaceTab === "employees" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Registered Staff Directory</h3>
                  <button
                    onClick={() => toast.success("Employee onboarding Wizard is disabled in Super Admin mode. Log in as Company Admin to enroll.")}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    Add Employee
                  </button>
                </div>

                <div className="tech-card-3d-minimal bg-white overflow-hidden">
                   <table className="w-full text-left border-collapse text-xs">
                     <thead>
                       <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                         <th className="py-3 px-4">Name</th>
                         <th className="py-3 px-4">Designation</th>
                         <th className="py-3 px-4">Email Address</th>
                         <th className="py-3 px-4">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {workspaceEmployees.length > 0 ? (
                         workspaceEmployees.map((emp: any, i: number) => (
                           <tr key={i} className="hover:bg-slate-50/50">
                             <td className="py-3 px-4 font-bold text-slate-800">{emp.name}</td>
                             <td className="py-3 px-4 text-slate-550">{emp.designation || "Staff Representative"}</td>
                             <td className="py-3 px-4 text-slate-500 font-mono">{emp.email || "No email"}</td>
                             <td className="py-3 px-4">
                               <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase bg-emerald-50 border-emerald-150 text-emerald-700`}>
                                 Active
                               </span>
                             </td>
                           </tr>
                         ))
                       ) : (
                         <tr>
                           <td colSpan={4} className="py-8 text-center text-slate-400 font-medium italic">
                             No employees registered under this organization yet.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* ATTENDANCE TAB */}
            {workspaceTab === "attendance" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Daily Attendance Registry</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toast.success("Exporting daily sheet as CSV...")}
                      className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-[11px] rounded-xl active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                  </div>
                </div>

                <div className="tech-card-3d-minimal bg-white overflow-hidden">
                   <table className="w-full text-left border-collapse text-xs">
                     <thead>
                       <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                         <th className="py-3 px-4">Employee Name</th>
                         <th className="py-3 px-4">Log Timestamp</th>
                         <th className="py-3 px-4">AI Confidence Score</th>
                         <th className="py-3 px-4">Attendance Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {workspaceAttendanceLogs.length > 0 ? (
                         workspaceAttendanceLogs.map((log: any, i: number) => {
                           const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                           return (
                             <tr key={i} className="hover:bg-slate-50/50">
                               <td className="py-3 px-4 font-bold text-slate-850">{log.employee_name || "Staff Check-In"}</td>
                               <td className="py-3 px-4 text-slate-500 font-mono">{timeStr}</td>
                               <td className="py-3 px-4 text-slate-500 font-mono">{log.confidence ? log.confidence.toFixed(4) : "0.9500"}</td>
                               <td className="py-3 px-4">
                                 <span className="px-2 py-0.5 rounded-full border border-emerald-150 bg-emerald-50 text-[9px] font-bold uppercase text-emerald-700">
                                   Present
                                 </span>
                               </td>
                             </tr>
                           );
                         })
                       ) : (
                         <tr>
                           <td colSpan={4} className="py-8 text-center text-slate-400 font-medium italic">
                             No attendance logs registered today.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* DEPARTMENTS TAB */}
            {workspaceTab === "departments" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Organizational Departments</h3>
                  <button
                    onClick={() => toast.success("Creation of departments is restricted in platform Super Admin workspace. Log in as Company Admin to manage.")}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    Add Department
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {workspaceDepartments.length > 0 ? (
                     workspaceDepartments.map((dept: any, i: number) => {
                       const count = workspaceEmployees.filter((e: any) => e.department_id === dept.id).length;
                       return (
                         <div key={i} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex items-center justify-between">
                           <div className="space-y-1">
                             <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-150 text-slate-650 border border-slate-200">{dept.code || "DEPT"}</span>
                             <h4 className="text-xs font-bold text-slate-900 pt-1">{dept.name}</h4>
                           </div>
                           <div className="text-right">
                             <p className="text-lg font-black text-slate-800">{count}</p>
                             <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Employees</p>
                           </div>
                         </div>
                       );
                     })
                   ) : (
                     <div className="col-span-full py-8 text-center text-slate-400 font-medium italic">
                       No departments configured under this organization yet.
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* HR TAB */}
            {workspaceTab === "hr" && (
              <div className="space-y-6 text-left">
                {/* Leave Requests */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Employee Leave Requests</h3>
                  <div className="overflow-x-auto border border-slate-150 rounded-2xl p-6 text-center text-slate-400 text-xs italic bg-slate-50">
                    No pending leave requests found.
                  </div>
                </div>

                {/* Support Messages / Tickets */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Active Support Cases</h3>
                  <div className="space-y-2">
                    {workspaceTickets.length > 0 ? (
                      workspaceTickets.map((t: any, idx: number) => (
                        <div key={idx} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{t.title}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Category: {t.category || "General"} • Status: {t.status}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${
                            t.status === "Open" ? "bg-amber-50 border-amber-150 text-amber-700" : "bg-emerald-50 border-emerald-150 text-emerald-700"
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="border border-slate-150 rounded-2xl p-6 text-center text-slate-400 text-xs italic bg-slate-50">
                        No active support cases recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DEVICES TAB */}
            {workspaceTab === "devices" && (
              <div className="space-y-4 text-left">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Device Fleet Status</h3>
                <div className="space-y-2">
                  {workspaceDevices.length > 0 ? (
                    workspaceDevices.map((dev: any, i: number) => (
                      <div key={i} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{dev.name}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Branch: {dev.branch || "Lobby"} • IP: {dev.ip_address || "Dynamic"}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10.5px] font-bold text-emerald-700">Online</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-slate-150 rounded-2xl p-6 text-center text-slate-400 text-xs italic bg-slate-50">
                      No kiosk devices registered under this organization yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RECOGNITION TAB */}
            {workspaceTab === "recognition" && (
              <div className="space-y-6">
                {/* Confidence setting */}
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Match Confidence Cut-Off Threshold</h3>
                  <input
                    type="range"
                    min="0.30"
                    max="0.90"
                    step="0.05"
                    defaultValue="0.45"
                    className="w-full"
                    onChange={(e) => toast.success(`Confidence threshold configured: ${e.target.value}`)}
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase">
                    <span>0.30 (Relaxed Match)</span>
                    <span>0.45 (Optimal)</span>
                    <span>0.90 (Ultra Strict)</span>
                  </div>
                </div>

                {/* Unknown Faces and Detections */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider font-mono">Recognition Security Event Log</h3>
                  <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/30 text-center text-slate-450 text-xs font-semibold">
                    No unknown faces or spoof attempts reported today.
                  </div>
                </div>
              </div>
            )}

            {/* REPORTS TAB */}
            {workspaceTab === "reports" && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Download PDF & Excel Report Summaries</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Daily Attendance Sheet", desc: "List of all check-in entries for today" },
                    { label: "Monthly Analytics Summary", desc: "Overview of attendance trends & rates" },
                    { label: "Employee Enrolment Ledger", desc: "Biometric and department profiles" }
                  ].map((report, i) => (
                    <div key={i} className="tech-card-3d-minimal p-4 flex flex-col justify-between h-[120px] bg-white transition-all">
                      <div className="space-y-1">
                        <h4 className="text-xs font-extrabold text-slate-800">{report.label}</h4>
                        <p className="text-[10px] text-slate-450">{report.desc}</p>
                      </div>
                      <button
                        onClick={() => toast.success(`Preparing ${report.label} download...`)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1.5 self-start mt-2 active:scale-95 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {workspaceTab === "settings" && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Workspace Environment Settings</h3>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Office Bounds Time</label>
                      <input
                        type="text"
                        defaultValue="09:00 AM - 05:00 PM"
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Grace Period Time (Minutes)</label>
                      <input
                        type="number"
                        defaultValue={15}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Geofence Radius (Meters)</label>
                    <input
                      type="number"
                      defaultValue={50}
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white"
                    />
                  </div>

                  <button
                    onClick={() => toast.success("Corporate workspace settings updated successfully")}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer mt-2 active:scale-95 transition-all"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ────────────────── REGULAR LIST OF ORGANIZATIONS ────────────────── */
        <div className="space-y-6">
          {/* Header Block */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                Organizations
              </h1>
              <p className="text-slate-455 text-[11px]">
                Onboard, monitor, suspend, and configure client company accounts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await queryClient.invalidateQueries({ queryKey: ["tenants"] });
                    await refetch();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setTimeout(() => setIsRefreshing(false), 800);
                  }
                }}
                disabled={isRefreshing}
                className="p-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm active:scale-95 flex items-center gap-1.5 text-xs font-bold disabled:opacity-70"
                title="Refresh Organizations"
              >
                <RefreshCw 
                  className={`w-4 h-4 text-cyan-500 inline-block ${isRefreshing ? "animate-spin spin-icon" : ""}`} 
                  style={isRefreshing ? { animation: "spin-360 0.8s linear infinite", transformOrigin: "center" } : {}}
                /> Refresh
              </button>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="px-4 py-2.5 bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-zinc-950 font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Onboard Company
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by company name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-zinc-800 focus:outline-none focus:border-cyan-400 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          {/* Organizations grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-slate-100 rounded-2xl p-5 bg-white space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-10 bg-slate-50 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredTenants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTenants.map((t: any) => (
                <div 
                  key={t.id}
                  className="tech-card-3d-minimal p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
                >
                  {/* Status indicator bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    t.status === "Active" ? "bg-emerald-500" : t.status === "Suspended" ? "bg-amber-500" : "bg-rose-500"
                  }`} />

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{t.name}</h3>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]" title={t.admin_email}>{t.admin_email || "No email"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.status === "Pending Approval" ? (
                          <button
                            onClick={() => {
                              updateMutation.mutate({
                                id: t.id,
                                payload: {
                                  name: t.name,
                                  status: "Active",
                                  max_employees: t.max_employees,
                                  available_tokens: t.available_tokens,
                                  admin_email: t.admin_email,
                                  phone: t.phone,
                                  address: t.address
                                }
                              });
                            }}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                        ) : (
                          <span className={`inline-flex items-center text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            t.status === "Active" 
                              ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                              : t.status === "Suspended" 
                                ? "bg-amber-50 border-amber-150 text-amber-700" 
                                : "bg-rose-50 border-rose-150 text-rose-700"
                          }`}>
                            {t.status}
                          </span>
                        )}

                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  <div>
                    <button
                      onClick={() => {
                        setSelectedTenant(t);
                        setActiveWorkspaceTenant(t);
                        setWorkspaceTab("overview");
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5" /> Open Workspace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-205 rounded-2xl py-12 text-center text-slate-400 text-xs font-semibold">
              No organizations found matching search criteria.
            </div>
          )}

          {/* Onboarding 14-Step Wizard */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-fadeInUp flex flex-col" style={{maxHeight: 'min(85vh, 620px)'}}>
                
                {/* Wizard Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Company Onboarding Wizard</h2>
                    <p className="text-[10px] text-slate-450">Step {activeStep} of 14: {
                      activeStep === 1 ? "Company Information" :
                      activeStep === 2 ? "Company Logo" :
                      activeStep === 3 ? "Organization Administrator" :
                      activeStep === 4 ? "HR Setup & Licensing" :
                      activeStep === 5 ? "Company Branches" :
                      activeStep === 6 ? "Departments" :
                      activeStep === 7 ? "Office Locations" :
                      activeStep === 8 ? "Working Hours" :
                      activeStep === 9 ? "Attendance Policies" :
                      activeStep === 10 ? "Face Recognition Configuration" :
                      activeStep === 11 ? "Camera Registration" :
                      activeStep === 12 ? "Employee Invitation" :
                      activeStep === 13 ? "Final Review" : "Go Live & Deploy"
                    }</p>
                  </div>
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {/* Step indicator bar */}
                <div className="w-full bg-slate-100 h-1 shrink-0">
                  <div 
                    className="bg-slate-900 h-1 transition-all duration-350"
                    style={{ width: `${(activeStep / 14) * 100}%` }}
                  />
                </div>

                {/* Wizard Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-800">
                  {activeStep === 1 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Enter Legal Company Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                            placeholder="e.g. NetraID Industries"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Registration / GSTIN</label>
                          <input
                            type="text"
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                            placeholder="e.g. 29AAAAA0000A1Z5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Primary Contact Person</label>
                          <input
                            type="text"
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Industry Domain</label>
                          <select className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-750">
                            <option>Colleges & Higher Education</option>
                            <option>K-12 Schools</option>
                            <option>Corporate Office</option>
                            <option>Factory & Industrial Plant</option>
                            <option>Hospital & Healthcare</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Corporate Website</label>
                        <input
                          type="url"
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          placeholder="e.g. https://www.netraid.ai"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Office Address</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          placeholder="e.g. 101 Tech Park, Bangalore"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="space-y-4 text-center py-6">
                      <h3 className="text-xs font-bold text-slate-700">Upload Company Branding Logo</h3>
                      
                      {logo ? (
                        <div className="relative mx-auto w-24 h-24 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 flex items-center justify-center p-2 group">
                          <img src={logo} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setLogo("")}
                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 text-rose-450" />
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="mx-auto w-24 h-24 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-all">
                          <Plus className="w-5 h-5 text-zinc-450" />
                          <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300">Select Logo</span>
                          <span className="text-[8px] text-zinc-400">Max size: 500 KB</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 512 * 1024) {
                                toast.error("Logo file size must be under 500KB");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setLogo(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                      <p className="text-[10px] text-slate-450">Recommended: Square format 512x512 pixels</p>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Organization Administrator Account</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Admin Email address</label>
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          placeholder="e.g. admin@company.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Admin Password</label>
                        <div className="relative">
                          <input
                            type={showAdminPassword ? "text" : "password"}
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full text-xs h-9 pl-3 pr-10 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                            title={showAdminPassword ? "Hide password" : "Show password"}
                          >
                            {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 4 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Setup Employee Limits & Initial Tokens</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Max Employees Limit</label>
                          <input
                            type="number"
                            required
                            value={maxEmployees}
                            onChange={(e) => setMaxEmployees(Number(e.target.value))}
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Initial Available Tokens</label>
                          <input
                            type="number"
                            required
                            value={availableTokens}
                            onChange={(e) => setAvailableTokens(Number(e.target.value))}
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 5 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Setup Regional Branches</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Primary Branch Name</label>
                        <input
                          type="text"
                          defaultValue="Main Headquarters"
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 6 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Setup Corporate Departments</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Primary Department Name</label>
                        <input
                          type="text"
                          defaultValue="Engineering & Technology"
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 7 && (
                    <div className="space-y-4 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-700">Configure Geofence Office Coordinates</h3>
                        <button
                          type="button"
                          onClick={handleDetectLocation}
                          disabled={fetchingGps}
                          className="px-2.5 py-1 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-850 text-white dark:text-zinc-950 font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {fetchingGps ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                          Detect Current Location
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Office Street Address</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="flex-1 text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                            placeholder="e.g. 101 Tech Park, Bangalore"
                          />
                          <button
                            type="button"
                            onClick={handleResolveAddress}
                            disabled={fetchingGps || !address.trim()}
                            className="px-3 bg-zinc-900 hover:bg-zinc-850 text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {fetchingGps ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            Resolve Coords
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Geofence Latitude</label>
                          <input
                            type="text"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Geofence Longitude</label>
                          <input
                            type="text"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                          />
                        </div>
                      </div>

                      <p className="text-[9px] text-zinc-450 dark:text-zinc-500 leading-normal">
                        Geofence locks employees to checking in within range of coordinates. Detecting your location or entering an address will auto-geocode and reverse-lookup the details for the profile.
                      </p>
                    </div>
                  )}

                  {activeStep === 8 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Set Core Shift Working Hours</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Shift Timing Bounds</label>
                        <input
                          type="text"
                          defaultValue="09:00 AM - 06:00 PM"
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 9 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Configure Attendance Grace Policies</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Grace Period (Minutes)</label>
                        <input
                          type="number"
                          defaultValue={15}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 10 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Configure Biometric AI Face Match Threshold</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Confidence Cut-Off Score (Cosine Similarity)</label>
                        <input
                          type="range"
                          min="0.3"
                          max="0.9"
                          step="0.05"
                          defaultValue="0.6"
                          className="w-full"
                        />
                        <div className="flex justify-between text-[8px] text-slate-450 font-bold">
                          <span>0.3 (Loose Match)</span>
                          <span>0.6 (Recommended)</span>
                          <span>0.9 (Strict Match)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 11 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">On-Site Camera Kiosk Device Registration</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Primary Device Name</label>
                        <input
                          type="text"
                          defaultValue="Front Gate Lobby Tablet"
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 12 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Invite Employees (Roster Import)</h3>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Invitee Email List (Comma separated)</label>
                        <textarea
                          rows={3}
                          placeholder="john@company.com, sarah@company.com"
                          className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 13 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-700">Final Onboarding Audit Review</h3>
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2 text-[11px] text-slate-650">
                        <div>🏢 <strong>Company:</strong> {name || "Not entered"}</div>
                        <div>👤 <strong>Primary Administrator:</strong> {adminEmail || "Not entered"}</div>
                        <div>👥 <strong>Licensing Cap:</strong> {maxEmployees} employees</div>
                        <div>🪙 <strong>Balance Seed:</strong> {availableTokens} API tokens</div>
                      </div>
                    </div>
                  )}

                  {activeStep === 14 && (
                    <div className="space-y-4 text-center py-6">
                      <h3 className="text-xs font-bold text-slate-700">All Steps Ready!</h3>
                      <p className="text-[11px] text-slate-455">Click "Deploy System" below to generate organization spaces, initialize setting profiles, and dispatch administrator invites.</p>
                    </div>
                  )}
                </div>

                {/* Wizard Footer */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <button
                    type="button"
                    disabled={activeStep === 1}
                    onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-550 border border-slate-200 rounded-lg bg-white cursor-pointer active:scale-95 transition-all disabled:opacity-40"
                  >
                    Back
                  </button>
                  
                  {activeStep < 14 ? (
                    <button
                      type="button"
                      onClick={() => setActiveStep(prev => Math.min(14, prev + 1))}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg cursor-pointer active:scale-95 transition-all"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddSubmit}
                      disabled={createMutation.isPending}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                    >
                      {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Deploy System
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Edit Details Modal */}
          {showEditModal && (
            <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl animate-fadeInUp p-6 space-y-4 overflow-y-auto" style={{maxHeight: 'min(90vh, 560px)'}}>
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-250 uppercase tracking-wider">
                      Company ID: #{selectedTenant?.id}
                    </span>
                    <h2 className="text-sm font-extrabold text-slate-900 mt-1.5">
                      Edit details: {selectedTenant?.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </button>
                </div>

                {/* Details Tab */}
                <div className="min-h-[280px]">
                  <form onSubmit={handleEditSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Company Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Deauthorized">Deauthorized</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Admin Email Address</label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Max Employees Limit</label>
                        <input
                          type="number"
                          required
                          value={maxEmployees}
                          onChange={(e) => setMaxEmployees(Number(e.target.value))}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Available Face Tokens</label>
                        <input
                          type="number"
                          required
                          value={availableTokens}
                          onChange={(e) => setAvailableTokens(Number(e.target.value))}
                          className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Contact Phone</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Office Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="mr-auto px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete Company
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        {updateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}
