"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl, getUserProfile } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  Check, Loader2, Sliders, Fingerprint, Camera, MapPin, 
  Volume2, Upload, Trash2, RefreshCw, Lock, ShieldCheck, Zap,
  Layers, Database, Clock, Activity, ShieldAlert,
  FileText, Shield, Sparkles, AlertCircle
} from "lucide-react";

type SuperAdminTab = "security" | "saas_tiers" | "ai_engine" | "backups";
type AdminTab = "biometrics" | "camera" | "location" | "customization";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [superTab, setSuperTab] = useState<SuperAdminTab>("security");
  const [adminTab, setAdminTab] = useState<AdminTab>("biometrics");

  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [fetchingGps, setFetchingGps] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setProfile(getUserProfile());
    setProfileLoading(false);
  }, []);

  const isSuperAdmin = profile?.role?.name === "Super Admin";

  const { data: settings = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["settings", isSuperAdmin ? "super" : "admin"],
    queryFn: async () => {
      const data = await fetchApi("/settings/");
      const valMap: Record<string, string> = {};
      data.forEach((s: any) => { 
        valMap[s.key] = s.value; 
      });

      if (isSuperAdmin) {
        // Super Admin Global System Defaults
        if (!valMap["SYSTEM_MAINTENANCE_MODE"]) valMap["SYSTEM_MAINTENANCE_MODE"] = "false";
        if (!valMap["AUDIT_LOG_RETENTION_DAYS"]) valMap["AUDIT_LOG_RETENTION_DAYS"] = "180";
        if (!valMap["MAX_API_RATE_LIMIT"]) valMap["MAX_API_RATE_LIMIT"] = "120";
        if (!valMap["SESSION_EXPIRY_HOURS"]) valMap["SESSION_EXPIRY_HOURS"] = "24";
        if (!valMap["FORCE_PASSWORD_CHANGE_DAYS"]) valMap["FORCE_PASSWORD_CHANGE_DAYS"] = "90";
        if (!valMap["FREE_TIER_MAX_EMPLOYEES"]) valMap["FREE_TIER_MAX_EMPLOYEES"] = "50";
        if (!valMap["BUSINESS_TIER_MAX_EMPLOYEES"]) valMap["BUSINESS_TIER_MAX_EMPLOYEES"] = "500";
        if (!valMap["PLATFORM_BASE_CURRENCY"]) valMap["PLATFORM_BASE_CURRENCY"] = "INR (₹)";
        if (!valMap["ALLOW_SELF_REGISTRATION"]) valMap["ALLOW_SELF_REGISTRATION"] = "true";
        if (!valMap["GLOBAL_DEFAULT_LIVENESS_CONFIDENCE"]) valMap["GLOBAL_DEFAULT_LIVENESS_CONFIDENCE"] = "0.85";
        if (!valMap["MAX_REGISTRATION_IMAGES_PER_USER"]) valMap["MAX_REGISTRATION_IMAGES_PER_USER"] = "5";
        if (!valMap["SPOOF_DETECTION_STRICTNESS"]) valMap["SPOOF_DETECTION_STRICTNESS"] = "Strict";
        if (!valMap["AUTOMATED_BACKUP_FREQUENCY"]) valMap["AUTOMATED_BACKUP_FREQUENCY"] = "Daily";
        if (!valMap["ENABLE_SYSTEM_NOTIFICATIONS"]) valMap["ENABLE_SYSTEM_NOTIFICATIONS"] = "true";
      } else {
        // Org Admin Operational Defaults
        if (!valMap["ATTENDANCE_LIVENESS_THRESHOLD"]) valMap["ATTENDANCE_LIVENESS_THRESHOLD"] = "0.85";
        if (!valMap["ATTENDANCE_MATCH_THRESHOLD"]) valMap["ATTENDANCE_MATCH_THRESHOLD"] = "0.65";
        if (!valMap["DUPLICATE_PUNCH_COOLDOWN_MINS"]) valMap["DUPLICATE_PUNCH_COOLDOWN_MINS"] = "5";
        if (!valMap["ALLOW_LATE_CHECKIN_GRACE_MINS"]) valMap["ALLOW_LATE_CHECKIN_GRACE_MINS"] = "15";
        if (!valMap["AUTO_CHECK_OUT_HOURS"]) valMap["AUTO_CHECK_OUT_HOURS"] = "12";
        if (!valMap["RTSP_STREAM_ENABLED"]) valMap["RTSP_STREAM_ENABLED"] = "false";
        if (!valMap["RTSP_STREAM_URL"]) valMap["RTSP_STREAM_URL"] = "rtsp://192.168.1.100:554/live";
        if (!valMap["LOCATION_RADIUS_METERS"]) valMap["LOCATION_RADIUS_METERS"] = "200";
        if (!valMap["VOICE_GREETING_ENABLED"]) valMap["VOICE_GREETING_ENABLED"] = "true";
        if (!valMap["VOICE_GREETING_TEXT"]) valMap["VOICE_GREETING_TEXT"] = "Welcome to office, attendance recorded successfully.";
      }

      setEditValues(valMap);
      return data;
    },
    enabled: !profileLoading,
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      fetchApi(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setUpdatingKey(null);
      toast.success(`Updated ${keyToTitle(data.key || "")}`);
    },
    onError: (err: any, vars) => {
      setUpdatingKey(null);
      toast.error(err.message || `Failed to update ${vars.key}`);
    }
  });

  const handleSave = (key: string, customVal?: string) => {
    const val = customVal !== undefined ? customVal : editValues[key];
    setUpdatingKey(key);
    saveMutation.mutate({ key, value: val });
  };

  const handleSetCurrentLocation = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setFetchingGps(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);
          
          setEditValues(prev => ({
            ...prev,
            LOCATION_LATITUDE: lat,
            LOCATION_LONGITUDE: lon
          }));
          
          try {
            await fetchApi("/settings/LOCATION_LATITUDE", { method: "PUT", body: JSON.stringify({ value: lat }) });
            await fetchApi("/settings/LOCATION_LONGITUDE", { method: "PUT", body: JSON.stringify({ value: lon }) });
            
            try {
              const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/reverse-geocode?lat=${lat}&lng=${lon}`;
              const res = await fetch(url);
              if (res.ok) {
                const data = await res.json();
                if (data.address) {
                  setEditValues(prev => ({ ...prev, LOCATION_ADDRESS: data.address }));
                  await fetchApi("/settings/LOCATION_ADDRESS", { method: "PUT", body: JSON.stringify({ value: data.address }) });
                }
              }
            } catch (e) {
              console.error("Geocode error", e);
            }

            queryClient.invalidateQueries({ queryKey: ["settings"] });
            toast.success("Location locked to your current coordinates!");
          } catch (err: any) {
            toast.error("Failed to save location coordinates.");
          } finally {
            setFetchingGps(false);
          }
        },
        (err) => {
          toast.error("GPS location access denied or unavailable.");
          setFetchingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  };

  const keyToTitle = (key: string) => {
    switch (key) {
      case "SYSTEM_MAINTENANCE_MODE": return "Platform Maintenance Mode";
      case "AUDIT_LOG_RETENTION_DAYS": return "Audit Log Retention";
      case "MAX_API_RATE_LIMIT": return "API Rate Limit";
      case "SESSION_EXPIRY_HOURS": return "Session Timeout";
      case "FORCE_PASSWORD_CHANGE_DAYS": return "Password Rotation Policy";
      case "FREE_TIER_MAX_EMPLOYEES": return "Free Tier Max Limits";
      case "BUSINESS_TIER_MAX_EMPLOYEES": return "Business Tier Max Limits";
      case "PLATFORM_BASE_CURRENCY": return "System Currency";
      case "ALLOW_SELF_REGISTRATION": return "Org Self Registration";
      case "GLOBAL_DEFAULT_LIVENESS_CONFIDENCE": return "AI Liveness Confidence Default";
      case "MAX_REGISTRATION_IMAGES_PER_USER": return "Max Face Samples Limit";
      case "SPOOF_DETECTION_STRICTNESS": return "Anti-Spoof Strictness Mode";
      case "AUTOMATED_BACKUP_FREQUENCY": return "Database Backup Schedule";
      case "ENABLE_SYSTEM_NOTIFICATIONS": return "System Notification Alerts";
      case "ATTENDANCE_LIVENESS_THRESHOLD": return "Liveness Confidence Score";
      case "ATTENDANCE_MATCH_THRESHOLD": return "Face Similarity Match Score";
      case "DUPLICATE_PUNCH_COOLDOWN_MINS": return "Duplicate Check-in Cooldown";
      case "ALLOW_LATE_CHECKIN_GRACE_MINS": return "Late Arrival Grace Period";
      case "AUTO_CHECK_OUT_HOURS": return "Shift Auto Checkout Hours";
      case "RTSP_STREAM_ENABLED": return "RTSP Camera Stream Toggle";
      case "RTSP_STREAM_URL": return "Camera RTSP Stream Endpoint";
      case "LOCATION_LATITUDE": return "Office Latitude";
      case "LOCATION_LONGITUDE": return "Office Longitude";
      case "LOCATION_ADDRESS": return "Office Street Address";
      case "LOCATION_RADIUS_METERS": return "Geofence Radius";
      case "VOICE_GREETING_ENABLED": return "Kiosk Voice Greeting";
      case "VOICE_GREETING_TEXT": return "Greeting Audio Text";
      case "COMPANY_LOGO": return "Organization Logo";
      default: return key.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
    }
  };

  if (profileLoading || isLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter pb-8">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                <Sliders className="w-5 h-5" />
              </div>
              {isSuperAdmin ? "Global SaaS Platform Controls & Governance" : "Organization Operational Settings & AI Controls"}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-300 text-xs">
              {isSuperAdmin 
                ? "Configure platform maintenance, security policies, tier limits, global AI engine defaults, and backups" 
                : "Manage active biometric AI thresholds, RTSP camera streams, geofence coordinates, and company branding"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border ${
              isSuperAdmin 
                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                : "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
            }`}>
              {isSuperAdmin ? "Super Admin Platform Desk" : "Organization Admin Desk"}
            </span>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await queryClient.invalidateQueries({ queryKey: ["settings"] });
                  await refetch();
                } catch (e) {
                  console.error(e);
                } finally {
                  setTimeout(() => setIsRefreshing(false), 800);
                }
              }}
              disabled={isRefreshing}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl cursor-pointer transition-all border border-zinc-200 dark:border-zinc-700 active:scale-95 disabled:opacity-70"
              title="Refresh Settings"
            >
              <RefreshCw 
                className={`w-4 h-4 text-cyan-500 inline-block ${isRefreshing ? "animate-spin spin-icon" : ""}`} 
                style={isRefreshing ? { animation: "spin-360 0.8s linear infinite", transformOrigin: "center" } : {}}
              />
            </button>
          </div>
        </div>

        {/* Dynamic Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Sidebar Tabs */}
          <div className="md:col-span-1 flex flex-col gap-2">
            {isSuperAdmin ? (
              <>
                <button
                  onClick={() => setSuperTab("security")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    superTab === "security"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Lock className={`w-4 h-4 ${superTab === "security" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Security & Maintenance
                </button>

                <button
                  onClick={() => setSuperTab("saas_tiers")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    superTab === "saas_tiers"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Layers className={`w-4 h-4 ${superTab === "saas_tiers" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  SaaS Tier Boundaries
                </button>

                <button
                  onClick={() => setSuperTab("ai_engine")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    superTab === "ai_engine"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Fingerprint className={`w-4 h-4 ${superTab === "ai_engine" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Global AI Engine Defaults
                </button>

                <button
                  onClick={() => setSuperTab("backups")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    superTab === "backups"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Database className={`w-4 h-4 ${superTab === "backups" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Backup & System Health
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setAdminTab("biometrics")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    adminTab === "biometrics"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Fingerprint className={`w-4 h-4 ${adminTab === "biometrics" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Biometrics & AI Accuracy
                </button>

                <button
                  onClick={() => setAdminTab("camera")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    adminTab === "camera"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Camera className={`w-4 h-4 ${adminTab === "camera" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Camera & RTSP Telemetry
                </button>

                <button
                  onClick={() => setAdminTab("location")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    adminTab === "location"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <MapPin className={`w-4 h-4 ${adminTab === "location" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Geofence & Coordinates
                </button>

                <button
                  onClick={() => setAdminTab("customization")}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-none flex items-center gap-3 cursor-pointer ${
                    adminTab === "customization"
                      ? "tech-card-3d-minimal font-extrabold text-zinc-900 dark:text-zinc-100"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Volume2 className={`w-4 h-4 ${adminTab === "customization" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`} />
                  Voice & Logo Customization
                </button>
              </>
            )}
          </div>

          {/* Settings Active Panel */}
          <div className="tech-card-3d-minimal md:col-span-3 p-6 space-y-6">
            
            {/* ══════════ SUPER ADMIN PANELS ══════════ */}
            {isSuperAdmin && (
              <>
                {/* Panel 1: Security & Maintenance */}
                {superTab === "security" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <Lock className="w-4 h-4 text-cyan-500" />
                        Platform Security & System Maintenance
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Control global platform availability, audit trail retention, and rate limits</p>
                    </div>

                    <div className="space-y-4">
                      
                      {/* Maintenance Mode Toggle */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            System-Wide Maintenance Mode
                          </label>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Display maintenance banner and restrict non-admin access across platform</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = editValues["SYSTEM_MAINTENANCE_MODE"] === "true" ? "false" : "true";
                            setEditValues(prev => ({ ...prev, SYSTEM_MAINTENANCE_MODE: nextState }));
                            handleSave("SYSTEM_MAINTENANCE_MODE", nextState);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            editValues["SYSTEM_MAINTENANCE_MODE"] === "true" ? "bg-rose-500" : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              editValues["SYSTEM_MAINTENANCE_MODE"] === "true" ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Audit Log Retention */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Security Audit Log Retention Period
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={editValues["AUDIT_LOG_RETENTION_DAYS"] || "180"}
                            onChange={(e) => {
                              setEditValues(prev => ({ ...prev, AUDIT_LOG_RETENTION_DAYS: e.target.value }));
                              handleSave("AUDIT_LOG_RETENTION_DAYS", e.target.value);
                            }}
                            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="30">30 Days Retention</option>
                            <option value="60">60 Days Retention</option>
                            <option value="90">90 Days Retention</option>
                            <option value="180">180 Days (Recommended)</option>
                            <option value="365">365 Days (1 Year)</option>
                          </select>
                        </div>
                      </div>

                      {/* API Rate Limit */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Global API Rate Limiting Threshold
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={editValues["MAX_API_RATE_LIMIT"] || "120"}
                            onChange={(e) => {
                              setEditValues(prev => ({ ...prev, MAX_API_RATE_LIMIT: e.target.value }));
                              handleSave("MAX_API_RATE_LIMIT", e.target.value);
                            }}
                            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="60">60 Requests / Minute (Strict)</option>
                            <option value="120">120 Requests / Minute (Standard)</option>
                            <option value="240">240 Requests / Minute (High)</option>
                            <option value="500">500 Requests / Minute (Unrestricted)</option>
                          </select>
                        </div>
                      </div>

                      {/* Password Rotation Policy */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Admin Password Expiry & Rotation Policy
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={editValues["FORCE_PASSWORD_CHANGE_DAYS"] || "90"}
                            onChange={(e) => {
                              setEditValues(prev => ({ ...prev, FORCE_PASSWORD_CHANGE_DAYS: e.target.value }));
                              handleSave("FORCE_PASSWORD_CHANGE_DAYS", e.target.value);
                            }}
                            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="30">Every 30 Days</option>
                            <option value="60">Every 60 Days</option>
                            <option value="90">Every 90 Days (Recommended)</option>
                            <option value="180">Every 180 Days</option>
                            <option value="0">Never Expire</option>
                          </select>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Panel 2: SaaS Tier Boundaries */}
                {superTab === "saas_tiers" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-500" />
                        SaaS Plan Employee Capacity & Currency
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Define employee quota boundaries for organizational license tiers</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Free Tier Max Staff Limit
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={editValues["FREE_TIER_MAX_EMPLOYEES"] || "50"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, FREE_TIER_MAX_EMPLOYEES: e.target.value }))}
                            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("FREE_TIER_MAX_EMPLOYEES")}
                            disabled={updatingKey === "FREE_TIER_MAX_EMPLOYEES"}
                            className="px-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center active:scale-95"
                          >
                            {updatingKey === "FREE_TIER_MAX_EMPLOYEES" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Business Tier Max Staff Limit
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={editValues["BUSINESS_TIER_MAX_EMPLOYEES"] || "500"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, BUSINESS_TIER_MAX_EMPLOYEES: e.target.value }))}
                            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("BUSINESS_TIER_MAX_EMPLOYEES")}
                            disabled={updatingKey === "BUSINESS_TIER_MAX_EMPLOYEES"}
                            className="px-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center active:scale-95"
                          >
                            {updatingKey === "BUSINESS_TIER_MAX_EMPLOYEES" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Base Currency & Self Registration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Platform System Currency
                        </label>
                        <select
                          value={editValues["PLATFORM_BASE_CURRENCY"] || "INR (₹)"}
                          onChange={(e) => {
                            setEditValues(prev => ({ ...prev, PLATFORM_BASE_CURRENCY: e.target.value }));
                            handleSave("PLATFORM_BASE_CURRENCY", e.target.value);
                          }}
                          className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                          <option value="USD ($)">USD ($) - US Dollar</option>
                          <option value="EUR (€)">EUR (€) - Euro</option>
                        </select>
                      </div>

                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Allow Organization Self Registration
                          </label>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-300">Allow new companies to sign up online</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = editValues["ALLOW_SELF_REGISTRATION"] === "true" ? "false" : "true";
                            setEditValues(prev => ({ ...prev, ALLOW_SELF_REGISTRATION: nextState }));
                            handleSave("ALLOW_SELF_REGISTRATION", nextState);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            editValues["ALLOW_SELF_REGISTRATION"] === "true" ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              editValues["ALLOW_SELF_REGISTRATION"] === "true" ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* Panel 3: Global AI Engine Defaults */}
                {superTab === "ai_engine" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-cyan-500" />
                        Platform AI Facial Recognition Engine Defaults
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Control global default liveness cutoff, facial sample limits, and spoof strictness</p>
                    </div>

                    <div className="space-y-4">
                      
                      {/* Global Liveness Confidence */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            Default Liveness Confidence Floor
                          </label>
                          <span className="text-xs font-mono font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {editValues["GLOBAL_DEFAULT_LIVENESS_CONFIDENCE"] || "0.85"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="0.50"
                            max="0.99"
                            step="0.01"
                            value={editValues["GLOBAL_DEFAULT_LIVENESS_CONFIDENCE"] || "0.85"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, GLOBAL_DEFAULT_LIVENESS_CONFIDENCE: e.target.value }))}
                            className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("GLOBAL_DEFAULT_LIVENESS_CONFIDENCE")}
                            disabled={updatingKey === "GLOBAL_DEFAULT_LIVENESS_CONFIDENCE"}
                            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "GLOBAL_DEFAULT_LIVENESS_CONFIDENCE" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save
                          </button>
                        </div>
                      </div>

                      {/* Anti-Spoof Strictness Mode */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Anti-Spoof Detection Strictness Mode
                        </label>
                        <select
                          value={editValues["SPOOF_DETECTION_STRICTNESS"] || "Strict"}
                          onChange={(e) => {
                            setEditValues(prev => ({ ...prev, SPOOF_DETECTION_STRICTNESS: e.target.value }));
                            handleSave("SPOOF_DETECTION_STRICTNESS", e.target.value);
                          }}
                          className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="Standard">Standard Liveness Checking</option>
                          <option value="Strict">Strict 3D Depth + Motion (Recommended)</option>
                          <option value="Ultra">Ultra High Security (Biometric Hardware Required)</option>
                        </select>
                      </div>

                      {/* Max Registration Images */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Max Facial Sample Embeddings Per User
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={editValues["MAX_REGISTRATION_IMAGES_PER_USER"] || "5"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, MAX_REGISTRATION_IMAGES_PER_USER: e.target.value }))}
                            className="w-24 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
                          />
                          <span className="text-xs font-bold text-zinc-400">Samples / User</span>
                          <button
                            onClick={() => handleSave("MAX_REGISTRATION_IMAGES_PER_USER")}
                            disabled={updatingKey === "MAX_REGISTRATION_IMAGES_PER_USER"}
                            className="ml-auto px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "MAX_REGISTRATION_IMAGES_PER_USER" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Update
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Panel 4: System Backup & Health */}
                {superTab === "backups" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <Database className="w-4 h-4 text-cyan-500" />
                        System Database Backup Schedule & Service Telemetry
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Manage automated database backup schedules and check real-time service health</p>
                    </div>

                    <div className="space-y-4">
                      
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Automated Database Snapshot Frequency
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={editValues["AUTOMATED_BACKUP_FREQUENCY"] || "Daily"}
                            onChange={(e) => {
                              setEditValues(prev => ({ ...prev, AUTOMATED_BACKUP_FREQUENCY: e.target.value }));
                              handleSave("AUTOMATED_BACKUP_FREQUENCY", e.target.value);
                            }}
                            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="Daily">Daily Snapshot (Recommended)</option>
                            <option value="Weekly">Weekly Snapshot</option>
                            <option value="Monthly">Monthly Snapshot</option>
                          </select>
                        </div>
                      </div>

                      {/* Enable System Notifications Toggle */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Enable Global Alert Notifications Dispatch
                          </label>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-300">Dispatch critical system security and backup alerts to administrators</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = editValues["ENABLE_SYSTEM_NOTIFICATIONS"] === "true" ? "false" : "true";
                            setEditValues(prev => ({ ...prev, ENABLE_SYSTEM_NOTIFICATIONS: nextState }));
                            handleSave("ENABLE_SYSTEM_NOTIFICATIONS", nextState);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            editValues["ENABLE_SYSTEM_NOTIFICATIONS"] === "true" ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              editValues["ENABLE_SYSTEM_NOTIFICATIONS"] === "true" ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Live Microservices Telemetry */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">REST API Engine</span>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">Healthy (2ms)</p>
                        </div>
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">PostgreSQL Database</span>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">Connected (Active)</p>
                        </div>
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">RTSP Streaming Node</span>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">Operational</p>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══════════ ORGANIZATION ADMIN PANELS ══════════ */}
            {!isSuperAdmin && (
              <>
                {/* Tab 1: Biometrics & AI Accuracy */}
                {adminTab === "biometrics" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-cyan-500" />
                        Biometric Matching & Shift Grace Parameters
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Adjust face recognition similarity, liveness confidence cutoff, and shift grace periods</p>
                    </div>

                    <div className="space-y-4">
                      
                      {/* Liveness Threshold */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              Anti-Spoof Liveness Score Cutoff
                            </label>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-300">Minimum 3D anti-spoof confidence score required to approve verification</p>
                          </div>
                          <span className="text-xs font-mono font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {editValues["ATTENDANCE_LIVENESS_THRESHOLD"] || "0.85"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="0.50"
                            max="0.99"
                            step="0.01"
                            value={editValues["ATTENDANCE_LIVENESS_THRESHOLD"] || "0.85"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, ATTENDANCE_LIVENESS_THRESHOLD: e.target.value }))}
                            className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("ATTENDANCE_LIVENESS_THRESHOLD")}
                            disabled={updatingKey === "ATTENDANCE_LIVENESS_THRESHOLD"}
                            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "ATTENDANCE_LIVENESS_THRESHOLD" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save
                          </button>
                        </div>
                      </div>

                      {/* Face Similarity Match Score */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              Face Embedding Similarity Threshold
                            </label>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-300">Cosine similarity threshold for 512-dim facial vector identification</p>
                          </div>
                          <span className="text-xs font-mono font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {editValues["ATTENDANCE_MATCH_THRESHOLD"] || "0.65"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="0.40"
                            max="0.95"
                            step="0.01"
                            value={editValues["ATTENDANCE_MATCH_THRESHOLD"] || "0.65"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, ATTENDANCE_MATCH_THRESHOLD: e.target.value }))}
                            className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("ATTENDANCE_MATCH_THRESHOLD")}
                            disabled={updatingKey === "ATTENDANCE_MATCH_THRESHOLD"}
                            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "ATTENDANCE_MATCH_THRESHOLD" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save
                          </button>
                        </div>
                      </div>

                      {/* Late Arrival Grace Period */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Late Check-in Grace Period
                        </label>
                        <div className="flex items-center gap-2 font-mono">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={editValues["ALLOW_LATE_CHECKIN_GRACE_MINS"] || "15"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, ALLOW_LATE_CHECKIN_GRACE_MINS: e.target.value }))}
                            className="w-24 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-cyan-500"
                          />
                          <span className="text-xs font-bold text-zinc-400 font-sans">Minutes Grace</span>
                          <button
                            onClick={() => handleSave("ALLOW_LATE_CHECKIN_GRACE_MINS")}
                            disabled={updatingKey === "ALLOW_LATE_CHECKIN_GRACE_MINS"}
                            className="ml-auto px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "ALLOW_LATE_CHECKIN_GRACE_MINS" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Update
                          </button>
                        </div>
                      </div>

                      {/* Duplicate Punch Cooldown */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Duplicate Check-in Cooldown Period
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={editValues["DUPLICATE_PUNCH_COOLDOWN_MINS"] || "5"}
                            onChange={(e) => setEditValues(prev => ({ ...prev, DUPLICATE_PUNCH_COOLDOWN_MINS: e.target.value }))}
                            className="w-24 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
                          />
                          <span className="text-xs font-bold text-zinc-400">Minutes</span>
                          <button
                            onClick={() => handleSave("DUPLICATE_PUNCH_COOLDOWN_MINS")}
                            disabled={updatingKey === "DUPLICATE_PUNCH_COOLDOWN_MINS"}
                            className="ml-auto px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "DUPLICATE_PUNCH_COOLDOWN_MINS" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Update
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Tab 2: Camera & RTSP Stream Telemetry */}
                {adminTab === "camera" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <Camera className="w-4 h-4 text-cyan-500" />
                        IP Camera & RTSP Stream Service
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Configure live RTSP network video stream endpoints for automated kiosk frame processing</p>
                    </div>

                    <div className="space-y-4">
                      
                      {/* RTSP Stream Toggle */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Enable Automated RTSP Camera Video Processing
                          </label>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Stream frames directly from CCTV/IP camera endpoints</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = editValues["RTSP_STREAM_ENABLED"] === "true" ? "false" : "true";
                            setEditValues(prev => ({ ...prev, RTSP_STREAM_ENABLED: nextState }));
                            handleSave("RTSP_STREAM_ENABLED", nextState);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            editValues["RTSP_STREAM_ENABLED"] === "true" ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              editValues["RTSP_STREAM_ENABLED"] === "true" ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* RTSP Stream URL */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Camera RTSP Stream Endpoint URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="rtsp://admin:password@192.168.1.100:554/live"
                            value={editValues["RTSP_STREAM_URL"] || ""}
                            onChange={(e) => setEditValues(prev => ({ ...prev, RTSP_STREAM_URL: e.target.value }))}
                            className="flex-1 h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("RTSP_STREAM_URL")}
                            disabled={updatingKey === "RTSP_STREAM_URL"}
                            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "RTSP_STREAM_URL" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save Endpoint
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Tab 3: Geofence & Location Restriction */}
                {adminTab === "location" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex justify-between items-center">
                      <div>
                        <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-cyan-500" />
                          Office Geofence Coordinates
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Restrict mobile & remote employee check-ins to authorized location boundaries</p>
                      </div>
                      <button
                        onClick={handleSetCurrentLocation}
                        disabled={fetchingGps}
                        className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
                      >
                        {fetchingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        Lock Current GPS Location
                      </button>
                    </div>

                    <div className="space-y-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Latitude
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editValues["LOCATION_LATITUDE"] || ""}
                              onChange={(e) => setEditValues(prev => ({ ...prev, LOCATION_LATITUDE: e.target.value }))}
                              className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                            />
                            <button
                              onClick={() => handleSave("LOCATION_LATITUDE")}
                              disabled={updatingKey === "LOCATION_LATITUDE"}
                              className="px-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center active:scale-95"
                            >
                              {updatingKey === "LOCATION_LATITUDE" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Longitude
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editValues["LOCATION_LONGITUDE"] || ""}
                              onChange={(e) => setEditValues(prev => ({ ...prev, LOCATION_LONGITUDE: e.target.value }))}
                              className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                            />
                            <button
                              onClick={() => handleSave("LOCATION_LONGITUDE")}
                              disabled={updatingKey === "LOCATION_LONGITUDE"}
                              className="px-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center active:scale-95"
                            >
                              {updatingKey === "LOCATION_LONGITUDE" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Geofence Allowed Radius */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Allowed Geofence Check-in Radius
                        </label>
                        <select
                          value={editValues["LOCATION_RADIUS_METERS"] || "200"}
                          onChange={(e) => {
                            setEditValues(prev => ({ ...prev, LOCATION_RADIUS_METERS: e.target.value }));
                            handleSave("LOCATION_RADIUS_METERS", e.target.value);
                          }}
                          className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="50">50 Meters (Strict Building Premises)</option>
                          <option value="100">100 Meters (Campus Premises)</option>
                          <option value="200">200 Meters (Standard Radius)</option>
                          <option value="500">500 Meters (Flexible Area)</option>
                          <option value="1000">1000 Meters (1 KM Radius)</option>
                        </select>
                      </div>

                      {/* Street Address */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Office Street Address
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Technology Tower, Infocity, Bhubaneswar"
                            value={editValues["LOCATION_ADDRESS"] || ""}
                            onChange={(e) => setEditValues(prev => ({ ...prev, LOCATION_ADDRESS: e.target.value }))}
                            className="flex-1 h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            onClick={() => handleSave("LOCATION_ADDRESS")}
                            disabled={updatingKey === "LOCATION_ADDRESS"}
                            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                          >
                            {updatingKey === "LOCATION_ADDRESS" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save Address
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Tab 4: Voice & Branding Customization */}
                {adminTab === "customization" && (
                  <div className="space-y-5">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-cyan-500" />
                        Voice Announcement & Organization Logo
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Customize biometric kiosk audio responses and upload organizational logo</p>
                    </div>

                    <div className="space-y-4">
                      
                      {/* Voice Greeting Toggle */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Enable Voice Greeting Audio Announcements
                          </label>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-300 mt-0.5">Announce successful check-in greeting on biometric kiosk scanners</p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = editValues["VOICE_GREETING_ENABLED"] === "false" ? "true" : "false";
                            setEditValues(prev => ({ ...prev, VOICE_GREETING_ENABLED: nextState }));
                            handleSave("VOICE_GREETING_ENABLED", nextState);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            editValues["VOICE_GREETING_ENABLED"] !== "false" ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              editValues["VOICE_GREETING_ENABLED"] !== "false" ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Custom Voice Text */}
                      {editValues["VOICE_GREETING_ENABLED"] !== "false" && (
                        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                          <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                            Custom Audio Announcement Text
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editValues["VOICE_GREETING_TEXT"] || "Welcome to office, attendance recorded successfully."}
                              onChange={(e) => setEditValues(prev => ({ ...prev, VOICE_GREETING_TEXT: e.target.value }))}
                              className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
                            />
                            <button
                              onClick={() => handleSave("VOICE_GREETING_TEXT")}
                              disabled={updatingKey === "VOICE_GREETING_TEXT"}
                              className="px-3.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center active:scale-95"
                            >
                              {updatingKey === "VOICE_GREETING_TEXT" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Logo Upload */}
                      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 space-y-2">
                        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          Organization Logo
                        </label>
                        
                        {editValues["COMPANY_LOGO"] ? (
                          <div className="relative w-full h-32 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-950 flex items-center justify-center p-3 group">
                            <img src={editValues["COMPANY_LOGO"]} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => {
                                setEditValues(prev => ({ ...prev, COMPANY_LOGO: "" }));
                                handleSave("COMPANY_LOGO", "");
                              }}
                              className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
                              Remove Logo
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-28 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-cyan-500 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-zinc-900 hover:bg-cyan-500/5 transition-all">
                            <Upload className="w-5 h-5 text-cyan-500" />
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Upload Image File (PNG / JPG)</span>
                            <span className="text-[10px] text-zinc-400">Max size: 500 KB</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 512 * 1024) {
                                  toast.error("Logo file size must be under 500KB");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64String = reader.result as string;
                                  setEditValues(prev => ({ ...prev, COMPANY_LOGO: base64String }));
                                  handleSave("COMPANY_LOGO", base64String);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </>
            )}

          </div>

        </div>

      </div>
    </SidebarLayout>
  );
}
