"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi, getBackendUrl } from "@/app/utils/api";
import { 
  Camera, Upload, CheckCircle2, ChevronLeft, XCircle, RefreshCw, AlertCircle, 
  Play, Pause, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Smile, Meh, Lightbulb, Sun, Glasses, User,
  Trash2, RotateCcw, Sparkles
} from "lucide-react";

interface PoseInfo {
  label: string;
  hint: string;
  speech: string;
  icon: any;
}

const POSES: Record<string, PoseInfo> = {
  front: { label: "Front Profile", hint: "Look straight into the camera.", speech: "Please look straight into the camera.", icon: User },
  left: { label: "Left Profile", hint: "Turn your head to the left.", speech: "Please turn your head to the left.", icon: ArrowLeft },
  right: { label: "Right Profile", hint: "Turn your head to the right.", speech: "Please turn your head to the right.", icon: ArrowRight },
  up: { label: "Looking Up", hint: "Tilt your chin upwards slightly.", speech: "Please tilt your head upwards.", icon: ArrowUp },
  down: { label: "Looking Down", hint: "Tilt your chin downwards slightly.", speech: "Please tilt your head downwards.", icon: ArrowDown },
  smile: { label: "Smiling Face", hint: "Give a natural, relaxed smile.", speech: "Now, smile naturally.", icon: Smile },
  neutral: { label: "Neutral Face", hint: "Keep a standard neutral expression.", speech: "Relax your face, show a neutral expression.", icon: Meh },
  indoor: { label: "Indoor Light", hint: "Look straight under typical indoor light.", speech: "Look straight for typical indoor lighting.", icon: Lightbulb },
  outdoor: { label: "Outdoor Light", hint: "Look straight with bright/outdoor light.", speech: "Look straight for bright light capture.", icon: Sun },
  glasses: { label: "Glasses Option", hint: "With glasses on (if applicable), or straight.", speech: "If you wear glasses, put them on. Otherwise, look straight.", icon: Glasses }
};

const POSE_KEYS = Object.keys(POSES);

export default function SelfOnboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employee_id");

  const [employeeName, setEmployeeName] = useState("");
  const [enrolledPoses, setEnrolledPoses] = useState<string[]>([]);
  
  // State Machine: "idle" | "capturing" | "review" | "saving" | "done"
  const [captureState, setCaptureState] = useState<"idle" | "capturing" | "review" | "saving" | "done">("idle");
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [singleRetakePose, setSingleRetakePose] = useState<string | null>(null);
  
  // Local previews for capturing session
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({});
  
  // Upload status info
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load employee details & enrollment status
  const fetchStatus = async () => {
    if (!employeeId) return;
    try {
      const data = await fetchApi(`/enrollment/status/${employeeId}`);
      setEmployeeName(data.name);
      setEnrolledPoses(data.enrolled_poses || []);
      if (data.is_complete) {
        setCaptureState("done");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load onboarding status.");
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchStatus();
    } else {
      router.push("/");
    }
  }, [employeeId]);

  // Audio & Speech synthesizers
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
        osc.type = "triangle";
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch (e) {
      console.warn("Failed to generate audio feedback:", e);
    }
  };

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

  // Start webcam stream
  const startWebcam = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setWebcamActive(true);
    } catch {
      setErrorMsg("Camera access denied. Please grant webcam permissions or upload files manually.");
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
      stopWebcam();
      setCaptureState("review");
      return;
    }

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

  // Capture frame
  const captureFrame = (poseKey: string) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState < 2) return;

    canvas.width = 640;
    canvas.height = 480;
    
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.90);
    playSound("click");

    setCapturedImages((prev) => ({ ...prev, [poseKey]: base64 }));

    if (singleRetakePose) {
      stopWebcam();
      setSingleRetakePose(null);
      setCaptureState("review");
    } else {
      setCurrentPoseIndex((prev) => prev + 1);
      setCountdown(3);
    }
  };

  const handleRetakeSingle = async (poseKey: string) => {
    setSingleRetakePose(poseKey);
    setCountdown(3);
    setIsPaused(false);
    setCaptureState("capturing");
    
    const index = POSE_KEYS.indexOf(poseKey);
    setCurrentPoseIndex(index);
    await startWebcam();
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

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
        const blob = dataURLtoBlob(base64);

        const fd = new FormData();
        fd.append("employee_id", employeeId as string);
        fd.append("pose_type", key);
        fd.append("file", blob, `${key}.jpg`);

        await fetchApi("/auth/self-onboard/upload", { method: "POST", body: fd });
        completedCount++;
        setUploadProgress((completedCount / keysToUpload.length) * 100);
      } catch (err: any) {
        setErrorMsg(`Failed to save pose '${POSES[key].label}': ${err.message || "Network Error"}.`);
        setCaptureState("review");
        return;
      }
    }

    await fetchStatus();
    setCaptureState("done");
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

  const enrolledCount = enrolledPoses.length;
  const isProfileComplete = enrolledCount >= POSE_KEYS.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between">
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
      `}</style>

      {/* Background Gradients */}
      <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0" />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none z-0 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[130px] pointer-events-none z-0 animate-pulse" />

      {/* Header */}
      <header className="w-full h-16 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md px-6 flex items-center justify-between relative z-10">
        <span className="text-sm font-extrabold tracking-tight text-white uppercase font-mono">NetraID Self-Onboarding</span>
        <button
          onClick={() => {
            stopWebcam();
            router.push("/");
          }}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Cancel Onboarding
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <canvas ref={canvasRef} className="hidden" />

        {captureState === "done" ? (
          /* SUCCESS VIEW */
          <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 backdrop-blur-2xl p-8 rounded-3xl text-center space-y-6 shadow-2xl animate-fadeInUp">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Profile Submitted!</h2>
              <p className="text-slate-400 text-xs leading-relaxed font-light">
                Hello <span className="font-bold text-cyan-400">{employeeName}</span>, your biometric enrollment is complete. Your account is now pending administrator review. Once approved, you can log in to your dashboard.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="w-full h-11 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Return to Login Portal
            </button>
          </div>
        ) : captureState === "idle" ? (
          /* IDLE / STARTING SCREEN */
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            
            {/* Checklist & instructions */}
            <div className="bg-slate-900/40 border border-slate-850 backdrop-blur-xl rounded-2xl p-5 space-y-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-cyan-400 uppercase">Step 2 of 2</span>
                <h2 className="text-base font-black text-white mt-1">Biometric Scanner</h2>
                <p className="text-[10.5px] text-slate-400 font-light mt-0.5 leading-relaxed">
                  Welcome <span className="font-bold text-slate-200">{employeeName}</span>. Capture at least 10 face profiles to register your profile.
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                  <span>Database Status:</span>
                  <span className={`inline-flex items-center gap-1.5 ${isProfileComplete ? "text-emerald-400" : "text-amber-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isProfileComplete ? "bg-emerald-450 animate-pulse" : "bg-amber-400"}`} />
                    {isProfileComplete ? "Complete" : "Incomplete"}
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                    <span>Active Vectors:</span>
                    <span>{enrolledCount} / {POSE_KEYS.length}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                    <div 
                      className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${(enrolledCount / POSE_KEYS.length) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={startAutoCapture}
                className="w-full h-11 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <Camera className="w-4 h-4 text-cyan-500 animate-pulse" />
                Start Auto-Capture Session
              </button>

              {/* Upload Fallback File Option */}
              <div className="border-t border-slate-900 pt-4 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Manual Photo Upload</h4>
                <div className="flex gap-2">
                  <select
                    value={selectedPose}
                    onChange={(e) => setSelectedPose(e.target.value)}
                    className="h-9.5 px-3 text-[11px] font-extrabold bg-slate-900 border border-slate-800 rounded-lg flex-1 outline-none text-slate-300 focus:border-cyan-500 cursor-pointer"
                  >
                    {POSE_KEYS.map((key) => (
                      <option key={key} value={key} className="bg-slate-900">{POSES[key].label}</option>
                    ))}
                  </select>
                  <label className="relative cursor-pointer shrink-0">
                    <input
                      type="file" accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="h-9.5 px-4 bg-slate-900 hover:bg-slate-850 text-white font-bold text-[11px] border border-slate-800 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95">
                      <Upload className="w-3.5 h-3.5" />
                      Browse
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Checklist items list */}
            <div className="md:col-span-2 bg-slate-900/40 border border-slate-850 backdrop-blur-xl rounded-2xl p-6 space-y-4">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">Facial Pose Checklist</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 pt-2">
                {POSE_KEYS.map((key) => {
                  const done = enrolledPoses.includes(key);
                  const Icon = POSES[key].icon;
                  return (
                    <div
                      key={key}
                      className={`p-4 flex flex-col items-center text-center justify-center transition-all duration-300 select-none cursor-default border rounded-2xl ${
                        done
                          ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                          : "bg-slate-900/20 border-slate-850 hover:border-slate-800"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 transition-all ${
                        done
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                          : "bg-slate-950 border border-slate-850 text-slate-500"
                      }`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${done ? "text-emerald-400" : "text-slate-400"}`}>
                        {POSES[key].label.replace(" Profile", "").replace(" Face", "").replace(" Option", "").replace(" Light", "")}
                      </span>
                      {done ? (
                        <div className="flex items-center gap-1.5 mt-3 justify-center w-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-800 mt-3 shrink-0 bg-slate-950" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : captureState === "capturing" ? (
          /* AUTOMATIC CAMERA SCANNER HUD */
          <div className="flex flex-col items-center space-y-5 w-full max-w-3xl">
            {/* Pose directions banner */}
            <div className="w-full bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden">
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

            {/* Video stream container with HUD overlay */}
            <div className="relative aspect-[3/4] md:aspect-video w-full rounded-3xl overflow-hidden bg-black border border-slate-900 shadow-2xl">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${isPaused ? "opacity-25" : "opacity-100"}`}
                autoPlay playsInline muted
              />

              {isPaused && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg text-white mb-3">
                    <Pause className="w-8 h-8 fill-current text-cyan-400" />
                  </div>
                  <p className="text-[11px] font-bold text-cyan-400 font-mono tracking-widest uppercase">
                    SYS.STATUS: SCAN_PAUSED
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
                <span>LIVENESS CHECK: ACTIVE</span>
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
                className="flex-1 h-11 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
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
                    setCurrentPoseIndex(prev => prev + 1);
                    setCountdown(3);
                    if (isPaused) {
                      setIsPaused(false);
                      await startWebcam();
                    }
                  }
                }}
                className="flex-1 h-11 bg-slate-900 hover:bg-slate-855 border border-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                Skip Pose
              </button>
            </div>
          </div>
        ) : captureState === "review" ? (
          /* REVIEW CAPTURES GRID */
          <div className="space-y-6 w-full max-w-5xl">
            <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5 text-center max-w-2xl mx-auto space-y-2">
              <Sparkles className="w-6 h-6 text-cyan-400 mx-auto animate-pulse" />
              <h2 className="text-base font-black text-white tracking-tight">Scan Sequence Completed</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Review the 10 captured biometric pose frames. If any photo is blurry or dark, click the re-take icon. Once ready, click "Save Biometric Profile".
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {POSE_KEYS.map((key) => {
                const imgUrl = capturedImages[key];
                return (
                  <div key={key} className="bg-slate-900/30 border border-slate-850 rounded-2xl p-3 shadow-xs relative flex flex-col group overflow-hidden">
                    <div className="aspect-[4/3] rounded-xl bg-slate-955 overflow-hidden relative border border-slate-900">
                      {imgUrl ? (
                        <img src={imgUrl} alt={key} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider bg-slate-955">
                          Missing
                        </div>
                      )}

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
                      <span className="text-slate-350 uppercase font-mono">{POSES[key].label.replace(" Profile", "").replace(" Face", "").replace(" Option", "").replace(" Light", "")}</span>
                      {imgUrl ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-450" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 max-w-md mx-auto pt-4">
              <button
                onClick={() => setCaptureState("idle")}
                className="flex-1 h-11 border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveBiometricProfile}
                className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
                Save Face Profile
              </button>
            </div>
          </div>
        ) : (
          /* SAVING PROGRESS OVERLAY */
          <div className="w-full max-w-md bg-slate-900/40 border border-slate-850 p-8 rounded-3xl text-center space-y-6 shadow-2xl">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-black text-white">Indexing Face Vectors</h3>
              <p className="text-xs text-slate-400 font-mono">
                Uploading Pose {uploadIndex} of {POSE_KEYS.length}
              </p>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900 mt-4">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Running deep liveness check & feature alignment...
            </p>
          </div>
        )}
      </main>

      <footer className="w-full h-12 border-t border-slate-900 bg-slate-950/20 px-6 flex items-center justify-center text-[10px] text-slate-500 font-medium relative z-10">
        © {new Date().getFullYear()} NetraID Inc. All rights reserved.
      </footer>
    </div>
  );
}
