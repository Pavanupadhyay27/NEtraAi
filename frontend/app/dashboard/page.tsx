"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getAccessToken, getBackendUrl, parseDateTime, getLocalDateString } from "@/app/utils/api";
import { 
  Users, UserCheck, UserMinus, Clock, TrendingUp, Activity,
  ArrowRight, AlertTriangle, CheckCircle, Zap, ShieldAlert,
  Calendar, Award, Server, Cpu, X
} from "lucide-react";
import Link from "next/link";

// Pure SVG sparkline helper for premium look
function Sparkline({ color, data }: { color: string; data: number[] }) {
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

  const colors = {
    blue: "#3b82f6",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    indigo: "#6366f1",
  };
  const strokeColor = colors[color as keyof typeof colors] || "#3b82f6";

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80 shrink-0">
      <defs>
        <linearGradient id={`spark-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 0,${height} L ${points} L ${width},${height} Z`}
        fill={`url(#spark-grad-${color})`}
      />
      <polyline
        fill="none"
        stroke={strokeColor}
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
  const colors = {
    blue:    { icon: "text-zinc-600",    bg: "bg-zinc-100",   border: "border-zinc-200 hover:border-zinc-400",   val: "text-zinc-900" },
    emerald: { icon: "text-zinc-800", bg: "bg-zinc-100", border: "border-zinc-200 hover:border-zinc-400", val: "text-zinc-900" },
    amber:   { icon: "text-zinc-650",   bg: "bg-zinc-100",  border: "border-zinc-200 hover:border-zinc-400",  val: "text-zinc-900" },
    rose:    { icon: "text-zinc-700",    bg: "bg-zinc-100",   border: "border-zinc-200 hover:border-zinc-400",   val: "text-zinc-900" },
    indigo:  { icon: "text-zinc-900",  bg: "bg-zinc-100", border: "border-zinc-200 hover:border-zinc-400", val: "text-zinc-900" },
  };
  const c = colors[color];

  return (
    <div className={`glass-card rounded-2xl p-5 border ${c.border} stat-card flex flex-col justify-between h-[145px] hover:scale-[1.01] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
        <div className={`w-8.5 h-8.5 rounded-xl ${c.bg} ${c.icon} flex items-center justify-center border border-white/5`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      
      <div className="flex items-end justify-between mt-auto">
        <div className="space-y-1">
          {loading ? (
            <div className="skeleton h-8 w-20" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{value}</p>
          )}
          {sublabel && <p className="text-[10px] text-slate-500 font-mono">{sublabel}</p>}
        </div>
        {!loading && <Sparkline color={color} data={sparkData} />}
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/15",
  "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/15",
  "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/15",
  "from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/15",
  "from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/15",
];

function ScanLogItem({ log }: { log: any }) {
  const isSuccess = log.status === "Match Success";
  const isSpoof = log.is_spoof;
  const isUnknown = log.status === "Unknown Person";

  let dotColor = "bg-slate-600";
  let statusColor = "text-slate-500";
  let statusBg = "bg-slate-500/8 border-slate-500/15";
  let statusLabel = log.status;

  if (isSuccess) { 
    dotColor = "bg-emerald-400"; 
    statusColor = "text-emerald-400"; 
    statusBg = "bg-emerald-500/8 border-emerald-500/15"; 
    statusLabel = "Matched"; 
  } else if (isSpoof) { 
    dotColor = "bg-rose-500 animate-ping"; 
    statusColor = "text-rose-400"; 
    statusBg = "bg-rose-500/8 border-rose-500/20"; 
    statusLabel = "Spoof Blocked"; 
  } else if (isUnknown) { 
    dotColor = "bg-amber-400"; 
    statusColor = "text-amber-400"; 
    statusBg = "bg-amber-500/8 border-amber-500/20"; 
    statusLabel = "Unknown"; 
  }

  // Generate a nice random avatar gradient color based on employee ID
  const colorIndex = log.employee ? (log.employee.id % AVATAR_COLORS.length) : 0;
  const avatarCls = AVATAR_COLORS[colorIndex];

  return (
    <div className="flex items-center gap-3.5 py-3 px-3.5 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition-all duration-200 group">
      <div className="relative shrink-0">
        {log.employee ? (
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarCls} flex items-center justify-center font-bold text-xs border`}>
            {log.employee.name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center font-bold text-xs border border-white/5">
            ?
          </div>
        )}
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#050810] flex items-center justify-center`}>
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor.split(" ")[0]}`} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
            {log.employee ? log.employee.name : "Unknown Person"}
          </p>
          <span className="text-[9px] text-zinc-500 font-mono">· {log.camera}</span>
        </div>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">
          {log.employee ? `${log.employee.designation} (${log.employee.employee_id})` : "Unauthorized access attempt"}
        </p>
      </div>

      <div className="shrink-0 text-right space-y-1">
        <p className="text-[10px] text-slate-500 font-mono leading-none">
          {parseDateTime(log.timestamp)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || ""}
        </p>
        <span className={`inline-block text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${statusBg} ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

const getDeptTheme = (code: string) => {
  const themes = {
    ENG: { 
      bg: "bg-blue-50/50 hover:bg-blue-50/70 border-blue-200 text-blue-900", 
      iconBg: "bg-blue-500/10 text-blue-600 border-blue-500/20", 
      barBg: "bg-blue-100", 
      barFill: "bg-gradient-to-r from-blue-500 to-blue-600"
    },
    HR: { 
      bg: "bg-purple-50/50 hover:bg-purple-50/70 border-purple-200 text-purple-900", 
      iconBg: "bg-purple-500/10 text-purple-600 border-purple-500/20", 
      barBg: "bg-purple-100", 
      barFill: "bg-gradient-to-r from-purple-500 to-purple-600"
    },
    MKT: { 
      bg: "bg-amber-50/50 hover:bg-amber-50/70 border-amber-200 text-amber-900", 
      iconBg: "bg-amber-500/10 text-amber-600 border-amber-500/20", 
      barBg: "bg-amber-100", 
      barFill: "bg-gradient-to-r from-amber-500 to-amber-600"
    },
    FIN: { 
      bg: "bg-emerald-50/50 hover:bg-emerald-50/70 border-emerald-200 text-emerald-900", 
      iconBg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", 
      barBg: "bg-emerald-100", 
      barFill: "bg-gradient-to-r from-emerald-500 to-emerald-600"
    },
    OPS: { 
      bg: "bg-rose-50/50 hover:bg-rose-50/70 border-rose-200 text-rose-900", 
      iconBg: "bg-rose-500/10 text-rose-600 border-rose-500/20", 
      barBg: "bg-rose-100", 
      barFill: "bg-gradient-to-r from-rose-500 to-rose-600"
    },
  };
  return themes[code as keyof typeof themes] || { 
    bg: "bg-slate-50/50 hover:bg-slate-50/70 border-slate-200 text-slate-900", 
    iconBg: "bg-slate-500/10 text-slate-600 border-slate-500/20", 
    barBg: "bg-slate-100", 
    barFill: "bg-gradient-to-r from-slate-500 to-slate-600"
  };
};

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = React.useState("");
  const [currentDate, setCurrentDate] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "MATCHED" | "UNKNOWN" | "SPOOF">("ALL");
  const [selectedDept, setSelectedDept] = React.useState<any | null>(null);
  const queryClient = useQueryClient();

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
      } catch (err) {
        console.error("Error handling SSE message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
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
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "rgba(24,24,27,0.08)",
        borderWidth: 1,
        shadowColor: "rgba(0,0,0,0.02)",
        shadowBlur: 10,
        textStyle: { color: "#18181b", fontSize: 11, fontFamily: "var(--font-inter)" },
        extraCssText: "border-radius:12px;padding:8px 12px;box-shadow: 0 4px 16px rgba(0,0,0,0.04);"
      },
      legend: {
        data: ["Present", "Late Arrivals"],
        textStyle: { color: "#71717a", fontSize: 10, fontFamily: "var(--font-inter)" },
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
        axisLine: { lineStyle: { color: "rgba(24,24,27,0.06)" } },
        axisTick: { show: false },
        axisLabel: { color: "#71717a", fontSize: 10, fontFamily: "var(--font-inter)" }
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(24,24,27,0.04)", type: "dashed" } },
        axisLabel: { color: "#71717a", fontSize: 10, fontFamily: "var(--font-inter)" },
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
            color: "#18181b", 
            width: 2.25,
            shadowColor: "rgba(24,24,27,0.1)",
            shadowBlur: 8,
            shadowOffsetY: 4
          },
          itemStyle: { color: "#18181b" },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(24,24,27,0.06)" },
                { offset: 1, color: "rgba(24,24,27,0)" }
              ]
            }
          }
        },
        {
          name: "Late Arrivals",
          type: "bar",
          data: trends.map((t: any) => t.late),
          itemStyle: { 
            color: "#71717a", 
            borderRadius: [3, 3, 0, 0] 
          },
          barWidth: 6,
          barMaxWidth: 10
        }
      ]
    };
  };

  const deptOption = () => {
    if (!deptStats) return {};
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#ffffff",
        borderColor: "rgba(24,24,27,0.08)",
        borderWidth: 1,
        textStyle: { color: "#18181b", fontSize: 11 },
        extraCssText: "border-radius:12px;padding:8px 12px;box-shadow: 0 4px 16px rgba(0,0,0,0.04);"
      },
      grid: { top: 10, left: 90, right: 20, bottom: 20 },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(24,24,27,0.04)", type: "dashed" } },
        axisLabel: { color: "#71717a", fontSize: 9 },
        axisLine: { show: false }
      },
      yAxis: {
        type: "category",
        data: deptStats.map((d: any) => d.name || d.code),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#18181b", fontSize: 10, fontFamily: "var(--font-inter)" }
      },
      series: [
        {
          name: "Total Employees",
          type: "bar",
          data: deptStats.map((d: any) => d.total_employees),
          itemStyle: { color: "rgba(24,24,27,0.04)", borderRadius: [0, 4, 4, 0] },
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
                { offset: 0, color: "#18181b" },
                { offset: 1, color: "#27272a" }
              ]
            }
          }
        }
      ]
    };
  };

  return (
    <SidebarLayout>
      <div className="space-y-7 page-enter">
        {/* ─── Header ─── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-zinc-200 gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live biometric monitoring and attendance intelligence platform
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {/* Real-time Clock widget */}
            {currentTime && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-[11px] text-zinc-700 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>{currentDate}</span>
                <span className="text-zinc-300 font-sans mx-0.5">|</span>
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="tabular-nums font-semibold">{currentTime}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono uppercase tracking-wider">Live Feed Active</span>
            </div>
          </div>
        </div>

        {/* ─── KPI Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Staff" value={loadingSummary ? "—" : summary?.total_employees} icon={Users} color="blue" loading={loadingSummary} sublabel="Registered" sparkData={staffSpark} />
          <StatCard label="Present Today" value={loadingSummary ? "—" : summary?.present_today} icon={UserCheck} color="emerald" loading={loadingSummary} sublabel="Clocked in" sparkData={presentSpark} />
          <StatCard label="Late Arrivals" value={loadingSummary ? "—" : summary?.late_today} icon={Clock} color="amber" loading={loadingSummary} sublabel="Grace exceeded" sparkData={lateSpark} />
          <StatCard label="Absent Today" value={loadingSummary ? "—" : summary?.absent_today} icon={UserMinus} color="rose" loading={loadingSummary} sublabel="Unexcused" sparkData={absentSpark} />
          <StatCard label="Attendance Rate" value={loadingSummary ? "—" : `${summary?.attendance_percentage}%`} icon={TrendingUp} color="indigo" loading={loadingSummary} sublabel="Rate today" sparkData={rateSpark} />
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Trend Chart */}
          <div className="lg:col-span-3 glass-card rounded-2xl p-5 border border-white/6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-white/5">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Attendance Trends</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">Biometric logs for the past 7 days</p>
                </div>
              </div>
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
          <div className="lg:col-span-2 glass-card rounded-2xl border border-white/6 flex flex-col">
            <div className="p-5 pb-3.5 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-white/5">
                    <Activity className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Live Activity Feed</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Real-time scan logs ticker</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/15">
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[9px] text-indigo-400 font-mono tracking-wider">STREAMING</span>
                </div>
              </div>
              
              {/* Status Filter pills */}
              <div className="flex flex-wrap gap-1.5 mt-3.5">
                {(["ALL", "MATCHED", "UNKNOWN", "SPOOF"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wide transition-all border cursor-pointer uppercase font-mono ${
                      statusFilter === filter
                        ? "bg-zinc-800 border-zinc-700 text-white"
                        : "bg-transparent border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                    }`}
                  >
                    {filter === "SPOOF" ? "Spoofs" : filter.toLowerCase()}
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

            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
              <Link
                href="/attendance"
                className="flex items-center justify-between text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors group"
              >
                <span>Access Complete Ledger Logs</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Bottom Section: Department Breakdown ─── */}
        <div className="glass-card rounded-2xl p-5 border border-white/6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-white/5">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Department Distribution</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">Staff presence stats by company department</p>
              </div>
            </div>
          </div>
          
          <div className="min-h-36">
            {loadingDept ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-32 w-full rounded-2xl" />
                ))}
              </div>
            ) : !deptStats || deptStats.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No department stats found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {deptStats.map((d: any) => {
                  const theme = getDeptTheme(d.code);
                  const percent = d.total_employees > 0 
                    ? Math.round((d.present_today / d.total_employees) * 100) 
                    : 0;

                  return (
                    <div 
                      key={d.code}
                      onClick={() => setSelectedDept(d)}
                      className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-32 hover:scale-[1.02] cursor-pointer ${theme.bg}`}
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[9.5px] font-bold font-mono px-2 py-0.5 rounded-md border ${theme.iconBg}`}>
                          {d.code}
                        </span>
                        
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-800 tracking-tight">
                            {d.present_today} <span className="text-slate-450 font-medium">/ {d.total_employees}</span>
                          </span>
                        </div>
                      </div>

                      {/* Department Name & Subheading */}
                      <div className="mt-2 flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-slate-800 truncate" title={d.department}>
                          {d.department}
                        </h3>
                        <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                          {percent}% present today
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2.5 w-full">
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme.barBg}`}>
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${theme.barFill}`}
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
                <X className="w-4.5 h-4.5" />
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
                          <div className={`w-8.5 h-8.5 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0 border font-bold text-[10.5px] shadow-sm`}>
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
    </SidebarLayout>
  );
}
