"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ShieldAlert, Shield, Building2, Users, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
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
  const [empDeptId, setEmpDeptId] = useState("");
  const [availableDepts, setAvailableDepts] = useState<any[]>([]);

  useEffect(() => {
    if (!matchedCompany?.id) {
      setAvailableDepts([]);
      return;
    }
    const fetchDepts = async () => {
      try {
        const depts = await fetchApi(`/auth/public/departments/${matchedCompany.id}`);
        setAvailableDepts(depts || []);
      } catch (err) {
        console.error("Failed to load departments:", err);
      }
    };
    fetchDepts();
  }, [matchedCompany?.id]);

  useEffect(() => {
    setMounted(true);
    // Request geolocation permission immediately on startup
    if (typeof window !== "undefined" && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => console.log("Init geolocation success"),
        (err) => console.warn("Init geolocation error", err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    if (roleParam === "super-admin") {
      setSelectedRole("Super Admin");
      handleRoleSelect("Super Admin");
    }
    if (getAccessToken()) {
      router.push("/dashboard");
    }
    const storedCompany = localStorage.getItem("matchedCompany");
    if (storedCompany) {
      try {
        setMatchedCompany(JSON.parse(storedCompany));
      } catch (e) {
        localStorage.removeItem("matchedCompany");
      }
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
      if (company.exists === false || !company.id) {
        setError(company.message || "Organization not found. Verify name.");
        setMatchedCompany(null);
        localStorage.removeItem("matchedCompany");
      } else {
        const matched = { id: company.id, name: company.name };
        setMatchedCompany(matched);
        localStorage.setItem("matchedCompany", JSON.stringify(matched));
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || "Organization not found. Verify name.");
      setMatchedCompany(null);
      localStorage.removeItem("matchedCompany");
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
          designation: empDesignation || undefined,
          department_id: empDeptId ? parseInt(empDeptId) : undefined
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
            <div className="inline-flex items-center gap-2 bg-cyan-950/50 border border-cyan-800/40 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-450 animate-pulse animate-duration-1000" />
              <span className="text-[10px] font-bold text-cyan-400 tracking-wider uppercase font-mono">Biometric Identity Platform</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] uppercase">
              {matchedCompany ? matchedCompany.name : "NETRAID\nIDENTITY"}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-sm mx-auto md:mx-0">
              {matchedCompany 
                ? "Enterprise portal initialized. Access your biometric logs, check-ins, and approval center." 
                : "Secure single sign-on portal. Locate your enterprise to begin identity validation."}
            </p>
          </div>

          {/* Right Side: Flow Control */}
          <div className="bg-transparent">
            {mounted && (
              <>
                {selectedRole === "Super Admin" ? (
                  /* ─── SUPER ADMIN LOGIN VIEW ─── */
                  <div className="relative space-y-6 bg-zinc-950/40 border border-zinc-800/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl animate-fadeInUp">
                    <div className="flex items-center gap-4 border-b border-zinc-900 pb-5 mb-2 text-left">
                      <button
                        onClick={() => {
                          setSelectedRole(null);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase tracking-wider">
                          Super Admin Login
                        </span>
                        <h2 className="text-sm font-extrabold text-zinc-355 mt-1 leading-none">
                          NetraID Portal Management
                        </h2>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-400 p-3 rounded-xl mb-4 text-xs animate-fadeInUp">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                          <input
                            type="email"
                            required
                            placeholder="admin@netraid.ai"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full text-xs h-11 pl-9 pr-4 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                          <input
                            type={showPass ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full text-xs h-11 pl-9 pr-10 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 btn-skeuomorphic-white text-xs rounded-xl flex items-center justify-center mt-2 cursor-pointer"
                      >
                        {loading ? "Authenticating..." : "Sign In"}
                      </button>
                    </form>
                  </div>
                ) : matchedCompany === null ? (
                  /* ─── PHASE 1: ORG LOOKUP ─── */
                  <div className="relative space-y-6 bg-zinc-955 border border-zinc-800 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl animate-fadeInUp">
                    <div className="space-y-2 text-center md:text-left">
                      <h2 className="text-base font-extrabold text-white tracking-tight uppercase font-mono">
                        Find Your Organization
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        Enter your company name to sign in or perform self-onboarding.
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-400 p-3 rounded-xl text-xs animate-fadeInUp">
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
                          className="w-full text-xs h-11 px-4 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-550 transition-all font-semibold login-input-dark"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 btn-skeuomorphic-white text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {loading ? "Checking..." : "Continue"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>

                    <div className="text-center pt-4 border-t border-zinc-900/60">
                      <button
                        onClick={() => {
                          setSelectedRole("Super Admin");
                          handleRoleSelect("Super Admin");
                        }}
                        className="text-[10.5px] text-slate-500 hover:text-slate-355 transition-colors cursor-pointer"
                      >
                        Access Super Admin Portal
                      </button>
                    </div>
                  </div>
                ) : isSelfOnboarding ? (
                  /* ─── PHASE 3: SELF-ONBOARDING DETAILS FORM ─── */
                  <div className="relative space-y-6 bg-zinc-950/40 border border-zinc-800/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl animate-fadeInUp">
                    <div className="flex items-center gap-4 border-b border-zinc-900 pb-5 mb-2 text-left">
                      <button
                        onClick={() => {
                          setIsSelfOnboarding(false);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-955 border border-cyan-805 text-cyan-405 uppercase tracking-wider">
                          Self-Onboarding Details
                        </span>
                        <h2 className="text-lg font-black text-white mt-1 leading-tight">
                          {matchedCompany.name}
                        </h2>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 text-rose-400 p-3 rounded-xl mb-3 text-xs animate-fadeInUp">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleEmployeeRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                          <input type="text" required placeholder="John Doe" value={empName} onChange={e => setEmpName(e.target.value)}
                            className="w-full text-xs h-10 px-3.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark" />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
                          <input type="text" required placeholder="EMP102" value={empIdInput} onChange={e => setEmpIdInput(e.target.value)}
                            className="w-full text-xs h-10 px-3.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold" />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                        <input type="email" required placeholder="john@company.com" value={empEmail} onChange={e => setEmpEmail(e.target.value)}
                          className="w-full text-xs h-10 px-3.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark" />
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
                            className="w-full text-xs h-10 pl-3.5 pr-10 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark" 
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
                            className="w-full text-xs h-10 px-3.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark" />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
                          <div className="relative">
                            <select 
                              required 
                              value={empDeptId} 
                              onChange={e => setEmpDeptId(e.target.value)}
                              className="w-full text-xs h-10 pl-3.5 pr-8 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer font-semibold login-input-dark"
                            >
                              <option value="">Select Department</option>
                              {availableDepts.map((d: any) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                        <input type="text" placeholder="9876543210" value={empPhone} onChange={e => setEmpPhone(e.target.value)}
                          className="w-full text-xs h-10 px-3.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark" />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 btn-skeuomorphic-white text-xs rounded-xl flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                      >
                        {loading ? "Registering..." : "Continue to Face Scans"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : selectedRole !== null ? (
                  /* ─── STANDARD SIGN IN CARD FORM ─── */
                  <div className="relative space-y-6 bg-zinc-955 border border-zinc-800 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl animate-fadeInUp">
                    <div className="flex items-center gap-4 border-b border-zinc-900 pb-5 mb-2 text-left">
                      <button
                        onClick={() => {
                          setSelectedRole(null);
                          setError(null);
                        }}
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-950 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase tracking-wider font-mono">
                          {selectedRole} Login
                        </span>
                        <h2 className="text-sm font-extrabold text-zinc-355 mt-1 leading-none">
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
                        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                          <input
                            type="email"
                            required
                            placeholder="name@organization.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full text-xs h-11 pl-9 pr-4 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                          <input
                            type={showPass ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full text-xs h-11 pl-9 pr-10 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-500 transition-all font-semibold login-input-dark"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-505 hover:text-white transition-colors cursor-pointer"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 btn-skeuomorphic-white text-xs rounded-xl flex items-center justify-center mt-2 cursor-pointer"
                      >
                        {loading ? "Authenticating..." : "Sign In"}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* ─── PHASE 2: SCOPED OPTIONS FOR MATCHED COMPANY ─── */
                  <div className="relative space-y-4 bg-zinc-950/35 border border-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 shadow-xl animate-fadeInUp">
                    <div className="flex items-center gap-3 mb-2 text-left">
                      <button
                        onClick={() => {
                          setMatchedCompany(null);
                          localStorage.removeItem("matchedCompany");
                          setError(null);
                        }}
                        className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 shadow-sm flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-all active:scale-90"
                        title="Go back"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">
                        Select login route
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {[
                        {
                          role: "Admin",
                          title: "Enterprise Admin Console",
                          icon: <Building2 className="w-4 h-4" />,
                          borderColor: "hover:border-cyan-500/20",
                          accentColor: "text-cyan-400",
                        },
                        {
                          role: "Employee",
                          title: "Employee Sign In Portal",
                          icon: <Users className="w-4 h-4" />,
                          borderColor: "hover:border-blue-500/20",
                          accentColor: "text-blue-400",
                        },
                        {
                          role: "Self-Onboard",
                          title: "Employee Self-Onboarding",
                          icon: <Users className="w-4 h-4" />,
                          borderColor: "hover:border-emerald-500/20",
                          accentColor: "text-emerald-400",
                        }
                      ].map((item) => (
                        <button
                          key={item.role}
                          onClick={() => {
                            if (item.role === "Self-Onboard") {
                              setIsSelfOnboarding(true);
                              setError(null);
                            } else {
                              setSelectedRole(item.role as RoleType);
                              handleRoleSelect(item.role as RoleType);
                            }
                          }}
                          className={`w-full h-12 rounded-xl border border-zinc-800/80 bg-zinc-900/30 ${item.borderColor} hover:bg-zinc-900/60 shadow-xs transition-all duration-200 flex items-center justify-between px-4 group cursor-pointer active:scale-[0.98]`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center ${item.accentColor} group-hover:scale-105 transition-all shrink-0`}>
                              {item.icon}
                            </div>
                            <span className="text-[11.5px] font-bold text-zinc-300 group-hover:text-white transition-colors">
                              {item.title}
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-650 group-hover:translate-x-1 group-hover:text-white transition-all" />
                        </button>
                      ))}
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
