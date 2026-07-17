"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import {
  Camera, Upload, CheckCircle2, ChevronLeft, XCircle, Video,
  RefreshCw, AlertCircle, Trash2, Play, Pause, Save, RotateCcw, Shield, Activity, Sparkles,
  User, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Smile, Meh, Lightbulb, Sun, Glasses,
  Printer, Download
} from "lucide-react";

interface PoseInfo {
  label: string;
  hint: string;
  speech: string;
  icon: any;
}

const POSES: Record<string, PoseInfo> = {
  front: {
    label: "Front Profile",
    hint: "Look straight into the camera with a neutral expression.",
    speech: "Please look straight into the camera.",
    icon: User
  },
  left: {
    label: "Left Profile",
    hint: "Turn your head slowly to the left.",
    speech: "Please turn your head to the left.",
    icon: ArrowLeft
  },
  right: {
    label: "Right Profile",
    hint: "Turn your head slowly to the right.",
    speech: "Please turn your head to the right.",
    icon: ArrowRight
  },
  up: {
    label: "Looking Up",
    hint: "Tilt your chin upwards slightly.",
    speech: "Please tilt your head upwards.",
    icon: ArrowUp
  },
  down: {
    label: "Looking Down",
    hint: "Tilt your chin downwards slightly.",
    speech: "Please tilt your head downwards.",
    icon: ArrowDown
  },
  smile: {
    label: "Smiling Face",
    hint: "Give a natural, relaxed smile.",
    speech: "Now, smile naturally.",
    icon: Smile
  },
  neutral: {
    label: "Neutral Face",
    hint: "Keep a relaxed, standard neutral expression.",
    speech: "Relax your face, show a neutral expression.",
    icon: Meh
  },
  indoor: {
    label: "Indoor Light",
    hint: "Look straight with standard indoor room lighting.",
    speech: "Look straight for typical indoor lighting.",
    icon: Lightbulb
  },
  outdoor: {
    label: "Outdoor Light",
    hint: "Look straight with bright/outdoor lighting.",
    speech: "Look straight for bright light capture.",
    icon: Sun
  },
  glasses: {
    label: "Glasses Option",
    hint: "Put on glasses if you wear them, otherwise look straight.",
    speech: "If you wear glasses, put them on. Otherwise, look straight.",
    icon: Glasses
  }
};

const POSE_KEYS = Object.keys(POSES);

export default function EnrollPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const employeeId = params.id;
  const { toast } = useToast();

  // State Machine for biometric scanner:
  // "idle": Pre-start screen
  // "capturing": Active auto-capture loop
  // "review": Review grid of all 10 captured poses
  // "saving": Uploading to server/indexing vectors
  // "success": Completed successfully screen
  const [captureState, setCaptureState] = useState<"idle" | "capturing" | "review" | "saving" | "success">("idle");
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  
  // Store local previews: { [poseKey]: base64DataUrl }
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({});
  
  // Upload status
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [singleRetakePose, setSingleRetakePose] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [photoTimestamp, setPhotoTimestamp] = useState(Date.now());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => fetchApi(`/employees/${employeeId}`)
  });

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["enroll-status", employeeId],
    queryFn: () => fetchApi(`/enrollment/status/${employeeId}`),
    enabled: !!employeeId
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchApi("/settings/")
  });

  const settingsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (settings) {
      settings.forEach((s: any) => {
        map[s.key] = s.value;
      });
    }
    return map;
  }, [settings]);

  const companyName = settingsMap["COMPANY_NAME"] || "NetraID Enterprise";
  const companyLogo = settingsMap["COMPANY_LOGO"] || "";
  const badgeTheme = settingsMap["BADGE_THEME_COLOR"] || "Navy Blue";
  const badgePattern = settingsMap["BADGE_PATTERN_TYPE"] || "Indian Mandala";

  const themeStyles = React.useMemo(() => {
    switch (badgeTheme) {
      case "Saffron":
        return {
          headerBg: "bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600",
          accentText: "text-orange-600 dark:text-orange-400",
          accentBorder: "border-orange-500",
          accentBg: "bg-orange-50/40 dark:bg-orange-950/20",
          photoBorder: "from-amber-500 to-red-500",
          dotColor: "bg-orange-500",
          primaryHex: "#f97316",
          headerHex1: "#d97706",
          headerHex2: "#dc2626"
        };
      case "Emerald":
        return {
          headerBg: "bg-gradient-to-tr from-slate-900 via-emerald-950 to-teal-900",
          accentText: "text-emerald-600 dark:text-emerald-400",
          accentBorder: "border-emerald-500",
          accentBg: "bg-emerald-50/40 dark:bg-emerald-950/20",
          photoBorder: "from-emerald-500 to-teal-400",
          dotColor: "bg-emerald-500",
          primaryHex: "#10b981",
          headerHex1: "#064e3b",
          headerHex2: "#0f766e"
        };
      case "Charcoal":
        return {
          headerBg: "bg-gradient-to-tr from-zinc-900 via-slate-800 to-zinc-950",
          accentText: "text-zinc-650 dark:text-zinc-400",
          accentBorder: "border-zinc-500",
          accentBg: "bg-zinc-50/40 dark:bg-zinc-900/20",
          photoBorder: "from-zinc-500 to-slate-400",
          dotColor: "bg-zinc-500",
          primaryHex: "#6b7280",
          headerHex1: "#18181b",
          headerHex2: "#27272a"
        };
      case "Navy Blue":
      default:
        return {
          headerBg: "bg-gradient-to-tr from-slate-900 via-blue-900 to-indigo-950",
          accentText: "text-cyan-500 dark:text-cyan-400",
          accentBorder: "border-cyan-500",
          accentBg: "bg-slate-50/40 dark:bg-slate-900/20",
          photoBorder: "from-cyan-500 to-emerald-400",
          dotColor: "bg-cyan-500",
          primaryHex: "#06b6d4",
          headerHex1: "#0f172a",
          headerHex2: "#1e3a8a"
        };
    }
  }, [badgeTheme]);

  const BadgeWatermark = ({ type }: { type: string }) => {
    switch (type) {
      case "Indian Mandala":
        return (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] text-slate-800 dark:text-slate-100 z-0 overflow-hidden badge-watermark-container">
            <svg className="w-[110%] h-[110%]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.4">
              <circle cx="50" cy="50" r="42" strokeDasharray="1 1.5" />
              <circle cx="50" cy="50" r="35" />
              <circle cx="50" cy="50" r="28" strokeDasharray="0.5 1" />
              <circle cx="50" cy="50" r="21" />
              <circle cx="50" cy="50" r="14" strokeDasharray="1 1" />
              <circle cx="50" cy="50" r="7" />
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                const x1 = 50 + 7 * Math.cos(angle);
                const y1 = 50 + 7 * Math.sin(angle);
                const x2 = 50 + 35 * Math.cos(angle);
                const y2 = 50 + 35 * Math.sin(angle);
                const cx1 = 50 + 20 * Math.cos(angle - 0.08);
                const cy1 = 50 + 20 * Math.sin(angle - 0.08);
                return (
                  <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} />
                    <path d={`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`} strokeWidth="0.25" />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      case "Corporate Waves":
        return (
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] text-slate-800 dark:text-slate-100 z-0 badge-watermark-container">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
              <path d="M-20,40 C20,20 40,60 60,40 C80,20 100,60 120,40" />
              <path d="M-20,50 C20,30 40,70 60,50 C80,30 100,70 120,50" strokeDasharray="1 1" />
              <path d="M-20,60 C20,40 40,80 60,60 C80,40 100,80 120,60" />
              <path d="M-20,70 C20,50 40,90 60,70 C80,50 100,90 120,70" strokeDasharray="0.5 1" />
            </svg>
          </div>
        );
      case "Cyber Grid":
        return (
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] text-slate-800 dark:text-slate-100 z-0 badge-watermark-container">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
              {Array.from({ length: 11 }).map((_, i) => (
                <g key={i}>
                  <line x1="0" y1={i * 10} x2="100" y2={i * 10} />
                  <line x1={i * 10} y1="0" x2={i * 10} y2="100" />
                </g>
              ))}
            </svg>
          </div>
        );
      case "None":
      default:
        return null;
    }
  };

  const clearMutation = useMutation({
    mutationFn: () => fetchApi(`/enrollment/${employeeId}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchStatus();
      setCapturedImages({});
      setSuccessMsg("All registered facial profiles cleared from database.");
      setErrorMsg(null);
    }
  });

  const deletePoseMutation = useMutation({
    mutationFn: (pose: string) => fetchApi(`/enrollment/${employeeId}/pose/${pose}`, { method: "DELETE" }),
    onSuccess: (_, pose) => {
      refetchStatus();
      setCapturedImages(prev => {
        const next = { ...prev };
        delete next[pose];
        return next;
      });
      toast.success(`Face profile for pose '${POSES[pose]?.label || pose}' cleared.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete pose");
    }
  });

  // Offline Web Audio API Sound Generator (synthesized camera click & alert beeps)
  const playSound = (type: "beep" | "click") => {
    if (typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "beep") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.13);
      } else if (type === "click") {
        // Shutter click noise synthesis
        osc.type = "triangle";
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch (e) {
      console.warn("Failed to generate audio feedback:", e);
    }
  };

  // Browser offline speech engine
  const speakDirection = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      
      const voices = window.speechSynthesis.getVoices();
      const eng = voices.find(v => v.lang.startsWith("en"));
      if (eng) utterance.voice = eng;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDownloadBadge = async () => {
    if (!employee) return;
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set standard high-resolution dimensions for printing (e.g., 600x900 for 2:3 aspect ratio)
      canvas.width = 600;
      canvas.height = 900;

      // 1. Draw rounded background card
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(0, 0, 600, 900, 30);
      } else {
        const x = 0, y = 0, width = 600, height = 900, radius = 30;
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
      }
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1"; // lighter border
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw custom background pattern
      const cx = 300;
      const cy = 450;
      if (badgePattern === "Indian Mandala") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
        ctx.lineWidth = 1.5;
        // Concentric rings
        ctx.beginPath(); ctx.arc(cx, cy, 252, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 210, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 168, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 126, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 84, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.stroke();
        // Rays & Arches
        for (let i = 0; i < 24; i++) {
          const angle = (i * 15 * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(cx + 42 * Math.cos(angle), cy + 42 * Math.sin(angle));
          ctx.lineTo(cx + 210 * Math.cos(angle), cy + 210 * Math.sin(angle));
          ctx.stroke();
        }
      } else if (badgePattern === "Corporate Waves") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-50, 420);
        ctx.bezierCurveTo(150, 220, 350, 620, 650, 420);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-50, 500);
        ctx.bezierCurveTo(150, 300, 350, 700, 650, 500);
        ctx.stroke();
      } else if (badgePattern === "Cyber Grid") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.04)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 900; i += 60) {
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(600, i); ctx.stroke();
        }
        for (let i = 0; i <= 600; i += 60) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 900); ctx.stroke();
        }
      }

      // 2. Draw Header Area (Dynamic gradient based on active theme)
      const gradient = ctx.createLinearGradient(0, 0, 600, 0);
      gradient.addColorStop(0, themeStyles.headerHex1);
      gradient.addColorStop(1, themeStyles.headerHex2);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(0, 0, 600, 200, [30, 30, 0, 0]);
      } else {
        const x = 0, y = 0, width = 600, height = 200, radius = 30;
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
      }
      ctx.fill();

      // 3. Draw Lanyard Punch Hole representation (premium visual detail)
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(260, 20, 80, 20, 10);
      } else {
        ctx.rect(260, 20, 80, 20);
      }
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(270, 25, 60, 10, 5);
      } else {
        ctx.rect(270, 25, 60, 10);
      }
      ctx.fill();

      // Helper function to load an image
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous"; // Avoid CORS taint
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load image: " + src));
          img.src = src;
        });
      };

      // Load logo, photo, and QR code
      const baseUrl = getBackendUrl().replace("/api/v1", "");
      const photoSrc = `${baseUrl}/uploads/${employee.employee_id}/front.jpg?t=${Date.now()}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${employee.employee_id}`;

      let logoImg: HTMLImageElement | null = null;
      if (companyLogo) {
        try {
          logoImg = await loadImage(companyLogo);
        } catch (e) {
          console.warn("Could not load company logo for canvas", e);
        }
      }

      let photoImg: HTMLImageElement | null = null;
      try {
        photoImg = await loadImage(photoSrc);
      } catch (e) {
        console.warn("Could not load profile photo for canvas", e);
      }

      let qrImg: HTMLImageElement | null = null;
      try {
        qrImg = await loadImage(qrSrc);
      } catch (e) {
        console.warn("Could not load QR code for canvas", e);
      }

      // Draw Company Logo
      if (logoImg) {
        const logoAspectRatio = logoImg.width / logoImg.height;
        const logoHeight = 45;
        const logoWidth = logoHeight * logoAspectRatio;
        ctx.drawImage(logoImg, 50, 75, logoWidth, logoHeight);
        
        // Draw Company Name next to logo
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(companyName, 65 + logoWidth, 106);
      } else {
        // Draw default badge branding text
        ctx.fillStyle = themeStyles.primaryHex;
        ctx.font = "black 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("NETRAID", 300, 100);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(companyName.toUpperCase(), 300, 130);
      }

      // Draw Profile Picture Container (with double border)
      const photoX = 200;
      const photoY = 220;
      const photoSize = 200;

      // Draw Photo Outer border (theme accent color)
      ctx.strokeStyle = themeStyles.primaryHex;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();

      // Clip and Draw Photo
      ctx.save();
      ctx.beginPath();
      ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      if (photoImg) {
        ctx.drawImage(photoImg, photoX, photoY, photoSize, photoSize);
      } else {
        // Draw placeholder avatar
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 80px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", photoX + photoSize / 2, photoY + photoSize / 2);
      }
      ctx.restore();

      // Draw Holographic checkmark seal on Canvas
      ctx.save();
      const sealX = photoX + photoSize - 35;
      const sealY = photoY + photoSize - 35;
      const sealSize = 45;
      const sealGrad = ctx.createLinearGradient(sealX, sealY, sealX + sealSize, sealY + sealSize);
      sealGrad.addColorStop(0, "#fbbf24");
      sealGrad.addColorStop(0.5, "#fb923c");
      sealGrad.addColorStop(1, "#fde047");
      ctx.fillStyle = sealGrad;
      ctx.beginPath();
      ctx.arc(sealX + sealSize / 2, sealY + sealSize / 2, sealSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Draw small tick
      ctx.strokeStyle = "#451a03"; // deep amber
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(sealX + 13, sealY + 22);
      ctx.lineTo(sealX + 20, sealY + 29);
      ctx.lineTo(sealX + 32, sealY + 16);
      ctx.stroke();
      ctx.restore();

      // Draw Employee Details
      ctx.fillStyle = "#0f172a"; // slate-900
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(employee.name.toUpperCase(), 300, 480);

      ctx.fillStyle = themeStyles.primaryHex; // theme color designation
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(employee.designation?.toUpperCase() || "STAFF MEMBER", 300, 515);

      // Separator Line
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 545);
      ctx.lineTo(500, 545);
      ctx.stroke();

      // Draw metadata labels
      ctx.textAlign = "left";
      ctx.fillStyle = "#64748b"; // slate-500
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("EMPLOYEE ID", 100, 580);
      ctx.fillText("DEPARTMENT", 320, 580);
      ctx.fillText("DATE OF JOIN", 100, 640);
      ctx.fillText("STATUS", 320, 640);

      // Draw metadata values
      ctx.fillStyle = "#0f172a"; // slate-900
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(employee.employee_id, 100, 605);
      ctx.fillText(employee.department?.name?.toUpperCase() || "GENERAL", 320, 605);
      
      const joinDate = employee.joining_date ? new Date(employee.joining_date).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric"
      }) : "N/A";
      ctx.fillText(joinDate.toUpperCase(), 100, 665);
      
      // Draw status with verified indicator
      ctx.fillStyle = themeStyles.primaryHex;
      ctx.fillText("VERIFIED", 320, 665);

      // 4. Bottom section: QR Code
      const qrSize = 130;
      const qrX = 235;
      const qrY = 710;

      // Draw QR border / background card
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 15);
      } else {
        ctx.rect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);
      }
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (qrImg) {
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } else {
        // Draw placeholder QR
        ctx.strokeStyle = "#cbd5e1";
        ctx.strokeRect(qrX, qrY, qrSize, qrSize);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("QR CODE", qrX + qrSize / 2, qrY + qrSize / 2);
      }

      ctx.fillStyle = "#64748b"; // slate-500
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SCAN AS BACKUP IF KIOSK FACE RECOGNITION FAILS", 300, 875);

      // Trigger download of the image
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `ID_Card_${employee.employee_id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("ID Card PNG downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate and download ID Card image: " + err.message);
    }
  };

  // Webcam controls
  const startWebcam = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: "user" 
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setWebcamActive(true);
    } catch {
      setErrorMsg("Webcam permission denied. Check your browser settings.");
    }
  };

  const stopWebcam = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamActive(false);
  };

  useEffect(() => {
    return () => stopWebcam();
  }, []);

  // Trigger auto capture session
  const startAutoCapture = async () => {
    setCapturedImages({});
    setCurrentPoseIndex(0);
    setCountdown(3);
    setIsPaused(false);
    setSingleRetakePose(null);
    setCaptureState("capturing");
    await startWebcam();
  };

  // Automated capture timer loop
  useEffect(() => {
    if (captureState !== "capturing" || isPaused || !webcamActive) return;

    const currentKey = POSE_KEYS[currentPoseIndex];
    if (!currentKey) {
      // Completed all poses
      stopWebcam();
      setCaptureState("review");
      return;
    }

    // Speak pose directions on start of each pose countdown
    if (countdown === 3) {
      speakDirection(POSES[currentKey].speech);
    }

    countdownIntervalRef.current = setInterval(() => {
      if (countdown <= 1) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        captureFrame(currentKey);
      } else {
        playSound("beep");
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [captureState, currentPoseIndex, countdown, isPaused, webcamActive]);

  // Capture current frame from HTML5 Video
  const captureFrame = (poseKey: string) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState < 2) return;

    canvas.width = 640;
    canvas.height = 480;
    
    // Draw mirrored video frame
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.90);
    playSound("click");

    setCapturedImages((prev) => ({ ...prev, [poseKey]: base64 }));

    if (singleRetakePose) {
      // Re-taking a single pose from review screen
      stopWebcam();
      setSingleRetakePose(null);
      setCaptureState("review");
    } else {
      // Auto sequence: Move to next pose
      setCurrentPoseIndex((prev) => prev + 1);
      setCountdown(3);
    }
  };

  // Perform single re-take for a specific pose
  const handleRetakeSingle = async (poseKey: string) => {
    setSingleRetakePose(poseKey);
    setSelectedPose(poseKey);
    setCountdown(3);
    setIsPaused(false);
    setCaptureState("capturing");
    
    // Set index to match keys
    const index = POSE_KEYS.indexOf(poseKey);
    setCurrentPoseIndex(index);
    await startWebcam();
  };

  // Standard Base64 to Blob helper
  const base64ToBlob = (base64Data: string, contentType = "image/jpeg") => {
    const byteString = atob(base64Data.split(",")[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: contentType });
  };

  // Sequential batch upload to FastAPI backend
  const saveBiometricProfile = async () => {
    setCaptureState("saving");
    setErrorMsg(null);
    setUploadProgress(0);

    const keysToUpload = POSE_KEYS;
    let completedCount = 0;

    for (let i = 0; i < keysToUpload.length; i++) {
      const key = keysToUpload[i];
      const base64 = capturedImages[key];
      if (!base64) continue;

      setUploadIndex(i + 1);

      try {
        // Convert base64 data url to blob
        const blob = base64ToBlob(base64, "image/jpeg");

        const fd = new FormData();
        fd.append("employee_id", employeeId as string);
        fd.append("pose_type", key);
        fd.append("file", blob, `${key}.jpg`);

        await fetchApi("/enrollment/upload", { method: "POST", body: fd });
        completedCount++;
        setUploadProgress((completedCount / keysToUpload.length) * 100);
      } catch (err: any) {
        setErrorMsg(`Failed to save pose '${POSES[key].label}': ${err.message || "Network Error"}.`);
        setCaptureState("review");
        return;
      }
    }

    refetchStatus();
    setPhotoTimestamp(Date.now());
    setCaptureState("success");
  };

  // Manual fallback file upload
  const [selectedPose, setSelectedPose] = useState("front");
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCapturedImages(prev => ({ ...prev, [selectedPose]: base64 }));
        if (captureState === "idle") {
          setCaptureState("review");
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process photo.");
    }
    e.target.value = "";
  };

  // Progress Calculations
  const enrolledCount = status?.enrolled_poses?.length || 0;
  const isProfileComplete = status?.is_complete || false;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-5xl page-enter relative print-reset-container">
        {/* CSS Scanner Animations style block */}
        <style>{`
          @keyframes scanline {
            0% { top: 0%; opacity: 0; }
            5% { opacity: 1; }
            95% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes pulse-ring {
            0% { transform: scale(0.92); opacity: 0.15; }
            50% { transform: scale(1.08); opacity: 0.5; }
            100% { transform: scale(0.92); opacity: 0.15; }
          }
          .scanner-line {
            position: absolute;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(to right, transparent, #22d3ee, transparent);
            box-shadow: 0 0 12px #22d3ee, 0 0 24px #0891b2;
            animation: scanline 3s linear infinite;
            z-index: 10;
            pointer-events: none;
          }
          .scanner-target {
            position: absolute;
            width: 65%;
            height: auto;
            aspect-ratio: 1 / 1;
            max-width: 260px;
            max-height: 260px;
            border: 1px dashed rgba(34, 211, 238, 0.4);
            border-radius: 50%;
            animation: pulse-ring 2.5s ease-in-out infinite;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .hud-corner {
            position: absolute;
            width: 20px;
            height: 20px;
            border-color: #22d3ee;
            border-width: 2px;
            pointer-events: none;
          }
          @keyframes draw-check {
            0% { stroke-dashoffset: 48; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes scale-up {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes success-glowing {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
            70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          .success-circle {
            animation: scale-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, success-glowing 2s infinite;
          }
          .success-check {
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: draw-check 0.6s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards;
          }
        `}</style>

        <canvas ref={canvasRef} className="hidden" />

        {/* ─── Breadcrumbs & Header ─── */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-250/60">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/employees")}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-[11px] font-semibold uppercase tracking-wider"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Employees
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-md">
                <span className="text-sm font-extrabold text-white font-mono uppercase">
                  {employee?.name?.split(" ").map((n: string) => n[0]).join("").substring(0, 2) || "?"}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Facial Enrollment</h1>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  NAME: <span className="font-bold text-slate-700">{employee?.name}</span> · ID: <span className="font-bold text-slate-700">{employee?.employee_id}</span>
                </p>
              </div>
            </div>
          </div>

          {enrolledCount > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 text-[11.5px] font-bold text-rose-600 hover:text-white bg-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Biometric Data
            </button>
          )}
        </div>

        {/* ─── Status Feedback Bar ─── */}
        {errorMsg && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-shake">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* ─── State 1: IDLE / STARTER SCREEN ─── */}
        {captureState === "idle" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Box: Progress and instructions */}
            <div className="space-y-5">
              <div className="tech-card-3d-minimal bg-white p-5 space-y-4">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Facial Registry</h3>
                
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600">
                    <span>Database Status:</span>
                    <span className={`inline-flex items-center gap-1.5 ${isProfileComplete ? "text-emerald-600" : "text-amber-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isProfileComplete ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                      {isProfileComplete ? "Complete" : "Incomplete"}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-650">
                      <span>Active Vectors:</span>
                      <span>{enrolledCount} / {POSE_KEYS.length}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/40">
                      <div 
                        className="bg-cyan-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${(enrolledCount / POSE_KEYS.length) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={startAutoCapture}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-850"
                >
                  <Camera className="w-4 h-4 text-cyan-400 animate-pulse" />
                  Start Auto-Capture Session
                </button>
              </div>

              {/* Upload Fallback File Option */}
              <div className="tech-card-3d-minimal bg-white p-5 space-y-3">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Manual Photo Upload</h4>
                <div className="flex gap-2">
                  <select
                    value={selectedPose}
                    onChange={(e) => setSelectedPose(e.target.value)}
                    className="h-9.5 px-3 text-[11px] font-extrabold bg-white border border-slate-200 rounded-lg flex-1 outline-none text-slate-700 focus:border-slate-800 cursor-pointer"
                  >
                    {POSE_KEYS.map((key) => (
                      <option key={key} value={key}>{POSES[key].label}</option>
                    ))}
                  </select>
                  <label className="relative cursor-pointer shrink-0">
                    <input
                      type="file" accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="h-9.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95">
                      <Upload className="w-3.5 h-3.5" />
                      Browse
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Big visual grid checklist */}
            <div className="md:col-span-2 tech-card-3d-minimal bg-white p-6 space-y-4">
              <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider">Facial Pose Checklist</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 pt-2">
                {POSE_KEYS.map((key) => {
                  const done = status?.enrolled_poses?.some((p: string) => p.toLowerCase() === key.toLowerCase());
                  const Icon = POSES[key].icon;
                  return (
                    <div
                      key={key}
                      className={`p-4 flex flex-col items-center text-center justify-center transition-all duration-300 select-none cursor-default border rounded-2xl hover:translate-y-[-2px] ${
                        done
                          ? "bg-emerald-50/40 border-emerald-500/40 text-emerald-800 shadow-[2px_2px_0px_rgba(16,185,129,0.15)]"
                          : "bg-white border-slate-200/80 hover:border-slate-400 hover:shadow-[2px_2px_0px_rgba(15,23,42,0.08)]"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 transition-all ${
                        done
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-slate-50 border border-slate-200 text-slate-400"
                      }`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${done ? "text-emerald-800" : "text-slate-500"}`}>
                        {POSES[key].label.replace(" Profile", "").replace(" Face", "").replace(" Option", "").replace(" Light", "")}
                      </span>
                      {done ? (
                        <div className="flex items-center gap-1.5 mt-3 justify-center w-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to clear and re-take/re-upload the ${POSES[key].label}?`)) {
                                deletePoseMutation.mutate(key);
                              }
                            }}
                            className="p-1 hover:bg-rose-100/60 hover:text-rose-600 rounded text-slate-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                            title="Delete and re-upload this pose"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-200 mt-3 shrink-0 bg-white" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── State 2: AUTOMATIC SCANNER HUD FEED ─── */}
        {captureState === "capturing" && (
          <div className="flex flex-col items-center space-y-5">
            {/* Pose directions banner */}
            <div className="w-full bg-slate-950 text-white rounded-2xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] pointer-events-none" />
              <div className="flex items-center gap-4 relative z-10">
                {(() => {
                  const Icon = POSES[POSE_KEYS[currentPoseIndex]]?.icon;
                  return (
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 text-cyan-400">
                      {Icon && <Icon className="w-6 h-6" />}
                    </div>
                  );
                })()}
                <div>
                  <p className="text-[10px] font-bold text-cyan-400 font-mono tracking-widest uppercase">
                    SCAN PHASE {currentPoseIndex + 1} OF {POSE_KEYS.length}
                  </p>
                  <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                    {POSES[POSE_KEYS[currentPoseIndex]]?.label}
                  </h2>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    {POSES[POSE_KEYS[currentPoseIndex]]?.hint}
                  </p>
                </div>
              </div>

              {/* Countdown circle HUD */}
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0 border-2 border-white/10 rounded-full font-mono bg-white/5 shadow-inner">
                <span className="text-2xl font-black text-cyan-400 animate-pulse">{countdown}</span>
              </div>
            </div>

            {/* Video stream container with Cybernetic HUD */}
            <div className="relative aspect-[3/4] md:aspect-video w-full max-w-3xl rounded-3xl overflow-hidden bg-black border border-slate-950 shadow-2xl">
              
              {/* Native video element */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${isPaused ? "opacity-20" : "opacity-100"}`}
                autoPlay playsInline muted
              />

              {/* Paused Overlay */}
              {isPaused && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-20 transition-all duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg text-white mb-3 animate-pulse">
                    <Pause className="w-8 h-8 fill-current text-cyan-400" />
                  </div>
                  <p className="text-[11px] font-bold text-cyan-400 font-mono tracking-widest uppercase">
                    SYS.STATUS: SCAN_PAUSED
                  </p>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    Camera turned off to preserve resources & privacy.
                  </p>
                </div>
              )}

              {/* Cybernetic HUD elements */}
              {!isPaused && <div className="scanner-line" />}
              {!isPaused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="scanner-target">
                    <div className="w-4 h-4 border border-cyan-400 rounded-full animate-ping" />
                  </div>
                </div>
              )}

              {/* HUD corners */}
              <div className="hud-corner corner-bracket-tl top-6 left-6 border-t-2 border-l-2" />
              <div className="hud-corner corner-bracket-tr top-6 right-6 border-t-2 border-r-2" />
              <div className="hud-corner corner-bracket-bl bottom-6 left-6 border-b-2 border-l-2" />
              <div className="hud-corner corner-bracket-br bottom-6 right-6 border-b-2 border-r-2" />

              {/* Scanner stats HUD */}
              <div className="absolute top-6 left-12 right-12 flex justify-between text-[9px] font-mono font-bold text-cyan-400/80 pointer-events-none uppercase">
                <span>SYS.STATUS: {isPaused ? "SCAN_PAUSED" : "ACQUIRING_DATA"}</span>
                <span>FPS: {isPaused ? "0" : "60"} · ISO: 200 · SHUTTER: AUTO</span>
              </div>

              <div className="absolute bottom-6 left-12 right-12 flex justify-between items-center text-[9px] font-mono font-bold text-cyan-400/80 pointer-events-none">
                <span>ANGLE: {POSE_KEYS[currentPoseIndex]?.toUpperCase()}</span>
                <span>LIVENESS CHECK: {isPaused ? "INACTIVE" : "ACTIVE"}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 w-full max-w-lg">
              <button
                onClick={async () => {
                  if (isPaused) {
                    setIsPaused(false);
                    await startWebcam();
                  } else {
                    setIsPaused(true);
                    stopWebcam();
                  }
                }}
                className="flex-1 h-11 bg-white hover:bg-slate-50 border border-slate-250 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                {isPaused ? "Resume Scan" : "Pause Scan"}
              </button>

              <button
                onClick={async () => {
                  if (singleRetakePose) {
                    stopWebcam();
                    setSingleRetakePose(null);
                    setCaptureState("review");
                  } else {
                    // Skip pose
                    setCurrentPoseIndex(prev => prev + 1);
                    setCountdown(3);
                    if (isPaused) {
                      setIsPaused(false);
                      await startWebcam();
                    }
                  }
                }}
                className="flex-1 h-11 bg-slate-950 hover:bg-slate-900 border border-slate-950 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                Skip Pose
              </button>
            </div>
          </div>
        )}

        {/* ─── State 3: REVIEW CAPTURES GRID ─── */}
        {captureState === "review" && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center max-w-2xl mx-auto space-y-2">
              <Sparkles className="w-6 h-6 text-slate-900 mx-auto animate-pulse" />
              <h2 className="text-base font-black text-slate-900 tracking-tight">Scan Sequence Completed</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Review the 10 captured biometric pose frames. If any photo is blurry or dark, click the re-take icon. Once ready, click "Save Biometric Profile".
              </p>
            </div>

            {/* Grid of 10 captured poses */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {POSE_KEYS.map((key) => {
                const imgUrl = capturedImages[key];
                return (
                  <div key={key} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs relative flex flex-col group overflow-hidden">
                    <div className="aspect-[4/3] rounded-xl bg-slate-100 overflow-hidden relative border border-slate-150">
                      {imgUrl ? (
                        <img src={imgUrl} alt={key} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider bg-slate-50">
                          Missing
                        </div>
                      )}

                      {/* Hover action bar to retake */}
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleRetakeSingle(key)}
                          className="bg-white hover:bg-slate-100 text-slate-900 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Re-take
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-900 uppercase font-mono">{POSES[key].label.replace(" Profile", "").replace(" Face", "").replace(" Option", "").replace(" Light", "")}</span>
                      {imgUrl ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Review actions */}
            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={startAutoCapture}
                className="h-11 px-8 bg-white hover:bg-slate-50 border border-slate-250 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Discard & Re-take All
              </button>

              <button
                onClick={saveBiometricProfile}
                className="h-11 px-8 bg-slate-950 hover:bg-slate-900 border border-slate-950 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Biometric Profile
              </button>
            </div>
          </div>
        )}

        {/* ─── State 4: BATCH SAVING ANIMATION ─── */}
        {captureState === "saving" && (
          <div className="max-w-md mx-auto bg-white border border-slate-250/80 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-scaleIn relative overflow-hidden">
            {/* Spinning radar graphic */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/30 animate-spin" />
              <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/40 animate-spin" style={{ animationDirection: "reverse" }} />
              <Shield className="w-10 h-10 text-cyan-500 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-widest font-mono">
                Saving Facial Registry...
              </h2>
              <p className="text-xs text-slate-500">
                Uploading photo {uploadIndex} of {POSE_KEYS.length} to security gateway.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-cyan-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono font-bold text-slate-550">
                <span>DATABASE VECTOR INDEXING</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── State 5: SUCCESS SCREEN ─── */}
        {captureState === "success" && (
          <div className="max-w-5xl mx-auto space-y-6 print-reset-container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start animate-scaleIn print-reset-container">
              
              {/* Left Column: Success message box & Control Panel */}
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-md text-center space-y-6 no-print">
                <div className="relative w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 success-circle">
                  <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" className="success-check" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Biometric Profile Secured</h2>
                  <p className="text-xs text-slate-550 leading-relaxed">
                    All 10 facial profiles and mathematical vectors have been successfully registered for <strong className="text-slate-800">{employee?.name}</strong>. The kiosk scan terminal is now ready to verify attendance.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl text-left border border-slate-150 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">System Integrity Verification</h4>
                  <ul className="text-[10px] text-slate-500 font-mono space-y-1">
                    <li className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      10/10 BIOMETRIC POSES RECORDED
                    </li>
                    <li className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      HNSW VECTOR INDEX UPDATED
                    </li>
                    <li className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      BACKUP SECURITY QR CODE ENCODED
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => router.push("/employees")}
                    className="h-10 bg-white hover:bg-slate-55 border border-slate-250 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Employees List
                  </button>

                  <button
                    onClick={startAutoCapture}
                    className="h-10 bg-slate-100 hover:bg-slate-150 border border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Re-enroll
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <p className="text-[10.5px] text-slate-450 leading-relaxed">
                    Generate the physical identification card below. Keep a digital copy or print immediately.
                  </p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => window.print()}
                      className={`flex-1 h-11 ${themeStyles.headerBg} hover:opacity-90 text-white font-extrabold text-[11px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98] border border-white/10 cursor-pointer`}
                    >
                      <Printer className="w-4 h-4 text-white/90" />
                      Print ID Badge
                    </button>

                    <button
                      onClick={handleDownloadBadge}
                      className="flex-1 h-11 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-[11px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-slate-650" />
                      Download PNG
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: ID Card Gorgeous 3D Preview */}
              <div className="flex flex-col items-center justify-center print-reset-container">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-mono no-print">
                  Badge Live Preview ({badgeTheme} + {badgePattern})
                </div>
                
                {/* Printable ID Card Element */}
                <div 
                  id="printable-id-card-wrap"
                  className="w-[320px] h-[500px] bg-white rounded-[24px] border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.08)] overflow-hidden relative flex flex-col transition-all hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] duration-300 select-none font-sans animate-fadeIn"
                >
                  {/* Watermark Pattern Overlay */}
                  <BadgeWatermark type={badgePattern} />

                  {/* Holographic Glossy Overlay (Premium aesthetic) */}
                  <div className="absolute inset-0 bg-linear-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none z-10" />

                  {/* Lanyard punch hole detail */}
                  <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-10 h-3 bg-slate-100 rounded-full border border-slate-200/50 flex items-center justify-center pointer-events-none no-print">
                    <div className="w-6 h-1 bg-slate-300 rounded-full" />
                  </div>

                  {/* Header: Company Name & Logo */}
                  <div className={`h-[105px] ${themeStyles.headerBg} relative flex flex-col justify-end px-5 pb-3`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_70%)] pointer-events-none" />
                    
                    <div className="flex items-center gap-3.5 mt-2 relative z-10">
                      {companyLogo ? (
                        <img 
                          src={companyLogo} 
                          alt="Logo" 
                          className="h-8 max-w-[90px] object-contain shrink-0" 
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white text-[10px] font-black tracking-tighter shadow-sm font-mono shrink-0 border border-white/10">
                          NID
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-black tracking-wider text-white uppercase truncate">
                          {companyName}
                        </span>
                        <span className="text-[7.5px] font-bold text-white/80 tracking-widest uppercase">
                          SECURED IDENTITY CARD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 flex flex-col items-center pt-7 px-6 relative bg-transparent z-10">
                    
                    {/* Employee Profile Image Container */}
                    <div className={`relative w-[120px] h-[120px] rounded-full p-1 bg-gradient-to-tr ${themeStyles.photoBorder} shadow-md`}>
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-slate-100">
                        <img
                          src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${employee?.employee_id}/front.jpg?t=${photoTimestamp}`}
                          alt={employee?.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Holographic Official Seal */}
                      <div className="absolute -bottom-1.5 -right-1.5 bg-gradient-to-tr from-amber-400 via-orange-400 to-yellow-300 text-amber-950 font-bold border-2 border-white rounded-full w-6 h-6 flex items-center justify-center shadow-md z-10 pointer-events-none">
                        <svg className="w-3.5 h-3.5 stroke-amber-950" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </div>

                    {/* Employee Identity details */}
                    <div className="text-center mt-4 space-y-0.5">
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight uppercase leading-tight">
                        {employee?.name}
                      </h3>
                      <p className={`text-[11px] font-bold ${themeStyles.accentText} tracking-widest uppercase`}>
                        {employee?.designation || "Staff Member"}
                      </p>
                    </div>

                    {/* Meta Fields Table */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 w-full border-t border-slate-100 mt-5 pt-3.5 bg-transparent">
                      <div>
                        <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                          Employee ID
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-800 tracking-tight block">
                          {employee?.employee_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                          Department
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-800 tracking-tight block truncate uppercase">
                          {employee?.department?.name || "General"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                          Date of Join
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-800 tracking-tight block">
                          {employee?.joining_date ? new Date(employee.joining_date).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric"
                          }) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                          Security Status
                        </span>
                        <span className={`text-[10px] font-bold ${themeStyles.accentText} tracking-tight flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${themeStyles.dotColor}`} />
                          VERIFIED
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Fallback Section */}
                  <div className="bg-slate-50/80 backdrop-blur-xs border-t border-slate-100 h-[105px] flex items-center justify-center pb-1.5 shrink-0 z-10">
                    {/* QR Code Container */}
                    <div className="w-[72px] h-[72px] bg-white rounded-lg border border-slate-200/80 p-1 flex items-center justify-center shadow-2xs shrink-0 font-mono">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${employee?.employee_id}`}
                        alt="QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Styling Injected locally */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                /* Hide sidebar, headers, footers and any elements marked no-print */
                aside, header, footer, .no-print, button, input, select, [role="navigation"], .ambient-bg, .mesh-bg {
                  display: none !important;
                }
                
                @page {
                  size: portrait;
                  margin: 0;
                }
                
                /* Reset container layout models so they don't center, shift or clip the content */
                html, body, html.dark, body.dark {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  overflow: hidden !important;
                  background-color: white !important;
                  background: white !important;
                  position: relative !important;
                }

                /* Reset only parent layout hierarchy, leaving internal elements of card intact */
                main, 
                body > div,
                #sidebar-layout-container, 
                .sidebar-layout-content, 
                .print-reset-container,
                .page-enter,
                .dark main,
                .dark body > div,
                .dark #sidebar-layout-container,
                .dark .sidebar-layout-content,
                .dark .print-reset-container,
                .dark .page-enter {
                  border: none !important;
                  box-shadow: none !important;
                  background: transparent !important;
                  background-color: transparent !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  height: auto !important;
                  min-height: 0 !important;
                  overflow: visible !important;
                  position: static !important;
                  width: auto !important;
                  display: block !important;
                  /* Clear transform/animations that would trap fixed/absolute positioning context */
                  transform: none !important;
                  animation: none !important;
                  transition: none !important;
                }
                
                /* Center and display only the card wrapper */
                #printable-id-card-wrap {
                  display: flex !important;
                  flex-direction: column !important;
                  visibility: visible !important;
                  position: fixed !important;
                  left: 50% !important;
                  top: 50% !important;
                  transform: translate(-50%, -50%) scale(1.1) !important;
                  border: 1px solid #cbd5e1 !important;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
                  border-radius: 24px !important;
                  background-color: white !important;
                  width: 320px !important;
                  height: 500px !important;
                  margin: 0 !important;
                  overflow: hidden !important;
                  page-break-inside: avoid;
                }

                #printable-id-card-wrap * {
                  visibility: visible !important;
                }
                
                /* Force print watermark color & visibility */
                .badge-watermark-container,
                .dark .badge-watermark-container {
                  color: #475569 !important;
                  opacity: 0.12 !important;
                }
                
                /* Ensure background colors and images print properly */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            ` }} />
          </div>
        )}


      </div>

      {/* Clear Biometric Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop z-50">
          <div className="modal-content max-w-sm border border-red-500/10 shadow-[0_12px_40px_rgba(239,68,68,0.12)]">
            <div className="flex flex-col items-center text-center p-2 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center text-rose-500 shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Clear Biometric Data</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Wipe all registered biometric vectors and images for <span className="font-semibold text-[var(--text-primary)]">{employee?.name}</span>?
                </p>
                <p className="text-[10.5px] text-rose-500 font-medium bg-rose-500/5 border border-rose-500/10 rounded-xl p-2.5 mt-3 leading-normal">
                  Warning: This cannot be undone and the user will not be able to log in or register attendance at the kiosk until re-enrolled.
                </p>
              </div>
              <div className="flex gap-2.5 w-full pt-2 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setShowClearConfirm(false)} 
                  className="flex-1 btn-ghost h-9.5 text-[12px] rounded-xl cursor-pointer hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    clearMutation.mutate();
                    setShowClearConfirm(false);
                  }}
                  disabled={clearMutation.isPending}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-[12px] rounded-xl cursor-pointer h-9.5 flex items-center justify-center gap-2 shadow-md shadow-rose-950/20 border border-rose-500/20"
                >
                  {clearMutation.isPending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Wipe Data"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
