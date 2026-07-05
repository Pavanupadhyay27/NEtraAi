"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi } from "@/app/utils/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, 
  Users, 
  Plus, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Lock, 
  Unlock,
  AlertTriangle,
  TrendingUp,
  Activity
} from "lucide-react";

export default function TenantsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [maxEmployees, setMaxEmployees] = useState("50");
  const [newLimit, setNewLimit] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => fetchApi("/companies/"),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => fetchApi("/companies/", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to create company");
    }
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/companies/${id}/suspend`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] })
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/companies/${id}/activate`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] })
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({ id, limit }: { id: number, limit: number }) => 
      fetchApi(`/companies/${id}/limit?max_employees=${limit}`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setShowLimitDialog(null);
    }
  });

  const resetForm = () => {
    setName("");
    setAdminEmail("");
    setMaxEmployees("50");
    setErrorMsg("");
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      admin_email: adminEmail || null,
      max_employees: parseInt(maxEmployees) || 50
    });
  };

  const handleUpdateLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showLimitDialog && newLimit) {
      updateLimitMutation.mutate({ id: showLimitDialog, limit: parseInt(newLimit) });
    }
  };

  const filteredCompanies = companies?.filter((c: any) => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.admin_email && c.admin_email.toLowerCase().includes(search.toLowerCase()))
  );

  const totalTenants = companies?.length || 0;
  const activeTenants = companies?.filter((c: any) => c.status === "Active").length || 0;
  const suspendedTenants = totalTenants - activeTenants;
  
  const totalEmployeesAcrossTenants = companies?.reduce((acc: number, c: any) => acc + (c.active_employees || 0), 0) || 0;

  const inputCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all w-full";

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/5">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Tenant Control Panel</h1>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 font-medium flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
              Super Admin SaaS Management
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowAddDialog(true)}
              className="btn-primary text-[12px] h-9.5 px-4 flex items-center gap-2 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Onboard Tenant
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-white/6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tenants</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalTenants}</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Tenants</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{activeTenants}</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suspended</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{suspendedTenants}</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total End Users</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalEmployeesAcrossTenants}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} !pl-10 h-10 bg-white/[0.015] border-white/5 text-white`}
          />
        </div>

        {/* Tenants Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
             {Array.from({length: 3}).map((_, i) => (
                <div key={i} className="glass-card p-6 rounded-3xl border border-white/6 animate-pulse h-48" />
             ))}
          </div>
        ) : filteredCompanies?.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-400">No tenants found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCompanies?.map((company: any) => {
              const usagePercent = Math.min(100, Math.round((company.active_employees / (company.max_employees || 1)) * 100));
              const isSuspended = company.status === "Suspended";
              
              let barColor = "bg-emerald-500";
              if (usagePercent > 75) barColor = "bg-amber-400";
              if (usagePercent > 90) barColor = "bg-rose-500";

              return (
                <div key={company.id} className={`glass-card relative overflow-hidden rounded-3xl border transition-all ${isSuspended ? "border-rose-500/30 opacity-75" : "border-white/6 hover:border-white/10"}`}>
                  
                  {isSuspended && (
                    <div className="absolute top-0 right-0 bg-rose-500/20 text-rose-400 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-b border-l border-rose-500/30 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> SUSPENDED
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-lg font-extrabold text-white">{company.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-[15px] font-bold text-white truncate">{company.name}</h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">{company.admin_email || "No admin email"}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Usage Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee Usage</span>
                          <span className="text-[11px] font-mono font-medium text-slate-300">
                            {company.active_employees} <span className="text-slate-500">/ {company.max_employees}</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${barColor} rounded-full transition-all duration-1000`} 
                            style={{ width: `${usagePercent}%` }} 
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                        {company.id !== 1 && (
                          isSuspended ? (
                            <button 
                              onClick={() => activateMutation.mutate(company.id)}
                              disabled={activateMutation.isPending}
                              className="flex-1 btn-primary bg-emerald-500 hover:bg-emerald-600 text-white border-transparent h-8 text-[11px] flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                            >
                              <Unlock className="w-3 h-3" />
                              Activate
                            </button>
                          ) : (
                            <button 
                              onClick={() => suspendMutation.mutate(company.id)}
                              disabled={suspendMutation.isPending}
                              className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all h-8 text-[11px] font-semibold flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                            >
                              <Lock className="w-3 h-3" />
                              Suspend
                            </button>
                          )
                        )}
                        <button 
                          onClick={() => {
                            setNewLimit(company.max_employees.toString());
                            setShowLimitDialog(company.id);
                          }}
                          className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all h-8 text-[11px] font-semibold flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                        >
                          <TrendingUp className="w-3 h-3" />
                          Update Limit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showAddDialog && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Onboard New Tenant</h3>
              <button 
                onClick={() => { setShowAddDialog(false); resetForm(); }} 
                className="p-2 rounded-xl hover:bg-white/6 text-slate-500 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-medium">
                  {errorMsg}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                <input type="text" required placeholder="Acme Corp" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Email</label>
                <input type="email" required placeholder="admin@acme.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Employees Limit</label>
                <input type="number" min="1" required value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} className={inputCls} />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full h-10 rounded-xl font-bold cursor-pointer">
                  {createMutation.isPending ? "Onboarding..." : "Register Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Limit Modal */}
      {showLimitDialog !== null && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Update Usage Limit</h3>
              <button 
                onClick={() => setShowLimitDialog(null)} 
                className="p-2 rounded-xl hover:bg-white/6 text-slate-500 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateLimit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Max Employees Limit</label>
                <input type="number" min="1" required value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className={inputCls} />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={updateLimitMutation.isPending} className="btn-primary w-full h-10 rounded-xl font-bold cursor-pointer">
                  {updateLimitMutation.isPending ? "Updating..." : "Save Limit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
