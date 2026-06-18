"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldAlert, ExternalLink } from "lucide-react";
import { fetchApi, setTokens, setUserProfile, getAccessToken } from "@/app/utils/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) router.push("/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      <div className="w-full max-w-sm relative z-10 animate-fadeInUp">
        
        {/* Logo block */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-18 h-18 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] mb-4 overflow-hidden group">
            {/* Ambient glowing background inside the container */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />
            
            {/* Robotic eye SVG */}
            <svg viewBox="0 0 100 100" className="w-11 h-11 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer technical rotating rings */}
              <circle cx="50" cy="50" r="45" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="6 12" className="animate-rotate-ring" />
              <circle cx="50" cy="50" r="40" stroke="#0891b2" strokeWidth="1" strokeDasharray="40 10 15 5" className="animate-rotate-ring-reverse" style={{ opacity: 0.6 }} />
              
              {/* Outer eye contour (fixed robot frame) */}
              <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
              <path d="M25 50 C 35 33, 65 33, 75 50 C 65 67, 35 67, 25 50 Z" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
              
              {/* Blinking Eyelid Overlay/Aperture */}
              <g className="animate-eye-lid">
                {/* Sclera/Iris */}
                <circle cx="50" cy="50" r="22" fill="#0f172a" stroke="#0891b2" strokeWidth="1.5" />
                <circle cx="50" cy="50" r="14" fill="#0e7490" stroke="#22d3ee" strokeWidth="1" opacity="0.5" />
                
                {/* Glowing Iris Details */}
                <path d="M50 28 L50 34 M50 66 L50 72 M28 50 L34 50 M66 50 L72 50" stroke="#22d3ee" strokeWidth="1" opacity="0.7" />
                
                {/* Glowing Pupil */}
                <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
                {/* Pupil reflection */}
                <circle cx="47" cy="47" r="2" fill="#ffffff" opacity="0.8" />
              </g>
              
              {/* Futuristic crosshairs / HUD markers */}
              <path d="M50 5 L50 12 M50 88 L50 95 M5 50 L12 50 M88 50 L95 50" stroke="#475569" strokeWidth="1.5" />
              
              {/* Scanning laser beam overlay */}
              <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="1.5" className="animate-laser" filter="url(#glow-logo)" />
              
              {/* Def for glow filter */}
              <defs>
                <filter id="glow-logo" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            NetraID
          </h1>
          <p className="text-slate-400 text-[11px] mt-0.5">
            AI Biometric Attendance
          </p>
        </div>

        {/* Login card */}
        <div className="glass-overlay rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
          <div className="mb-5 text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Admin Credentials
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
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="admin@netraid.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-icon"
                  autoComplete="email"
                  suppressHydrationWarning
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-icon pr-icon"
                  autoComplete="current-password"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  suppressHydrationWarning
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-1.5 mt-2 h-9"
              suppressHydrationWarning
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Kiosk link */}
        <div className="mt-4 text-center">
          <a
            href="/kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-800 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Kiosk Terminal</span>
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] text-slate-400 mt-6 font-mono">
          NetraID v1.0.0
        </p>
      </div>
    </div>
  );
}
