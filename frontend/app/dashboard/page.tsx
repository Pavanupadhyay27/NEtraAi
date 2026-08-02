"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getAccessToken, getBackendUrl, parseDateTime, getLocalDateString, getUserProfile } from "@/app/utils/api";
import { 
  Users, UserCheck, UserMinus, Clock, TrendingUp, Activity,
  ArrowRight, AlertTriangle, CheckCircle, Zap, ShieldAlert,
  Calendar, Award, Server, Cpu, X, Search, Camera, Fingerprint, QrCode, Loader2, Play, Volume2, VolumeX, Shield, Clock as ClockIcon,
  Building2, Monitor, Mail, Plus, History as HistoryIcon, LogIn, LogOut, MapPin, ChevronLeft, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AttendanceHeatmap from "@/components/AttendanceHeatmap";
import jsQR from "jsqr";
import { useToast } from "@/app/utils/toast";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDateDMY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Pure SVG sparkline helper for premium look
function Sparkline({ data }: { color: string; data: number[] }) {
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

  return (
    <svg width={width} height={height} className="overflow-visible opacity-70 shrink-0 text-zinc-500 dark:text-zinc-400">
      <polyline
        fill="none"
        stroke="currentColor"
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
    <div className="tech-card-3d p-4 flex flex-col justify-between h-[125px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{label}</p>
        <Icon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
      </div>
      
      <div className="flex items-end justify-between mt-auto">
        <div className="space-y-0.5">
          {loading ? (
            <div className="skeleton h-7 w-16" />
          ) : (
            <p className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
          )}
          {sublabel && <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">{sublabel}</p>}
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
  const { toast } = useToast();
  const employee = profile?.employee;
  const isHR = profile?.role?.name === "Admin" || profile?.role?.name === "HR" || profile?.role?.name === "Super Admin";
  const [cameraActive, setCameraActive] = React.useState(false);
  const [coords, setCoords] = React.useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [scanStatus, setScanStatus] = React.useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanMessage, setScanMessage] = React.useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = React.useState<any>(null);
  const [faceBbox, setFaceBbox] = React.useState<number[] | null>(null);
  const [profileImageError, setProfileImageError] = React.useState(false);
  const [matchTime, setMatchTime] = React.useState("");

  const [showDummyScanner, setShowDummyScanner] = React.useState(false);
  const [dummyScanStatus, setDummyScanStatus] = React.useState<"idle" | "scanning" | "success" | "error">("idle");
  const [dummyScanMessage, setDummyScanMessage] = React.useState<string | null>(null);

  const startDummyScan = () => {
    setShowDummyScanner(true);
    setDummyScanStatus("scanning");
    setDummyScanMessage("Acquiring secure location & biometric check...");

    const performDummyCheckin = async (lat: number | null, lng: number | null) => {
      setDummyScanMessage("Verifying location automatically...");
      try {
        const res = await fetch(`${getBackendUrl()}/kiosk/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dummy: true,
            employee_id: employee?.id,
            latitude: lat,
            longitude: lng,
            camera: "Employee Web Dashboard (Biometric)"
          })
        });

        if (!res.ok) throw new Error("Attendance service unreachable");
        const data = await res.json();

        if (data.status === "success") {
          playLocalBeep("success");
          setDummyScanStatus("success");
          setDummyScanMessage(`Check-in successful: ${data.attendance?.status || "Present"}`);
          queryClient.invalidateQueries({ queryKey: ["employee-history", employee?.id] });
          setTimeout(() => setShowDummyScanner(false), 2500);
        } else if (data.status === "location_error") {
          playLocalBeep("error");
          setDummyScanStatus("error");
          setDummyScanMessage(`${data.message || "Location verification failed."} Opening Real Face Kiosk Scanner...`);
          setTimeout(() => {
            setShowDummyScanner(false);
            startCamera(); // fallback to real face kiosk
          }, 3000);
        } else {
          setDummyScanStatus("error");
          setDummyScanMessage(data.message || "Biometric verification failed.");
        }
      } catch (err: any) {
        setDummyScanStatus("error");
        setDummyScanMessage("Verification error. Opening Real Face Kiosk Scanner...");
        setTimeout(() => {
          setShowDummyScanner(false);
          startCamera(); // fallback to real face kiosk
        }, 3000);
      }
    };

    // Simulate scanning delay for 2 seconds
    setTimeout(() => {
      if (coords.latitude !== null && coords.longitude !== null) {
        performDummyCheckin(coords.latitude, coords.longitude);
      } else {
        if (typeof window !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setCoords(newCoords);
              performDummyCheckin(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
              console.error("Location retrieval failed:", err);
              performDummyCheckin(null, null);
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        } else {
          performDummyCheckin(null, null);
        }
      }
    }, 2000);
  };
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const scanningRef = React.useRef(false);

  // Tab State
  const [activeTab, setActiveTab] = React.useState("dashboard");

  React.useEffect(() => {
    const handleUpdate = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab") || "dashboard";
        if (tab !== activeTab) {
          setActiveTab(tab);
        }
      }
    };
    handleUpdate();
    const interval = setInterval(handleUpdate, 200);
    window.addEventListener("popstate", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("popstate", handleUpdate);
    };
  }, [activeTab]);

  // Leave Form States
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [selectedLeaveDetail, setSelectedLeaveDetail] = React.useState<any>(null);
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState<string>("ALL");
  const [leaveStatusFilter, setLeaveStatusFilter] = React.useState<string>("ALL");
  const [leaveStartDate, setLeaveStartDate] = React.useState("");
  const [leaveEndDate, setLeaveEndDate] = React.useState("");
  const [leaveType, setLeaveType] = React.useState("Sick");
  const [leaveReason, setLeaveReason] = React.useState("");
  const [submittingLeave, setSubmittingLeave] = React.useState(false);
  const [leaveError, setLeaveError] = React.useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = React.useState("");
  const [isHalfDay, setIsHalfDay] = React.useState(false);
  const [session, setSession] = React.useState("First Half");
  const [leaveContact, setLeaveContact] = React.useState("");

  // Custom Date Picker states
  const [activePicker, setActivePicker] = React.useState<"start" | "end" | null>(null);
  const [pickerCurrentDate, setPickerCurrentDate] = React.useState(new Date());

  // Leave Limit States
  const [leaveLimits, setLeaveLimits] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("netraid_leave_limits");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return {
      Sick: 3,
      Casual: 4,
      Annual: 8,
      Unpaid: "Limitless"
    };
  });

  const handleUpdateLimit = (type: "Sick" | "Casual" | "Annual" | "Unpaid", value: string) => {
    const newLimits = { ...leaveLimits, [type]: value === "Limitless" ? "Limitless" : parseInt(value) || 0 };
    setLeaveLimits(newLimits);
    if (typeof window !== "undefined") {
      localStorage.setItem("netraid_leave_limits", JSON.stringify(newLimits));
    }
  };

  const getDaysBetween = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

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

  const [selectedLedgerRecord, setSelectedLedgerRecord] = React.useState<any>(null);

  // Set default selected record once history loads
  React.useEffect(() => {
    if (history && history.length > 0 && !selectedLedgerRecord) {
      const todayRec = history.find((h: any) => h.date === getLocalDateString());
      setSelectedLedgerRecord(todayRec || history[0]);
    }
  }, [history]);

  // Fetch own raw scan logs
  const { data: rawLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["employee-raw-logs", employee?.id],
    queryFn: () => fetchApi(`/attendance/logs?employee_id=${employee?.id}&limit=100`),
    enabled: !!employee?.id
  });

  const filteredRawLogs = React.useMemo(() => {
    const targetDate = selectedLedgerRecord?.date || getLocalDateString();
    return rawLogs.filter((log: any) => {
      if (!log.timestamp) return false;
      const d = new Date(log.timestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const logDate = `${year}-${month}-${day}`;
      return logDate === targetDate;
    });
  }, [rawLogs, selectedLedgerRecord]);

  // Fetch employee leaves list
  const { data: leaves = [], isLoading: loadingLeaves, refetch: refetchLeaves } = useQuery({
    queryKey: ["employee-leaves", employee?.id],
    queryFn: () => fetchApi(`/employees/leaves?employee_id=${employee?.id}`),
    enabled: !!employee?.id && activeTab === "leave"
  });

  const filteredLeavesList = React.useMemo(() => {
    if (!leaves || !Array.isArray(leaves)) return [];
    return leaves.filter((l: any) => {
      const matchesType = leaveTypeFilter === "ALL" || l.leave_type === leaveTypeFilter;
      const matchesStatus = leaveStatusFilter === "ALL" || l.status === leaveStatusFilter;
      return matchesType && matchesStatus;
    });
  }, [leaves, leaveTypeFilter, leaveStatusFilter]);

  const approvedLeaveDays = React.useMemo(() => {
    const days = { Sick: 0, Casual: 0, Annual: 0, Unpaid: 0 };
    if (leaves && Array.isArray(leaves)) {
      leaves.forEach((l: any) => {
        if (l.status === "Approved" || l.status === "Pending") {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          const type = l.leave_type;
          if (type in days) {
            days[type as keyof typeof days] += diffDays;
          }
        }
      });
    }
    return days;
  }, [leaves]);

  const getLeaveLeft = (type: "Sick" | "Casual" | "Annual" | "Unpaid") => {
    const limit = leaveLimits[type];
    if (limit === "Limitless") return "Limitless";
    const approved = approvedLeaveDays[type];
    const left = Math.max(0, (limit as number) - approved);
    return `${left} Left`;
  };

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
    setFaceBbox(null);
    setProfileImageError(false);
    setMatchTime("");
    setLastScanResult(null);
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

      if (data.bbox) {
        setFaceBbox(data.bbox);
      } else {
        setFaceBbox(null);
      }

      if (data.status === "success") {
        playLocalBeep("success");
        setScanStatus("success");
        setScanMessage(`Check-in successful: ${data.attendance?.status || "Present"}`);
        setMatchTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
        setLastScanResult(data);
        queryClient.invalidateQueries({ queryKey: ["employee-history", employee?.id] });
        setTimeout(stopCamera, 4500);
      } else if (data.status === "location_error") {
        playLocalBeep("error");
        setScanStatus("error");
        setScanMessage(data.message || "Location verification failed.");
        setLastScanResult(data);
        setTimeout(stopCamera, 4500);
      } else if (data.status === "unknown" || data.status === "spoof_detected" || data.status === "no_face") {
        setScanMessage(data.message || "Verification failed. Retrying...");
      }
    } catch (err: any) {
      setScanMessage("Network or scan service error. Retrying...");
    } finally {
      scanningRef.current = false;
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate) {
      setLeaveError("Please enter valid dates.");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(leaveStartDate);
    if (start < today) {
      toast.error("Cannot apply for leave on past dates.");
      return;
    }

    if (leaveType === "Casual") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(leaveStartDate);
      const diffTime = start.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 3) {
        setLeaveError("Casual leave must be applied at least 3 days in advance.");
        setSubmittingLeave(false);
        return;
      }
    }

    // 1. Balance validation
    const limit = leaveLimits[leaveType];
    if (limit !== "Limitless") {
      const approved = approvedLeaveDays[leaveType as keyof typeof approvedLeaveDays];
      const left = Math.max(0, (limit as number) - approved);
      const requestedDays = getDaysBetween(leaveStartDate, leaveEndDate);
      
      if (left <= 0) {
        toast.error(`No ${leaveType} leave left.`);
        return;
      }
      
      if (requestedDays > left) {
        toast.error(`Requested days (${requestedDays}) exceed remaining ${leaveType} leave balance (${left}).`);
        return;
      }
    }

    // 2. Sick leave overlap validation
    if (leaveType === "Sick") {
      const requestedStart = new Date(leaveStartDate);
      const requestedEnd = new Date(leaveEndDate);
      
      const hasOverlap = leaves.some((l: any) => {
        if (l.leave_type !== "Sick" || l.status === "Rejected") return false;
        const existingStart = new Date(l.start_date);
        const existingEnd = new Date(l.end_date);
        return requestedStart <= existingEnd && existingStart <= requestedEnd;
      });
      
      if (hasOverlap) {
        toast.error("You have already applied for a Sick Leave on these dates.");
        return;
      }
    }

    setSubmittingLeave(true);
    setLeaveError(null);

    try {
      let richReason = leaveReason;
      if (isHalfDay) {
        richReason += ` (Half-Day: ${session})`;
      }
      if (leaveContact) {
        richReason += ` (Emergency Contact: ${leaveContact})`;
      }
      if (leaveType === "Sick" && attachedFileName) {
        richReason += ` (Attached Certificate: ${attachedFileName})`;
      }

      await fetchApi("/employees/leaves", {
        method: "POST",
        body: JSON.stringify({
          employee_id: employee.id,
          start_date: leaveStartDate,
          end_date: leaveEndDate,
          leave_type: leaveType,
          reason: richReason
        })
      });
      setShowLeaveModal(false);
      setLeaveStartDate("");
      setLeaveEndDate("");
      setLeaveReason("");
      setAttachedFileName("");
      setIsHalfDay(false);
      setLeaveContact("");
      refetchLeaves();
    } catch (err: any) {
      setLeaveError(err.message || "Failed to submit leave request.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const [withdrawingId, setWithdrawingId] = React.useState<number | null>(null);

  const handleWithdrawLeave = async (id: number) => {
    setWithdrawingId(id);
    try {
      await fetchApi(`/employees/leaves/${id}`, {
        method: "DELETE"
      });
      toast.success("Leave request withdrawn successfully.");
      refetchLeaves();
    } catch (err: any) {
      toast.error(err.message || "Failed to withdraw leave request.");
    } finally {
      setWithdrawingId(null);
    }
  };

  // Quick calculations
  const todayRecord = history?.find((h: any) => h.date === getLocalDateString());
  const thisMonthPresent = history?.filter((h: any) => ["Present", "Late", "WFH"].includes(h.status)).length || 0;
  const thisMonthHours = history?.reduce((acc: number, cur: any) => acc + (cur.working_hours || 0), 0).toFixed(1) || "0.0";

  // Dynamic worked / remaining timer calculations
  const [elapsedWorkedTime, setElapsedWorkedTime] = React.useState("0h 0m");
  const [leftShiftTime, setLeftShiftTime] = React.useState("—");
  const [workedHoursPercentage, setWorkedHoursPercentage] = React.useState(0);

  React.useEffect(() => {
    if (!todayRecord || !todayRecord.check_in) {
      setElapsedWorkedTime("Not Checked In");
      setLeftShiftTime("—");
      setWorkedHoursPercentage(0);
      return;
    }

    const calculateTimes = () => {
      const checkInDate = new Date(todayRecord.check_in);
      const checkOutDate = todayRecord.check_out ? new Date(todayRecord.check_out) : new Date();
      
      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      
      const hrs = Math.floor(diffHrs);
      const mins = Math.floor((diffHrs - hrs) * 60);
      
      setElapsedWorkedTime(`${hrs}h ${mins}m`);

      // Determine shift duration (default 8 hours = 480 mins)
      let shiftTotalMins = 8 * 60; 
      if (employee?.shift?.start_time && employee?.shift?.end_time) {
        const [sh, sm] = employee.shift.start_time.split(":").map(Number);
        const [eh, em] = employee.shift.end_time.split(":").map(Number);
        
        let startMins = sh * 60 + sm;
        let endMins = eh * 60 + em;
        if (endMins < startMins) { // Night shift rollover
          endMins += 24 * 60;
        }
        shiftTotalMins = endMins - startMins;
      }

      const totalWorkedMins = diffMs / (1000 * 60);
      const leftMins = shiftTotalMins - totalWorkedMins;
      
      if (todayRecord.check_out) {
        setLeftShiftTime("Shift Completed");
        setWorkedHoursPercentage(100);
      } else if (leftMins <= 0) {
        setLeftShiftTime("Overtime Active");
        setWorkedHoursPercentage(100);
      } else {
        const leftH = Math.floor(leftMins / 60);
        const leftM = Math.floor(leftMins % 60);
        setLeftShiftTime(`${leftH}h ${leftM}m left`);
        
        const pct = Math.min(100, Math.round((totalWorkedMins / shiftTotalMins) * 100));
        setWorkedHoursPercentage(pct);
      }
    };

    calculateTimes();
    const timerId = setInterval(calculateTimes, 10000); // refresh every 10s
    return () => clearInterval(timerId);
  }, [todayRecord, employee?.shift]);

  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto px-4 sm:px-6 md:px-0 text-slate-800 dark:text-zinc-100 font-sans">
      {/* Welcome Header */}
      <div className="pb-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">Welcome, {employee?.name || profile?.email}</h1>
          <p className="text-xs text-slate-400 dark:text-zinc-400 mt-1">
            {employee?.designation || "Staff Member"} &bull; {employee?.department?.name || "General"}
          </p>
        </div>
      </div>

      {/* RENDER ACTIVE TAB PANEL */}
      {activeTab === "attendance" && (
        <div className="space-y-6 animate-fadeInUp">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider font-mono">My Attendance Ledger</h2>
            <span className="text-xs text-slate-400 font-mono">Double checks and heatmaps</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 tech-card-3d p-5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider mb-4 font-mono">Ledger History</h3>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 dark:border-zinc-800/80 text-slate-400 font-mono uppercase">
                      <th className="py-2.5 pb-3">Date</th>
                      <th className="py-2.5 pb-3">Check In</th>
                      <th className="py-2.5 pb-3">Check Out</th>
                      <th className="py-2.5 pb-3">Hours Logged</th>
                      <th className="py-2.5 pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {loadingHistory ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3"><div className="skeleton h-3 w-20" /></td>
                          <td className="py-3"><div className="skeleton h-3 w-14" /></td>
                          <td className="py-3"><div className="skeleton h-3 w-14" /></td>
                          <td className="py-3"><div className="skeleton h-3 w-10" /></td>
                          <td className="py-3 text-right"><div className="skeleton h-5 w-14 rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : history && history.length > 0 ? (
                      history.map((record: any) => {
                        const checkInTime = record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                        const checkOutTime = record.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                        const isSelected = selectedLedgerRecord?.id === record.id;
                        return (
                          <tr 
                            key={record.id} 
                            onClick={() => setSelectedLedgerRecord(record)} 
                            className={`cursor-pointer transition-colors ${
                              isSelected 
                                ? "bg-slate-100/70 dark:bg-zinc-800/50 font-semibold text-cyan-600 dark:text-cyan-400" 
                                : "hover:bg-slate-50/50 dark:hover:bg-zinc-850/30"
                            }`}
                          >
                            <td className="py-3 font-semibold">
                              {new Date(record.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                            </td>
                            <td className="py-3 font-mono">{checkInTime}</td>
                            <td className="py-3 font-mono">{checkOutTime}</td>
                            <td className="py-3 font-semibold font-mono">{(record.working_hours || 0).toFixed(1)} hrs</td>
                            <td className="py-3 text-right">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold inline-block ${
                                record.status === "Present" ? "bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900" :
                                record.status === "Late" ? "bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900" :
                                record.status === "WFH" ? "bg-blue-50 border-blue-150 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900" :
                                "bg-rose-50 border-rose-150 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900"
                              }`}>
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No attendance logs logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Card List */}
              <div className="md:hidden space-y-3">
                {loadingHistory ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between"><div className="skeleton h-4 w-24" /><div className="skeleton h-5 w-14 rounded" /></div>
                      <div className="flex justify-between"><div className="skeleton h-3 w-16" /><div className="skeleton h-3 w-16" /></div>
                    </div>
                  ))
                ) : history && history.length > 0 ? (
                  history.map((record: any) => {
                    const checkInTime = record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                    const checkOutTime = record.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                    const isSelected = selectedLedgerRecord?.id === record.id;
                    return (
                      <div 
                        key={record.id}
                        onClick={() => setSelectedLedgerRecord(record)}
                        className={`bg-white dark:bg-zinc-900 border transition-all p-4 rounded-xl space-y-2.5 cursor-pointer ${
                          isSelected 
                            ? "bg-slate-50/90 dark:bg-zinc-800/50 border-cyan-500/80 shadow-3xs" 
                            : "border-zinc-100 dark:border-zinc-800/70"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                            {new Date(record.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            record.status === "Present" ? "bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900" :
                            record.status === "Late" ? "bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900" :
                            record.status === "WFH" ? "bg-blue-50 border-blue-150 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900" :
                            "bg-rose-50 border-rose-150 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900"
                          }`}>
                            {record.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10.5px] text-slate-500 dark:text-zinc-400">
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="text-[9px] text-slate-400 dark:text-zinc-500 mr-0.5">In:</span>
                              <span className="font-mono font-semibold">{checkInTime}</span>
                            </div>
                            <div className="text-zinc-300 dark:text-zinc-700">|</div>
                            <div>
                              <span className="text-[9px] text-slate-400 dark:text-zinc-500 mr-0.5">Out:</span>
                              <span className="font-mono font-semibold">{checkOutTime}</span>
                            </div>
                          </div>
                          <div>
                            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-300 text-xs">{(record.working_hours || 0).toFixed(1)} hrs</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">No attendance logs logged yet.</div>
                )}
              </div>
            </div>
            
            <div className="hidden lg:block lg:col-span-4 space-y-6">
              {/* Date Details & Activity Card */}
              <div className="tech-card-3d p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">
                      Date Details & Activity
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {selectedLedgerRecord 
                        ? new Date(selectedLedgerRecord.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                        : "No record selected"}
                    </p>
                  </div>
                  
                  {selectedLedgerRecord && (
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      selectedLedgerRecord.status === "Present" ? "bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                      selectedLedgerRecord.status === "Late" ? "bg-amber-50 border-amber-250 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                      selectedLedgerRecord.status === "WFH" ? "bg-blue-50 border-blue-250 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400" :
                      "bg-rose-55 border-rose-250 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455"
                    }`}>
                      {selectedLedgerRecord.status}
                    </span>
                  )}
                </div>

                {selectedLedgerRecord ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Punch In</p>
                        <p className="font-extrabold text-slate-800 dark:text-zinc-200 mt-1 font-mono text-xs">
                          {selectedLedgerRecord.check_in ? new Date(selectedLedgerRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                      <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Punch Out</p>
                        <p className="font-extrabold text-slate-800 dark:text-zinc-200 mt-1 font-mono text-xs">
                          {selectedLedgerRecord.check_out ? new Date(selectedLedgerRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Worked</p>
                        <p className="font-extrabold text-slate-800 dark:text-zinc-200 mt-1 font-mono text-xs">
                          {(selectedLedgerRecord.working_hours || 0).toFixed(1)} hrs
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Geofence</p>
                        <p className="font-bold text-slate-800 dark:text-zinc-200 mt-1 text-[10px] truncate" title={selectedLedgerRecord.geofence_result || "Verified"}>
                          {selectedLedgerRecord.geofence_result || "Verified"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center py-4 italic">No date details active.</p>
                )}
              </div>

              {/* Every Log/Scan Kiosk History Card */}
              <div className="tech-card-3d p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">
                      Biometric Kiosk Scans
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 rounded">
                    {rawLogs.length} Scans
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {loadingLogs ? (
                    <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
                  ) : rawLogs.length > 0 ? (
                    rawLogs.map((log: any) => {
                      const timeStr = log.timestamp 
                        ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                        : "—";
                      const dateStr = log.timestamp
                        ? new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
                        : "—";
                      const isSpoof = log.is_spoof;
                      return (
                        <div key={log.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800/80 bg-slate-55/30 dark:bg-zinc-950/20 flex items-center justify-between text-xs gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-zinc-200">{timeStr}</span>
                              <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">{dateStr}</span>
                            </div>
                            <p className="text-[10px] text-slate-450 dark:text-zinc-400 truncate font-mono">{log.camera || "Kiosk Entrance"}</p>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block ${
                              isSpoof 
                                ? "bg-rose-50 border-rose-200 text-rose-600" 
                                : log.status && log.status.includes("Success") 
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                                  : "bg-slate-50 border-slate-200 text-slate-600"
                            }`}>
                              {isSpoof ? "SPOOF REJECT" : log.status || "Swiped"}
                            </span>
                            {log.confidence && (
                              <p className="text-[8px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5">
                                Match: {(log.confidence * 100).toFixed(0)}%
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-slate-400 text-center py-8 italic">No scans recorded on kiosk terminal yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile details Modal (lg:hidden) */}
          {selectedLedgerRecord && (
            <div 
              className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn"
              onClick={() => setSelectedLedgerRecord(null)}
            >
              <div 
                className="bg-white dark:bg-zinc-900 w-full max-h-[80vh] rounded-t-3xl rounded-b-xl shadow-2xl p-5 overflow-y-auto space-y-5 animate-slideUp text-left"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-zinc-200 font-mono tracking-wider">Attendance Detail</h3>
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                      {new Date(selectedLedgerRecord.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedLedgerRecord(null)}
                    className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                    <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Punch In</p>
                      <p className="font-extrabold text-slate-800 dark:text-zinc-200 mt-1 font-mono text-xs">
                        {selectedLedgerRecord.check_in ? new Date(selectedLedgerRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-55 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                    <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Punch Out</p>
                      <p className="font-extrabold text-slate-800 dark:text-zinc-200 mt-1 font-mono text-xs">
                        {selectedLedgerRecord.check_out ? new Date(selectedLedgerRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-55 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Worked</p>
                      <p className="font-extrabold text-slate-800 dark:text-zinc-200 mt-1 font-mono text-xs">
                        {(selectedLedgerRecord.working_hours || 0).toFixed(1)} hrs
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-55 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Geofence</p>
                      <p className="font-bold text-slate-800 dark:text-zinc-200 mt-1 text-[10px] truncate" title={selectedLedgerRecord.geofence_result || "Verified"}>
                        {selectedLedgerRecord.geofence_result || "Verified"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Biometric Kiosk Scans */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-cyan-500" />
                      <h4 className="text-[10px] font-black text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">
                        Biometric Kiosk Scans
                      </h4>
                    </div>
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.25 bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 rounded">
                      {rawLogs.length} Scans
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {loadingLogs ? (
                      <div className="text-center py-6"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>
                    ) : rawLogs.length > 0 ? (
                      rawLogs.map((log: any) => {
                        const timeStr = log.timestamp 
                          ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : "—";
                        const isSpoof = log.is_spoof;
                        return (
                          <div key={log.id} className="p-2 rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/20 flex items-center justify-between text-[11px] gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 dark:text-zinc-200">{timeStr}</span>
                              <p className="text-[9px] text-slate-400 dark:text-zinc-500 truncate font-mono">{log.camera || "Entrance"}</p>
                            </div>
                            <div className="shrink-0">
                              <span className={`text-[8px] font-mono font-bold px-1 py-0.25 rounded border inline-block ${
                                isSpoof 
                                  ? "bg-rose-50 border-rose-200 text-rose-600" 
                                  : log.status && log.status.includes("Success") 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                                    : "bg-slate-50 border-slate-200 text-slate-600"
                              }`}>
                                {isSpoof ? "SPOOF" : log.status || "Swiped"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[10px] text-slate-400 text-center py-4 italic">No scans recorded on kiosk terminal.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "leave" && (
        <div className="space-y-6 animate-fadeInUp">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-zinc-150 dark:border-zinc-800 gap-4">
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider font-mono">Leave Requests</h2>
              
              {/* Premium 3-Column Balance Cards Grid */}
              <div className="grid grid-cols-3 gap-3 mt-3 w-full sm:max-w-lg">
                {(["Sick", "Casual", "Annual"] as const).map((type) => {
                  const limit = leaveLimits[type];
                  const approved = approvedLeaveDays[type] || 0;
                  const balanceNum = typeof limit === "number" ? Math.max(0, limit - approved) : 0;
                  const balanceStr = limit === "Limitless" ? "Limitless" : String(balanceNum);
                  const pct = typeof limit === "number" && limit > 0 ? (balanceNum / limit) * 100 : 100;
                  
                  return (
                    <div key={type} className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/50 dark:border-zinc-850 p-3 rounded-2xl flex flex-col gap-0.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                      <span className="text-[8.5px] font-bold text-zinc-450 dark:text-zinc-505 uppercase tracking-wider font-mono">{type}</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-black text-slate-900 dark:text-zinc-100 leading-none">{balanceStr}</span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-505 font-mono">/ {limit} Left</span>
                      </div>
                      
                      {/* Visual progress meter */}
                      <div className="w-full h-1 bg-zinc-150 dark:bg-zinc-900 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            type === "Sick" ? "bg-rose-500" :
                            type === "Casual" ? "bg-amber-500" :
                            "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <button
              onClick={() => {
                setLeaveError(null);
                setShowLeaveModal(true);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer border border-transparent dark:border-zinc-800 self-start sm:self-auto sm:mt-1"
            >
              Apply Leave
            </button>
          </div>

          <div className="tech-card-3d p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">Request Timeline</h3>
              
              <div className="flex items-center gap-2">
                <select
                  value={leaveTypeFilter}
                  onChange={(e) => setLeaveTypeFilter(e.target.value)}
                  className="h-8 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="Sick">Sick</option>
                  <option value="Casual">Casual</option>
                  <option value="Annual">Annual</option>
                  <option value="Unpaid">Unpaid</option>
                </select>

                <select
                  value={leaveStatusFilter}
                  onChange={(e) => setLeaveStatusFilter(e.target.value)}
                  className="h-8 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="relative pl-6 border-l border-dashed border-zinc-200 dark:border-zinc-800 ml-4 space-y-6 max-h-[450px] overflow-y-auto pr-1">
              {loadingLeaves ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="relative space-y-2">
                    <div className="absolute -left-[30px] w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 top-1" />
                    <div className="skeleton h-3 w-1/4 animate-pulse" />
                    <div className="skeleton h-2 w-1/2 animate-pulse" />
                  </div>
                ))
              ) : leaves && leaves.length > 0 ? (
                filteredLeavesList.length > 0 ? (
                  filteredLeavesList.map((l: any) => {
                    const isApproved = l.status === "Approved";
                    const isRejected = l.status === "Rejected";
                    const isPending = l.status === "Pending";
                    
                    return (
                      <div key={l.id} className="relative group transition-all">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[30px] w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 transition-all top-[18px] z-10 ${
                          isApproved ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" :
                          isRejected ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" :
                          "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-pulse"
                        }`} />

                        <div 
                          onClick={() => setSelectedLeaveDetail(l)}
                          className="flex flex-col md:flex-row md:items-start justify-between gap-4 pl-3.5 pr-3 py-3 rounded-2xl hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 border border-transparent hover:border-zinc-205 dark:hover:border-zinc-805 hover:shadow-3xs duration-200 cursor-pointer"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-150">{l.leave_type} Leave</span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-505 font-mono">Applied {formatDateDMY(l.created_at)}</span>
                            </div>
                            <p className="text-[11px] text-slate-555 dark:text-zinc-355 font-medium">
                              Duration: <span className="font-semibold text-slate-800 dark:text-zinc-200">{formatDateDMY(l.start_date)}</span> to <span className="font-semibold text-slate-800 dark:text-zinc-200">{formatDateDMY(l.end_date)}</span>
                            </p>
                            {l.reason && (
                              <p className="text-[11px] text-zinc-450 dark:text-zinc-500 mt-1 pl-3.5 border-l border-zinc-200 dark:border-zinc-800 italic leading-relaxed">
                                {l.reason.split(" (Emergency Contact:")[0].split(" (Half-Day:")[0]}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto" onClick={(e) => e.stopPropagation()}>
                            {isPending && (
                              <button
                                onClick={() => handleWithdrawLeave(l.id)}
                                disabled={withdrawingId === l.id}
                                className="px-2.5 py-1 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-955/25 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                {withdrawingId === l.id ? "Withdrawing..." : "Withdraw"}
                              </button>
                            )}
                            <span className={`text-[9.5px] font-mono px-2.5 py-0.5 rounded-full border font-bold uppercase ${
                              isApproved ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                              isRejected ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" :
                              "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                            }`}>
                              {l.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-zinc-405 dark:text-zinc-505 text-xs italic">
                    No leaves found matching the selected filters.
                  </div>
                )
              ) : (
                <div className="text-center py-10 text-zinc-405 dark:text-zinc-505 text-xs italic">
                  No leave requests submitted yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeInUp">
          {/* Geolocation Lock Warning */}
          {coords.latitude === null && (
            <div className="lg:col-span-12 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-400 rounded-xl flex items-center gap-2.5 text-[11px] font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-500 shrink-0 animate-bounce" />
              <span>
                <strong>GPS Coordinates Missing:</strong> Please enable location services/GPS permission in your browser to check in.
              </span>
            </div>
          )}

          {/* Premium Embedded Scanner Box */}
          <div className="lg:col-span-7 space-y-6">
            <div className="tech-card-3d border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs p-6 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center min-h-[320px] h-auto md:h-[320px] relative">
              <canvas ref={canvasRef} className="hidden" />
              
              <div className={`w-full max-w-2xl rounded-2xl overflow-hidden border border-slate-250 dark:border-zinc-800 bg-slate-950 aspect-video relative group shadow-lg ${cameraActive ? "" : "hidden"}`}>
                {/* Native Video player */}
                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
                
                {/* Laser animation */}
                {scanStatus === "scanning" && (
                  <div className="absolute inset-x-0 h-0.5 bg-cyan-400 opacity-80 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-scan-laser z-20 pointer-events-none" />
                )}

                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-cyan-500/50 rounded-tl-sm pointer-events-none z-10" />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-cyan-500/50 rounded-tr-sm pointer-events-none z-10" />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-cyan-500/50 rounded-bl-sm pointer-events-none z-10" />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-cyan-500/50 rounded-br-sm pointer-events-none z-10" />

                {/* Bounding Box Overlay */}
                {cameraActive && faceBbox && scanStatus !== "success" && (
                  <div 
                    className="absolute pointer-events-none z-20"
                    style={{
                      left: `${(((videoRef.current?.videoWidth || 640) - faceBbox[2]) / (videoRef.current?.videoWidth || 640)) * 100}%`,
                      top: `${(faceBbox[1] / (videoRef.current?.videoHeight || 480)) * 100}%`,
                      width: `${((faceBbox[2] - faceBbox[0]) / (videoRef.current?.videoWidth || 640)) * 100}%`,
                      height: `${((faceBbox[3] - faceBbox[1]) / (videoRef.current?.videoHeight || 480)) * 100}%`,
                      transition: "all 0.2s ease-out",
                    }}
                  >
                    <div className="absolute inset-0 border-2 rounded-xl border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-300">
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase whitespace-nowrap shadow-md bg-cyan-600 text-white transition-all duration-300">
                        SCANNING BIOMETRICS
                      </div>
                    </div>
                  </div>
                )}

                {/* Reticle guide */}
                {scanStatus === "scanning" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-40 h-40">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/40 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/40 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/40 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/40 rounded-br-lg" />
                    </div>
                  </div>
                )}

                {/* SUCCESS screen */}
                {cameraActive && scanStatus === "success" && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center border border-emerald-500/30 shadow-[inset_0_0_40px_rgba(16,185,129,0.15)] rounded-2xl z-30">
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-500/70 rounded-tl-md" />
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-500/70 rounded-tr-md" />
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-500/70 rounded-bl-md" />
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-500/70 rounded-br-md" />

                    <div className="space-y-4 max-w-sm w-full animate-fade-in flex flex-col items-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Biometrics Verified
                      </div>

                      <div className="relative w-24 h-24 flex items-center justify-center my-1.5">
                        <div className="absolute inset-0 border border-emerald-500/30 border-dashed rounded-full animate-spin-slow" />
                        <div className="absolute inset-2 rounded-full bg-slate-900 border-2 border-emerald-500/80 p-0.5 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                          {lastScanResult?.employee?.employee_id && !profileImageError ? (
                            <img
                              src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${lastScanResult.employee.employee_id}/front.jpg`}
                              alt={lastScanResult.employee.name}
                              className="w-full h-full object-cover rounded-full"
                              onError={() => setProfileImageError(true)}
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-xl uppercase">
                              {lastScanResult?.employee?.name
                                ? lastScanResult.employee.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)
                                : "PK"}
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-white shadow-md animate-pulse">
                          <UserCheck className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-lg font-extrabold text-white tracking-tight leading-none">
                          {lastScanResult?.employee?.name || "Employee"}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">
                          {lastScanResult?.employee?.designation || "Staff"} · ID: {lastScanResult?.employee?.employee_id}
                        </p>
                      </div>

                      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 max-w-[260px] grid grid-cols-2 gap-2 text-center divide-x divide-slate-800">
                        <div>
                          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Logged Time</span>
                          <span className="text-xs font-extrabold text-white font-mono tracking-tight block mt-0.5">
                            {matchTime}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Status</span>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mt-1">
                            {lastScanResult?.attendance_type || "CHECK-IN"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancel button */}
                {scanStatus !== "success" && (
                  <button 
                    onClick={stopCamera} 
                    className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-lg px-2.5 py-1 text-[10px] font-extrabold cursor-pointer transition-all uppercase tracking-wider z-20"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {!cameraActive && (
                <div className="flex flex-col items-center justify-center text-center p-4 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 flex items-center justify-center text-slate-450 shadow-2xs group-hover:scale-105 transition-all">
                    <Camera className="w-7 h-7 text-slate-450 dark:text-zinc-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-200">Mark Your Attendance</h3>
                    <p className="text-xs text-slate-450 dark:text-zinc-400 max-w-xs leading-normal font-sans">
                      Secure check-in and check-out via automatic geolocation validation and biometric check.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = "/kiosk";
                    }}
                    className="px-6 py-3 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-transparent dark:border-cyan-400/20"
                  >
                    <Fingerprint className="w-4 h-4" />
                    Start Biometric Verification
                  </button>
                </div>
              )}

              {/* Scan Feedback Banner */}
              {scanMessage && (
                <div className={`mt-3 px-4 py-1.5 rounded-xl text-xs font-semibold text-center border animate-fadeInUp flex items-center gap-2 ${
                  scanStatus === "success" 
                    ? "bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                    : scanStatus === "error" 
                      ? "bg-rose-50 border-rose-250 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400" 
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-zinc-900"
                }`}>
                  {scanStatus === "scanning" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {scanStatus === "success" && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  {scanStatus === "error" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-455" />}
                  <span>{scanMessage}</span>
                </div>
              )}
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="tech-card-3d p-3 flex flex-col justify-center h-[95px]">
                <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider">Today's Status</span>
                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-250 mt-1">
                  {todayRecord ? (
                    <span className={`inline-block text-[9.5px] sm:text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                      todayRecord.status === "Present" 
                        ? "bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                        : todayRecord.status === "Late" 
                          ? "bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" 
                          : "bg-blue-50 border-blue-150 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                    }`}>
                      {todayRecord.status}
                    </span>
                  ) : (
                    <span className="text-slate-450 text-[10px] sm:text-xs font-semibold whitespace-nowrap">Not Checked In</span>
                  )}
                </p>
              </div>
              <div className="tech-card-3d p-3 flex flex-col justify-center h-[95px]">
                <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider block sm:hidden">Days Present</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider hidden sm:block">Days Present (Month)</span>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-zinc-200 mt-1">{thisMonthPresent} Days</p>
              </div>
              <div className="tech-card-3d p-3 flex flex-col justify-center h-[95px]">
                <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider block sm:hidden">Hours Logged</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-zinc-400 font-bold uppercase tracking-wider hidden sm:block">Hours Logged (Month)</span>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-zinc-200 mt-1 font-mono">{thisMonthHours} hrs</p>
              </div>
            </div>
          </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Dynamic Daily Working Hours calculations */}
            <div className="tech-card-3d p-5 space-y-4 h-[225px] flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">Today's Shift Calculator</h3>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-455 dark:text-zinc-400 font-medium">Worked Hours Today</span>
                <span className="font-extrabold text-slate-900 dark:text-zinc-150 font-mono text-sm">{elapsedWorkedTime}</span>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-455 dark:text-zinc-400 font-medium">Remaining Hours</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-250 font-mono">{leftShiftTime}</span>
              </div>

              {/* Progress bar representing worked time */}
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${workedHoursPercentage}%` }}
                />
              </div>

              <div className="text-[10px] text-slate-400 leading-normal flex items-start gap-1">
                <span className="text-cyan-500">ℹ</span>
                <span>Ticking real-time from check-in logs. Rest/breaks are not counted.</span>
              </div>
            </div>

            {/* Biometric Kiosk Scans card */}
            <div className="tech-card-3d overflow-hidden flex flex-col h-[210px]">
              <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">Biometric Kiosk Scans</h3>
                <Link href="/dashboard?tab=attendance" className="text-[10px] font-bold text-cyan-600 hover:text-cyan-700">View All</Link>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingLogs ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="skeleton h-3 w-20" />
                      <div className="skeleton h-5 w-14 rounded" />
                    </div>
                  ))
                ) : rawLogs && rawLogs.length > 0 ? (
                  rawLogs.slice(0, 3).map((log: any) => {
                    const dateObj = parseDateTime(log.timestamp);
                    const timeStr = dateObj 
                      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : "—";
                    const dateStr = dateObj
                      ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : "—";
                    return (
                      <div key={log.id} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-zinc-800/40 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-zinc-200">{timeStr}</p>
                          <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">{dateStr} · {log.camera || "Kiosk"}</p>
                        </div>
                        <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block ${
                          log.is_spoof 
                            ? "bg-rose-50 border-rose-250 text-rose-600" 
                            : log.status && log.status.includes("Success") 
                              ? "bg-emerald-50 border-emerald-250 text-emerald-600" 
                              : "bg-slate-50 border-slate-200 text-slate-650"
                        }`}>
                          {log.is_spoof ? "SPOOF" : log.status || "Swiped"}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">No kiosk scans registered yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dummy Biometric Scanner Overlay (Portaled) */}
      {showDummyScanner && typeof document !== "undefined" && createPortal(
        <div className="modal-backdrop z-[999] bg-slate-950/80 backdrop-blur-md fixed inset-0 flex items-center justify-center p-4">
          <div className="tech-card-3d max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xl p-6 rounded-2xl w-full text-center space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 font-mono uppercase tracking-wider">
                Biometric Verification
              </h3>
              <button 
                onClick={() => setShowDummyScanner(false)} 
                className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-zinc-850 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-6 relative">
              {dummyScanStatus === "scanning" && (
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Radar/Pulse circles */}
                  <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-cyan-500/20 animate-pulse" />
                  <div className="w-16 h-16 rounded-full bg-slate-900 dark:bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                    <Fingerprint className="w-9 h-9 animate-pulse" />
                  </div>
                  {/* Scanning line */}
                  <div className="w-24 h-0.5 bg-cyan-400 absolute top-1/2 left-0 -translate-y-1/2 animate-bounce opacity-80" />
                </div>
              )}

              {dummyScanStatus === "success" && (
                <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-550/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-scaleIn">
                  <CheckCircle className="w-12 h-12" />
                </div>
              )}

              {dummyScanStatus === "error" && (
                <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-550/20 flex items-center justify-center text-rose-600 dark:text-rose-455 animate-scaleIn">
                  <AlertTriangle className="w-12 h-12" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                {dummyScanStatus === "scanning" ? "Scanning Biometrics..." : 
                 dummyScanStatus === "success" ? "Verification Successful" : 
                 "Verification Failed"}
              </p>
              <p className="text-[10.5px] text-slate-400 dark:text-zinc-400 font-medium px-2 leading-relaxed">
                {dummyScanMessage}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
      {selectedLeaveDetail && typeof document !== "undefined" && createPortal(
        <div className="modal-backdrop z-[999] bg-black/60 backdrop-blur-xs fixed inset-0 flex items-center justify-center p-4" onClick={() => setSelectedLeaveDetail(null)}>
          <div className="modal-content max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xl p-6 rounded-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 font-mono uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-500" />
                  Leave Details
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Applied {formatDateDMY(selectedLeaveDetail.created_at)}</p>
              </div>
              <button 
                onClick={() => setSelectedLeaveDetail(null)} 
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status Row */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl">
                <span className="font-semibold text-zinc-500">Request Status</span>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold uppercase ${
                  selectedLeaveDetail.status === "Approved" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                  selectedLeaveDetail.status === "Rejected" ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400" :
                  "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}>
                  {selectedLeaveDetail.status}
                </span>
              </div>

              {/* Leave Info */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/50 dark:border-zinc-850 rounded-xl">
                  <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Leave Type</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedLeaveDetail.leave_type} Leave</span>
                </div>
                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/50 dark:border-zinc-850 rounded-xl">
                  <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Duration</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {(() => {
                      const start = new Date(selectedLeaveDetail.start_date);
                      const end = new Date(selectedLeaveDetail.end_date);
                      const diffTime = Math.abs(end.getTime() - start.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      return `${diffDays} Day${diffDays > 1 ? "s" : ""}`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="p-3 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/50 dark:border-zinc-850 rounded-xl space-y-2">
                <div>
                  <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-0.5">Start Date</span>
                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{formatDateDMY(selectedLeaveDetail.start_date)}</span>
                </div>
                <div className="border-t border-zinc-200/50 dark:border-zinc-800/40 pt-2">
                  <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-0.5">End Date</span>
                  <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{formatDateDMY(selectedLeaveDetail.end_date)}</span>
                </div>
              </div>

              {/* Leave Reason */}
              {selectedLeaveDetail.reason && (
                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/50 dark:border-zinc-850 rounded-xl">
                  <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Reason / Description</span>
                  <p className="text-zinc-700 dark:text-zinc-300 italic leading-relaxed whitespace-pre-line">
                    {selectedLeaveDetail.reason}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100 dark:border-zinc-800">
              {selectedLeaveDetail.status === "Pending" && (
                <button
                  type="button"
                  onClick={() => {
                    handleWithdrawLeave(selectedLeaveDetail.id);
                    setSelectedLeaveDetail(null);
                  }}
                  disabled={withdrawingId === selectedLeaveDetail.id}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {withdrawingId === selectedLeaveDetail.id ? "Withdrawing..." : "Withdraw Request"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedLeaveDetail(null)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Leave Application Modal (Portaled for full screen cover) */}
      {showLeaveModal && typeof document !== "undefined" && createPortal(
        <div className="modal-backdrop z-[999] bg-black/40 backdrop-blur-xs fixed inset-0 flex items-center justify-center p-4">
          <div className="modal-content max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xl p-6 rounded-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 font-mono uppercase tracking-wider">
                  Apply for Leave
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Submit time-off requests to your manager</p>
              </div>
              <button 
                onClick={() => {
                  setShowLeaveModal(false);
                  setAttachedFileName("");
                  setIsHalfDay(false);
                  setLeaveContact("");
                }} 
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-150 dark:border-zinc-850">
              {(["Sick", "Casual", "Annual"] as const).map((type) => {
                const isLimitless = leaveLimits[type] === "Limitless";
                return (
                  <div key={type} className="text-center p-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-3xs flex flex-col justify-between min-h-[75px]">
                    <p className="text-[8px] font-bold text-slate-455 uppercase font-mono">{type}</p>
                    <div className="my-1">
                      {isHR && !isLimitless ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={leaveLimits[type]}
                            onChange={(e) => handleUpdateLimit(type, e.target.value)}
                            className="w-10 text-center text-xs font-black text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-1 py-0.5 focus:outline-none"
                            title="Edit Limit"
                          />
                        </div>
                      ) : (
                        <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                          {isLimitless ? "Limitless" : `${leaveLimits[type]} Days`}
                        </p>
                      )}
                    </div>
                    <p className="text-[8.5px] font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                      {getLeaveLeft(type)}
                    </p>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
              {leaveError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-700 rounded-lg">
                  {leaveError}
                </div>
              )}

              {/* Leave Type Selector Tabs */}
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1.5">
                  Select Leave Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["Sick", "Casual", "Annual", "Unpaid"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLeaveType(type)}
                      className={`py-2 text-[10px] font-bold uppercase border rounded-lg transition-all cursor-pointer ${
                        leaveType === type
                          ? "bg-slate-950 border-slate-950 dark:bg-zinc-200 dark:border-zinc-200 text-white dark:text-zinc-950"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-55/15"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Picker UI */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePicker(activePicker === "start" ? null : "start");
                      if (leaveStartDate) setPickerCurrentDate(new Date(leaveStartDate));
                    }}
                    className={`flex items-center justify-between h-9 text-xs bg-white dark:bg-zinc-950 border ${
                      activePicker === "start" ? "border-cyan-500 ring-1 ring-cyan-500/20" : "border-zinc-200 dark:border-zinc-800"
                    } text-zinc-900 dark:text-zinc-100 rounded-xl transition-all w-full px-3 text-left`}
                  >
                    <span>{leaveStartDate ? new Date(leaveStartDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Select Start Date"}</span>
                    <Calendar className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePicker(activePicker === "end" ? null : "end");
                      if (leaveEndDate) setPickerCurrentDate(new Date(leaveEndDate));
                    }}
                    className={`flex items-center justify-between h-9 text-xs bg-white dark:bg-zinc-950 border ${
                      activePicker === "end" ? "border-cyan-500 ring-1 ring-cyan-500/20" : "border-zinc-200 dark:border-zinc-800"
                    } text-zinc-900 dark:text-zinc-100 rounded-xl transition-all w-full px-3 text-left`}
                  >
                    <span>{leaveEndDate ? new Date(leaveEndDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Select End Date"}</span>
                    <Calendar className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Inline Calendar Panel */}
              {activePicker && (
                <div className="max-w-[260px] mx-auto p-2 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-fadeIn duration-155">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-zinc-800 dark:text-zinc-200 uppercase font-mono tracking-wider">
                      {MONTHS[pickerCurrentDate.getMonth()]} {pickerCurrentDate.getFullYear()}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setPickerCurrentDate(new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth() - 1, 1))}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-500"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerCurrentDate(new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth() + 1, 1))}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-500"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] font-mono text-zinc-400 uppercase mb-0.5">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 justify-items-center">
                    {(() => {
                      const pYear = pickerCurrentDate.getFullYear();
                      const pMonth = pickerCurrentDate.getMonth();
                      const pDaysInMonth = new Date(pYear, pMonth + 1, 0).getDate();
                      const pFirstDay = new Date(pYear, pMonth, 1).getDay();

                      const cells = [];
                      for (let i = 0; i < pFirstDay; i++) {
                        cells.push(<div key={`pempty-${i}`} className="w-7 h-7" />);
                      }

                      for (let d = 1; d <= pDaysInMonth; d++) {
                        const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const isSelected = activePicker === "start" ? leaveStartDate === dateStr : leaveEndDate === dateStr;
                        const isToday = new Date().toLocaleDateString() === new Date(pYear, pMonth, d).toLocaleDateString();
                        
                        const cellDate = new Date(pYear, pMonth, d);
                        cellDate.setHours(0, 0, 0, 0);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        const isPast = cellDate < todayDate;

                        cells.push(
                          <button
                            key={`pday-${d}`}
                            type="button"
                            disabled={isPast}
                            onClick={() => {
                              if (activePicker === "start") {
                                setLeaveStartDate(dateStr);
                                setActivePicker("end");
                                if (leaveEndDate && new Date(leaveEndDate) < new Date(dateStr)) {
                                  setLeaveEndDate("");
                                }
                              } else {
                                setLeaveEndDate(dateStr);
                                setActivePicker(null);
                                if (leaveStartDate && new Date(leaveStartDate) > new Date(dateStr)) {
                                  setLeaveStartDate("");
                                }
                              }
                            }}
                            className={`w-7 h-7 text-[9px] font-black rounded-md transition-all flex items-center justify-center ${
                              isSelected
                                ? "bg-cyan-500 text-white shadow-2xs shadow-cyan-500/25"
                                : isPast
                                ? "opacity-25 cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                                : isToday
                                ? "bg-zinc-200 dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400"
                                : "hover:bg-zinc-250 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                            }`}
                          >
                            {d}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                </div>
              )}

              {/* Half-Day Session selector (GreatHR mimicry) */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-zinc-850">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-800 dark:text-zinc-350 leading-none">Apply for Half-Day</p>
                  <p className="text-[9px] text-slate-400">Request off-work session parameters</p>
                </div>
                <input 
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-zinc-300 cursor-pointer"
                />
              </div>

              {isHalfDay && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 animate-fadeInUp">
                  {["First Half", "Second Half"].map((sess) => (
                    <button
                      key={sess}
                      type="button"
                      onClick={() => setSession(sess)}
                      className={`py-1.5 text-[9px] font-bold uppercase rounded border transition-all cursor-pointer ${
                        session === sess
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200"
                          : "bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-850 hover:bg-zinc-55"
                      }`}
                    >
                      {sess}
                    </button>
                  ))}
                </div>
              )}

              {/* Emergency Contact */}
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                  Emergency Contact Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter contact details for leave period..."
                  value={leaveContact}
                  onChange={(e) => setLeaveContact(e.target.value)}
                  className="input-field h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:border-zinc-800 dark:focus:border-zinc-200 text-zinc-900 dark:text-zinc-100 rounded-xl transition-all w-full px-3"
                />
              </div>

              {/* Medical Document Attachment (Conditional for Sick Leave) */}
              {leaveType === "Sick" && (
                <div className="space-y-1.5 animate-fadeInUp p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-dashed border-rose-200 dark:border-rose-900 rounded-xl">
                  <label className="block text-[10px] font-bold text-rose-700 dark:text-rose-455 uppercase tracking-wider">
                    Medical Certificate (Required for Sick Leave)
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept=".pdf,.png,.jpg,.jpeg"
                      required={leaveType === "Sick"}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setAttachedFileName(file ? file.name : "");
                      }}
                      className="text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9px] file:font-bold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 file:cursor-pointer cursor-pointer"
                    />
                  </div>
                  {attachedFileName && (
                    <p className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">📎 Document: {attachedFileName}</p>
                  )}
                </div>
              )}

              {/* Reason / Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">
                  Reason / Description
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Provide details about your time-off request..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full min-h-[70px] p-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition-all resize-none shadow-3xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveModal(false);
                    setAttachedFileName("");
                    setIsHalfDay(false);
                    setLeaveContact("");
                  }}
                  className="btn-ghost text-xs px-3.5 py-2 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-slate-500 border border-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-200 dark:hover:bg-white text-white dark:text-zinc-900 font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {submittingLeave && <span className="animate-spin text-white">⌛</span>}
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function AdminDashboardView({ profile }: { profile: any }) {

  const [currentTime, setCurrentTime] = React.useState("");
  const [currentDate, setCurrentDate] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "MATCHED" | "UNKNOWN" | "SPOOF">("ALL");
  const [selectedDept, setSelectedDept] = React.useState<any | null>(null);
  const [isDark, setIsDark] = React.useState(false);
  const [dashboardView, setDashboardView] = React.useState<"business" | "operations">("business");
  const queryClient = useQueryClient();

  const { data: recAnalytics } = useQuery({
    queryKey: ["recognition-analytics"],
    queryFn: () => fetchApi("/analytics/recognition"),
    enabled: dashboardView === "operations"
  });

  const { data: telemetry } = useQuery({
    queryKey: ["system-telemetry"],
    queryFn: () => fetchApi("/analytics/system-telemetry"),
    enabled: dashboardView === "operations",
    refetchInterval: 3000
  });

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
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("SSE connection closed permanently.");
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn("SSE connection lost. Reconnecting...");
      } else {
        console.error("SSE connection error:", err);
      }
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
    const presentLineColor = "#06b6d4"; // Cyan
    const lateLineColor = "#f59e0b"; // Amber
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
            color: presentLineColor, 
            width: 2.5,
            shadowColor: "rgba(6, 182, 212, 0.15)",
            shadowBlur: 8,
            shadowOffsetY: 4
          },
          itemStyle: { color: presentLineColor },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(6, 182, 212, 0.12)" },
                { offset: 1, color: "rgba(6, 182, 212, 0)" }
              ]
            }
          }
        },
        {
          name: "Late Arrivals",
          type: "line",
          smooth: 0.35,
          showSymbol: false,
          symbolSize: 6,
          data: trends.map((t: any) => t.late),
          lineStyle: { 
            color: lateLineColor, 
            width: 2.25,
            shadowColor: "rgba(245, 158, 11, 0.15)",
            shadowBlur: 8,
            shadowOffsetY: 4
          },
          itemStyle: { color: lateLineColor },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(245, 158, 11, 0.12)" },
                { offset: 1, color: "rgba(245, 158, 11, 0)" }
              ]
            }
          }
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
            
            <div className="flex bg-zinc-100 rounded-lg p-0.5 ml-4">
              <button
                onClick={() => setDashboardView("business")}
                className={`px-3 py-1 rounded-md text-[9px] font-extrabold uppercase transition-all cursor-pointer ${
                  dashboardView === "business" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Business HR
              </button>
              <button
                onClick={() => setDashboardView("operations")}
                className={`px-3 py-1 rounded-md text-[9px] font-extrabold uppercase transition-all cursor-pointer ${
                  dashboardView === "operations" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                AI Operations
              </button>
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

        {dashboardView === "operations" ? (
          <div className="space-y-6 animate-fadeInPage">
            {/* Operations center telemetry grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-zinc-100 rounded-xl p-4 flex flex-col justify-between h-[110px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Device Health Status</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xl font-bold text-slate-900">{telemetry?.online_devices ?? 3} Online</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">{telemetry?.offline_devices ?? 0} Offline</span>
                </div>
              </div>
              <div className="bg-white border border-zinc-100 rounded-xl p-4 flex flex-col justify-between h-[110px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Recognition Confidence</p>
                <span className="text-xl font-bold text-slate-900 mt-auto">{recAnalytics?.average_confidence ?? "0.91"}</span>
              </div>
              <div className="bg-white border border-zinc-100 rounded-xl p-4 flex flex-col justify-between h-[110px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Average Match Speed</p>
                <span className="text-xl font-bold text-slate-900 mt-auto">{recAnalytics?.average_processing_time_ms ?? "114.5"} ms</span>
              </div>
              <div className="bg-white border border-zinc-100 rounded-xl p-4 flex flex-col justify-between h-[110px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spoof Rejections</p>
                <span className="text-xl font-bold text-rose-600 mt-auto">{recAnalytics?.spoof_attempts ?? "0"}</span>
              </div>
            </div>

            {/* Live Feed & System metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 border border-zinc-100 rounded-xl bg-white p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Real-Time Kiosk Operations Feed</h3>
                <div className="h-[400px] overflow-y-auto space-y-2.5 pr-2">
                  {recentLogs && recentLogs.map((log: any) => (
                    <ScanLogItem key={log.id} log={log} />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2 border border-zinc-100 rounded-xl bg-white p-5 space-y-4 flex flex-col justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Platform Resources (Telemetry)</h3>
                <div className="space-y-5 flex-1 mt-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>CPU LOAD</span>
                      <span>{telemetry?.cpu_load ?? "34.2"}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-2 transition-all duration-500" style={{ width: `${telemetry?.cpu_load ?? 34.2}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>MEMORY LOAD</span>
                      <span>{telemetry?.memory_load ?? "56.1"}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-2 transition-all duration-500" style={{ width: `${telemetry?.memory_load ?? 56.1}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>API GATEWAY LATENCY</span>
                      <span>{telemetry?.api_gateway_latency_ms ?? "12.4"} ms</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-2 transition-all duration-500" style={{ width: `${Math.min(100, ((telemetry?.api_gateway_latency_ms ?? 12.4) / 50) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ─── KPI Grid ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Staff" value={loadingSummary ? "—" : summary?.total_employees} icon={Users} color="blue" loading={loadingSummary} sublabel="Registered" sparkData={staffSpark} />
          <StatCard label="Present Today" value={loadingSummary ? "—" : summary?.present_today} icon={UserCheck} color="emerald" loading={loadingSummary} sublabel="Clocked in" sparkData={presentSpark} />
          <StatCard label="Late Arrivals" value={loadingSummary ? "—" : summary?.late_today} icon={Clock} color="amber" loading={loadingSummary} sublabel="Grace exceeded" sparkData={lateSpark} />
          <StatCard label="Absent Today" value={loadingSummary ? "—" : summary?.absent_today} icon={UserMinus} color="rose" loading={loadingSummary} sublabel="Unexcused" sparkData={absentSpark} />
          <StatCard label="Attendance Rate" value={loadingSummary ? "—" : `${summary?.attendance_percentage}%`} icon={TrendingUp} color="indigo" loading={loadingSummary} sublabel="Rate today" sparkData={rateSpark} />
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Trend Chart */}
          <div className="tech-card-3d lg:col-span-3 p-5 flex flex-col justify-between">
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
          <div className="tech-card-3d lg:col-span-2 flex flex-col">
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
        <div className="tech-card-3d p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Who's In Today</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Real-time team presence tracking and manual adjustments</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Teammate */}
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search team member..."
                  value={presenceSearch}
                  onChange={(e) => setPresenceSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs bg-zinc-50 border border-zinc-100 rounded-xl focus:border-zinc-350 focus:bg-white text-zinc-800 transition-all outline-none placeholder-zinc-400 w-full"
                />
              </div>
              
              {/* Status Filters */}
              <div className="flex bg-zinc-50 border border-zinc-100 p-0.5 rounded-xl text-[10px] font-semibold text-zinc-400 overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
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
                        className={`p-3.5 transition-all duration-200 flex flex-col justify-between h-[125px] ${
                          isAbsent 
                            ? "tech-card-3d-minimal opacity-60 hover:opacity-100" 
                            : "tech-card-3d-minimal hover:translate-y-[-2px]"
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
        <div className="tech-card-3d p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Departments</h2>
          </div>
          
          <div className="min-h-36">
            {loadingDept ? (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-32 w-full rounded-2xl" />
                ))}
              </div>
            ) : !deptStats || deptStats.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No department stats found.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {deptStats.map((d: any) => {
                  const percent = d.total_employees > 0 
                    ? Math.round((d.present_today / d.total_employees) * 100) 
                    : 0;

                  return (
                    <div 
                      key={d.id}
                      onClick={() => setSelectedDept(d)}
                      className="tech-card-3d-minimal p-4 transition-all duration-200 flex flex-col justify-between h-28 cursor-pointer group hover:translate-y-[-2px]"
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
      </>
    )}
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

function SuperAdminDashboardView({ profile }: { profile: any }) {
  const queryClient = useQueryClient();
  
  // Fetch companies for global platform statistics
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["companies-list"],
    queryFn: () => fetchApi("/companies/")
  });

  // Fetch helpdesk support tickets
  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["support-tickets-list"],
    queryFn: () => fetchApi("/tickets/")
  });

  // Fetch real device fleet list
  const { data: devices = [], isLoading: loadingDevices } = useQuery({
    queryKey: ["devices-list"],
    queryFn: () => fetchApi("/devices/").catch(() => [])
  });

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c: any) => c.status === "Active").length;
  const pendingCompanies = companies.filter((c: any) => c.status === "Pending Approval").length;
  const openTicketsCount = tickets.filter((t: any) => t.status === "Open" || t.status === "In Progress").length;
  const totalDevices = devices.length;
  const activeDevices = devices.filter((d: any) => d.status === "Online").length;

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-400" />
              Super Admin Console
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
              Global system monitoring, client organization onboarding, and platform configuration
            </p>
          </div>
        </div>

        {/* Platform Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="tech-card-3d p-4 space-y-1">
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Organizations</span>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">{totalCompanies}</p>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">{pendingCompanies} pending approvals</span>
          </div>

          <div className="tech-card-3d p-4 space-y-1">
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Active Organizations</span>
              <CheckCircle className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">{activeCompanies}</p>
            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold">100% online status</span>
          </div>

          <div className="tech-card-3d p-4 space-y-1">
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Global Device Fleet</span>
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">
              {loadingDevices ? "..." : `${totalDevices} Device${totalDevices === 1 ? "" : "s"}`}
            </p>
            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold">
              {loadingDevices ? "Loading devices..." : `${activeDevices} online terminals`}
            </span>
          </div>

          <div className="tech-card-3d p-4 space-y-1">
            <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Open Tickets</span>
              <Mail className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">{openTicketsCount}</p>
            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold">Requires attention</span>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Organization Activity */}
          <div className="tech-card-3d p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Building2 className="w-4 h-4 text-zinc-500 dark:text-cyan-400" />
              <h3 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wider">Recent Organizations</h3>
            </div>
            {companies.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {companies.slice(0, 5).map((comp: any) => (
                  <div key={comp.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">{comp.name}</p>
                      <p className="text-[9.5px] text-zinc-450 dark:text-zinc-400 mt-0.5">{comp.admin_email} &bull; Max {comp.max_employees} Users</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${
                      comp.status === "Active" 
                        ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200" 
                        : "bg-zinc-50 dark:bg-zinc-850 border-zinc-150 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
                    }`}>
                      {comp.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-450 dark:text-zinc-400 py-4 text-center">No organizations onboarded yet.</p>
            )}
          </div>

          {/* Quick Platform Actions */}
          <div className="tech-card-3d p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Zap className="w-4 h-4 text-zinc-500 dark:text-cyan-400" />
              <h3 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wider font-mono">Platform Actions</h3>
            </div>
            <div className="flex flex-col gap-2">
              <a 
                href="/tenants" 
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer text-center"
              >
                <Plus className="w-3.5 h-3.5" /> Onboard Organization
              </a>
              <a 
                href="/users" 
                className="w-full py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer text-center"
              >
                <Users className="w-3.5 h-3.5" /> Approve Platform Users
              </a>
              <a 
                href="/audit" 
                className="w-full py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-750 dark:text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer text-center"
              >
                <HistoryIcon className="w-3.5 h-3.5" /> View Audit Logs
              </a>
            </div>
          </div>

        </div>
      </div>
    </SidebarLayout>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const prof = getUserProfile();
    setProfile(prof);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
            <div className="absolute inset-0 rounded-full border-2 border-[var(--text-primary)] border-t-transparent animate-spin" />
          </div>
          <p className="text-[var(--text-secondary)] text-sm font-mono">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const isEmployee = profile?.role?.name === "Employee";
  const isSuperAdmin = profile?.role?.name === "Super Admin";

  if (isEmployee) {
    return (
      <SidebarLayout>
        <React.Suspense fallback={
          <div className="flex flex-col items-center justify-center p-12 text-sm font-mono text-slate-500">
            Loading Portal...
          </div>
        }>
          <EmployeeDashboardView profile={profile} />
        </React.Suspense>
      </SidebarLayout>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminDashboardView profile={profile} />;
  }

  return <AdminDashboardView profile={profile} />;
}
