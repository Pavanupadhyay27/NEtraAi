"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, UserCheck, ShieldAlert, HelpCircle, Maximize, Minimize,
  Volume2, VolumeX, Clock as ClockIcon, Play, Wifi, Fingerprint, Shield,
  QrCode, Loader2
} from "lucide-react";
import { getBackendUrl } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import jsQR from "jsqr";

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
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "spoof" | "unknown" | "maintenance" | "no_employees" | "ask_checkout" | "locked" | "needs_qr" | "location_error">("idle");
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [kioskAddress, setKioskAddress] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [cameraLabel] = useState("Main Entrance");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [qrDetectedData, setQrDetectedData] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<string>("LOADING ENGINE...");
  const [qrCodeVal, setQrCodeVal] = useState("");
  const [qrError, setQrError] = useState<string | null>(null);
  const [faceBbox, setFaceBbox] = useState<number[] | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef(false);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<string>("idle");
  const kioskActiveRef = useRef(false);
  const scanFunctionRef = useRef<(() => void) | undefined>(undefined);
  const startKioskRef = useRef<any>(null);
  const scanningInProgressRef = useRef(false);

  useEffect(() => {
    statusRef.current = scanStatus;
  }, [scanStatus]);

  useEffect(() => {
    kioskActiveRef.current = kioskActive;
  }, [kioskActive]);

  const clearCooldownTimeout = () => {
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
  };

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

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      const geoId = navigator.geolocation.watchPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (err) => {
          console.error("Kiosk geolocation error:", err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(geoId);
    }
  }, []);

  useEffect(() => {
    if (coords.latitude !== null && coords.longitude !== null && !kioskAddress) {
      const fetchAddress = async () => {
        try {
          // First check for global configured address
          const configRes = await fetch(`${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/config`);
          if (configRes.ok) {
             const configData = await configRes.json();
             if (configData.location_address && configData.location_address.trim().length > 0) {
                 setKioskAddress(configData.location_address);
                 return;
             }
          }
          
          // Fallback to dynamic reverse geocoding
          const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/reverse-geocode?lat=${coords.latitude}&lng=${coords.longitude}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.address) {
              const parts = data.address.split(",");
              setKioskAddress(parts.length > 1 ? `${parts[0].trim()}, ${parts[1].trim()}` : data.address);
            }
          }
        } catch (err) {}
      };
      fetchAddress();
    }
  }, [coords.latitude, coords.longitude, kioskAddress]);

  const playQrChime = () => {
    if (typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }
        
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        gain1.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.15);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
        gain2.gain.setValueAtTime(0.40, audioCtx.currentTime + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc2.start(audioCtx.currentTime + 0.08);
        osc2.stop(audioCtx.currentTime + 0.35);
      } catch (err) {
        console.error("Failed to play QR beep chime:", err);
      }
    }
  };



  const playStatusBeep = (status: string) => {
    if (typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (status === "success" || status === "ask_checkout") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.3);
        } else if (status === "spoof" || status === "locked" || status === "spoof_detected") {
          osc.type = "square";
          osc.frequency.setValueAtTime(250, audioCtx.currentTime);
          osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.3);
        } else if (status === "unknown" || status === "needs_qr" || status === "location_error" || status === "maintenance" || status === "no_employees") {
          osc.type = "square";
          osc.frequency.setValueAtTime(400, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.2);
        }
      } catch (err) {
        console.error("Audio beep failed:", err);
      }
    }
  };

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

  const startKiosk = async (initialStatus: "idle" | "needs_qr" = "idle") => {
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
      setScanStatus(initialStatus);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (scanFunctionRef.current) {
          scanFunctionRef.current();
        }
      }, 1000);
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
    setFaceBbox(null);
  };

  // Global key listener for Backspace shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key shortcut if user is actively typing in an input/textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault(); // Prevent browser history back navigation
        clearCooldownTimeout();
        cooldownRef.current = false;
        
        if (!kioskActiveRef.current) {
          if (startKioskRef.current) startKioskRef.current("needs_qr");
        } else {
          setScanStatus("needs_qr");
          setScanResult(null);
          setQrCodeVal("");
          setQrError(null);
          setFaceBbox(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const captureAndScan = async () => {
    if (scanningInProgressRef.current || cooldownRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check if the video is actually ready and playing
    if (video.readyState < 2) return;

    canvas.width = 640; canvas.height = 360;
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.82);
    setLastImage(base64);

    // Frontend-side QR code detection using jsQR (100% reliable) - Checked in all states!
    let detectedQrCode: string | null = null;
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        detectedQrCode = code.data;
        console.log("jsQR detected QR code:", detectedQrCode);
        setScanFeedback("QR Badge Detected: " + detectedQrCode);
        if (!qrDetectedData) {
          playQrChime();
          setQrDetectedData(detectedQrCode);
        }
      }
    } catch (err) {
      console.error("jsQR parsing error:", err);
    }

    // Fallback to native BarcodeDetector if jsQR missed it and BarcodeDetector is available
    if (!detectedQrCode && typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code", "code_128", "code_39"] });
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          detectedQrCode = barcodes[0].rawValue;
          console.log("BarcodeDetector detected QR code:", detectedQrCode);
          setScanFeedback("QR Badge Detected: " + detectedQrCode);
          if (!qrDetectedData) {
            playQrChime();
            setQrDetectedData(detectedQrCode);
          }
        }
      } catch (err) {
        console.error("BarcodeDetector error:", err);
      }
    }

    // If a QR code is detected, submit immediately and bypass standard face scans
    if (detectedQrCode) {
      if (statusRef.current === "needs_qr" && scanResult?.employee?.id) {
        autoSubmitQR(scanResult.employee.id, detectedQrCode);
      } else {
        autoSubmitDirectQR(detectedQrCode, base64);
      }
      return;
    }

    // If the kiosk is in needs_qr mode but no QR code was scanned, don't execute face scans
    if (statusRef.current !== "idle") {
      return;
    }

    scanningInProgressRef.current = true;
    setScanning(true);
    try {
      // Connect to the backend running at the configured URL
      const url = `${getBackendUrl()}/kiosk/scan`;
      const payloadBody: any = { image: base64, camera: cameraLabel };
      if (detectedQrCode) {
        payloadBody.qr_code = detectedQrCode;
      }
      if (coords.latitude !== null && coords.longitude !== null) {
        payloadBody.latitude = coords.latitude;
        payloadBody.longitude = coords.longitude;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody)
      });
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      
      // Discard response if state changed while request was in-flight (e.g. Backspace pressed)
      if (statusRef.current !== "idle") {
        console.log("Discarding in-flight face scan response: state changed to", statusRef.current);
        return;
      }
      
      if (data.status === "no_face") {
        setScanFeedback("Align your face in frame");
        setFaceBbox(null);
      } else if (data.status === "multiple_faces") {
        setScanFeedback("One person at a time");
        setFaceBbox(null);
      } else {
        setScanFeedback(null);
        handleResult(data);
      }
    } catch (err) {
      console.error("Scan API connection error:", err);
      setScanFeedback("Connection error");
      setFaceBbox(null);
    } finally {
      setScanning(false);
      scanningInProgressRef.current = false;
    }
  };

  useEffect(() => {
    scanFunctionRef.current = captureAndScan;
  });

  useEffect(() => {
    startKioskRef.current = startKiosk;
  });

  const confirmCheckout = async () => {
    if (!lastImage) return;
    setScanning(true);
    try {
      const url = `${getBackendUrl()}/kiosk/scan`;
      const bodyPayload: any = { image: lastImage, camera: cameraLabel, confirm_checkout: true };
      if (coords.latitude !== null && coords.longitude !== null) {
        bodyPayload.latitude = coords.latitude;
        bodyPayload.longitude = coords.longitude;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
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



  const autoSubmitDirectQR = async (qrVal: string, frameImg: string) => {
    if (cooldownRef.current || scanningInProgressRef.current) return;
    scanningInProgressRef.current = true;
    setScanning(true);
    setQrError(null);
    try {
      const url = `${getBackendUrl()}/kiosk/scan`;
      const bodyPayload: any = { 
        image: frameImg, 
        camera: cameraLabel,
        qr_code: qrVal.trim(),
        qr_only: true
      };
      if (coords.latitude !== null && coords.longitude !== null) {
        bodyPayload.latitude = coords.latitude;
        bodyPayload.longitude = coords.longitude;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "QR scan registration failed");
      }
      handleResult(data);
    } catch (err: any) {
      console.error("Auto Direct QR scan error:", err);
      setQrError(err.message || "QR Code scan failed.");
      setQrDetectedData(null);
    } finally {
      setScanning(false);
      scanningInProgressRef.current = false;
    }
  };

  const autoSubmitQR = async (employeeId: number, qrVal: string) => {
    if (cooldownRef.current || scanningInProgressRef.current) return;
    scanningInProgressRef.current = true;
    setScanning(true);
    setQrError(null);
    try {
      const url = `${getBackendUrl()}/kiosk/confirm-qr`;
      const bodyPayload: any = { 
        employee_id: employeeId, 
        qr_code: qrVal.trim(), 
        camera: cameraLabel 
      };
      if (coords.latitude !== null && coords.longitude !== null) {
        bodyPayload.latitude = coords.latitude;
        bodyPayload.longitude = coords.longitude;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "QR Verification failed");
      }
      handleResult(data);
    } catch (err: any) {
      console.error("Auto QR verification error:", err);
      setQrError(err.message || "QR Code verification failed.");
      setQrDetectedData(null);
    } finally {
      setScanning(false);
      scanningInProgressRef.current = false;
    }
  };

  const handleResult = (data: any) => {
    setQrDetectedData(null);
    if (data.bbox) {
      setFaceBbox(data.bbox);
    } else {
      setFaceBbox(null);
    }
    
    if (voiceEnabled) {
      playStatusBeep(data.status);
    }

    if (data.status === "success") {
      setProfileImageError(false);
      setScanStatus("success"); setScanResult(data);
      setMatchTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      triggerCooldown(4500);
    } else if (data.status === "ask_checkout") {
      setProfileImageError(false);
      setScanStatus("ask_checkout"); setScanResult(data);
    } else if (data.status === "needs_qr") {
      setQrCodeVal("");
      setQrError(null);
      setScanStatus("needs_qr"); setScanResult(data);
    } else if (data.status === "locked") {
      setScanStatus("locked"); setScanResult(data);
      triggerCooldown(3500);
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
    } else if (data.status === "location_error") {
      setScanStatus("location_error"); setScanResult(data);
      triggerCooldown(1500);
    }
  };

  const triggerCooldown = (ms: number) => {
    clearCooldownTimeout();
    cooldownRef.current = true;
    cooldownTimeoutRef.current = setTimeout(() => {
      cooldownRef.current = false;
      setScanStatus("idle");
      setScanResult(null);
      setFaceBbox(null);
      cooldownTimeoutRef.current = null;
    }, ms);
  };



  const resetToIdleWithCooldown = (ms: number) => {
    clearCooldownTimeout();
    setScanStatus("idle");
    setScanResult(null);
    setFaceBbox(null);
    cooldownRef.current = true;
    cooldownTimeoutRef.current = setTimeout(() => {
      cooldownRef.current = false;
      cooldownTimeoutRef.current = null;
    }, ms);
  };

  let boxBorderColor = "border-zinc-400";
  let boxGlow = "shadow-[0_0_15px_rgba(161,161,170,0.4)]";
  let labelText = "Detecting...";
  let labelBg = "bg-zinc-800 text-white";

  if (scanStatus === "success" || scanStatus === "ask_checkout") {
    boxBorderColor = "border-emerald-500";
    boxGlow = "shadow-[0_0_20px_rgba(16,185,129,0.5)]";
    labelText = scanResult?.employee?.name ? `MATCHED: ${scanResult.employee.name}` : "VERIFIED";
    labelBg = "bg-emerald-600 text-white";
  } else if (scanStatus === "spoof") {
    boxBorderColor = "border-rose-600";
    boxGlow = "shadow-[0_0_20px_rgba(220,38,38,0.5)]";
    labelText = "SPOOF DETECTED";
    labelBg = "bg-rose-600 text-white";
  } else if (scanStatus === "unknown") {
    boxBorderColor = "border-rose-500";
    boxGlow = "shadow-[0_0_15px_rgba(244,63,94,0.4)]";
    labelText = "UNKNOWN PERSON";
    labelBg = "bg-rose-500 text-white";
  } else if (scanStatus === "needs_qr") {
    boxBorderColor = "border-amber-500";
    boxGlow = "shadow-[0_0_20px_rgba(245,158,11,0.5)]";
    labelText = "IDENTITY CONFIRMATION";
    labelBg = "bg-amber-600 text-white";
  } else if (scanStatus === "locked") {
    boxBorderColor = "border-rose-600";
    boxGlow = "shadow-[0_0_20px_rgba(220,38,38,0.5)]";
    labelText = "LOCKED";
    labelBg = "bg-rose-600 text-white";
  } else if (scanStatus === "location_error") {
    boxBorderColor = "border-rose-600 animate-pulse";
    boxGlow = "shadow-[0_0_20px_rgba(220,38,38,0.5)]";
    labelText = scanResult?.message || "OUTSIDE ALLOWED AREA";
    labelBg = "bg-rose-600 text-white";
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col relative select-none overflow-hidden font-sans">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.94); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rotate-hud {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes rotate-hud-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .animate-rotate-hud {
          animation: rotate-hud 15s linear infinite;
        }
        .animate-rotate-hud-reverse {
          animation: rotate-hud-reverse 10s linear infinite;
        }
        @keyframes scan-laser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.8; }
        }
        .animate-scan-laser {
          animation: scan-laser 2s ease-in-out infinite;
        }
      `}</style>
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
            <p className="text-[9px] font-bold text-slate-500 font-mono mt-0.5 uppercase tracking-wider">{cameraLabel}</p>
          </div>
        </div>

        {/* Clock & GPS Indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1 z-20">
          <p className="text-base font-bold font-mono tracking-tight text-[var(--text-primary)] leading-none tabular-nums">
            {currentTime || "00:00:00"}
          </p>
          {coords.latitude !== null && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-700/50 bg-slate-900 text-[8.5px] font-mono text-slate-300 select-none animate-fadeIn flex-row shrink-0" title={`${coords.latitude.toFixed(6)}, ${coords.longitude?.toFixed(6)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="max-w-[200px] truncate">GPS: {kioskAddress || `${coords.latitude.toFixed(4)}, ${coords.longitude?.toFixed(4)}`}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? "Mute audio assistance" : "Enable audio assistance"}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              voiceEnabled
                ? "bg-zinc-950 border-zinc-950 text-white"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen toggle"
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
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
                onClick={() => startKiosk()}
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

            {/* Bounding Box Overlay */}
            {kioskActive && faceBbox && scanStatus !== "needs_qr" && (
              <div 
                className="absolute pointer-events-none z-20"
                style={{
                  left: `${((640 - faceBbox[2]) / 640) * 100}%`,
                  top: `${(faceBbox[1] / 360) * 100}%`,
                  width: `${((faceBbox[2] - faceBbox[0]) / 640) * 100}%`,
                  height: `${((faceBbox[3] - faceBbox[1]) / 360) * 100}%`,
                  transition: "all 0.2s ease-out",
                }}
              >
                <div className={`absolute inset-0 border-2 rounded-xl ${boxBorderColor} ${boxGlow} transition-all duration-300`}>
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase whitespace-nowrap shadow-md ${labelBg} transition-all duration-300`}>
                    {labelText}
                  </div>
                </div>
              </div>
            )}

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
                      <span className="text-[9px] text-white font-mono font-bold tracking-wider uppercase bg-slate-900 px-3 py-1.5 rounded border border-slate-700 shadow-md">
                        {scanFeedback || (scanning ? "Processing..." : "Center Face")}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SUCCESS screen */}
            {kioskActive && scanStatus === "success" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-emerald-500/30 shadow-[inset_0_0_40px_rgba(16,185,129,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-500/70 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-500/70 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-500/70 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-500/70 rounded-br-md" />

                <div className="space-y-4 max-w-sm w-full animate-fade-in flex flex-col items-center">
                  
                  {/* Floating Top Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold uppercase tracking-widest animate-bounceIn">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Biometrics Verified
                  </div>

                  {/* Profile Avatar with Tech HUD Rings */}
                  <div className="relative w-28 h-28 flex items-center justify-center my-1.5">
                    {/* Rotating outer ring */}
                    <div className="absolute inset-0 border border-emerald-500/30 border-dashed rounded-full animate-rotate-hud" />
                    {/* Counter-rotating middle ring */}
                    <div className="absolute inset-1.5 border border-emerald-400/20 border-dashed rounded-full animate-rotate-hud-reverse" />
                    {/* Inner glowing circle wrapper */}
                    <div className="absolute inset-3 rounded-full bg-slate-900 border-2 border-emerald-500/80 p-0.5 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                      {scanResult?.employee?.employee_id && !profileImageError ? (
                        <img
                          src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${scanResult.employee.employee_id}/front.jpg`}
                          alt={scanResult.employee.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={() => setProfileImageError(true)}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-2xl tracking-tighter">
                          {scanResult?.employee?.name
                            ? scanResult.employee.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                            : "PK"}
                        </div>
                      )}
                    </div>

                    {/* Floating check status indicator */}
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-white shadow-md animate-pulse">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Name and Designation */}
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      {scanResult?.employee?.name || "Employee"}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono tracking-wide uppercase">
                      {scanResult?.employee?.designation || "Staff"} · ID: {scanResult?.employee?.employee_id}
                    </p>
                  </div>

                  {/* Grid details block */}
                  <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 max-w-[280px] grid grid-cols-2 gap-2 text-center divide-x divide-slate-800">
                    <div>
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Logged Time</span>
                      <span className="text-sm font-extrabold text-white font-mono tracking-tight tabular-nums block mt-0.5">
                        {matchTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Action Status</span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mt-1">
                        {scanResult?.attendance_type || "CHECK-IN"}
                      </span>
                    </div>
                  </div>

                  {/* Working Hours (Only visible on Checkout success) */}
                  {scanResult?.attendance?.working_hours > 0 && (
                    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 max-w-[280px]">
                      <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider block">Time Logged Today</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono mt-0.5 block">{scanResult.attendance.working_hours.toFixed(2)} hours</span>
                    </div>
                  )}

                  {/* Biometric Scores Info */}
                  {scanResult?.confidence && (
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/40 text-[9px] text-slate-500 font-mono border border-slate-800/60">
                      <span>Conf: <strong className="text-slate-300">{(scanResult.confidence * 100).toFixed(0)}%</strong></span>
                      <span className="w-1 h-1 rounded-full bg-slate-800" />
                      <span>Liveness: <strong className="text-emerald-500/80">{(scanResult.liveness_score * 100).toFixed(0)}%</strong></span>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ASK_CHECKOUT screen */}
            {kioskActive && scanStatus === "ask_checkout" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-cyan-500/30 shadow-[inset_0_0_40px_rgba(6,182,212,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-500/70 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-500/70 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-500/70 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-500/70 rounded-br-md" />

                <div className="space-y-4 max-w-sm w-full animate-fade-in flex flex-col items-center">
                  
                  {/* Floating Top Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[9px] font-bold uppercase tracking-widest animate-bounceIn">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Checkout Prompt
                  </div>

                  {/* Profile Avatar with Tech HUD Rings */}
                  <div className="relative w-28 h-28 flex items-center justify-center my-1.5">
                    {/* Rotating outer ring */}
                    <div className="absolute inset-0 border border-cyan-500/30 border-dashed rounded-full animate-rotate-hud" />
                    {/* Counter-rotating middle ring */}
                    <div className="absolute inset-1.5 border border-cyan-400/20 border-dashed rounded-full animate-rotate-hud-reverse" />
                    {/* Inner glowing circle wrapper */}
                    <div className="absolute inset-3 rounded-full bg-slate-900 border-2 border-cyan-500/80 p-0.5 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                      {scanResult?.employee?.employee_id && !profileImageError ? (
                        <img
                          src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${scanResult.employee.employee_id}/front.jpg`}
                          alt={scanResult.employee.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={() => setProfileImageError(true)}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-cyan-400 font-bold text-2xl tracking-tighter">
                          {scanResult?.employee?.name
                            ? scanResult.employee.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                            : "PK"}
                        </div>
                      )}
                    </div>

                    {/* Floating check status indicator */}
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-cyan-500 border border-slate-950 flex items-center justify-center text-white shadow-md animate-pulse">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Name and Warning */}
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      {scanResult?.employee?.name || "Employee"}
                    </h2>
                    <p className="text-[11.5px] text-slate-300 font-medium">
                      Already checked in today at <span className="font-mono font-bold text-cyan-400">{formatTime12h(scanResult?.attendance?.check_in)}</span>
                    </p>
                  </div>

                  {/* Working Hours Box */}
                  <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 max-w-[280px]">
                    <span className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider block">Working Hours So Far</span>
                    <span className="text-sm font-extrabold text-white font-mono tracking-tight mt-0.5 block">
                      {scanResult?.working_hours_so_far?.toFixed(2)} hours
                    </span>
                  </div>

                  {/* Actions Confirmation */}
                  <div className="space-y-3 pt-1 w-full max-w-[280px]">
                    <p className="text-xs font-semibold text-slate-300">Do you want to Check Out now?</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={confirmCheckout}
                        disabled={scanning}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.35)] cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all disabled:opacity-50"
                      >
                        {scanning ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Processing</span>
                          </div>
                        ) : (
                          "Yes, Check Out"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          resetToIdleWithCooldown(1500);
                        }}
                        disabled={scanning}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-800 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-50"
                      >
                        No, Stay
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* NEEDS_QR screen */}
            {kioskActive && scanStatus === "needs_qr" && (
              <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-amber-500/30 shadow-[inset_0_0_40px_rgba(245,158,11,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500/70 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500/70 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500/70 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500/70 rounded-br-md" />

                <div className="space-y-4 max-w-sm w-full animate-fade-in flex flex-col items-center">
                  
                  {/* Floating Top Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[9px] font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Automatic QR Scanner
                  </div>

                  {/* Interactive Holographic Scanner Graphic */}
                  <div className="relative w-28 h-28 flex items-center justify-center my-2">
                    {/* Outer pulsing ring */}
                    <div className="absolute inset-0 border border-amber-500/30 rounded-2xl animate-pulse" style={{ animationDuration: "2s" }} />
                    {/* Scanning laser line inside the box */}
                    <div className="absolute left-2 right-2 h-[2px] bg-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-scan-laser top-0" />
                    
                    {/* QR Code Icon / Symbol in center */}
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                      <Fingerprint className="w-9 h-9 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">Scan Employee Badge</h2>
                    {scanResult?.employee?.name && (
                      <p className="text-[11.5px] text-slate-300 font-medium animate-fadeIn">
                        Matched: <span className="font-bold text-amber-400">{scanResult.employee.name}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-[285px] mt-1">
                      Hold your employee QR badge up to the camera. The scanner will register it automatically.
                    </p>
                  </div>

                  {qrError && (
                    <p className="text-[10px] text-rose-400 font-mono font-bold uppercase tracking-wider bg-rose-500/10 py-1 px-3 rounded border border-rose-500/20">{qrError}</p>
                  )}

                  <div className="flex flex-col items-center gap-2 pt-2 w-full max-w-[240px]">
                    <button
                      type="button"
                      onClick={() => {
                        resetToIdleWithCooldown(5000);
                      }}
                      className="w-full py-2 rounded-xl bg-transparent hover:bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-800 cursor-pointer active:scale-[0.97] transition-all"
                    >
                      Cancel
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* LOCKED screen */}
            {kioskActive && scanStatus === "locked" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-rose-500/30 shadow-[inset_0_0_40px_rgba(239,68,68,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-rose-500/70 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-rose-500/70 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-rose-500/70 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-rose-500/70 rounded-br-md" />

                <div className="space-y-4 max-w-xs animate-fade-in flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-bounce">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">Attendance Locked</h2>
                    <p className="text-[9.5px] text-rose-400 font-mono font-bold uppercase tracking-wider">Security Restriction</p>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-900/60 p-3 rounded-xl border border-slate-800 max-w-[260px]">
                    {scanResult?.message || "Your attendance logging is locked for today. Re-entry must be authorized by an administrator."}
                  </p>
                </div>
              </div>
            )}

            {/* SPOOF screen */}
            {kioskActive && scanStatus === "spoof" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-rose-500/30 shadow-[inset_0_0_40px_rgba(239,68,68,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-rose-500/70 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-rose-500/70 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-rose-500/70 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-rose-500/70 rounded-br-md" />

                <div className="space-y-4 max-w-xs animate-fade-in flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">Spoof Detected</h2>
                    <p className="text-[9.5px] text-rose-400 font-mono font-bold uppercase tracking-wider">Anti-Spoofing Alarm</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-rose-300 leading-relaxed font-semibold">
                      {scanResult?.message || "Liveness verification failed. Presentation attack suspected."}
                    </p>
                    {scanResult?.liveness_score !== undefined && (
                      <p className="text-[9px] text-slate-500 font-mono bg-slate-900/50 py-1 px-3 rounded-lg border border-slate-800 inline-block">
                        Liveness Score: <strong className="text-rose-400">{scanResult.liveness_score.toFixed(3)}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* UNKNOWN screen */}
            {kioskActive && scanStatus === "unknown" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-slate-700/30 shadow-[inset_0_0_40px_rgba(148,163,184,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-slate-500/40 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-slate-500/40 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-slate-500/40 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-slate-500/40 rounded-br-md" />

                <div className="space-y-4 max-w-xs animate-fade-in flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-md">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">Not Recognized</h2>
                    <p className="text-[9.5px] text-slate-500 font-mono font-bold uppercase tracking-wider text-center">Identity Unknown</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium bg-slate-900/60 p-3 rounded-xl border border-slate-800 max-w-[260px]">
                    {scanResult?.message || "Biometric pattern does not match any registered employee records."}
                  </p>
                </div>
              </div>
            )}

            {/* MAINTENANCE screen */}
            {kioskActive && scanStatus === "maintenance" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-slate-700/30 shadow-[inset_0_0_40px_rgba(148,163,184,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-slate-500/40 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-slate-500/40 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-slate-500/40 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-slate-500/40 rounded-br-md" />

                <div className="space-y-4 max-w-xs animate-fade-in flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-md">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">Kiosk Offline</h2>
                    <p className="text-[9.5px] text-slate-500 font-mono font-bold uppercase tracking-wider">Maintenance Mode</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium bg-slate-900/60 p-3 rounded-xl border border-slate-800 max-w-[260px]">
                    {scanResult?.message || "Biometric scans are temporarily suspended for system database syncing."}
                  </p>
                </div>
              </div>
            )}

            {/* NO_EMPLOYEES screen */}
            {kioskActive && scanStatus === "no_employees" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeInUp border border-amber-500/30 shadow-[inset_0_0_40px_rgba(245,158,11,0.15)] rounded-2xl z-30">
                {/* HUD Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500/70 rounded-tl-md" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500/70 rounded-tr-md" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500/70 rounded-bl-md" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500/70 rounded-br-md" />

                <div className="space-y-4 max-w-xs animate-fade-in flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-md">
                    <UserCheck className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">Setup Required</h2>
                    <p className="text-[9.5px] text-amber-400 font-mono font-bold uppercase tracking-wider">Empty Database</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium bg-slate-900/60 p-3 rounded-xl border border-slate-800 max-w-[260px]">
                    {scanResult?.message || "Please enroll employees in the dashboard before attempting kiosk logging."}
                  </p>
                </div>
              </div>
            )}

            {/* Sci-Fi QR Scan Processing Overlay */}
            {kioskActive && qrDetectedData && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fadeIn border-2 border-emerald-500/50 shadow-[inset_0_0_50px_rgba(16,185,129,0.3)] rounded-2xl z-40">
                {/* HUD Tech Corner Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-md animate-pulse" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-md animate-pulse" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-md animate-pulse" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-md animate-pulse" />

                {/* Rotating Matrix Code Rings */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                  {/* Glowing Pulsing Outer Ring */}
                  <div className="absolute inset-0 border border-emerald-400/40 rounded-full animate-ping" style={{ animationDuration: "1s" }} />
                  {/* Concentric rotating dashes */}
                  <div className="absolute inset-2 border-2 border-emerald-500 border-dashed rounded-full animate-rotate-hud" />
                  <div className="absolute inset-4 border border-emerald-400/20 border-dashed rounded-full animate-rotate-hud-reverse" />
                  {/* Inner Target Ring */}
                  <div className="absolute inset-6 rounded-full bg-slate-900 border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center justify-center overflow-hidden">
                    <QrCode className="w-10 h-10 text-emerald-400 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2 max-w-xs flex flex-col items-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold uppercase tracking-widest animate-pulse">
                    Decrypted Badge
                  </span>
                  <h3 className="text-sm font-extrabold text-white tracking-widest uppercase">QR Code Registered</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider break-all bg-slate-900/90 px-3 py-1 border border-slate-800 rounded-lg">
                    ID: {qrDetectedData}
                  </p>
                </div>

                {/* Glowing status loading bar */}
                <div className="mt-5 w-44 bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden relative">
                  <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-400 animate-[scan-laser_1.5s_ease-in-out_infinite] w-20 rounded-full" />
                </div>
                <span className="mt-2.5 text-[9px] font-bold text-emerald-400 tracking-wider uppercase font-mono animate-pulse">
                  Verifying Credentials...
                </span>
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
            <div className="flex items-center justify-center gap-5 text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider mt-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-slate-800 animate-pulse" : "bg-slate-400"}`} />
                <span>{scanning ? "Scanning" : "Standby"}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1">
                <span>Anti-Spoof Active</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1">
                <span>Auto-indexing</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 h-10 border-t border-[var(--border-medium)] flex items-center justify-center kiosk-footer mt-auto">
        <p className="text-[9.5px] font-mono font-bold text-slate-500 tracking-wider">
          NETRAID SECURE TERMINAL GATEWAY v1.0.0 · {engineMode}
        </p>
      </footer>
    </div>
  );
}
