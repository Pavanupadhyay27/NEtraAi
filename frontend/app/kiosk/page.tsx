"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, UserCheck, ShieldAlert, HelpCircle, Maximize, Minimize,
  Volume2, VolumeX, Clock as ClockIcon, Play, Wifi, Fingerprint, Shield
} from "lucide-react";
import { getBackendUrl } from "@/app/utils/api";

export default function KioskPage() {
  const [kioskActive, setKioskActive] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "spoof" | "unknown" | "maintenance" | "no_employees">("idle");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [cameraLabel] = useState("Main Entrance");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef(false);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setCurrentDate(now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
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
      alert("Unable to access camera. Please check browser permissions and ensure no other application is using it.");
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
      <div className="absolute inset-0 mesh-bg opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-slate-500/5 blur-[120px] pointer-events-none rounded-full" />

      {/* ─── Top HUD Bar ─── */}
      <header className="relative z-30 h-16 border-b border-[var(--border-medium)] px-8 flex items-center justify-between bg-white/95 backdrop-blur-xl shadow-sm">
        {/* Brand info */}
        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-slate-950 border border-slate-800/80 shadow-[0_0_10px_rgba(6,182,212,0.15)] overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)]" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white z-20" />
            <svg viewBox="0 0 100 100" className="w-5.5 h-5.5 relative z-10 animate-fade-in" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" stroke="#1e293b" strokeWidth="2" strokeDasharray="8 12" className="animate-rotate-ring" />
              <circle cx="50" cy="50" r="40" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="30 15" className="animate-rotate-ring-reverse" style={{ opacity: 0.6 }} />
              <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#475569" strokeWidth="2.5" />
              <g className="animate-eye-lid">
                <circle cx="50" cy="50" r="22" fill="#0f172a" stroke="#0891b2" strokeWidth="2" />
                <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
              </g>
              <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="2" className="animate-laser" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-[13.5px] tracking-tight text-slate-800 leading-none">NetraID Kiosk</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <Wifi className="w-2.5 h-2.5 text-emerald-500" />
              <p className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wider">{cameraLabel}</p>
            </div>
          </div>
        </div>

        {/* Clock */}
        <div className="text-center absolute left-1/2 -translate-x-1/2">
          <p className="text-lg font-bold font-mono tracking-tight text-slate-800 leading-none tabular-nums">
            {currentTime || "00:00:00"}
          </p>
          <p className="text-[9.5px] text-slate-500 mt-1 uppercase tracking-wider font-mono">
            {currentDate}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? "Mute audio assistance" : "Enable audio assistance"}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              voiceEnabled
                ? "bg-zinc-950 border-zinc-950 text-white"
                : "bg-slate-100 border-slate-200 text-slate-400"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen toggle"
            className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ─── Main Area ─── */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <canvas ref={canvasRef} className="hidden" />

        {/* Video / Camera frame (Always mounted to prevent null refs) */}
        <div className="w-full max-w-3xl space-y-4 relative">
          
          {/* Pre-start overlay */}
          {!kioskActive && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--bg-base)] text-center p-8 space-y-7 animate-fadeInUp">
              <div className="relative">
                {/* Subtle outer breathing ring */}
                <div className="absolute inset-[-12px] rounded-full bg-zinc-100 border border-zinc-200/60 animate-pulse animate-fade-in" />
                
                {/* Cybernetic blinking/glowing robot eye logo */}
                <div className="relative inline-flex items-center justify-center w-22 h-22 rounded-full bg-slate-950 border border-slate-800/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.25)_0%,transparent_70%)]" />
                  <svg viewBox="0 0 100 100" className="w-12 h-12 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="45" stroke="#1e293b" strokeWidth="2" strokeDasharray="8 12" className="animate-rotate-ring" />
                    <circle cx="50" cy="50" r="40" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="30 15" className="animate-rotate-ring-reverse" style={{ opacity: 0.6 }} />
                    <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#475569" strokeWidth="2.5" />
                    <g className="animate-eye-lid">
                      <circle cx="50" cy="50" r="22" fill="#0f172a" stroke="#0891b2" strokeWidth="2" />
                      <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
                    </g>
                    <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="2" className="animate-laser" />
                  </svg>
                </div>
              </div>

              <div className="space-y-2 max-w-sm">
                <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Kiosk Scanner Offline</h2>
                <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                  Initialize the secure terminal to start the live camera feed and begin biometric attendance recording.
                </p>
              </div>

              <button
                onClick={startKiosk}
                className="btn-primary h-11 px-8 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-md shadow-zinc-950/10 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Scanner Terminal
              </button>
            </div>
          )}

          {/* Camera Frame Frame */}
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-[var(--border-strong)] shadow-lg shadow-slate-200">
            
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
                  <div className="relative w-60 h-60">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-zinc-950 rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-zinc-950 rounded-tr-2xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-zinc-950 rounded-bl-2xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-zinc-950 rounded-br-2xl" />
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-zinc-950 font-mono font-bold tracking-wider uppercase bg-white/95 px-4 py-2 rounded-full border border-zinc-200/80 shadow-sm">
                        {scanFeedback || (scanning ? "Processing..." : "Center Face")}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SUCCESS screen */}
            {kioskActive && scanStatus === "success" && (
              <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-8 text-center animate-fadeInUp">
                <div className="space-y-6 max-w-sm w-full animate-fade-in">
                  {/* Initials Circle */}
                  <div className="relative mx-auto w-24 h-24">
                    {/* Ring animation */}
                    <div className="absolute inset-[-6px] rounded-full border border-emerald-500/30 animate-ping" />
                    {scanResult?.employee?.employee_id && !profileImageError ? (
                      <img
                        src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${scanResult.employee.employee_id}/front.jpg`}
                        alt={scanResult.employee.name}
                        className="w-24 h-24 rounded-full object-cover border border-zinc-200 shadow-lg shadow-zinc-950/20"
                        onError={() => setProfileImageError(true)}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-white font-mono text-3xl font-extrabold shadow-lg shadow-zinc-950/20">
                        {scanResult?.employee?.name
                          ? scanResult.employee.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                          : "PK"}
                      </div>
                    )}
                  </div>

                  {/* Name and Location info */}
                  <div className="space-y-2">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      {scanResult?.employee?.name || "Employee"}
                    </h2>
                    
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-mono uppercase font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{cameraLabel}</span>
                    </div>

                    <p className="text-sm text-slate-700 font-semibold">
                      {scanResult?.employee?.designation || "SDE-1"} ({scanResult?.employee?.employee_id || "int01"})
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="w-12 h-px bg-slate-200 mx-auto" />

                  {/* Real-time Clock & Matched Status */}
                  <div className="space-y-4">
                    <p className="text-2xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
                      {matchTime || "00:00:00 AM"}
                    </p>
                    
                    <div className="flex flex-col items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-1.5 px-4.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-xs font-bold uppercase tracking-wider shadow-sm">
                        <UserCheck className="w-3.5 h-3.5" />
                        Matched
                      </span>
                      {scanResult?.confidence && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          Match: <span className="font-bold text-slate-600">{(scanResult.confidence * 100).toFixed(1)}%</span> · Liveness: <span className="font-bold text-emerald-600">{(scanResult.liveness_score * 100).toFixed(1)}% Real</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SPOOF screen */}
            {kioskActive && scanStatus === "spoof" && (
              <div className="absolute inset-0 bg-red-50/98 flex flex-col items-center justify-center p-8 text-center animate-fadeInUp">
                <div className="relative mb-5">
                  <div className="w-18 h-18 rounded-full bg-rose-500/10 border border-rose-500 flex items-center justify-center">
                    <ShieldAlert className="w-8 h-8 text-rose-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Security Check Failed</h2>
                <p className="text-sm text-rose-600 mt-1 font-semibold">{scanResult?.message}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-4">
                  Liveness Prob: {scanResult?.liveness_score?.toFixed(3)} · Lockout applied
                </p>
              </div>
            )}

            {/* UNKNOWN screen */}
            {kioskActive && scanStatus === "unknown" && (
              <div className="absolute inset-0 bg-amber-50/98 flex flex-col items-center justify-center p-8 text-center animate-fadeInUp">
                <div className="relative mb-5">
                  <div className="w-18 h-18 rounded-full bg-amber-500/10 border border-amber-500 flex items-center justify-center">
                    <HelpCircle className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Unknown Identity</h2>
                <p className="text-xs text-amber-700 mt-1.5 font-medium">{scanResult?.message || "Face not registered on company database."}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-3">
                  Match Score: {scanResult?.confidence?.toFixed(3)}
                </p>
              </div>
            )}

            {/* MAINTENANCE screen */}
            {kioskActive && scanStatus === "maintenance" && (
              <div className="absolute inset-0 bg-zinc-50/98 flex flex-col items-center justify-center p-8 text-center animate-fadeInUp">
                <div className="relative mb-5">
                  <div className="w-18 h-18 rounded-full bg-zinc-950/10 border border-zinc-950 flex items-center justify-center animate-pulse">
                    <ShieldAlert className="w-8 h-8 text-zinc-900" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">System Under Maintenance</h2>
                <p className="text-xs text-zinc-650 mt-1.5 font-semibold max-w-xs leading-relaxed">
                  {scanResult?.message || "Biometric logs and active attendance scans are temporarily suspended."}
                </p>
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 px-4.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-mono text-xs font-bold uppercase tracking-wider shadow-sm">
                    Offline Standby
                  </span>
                </div>
              </div>
            )}

            {/* NO_EMPLOYEES screen */}
            {kioskActive && scanStatus === "no_employees" && (
              <div className="absolute inset-0 bg-amber-50/98 flex flex-col items-center justify-center p-8 text-center animate-fadeInUp">
                <div className="relative mb-5">
                  <div className="w-18 h-18 rounded-full bg-amber-500/10 border border-amber-500 flex items-center justify-center">
                    <UserCheck className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">No Registered Employees</h2>
                <p className="text-sm text-amber-700 mt-2.5 font-semibold max-w-xs leading-relaxed">
                  {scanResult?.message || "Please add the employee"}
                </p>
              </div>
            )}

            {/* Frame Info HUD Overlay */}
            {kioskActive && (
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-slate-500 bg-white/90 border border-slate-200 shadow-sm px-3 py-1.5 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE · {cameraLabel.toUpperCase()}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); stopKiosk(); }}
                  className="pointer-events-auto text-[10px] font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 shadow-sm px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  Disable Camera
                </button>
              </div>
            )}
          </div>

          {/* Active bottom status bar indicators */}
          {kioskActive && (
            <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-slate-500 font-semibold">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-zinc-950 animate-pulse" : "bg-slate-400"}`} />
                <span>{scanning ? "SCANNING..." : "ACTIVE STANDBY"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-zinc-700" />
                <span>Anti-Spoofing Protocol</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-zinc-700" />
                <span>Auto-indexing</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 h-10 border-t border-[var(--border-medium)] flex items-center justify-center bg-white shadow-inner">
        <p className="text-[9.5px] font-mono font-bold text-slate-400 tracking-wider">
          NETRAID SECURE TERMINAL GATEWAY v1.0.0 · MOCKED OFFLINE ENGINE
        </p>
      </footer>
    </div>
  );
}
