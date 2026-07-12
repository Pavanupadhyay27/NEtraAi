"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ShieldAlert, Shield, Building2, Users, ArrowLeft, ArrowRight } from "lucide-react";
import { fetchApi, setTokens, setUserProfile, getAccessToken } from "@/app/utils/api";

type RoleType = "Super Admin" | "Admin" | "Employee";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setError(null);
    setEmail("");
    setPassword("");
    
    // Autofill defaults for convenience (can be edited by the user)
    if (role === "Super Admin") {
      setEmail("admin@netraid.ai");
    } else if (role === "Admin") {
      setEmail("hr@netraid.ai");
    } else {
      setEmail("employee@netraid.ai");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);

      const response = await fetchApi("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      setTokens(response.access_token, response.refresh_token);
      const profile = await fetchApi("/auth/me");
      
      // Verify that the logged-in user matches the selected role
      const userRole = profile?.role?.name;
      if (selectedRole === "Super Admin" && userRole !== "Super Admin") {
        throw new Error("Access denied: This portal is only for Super Admins.");
      }
      if (selectedRole === "Admin" && userRole !== "Admin" && userRole !== "HR") {
        throw new Error("Access denied: This portal is only for Company Admins and HR.");
      }
      if (selectedRole === "Employee" && userRole !== "Employee") {
        throw new Error("Access denied: This portal is only for Employees.");
      }

      setUserProfile(profile);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-[var(--bg-base)] flex items-center justify-center overflow-hidden px-4">
      {/* Grid Mesh background */}
      <div className="absolute inset-0 mesh-bg pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        
        {/* Logo block */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-18 h-18 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] mb-4 overflow-hidden group">
            {/* Ambient glowing background inside the container */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />
            
            {/* Robotic eye SVG */}
            <svg viewBox="0 0 100 100" className="w-11 h-11 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="6 12" className="animate-rotate-ring" />
              <circle cx="50" cy="50" r="40" stroke="#0891b2" strokeWidth="1" strokeDasharray="40 10 15 5" className="animate-rotate-ring-reverse" style={{ opacity: 0.6 }} />
              <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
              <path d="M25 50 C 35 33, 65 33, 75 50 C 65 67, 35 67, 25 50 Z" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
              <g className="animate-eye-lid">
                <circle cx="50" cy="50" r="22" fill="#0f172a" stroke="#0891b2" strokeWidth="1.5" />
                <circle cx="50" cy="50" r="14" fill="#0e7490" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
                <path d="M50 28 L50 34 M50 66 L50 72 M28 50 L34 50 M66 50 L72 50" stroke="#22d3ee" strokeWidth="1" opacity="0.7" />
                <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
                <circle cx="47" cy="47" r="2" fill="#ffffff" opacity="0.8" />
              </g>
              <path d="M50 5 L50 12 M50 88 L50 95 M5 50 L12 50 M88 50 L95 50" stroke="#475569" strokeWidth="1.5" />
              <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="1.5" className="animate-laser" filter="url(#glow-logo)" />
              <defs>
                <filter id="glow-logo" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            NetraID Portal
          </h1>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Identify your role to access the workspace
          </p>
        </div>

        {/* Role Selector Screen */}
        {selectedRole === null ? (
          <div className="space-y-3">
            {/* Super Admin Card */}
            <button
              onClick={() => handleRoleSelect("Super Admin")}
              className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white/70 hover:bg-slate-50/80 hover:border-cyan-400 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600 group-hover:scale-105 transition-all">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Super Admin Portal</p>
                <p className="text-[10px] text-slate-400">Onboard & monitor organizations</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Company Admin Card */}
            <button
              onClick={() => handleRoleSelect("Admin")}
              className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white/70 hover:bg-slate-50/80 hover:border-cyan-400 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-all">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Company Admin Portal</p>
                <p className="text-[10px] text-slate-400">Manage shifts, departments & logs</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Employee Card */}
            <button
              onClick={() => handleRoleSelect("Employee")}
              className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white/70 hover:bg-slate-50/80 hover:border-cyan-400 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-all">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Employee Portal</p>
                <p className="text-[10px] text-slate-400">Scan attendance & request leave</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        ) : (
          /* Login Card Form */
          <div className="glass-overlay rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.03)] relative">
            <button
              onClick={() => setSelectedRole(null)}
              className="absolute -top-3 -left-3 w-8 h-8 rounded-full border border-slate-200 bg-white shadow-2xs flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-350 cursor-pointer transition-all active:scale-90"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="mb-5 text-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {selectedRole} Login
              </h2>
            </div>

            {/* Error state */}
            {error && (
              <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-600 p-2.5 rounded-lg mb-4 text-[11.5px] animate-fadeInUp">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-450 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-icon text-xs h-10 w-full rounded-xl border border-slate-200 px-3 bg-white"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-455 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-icon pr-icon text-xs h-10 w-full rounded-xl border border-slate-200 px-3 bg-white"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? "Authenticating..." : `Sign In as ${selectedRole}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
