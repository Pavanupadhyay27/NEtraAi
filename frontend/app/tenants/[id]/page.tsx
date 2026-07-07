"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi } from "@/app/utils/api";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { 
  Building2, 
  ArrowLeft,
  Users,
  Database,
  Coins,
  Activity,
  Plus,
  ToggleRight,
  ToggleLeft,
  MapPin,
  Phone,
  Shield,
  Briefcase,
  Zap
} from "lucide-react";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = params.id as string;

  const [addTokensAmount, setAddTokensAmount] = useState("");

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => fetchApi("/companies/"),
  });

  const tenant = companies?.find((c: any) => c.id.toString() === tenantId);

  const addTokensMutation = useMutation({
    mutationFn: (amount: number) => fetchApi(`/companies/${tenantId}/add-tokens`, { 
      method: "POST", 
      body: JSON.stringify({ amount }) 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setAddTokensAmount("");
    }
  });

  const updateTierMutation = useMutation({
    mutationFn: (tier: string) => fetchApi(`/companies/${tenantId}/tier?subscription_tier=${tier}`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] })
  });

  const handleAddTokens = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(addTokensAmount);
    if (!isNaN(amount) && amount > 0) {
      addTokensMutation.mutate(amount);
    }
  };

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["tenant_settings", tenantId],
    queryFn: () => fetchApi(`/companies/${tenantId}/settings`),
    enabled: !!tenant,
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string, value: string }) => 
      fetchApi(`/companies/${tenantId}/settings/${key}`, { 
        method: "PUT", 
        body: JSON.stringify({ value }) 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_settings", tenantId] });
    }
  });

  const toggleSetting = (setting: any) => {
    const newValue = setting.value === "true" ? "false" : "true";
    updateSettingMutation.mutate({ key: setting.key, value: newValue });
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </SidebarLayout>
    );
  }

  if (!tenant) {
    return (
      <SidebarLayout>
        <div className="p-8">
          <h1 className="text-xl font-bold text-white mb-4">Tenant not found</h1>
          <button onClick={() => router.push("/tenants")} className="btn-primary rounded-xl px-4 py-2 flex items-center gap-2 w-fit cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back to Tenants
          </button>
        </div>
      </SidebarLayout>
    );
  }

  const usagePercent = Math.min(100, Math.round((tenant.active_employees / (tenant.max_employees || 1)) * 100));

  // Mock chart data
  const mockChartData = Array.from({ length: 30 }).map((_, i) => ({
    name: `Day ${i + 1}`,
    tokens: Math.floor(Math.random() * 50) + 10,
    employees: Math.floor(Math.random() * 2) + (i % 5 === 0 ? 1 : 0), // Gradual onboarding
  }));

  // Accumulated employees for area chart
  let currentTotal = Math.max(0, tenant.active_employees - 15);
  const employeeGrowthData = mockChartData.map(d => {
    currentTotal += d.employees;
    return { name: d.name, total: currentTotal };
  });

  const renderTierBadge = (tier: string) => {
    let color = "bg-slate-500/10 text-slate-400 border-slate-500/20";
    if (tier === "Basic") color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (tier === "Pro") color = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    if (tier === "Enterprise") color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${color}`}>{tier || "Free"}</span>;
  };

  return (
    <SidebarLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <button 
          onClick={() => router.push("/tenants")} 
          className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tenants
        </button>

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_30px_rgba(99,102,241,0.3)] flex items-center justify-center shrink-0">
              <span className="text-4xl font-extrabold text-white shadow-sm">{tenant.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">{tenant.name}</h1>
                {renderTierBadge(tenant.subscription_tier)}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <span className="text-slate-400 font-mono text-sm flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> {tenant.admin_email || "No admin email"}</span>
                {tenant.phone && <span className="text-slate-400 font-mono text-sm flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> {tenant.phone}</span>}
                {tenant.address && <span className="text-slate-400 font-mono text-sm flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {tenant.address}</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <select 
              value={tenant.subscription_tier || "Free"}
              onChange={(e) => updateTierMutation.mutate(e.target.value)}
              disabled={updateTierMutation.isPending}
              className="h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="Free">Free Tier</option>
              <option value="Basic">Basic Tier</option>
              <option value="Pro">Pro Tier</option>
              <option value="Enterprise">Enterprise Tier</option>
            </select>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tokens Card */}
          <div className="glass-card p-6 rounded-3xl border border-white/6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Tokens</p>
                <p className="text-2xl font-bold text-white">{tenant.available_tokens}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-sm">
              <span className="text-slate-400">Tokens Used:</span>
              <span className="font-mono text-white">{tenant.tokens_used}</span>
            </div>
          </div>

          {/* Employees Card */}
          <div className="glass-card p-6 rounded-3xl border border-white/6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Employees</p>
                <p className="text-2xl font-bold text-white">{tenant.active_employees}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5">
              <div className="flex justify-between items-center mb-2 text-xs">
                <span className="text-slate-400">Limit: {tenant.max_employees}</span>
                <span className="text-slate-300 font-mono">{usagePercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${usagePercent}%` }} />
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="glass-card p-6 rounded-3xl border border-white/6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tenant.status === 'Active' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                <Activity className={`w-5 h-5 ${tenant.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
                <p className={`text-2xl font-bold ${tenant.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>{tenant.status}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-sm">
              <span className="text-slate-400">Created At:</span>
              <span className="font-mono text-white text-xs">{new Date(tenant.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-3xl border border-white/6">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Token Consumption (30 Days)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `${val}`} width={40} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#fbbf24' }}
                  />
                  <Area type="monotone" dataKey="tokens" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/6">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              Employee Onboarding Trend
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={employeeGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis stroke="#94a3b8" fontSize={11} width={40} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <Line type="monotone" dataKey="total" name="Total Employees" stroke="#818cf8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tokens Issue & Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1 glass-card p-8 rounded-3xl border border-white/6 flex flex-col justify-center">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              Issue Tokens
            </h2>
            <form onSubmit={handleAddTokens} className="flex flex-col gap-4">
              <input
                type="number"
                min="1"
                required
                placeholder="Amount (e.g. 500)"
                value={addTokensAmount}
                onChange={(e) => setAddTokensAmount(e.target.value)}
                className="w-full h-12 bg-white/[0.015] border border-white/5 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.03] transition-all"
              />
              <button 
                type="submit" 
                disabled={addTokensMutation.isPending}
                className="btn-primary h-12 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer w-full"
              >
                <Plus className="w-4 h-4" />
                {addTokensMutation.isPending ? "Issuing..." : "Credit Account"}
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              Tokens are deducted automatically when tenant's employees mark their attendance (1 scan = 1 token). Top up to ensure continuous operation.
            </p>
          </div>

          <div className="lg:col-span-2 glass-card p-8 rounded-3xl border border-white/6">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Feature Flags & Permissions
            </h2>
            
            {isSettingsLoading ? (
              <div className="flex justify-center p-4">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !settings || settings.length === 0 ? (
              <p className="text-slate-400 text-sm">No permissions configured for this tenant. Try re-seeding or checking logs.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.filter((s: any) => s.value === "true" || s.value === "false").map((setting: any) => (
                  <div key={setting.key} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group cursor-pointer" onClick={() => toggleSetting(setting)}>
                    <div className="pr-4">
                      <p className="text-[12px] font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {setting.key.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed line-clamp-2" title={setting.description}>{setting.description}</p>
                    </div>
                    <button 
                      disabled={updateSettingMutation.isPending}
                      className={`p-1 rounded-full transition-all duration-300 shrink-0 ${setting.value === "true" ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-slate-600"}`}
                    >
                      {setting.value === "true" ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Audit Log / Activity */}
        <TenantActivityLog tenantId={tenantId} />

      </div>
    </SidebarLayout>
  );
}

function TenantActivityLog({ tenantId }: { tenantId: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["tenant_audit", tenantId],
    queryFn: () => fetchApi(`/audit/?company_id=${tenantId}&limit=10`),
  });

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/6">
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-indigo-400" />
        Recent Activity Logs
      </h2>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !logs || logs.length === 0 ? (
        <p className="text-slate-400 text-sm">No recent activity found for this tenant.</p>
      ) : (
        <div className="space-y-4">
          {logs.map((log: any) => (
            <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <div>
                <p className="text-sm font-bold text-white">{log.action}</p>
                {log.details && <p className="text-[11px] text-slate-400 mt-1">{log.details}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                  {log.user_id && <span>User ID: {log.user_id}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
