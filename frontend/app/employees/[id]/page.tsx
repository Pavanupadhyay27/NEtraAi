"use client";
  
import React, { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getBackendUrl, parseDateTime, getAccessToken } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  ChevronLeft, Printer, Download, Mail, Phone, Calendar, 
  Briefcase, CheckCircle2, AlertCircle, Palette, Upload, Trash2,
  Camera, Shield, Award, Clock, Edit, X, Loader2, MapPin
} from "lucide-react";
import AttendanceHeatmap from "@/components/AttendanceHeatmap";

// Theme styles configuration mapping
const themeStylesMap = {
  Saffron: {
    headerBg: "bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600",
    accentText: "text-orange-600 dark:text-orange-400",
    accentBorder: "border-orange-500",
    accentBg: "bg-orange-50/40 dark:bg-orange-950/20",
    photoBorder: "from-amber-500 to-red-500",
    dotColor: "bg-orange-500",
    primaryHex: "#f97316",
    headerHex1: "#d97706",
    headerHex2: "#dc2626"
  },
  Emerald: {
    headerBg: "bg-gradient-to-tr from-slate-900 via-emerald-950 to-teal-900",
    accentText: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-emerald-500",
    accentBg: "bg-emerald-50/40 dark:bg-emerald-950/20",
    photoBorder: "from-emerald-500 to-teal-400",
    dotColor: "bg-emerald-500",
    primaryHex: "#10b981",
    headerHex1: "#064e3b",
    headerHex2: "#0f766e"
  },
  Charcoal: {
    headerBg: "bg-gradient-to-tr from-zinc-900 via-slate-800 to-zinc-950",
    accentText: "text-zinc-600 dark:text-zinc-400",
    accentBorder: "border-zinc-500",
    accentBg: "bg-zinc-50/40 dark:bg-zinc-900/20",
    photoBorder: "from-zinc-500 to-slate-400",
    dotColor: "bg-zinc-500",
    primaryHex: "#6b7280",
    headerHex1: "#18181b",
    headerHex2: "#27272a"
  },
  "Navy Blue": {
    headerBg: "bg-gradient-to-tr from-slate-900 via-blue-900 to-indigo-950",
    accentText: "text-cyan-500 dark:text-cyan-400",
    accentBorder: "border-cyan-500",
    accentBg: "bg-slate-50/40 dark:bg-slate-900/20",
    photoBorder: "from-cyan-500 to-emerald-400",
    dotColor: "bg-cyan-500",
    primaryHex: "#06b6d4",
    headerHex1: "#0f172a",
    headerHex2: "#1e3a8a"
  }
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const employeeId = params.id;
  const { toast } = useToast();
  const [logoUploading, setLogoUploading] = useState(false);
  const [photoTimestamp, setPhotoTimestamp] = useState(Date.now());
  const [photoUploading, setPhotoUploading] = useState(false);
  const [updatingWfh, setUpdatingWfh] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file must be under 2MB");
      return;
    }

    setPhotoUploading(true);
    const formData = new FormData();
    formData.append("employee_id", String(employee.id));
    formData.append("pose_type", "front");
    formData.append("file", file);

    try {
      const token = getAccessToken();
      const res = await fetch(`${getBackendUrl()}/enrollment/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload photo");
      }
      
      toast.success("Profile photo updated successfully!");
      setPhotoTimestamp(Date.now());
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error uploading profile photo. Make sure a clear face is visible.");
    } finally {
      setPhotoUploading(false);
    }
  };

  // Queries
  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => fetchApi(`/employees/${employeeId}`)
  });

  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["employee-attendance", employeeId],
    queryFn: () => fetchApi(`/attendance/employee/${employeeId}`),
    enabled: !!employeeId
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchApi("/settings/")
  });

  const { data: enrollmentStatus } = useQuery({
    queryKey: ["enroll-status", employeeId],
    queryFn: () => fetchApi(`/enrollment/status/${employeeId}`),
    enabled: !!employeeId
  });

  // Settings parsing map
  const settingsMap = useMemo(() => {
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

  const themeStyles = themeStylesMap[badgeTheme as keyof typeof themeStylesMap] || themeStylesMap["Navy Blue"];

  // Save Settings Mutation
  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      fetchApi(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("ID Card configuration updated!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update configuration.");
    }
  });

  const toggleWfhMutation = useMutation({
    mutationFn: (allow_wfh: boolean) =>
      fetchApi(`/employees/${employeeId}`, {
        method: "PUT",
        body: JSON.stringify({ allow_wfh })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      toast.success(data.allow_wfh ? "WFH permission granted!" : "WFH permission revoked.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update WFH permission.");
    },
    onSettled: () => {
      setUpdatingWfh(false);
    }
  });

  const handleToggleWfh = () => {
    setUpdatingWfh(true);
    toggleWfhMutation.mutate(!employee.allow_wfh);
  };

  const [wfhAddress, setWfhAddress] = useState("");
  const [wfhLat, setWfhLat] = useState<number | null>(null);
  const [wfhLng, setWfhLng] = useState<number | null>(null);
  const [wfhGeocoding, setWfhGeocoding] = useState(false);

  useEffect(() => {
    if (employee) {
      setWfhAddress(employee.wfh_address || "");
      setWfhLat(employee.wfh_lat || null);
      setWfhLng(employee.wfh_lng || null);
    }
  }, [employee?.wfh_address, employee?.wfh_lat, employee?.wfh_lng]);

  const updateWfhDetailsMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/employees/${employeeId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
    }
  });

  const handleSetCurrentWfhLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setWfhGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          if (res.ok) {
            const data = await res.json();
            const address = data.display_name;
            setWfhAddress(address);
            setWfhLat(lat);
            setWfhLng(lon);
            
            updateWfhDetailsMutation.mutate({
              wfh_address: address,
              wfh_lat: lat,
              wfh_lng: lon
            });
            toast.success("WFH Location locked to your current GPS coordinates!");
          } else {
             toast.error("Failed to get address for current location.");
          }
        } catch (err) {
           console.error("Reverse geocoding error:", err);
           toast.error("Failed to fetch address from coordinates.");
        } finally {
          setWfhGeocoding(false);
        }
      },
      (err) => {
        console.error("GPS error:", err);
        toast.error("Failed to get current location. Ensure GPS permission is granted.");
        setWfhGeocoding(false);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!employee?.allow_wfh || !wfhAddress || wfhAddress.trim().length < 5) {
      return;
    }
    if (wfhAddress === employee.wfh_address) return;
    
    const delay = setTimeout(async () => {
      setWfhGeocoding(true);
      try {
        const url = `${getBackendUrl().replace('/api/v1', '')}/api/v1/kiosk/geocode?address=${encodeURIComponent(wfhAddress)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.lat !== null && data.lng !== null) {
            setWfhLat(data.lat);
            setWfhLng(data.lng);
            updateWfhDetailsMutation.mutate({
              wfh_address: wfhAddress,
              wfh_lat: data.lat,
              wfh_lng: data.lng
            });
            toast.success("WFH Location auto-detected and locked!");
          }
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setWfhGeocoding(false);
      }
    }, 800);
    
    return () => clearTimeout(delay);
  }, [wfhAddress, employee?.allow_wfh, employee?.wfh_address]);

  // Departments query for dropdown list
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchApi("/departments/")
  });

  // Edit employee details states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [editDeptId, setEditDeptId] = useState("");

  const handleOpenEditDialog = () => {
    if (!employee) return;
    setEditName(employee.name || "");
    setEditEmail(employee.email || "");
    setEditPhone(employee.phone || "");
    setEditDesignation(employee.designation || "");
    setEditJoiningDate(employee.joining_date || "");
    setEditStatus(employee.status || "Active");
    setEditDeptId(employee.department_id ? employee.department_id.toString() : "");
    setShowEditDialog(true);
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/employees/${employeeId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      toast.success("Employee profile updated successfully!");
      setShowEditDialog(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update employee details.");
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: editName,
      email: editEmail,
      phone: editPhone || null,
      designation: editDesignation || null,
      joining_date: editJoiningDate,
      status: editStatus,
      department_id: editDeptId ? parseInt(editDeptId) : null
    };
    updateEmployeeMutation.mutate(payload);
  };

  const handleSettingChange = (key: string, value: string) => {
    saveSettingMutation.mutate({ key, value });
  };

  // SVG Badge Watermark helper component
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

  // High-Res Canvas Badge Generator
  const handleDownloadBadge = async () => {
    if (!employee) return;
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 600;
      canvas.height = 900;

      // 1. Background round rect
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
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 4;
      ctx.stroke();

      // 2. Draw watermark patterns on Canvas
      const cx = 300;
      const cy = 450;
      if (badgePattern === "Indian Mandala") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 252, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 210, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 168, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 126, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 84, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.stroke();
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

      // 3. Draw gradient header
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

      // Lanyard punch hole
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

      // Image loader
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load: " + src));
          img.src = src;
        });
      };

      const baseUrl = getBackendUrl().replace("/api/v1", "");
      const photoSrc = `${baseUrl}/uploads/${employee.employee_id}/front.jpg?t=${photoTimestamp}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${employee.employee_id}`;

      let logoImg: HTMLImageElement | null = null;
      if (companyLogo) {
        try {
          logoImg = await loadImage(companyLogo);
        } catch {}
      }

      let photoImg: HTMLImageElement | null = null;
      try {
        photoImg = await loadImage(photoSrc);
      } catch {}

      let qrImg: HTMLImageElement | null = null;
      try {
        qrImg = await loadImage(qrSrc);
      } catch {}

      // Logo rendering
      if (logoImg) {
        const logoAspectRatio = logoImg.width / logoImg.height;
        const logoHeight = 45;
        const logoWidth = logoHeight * logoAspectRatio;
        ctx.drawImage(logoImg, 50, 75, logoWidth, logoHeight);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(companyName, 65 + logoWidth, 106);
      } else {
        ctx.fillStyle = themeStyles.primaryHex;
        ctx.font = "black 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("NETRAID", 300, 100);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(companyName.toUpperCase(), 300, 130);
      }

      // Profile avatar container
      const photoX = 200;
      const photoY = 220;
      const photoSize = 200;

      ctx.strokeStyle = themeStyles.primaryHex;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      if (photoImg) {
        ctx.drawImage(photoImg, photoX, photoY, photoSize, photoSize);
      } else {
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 80px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", photoX + photoSize / 2, photoY + photoSize / 2);
      }
      ctx.restore();

      // Holographic official seal
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
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(sealX + 13, sealY + 22);
      ctx.lineTo(sealX + 20, sealY + 29);
      ctx.lineTo(sealX + 32, sealY + 16);
      ctx.stroke();
      ctx.restore();

      // Text details
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(employee.name.toUpperCase(), 300, 480);

      ctx.fillStyle = themeStyles.primaryHex;
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(employee.designation?.toUpperCase() || "STAFF MEMBER", 300, 515);

      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(100, 545); ctx.lineTo(500, 545); ctx.stroke();

      // Metadata labels
      ctx.textAlign = "left";
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("EMPLOYEE ID", 100, 580);
      ctx.fillText("DEPARTMENT", 320, 580);
      ctx.fillText("DATE OF JOIN", 100, 640);
      ctx.fillText("STATUS", 320, 640);

      // Metadata values
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(employee.employee_id, 100, 605);
      ctx.fillText(employee.department?.name?.toUpperCase() || "GENERAL", 320, 605);
      
      const joinDate = employee.joining_date ? new Date(employee.joining_date).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric"
      }) : "N/A";
      ctx.fillText(joinDate.toUpperCase(), 100, 665);
      ctx.fillStyle = themeStyles.primaryHex;
      ctx.fillText("VERIFIED", 320, 665);

      // QR Code
      const qrSize = 130;
      const qrX = 235;
      const qrY = 710;

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
        ctx.strokeStyle = "#cbd5e1";
        ctx.strokeRect(qrX, qrY, qrSize, qrSize);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("QR CODE", qrX + qrSize / 2, qrY + qrSize / 2);
      }

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SCAN AS BACKUP IF KIOSK FACE RECOGNITION FAILS", 300, 875);

      // Trigger download
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `ID_Card_${employee.employee_id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Badge PNG downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate download: " + err.message);
    }
  };

  if (loadingEmployee || loadingAttendance) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-64 w-full max-w-4xl" />
        </div>
      </SidebarLayout>
    );
  }

  if (!employee) {
    return (
      <SidebarLayout>
        <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Personnel Record Not Found</h2>
          <p className="text-xs text-slate-500 leading-normal">The requested employee registration could not be located in the central secure database.</p>
          <button onClick={() => router.push("/employees")} className="btn-primary text-xs uppercase py-2.5 px-5 rounded-xl">Back to Employees</button>
        </div>
      </SidebarLayout>
    );
  }

  // Attendance stats counts
  const totalDays = attendance?.length || 0;
  const presentDays = attendance?.filter((r: any) => r.status === "Present").length || 0;
  const lateDays = attendance?.filter((r: any) => r.status === "Late").length || 0;
  const halfDays = attendance?.filter((r: any) => r.status === "Half Day").length || 0;
  const attendanceScore = totalDays > 0 ? Math.round(((presentDays + lateDays + halfDays * 0.5) / totalDays) * 100) : 0;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-7xl page-enter relative text-slate-800 print-reset-container">
        
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-250/60 no-print">
          <div className="space-y-1.5">
            <button
              onClick={() => router.push("/employees")}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-[11px] font-semibold uppercase tracking-wider"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Employees
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Employee Profile</h1>
              <span className={`badge ${employee.status === "Active" ? "badge-emerald" : "badge-slate"} flex items-center gap-1`}>
                {employee.status === "Active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {employee.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenEditDialog}
              className="flex items-center gap-2 text-[11.5px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              Edit Details
            </button>
            <button
              onClick={() => router.push(`/enroll/${employee.id}`)}
              className="flex items-center gap-2 text-[11.5px] font-bold text-blue-600 hover:text-white bg-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              Biometric Enrollment
            </button>
          </div>
        </div>

        {/* ─── Profile Content Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print-reset-container">
          
          {/* LEFT AREA: Employee Details & Ledger Table (lg:col-span-8) */}
          <div className="lg:col-span-7 space-y-6 no-print">
            
            {/* Profile Hero Card */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs relative">
              {/* Cover Gradient Banner */}
              <div className={`h-24 ${themeStyles.headerBg} relative`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_80%)]" />
              </div>
              
              {/* Avatar & Key details */}
              <div className="px-6 pb-6 relative">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-4">
                  {/* Profile photo */}
                  <label className={`relative w-20 h-20 rounded-2xl p-0.5 bg-gradient-to-tr ${themeStyles.photoBorder} shadow-md shrink-0 cursor-pointer group`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={photoUploading}
                    />
                    <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white bg-slate-100 relative">
                      <img
                        src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${employee.employee_id}/front.jpg?t=${photoTimestamp}`}
                        alt={employee.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                        }}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Camera className="w-4 h-4 text-white" />
                        <span className="text-[7px] font-bold mt-0.5 uppercase tracking-wider text-white">Edit Photo</span>
                      </div>

                      {/* Loading Spinner */}
                      {photoUploading && (
                        <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-white">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </label>

                  <div className="space-y-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none truncate">{employee.name}</h2>
                    <p className="text-xs font-semibold text-slate-550 font-mono flex items-center gap-1.5">
                      <span className="bg-slate-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5 dark:text-slate-350">{employee.employee_id}</span>
                      <span>·</span>
                      <span className="text-slate-700 dark:text-slate-300">{employee.designation || "Staff Member"}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-450 font-bold uppercase tracking-wider">
                      {employee.department?.name || "General Department"}
                    </p>
                  </div>
                </div>

                {/* Data fields grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11.5px] border-t border-slate-100 dark:border-white/5 pt-4">
                  <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300" title={employee.email}>{employee.email}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{employee.phone || "No mobile registered"}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-150 dark:border-white/5">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Joined: <span className="font-mono">{employee.joining_date}</span></span>
                  </div>
                </div>

                {/* WFH Permission Toggle */}
                <div className="flex flex-col border-t border-slate-100 dark:border-white/5 pt-4 mt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider text-[9.5px]">Work From Home (WFH) Permission</span>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold leading-none">Bypasses geofencing restrictions for this employee</p>
                    </div>
                    <button
                      type="button"
                      disabled={updatingWfh}
                      onClick={handleToggleWfh}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        employee.allow_wfh ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                      } ${updatingWfh ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                          employee.allow_wfh ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Animated WFH Address Input */}
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      employee.allow_wfh ? "max-h-[300px] opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
                    }`}
                  >
                    <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
                            Home Address (For WFH GPS Lock) <span className="text-blue-400">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleSetCurrentWfhLocation}
                            disabled={wfhGeocoding}
                            className="flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 hover:border-slate-400 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                          >
                            <MapPin className="w-3 h-3" />
                            Set to Current GPS Location
                          </button>
                        </div>
                        <textarea 
                          rows={2}
                          placeholder="e.g., 123 Main St, Springfield. Be specific for accurate GPS geocoding." 
                          value={wfhAddress}
                          onChange={(e) => setWfhAddress(e.target.value)} 
                          className="w-full text-[11.5px] bg-white border-slate-200 focus:border-indigo-400 text-slate-900 rounded-lg p-2.5 outline-none transition-all resize-none shadow-sm"
                        />
                      </div>
                      
                      <div className="text-[10px] flex items-center justify-between border-t border-indigo-500/10 pt-2">
                        {wfhGeocoding ? (
                          <span className="text-indigo-400 animate-pulse font-medium">Autodetecting coordinates...</span>
                        ) : wfhLat && wfhLng ? (
                          <span className="text-emerald-600 font-mono font-bold flex items-center gap-1.5 uppercase tracking-wider">
                            <MapPin className="w-3 h-3" />
                            GPS Locked: {wfhLat.toFixed(5)}, {wfhLng.toFixed(5)}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Enter full address to lock GPS</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attendance Rate Progress Block */}
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[9.5px]">Attendance Score</span>
                    <span className={`font-black ${themeStyles.accentText} font-mono`}>
                      {attendanceScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full bg-gradient-to-r ${themeStyles.photoBorder}`}
                      style={{ width: `${attendanceScore}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-450 mt-1 font-semibold">
                    {totalDays === 0
                      ? "No attendance records registered yet."
                      : attendanceScore >= 90
                      ? "Exemplary consistency - Security clearance status is active."
                      : attendanceScore >= 75
                      ? "Standard compliance - Maintained within acceptable limits."
                      : "Requires review - Attendance score falls below benchmark."}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between h-[75px] shadow-xs hover:border-slate-350 transition-all duration-200 border-l-4 border-l-slate-400">
                <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">Logged Days</span>
                <span className="text-xl font-bold text-slate-900 leading-none mt-1.5 font-mono">{totalDays}</span>
              </div>
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between h-[75px] shadow-xs hover:border-slate-350 transition-all duration-200 border-l-4 border-l-emerald-500">
                <span className="text-[9.5px] text-emerald-600 font-bold uppercase tracking-wider">Present</span>
                <span className="text-xl font-bold text-emerald-600 leading-none mt-1.5 font-mono">{presentDays}</span>
              </div>
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between h-[75px] shadow-xs hover:border-slate-350 transition-all duration-200 border-l-4 border-l-amber-500">
                <span className="text-[9.5px] text-amber-600 font-bold uppercase tracking-wider">Late Arrivals</span>
                <span className="text-xl font-bold text-amber-600 leading-none mt-1.5 font-mono">{lateDays}</span>
              </div>
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between h-[75px] shadow-xs hover:border-slate-350 transition-all duration-200 border-l-4 border-l-indigo-650">
                <span className="text-[9.5px] text-indigo-650 font-bold uppercase tracking-wider">Half Days</span>
                <span className="text-xl font-bold text-indigo-650 leading-none mt-1.5 font-mono">{halfDays}</span>
              </div>
            </div>

            {/* Attendance History Ledger */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Attendance Ledger (Past 30 Days)</h3>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-[11.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-mono">
                      <th className="py-2.5 px-4 font-semibold">Date</th>
                      <th className="py-2.5 px-4 font-semibold">Check In</th>
                      <th className="py-2.5 px-4 font-semibold">Check Out</th>
                      <th className="py-2.5 px-4 font-semibold">Hours Worked</th>
                      <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {!attendance || attendance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 italic">No attendance records stored for this user.</td>
                      </tr>
                    ) : (
                      attendance.map((rec: any) => (
                        <tr key={rec.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-slate-550">{rec.date}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-800">
                            {rec.check_in ? parseDateTime(rec.check_in)?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-800">
                            {rec.check_out ? parseDateTime(rec.check_out)?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—"}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-650">
                            {rec.working_hours ? `${rec.working_hours.toFixed(1)} hrs` : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`inline-block text-[8.5px] font-semibold px-2 py-0.5 rounded-full border ${
                              rec.status === "Present" ? "bg-emerald-50 border-emerald-250 text-emerald-700" :
                              rec.status === "Late" ? "bg-amber-50 border-amber-250 text-amber-700" :
                              rec.status === "Half Day" ? "bg-indigo-50 border-indigo-250 text-indigo-750" :
                              "bg-rose-50 border-rose-250 text-rose-700"
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance Heatmap Grid */}
            <AttendanceHeatmap employeeId={employee.id} />
          </div>

          {/* RIGHT AREA: Badge Live Preview & Customizer (lg:col-span-4) */}
          <div className="lg:col-span-5 space-y-6 print-reset-container">
            
            {/* ID Badge Live Preview Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center print-reset-container">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono no-print">
                Badge Live Preview
              </div>

              {/* Printable Badge Container */}
              <div 
                id="printable-id-card-wrap"
                className="w-[280px] h-[438px] bg-white rounded-[24px] border border-slate-200 shadow-md overflow-hidden relative flex flex-col select-none font-sans"
              >
                {/* Watermark Pattern */}
                <BadgeWatermark type={badgePattern} />
                
                {/* Lanyard punch hole detail */}
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-10 h-3 bg-slate-100 rounded-full border border-slate-200/50 flex items-center justify-center pointer-events-none no-print">
                  <div className="w-6 h-1 bg-slate-300 rounded-full" />
                </div>

                {/* Header: Company Name & Logo */}
                <div className={`h-[90px] ${themeStyles.headerBg} relative flex flex-col justify-end px-4.5 pb-2.5 shrink-0`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_70%)] pointer-events-none" />
                  
                  <div className="flex items-center gap-2.5 mt-2 relative z-10">
                    {companyLogo ? (
                      <img 
                        src={companyLogo} 
                        alt="Logo" 
                        className="h-7 max-w-[80px] object-contain shrink-0" 
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white text-[9px] font-black tracking-tighter shadow-sm font-mono shrink-0 border border-white/10">
                        NID
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10.5px] font-black tracking-wider text-white uppercase truncate">
                        {companyName}
                      </span>
                      <span className="text-[7px] font-bold text-white/80 tracking-widest uppercase">
                        SECURED IDENTITY CARD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 flex flex-col items-center pt-5 px-5 relative bg-transparent z-10">
                  {/* Photo container */}
                  <div className={`relative w-[100px] h-[100px] rounded-full p-1 bg-gradient-to-tr ${themeStyles.photoBorder} shadow-sm shrink-0`}>
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-slate-100">
                      <img
                        src={`${getBackendUrl().replace("/api/v1", "")}/uploads/${employee.employee_id}/front.jpg?t=${photoTimestamp}`}
                        alt={employee.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Official checkmark seal */}
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-tr from-amber-400 via-orange-400 to-yellow-300 text-amber-950 font-bold border border-white rounded-full w-5 h-5 flex items-center justify-center shadow-md z-10 pointer-events-none">
                      <svg className="w-3 h-3 stroke-amber-950" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>

                  {/* Name and title details */}
                  <div className="text-center mt-3 space-y-0.5">
                    <h3 className="text-[13.5px] font-extrabold text-slate-900 tracking-tight uppercase leading-tight">
                      {employee.name}
                    </h3>
                    <p className={`text-[9.5px] font-bold ${themeStyles.accentText} tracking-widest uppercase`}>
                      {employee.designation || "Staff Member"}
                    </p>
                  </div>

                  {/* Info table */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 w-full border-t border-slate-100 mt-4 pt-3 bg-transparent">
                    <div>
                      <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                        Employee ID
                      </span>
                      <span className="text-[9px] font-extrabold text-slate-800 tracking-tight block">
                        {employee.employee_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                        Department
                      </span>
                      <span className="text-[9px] font-extrabold text-slate-800 tracking-tight block truncate uppercase">
                        {employee.department?.name || "General"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                        Date of Join
                      </span>
                      <span className="text-[9px] font-extrabold text-slate-800 tracking-tight block">
                        {employee.joining_date}
                      </span>
                    </div>
                    <div>
                      <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                        Security Status
                      </span>
                      <span className={`text-[9px] font-bold ${themeStyles.accentText} tracking-tight flex items-center gap-1`}>
                        <span className={`w-1.2 h-1.2 rounded-full ${themeStyles.dotColor}`} />
                        VERIFIED
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer QR fallback */}
                <div className="bg-slate-50/80 border-t border-slate-100 h-[100px] flex items-center justify-between px-5 pb-2 shrink-0 z-10">
                  <div className="flex flex-col min-w-0 pr-1.5">
                    <span className="text-[7.5px] font-black text-slate-900 tracking-wider uppercase font-mono">
                      SCAN TO VERIFY
                    </span>
                    <p className="text-[6.5px] text-slate-450 font-medium leading-snug mt-0.5 max-w-[115px] font-mono">
                      Scan this backup barcode QR badge if Kiosk face matching fails.
                    </p>
                  </div>
                  <div className="w-[64px] h-[64px] bg-white rounded-lg border border-slate-200/80 p-1 flex items-center justify-center shadow-2xs shrink-0">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${employee.employee_id}`}
                      alt="QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Actions print/download */}
              <div className="flex gap-3.5 w-full max-w-[280px] pt-5 no-print">
                <button
                  onClick={() => window.print()}
                  className={`flex-1 h-10 ${themeStyles.headerBg} hover:opacity-90 text-white font-extrabold text-[11px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98] border border-white/10 cursor-pointer`}
                >
                  <Printer className="w-3.5 h-3.5 text-white/90" />
                  Print ID
                </button>
                <button
                  onClick={handleDownloadBadge}
                  className="flex-1 h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-[11px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-650" />
                  Download
                </button>
              </div>
            </div>

            {/* ID Badge Design Editor Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4.5 no-print">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">ID Badge Customizer</h3>

              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleSettingChange("COMPANY_NAME", e.target.value)}
                  placeholder="Enter organization name"
                  className="input-field h-9 text-[12.5px] bg-white border-slate-200 rounded-xl px-3 focus:border-slate-800 transition-all font-semibold"
                />
              </div>

              {/* Company Logo Upload */}
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Branding Logo</label>
                {companyLogo ? (
                  <div className="relative w-full h-20 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2 group">
                    <img src={companyLogo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => handleSettingChange("COMPANY_LOGO", "")}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Logo
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-20 border border-dashed border-slate-350 hover:border-slate-450 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-all">
                    <Upload className="w-4 h-4 text-slate-450" />
                    <span className="text-[10px] text-slate-500 font-semibold">Upload Logo (Max 500KB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={logoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 512 * 1025) {
                          toast.error("Logo must be under 500KB");
                          return;
                        }
                        setLogoUploading(true);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          handleSettingChange("COMPANY_LOGO", reader.result as string);
                          setLogoUploading(false);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Theme Color Swatches */}
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Badge Color Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(themeStylesMap).map((themeName) => {
                    const styles = themeStylesMap[themeName as keyof typeof themeStylesMap];
                    const isActive = badgeTheme === themeName;
                    return (
                      <button
                        key={themeName}
                        type="button"
                        onClick={() => handleSettingChange("BADGE_THEME_COLOR", themeName)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-55 hover:border-slate-300"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full shrink-0 ${styles.headerBg}`} />
                        {themeName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Pattern Type Choices */}
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Badge Background Pattern</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "None", label: "None" },
                    { key: "Indian Mandala", label: "Mandala" },
                    { key: "Corporate Waves", label: "Waves" },
                    { key: "Cyber Grid", label: "Grid" }
                  ].map((pattern) => {
                    const isActive = badgePattern === pattern.key;
                    return (
                      <button
                        key={pattern.key}
                        type="button"
                        onClick={() => handleSettingChange("BADGE_PATTERN_TYPE", pattern.key)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer h-12 ${
                          isActive
                            ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-55 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-[10px] font-bold tracking-wide">{pattern.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-650 text-[10px]">
                <Clock className="w-3.5 h-3.5 text-slate-450 shrink-0 mt-0.5" />
                <span>
                  Adjusting these configurations updates the organization-wide card design template automatically.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Print Styling Injected locally for single page clean print */}
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
              width: 280px !important;
              height: 438px !important;
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
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        ` }} />

        {/* ─── Edit Employee Modal ─── */}
        {showEditDialog && (
          <div className="modal-backdrop">
            <div className="modal-content max-w-lg">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider text-slate-800 dark:text-slate-100">Edit Profile Details</h3>
                </div>
                <button 
                  onClick={() => setShowEditDialog(false)} 
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-750 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 text-slate-800">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                    <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <input type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                    <input type="text" placeholder="+91 98765 43210" value={editPhone || ""} onChange={(e) => setEditPhone(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                    <input type="text" value={editDesignation} onChange={(e) => setEditDesignation(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                    <div className="relative">
                      <select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3 appearance-none cursor-pointer pr-8">
                        <option value="">Select Department</option>
                        {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joining Date</label>
                    <input type="date" value={editJoiningDate} onChange={(e) => setEditJoiningDate(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="input-field h-9.5 text-[12.5px] bg-white border-slate-200 focus:border-slate-800 text-slate-900 rounded-xl w-full px-3 appearance-none cursor-pointer">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setShowEditDialog(false)} 
                    className="btn-ghost text-[11.5px] h-9 px-4 rounded-xl cursor-pointer hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={updateEmployeeMutation.isPending}
                    className="btn-primary text-[11.5px] h-9 px-4 flex items-center gap-1.5 rounded-xl cursor-pointer"
                  >
                    {updateEmployeeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
