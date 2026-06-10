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
      <div className="absolute inset-0 mesh-bg opacity-30 pointer-events-none" />

      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-slate-100/50 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-100/50 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-fadeInUp">
        
        {/* Logo block */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] mb-4 overflow-hidden group">
            {/* Ambient glowing background inside the container */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />
            
            {/* Robotic eye SVG */}
            <svg viewBox="0 0 100 100" className="w-10 h-10 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              <path d="M30 30 L35 35 M65 65 L70 70 M65 30 L60 35 M35 65 L30 70" stroke="#0891b2" strokeWidth="1" opacity="0.5" />
              
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            NetraID
          </h1>
          <p className="text-slate-500 text-[12.5px] mt-1">
            AI Biometric Attendance Platform
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg shadow-slate-100">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-800">
              Sign in to dashboard
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Use your administrator credentials to continue
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-500/5 border border-rose-500/15 text-rose-600 p-3 rounded-xl mb-5 text-xs animate-fadeInUp">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="admin@netraid.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-icon h-11 bg-white border-slate-200 text-slate-900 rounded-xl focus:border-slate-800"
                  autoComplete="email"
                  suppressHydrationWarning
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-icon pr-icon h-11 bg-white border-slate-200 text-slate-900 rounded-xl focus:border-slate-800"
                  autoComplete="current-password"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  suppressHydrationWarning
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-11 flex items-center justify-center gap-2 mt-2 rounded-xl bg-slate-900 text-white border-slate-900 hover:bg-slate-800 cursor-pointer shadow-sm"
              suppressHydrationWarning
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Default credentials hint */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Default: admin@netraid.ai / Admin@NetraID2026
            </p>
          </div>
        </div>

        {/* Kiosk link */}
        <div className="mt-5 text-center">
          <a
            href="/kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[12px] text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Kiosk Terminal</span>
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 mt-6 font-mono">
          NetraID v1.0.0 · Open Source · MIT License
        </p>
      </div>
    </div>
  );
}
