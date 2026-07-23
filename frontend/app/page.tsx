"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ShieldAlert, Shield, Building2, Users, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { fetchApi, setUserProfile, setTokens, getAccessToken } from "@/app/utils/api";

type RoleType = "Super Admin" | "Admin" | "Employee";

export default function LoginPage() {
  const router = useRouter();
  
  // Mounted state for hydration safety
  const [mounted, setMounted] = useState(false);

  // Authentication states
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showEmpPass, setShowEmpPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-onboarding / Login Lookup states
  const [lookupName, setLookupName] = useState("");
  const [matchedCompany, setMatchedCompany] = useState<{ id: number; name: string } | null>(null);
  const [isSelfOnboarding, setIsSelfOnboarding] = useState(false);

  // Employee self-registration details states
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empIdInput, setEmpIdInput] = useState("");
  const [empDesignation, setEmpDesignation] = useState("");
  const [empPhone, setEmpPhone] = useState("");

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    if (roleParam === "super-admin") {
      setSelectedRole("Super Admin");
      handleRoleSelect("Super Admin");
    }
    if (getAccessToken()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setError(null);
    setEmail("");
    setPassword("");
  };

  const handleCheckCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupName.trim()) return;
    
    const nameLower = lookupName.trim().toLowerCase();
    if (nameLower === "super admin" || nameLower === "superadmin" || nameLower === "netraid") {
      setSelectedRole("Super Admin");
      handleRoleSelect("Super Admin");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const company = await fetchApi(`/auth/companies/check?name=${encodeURIComponent(lookupName.trim())}`);
      setMatchedCompany({ id: company.id, name: company.name });
      setError(null);
    } catch (err: any) {
      setError(err.message || "Organization not found. Verify name.");
      setMatchedCompany(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedCompany) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApi("/auth/register-pending", {
        method: "POST",
        body: JSON.stringify({
          company_id: matchedCompany.id,
          name: empName,
          email: empEmail,
          password: empPassword,
          employee_id: empIdInput,
          phone: empPhone || undefined,
          designation: empDesignation || undefined
        })
      });
      // Redirect to public self-onboarding camera hud page
      router.push(`/self-onboard?employee_id=${response.employee_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to register account. Please check details.");
    } finally {
      setLoading(false);
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

      // Store tokens from login response (Bearer auth for cross-origin setup)
      if (response.access_token) {
        setTokens(response.access_token, response.refresh_token || "");
      }

      // Now fetch user profile using the stored token
      const profile = await fetchApi("/auth/me");
      
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
      setError(err.message || "Invalid credentials or account pending approval.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white relative overflow-hidden">
      
      {/* ─── Immersive Ambient Background Animations ─── */}
      <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none z-0 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[130px] pointer-events-none z-0 animate-pulse" />
      <div className="absolute inset-0 mesh-bg opacity-85 pointer-events-none z-0" />

      {/* ─── Premium Header Navbar ─── */}
      <header className="w-full h-16 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md px-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 100 100" className="w-5 h-5 text-cyan-400 animate-pulse" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" stroke="#0891b2" strokeWidth="2.5" strokeDasharray="10 15" />
              <circle cx="50" cy="50" r="22" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="50" cy="50" r="7" fill="#22d3ee" />
            </svg>
          </div>
          <span className="text-sm font-extrabold tracking-tight text-white uppercase font-mono">NetraID</span>
        </div>
      </header>

      {/* ─── Dual Pane Layout ─── */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center animate-fadeInUp">
          
          {/* Left Side: Welcome back info */}
          <div className="space-y-5 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight uppercase tracking-wider">
              {matchedCompany ? matchedCompany.name : "Welcome back"}
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-light leading-relaxed max-w-sm mx-auto md:mx-0">
              {matchedCompany 
                ? "Organization verified. Proceed to sign in to your employee dashboard or complete self-onboarding." 
                : "Select organization to access your biometric portal dashboard."}
            </p>
          </div>

          {/* Right Side: Flow Control */}
          <div className="bg-transparent">
            {mounted && (
              <>
                {selectedRole === "Super Admin" ? (
                  /* ─── SUPER ADMIN LOGIN VIEW ─── */
                  <div className="relative space-y-6 bg-slate-950/80 border border-slate-800 backdrop-blur-3xl rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.65)]">
                    <div className="flex items-center gap-4 border-b border-slate-850 pb-5 mb-2 text-left">
                      <button
                        onClick={() => {
                          setSelectedRole(null);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase tracking-wider">
                          Super Admin Login
                        </span>
                        <h2 className="text-sm font-extrabold text-slate-350 mt-1 leading-none">
                          NetraID Portal Management
                        </h2>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-455 p-3 rounded-xl mb-4 text-xs animate-fadeInUp">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="email"
                            required
                            placeholder="admin@netraid.ai"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="login-input w-full text-xs h-11 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type={showPass ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input w-full text-xs h-11 pl-9 pr-10 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black tracking-wider text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center mt-2"
                      >
                        {loading ? "Authenticating..." : "Sign In"}
                      </button>
                    </form>
                  </div>
                ) : matchedCompany === null ? (
                  /* ─── PHASE 1: ORG LOOKUP ─── */
                  <div className="relative space-y-6 bg-slate-950/80 border border-slate-800 backdrop-blur-3xl rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.65)]">
                    <div className="text-center lg:text-left space-y-1.5">
                      <h2 className="text-base font-black text-white tracking-tight uppercase tracking-wider">
                        Find Your Organization
                      </h2>
                      <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                        Enter your company legal name to sign in or perform self-onboarding.
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-455 p-3 rounded-xl text-xs animate-fadeInUp animate-pulse">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleCheckCompany} className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Company Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. NetraID Base"
                          value={lookupName}
                          onChange={(e) => setLookupName(e.target.value)}
                          className="login-input w-full text-xs h-11 px-4 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black tracking-wider text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {loading ? "Checking..." : "Continue"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>

                    <div className="text-center pt-4 border-t border-slate-900/60">
                      <button
                        onClick={() => {
                          setSelectedRole("Super Admin");
                          handleRoleSelect("Super Admin");
                        }}
                        className="text-[10.5px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        Access Super Admin Portal
                      </button>
                    </div>
                  </div>
                ) : isSelfOnboarding ? (
                  /* ─── PHASE 3: SELF-ONBOARDING DETAILS FORM ─── */
                  <div className="relative space-y-6 bg-slate-950/80 border border-slate-800 backdrop-blur-3xl rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.65)]">
                    <div className="flex items-center gap-4 border-b border-slate-850 pb-5 mb-2 text-left">
                      <button
                        onClick={() => {
                          setIsSelfOnboarding(false);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase tracking-wider">
                          Self-Onboarding Details
                        </span>
                        <h2 className="text-lg font-black text-white mt-1 leading-tight">
                          {matchedCompany.name}
                        </h2>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-455 p-3 rounded-xl mb-3 text-xs animate-fadeInUp">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleEmployeeRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                          <input type="text" required placeholder="John Doe" value={empName} onChange={e => setEmpName(e.target.value)}
                            className="login-input w-full text-xs h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
                          <input type="text" required placeholder="EMP102" value={empIdInput} onChange={e => setEmpIdInput(e.target.value)}
                            className="login-input w-full text-xs h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                        <input type="email" required placeholder="john@company.com" value={empEmail} onChange={e => setEmpEmail(e.target.value)}
                          className="login-input w-full text-xs h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                        <div className="relative">
                          <input 
                            type={showEmpPass ? "text" : "password"} 
                            required 
                            placeholder="••••••••" 
                            value={empPassword} 
                            onChange={e => setEmpPassword(e.target.value)}
                            className="login-input w-full text-xs h-10 pl-3.5 pr-10 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmpPass(!showEmpPass)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                            title={showEmpPass ? "Hide password" : "Show password"}
                          >
                            {showEmpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Designation</label>
                          <input type="text" placeholder="Software Engineer" value={empDesignation} onChange={e => setEmpDesignation(e.target.value)}
                            className="login-input w-full text-xs h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                          <input type="text" placeholder="9876543210" value={empPhone} onChange={e => setEmpPhone(e.target.value)}
                            className="login-input w-full text-xs h-10 px-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black tracking-wider text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                      >
                        {loading ? "Registering..." : "Continue to Face Scans"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : selectedRole !== null ? (
                  /* ─── STANDARD SIGN IN CARD FORM ─── */
                  <div className="relative space-y-6 bg-slate-950/80 border border-slate-800 backdrop-blur-3xl rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.65)]">
                    <div className="flex items-center gap-4 border-b border-slate-850 pb-5 mb-2 text-left">
                      <button
                        onClick={() => {
                          setSelectedRole(null);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-955 border border-cyan-850 text-cyan-400 uppercase tracking-wider">
                          {selectedRole} Login
                        </span>
                        <h2 className="text-sm font-extrabold text-slate-350 mt-1 leading-none">
                          {matchedCompany.name}
                        </h2>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-455 p-3 rounded-xl mb-4 text-xs animate-fadeInUp">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="email"
                            required
                            placeholder="name@organization.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="login-input w-full text-xs h-11 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type={showPass ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input w-full text-xs h-11 pl-9 pr-10 rounded-xl border border-slate-800 bg-slate-950/60 text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black tracking-wider text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center mt-2"
                      >
                        {loading ? "Authenticating..." : `Sign In`}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* ─── PHASE 2: SCOPED OPTIONS FOR MATCHED COMPANY ─── */
                  <div className="relative space-y-5 bg-slate-950/85 border border-cyan-500/10 backdrop-blur-3xl rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.65),0_0_30px_rgba(6,182,212,0.03)] animate-fadeInUp">
                    <div className="flex items-center gap-4 border-b border-slate-900 pb-5 mb-3 text-left">
                      <button
                        onClick={() => {
                          setMatchedCompany(null);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900/80 hover:border-slate-700/80 shadow-sm flex items-center justify-center text-slate-400 hover:text-cyan-400 cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 uppercase tracking-widest">
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                          Organization Verified
                        </span>
                        <h2 className="text-2xl font-black text-white mt-1.5 leading-none uppercase tracking-wide">
                          {matchedCompany.name}
                        </h2>
                      </div>
                    </div>

                    <div className="space-y-4 pt-1">
                      <button
                        onClick={() => {
                          setSelectedRole("Admin");
                          handleRoleSelect("Admin");
                        }}
                        className="w-full text-left p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 hover:border-cyan-500/30 hover:bg-slate-900/60 shadow-md hover:shadow-[0_0_25px_rgba(6,182,212,0.04)] transition-all duration-300 flex items-center gap-5 group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-all shrink-0 shadow-inner">
                          <Building2 className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                            Company Admin Sign In
                          </p>
                          <p className="text-[11px] text-slate-400 font-light mt-1">
                            Manage company metrics and logs
                          </p>
                        </div>
                        <ArrowRight className="w-4.5 h-4.5 text-slate-600 group-hover:translate-x-1.5 group-hover:text-cyan-400 transition-all" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRole("Employee");
                          handleRoleSelect("Employee");
                        }}
                        className="w-full text-left p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 hover:border-blue-500/30 hover:bg-slate-900/60 shadow-md hover:shadow-[0_0_25px_rgba(59,130,246,0.04)] transition-all duration-300 flex items-center gap-5 group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-all shrink-0 shadow-inner">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                            Employee Sign In
                          </p>
                          <p className="text-[11px] text-slate-455 font-light mt-1">
                            Access attendance and punches
                          </p>
                        </div>
                        <ArrowRight className="w-4.5 h-4.5 text-slate-600 group-hover:translate-x-1.5 group-hover:text-blue-400 transition-all" />
                      </button>

                      <button
                        onClick={() => {
                          setIsSelfOnboarding(true);
                          setError(null);
                        }}
                        className="w-full text-left p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 hover:border-emerald-500/30 hover:bg-slate-900/60 shadow-md hover:shadow-[0_0_25px_rgba(16,185,129,0.04)] transition-all duration-300 flex items-center gap-5 group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-805 flex items-center justify-center text-emerald-455 group-hover:scale-105 transition-all shrink-0 shadow-inner">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                            New Employee Self-Onboarding
                          </p>
                          <p className="text-[11px] text-slate-455 font-light mt-1">
                            Register your account and biometrics
                          </p>
                        </div>
                        <ArrowRight className="w-4.5 h-4.5 text-slate-605 group-hover:translate-x-1.5 group-hover:text-emerald-400 transition-all" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </main>

      {/* ─── Footer note ─── */}
      <footer className="w-full h-12 border-t border-slate-900/60 bg-slate-950/20 px-6 flex items-center justify-center text-[10px] text-slate-500 font-medium relative z-10">
        © {new Date().getFullYear()} NetraID Inc. All rights reserved.
      </footer>
      
    </div>
  );
}
