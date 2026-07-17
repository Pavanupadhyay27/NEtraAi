"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Zap } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error:   (message: string, duration?: number) => void;
    info:    (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ─── Single Toast Item ─── */
function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const removedRef = useRef(false);

  const handleRemove = useCallback(() => {
    if (removedRef.current) return;
    removedRef.current = true;
    setExiting(true);
    setTimeout(() => onRemove(t.id), 320);
  }, [t.id, onRemove]);

  useEffect(() => {
    const step = 100 / (t.duration / 50);
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(intervalRef.current!);
          handleRemove();
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(intervalRef.current!);
  }, [t.duration, handleRemove]);

  const config = {
    success: {
      Icon: CheckCircle2,
      accent: "#10b981",
      glow: "rgba(16,185,129,0.18)",
      border: "rgba(16,185,129,0.28)",
      label: "SUCCESS",
    },
    error: {
      Icon: AlertCircle,
      accent: "#f43f5e",
      glow: "rgba(244,63,94,0.18)",
      border: "rgba(244,63,94,0.28)",
      label: "ERROR",
    },
    warning: {
      Icon: AlertTriangle,
      accent: "#f59e0b",
      glow: "rgba(245,158,11,0.18)",
      border: "rgba(245,158,11,0.28)",
      label: "WARNING",
    },
    info: {
      Icon: Info,
      accent: "#3b82f6",
      glow: "rgba(59,130,246,0.18)",
      border: "rgba(59,130,246,0.28)",
      label: "INFO",
    },
  }[t.type];

  const { Icon, accent, glow, border, label } = config;

  return (
    <div
      style={{
        animation: exiting
          ? "toastOut 0.32s cubic-bezier(0.4,0,1,1) forwards"
          : "toastIn 0.38s cubic-bezier(0.16,1,0.3,1) forwards",
        background: "rgba(9,12,20,0.92)",
        border: `1px solid ${border}`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.65), 0 0 28px ${glow}`,
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        borderRadius: "16px",
        overflow: "hidden",
        minWidth: "320px",
        maxWidth: "420px",
        position: "relative",
      }}
    >
      {/* Left accent strip */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "3px",
        background: `linear-gradient(180deg, ${accent}dd, ${accent}44)`,
      }} />

      {/* Main content row */}
      <div style={{ padding: "14px 14px 14px 18px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Icon bubble */}
        <div style={{
          width: 36, height: 36, borderRadius: "10px",
          background: `${accent}1a`, border: `1px solid ${accent}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: "1px",
        }}>
          <Icon style={{ width: 17, height: 17, color: accent }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
            <span style={{
              fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em",
              color: accent, textTransform: "uppercase" as const, fontFamily: "monospace",
            }}>
              {label}
            </span>
            <Zap style={{ width: 8, height: 8, color: accent, opacity: 0.55 }} />
          </div>
          <p style={{
            fontSize: "12.5px", fontWeight: 500,
            color: "rgba(255,255,255,0.88)",
            lineHeight: 1.5, margin: 0,
            wordBreak: "break-word" as const,
          }}>
            {t.message}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleRemove}
          style={{
            width: 24, height: 24, borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, color: "rgba(255,255,255,0.35)",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" })}
          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" })}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Countdown progress bar */}
      <div style={{ height: "2px", background: "rgba(255,255,255,0.05)" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: `linear-gradient(90deg, ${accent}66, ${accent})`,
          transition: "width 50ms linear",
          borderRadius: "0 2px 2px 0",
        }} />
      </div>
    </div>
  );
}

/* ─── Provider ─── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = 4500) => {
    const id = Math.random().toString(36).substring(2, 9);
    // Max 5 stacked toasts
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration, createdAt: Date.now() }]);
  }, []);

  const toast = {
    success: (msg: string, dur?: number) => addToast(msg, "success", dur),
    error:   (msg: string, dur?: number) => addToast(msg, "error",   dur ?? 6000),
    info:    (msg: string, dur?: number) => addToast(msg, "info",    dur),
    warning: (msg: string, dur?: number) => addToast(msg, "warning", dur),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      <style>{`
        @keyframes toastIn {
          from { transform: translateX(110%) scale(0.9); opacity: 0; }
          to   { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes toastOut {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to   { transform: translateX(110%) scale(0.9); opacity: 0; }
        }
      `}</style>

      {/* Fixed portal – always on top of everything including modals */}
      <div style={{
        position: "fixed", top: "20px", right: "20px",
        zIndex: 999999,
        display: "flex", flexDirection: "column", gap: "10px",
        alignItems: "flex-end", pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem t={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
