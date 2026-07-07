"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  Check, Loader2, CheckCircle2, AlertCircle, Sliders, Info,
  Fingerprint, Clock, Volume2, Palette, Upload, Trash2, Camera, MapPin, WifiOff, RefreshCw
} from "lucide-react";

type SettingsTab = "biometrics" | "shift" | "voice" | "branding" | "location" | "advanced";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("biometrics");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [fetchingGps, setFetchingGps] = useState(false);

  const { data: settings, isLoading, isError, error } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const data = await fetchApi("/settings/");
      const valMap: Record<string, string> = {};
      let hasAddress = false;
      data.forEach((s: any) => { 
        valMap[s.key] = s.value; 
        if(s.key === "LOCATION_ADDRESS") hasAddress = true;
      });
      if (!hasAddress) {
        data.push({ id: "virtual-addr", key: "LOCATION_ADDRESS", value: "", description: "Office Location Address (e.g. Patrapada, Bhubaneswar)" });
        valMap["LOCATION_ADDRESS"] = "";
      }
      setEditValues(valMap);
      return data;
    },
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      fetchApi(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSuccessKey(data.key);
      setUpdatingKey(null);
      setTimeout(() => setSuccessKey(null), 3000);
    },
    onError: (err: any, vars) => {
      setUpdatingKey(null);
      toast.error(err.message || `Failed to save ${vars.key}`);
    }
  });

  const handleSave = (key: string) => {
    setUpdatingKey(key);
    saveMutation.mutate({ key, value: editValues[key] });
  };

  const handleSetCurrentLocation = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      setFetchingGps(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toString();
          const lon = position.coords.longitude.toString();
          
          setEditValues(prev => ({
            ...prev,
            LOCATION_LATITUDE: lat,
            LOCATION_LONGITUDE: lon
          }));
          
          // Save both settings
          saveMutation.mutate({ key: "LOCATION_LATITUDE", value: lat });
          saveMutation.mutate({ key: "LOCATION_LONGITUDE", value: lon });
          
          try {
            const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/reverse-geocode?lat=${lat}&lng=${lon}`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data.address) {
                setEditValues(prev => ({ ...prev, LOCATION_ADDRESS: data.address }));
                saveMutation.mutate({ key: "LOCATION_ADDRESS", value: data.address });
              }
            }
          } catch (err) {
            console.error("Failed to fetch address", err);
          }
          
          toast.success("Coordinates updated to current location!");
          setFetchingGps(false);
        },
        (err) => {
          console.error("GPS error:", err);
          toast.error("Failed to get current location. Ensure GPS permission is granted.");
          setFetchingGps(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  };

  const handleGeocodeAddress = async (address: string) => {
    if (!address.trim()) return;
    setFetchingGps(true);
    setUpdatingKey("LOCATION_ADDRESS");
    try {
      const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/geocode?address=${encodeURIComponent(address)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) {
          const lat = data.lat.toString();
          const lon = data.lng.toString();
          
          setEditValues(prev => ({
            ...prev,
            LOCATION_LATITUDE: lat,
            LOCATION_LONGITUDE: lon,
            LOCATION_ADDRESS: address
          }));
          
          saveMutation.mutate({ key: "LOCATION_LATITUDE", value: lat });
          saveMutation.mutate({ key: "LOCATION_LONGITUDE", value: lon });
          saveMutation.mutate({ key: "LOCATION_ADDRESS", value: address });
          
          toast.success("Location locked to the provided address!");
        } else {
           toast.error("Could not find coordinates for this address.");
        }
      } else {
        toast.error("Failed to geocode address.");
      }
    } catch (err) {
      console.error("Geocoding error", err);
      toast.error("Error geocoding address.");
    }
    setFetchingGps(false);
    setUpdatingKey(null);
  };

  // Group settings by keys for our tabs
  const getTabForSettings = (key: string): SettingsTab => {
    if (key.includes("LOCATION")) return "location";
    if (key.includes("COMPANY") || key.includes("LOGO") || key.includes("BADGE")) return "branding";
    if (key.includes("FACE") || key.includes("LIVENESS")) return "biometrics";
    if (key.includes("SHIFT") || key.includes("CHECK") || key.includes("GRACE")) return "shift";
    if (key.includes("VOICE") || key.includes("GREETING")) return "voice";
    return "advanced";
  };

  const formatSettingKey = (key: string) => {
    return key
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const filteredSettings = settings?.filter((s: any) => getTabForSettings(s.key) === activeTab) || [];

  const booleanSettings = filteredSettings.filter((s: any) => {
    const val = editValues[s.key] || "";
    return s.key === "VOICE_GREETING_ENABLED" || s.key === "SYSTEM_MAINTENANCE_MODE" || val === "true" || val === "false";
  });

  const standardSettings = filteredSettings.filter((s: any) => {
    const val = editValues[s.key] || "";
    return !(s.key === "VOICE_GREETING_ENABLED" || s.key === "SYSTEM_MAINTENANCE_MODE" || val === "true" || val === "false");
  });



  const isAutosaveKey = (key: string) => {
    return key === "VOICE_GREETING_ENABLED" || key === "SYSTEM_MAINTENANCE_MODE";
  };

  const renderSettingControl = (setting: any, isUpdating: boolean) => {
    const key = setting.key;
    const val = editValues[key] || "";

    // Toggle for Booleans (with Auto-save)
    if (key === "VOICE_GREETING_ENABLED" || key === "SYSTEM_MAINTENANCE_MODE" || val === "true" || val === "false") {
      const isChecked = val === "true";
      const nextVal = isChecked ? "false" : "true";
      return (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => {
            setEditValues(prev => ({ ...prev, [key]: nextVal }));
            setUpdatingKey(key);
            saveMutation.mutate({ key, value: nextVal });
          }}
          className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isChecked ? "bg-slate-900" : "bg-slate-200"
          } ${isUpdating ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span
            className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
              isChecked ? "translate-x-4.5" : "translate-x-0"
            }`}
          />
        </button>
      );
    }

    // Range Slider for Thresholds
    if (key.includes("THRESHOLD")) {
      const numVal = parseFloat(val) || 0;
      return (
        <div className="flex items-center gap-3 w-40 sm:w-48">
          <input
            type="range"
            min="0.10"
            max="1.00"
            step="0.01"
            value={numVal}
            disabled={isUpdating}
            onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
          />
          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-11 text-center shrink-0">
            {numVal.toFixed(2)}
          </span>
        </div>
      );
    }

    // Time inputs for check-in/out
    if (key.includes("START") || key.includes("END")) {
      return (
        <input
          type="time"
          value={val}
          disabled={isUpdating}
          onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
          className="input-field h-9 text-[12px] w-28 bg-white border-slate-200 rounded-xl px-2.5 focus:border-slate-800 transition-all text-center"
        />
      );
    }

    // Number input for grace period, image limits, or time counters
    if (key.includes("MINUTES") || key.includes("PERIOD") || key.includes("IMAGES") || key.includes("SECONDS") || key.includes("MAX_")) {
      const unit = key.includes("MINUTES") ? "min" : key.includes("SECONDS") ? "sec" : key.includes("IMAGES") ? "imgs" : "";
      return (
        <div className="flex items-center gap-1.5 font-mono">
          <input
            type="number"
            value={val}
            disabled={isUpdating}
            onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
            className="input-field h-9 text-[12px] w-20 bg-white border-slate-200 rounded-xl px-2.5 focus:border-slate-800 transition-all text-center"
          />
          {unit && <span className="text-[11px] text-slate-450 font-medium font-sans">{unit}</span>}
        </div>
      );
    }

    if (key === "BADGE_THEME_COLOR") {
      return (
        <select
          value={val}
          disabled={isUpdating}
          onChange={(e) => {
            setEditValues(prev => ({ ...prev, [key]: e.target.value }));
            setUpdatingKey(key);
            saveMutation.mutate({ key, value: e.target.value });
          }}
          className="input-field h-9 text-[12.5px] w-40 bg-white border-slate-250 rounded-xl px-3 focus:border-slate-800 transition-all font-semibold cursor-pointer text-center"
        >
          <option value="Navy Blue">Navy Blue</option>
          <option value="Charcoal">Charcoal</option>
          <option value="Emerald">Emerald</option>
          <option value="Saffron">Saffron</option>
        </select>
      );
    }

    if (key === "BADGE_PATTERN_TYPE") {
      return (
        <select
          value={val}
          disabled={isUpdating}
          onChange={(e) => {
            setEditValues(prev => ({ ...prev, [key]: e.target.value }));
            setUpdatingKey(key);
            saveMutation.mutate({ key, value: e.target.value });
          }}
          className="input-field h-9 text-[12.5px] w-40 bg-white border-slate-250 rounded-xl px-3 focus:border-slate-800 transition-all font-semibold cursor-pointer text-center"
        >
          <option value="None">None</option>
          <option value="Indian Mandala">Indian Mandala</option>
          <option value="Corporate Waves">Corporate Waves</option>
          <option value="Cyber Grid">Cyber Grid</option>
        </select>
      );
    }

    if (key === "COMPANY_LOGO") {
      return (
        <div className="flex flex-col items-center gap-3 w-full sm:w-64">
          {val ? (
            <div className="relative w-full h-24 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2 group">
              <img src={val} alt="Company Logo" className="max-w-full max-h-full object-contain" />
              <button
                type="button"
                onClick={() => {
                  setEditValues(prev => ({ ...prev, [key]: "" }));
                  setUpdatingKey(key);
                  saveMutation.mutate({ key, value: "" });
                }}
                className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Logo
              </button>
            </div>
          ) : (
            <label className="w-full h-24 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-all">
              <Upload className="w-5 h-5 text-slate-450" />
              <span className="text-[11px] text-slate-500 font-medium">Upload PNG/JPG (Max 500KB)</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUpdating}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 512 * 1024) {
                    toast.error("Logo must be under 500KB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64String = reader.result as string;
                    setEditValues(prev => ({ ...prev, [key]: base64String }));
                    setUpdatingKey(key);
                    saveMutation.mutate({ key, value: base64String });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          )}
        </div>
      );
    }

    // Default Fallback
    return (
      <input
        type="text"
        value={val}
        disabled={isUpdating}
        onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
        className="input-field h-9 text-[12.5px] w-36 bg-white border-slate-200 rounded-xl px-3 focus:border-slate-800 transition-all text-center"
      />
    );
  };

  const getTabIcon = (tab: SettingsTab) => {
    switch(tab) {
      case "biometrics": return <Fingerprint className="w-4 h-4" />;
      case "shift": return <Clock className="w-4 h-4" />;
      case "voice": return <Volume2 className="w-4 h-4" />;
      case "branding": return <Palette className="w-4 h-4" />;
      case "location": return <MapPin className="w-4 h-4" />;
      case "advanced": return <Sliders className="w-4 h-4" />;
    }
  };

  const getTabLabel = (tab: SettingsTab) => {
    switch(tab) {
      case "biometrics": return "Biometrics & AI";
      case "shift": return "Shift & Grace Hours";
      case "voice": return "Voice Alerts";
      case "branding": return "Branding & Badge";
      case "location": return "Location Restriction";
      case "advanced": return "Advanced Configurations";
    }
  };

  const getTabDesc = (tab: SettingsTab) => {
    switch(tab) {
      case "biometrics": return "Configure facial matching similarity and liveness parameters";
      case "shift": return "Manage daily check-in start, grace window, and shifts";
      case "voice": return "Enable or disable text-to-speech audio feedback at terminals";
      case "branding": return "Set organization logo and name for employee ID cards";
      case "location": return "Set coordinates and allowed radius for geofenced kiosk attendance";
      case "advanced": return "System variables and advanced parameters";
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl page-enter text-slate-800">
        {/* Header */}
        <div className="pb-5 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Configuration</h1>
        </div>

        {/* Outer container */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          
          {/* Left Navigation: Vertical tabs */}
          <div className="space-y-1 md:col-span-1">
            {(["biometrics", "shift", "voice", "branding", "location", "advanced"] as SettingsTab[]).map(tab => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold border transition-all cursor-pointer ${
                    isActive 
                      ? "bg-zinc-100 border-zinc-200 text-zinc-950 shadow-2xs"
                      : "bg-transparent border-transparent text-slate-650 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg border transition-all ${
                    isActive ? "bg-zinc-900 border-zinc-900 text-white" : "bg-zinc-50 border-zinc-200 text-slate-400"
                  }`}>
                    {getTabIcon(tab)}
                  </div>
                  <span>{getTabLabel(tab)}</span>
                </button>
              );
            })}
          </div>

          {/* Right Panels */}
          <div className="md:col-span-3 space-y-5">
            
            {/* Setting List Card */}
            <div className="glass-card rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              {/* Card Header - Beautifully light without background */}
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">
                  {getTabLabel(activeTab)}
                </h2>
              </div>

              {isLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 py-2">
                      <div className="space-y-2 flex-1">
                        <div className="skeleton h-4 w-40" />
                        <div className="skeleton h-3 w-64" />
                      </div>
                      <div className="skeleton h-9 w-36" />
                    </div>
                  ))}
                </div>
              ) : isError ? (
                <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200">
                    <WifiOff className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">Connection Failed</h3>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Could not load settings from the backend server. Please verify the backend is running and reachable.
                    </p>
                    <p className="text-[10px] font-mono text-red-400 mt-2 break-all max-w-sm">
                      {(error as Error)?.message || "Unknown error"}
                    </p>
                  </div>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["settings"] })}
                    className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              ) : filteredSettings.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No configuration parameters found under this category.
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Grid layout for Boolean Settings (Modern Feature Cards) */}
                  {booleanSettings.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-6 bg-slate-50/20 border-b border-slate-100">
                      {booleanSettings.map((setting: any) => {
                        const key = setting.key;
                        const val = editValues[key] || "";
                        const isChecked = val === "true";
                        const nextVal = isChecked ? "false" : "true";
                        const isUpdating = updatingKey === key;
                        const isSuccess = successKey === key;

                        const getSettingIcon = (k: string) => {
                          if (k.includes("VOICE") || k.includes("GREETING")) return <Volume2 className="w-5 h-5" />;
                          if (k.includes("MAINTENANCE")) return <AlertCircle className="w-5 h-5" />;
                          if (k.includes("RTSP")) return <Camera className="w-5 h-5" />;
                          return <Sliders className="w-5 h-5" />;
                        };

                        return (
                          <div 
                            key={setting.id}
                            onClick={() => {
                              if (!isUpdating) {
                                setEditValues(prev => ({ ...prev, [key]: nextVal }));
                                setUpdatingKey(key);
                                saveMutation.mutate({ key, value: nextVal });
                              }
                            }}
                            className={`group p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between h-42 select-none ${
                              isChecked 
                                ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10" 
                                : "bg-white border-slate-200 text-slate-800 hover:border-slate-350 hover:shadow-sm"
                            } ${isUpdating ? "opacity-60 pointer-events-none" : ""}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className={`p-2 rounded-xl border transition-colors ${
                                isChecked ? "bg-slate-800 border-slate-700 text-cyan-400" : "bg-slate-50 border-slate-100 text-slate-500"
                              }`}>
                                {getSettingIcon(key)}
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                {isUpdating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                ) : isSuccess ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />
                                ) : (
                                  <div className={`w-1.5 h-1.5 rounded-full ${isChecked ? "bg-cyan-400 animate-pulse" : "bg-slate-300"}`} />
                                )}
                              </div>
                            </div>

                            <div className="space-y-1 mt-3">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400" title={key}>
                                {formatSettingKey(key)}
                              </h4>
                              <p className={`text-[12px] leading-snug font-medium ${isChecked ? "text-slate-200" : "text-slate-600"}`}>
                                {setting.description || "System configuration parameter"}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100/5">
                              <span className="text-[9px] font-mono tracking-wider opacity-65">
                                {isChecked ? "ACTIVE" : "DISABLED"}
                              </span>
                              <div className={`h-4.5 w-8 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                isChecked ? "bg-cyan-500" : "bg-slate-200"
                              }`}>
                                <div className={`h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                                  isChecked ? "translate-x-3.5" : "translate-x-0"
                                }`} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Standard Settings list */}
                  {standardSettings.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {standardSettings.map((setting: any) => {
                        const isUpdating = updatingKey === setting.key;
                        const isSuccess = successKey === setting.key;
                        const isDirty = (() => {
                          const currentVal = editValues[setting.key];
                          const originalVal = setting.value;
                          if (currentVal === undefined || originalVal === undefined) return false;
                          if (setting.key.includes("THRESHOLD")) {
                            return parseFloat(currentVal) !== parseFloat(originalVal);
                          }
                          return currentVal !== originalVal;
                        })();

                        return (
                          <div key={setting.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/30 transition-all duration-200">
                            <div className="flex-1 space-y-0.5">
                              <h3 className="text-sm font-semibold text-slate-800 hover:text-slate-900 transition-colors" title={setting.key}>
                                {formatSettingKey(setting.key)}
                              </h3>
                              <p className="text-xs text-slate-450 leading-normal max-w-sm sm:max-w-md">
                                {setting.description || "System configuration parameter"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {renderSettingControl(setting, isUpdating)}

                              {setting.key !== "COMPANY_LOGO" && setting.key !== "BADGE_THEME_COLOR" && setting.key !== "BADGE_PATTERN_TYPE" && (
                                <button
                                  onClick={() => {
                                    if (setting.key === "LOCATION_ADDRESS") {
                                      handleGeocodeAddress(editValues[setting.key] || "");
                                    } else {
                                      handleSave(setting.key);
                                    }
                                  }}
                                  disabled={isUpdating || !isDirty}
                                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                                    isSuccess
                                      ? "bg-emerald-55 border-emerald-250 text-emerald-600 shadow-xs scale-105"
                                      : isDirty
                                        ? "bg-slate-900 border-slate-900 text-white hover:bg-slate-800 hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-slate-900/10"
                                        : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                                  }`}
                                >
                                  {isUpdating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : isSuccess ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Location Extra Actions */}
                  {activeTab === "location" && (
                    <div className="px-6 py-5 border-t border-slate-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/20 transition-all duration-200">
                      <div className="flex-1 space-y-0.5">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Auto-Detect Coordinates</h3>
                        <p className="text-xs text-slate-450 leading-normal max-w-sm sm:max-w-md">
                          Automatically capture this device's current GPS latitude and longitude coordinates.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={fetchingGps}
                        onClick={handleSetCurrentLocation}
                        className={`h-9.5 px-4 rounded-xl text-[12px] font-extrabold transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
                          fetchingGps 
                            ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed" 
                            : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900"
                        }`}
                      >
                        {fetchingGps ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                        Set to Current GPS Location
                      </button>
                    </div>
                  )}

                  {/* Map Display */}
                  {activeTab === "location" && (
                    <div className="px-6 py-5 border-t border-slate-100/80 bg-slate-50/20">
                      <h3 className="text-sm font-semibold text-slate-800 mb-4">Location Preview</h3>
                      {editValues["LOCATION_LATITUDE"] && editValues["LOCATION_LONGITUDE"] ? (
                        <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
                          <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            scrolling="no" 
                            marginHeight={0} 
                            marginWidth={0} 
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(editValues["LOCATION_LONGITUDE"]) - 0.01}%2C${parseFloat(editValues["LOCATION_LATITUDE"]) - 0.01}%2C${parseFloat(editValues["LOCATION_LONGITUDE"]) + 0.01}%2C${parseFloat(editValues["LOCATION_LATITUDE"]) + 0.01}&layer=mapnik&marker=${editValues["LOCATION_LATITUDE"]}%2C${editValues["LOCATION_LONGITUDE"]}`}
                          ></iframe>
                        </div>
                      ) : (
                        <div className="w-full h-64 rounded-xl border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                          Map preview not available. Please save a valid location.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info alerts */}
            {activeTab === "biometrics" && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50/50 border border-amber-200/50 text-amber-900 text-[11px] animate-fadeInUp">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Tip:</strong> Lower face threshold values increase matching speed but may cause false matches. Keep liveness between <strong>0.70 - 0.85</strong> for optimal anti-spoofing.
                </span>
              </div>
            )}

            {activeTab === "shift" && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-650 text-[11px] animate-fadeInUp">
                <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>
                  <strong>Note:</strong> Check-ins past the start time plus the grace window will automatically be flagged as <strong>Late</strong>.
                </span>
              </div>
            )}

            {activeTab === "branding" && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-650 text-[11px] animate-fadeInUp">
                <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>
                  <strong>Tip:</strong> The company name and logo uploaded here will dynamically populate on all newly enrolled employee ID Cards and badge PDF prints.
                </span>
              </div>
            )}

            {activeTab === "location" && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-650 text-[11px] animate-fadeInUp">
                <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>
                  <strong>Note:</strong> When Location Restriction is enabled, kiosk swiping is only permitted for employees within the radius limit unless they have the WFH bypass permission.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
