"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, UserCheck, ShieldAlert, HelpCircle, Maximize, Minimize,
  Volume2, VolumeX, Clock as ClockIcon, Play, Wifi, Fingerprint, Shield
} from "lucide-react";
import { getBackendUrl } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";

function formatTime12h(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  
  const hr = parseInt(parts[0], 10);
  const mn = parseInt(parts[1], 10);
  const sc = parts[2] ? parseInt(parts[2], 10) : 0;
  
  const suffix = hr >= 12 ? "PM" : "AM";
  const hour12 = hr % 12 || 12;
  const pad = (num: number) => String(num).padStart(2, "0");
  
  return `${pad(hour12)}:${pad(mn)}:${pad(sc)} ${suffix}`;
}

export default function KioskPage() {
  const { toast } = useToast();
  const [kioskActive, setKioskActive] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "spoof" | "unknown" | "maintenance" | "no_employees" | "ask_checkout" | "locked">("idle");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [cameraLabel] = useState("Main Entrance");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<string>("LOADING ENGINE...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef(false);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      setCurrentDate(now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch engine state dynamically on mount
  useEffect(() => {
    const checkEngine = async () => {
      try {
        const url = `${getBackendUrl().replace("/api/v1", "")}/health`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.mock_mode) {
            setEngineMode("MOCKED OFFLINE ENGINE");
          } else {
            setEngineMode("REAL BIOMETRIC ENGINE");
          }
        } else {
          setEngineMode("REAL BIOMETRIC ENGINE");
        }
      } catch (err) {
        setEngineMode("REAL BIOMETRIC ENGINE");
      }
    };
    checkEngine();
    const interval = setInterval(checkEngine, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const startKiosk = async () => {
    setScanFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      });
      streamRef.current = stream;
      
      // Since video element is always mounted now, videoRef.current is guaranteed to exist!
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Error playing video:", err));
      }
      
      setKioskActive(true);
      setScanStatus("idle");
      intervalRef.current = setInterval(captureAndScan, 1000);
    } catch (err) {
      console.error(err);
      toast.error("Unable to access camera. Please check browser permissions and ensure no other application is using it.");
    }
  };

  const stopKiosk = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setKioskActive(false);
    setScanStatus("idle");
    setScanResult(null);
    setScanFeedback(null);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const captureAndScan = async () => {
    if (cooldownRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check if the video is actually ready and playing
    if (video.readyState < 2) return;

    canvas.width = 640; canvas.height = 480;
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.82);
    setLastImage(base64);
    setScanning(true);
    try {
      // Connect to the backend running at the configured URL
      const url = `${getBackendUrl()}/kiosk/scan`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, camera: cameraLabel })
      });
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      
      if (data.status === "no_face") {
        setScanFeedback("Align your face in frame");
      } else if (data.status === "multiple_faces") {
        setScanFeedback("One person at a time");
      } else {
        setScanFeedback(null);
        handleResult(data);
      }
    } catch (err) {
      console.error("Scan API connection error:", err);
      setScanFeedback("Connection error");
    } finally {
      setScanning(false);
    }
  };

  const confirmCheckout = async () => {
    if (!lastImage) return;
    setScanning(true);
    try {
      const url = `${getBackendUrl()}/kiosk/scan`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: lastImage, camera: cameraLabel, confirm_checkout: true })
      });
      if (!res.ok) throw new Error("Checkout confirmation failed");
      const data = await res.json();
      handleResult(data);
    } catch (err) {
      console.error("Checkout confirmation error:", err);
      setScanFeedback("Confirmation error");
    } finally {
      setScanning(false);
    }
  };

  const handleResult = (data: any) => {
    if (data.status === "success") {
      setProfileImageError(false);
      setScanStatus("success"); setScanResult(data);
      setMatchTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      triggerCooldown(4500);
      if (voiceEnabled && data.tts_url) {
        const backendBaseUrl = getBackendUrl().replace("/api/v1", "");
        new Audio(`${backendBaseUrl}${data.tts_url}`).play().catch((err) => {
          console.error("Autoplay voice greeting failed:", err);
        });
      }
    } else if (data.status === "ask_checkout") {
      setProfileImageError(false);
      setScanStatus("ask_checkout"); setScanResult(data);
      if (voiceEnabled && data.tts_url) {
        const backendBaseUrl = getBackendUrl().replace("/api/v1", "");
        new Audio(`${backendBaseUrl}${data.tts_url}`).play().catch((err) => {
          console.error("Autoplay voice greeting failed:", err);
        });
      }
    } else if (data.status === "locked") {
      setScanStatus("locked"); setScanResult(data);
      triggerCooldown(4000);
    } else if (data.status === "spoof_detected") {
      setScanStatus("spoof"); setScanResult(data);
      triggerCooldown(3000);
    } else if (data.status === "unknown") {
      setScanStatus("unknown"); setScanResult(data);
      triggerCooldown(2500);
    } else if (data.status === "maintenance") {
      setScanStatus("maintenance"); setScanResult(data);
      triggerCooldown(5000);
    } else if (data.status === "no_employees") {
      setScanStatus("no_employees"); setScanResult(data);
      triggerCooldown(4000);
    }
  };

  const triggerCooldown = (ms: number) => {
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
      setScanStatus("idle");
      setScanResult(null);
    }, ms);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col relative select-none overflow-hidden font-sans">
      {/* Background Grid Mesh */}
      <div className="absolute inset-0 mesh-bg pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-slate-500/5 blur-[120px] pointer-events-none rounded-full" />

      {/* ─── Top HUD Bar ─── */}
      <header className="relative z-30 h-14 border-b border-[var(--border-medium)] px-6 flex items-center justify-between kiosk-header">
        {/* Brand info */}
        <div className="flex items-center gap-2.5 animate-fadeInUp">
          <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/80 shadow-[0_0_12px_rgba(6,182,212,0.2)] overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />
            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white z-20" />
            <svg viewBox="0 0 100 100" className="w-6 h-6 relative z-10 animate-fade-in" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" stroke="#334155" strokeWidth="2" strokeDasharray="8 12" className="animate-rotate-ring" />
              <circle cx="50" cy="50" r="40" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="30 15" className="animate-rotate-ring-reverse" style={{ opacity: 0.8 }} />
              <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#64748b" strokeWidth="2.5" />
              <g className="animate-eye-lid">
                <circle cx="50" cy="50" r="22" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
                <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
              </g>
              <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="2" className="animate-laser" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-[15px] tracking-tight text-[var(--text-primary)] leading-none">NetraID Kiosk</h1>
            <p className="text-[9px] text-[var(--text-muted)] font-mono mt-0.5 uppercase tracking-wider">{cameraLabel}</p>
          </div>
        </div>

        {/* Clock */}
        <div className="text-center absolute left-1/2 -translate-y-1/2">
          <p className="text-base font-bold font-mono tracking-tight text-[var(--text-primary)] leading-none tabular-nums">
            {currentTime || "00:00:00"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? "Mute audio assistance" : "Enable audio assistance"}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              voiceEnabled
                ? "bg-zinc-950 border-zinc-950 text-white"
                : "bg-slate-55 border-slate-200 text-slate-400"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen toggle"
            className="p-1.5 rounded-lg bg-slate-55 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <canvas ref={canvasRef} className="hidden" />

        {/* Video / Camera frame container */}
        <div className="w-full max-w-3xl relative">
          
          {/* Pre-start offline glass card */}
          {!kioskActive && (
            <div className="w-full max-w-2xl mx-auto glass-overlay border border-[var(--border-medium)] rounded-3xl text-center p-12 aspect-video flex flex-col items-center justify-center space-y-6 animate-fadeInUp shadow-[0_8px_32px_rgba(0,0,0,0.03)] relative overflow-hidden">
              <div className="relative flex flex-col items-center">
                {/* Status Badge */}
                <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 font-mono text-[9px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Terminal Offline
                </div>

                {/* Subtle outer breathing ring */}
                <div className="absolute inset-[-6px] rounded-full bg-cyan-500/5 border border-cyan-500/10 animate-pulse" />
                
                {/* Cybernetic blinking/glowing robot eye logo */}
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--bg-surface)] border border-cyan-500/30 dark:border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)]" />
                  <svg viewBox="0 0 100 100" className="w-11 h-11 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="45" stroke="#334155" strokeWidth="2" strokeDasharray="8 12" className="animate-rotate-ring" />
                    <circle cx="50" cy="50" r="40" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="30 15" className="animate-rotate-ring-reverse" style={{ opacity: 0.8 }} />
                    <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#64748b" strokeWidth="2.5" />
                    <g className="animate-eye-lid">
                      <circle cx="50" cy="50" r="22" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
                      <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
                    </g>
                    <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="2" className="animate-laser" />
                  </svg>
                </div>
              </div>

              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">Kiosk Offline</h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Start the camera terminal to begin face biometric logging.
                </p>
              </div>

              <button
                onClick={startKiosk}
                className="btn-primary h-10 px-8 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Scanner
              </button>
            </div>
          )}

          {/* Camera Frame Frame */}
          <div className={`relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-100 shadow-sm ${kioskActive ? "block" : "hidden"}`}>
            
            {/* Native Video player (Centrally mounted) */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              autoPlay playsInline muted
            />

            {/* Scanning overlay: active standby state */}
            {kioskActive && scanStatus === "idle" && (
              <>
                <div className="scanner-laser" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-48 h-48">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-zinc-950 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-zinc-950 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-zinc-950 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-zinc-950 rounded-br-xl" />
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-[var(--text-primary)] font-mono font-bold tracking-wider uppercase bg-[var(--bg-surface)] px-3 py-1.5 rounded border border-[var(--border-medium)] shadow-2xs">
                        {scanFeedback || (scanning ? "Processing..." : "Center Face")}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SUCCESS screen */}
            {kioskActive && scanStatus === "success" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
                <div className="space-y-4 max-w-xs w-full animate-fade-in">
                  {/* Profile Image / Initials */}
                  <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border border-zinc-150 shadow-sm bg-zinc-55 flex items-center justify-center">
                    {scanResult?.employee?.employee_id && !profileImageError ? (
                      <img
                        src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${scanResult.employee.employee_id}/front.jpg`}
                        alt={scanResult.employee.name}
                        className="w-full h-full object-cover"
                        onError={() => setProfileImageError(true)}
                      />
                    ) : (
                      <span className="text-zinc-700 font-bold text-2xl">
                        {scanResult?.employee?.name
                          ? scanResult.employee.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                          : "PK"}
                      </span>
                    )}
                  </div>

                  {/* Name and Designation */}
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                      {scanResult?.employee?.name || "Employee"}
                    </h2>
                    <p className="text-[11px] text-zinc-400 font-medium">
                      {scanResult?.employee?.designation || "Employee"} ({scanResult?.employee?.employee_id})
                    </p>
                  </div>

                  {/* Clock & Status */}
                  <div className="space-y-2.5 pt-2">
                    <p className="text-xl font-bold font-mono text-[var(--text-primary)] tracking-tight tabular-nums">
                      {matchTime}
                    </p>
                    
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-mono text-[9px] font-bold uppercase tracking-wider">
                        Matched
                      </span>
                      {scanResult?.attendance?.working_hours > 0 && (
                        <div className="mt-1 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg">
                          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Time Worked Today</p>
                          <p className="text-xs font-bold text-zinc-755 font-mono mt-0.5">{scanResult.attendance.working_hours.toFixed(2)} hours</p>
                        </div>
                      )}
                      {scanResult?.confidence && (
                        <p className="text-[8.5px] text-zinc-400 font-mono mt-1">
                          Confidence: {(scanResult.confidence * 100).toFixed(0)}% · {(scanResult.liveness_score * 100).toFixed(0)}% Real
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ASK_CHECKOUT screen */}
            {kioskActive && scanStatus === "ask_checkout" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp z-30">
                <div className="space-y-4 max-w-sm w-full animate-fade-in">
                  <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border border-zinc-150 shadow-sm bg-zinc-55 flex items-center justify-center">
                    {scanResult?.employee?.employee_id && !profileImageError ? (
                      <img
                        src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${scanResult.employee.employee_id}/front.jpg`}
                        alt={scanResult.employee.name}
                        className="w-full h-full object-cover"
                        onError={() => setProfileImageError(true)}
                      />
                    ) : (
                      <span className="text-zinc-700 font-bold text-2xl">
                        {scanResult?.employee?.name
                          ? scanResult.employee.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                          : "PK"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                      {scanResult?.employee?.name || "Employee"}
                    </h2>
                    <p className="text-[11.5px] text-zinc-500 font-medium">
                      Already checked in at <span className="font-mono font-bold text-zinc-750">{formatTime12h(scanResult?.attendance?.check_in)}</span>
                    </p>
                  </div>

                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 max-w-[200px] mx-auto">
                    <p className="text-[9px] text-zinc-450 font-bold uppercase tracking-wider">Working Hours So Far</p>
                    <p className="text-sm font-extrabold text-zinc-850 font-mono mt-0.5">
                      {scanResult?.working_hours_so_far?.toFixed(2)} hours
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1.5">
                    <p className="text-[12px] font-bold text-[var(--text-primary)]">Do you want to Check Out?</p>
                    <div className="flex items-center justify-center gap-2.5">
                      <button
                        onClick={confirmCheckout}
                        disabled={scanning}
                        className="px-5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-[12px] font-bold shadow-sm cursor-pointer transition-all disabled:opacity-50"
                      >
                        Yes, Check Out
                      </button>
                      <button
                        onClick={() => {
                          setScanStatus("idle");
                          setScanResult(null);
                        }}
                        disabled={scanning}
                        className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12px] font-bold border border-zinc-200 cursor-pointer transition-all disabled:opacity-50"
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LOCKED screen */}
            {kioskActive && scanStatus === "locked" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp z-30">
                <div className="space-y-3.5 max-w-xs animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-600">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">Attendance Locked</h2>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    {scanResult?.message || "Your attendance is locked for today. Emergency re-entry must be approved by an Admin."}
                  </p>
                </div>
              </div>
            )}

            {/* SPOOF screen */}
            {kioskActive && scanStatus === "spoof" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
                <div className="space-y-3 max-w-xs animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-600">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">Verification Denied</h2>
                  <p className="text-xs text-rose-600 font-medium leading-relaxed">{scanResult?.message}</p>
                  <p className="text-[8.5px] text-zinc-450 font-mono">
                    Liveness score: {scanResult?.liveness_score?.toFixed(3)}
                  </p>
                </div>
              </div>
            )}

            {/* UNKNOWN screen */}
            {kioskActive && scanStatus === "unknown" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
                <div className="space-y-3 max-w-xs animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-600">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">Not Recognized</h2>
                  <p className="text-xs text-zinc-500 leading-relaxed">{scanResult?.message || "Face not registered on system database."}</p>
                </div>
              </div>
            )}

            {/* MAINTENANCE screen */}
            {kioskActive && scanStatus === "maintenance" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
                <div className="space-y-3 max-w-xs animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200/50 flex items-center justify-center mx-auto text-zinc-800">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">Kiosk Offline</h2>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {scanResult?.message || "Biometric scans are temporarily suspended."}
                  </p>
                </div>
              </div>
            )}

            {/* NO_EMPLOYEES screen */}
            {kioskActive && scanStatus === "no_employees" && (
              <div className="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center animate-fadeInUp">
                <div className="space-y-3 max-w-xs animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-600">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">Setup Required</h2>
                  <p className="text-xs text-zinc-555 leading-relaxed">
                    {scanResult?.message || "Please add employees to the system first."}
                  </p>
                </div>
              </div>
            )}

            {/* Frame Info HUD Overlay */}
            {kioskActive && (
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xs px-3 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE · {cameraLabel.toUpperCase()}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); stopKiosk(); }}
                  className="pointer-events-auto text-[9.5px] font-semibold text-rose-500 bg-[var(--bg-surface)] border border-rose-500/20 hover:bg-rose-500/10 shadow-2xs px-3 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Disable Camera
                </button>
              </div>
            )}
          </div>

          {/* Active bottom status bar indicators */}
          {kioskActive && (
            <div className="flex items-center justify-center gap-5 text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-zinc-950 animate-pulse" : "bg-zinc-350"}`} />
                <span>{scanning ? "Scanning" : "Standby"}</span>
              </div>
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1">
                <span>Anti-Spoof Active</span>
              </div>
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1">
                <span>Auto-indexing</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 h-10 border-t border-[var(--border-medium)] flex items-center justify-center kiosk-footer">
        <p className="text-[9.5px] font-mono font-bold text-[var(--text-muted)] tracking-wider">
          NETRAID SECURE TERMINAL GATEWAY v1.0.0 · {engineMode}
        </p>
      </footer>
    </div>
  );
}
