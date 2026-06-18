"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl } from "@/app/utils/api";
import {
  Camera, Upload, CheckCircle2, ChevronLeft, XCircle, Video,
  RefreshCw, AlertCircle, Trash2, Play, Pause, Save, RotateCcw, Shield, Activity, Sparkles,
  User, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Smile, Meh, Lightbulb, Sun, Glasses
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

  const clearMutation = useMutation({
    mutationFn: () => fetchApi(`/enrollment/${employeeId}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchStatus();
      setCapturedImages({});
      setSuccessMsg("All registered facial profiles cleared from database.");
      setErrorMsg(null);
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

  // Webcam controls
  const startWebcam = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" }
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
        const resBlob = await fetch(base64);
        const blob = await resBlob.blob();

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
      <div className="space-y-6 max-w-5xl page-enter relative">
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
            width: 260px;
            height: 260px;
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
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Facial Registry</h3>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-650">
                    <span>Database Status:</span>
                    <span className={isProfileComplete ? "text-emerald-600" : "text-amber-500"}>
                      {isProfileComplete ? "Complete" : "Incomplete"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-650">
                    <span>Active Vectors:</span>
                    <span>{enrolledCount} / {POSE_KEYS.length}</span>
                  </div>
                </div>

                <button
                  onClick={startAutoCapture}
                  className="w-full h-11 bg-slate-950 hover:bg-slate-900 border border-slate-950 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Start Auto-Capture Session
                </button>
              </div>

              {/* Upload Fallback File Option */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-[11.5px] font-bold text-slate-700 uppercase tracking-wider">Manual Photo Upload</h4>
                <p className="text-[10px] text-slate-500 leading-normal">
                  If the employee cannot use a live camera, select a target pose and upload a photo from disk.
                </p>
                <div className="flex gap-2">
                  <select
                    value={selectedPose}
                    onChange={(e) => setSelectedPose(e.target.value)}
                    className="h-9 px-2 text-[11px] font-bold bg-white border border-slate-200 rounded-lg flex-1 outline-none text-slate-700"
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
                    <div className="h-9 px-3.5 bg-white border border-slate-250 text-slate-800 hover:bg-slate-50 font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      Browse
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Big visual grid checklist */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Facial Pose Checklist</h3>
              <p className="text-xs text-slate-500">
                To capture accurate biometric details under varying orientations and lighting, we index 10 distinct facial angles.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 pt-2">
                {POSE_KEYS.map((key) => {
                  const done = status?.enrolled_poses?.some((p: string) => p.toLowerCase() === key.toLowerCase());
                  const Icon = POSES[key].icon;
                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-2xl border flex flex-col items-center text-center justify-center transition-all hover:scale-[1.03] duration-200 select-none ${
                        done
                          ? "bg-emerald-500/[0.03] border-emerald-500/20 text-emerald-800 shadow-[0_2px_12px_rgba(16,185,129,0.02)]"
                          : "bg-slate-50/50 border-slate-200/80 hover:border-slate-350"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 transition-all ${
                        done
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${done ? "text-emerald-800" : "text-slate-505"}`}>
                        {POSES[key].label.replace(" Profile", "").replace(" Face", "").replace(" Option", "").replace(" Light", "")}
                      </span>
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-3 shrink-0" />
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
            <div className="relative aspect-video w-full max-w-3xl rounded-3xl overflow-hidden bg-black border border-slate-950 shadow-2xl">
              
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
          <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-scaleIn">
            <div className="relative w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 success-circle">
              <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" className="success-check" />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Biometric Profile Secured</h2>
              <p className="text-xs text-slate-550 leading-relaxed">
                All 10 facial profiles and mathematical vectors have been successfully registered for <strong className="text-slate-800">{employee?.name}</strong>. The kiosk scan terminal is now ready to verify attendance.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => router.push("/employees")}
                className="h-10 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-950 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
              >
                Employees List
              </button>

              <button
                onClick={startAutoCapture}
                className="h-10 px-6 bg-slate-100 hover:bg-slate-150 border border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Re-enroll Profile
              </button>
            </div>
          </div>
        )}

        {/* ─── Tips Section ─── */}
        {captureState === "idle" && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <AlertCircle className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 font-mono">Registry Specifications</p>
              <p className="text-[10px] text-slate-650 leading-relaxed font-mono uppercase">
                AUTOMATED ENROLLMENT PROCESS IS COMPLETELY HANDS-FREE. SYSTEM WILL INSTRUCT AND SYNC CAMERAS IN SEQUENCE. ENSURE STABLE ROOM LIGHTING AND POSES TO ACCURATELY INDEX FACIAL VECTORS.
              </p>
            </div>
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
