"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi } from "@/app/utils/api";
import {
  Camera, Upload, CheckCircle2, ChevronLeft, XCircle, Video,
  RefreshCw, AlertCircle, Trash2
} from "lucide-react";

const POSES: Record<string, { label: string; hint: string; icon: string }> = {
  front:   { label: "Front",    hint: "Look straight into the camera with neutral expression.", icon: "🧑" },
  left:    { label: "Left",     hint: "Turn head slowly to the left (profile view).", icon: "👈" },
  right:   { label: "Right",    hint: "Turn head slowly to the right (profile view).", icon: "👉" },
  up:      { label: "Up",       hint: "Tilt your chin upwards slightly.", icon: "⬆️" },
  down:    { label: "Down",     hint: "Tilt your chin downwards slightly.", icon: "⬇️" },
  smile:   { label: "Smile",    hint: "Give a natural, relaxed smile.", icon: "😊" },
  neutral: { label: "Neutral",  hint: "Keep a relaxed, standard neutral expression.", icon: "😐" },
  indoor:  { label: "Indoor",   hint: "Enroll with typical indoor room lighting conditions.", icon: "💡" },
  outdoor: { label: "Outdoor",  hint: "Enroll with natural outdoor or bright lighting.", icon: "☀️" },
  glasses: { label: "Glasses",  hint: "Wear glasses if applicable. Optional – skip if not wearing.", icon: "🕶️" },
};

export default function EnrollPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const employeeId = params.id;

  const [selectedPose, setSelectedPose] = useState("front");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    onSuccess: () => { refetchStatus(); setSuccessMsg("All facial data cleared."); setErrorMsg(null); }
  });

  const startWebcam = async () => {
    setErrorMsg(null); setSuccessMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setWebcamActive(true);
    } catch {
      setErrorMsg("Unable to access webcam. Check browser permissions.");
    }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamActive(false);
    setCapturedPreview(null);
  };

  useEffect(() => () => { stopWebcam(); }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !webcamActive) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) { setErrorMsg("Camera not ready yet. Please wait a moment."); return; }

    setUploading(true); setErrorMsg(null); setSuccessMsg(null); setCapturedPreview(null);

    canvas.width = vw; canvas.height = vh;
    ctx.drawImage(video, 0, 0, vw, vh);

    // Black frame detection
    const data = ctx.getImageData(0, 0, vw, vh).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i+1] + data[i+2]) / 3;
    if (sum / (data.length / 4) < 5) {
      setErrorMsg("Frame appears black. Ensure webcam is working and retry.");
      setUploading(false); return;
    }

    setCapturedPreview(canvas.toDataURL("image/jpeg", 0.85));
    canvas.toBlob(async (blob) => {
      if (!blob) { setErrorMsg("Capture failed."); setUploading(false); return; }
      await uploadFile(blob);
    }, "image/jpeg", 0.95);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErrorMsg(null); setSuccessMsg(null);
    await uploadFile(file);
    e.target.value = "";
  };

  const uploadFile = async (blob: Blob) => {
    const fd = new FormData();
    fd.append("employee_id", employeeId as string);
    fd.append("pose_type", selectedPose);
    fd.append("file", blob, `${selectedPose}.jpg`);
    try {
      const res = await fetchApi("/enrollment/upload", { method: "POST", body: fd });
      setSuccessMsg(res.message);
      refetchStatus();
      // Auto-advance to next missing pose
      const missing = status?.missing_poses || [];
      const keys = Object.keys(POSES);
      const next = keys[keys.indexOf(selectedPose) + 1];
      if (next && missing.includes(next)) setSelectedPose(next);
    } catch (err: any) {
      setErrorMsg(err.message || "Enrollment failed. Please retry.");
    } finally {
      setUploading(false);
    }
  };

  const isEnrolled = (pose: string) =>
    status?.enrolled_poses?.some((p: string) => p.toLowerCase() === pose.toLowerCase());

  const progress = Math.min(100, Math.round(((status?.enrolled_poses?.filter(
    (p: string) => p.toLowerCase() !== "glasses"
  ).length || 0) / 9) * 100));

  const enrolledCount = status?.enrolled_poses?.length || 0;
  const totalCount = Object.keys(POSES).length;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-5xl page-enter">
        {/* Back */}
        <button
          onClick={() => router.push("/employees")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-[12px] font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Employees
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center">
              <span className="text-base font-bold text-blue-400">
                {employee?.name?.charAt(0) || "?"}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Biometric Enrollment</h1>
              <p className="text-[12px] text-slate-500">
                <span className="text-[var(--text-primary)] font-medium">{employee?.name}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="font-mono text-slate-500">{employee?.employee_id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => { if (confirm("Clear all registered facial data and embeddings?")) clearMutation.mutate(); }}
            className="flex items-center gap-2 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-2 border border-rose-500/15 rounded-xl transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Facial Data
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Pose checklist */}
          <div className="glass-card rounded-2xl border border-white/6 p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Enrollment Progress</h2>
                <span className="text-[10px] text-slate-500 font-mono">{enrolledCount}/{totalCount}</span>
              </div>
              {/* Progress bar */}
              <div className="relative h-1.5 bg-zinc-150 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-zinc-900 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 text-right font-mono">{progress}% complete</p>
            </div>

            <div className="space-y-1">
              {Object.entries(POSES).map(([key, pose]) => {
                const done = isEnrolled(key);
                const active = selectedPose === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedPose(key); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      active
                        ? "bg-zinc-100 border border-zinc-300 text-zinc-950 shadow-xs"
                        : done
                          ? "bg-zinc-50 border border-transparent text-slate-700 hover:bg-zinc-100"
                          : "border border-transparent text-slate-500 hover:bg-zinc-50 hover:text-slate-800"
                    }`}
                  >
                    <span className="text-base w-5 text-center leading-none shrink-0">{pose.icon}</span>
                    <span className="flex-1 text-[12px] font-medium">{pose.label}</span>
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Camera capture panel */}
          <div className="lg:col-span-2 glass-card rounded-2xl border border-white/6 flex flex-col">
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{POSES[selectedPose]?.icon}</span>
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] capitalize">
                    Capture {POSES[selectedPose]?.label} Pose
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{POSES[selectedPose]?.hint}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-4">
              {/* Status messages */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-250 text-rose-800 text-[11px]">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-800 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{successMsg}</span>
                </div>
              )}

              {/* Camera view */}
              <div className="relative aspect-video w-full rounded-2xl bg-[#070c1a] border border-white/6 overflow-hidden flex items-center justify-center">
                {/* Corner brackets */}
                {(webcamActive || capturedPreview) && (
                  <>
                    <div className="corner-bracket corner-bracket-tl text-zinc-400/60" />
                    <div className="corner-bracket corner-bracket-tr text-zinc-400/60" />
                    <div className="corner-bracket corner-bracket-bl text-zinc-400/60" />
                    <div className="corner-bracket corner-bracket-br text-zinc-400/60" />
                  </>
                )}

                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover scale-x-[-1] ${webcamActive ? "" : "hidden"}`}
                  autoPlay playsInline muted
                />
                {webcamActive && <div className="scanner-laser" />}

                {!webcamActive && capturedPreview && (
                  <>
                    <img src={capturedPreview} alt="Captured" className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        Frame captured — review or re-take
                      </span>
                    </div>
                  </>
                )}

                {!webcamActive && !capturedPreview && (
                  <div className="text-center space-y-3 p-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center mx-auto">
                      <Video className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-[12px] text-slate-500 font-medium">Camera inactive</p>
                      <p className="text-[10px] text-slate-700 mt-0.5">Click "Start Camera" to begin enrollment</p>
                    </div>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-5 pb-5 flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/5">
              {webcamActive ? (
                <>
                  <button
                    onClick={handleCapture}
                    disabled={uploading}
                    className="btn-primary flex-1 h-10 flex items-center justify-center gap-2 text-[12px]"
                  >
                    {uploading ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Processing...</span></>
                    ) : (
                      <><Camera className="w-3.5 h-3.5" /><span>Take Snapshot</span></>
                    )}
                  </button>
                  <button
                    onClick={stopWebcam}
                    className="btn-ghost h-10 px-5 text-[12px] flex items-center gap-2"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Stop Camera
                  </button>
                </>
              ) : (
                <button
                  onClick={startWebcam}
                  className="btn-primary flex-1 h-10 flex items-center justify-center gap-2 text-[12px]"
                >
                  <Video className="w-3.5 h-3.5" />
                  Start Camera
                </button>
              )}

              {/* File upload fallback */}
              <label className="relative cursor-pointer">
                <input
                  type="file" accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:pointer-events-none"
                />
                <div className="btn-ghost h-10 px-4 text-[12px] flex items-center gap-2 pointer-events-none">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
          <AlertCircle className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)] mb-1">Enrollment Tips</p>
            <p className="text-[10px] text-slate-650 leading-relaxed">
              Enroll at least <strong className="text-[var(--text-primary)]">5–7 poses</strong> for reliable recognition. Ensure good lighting, avoid glasses for the first pose, and maintain consistent distance from the camera (approx. 50–80cm). Multiple angles improve matching accuracy significantly.
            </p>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
