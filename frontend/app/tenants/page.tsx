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
  Activity,
  LayoutGrid,
  List
} from "lucide-react";

export default function TenantsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [maxEmployees, setMaxEmployees] = useState("50");
  const [initialTokens, setInitialTokens] = useState("1000");
  const [subscriptionTier, setSubscriptionTier] = useState("Free");
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
    setAdminPassword("");
    setPhone("");
    setAddress("");
    setMaxEmployees("50");
    setInitialTokens("1000");
    setSubscriptionTier("Free");
    setErrorMsg("");
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      admin_email: adminEmail || null,
      admin_password: adminPassword || null,
      phone: phone || null,
      address: address || null,
      max_employees: parseInt(maxEmployees) || 50,
      available_tokens: parseInt(initialTokens) || 1000,
      subscription_tier: subscriptionTier
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
    (c.admin_email && c.admin_email.toLowerCase().includes(search.toLowerCase())) ||
    (c.subscription_tier && c.subscription_tier.toLowerCase().includes(search.toLowerCase()))
  );

  const totalTenants = companies?.length || 0;
  const activeTenants = companies?.filter((c: any) => c.status === "Active").length || 0;
  const suspendedTenants = totalTenants - activeTenants;
  
  const totalEmployeesAcrossTenants = companies?.reduce((acc: number, c: any) => acc + (c.active_employees || 0), 0) || 0;

  const inputCls = "input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl transition-all w-full";

  const renderTierBadge = (tier: string) => {
    let color = "bg-slate-500/10 text-slate-400 border-slate-500/20";
    if (tier === "Basic") color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (tier === "Pro") color = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    if (tier === "Enterprise") color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${color}`}>{tier || "Free"}</span>;
  };

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
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "table" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
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

        {/* Tenants Display */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
             {Array.from({length: 3}).map((_, i) => (
                <div key={i} className="glass-card p-6 rounded-3xl border border-white/6 animate-pulse h-48" />
             ))}
          </div>
        ) : filteredCompanies?.length === 0 ? (
          <div className="py-20 text-center glass-card rounded-3xl border border-white/5">
            <p className="text-slate-400">No tenants found.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCompanies?.map((company: any) => {
              const usagePercent = Math.min(100, Math.round((company.active_employees / (company.max_employees || 1)) * 100));
              const isSuspended = company.status === "Suspended";
              
              let barColor = "bg-emerald-500";
              if (usagePercent > 75) barColor = "bg-amber-400";
              if (usagePercent > 90) barColor = "bg-rose-500";

              return (
                <div 
                  key={company.id} 
                  onClick={() => router.push(`/tenants/${company.id}`)}
                  className={`glass-card group relative overflow-hidden rounded-3xl border transition-all duration-300 cursor-pointer ${isSuspended ? "border-rose-500/30 bg-rose-500/[0.02]" : "border-[var(--border-medium)] hover:border-indigo-500/30 hover:shadow-[0_8px_30px_rgba(99,102,241,0.12)] hover:-translate-y-1"}`}
                >
                  
                  {isSuspended && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1.5 z-10">
                      <Lock className="w-3 h-3" /> SUSPENDED
                    </div>
                  )}

                  {/* Gradient flair at top */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isSuspended ? "bg-rose-500/50" : "bg-gradient-to-r from-indigo-500/50 to-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"}`} />

                  <div className="p-6 relative">
                    {/* Top Section: Avatar & Details & Actions */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md flex items-center justify-center shrink-0">
                          <span className="text-lg font-extrabold text-white">{company.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[16px] font-extrabold text-[var(--text-primary)] truncate">{company.name}</h3>
                            {renderTierBadge(company.subscription_tier)}
                          </div>
                          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{company.admin_email || "No admin email"}</p>
                        </div>
                      </div>
                      
                      {/* Subtle Action Icons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {company.id !== 1 && (
                          isSuspended ? (
                            <button 
                              onClick={() => activateMutation.mutate(company.id)}
                              disabled={activateMutation.isPending}
                              className="p-2 rounded-xl text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                              title="Activate Tenant"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => suspendMutation.mutate(company.id)}
                              disabled={suspendMutation.isPending}
                              className="p-2 rounded-xl text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                              title="Suspend Tenant"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                        <button 
                          onClick={() => {
                            setNewLimit(company.max_employees.toString());
                            setShowLimitDialog(company.id);
                          }}
                          className="p-2 rounded-xl text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-[var(--border-medium)]"
                          title="Update Employee Limit"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {/* Token Balance */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-medium)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                            <Activity className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tokens</span>
                        </div>
                        <span className="text-sm font-bold font-mono text-amber-500">{company.available_tokens}</span>
                      </div>

                      {/* Usage Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Employee Usage</span>
                          <span className="text-[11px] font-mono font-medium text-[var(--text-primary)]">
                            {company.active_employees} <span className="text-[var(--text-muted)]">/ {company.max_employees}</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[var(--border-medium)] rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${barColor} rounded-full transition-all duration-1000`} 
                            style={{ width: `${usagePercent}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card rounded-3xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="p-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-6">Company</th>
                    <th className="p-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tier</th>
                    <th className="p-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Usage</th>
                    <th className="p-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tokens</th>
                    <th className="p-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCompanies?.map((company: any) => {
                    const usagePercent = Math.min(100, Math.round((company.active_employees / (company.max_employees || 1)) * 100));
                    const isSuspended = company.status === "Suspended";
                    
                    let barColor = "bg-emerald-500";
                    if (usagePercent > 75) barColor = "bg-amber-400";
                    if (usagePercent > 90) barColor = "bg-rose-500";

                    return (
                      <tr 
                        key={company.id}
                        onClick={() => router.push(`/tenants/${company.id}`)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-extrabold text-white">{company.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-white group-hover:text-indigo-400 transition-colors">{company.name}</p>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{company.admin_email || "N/A"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {renderTierBadge(company.subscription_tier)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${usagePercent}%` }} />
                            </div>
                            <span className="text-[11px] font-mono text-slate-300">
                              {company.active_employees}/{company.max_employees}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-[12px] font-mono font-medium text-amber-400">
                            {company.available_tokens}
                          </span>
                        </td>
                        <td className="p-4">
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase">
                              <Lock className="w-3 h-3" /> Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {company.id !== 1 && (
                              isSuspended ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); activateMutation.mutate(company.id); }}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  title="Activate Tenant"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); suspendMutation.mutate(company.id); }}
                                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                                  title="Suspend Tenant"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showAddDialog && (
        <div className="modal-backdrop z-50">
          <div className="modal-content max-w-lg">
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                  <input type="text" required placeholder="Acme Corp" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Email</label>
                  <input type="email" required placeholder="admin@acme.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputCls} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Password</label>
                  <input type="password" required placeholder="Initial login password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className={inputCls} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</label>
                  <input type="text" placeholder="+1 234 567 8900" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</label>
                  <input type="text" placeholder="123 Main St" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subscription Tier</label>
                  <select 
                    value={subscriptionTier} 
                    onChange={(e) => {
                      setSubscriptionTier(e.target.value);
                      if (e.target.value === "Free") setMaxEmployees("10");
                      if (e.target.value === "Basic") setMaxEmployees("50");
                      if (e.target.value === "Pro") setMaxEmployees("250");
                      if (e.target.value === "Enterprise") setMaxEmployees("1000");
                    }} 
                    className={`${inputCls} bg-slate-900 border-white/10 text-white`}
                  >
                    <option value="Free">Free (10 Users)</option>
                    <option value="Basic">Basic (50 Users)</option>
                    <option value="Pro">Pro (250 Users)</option>
                    <option value="Enterprise">Enterprise (1000+ Users)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Employees</label>
                  <input type="number" min="1" required value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} className={inputCls} />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Initial Tokens</label>
                  <input type="number" min="0" required value={initialTokens} onChange={(e) => setInitialTokens(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="pt-4">
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
        <div className="modal-backdrop z-50">
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

