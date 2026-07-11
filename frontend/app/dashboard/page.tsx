"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getAccessToken, getBackendUrl, parseDateTime, getLocalDateString, getUserProfile } from "@/app/utils/api";
import { 
  Users, UserCheck, UserMinus, Clock, TrendingUp, Activity,
  ArrowRight, AlertTriangle, CheckCircle, Zap, ShieldAlert,
  Calendar, Award, Server, Cpu, X, Search, Camera, Fingerprint, QrCode, Loader2, Play, Volume2, VolumeX, Shield, Clock as ClockIcon
} from "lucide-react";
import Link from "next/link";
import AttendanceHeatmap from "@/components/AttendanceHeatmap";
import jsQR from "jsqr";

// Pure SVG sparkline helper for premium look
function Sparkline({ color, data }: { color: string; data: number[] }) {
  const width = 90;
  const height = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const colors = {
    blue: "#3b82f6",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    indigo: "#6366f1",
  };
  const strokeColor = colors[color as keyof typeof colors] || "#3b82f6";

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80 shrink-0">
      <defs>
        <linearGradient id={`spark-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 0,${height} L ${points} L ${width},${height} Z`}
        fill={`url(#spark-grad-${color})`}
      />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function StatCard({
  label, value, icon: Icon, color, loading, sublabel, sparkData
}: {
  label: string; value: string | number; icon: any;
  color: "blue" | "emerald" | "amber" | "rose" | "indigo";
  loading?: boolean; sublabel?: string; sparkData: number[];
}) {
  return (
    <div className="bg-white border border-zinc-100 rounded-xl p-4 flex flex-col justify-between h-[125px] transition-all hover:border-zinc-200">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <Icon className="w-3.5 h-3.5 text-slate-405" />
      </div>
      
      <div className="flex items-end justify-between mt-auto">
        <div className="space-y-0.5">
          {loading ? (
            <div className="skeleton h-7 w-16" />
          ) : (
            <p className="text-xl font-bold tracking-tight text-slate-900">{value}</p>
          )}
          {sublabel && <p className="text-[9px] text-slate-400 font-mono">{sublabel}</p>}
        </div>
        {!loading && <Sparkline color={color} data={sparkData} />}
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-zinc-100 text-zinc-800 border-zinc-200/50",
];

function ScanLogItem({ log }: { log: any }) {
  const [imgError, setImgError] = React.useState(false);
  const isSuccess = log.status === "Match Success";
  const isSpoof = log.is_spoof;
  const isUnknown = log.status === "Unknown Person";

  let dotColor = "bg-slate-400";
  let statusColor = "text-zinc-600 bg-zinc-50 border-zinc-100";
  let statusLabel = log.status;

  if (isSuccess) { 
    dotColor = "bg-emerald-500"; 
    statusColor = "text-emerald-700 bg-emerald-50/50 border-emerald-100/55"; 
    statusLabel = "Matched"; 
  } else if (isSpoof) { 
    dotColor = "bg-rose-500 animate-pulse"; 
    statusColor = "text-rose-700 bg-rose-50/50 border-rose-100/55"; 
    statusLabel = "Liveness Failed"; 
  } else if (isUnknown) { 
    dotColor = "bg-amber-500"; 
    statusColor = "text-amber-700 bg-amber-50/50 border-amber-100/55"; 
    statusLabel = "Unknown"; 
  }

  const hasFrontImage = log.employee?.images?.some((img: any) => img.pose_type.toLowerCase() === "front");
  const baseUrl = getBackendUrl().replace("/api/v1", "");

  return (
    <div className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-zinc-50 transition-all duration-150 group">
      <div className="relative shrink-0">
        {log.employee ? (
          hasFrontImage && !imgError ? (
            <img
              src={`${baseUrl}/uploads/${log.employee.employee_id}/front.jpg`}
              alt={log.employee.name}
              className="w-8 h-8 rounded-full object-cover border border-zinc-200/40"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200/40 flex items-center justify-center font-bold text-xs text-zinc-800">
              {log.employee.name.charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-250/30 text-zinc-400 flex items-center justify-center font-bold text-xs">
            ?
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center shadow-xs">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12.5px] font-semibold text-slate-800 truncate">
            {log.employee ? log.employee.name : "Unknown"}
          </p>
          <span className="text-[9px] text-zinc-400 font-mono">· {log.camera}</span>
        </div>
        <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
          {log.employee ? `${log.employee.designation} (${log.employee.employee_id})` : "Unauthorized access attempt"}
        </p>
      </div>

      <div className="shrink-0 text-right space-y-1">
        <p className="text-[9.5px] text-slate-400 font-mono leading-none">
          {parseDateTime(log.timestamp)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || ""}
        </p>
        <span className={`inline-block text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

const getDeptTheme = (code: string) => {
  return { 
    bg: "bg-white border-zinc-100 hover:border-zinc-200 text-slate-900", 
    iconBg: "bg-zinc-50 text-zinc-600 border-zinc-200/50", 
    barBg: "bg-zinc-150", 
    barFill: "bg-zinc-950"
  };
};

// Avatar gradient styles
const avatarColors = [
  "from-blue-50 to-indigo-150 text-blue-600 border-blue-200",
  "from-emerald-50 to-teal-150 text-emerald-600 border-emerald-200",
  "from-rose-50 to-orange-150 text-rose-600 border-rose-200",
  "from-purple-50 to-pink-150 text-purple-600 border-purple-200",
  "from-cyan-50 to-blue-150 text-cyan-600 border-cyan-200",
];

function TeammateAvatar({ emp, size = "md" }: { emp: any; size?: "sm" | "md" }) {
  const [error, setError] = React.useState(false);
  const avatarColor = avatarColors[emp.id % avatarColors.length];
  const hasFrontImage = emp.images?.some((img: any) => img.pose_type.toLowerCase() === "front");
  
  const sizeClasses = {
    sm: "w-8 h-8 text-[10.5px] rounded-lg shrink-0",
    md: "w-10 h-10 text-xs rounded-xl shrink-0",
  };
  const sc = sizeClasses[size];

  if (hasFrontImage && !error) {
    const baseUrl = getBackendUrl().replace("/api/v1", "");
    return (
      <img
        src={`${baseUrl}/uploads/${emp.employee_id}/front.jpg`}
        alt={emp.name}
        className={`${sc} object-cover border border-zinc-200 shadow-sm`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${sc} bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 border font-bold shadow-sm`}>
      {emp.name.charAt(0).toUpperCase()}
    </div>
  );
}

function playLocalBeep(status: string) {
  if (typeof window !== "undefined") {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (status === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1108.73, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(250, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {}
  }
}

function EmployeeDashboardView({ profile }: { profile: any }) {
  const queryClient = useQueryClient();
  const employee = profile?.employee;
  const [cameraActive, setCameraActive] = React.useState(false);
  const [coords, setCoords] = React.useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [scanStatus, setScanStatus] = React.useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanMessage, setScanMessage] = React.useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = React.useState<any>(null);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const scanningRef = React.useRef(false);

  // Watch geolocation
  React.useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      const geoId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => console.error("Employee GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(geoId);
    }
  }, []);

  // Fetch own attendance history
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["employee-history", employee?.id],
    queryFn: () => fetchApi(`/attendance/employee/${employee?.id}`),
    enabled: !!employee?.id
  });

  const startCamera = async () => {
    setScanStatus("scanning");
    setScanMessage("Initializing camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setScanMessage("Camera active. Align face to scan.");

      scanIntervalRef.current = setInterval(captureFrame, 1500);
    } catch (err) {
      setScanStatus("error");
      setScanMessage("Camera access denied. Please grant webcam permissions.");
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setScanStatus("idle");
    setScanMessage(null);
  };

  const captureFrame = async () => {
    if (scanningRef.current || !videoRef.current || !canvasRef.current) return;
    scanningRef.current = true;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState < 2) {
      scanningRef.current = false;
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.85);

    try {
      const payload: any = {
        image: base64,
        camera: "Employee Web Dashboard",
        latitude: coords.latitude,
        longitude: coords.longitude
      };
      
      const res = await fetch(`${getBackendUrl()}/kiosk/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Attendance service unreachable");
      const data = await res.json();

      if (data.status === "success") {
        playLocalBeep("success");
        setScanStatus("success");
        setScanMessage(`Check-in successful: ${data.attendance?.status || "Present"}`);
        setLastScanResult(data);
        queryClient.invalidateQueries({ queryKey: ["employee-history", employee?.id] });
        setTimeout(stopCamera, 3000);
      } else if (data.status === "location_error") {
        playLocalBeep("error");
        setScanStatus("error");
        setScanMessage(data.message || "Location verification failed.");
      } else if (data.status === "unknown" || data.status === "spoof_detected" || data.status === "no_face") {
        // Continue scanning but show feedback
        setScanMessage(data.message || "Verification failed. Retrying...");
      }
    } catch (err: any) {
      setScanMessage("Network or scan service error. Retrying...");
    } finally {
      scanningRef.current = false;
    }
  };

  // Quick calculations
  const todayRecord = history?.find((h: any) => h.date === getLocalDateString());
  const thisMonthPresent = history?.filter((h: any) => ["Present", "Late", "WFH"].includes(h.status)).length || 0;
  const thisMonthHours = history?.reduce((acc: number, cur: any) => acc + (cur.working_hours || 0), 0).toFixed(1) || "0.0";

  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto text-slate-800">
      {/* Welcome Header */}
      <div className="pb-5 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Welcome, {employee?.name || profile?.email}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {employee?.designation || "Staff Member"} &bull; {employee?.department?.name || "General"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold font-mono text-slate-450 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
          <ClockIcon className="w-3.5 h-3.5" />
          <span>Shift: {employee?.shift?.name || "Regular Shift"} ({employee?.shift?.start_time || "09:00"} - {employee?.shift?.end_time || "17:00"})</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Attendance Scanner & Quick Stats */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Geolocation Lock Warning */}
          {coords.latitude === null && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-2.5 text-[11px] font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 animate-bounce" />
              <span>
                <strong>GPS Coordinates Missing:</strong> Please enable location services/GPS permission in your browser to check in.
              </span>
            </div>
          )}

          {/* Premium Embedded Scanner Box */}
          <div className="glass-card border border-slate-200 rounded-2xl overflow-hidden shadow-xs p-6 bg-white flex flex-col items-center justify-center min-h-[320px] relative">
            <canvas ref={canvasRef} className="hidden" />
            
            {cameraActive ? (
              <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-250 bg-slate-950 aspect-video relative group shadow-inner">
                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
                
                {/* Glowing Scanning Reticle overlay */}
                <div className="absolute inset-0 border-[2px] border-cyan-400/30 m-6 pointer-events-none rounded-lg flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute animate-laser" />
                </div>

                <button 
                  onClick={stopCamera} 
                  className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-[10px] font-extrabold cursor-pointer transition-all uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-2xs group-hover:scale-105 transition-all">
                  <Camera className="w-8 h-8 text-slate-450" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Mark Your Attendance</h3>
                  <p className="text-xs text-slate-450 max-w-xs leading-normal">
                    Secure check-in and check-out via automatic facial alignment and GPS geofence locking.
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  disabled={coords.latitude === null}
                  className={`px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer ${
                    coords.latitude === null 
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  Start Biometric Verification
                </button>
              </div>
            )}

            {/* Scan Feedback Banner */}
            {scanMessage && (
              <div className={`mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-center border animate-fadeInUp flex items-center gap-2 ${
                scanStatus === "success" 
                  ? "bg-emerald-50 border-emerald-250 text-emerald-700" 
                  : scanStatus === "error" 
                    ? "bg-rose-50 border-rose-250 text-rose-700" 
                    : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                {scanStatus === "scanning" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {scanStatus === "success" && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                {scanStatus === "error" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                <span>{scanMessage}</span>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Status</span>
              <p className="text-base font-bold text-slate-800 mt-1">
                {todayRecord ? (
                  <span className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded border ${
                    todayRecord.status === "Present" 
                      ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                      : todayRecord.status === "Late" 
                        ? "bg-amber-50 border-amber-150 text-amber-700" 
                        : "bg-blue-50 border-blue-150 text-blue-700"
                  }`}>
                    {todayRecord.status} ({todayRecord.check_in ? new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"})
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs font-semibold">Not Checked In</span>
                )}
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Days Present (Month)</span>
              <p className="text-xl font-extrabold text-slate-900">{thisMonthPresent} Days</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hours Logged (Month)</span>
              <p className="text-xl font-extrabold text-slate-900">{thisMonthHours} hrs</p>
            </div>
          </div>

        </div>

        {/* History Logs Table */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs h-full flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Attendance Logs</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingHistory ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50">
                    <div className="space-y-1.5 flex-1">
                      <div className="skeleton h-3 w-28" />
                      <div className="skeleton h-2 w-20" />
                    </div>
                    <div className="skeleton h-5 w-14 rounded-lg" />
                  </div>
                ))
              ) : history && history.length > 0 ? (
                history.map((record: any) => {
                  const checkInTime = record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                  const checkOutTime = record.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                  return (
                    <div key={record.id} className="flex justify-between items-center py-2.5 border-b border-slate-100 hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          {new Date(record.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          In: {checkInTime} &bull; Out: {checkOutTime}
                        </p>
                      </div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold ${
                        record.status === "Present"
                          ? "bg-emerald-50 border-emerald-150 text-emerald-700"
                          : record.status === "Late"
                            ? "bg-amber-50 border-amber-150 text-amber-700"
                            : record.status === "WFH"
                              ? "bg-blue-50 border-blue-150 text-blue-700"
                              : "bg-rose-50 border-rose-150 text-rose-700"
                      }`}>
                        {record.status}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-center py-12 text-slate-400 text-xs font-medium">
                  No attendance records found for this period.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DashboardPage() {
  const profile = getUserProfile();
  const isEmployee = profile?.role?.name === "Employee";

  if (isEmployee) {
    return (
      <SidebarLayout>
        <EmployeeDashboardView profile={profile} />
      </SidebarLayout>
    );
  }

  const [currentTime, setCurrentTime] = React.useState("");
  const [currentDate, setCurrentDate] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "MATCHED" | "UNKNOWN" | "SPOOF">("ALL");
  const [selectedDept, setSelectedDept] = React.useState<any | null>(null);
  const [isDark, setIsDark] = React.useState(false);
  const queryClient = useQueryClient();

  // Presence Board states
  const [presenceSearch, setPresenceSearch] = React.useState("");
  const [presenceFilter, setPresenceFilter] = React.useState<"ALL" | "IN_OFFICE" | "ABSENT" | "CHECKED_OUT">("ALL");
  const [showManualModal, setShowManualModal] = React.useState(false);
  const [selectedEmpManual, setSelectedEmpManual] = React.useState<any | null>(null);
  const [manualTime, setManualTime] = React.useState("");
  const [manualStatus, setManualStatus] = React.useState<"Present" | "Late" | "Half Day" | "Absent">("Present");
  const [manualIsLoading, setManualIsLoading] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    return () => observer.disconnect();
  }, []);

  const { data: deptAttendance, isLoading: loadingDeptAttendance } = useQuery({
    queryKey: ["dept-attendance", selectedDept?.id],
    queryFn: () => {
      if (!selectedDept) return [];
      const todayStr = getLocalDateString();
      return fetchApi(`/attendance/daily?department_id=${selectedDept.id}&date_val=${todayStr}`);
    },
    enabled: !!selectedDept
  });

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const backendUrl = getBackendUrl();
    const sseUrl = `${backendUrl}/analytics/live-stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data);
        
        // 1. Prepend the new log to the "recent-activity" list
        queryClient.setQueryData(["recent-activity"], (oldData: any[] | undefined) => {
          if (!oldData) return [newLog];
          const filtered = oldData.filter((log: any) => log.id !== newLog.id);
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          return [newLog, ...filtered]
            .filter((log: any) => {
              const logDate = parseDateTime(log.timestamp);
              return logDate ? logDate.getTime() >= cutoff : false;
            })
            .slice(0, 10);
        });

        // 2. Invalidate other dashboard stats to trigger refetch
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["department-distribution"] });
        queryClient.invalidateQueries({ queryKey: ["attendance-trends"] });
        queryClient.invalidateQueries({ queryKey: ["daily-attendance-today"] });
      } catch (err) {
        console.error("Error handling SSE message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchApi("/analytics/dashboard-summary"),
    refetchInterval: 60000
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ["attendance-trends"],
    queryFn: () => fetchApi("/analytics/attendance-trends?days=7")
  });

  const { data: deptStats, isLoading: loadingDept } = useQuery({
    queryKey: ["department-distribution"],
    queryFn: () => fetchApi("/analytics/department-distribution")
  });

  const { data: recentLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: () => fetchApi("/analytics/recent-activity?limit=6"),
    refetchInterval: 60000
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-all"],
    queryFn: () => fetchApi("/employees/")
  });

  const todayStr = getLocalDateString();
  const { data: dailyAttendance, isLoading: loadingDaily } = useQuery({
    queryKey: ["daily-attendance-today"],
    queryFn: () => fetchApi(`/attendance/daily?date_val=${todayStr}`),
    refetchInterval: 15000
  });

  const mergedEmployees = React.useMemo(() => {
    if (!employees) return [];
    return employees.map((emp: any) => {
      const att = dailyAttendance?.find((a: any) => a.employee_id === emp.id);
      return {
        ...emp,
        todayAttendance: att || null
      };
    });
  }, [employees, dailyAttendance]);

  const filteredTeammates = React.useMemo(() => {
    return mergedEmployees.filter((emp: any) => {
      const matchesSearch = emp.name.toLowerCase().includes(presenceSearch.toLowerCase()) || 
        (emp.designation && emp.designation.toLowerCase().includes(presenceSearch.toLowerCase()));
      
      if (!matchesSearch) return false;

      const att = emp.todayAttendance;
      const isAbsent = !att || att.status === "Absent";
      const isCheckedOut = att && att.check_out;
      const isInOffice = att && !isCheckedOut && ["Present", "Late", "Half Day"].includes(att.status);

      if (presenceFilter === "ALL") return true;
      if (presenceFilter === "IN_OFFICE") return isInOffice;
      if (presenceFilter === "ABSENT") return isAbsent;
      if (presenceFilter === "CHECKED_OUT") return isCheckedOut;

      return true;
    });
  }, [mergedEmployees, presenceSearch, presenceFilter]);

  const openClockIn = (emp: any) => {
    setSelectedEmpManual(emp);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setManualTime(`${hh}:${mm}`);
    setManualStatus(emp.todayAttendance?.status || "Present");
    setShowManualModal(true);
  };

  const handleClockOut = async (emp: any) => {
    if (!emp.todayAttendance) return;
    setManualIsLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const localISO = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

      const payload = {
        employee_id: emp.id,
        date: todayStr,
        check_in: emp.todayAttendance.check_in,
        check_out: localISO,
        status: emp.todayAttendance.status
      };
      
      await fetchApi("/attendance/manual", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      queryClient.invalidateQueries({ queryKey: ["daily-attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
    } catch (err: any) {
      alert(err.message || "Failed to clock out employee.");
    } finally {
      setManualIsLoading(false);
    }
  };

  const handleClockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpManual) return;
    setManualIsLoading(true);
    try {
      const now = new Date();
      const [hh, mm] = manualTime.split(":");
      const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hh), parseInt(mm));
      
      const year = checkInDate.getFullYear();
      const month = String(checkInDate.getMonth() + 1).padStart(2, "0");
      const day = String(checkInDate.getDate()).padStart(2, "0");
      const hours = String(checkInDate.getHours()).padStart(2, "0");
      const minutes = String(checkInDate.getMinutes()).padStart(2, "0");
      const seconds = "00";
      const checkInISO = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

      const payload = {
        employee_id: selectedEmpManual.id,
        date: todayStr,
        check_in: checkInISO,
        check_out: selectedEmpManual.todayAttendance?.check_out || null,
        status: manualStatus
      };
      
      await fetchApi("/attendance/manual", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      queryClient.invalidateQueries({ queryKey: ["daily-attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      setShowManualModal(false);
      setSelectedEmpManual(null);
    } catch (err: any) {
      alert(err.message || "Failed to clock in employee.");
    } finally {
      setManualIsLoading(false);
    }
  };

  // Map real database trends to the card sparklines
  const trendsLoaded = trends && trends.length > 0;

  const staffSpark = trendsLoaded 
    ? trends.map(() => summary?.total_employees || 0)
    : [0, 0, 0, 0, 0, 0, summary?.total_employees || 0];

  const presentSpark = trendsLoaded
    ? trends.map((t: any) => t.present)
    : [0, 0, 0, 0, 0, 0, summary?.present_today || 0];

  const lateSpark = trendsLoaded
    ? trends.map((t: any) => t.late)
    : [0, 0, 0, 0, 0, 0, summary?.late_today || 0];

  const absentSpark = trendsLoaded
    ? trends.map((t: any) => Math.max(0, (summary?.total_employees || 0) - t.present))
    : [0, 0, 0, 0, 0, 0, summary?.absent_today || 0];

  const rateSpark = trendsLoaded
    ? trends.map((t: any) => Math.round((t.present / (summary?.total_employees || 1)) * 100))
    : [0, 0, 0, 0, 0, 0, summary?.attendance_percentage || 0];

  const trendOption = () => {
    if (!trends) return {};
    const labelColor = isDark ? "#a1a1aa" : "#71717a";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(24,24,27,0.06)";
    const lineColor = isDark ? "#ffffff" : "#18181b";
    const areaColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(24,24,27,0.06)";
    const barColor = isDark ? "#52525b" : "#71717a";
    const tooltipBg = isDark ? "#18181b" : "#ffffff";
    const tooltipColor = isDark ? "#f4f4f5" : "#18181b";
    const tooltipBorder = isDark ? "#27272a" : "rgba(24,24,27,0.08)";

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        shadowColor: "rgba(0,0,0,0.02)",
        shadowBlur: 10,
        textStyle: { color: tooltipColor, fontSize: 11, fontFamily: "var(--font-inter)" },
        extraCssText: "border-radius:12px;padding:8px 12px;box-shadow: 0 4px 16px rgba(0,0,0,0.04);"
      },
      legend: {
        data: ["Present", "Late Arrivals"],
        textStyle: { color: labelColor, fontSize: 10, fontFamily: "var(--font-inter)" },
        bottom: 0, 
        icon: "circle", 
        itemWidth: 8, 
        itemHeight: 8, 
        itemGap: 24
      },
      grid: { top: 20, left: 36, right: 16, bottom: 40 },
      xAxis: {
        type: "category",
        data: trends.map((t: any) => {
          const parts = t.date.split("-");
          let d;
          if (parts.length === 3) {
            d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            d = new Date(t.date);
          }
          return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
        }),
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 10, fontFamily: "var(--font-inter)" }
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
        axisLabel: { color: labelColor, fontSize: 10, fontFamily: "var(--font-inter)" },
        axisLine: { show: false }
      },
      series: [
        {
          name: "Present",
          type: "line",
          smooth: 0.35,
          showSymbol: false,
          symbolSize: 6,
          data: trends.map((t: any) => t.present),
          lineStyle: { 
            color: lineColor, 
            width: 2.25,
            shadowColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(24,24,27,0.1)",
            shadowBlur: 8,
            shadowOffsetY: 4
          },
          itemStyle: { color: lineColor },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: areaColor },
                { offset: 1, color: "rgba(24,24,27,0)" }
              ]
            }
          }
        },
        {
          name: "Late Arrivals",
          type: "bar",
          data: trends.map((t: any) => t.late),
          itemStyle: { 
            color: barColor, 
            borderRadius: [3, 3, 0, 0] 
          },
          barWidth: 6,
          barMaxWidth: 10
        }
      ]
    };
  };

  const deptOption = () => {
    if (!deptStats) return {};
    const labelColor = isDark ? "#a1a1aa" : "#71717a";
    const textPrimary = isDark ? "#f4f4f5" : "#18181b";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(24,24,27,0.04)";
    const totalBarColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(24,24,27,0.04)";
    const fillStart = isDark ? "#ffffff" : "#18181b";
    const fillEnd = isDark ? "#d4d4d8" : "#27272a";
    const tooltipBg = isDark ? "#18181b" : "#ffffff";
    const tooltipColor = isDark ? "#f4f4f5" : "#18181b";
    const tooltipBorder = isDark ? "#27272a" : "rgba(24,24,27,0.08)";

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        textStyle: { color: tooltipColor, fontSize: 11 },
        extraCssText: "border-radius:12px;padding:8px 12px;box-shadow: 0 4px 16px rgba(0,0,0,0.04);"
      },
      grid: { top: 10, left: 90, right: 20, bottom: 20 },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
        axisLabel: { color: labelColor, fontSize: 9 },
        axisLine: { show: false }
      },
      yAxis: {
        type: "category",
        data: deptStats.map((d: any) => d.name || d.code),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: textPrimary, fontSize: 10, fontFamily: "var(--font-inter)" }
      },
      series: [
        {
          name: "Total Employees",
          type: "bar",
          data: deptStats.map((d: any) => d.total_employees),
          itemStyle: { color: totalBarColor, borderRadius: [0, 4, 4, 0] },
          barGap: "-100%",
          barWidth: 10
        },
        {
          name: "Present Today",
          type: "bar",
          data: deptStats.map((d: any) => d.present_today),
          barWidth: 10,
          itemStyle: { 
            borderRadius: [0, 4, 4, 0],
            color: {
              type: "linear", x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: fillStart },
                { offset: 1, color: fillEnd }
              ]
            }
          }
        }
      ]
    };
  };
  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Dashboard
            </h1>
            <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 uppercase font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Feed Active</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>{currentDate}</span>
            {currentTime && (
              <>
                <span className="text-zinc-200">|</span>
                <span className="tabular-nums text-slate-800 font-medium">{currentTime}</span>
              </>
            )}
          </div>
        </div>

        {/* ─── KPI Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Staff" value={loadingSummary ? "—" : summary?.total_employees} icon={Users} color="blue" loading={loadingSummary} sublabel="Registered" sparkData={staffSpark} />
          <StatCard label="Present Today" value={loadingSummary ? "—" : summary?.present_today} icon={UserCheck} color="emerald" loading={loadingSummary} sublabel="Clocked in" sparkData={presentSpark} />
          <StatCard label="Late Arrivals" value={loadingSummary ? "—" : summary?.late_today} icon={Clock} color="amber" loading={loadingSummary} sublabel="Grace exceeded" sparkData={lateSpark} />
          <StatCard label="Absent Today" value={loadingSummary ? "—" : summary?.absent_today} icon={UserMinus} color="rose" loading={loadingSummary} sublabel="Unexcused" sparkData={absentSpark} />
          <StatCard label="Attendance Rate" value={loadingSummary ? "—" : `${summary?.attendance_percentage}%`} icon={TrendingUp} color="indigo" loading={loadingSummary} sublabel="Rate today" sparkData={rateSpark} />
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Trend Chart */}
          <div className="lg:col-span-3 bg-white border border-zinc-100 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Attendance Trends</h2>
            </div>
            <div className="h-56">
              {loadingTrends ? (
                <div className="h-full flex items-center justify-center">
                  <div className="skeleton w-full h-full rounded-xl" />
                </div>
              ) : (
                <ReactECharts option={trendOption()} style={{ height: "100%", width: "100%" }} />
              )}
            </div>
          </div>

          {/* Live Feed */}
          <div className="lg:col-span-2 bg-white border border-zinc-100 rounded-xl flex flex-col">
            <div className="p-5 pb-3 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Live Activity</h2>
                <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded text-[9px] text-zinc-500 font-mono tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span>STREAMING</span>
                </div>
              </div>
              
              {/* Status Filter pills */}
              <div className="flex flex-wrap gap-1 mt-2.5">
                {(["ALL", "MATCHED", "UNKNOWN", "SPOOF"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide transition-all border cursor-pointer uppercase font-mono ${
                      statusFilter === filter
                        ? "bg-zinc-950 border-zinc-950 text-white"
                        : "bg-transparent border-zinc-100 text-slate-400 hover:text-slate-700 hover:border-zinc-200"
                    }`}
                  >
                    {filter === "SPOOF" ? "Liveness Failed" : filter.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-1 max-h-[240px]">
              {loadingLogs ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3.5 py-3 px-3.5">
                    <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-32" />
                      <div className="skeleton h-2.5 w-24" />
                    </div>
                  </div>
                ))
              ) : (() => {
                const filtered = recentLogs?.filter((log: any) => {
                  if (statusFilter === "ALL") return true;
                  if (statusFilter === "MATCHED") return log.status === "Match Success";
                  if (statusFilter === "UNKNOWN") return log.status === "Unknown Person";
                  if (statusFilter === "SPOOF") return log.is_spoof || log.status === "Spoof Rejected" || log.status === "Spoof Blocked";
                  return true;
                });

                if (!filtered || filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center space-y-2">
                      <Zap className="w-8 h-8 opacity-25 text-slate-400" />
                      <p className="font-semibold text-slate-400">No events</p>
                      <p className="text-[10px] text-slate-600 max-w-[160px]">No recent events matching this filter.</p>
                    </div>
                  );
                }

                return filtered.map((log: any) => (
                  <ScanLogItem key={log.id} log={log} />
                ));
              })()}
            </div>

            <div className="p-3 border-t border-zinc-100 bg-zinc-55/30">
              <Link
                href="/attendance"
                className="flex items-center justify-between text-[11px] text-zinc-500 hover:text-zinc-900 font-semibold transition-colors group"
              >
                <span>Access Complete Ledger Logs</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Team Presence Board ("Who's In Today") ─── */}
        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Who's In Today</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Real-time team presence tracking and manual adjustments</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Teammate */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search team member..."
                  value={presenceSearch}
                  onChange={(e) => setPresenceSearch(e.target.value)}
                  className="pl-8.5 pr-4 py-1.5 text-xs bg-zinc-50 border border-zinc-100 rounded-xl focus:border-zinc-350 focus:bg-white text-zinc-800 transition-all outline-none placeholder-zinc-400 w-full sm:w-48"
                />
              </div>
              
              {/* Status Filters */}
              <div className="flex bg-zinc-50 border border-zinc-100 p-0.5 rounded-xl text-[10px] font-semibold text-zinc-400">
                {(["ALL", "IN_OFFICE", "ABSENT", "CHECKED_OUT"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPresenceFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg transition-all font-bold tracking-wide uppercase font-mono ${
                      presenceFilter === filter
                        ? "bg-white text-slate-900 shadow-xs border border-zinc-150/40 cursor-pointer"
                        : "bg-transparent hover:text-slate-700 cursor-pointer"
                    }`}
                  >
                    {filter === "IN_OFFICE" ? "In Office" : filter === "CHECKED_OUT" ? "Checked Out" : filter.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Employee Presence Grid */}
          {loadingEmployees || loadingDaily ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {filteredTeammates.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-zinc-100 rounded-xl text-zinc-400 text-xs">
                  No teammates match the active filters or search terms.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTeammates.map((member: any) => {
                    const att = member.todayAttendance;
                    const isAbsent = !att || att.status === "Absent";
                    const isCheckedOut = att && att.check_out;
                    const isInOffice = att && !isCheckedOut && ["Present", "Late", "Half Day"].includes(att.status);

                    let statusText = "Absent";
                    let badgeColor = "bg-zinc-100 text-zinc-500 border-zinc-200/50";
                    
                    if (isInOffice) {
                      const checkInTime = parseDateTime(att.check_in)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";
                      statusText = `In at ${checkInTime}`;
                      badgeColor = att.status === "Late"
                        ? "bg-amber-50 text-amber-700 border-amber-100"
                        : "bg-emerald-50 text-emerald-700 border-emerald-100";
                    } else if (isCheckedOut) {
                      const checkOutTime = parseDateTime(att.check_out)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";
                      statusText = `Out at ${checkOutTime}`;
                      badgeColor = "bg-slate-50 text-slate-655 border-slate-100";
                    }

                    return (
                      <div
                        key={member.id}
                        className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between h-[125px] ${
                          isAbsent 
                            ? "bg-zinc-50/30 border-zinc-100 hover:border-zinc-200" 
                            : "bg-white border-zinc-100 hover:border-zinc-250 shadow-xs"
                        }`}
                      >
                        {/* Member Row */}
                        <div className="flex gap-2.5 items-start">
                          <div className="relative shrink-0">
                            <TeammateAvatar emp={member} size="sm" />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white flex items-center justify-center shadow-xs ${
                              isInOffice ? "bg-emerald-500" : isCheckedOut ? "bg-slate-400" : "bg-rose-450"
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-bold text-slate-800 truncate" title={member.name}>
                              {member.name}
                            </h3>
                            <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                              {member.designation}
                            </p>
                            {member.department && (
                              <span className="inline-block mt-1 text-[8px] font-bold font-mono px-1 rounded bg-zinc-50 text-zinc-500 border border-zinc-100/60 uppercase">
                                {member.department.code}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status + Action buttons */}
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-50">
                          <span className={`inline-block text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${badgeColor}`}>
                            {statusText}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isAbsent && (
                              <button
                                onClick={() => openClockIn(member)}
                                disabled={manualIsLoading}
                                className="px-2 py-1 text-[9px] font-bold font-mono bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer"
                              >
                                Clock In
                              </button>
                            )}
                            {isInOffice && (
                              <button
                                onClick={() => handleClockOut(member)}
                                disabled={manualIsLoading}
                                className="px-2 py-1 text-[9px] font-bold font-mono border border-zinc-200 hover:border-zinc-400 text-slate-650 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                              >
                                Clock Out
                              </button>
                            )}
                            {(isCheckedOut || !isAbsent) && (
                              <button
                                onClick={() => openClockIn(member)}
                                disabled={manualIsLoading}
                                className="p-1 border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Edit log"
                              >
                                <Activity className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Attendance Heatmap ─── */}
        <AttendanceHeatmap />

        {/* ─── Bottom Section: Department Breakdown ─── */}
        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Departments</h2>
          </div>
          
          <div className="min-h-36">
            {loadingDept ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-32 w-full rounded-2xl" />
                ))}
              </div>
            ) : !deptStats || deptStats.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No department stats found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {deptStats.map((d: any) => {
                  const percent = d.total_employees > 0 
                    ? Math.round((d.present_today / d.total_employees) * 100) 
                    : 0;

                  return (
                    <div 
                      key={d.code}
                      onClick={() => setSelectedDept(d)}
                      className="p-4 rounded-xl border border-zinc-100 bg-white hover:border-zinc-300 transition-all duration-200 flex flex-col justify-between h-28 cursor-pointer group"
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-650 border border-zinc-100 uppercase tracking-wider">
                          {d.code}
                        </span>
                        
                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-800">
                            {d.present_today} <span className="text-slate-450 font-normal">/ {d.total_employees}</span>
                          </span>
                        </div>
                      </div>

                      {/* Department Name & Subheading */}
                      <div className="mt-1.5 flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-slate-800 truncate" title={d.department}>
                          {d.department}
                        </h3>
                        <p className="text-[9.5px] text-slate-450 font-mono mt-0.5">
                          {percent}% present
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2 w-full">
                        <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-zinc-950 rounded-full transition-all duration-500 group-hover:bg-zinc-800"
                            style={{ width: `${d.total_employees > 0 ? percent : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department Detail Modal */}
      {selectedDept && (
        <div className="modal-backdrop z-50">
          <div className="modal-content max-w-2xl bg-white border border-zinc-200 text-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-zinc-100">
              <div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 uppercase tracking-wider">
                  {selectedDept.code} Department
                </span>
                <h3 className="text-base font-bold text-zinc-900 mt-1.5">
                  {selectedDept.department}
                </h3>
                <p className="text-[10.5px] text-zinc-500 font-mono mt-0.5">
                  {selectedDept.present_today} Present / {selectedDept.total_employees} Total Employees Today
                </p>
              </div>
              <button 
                onClick={() => setSelectedDept(null)} 
                className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-650 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[350px] pr-1 space-y-2">
              {loadingDeptAttendance ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-3">
                    <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3.5 w-28" />
                      <div className="skeleton h-2.5 w-16" />
                    </div>
                  </div>
                ))
              ) : !deptAttendance || deptAttendance.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs font-mono">
                  No attendance records found for this department today.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {deptAttendance.map((rec: any) => {
                    const avatarColor = AVATAR_COLORS[rec.employee.id % AVATAR_COLORS.length];
                    return (
                      <div key={rec.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 border font-bold text-[10.5px] shadow-sm`}>
                            {rec.employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-zinc-900">{rec.employee.name}</p>
                            <p className="text-[9.5px] text-zinc-500 font-mono mt-0.5">{rec.employee.employee_id} · {rec.employee.designation}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-605 font-mono leading-none">
                              IN: {rec.check_in ? parseDateTime(rec.check_in)?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "—"}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-mono mt-1 leading-none">
                              OUT: {rec.check_out ? parseDateTime(rec.check_out)?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "—"}
                            </p>
                          </div>
                          <span className={`inline-block text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            rec.status === "Present" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                            rec.status === "Late" ? "bg-amber-50 border-amber-200 text-amber-800" :
                            rec.status === "Half Day" ? "bg-indigo-50 border-indigo-200 text-indigo-800" :
                            "bg-rose-55 border-rose-200 text-rose-800"
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Manual Clock-in Modal ─── */}
      {showManualModal && selectedEmpManual && (
        <div className="modal-backdrop z-50">
          <div className="modal-content max-w-sm bg-white border border-zinc-200 text-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">
                Manual Clock In / Override
              </h3>
              <button 
                onClick={() => {
                  setShowManualModal(false);
                  setSelectedEmpManual(null);
                }} 
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-650 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClockInSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 font-medium">Employee</p>
                <div className="flex items-center gap-2 mt-1.5 p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
                  <TeammateAvatar emp={selectedEmpManual} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{selectedEmpManual.name}</p>
                    <p className="text-[10px] text-slate-450 truncate">{selectedEmpManual.designation}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Check-in Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="input-field h-9.5 text-xs bg-white border-zinc-200 focus:border-zinc-800 text-zinc-900 rounded-xl transition-all w-full"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Present", "Late", "Half Day"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setManualStatus(status)}
                      className={`py-1.5 text-[10.5px] font-semibold border rounded-lg transition-all cursor-pointer ${
                        manualStatus === status
                          ? "bg-zinc-950 border-zinc-950 text-white"
                          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualModal(false);
                    setSelectedEmpManual(null);
                  }}
                  className="btn-ghost text-xs px-3.5 py-2 rounded-xl cursor-pointer hover:bg-zinc-100 text-zinc-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualIsLoading}
                  className="px-4 py-2 text-xs bg-zinc-950 hover:bg-zinc-850 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {manualIsLoading && <span className="animate-spin text-white">⌛</span>}
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
