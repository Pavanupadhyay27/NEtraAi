"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi } from "@/app/utils/api";
import { 
  Building2, 
  ArrowLeft,
  Users,
  Database,
  Coins,
  Activity,
  Plus
} from "lucide-react";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = params.id as str;

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

  const handleAddTokens = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(addTokensAmount);
    if (!isNaN(amount) && amount > 0) {
      addTokensMutation.mutate(amount);
    }
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

  return (
    <SidebarLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <button 
          onClick={() => router.push("/tenants")} 
          className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium mb-8 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tenants
        </button>

        <div className="flex items-center gap-5 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
            <span className="text-3xl font-extrabold text-white">{tenant.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">{tenant.name}</h1>
            <p className="text-slate-400 font-mono mt-1">{tenant.admin_email || "No admin email setup"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        {/* Add Tokens Section */}
        <div className="glass-card p-8 rounded-3xl border border-white/6 max-w-xl">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            Issue Tokens to Tenant
          </h2>
          <form onSubmit={handleAddTokens} className="flex gap-4">
            <div className="flex-1">
              <input
                type="number"
                min="1"
                required
                placeholder="Amount of tokens (e.g. 500)"
                value={addTokensAmount}
                onChange={(e) => setAddTokensAmount(e.target.value)}
                className="w-full h-12 bg-white/[0.015] border border-white/5 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.03] transition-all"
              />
            </div>
            <button 
              type="submit" 
              disabled={addTokensMutation.isPending}
              className="btn-primary h-12 px-6 rounded-xl font-bold flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {addTokensMutation.isPending ? "Issuing..." : "Issue Tokens"}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-4">
            Tokens are deducted automatically when tenant's employees mark their attendance (1 scan = 1 token).
          </p>
        </div>

      </div>
    </SidebarLayout>
  );
}
