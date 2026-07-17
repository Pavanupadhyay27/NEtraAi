"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getUserProfile } from "@/app/utils/api";
import { 
  TrendingUp, Users, Activity, CheckCircle, BarChart3, PieChart,
  Calendar, ShieldCheck, Zap, RefreshCw, Building2, Layers, Shield,
  Filter, RotateCcw, Search
} from "lucide-react";

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<number>(7);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    setProfile(getUserProfile());
    setProfileLoading(false);
  }, []);

  const isSuperAdmin = profile?.role?.name === "Super Admin";

  // 1. Fetch Companies (For Super Admin Platform Analytics)
  const { data: companies = [], refetch: refetchCompanies } = useQuery({
    queryKey: ["analytics-companies"],
    queryFn: () => fetchApi("/companies/"),
    enabled: isSuperAdmin && !profileLoading,
  });

  // 2. Fetch Summary (For Org Admin / Common Analytics)
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: () => fetchApi("/analytics/dashboard-summary"),
    enabled: !profileLoading,
  });

  // 3. Fetch Attendance Trends
  const { data: trends = [], refetch: refetchTrends } = useQuery({
    queryKey: ["analytics-trends", days],
    queryFn: () => fetchApi(`/analytics/attendance-trends?days=${days}`),
    enabled: !isSuperAdmin && !profileLoading,
  });

  // 4. Fetch Department Distribution
  const { data: deptDist = [] } = useQuery({
    queryKey: ["analytics-departments"],
    queryFn: () => fetchApi("/analytics/department-distribution"),
    enabled: !isSuperAdmin && !profileLoading,
  });

  // 5. Fetch Recognition Analytics
  const { data: recognition } = useQuery({
    queryKey: ["analytics-recognition"],
    queryFn: () => fetchApi("/analytics/recognition"),
    enabled: !profileLoading,
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics-trends"] });
      if (isSuperAdmin) {
        await refetchCompanies();
      } else {
        await Promise.all([refetchSummary(), refetchTrends()]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const handleResetFilters = () => {
    setDays(7);
    setSelectedOrgId("ALL");
    setTierFilter("ALL");
    setStatusFilter("ALL");
    setDeptFilter("ALL");
  };

  // Filtered Companies data based on top filters
  const filteredCompanies = useMemo(() => {
    return companies.filter((c: any) => {
      if (selectedOrgId !== "ALL" && c.id.toString() !== selectedOrgId) return false;
      if (tierFilter !== "ALL" && (c.subscription_tier || "Free") !== tierFilter) return false;
      if (statusFilter !== "ALL" && (c.status || "Active") !== statusFilter) return false;
      return true;
    });
  }, [companies, selectedOrgId, tierFilter, statusFilter]);

  // Filtered Department Distribution
  const filteredDeptDist = useMemo(() => {
    if (deptFilter === "ALL") return deptDist;
    return deptDist.filter((d: any) => d.department === deptFilter);
  }, [deptDist, deptFilter]);

  // ════════════════════════════════════════════════════════════════
  // SUPER 3D CUSTOM RENDERERS & CONFIGURATIONS
  // ════════════════════════════════════════════════════════════════
  
  // Custom ECharts 3D Cylinder Renderer for authentic isometric 3D Bar Columns
  const render3DCylinder = (params: any, api: any) => {
    const location = api.coord([api.value(0), api.value(1)]);
    const extent = api.coord([api.value(0), 0]);
    const x = location[0];
    const y = location[1];
    const bottomY = extent[1];
    const rawWidth = api.size([1, 0])[0];
    const width = Math.min(Math.max(rawWidth * 0.38, 24), 64);
    const rx = width / 2;
    const ry = Math.max(width / 3.5, 6);

    const colorHex = api.visual("color") || "#22d3ee";

    if (bottomY - y <= 0) return null;

    return {
      type: "group",
      children: [
        // 1. Bottom Base Shadow Disc
        {
          type: "ellipse",
          shape: { cx: x, cy: bottomY, rx: rx * 1.2, ry: ry * 1.2 },
          style: { fill: "rgba(0, 0, 0, 0.4)" }
        },
        // 2. Cylinder Bottom Cap
        {
          type: "ellipse",
          shape: { cx: x, cy: bottomY, rx: rx, ry: ry },
          style: { fill: colorHex }
        },
        // 3. Cylinder Vertical Column Wall with Side Shading & Specular Reflective Center
        {
          type: "rect",
          shape: { x: x - rx, y: y, width: width, height: Math.max(bottomY - y, 2) },
          style: {
            fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: colorHex },
              { offset: 0.3, color: "#ffffff" },
              { offset: 0.6, color: colorHex },
              { offset: 1, color: "#09090b" }
            ])
          }
        },
        {
          type: "ellipse",
          shape: { cx: x, cy: y, rx: rx, ry: ry },
          style: {
            fill: new echarts.graphic.RadialGradient(0.35, 0.35, 0.65, [
              { offset: 0, color: "#ffffff" },
              { offset: 0.45, color: colorHex },
              { offset: 1, color: colorHex }
            ]),
            stroke: "rgba(255, 255, 255, 0.8)",
            lineWidth: 1.5
          }
        }
      ]
    };
  };

  const freeCount = filteredCompanies.filter((c: any) => c.subscription_tier === "Free" || !c.subscription_tier).length;
  const bizCount = filteredCompanies.filter((c: any) => c.subscription_tier === "Business").length;
  const entCount = filteredCompanies.filter((c: any) => c.subscription_tier === "Enterprise").length;
  const totalOrgsNum = filteredCompanies.length;

  const concentric3DDonutOption = {
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#18181b",
      borderColor: "#3f3f46",
      borderWidth: 1,
      textStyle: { color: "#f4f4f5", fontSize: 12, fontFamily: "Inter" },
      borderRadius: 8,
      padding: [10, 14],
      formatter: "{b}: <b style='color:#38bdf8;'>{c} Orgs</b> ({d}%)"
    },
    legend: {
      bottom: "2%",
      left: "center",
      textStyle: { color: "#71717a", fontSize: 11, fontWeight: 700 },
      itemGap: 16,
      icon: "circle",
      itemWidth: 10,
      itemHeight: 10
    },
    series: [
      {
        name: "Subscription Tiers",
        type: "pie",
        radius: ["52%", "78%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        animation: false,
        padAngle: 3,
        itemStyle: {
          borderRadius: 8,
          borderColor: "transparent",
          borderWidth: 3
        },
        label: {
          show: true,
          position: "center",
          formatter: () => `{lbl|Total}\n{val|${totalOrgsNum}}`,
          rich: {
            lbl: { fontSize: 13, fontWeight: 700, color: "#94a3b8", fontFamily: "Inter", lineHeight: 22 },
            val: { fontSize: 32, fontWeight: 900, color: "#22d3ee", fontFamily: "Inter", lineHeight: 38 }
          }
        },
        labelLine: {
          show: true,
          length: 12,
          length2: 16,
          lineStyle: { color: "#94a3b8", width: 1.5 }
        },
        data: [
          { 
            value: freeCount, 
            name: "Free Tier", 
            label: {
              show: true,
              formatter: "{b}\n{d}%",
              color: "#0284c7",
              fontWeight: 700,
              fontSize: 11
            },
            itemStyle: { color: "#38bdf8" } 
          },
          { 
            value: bizCount, 
            name: "Business Tier", 
            label: {
              show: true,
              formatter: "{b}\n{d}%",
              color: "#4f46e5",
              fontWeight: 700,
              fontSize: 11
            },
            itemStyle: { color: "#818cf8" } 
          },
          { 
            value: entCount, 
            name: "Enterprise Tier", 
            label: {
              show: true,
              formatter: "{b}\n{d}%",
              color: "#9333ea",
              fontWeight: 700,
              fontSize: 11
            },
            itemStyle: { color: "#c084fc" } 
          }
        ]
      }
    ]
  };

  const companyNames = filteredCompanies.length ? filteredCompanies.map((c: any) => c.name) : ["Default Org"];
  const companyQuotas = filteredCompanies.length ? filteredCompanies.map((c: any) => c.max_employees || 50) : [50];

  const bar3DCylinderOption = {
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#18181b",
      borderColor: "#3f3f46",
      borderWidth: 1,
      textStyle: { color: "#f4f4f5", fontSize: 12 },
      borderRadius: 8,
      padding: [10, 14],
      formatter: (params: any) => {
        const item = params[0];
        return `<div style="font-weight:800; margin-bottom:2px; color:#f4f4f5;">${item.name}</div>
                <div style="color:#38bdf8; font-weight:700;">Quota Capacity: <b>${item.value} Staff</b></div>`;
      }
    },
    grid: { left: "4%", right: "4%", bottom: "16%", top: "14%", containLabel: true },
    xAxis: {
      type: "category",
      data: companyNames,
      axisLabel: { color: "#71717a", fontSize: 11, fontWeight: 700, margin: 16 },
      axisLine: { lineStyle: { color: "#a1a1aa", width: 1.5 } },
      axisTick: { show: false }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#71717a", fontSize: 10, fontWeight: 600 },
      splitLine: { lineStyle: { color: "rgba(113, 113, 122, 0.2)", type: "dashed" } }
    },
    series: [
      {
        type: "bar",
        itemStyle: { color: "rgba(113, 113, 122, 0.15)", borderRadius: [10, 10, 0, 0] },
        barGap: "-100%",
        barWidth: "32%",
        data: companyQuotas.map(() => Math.max(...companyQuotas, 500) * 1.1),
        animation: false,
        silent: true
      },
      {
        name: "Max Capacity Quota",
        type: "bar",
        barWidth: "32%",
        data: companyQuotas,
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: (params: any) => {
            const colors = [
              [{ offset: 0, color: "#38bdf8" }, { offset: 1, color: "#0284c7" }],
              [{ offset: 0, color: "#818cf8" }, { offset: 1, color: "#4f46e5" }],
              [{ offset: 0, color: "#34d399" }, { offset: 1, color: "#059669" }],
              [{ offset: 0, color: "#fbbf24" }, { offset: 1, color: "#d97706" }],
              [{ offset: 0, color: "#f472b6" }, { offset: 1, color: "#db2777" }]
            ];
            const chosen = colors[params.dataIndex % colors.length];
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, chosen);
          }
        }
      }
    ]
  };

  const trendDates = trends.map((t: any) => {
    const d = new Date(t.date);
    return days <= 7 
      ? d.toLocaleDateString("en-US", { weekday: "short" }) 
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const attendance3DLineOption = {
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#18181b",
      borderColor: "#3f3f46",
      borderWidth: 1,
      textStyle: { color: "#f4f4f5", fontSize: 12 },
      borderRadius: 8,
      padding: [10, 14]
    },
    legend: {
      top: "0%",
      right: "0%",
      textStyle: { color: "#71717a", fontSize: 11, fontWeight: 700 },
      icon: "circle",
      itemGap: 16
    },
    grid: { left: "2%", right: "3%", bottom: "4%", top: "16%", containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: trendDates.length ? trendDates : ["Mon", "Tue", "Wed", "Thu", "Fri"],
      axisLabel: { color: "#71717a", fontSize: 11, fontWeight: 700 },
      axisLine: { lineStyle: { color: "#a1a1aa", width: 1.5 } }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#71717a", fontSize: 10, fontWeight: 600 },
      splitLine: { lineStyle: { color: "rgba(113, 113, 122, 0.2)", type: "dashed" } }
    },
    series: [
      {
        name: "Present Staff",
        type: "line",
        smooth: 0.3,
        showSymbol: true,
        symbol: "circle",
        symbolSize: 10,
        itemStyle: { color: "#06b6d4", borderWidth: 3, borderColor: "#ffffff" },
        lineStyle: { width: 4, color: "#06b6d4" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(6, 182, 212, 0.45)" },
            { offset: 0.7, color: "rgba(6, 182, 212, 0.05)" },
            { offset: 1, color: "rgba(6, 182, 212, 0)" }
          ])
        },
        data: trends.map((t: any) => t.present)
      },
      {
        name: "Late Arrival",
        type: "line",
        smooth: 0.3,
        showSymbol: true,
        symbol: "diamond",
        symbolSize: 8,
        itemStyle: { color: "#f59e0b", borderWidth: 2, borderColor: "#ffffff" },
        lineStyle: { width: 3, type: "dashed", color: "#f59e0b" },
        data: trends.map((t: any) => t.late)
      }
    ]
  };

  const dept3DBarOption = {
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#18181b",
      borderColor: "#3f3f46",
      borderWidth: 1,
      textStyle: { color: "#f4f4f5", fontSize: 12 }
    },
    legend: {
      top: "0%",
      right: "0%",
      textStyle: { color: "#71717a", fontSize: 11, fontWeight: 700 }
    },
    grid: { left: "2%", right: "4%", bottom: "12%", top: "16%", containLabel: true },
    xAxis: {
      type: "category",
      data: filteredDeptDist.map((d: any) => d.department),
      axisLabel: { color: "#71717a", fontSize: 11, fontWeight: 700, margin: 14 }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#71717a", fontSize: 10 }
    },
    series: [
      {
        name: "Present Today",
        type: "bar",
        barWidth: "30%",
        itemStyle: { 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#34d399" },
            { offset: 1, color: "#059669" }
          ]),
          borderRadius: [8, 8, 0, 0] 
        },
        data: filteredDeptDist.map((d: any) => d.present_today)
      }
    ]
  };

  if (profileLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-[400px] flex items-center justify-center">
          <Activity className="w-8 h-8 animate-spin text-zinc-500 dark:text-zinc-400" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter pb-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
                <TrendingUp className="w-5 h-5" />
              </div>
              Analytics
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
              Platform performance and operational telemetry metrics
            </p>
          </div>

          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="p-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs font-bold shadow-sm self-start sm:self-auto disabled:opacity-70"
            title="Refresh Analytics"
          >
            <RefreshCw 
              className={`w-4 h-4 text-cyan-500 dark:text-cyan-400 inline-block ${isRefreshing ? "animate-spin spin-icon" : ""}`} 
              style={isRefreshing ? { animation: "spin-360 0.8s linear infinite", transformOrigin: "center" } : {}}
            /> Refresh Data
          </button>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider pr-3 border-r border-zinc-200 dark:border-zinc-800">
            <Filter className="w-4 h-4 text-cyan-500 dark:text-cyan-400" /> Filters
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl shrink-0">
            <span className="text-xs font-extrabold text-cyan-600 dark:text-cyan-400 px-2 flex items-center gap-1.5 uppercase tracking-wider shrink-0">
              <Calendar className="w-4 h-4 text-cyan-500 dark:text-cyan-400" /> Range:
            </span>
            {[
              { label: "7D", val: 7 },
              { label: "30D", val: 30 },
              { label: "90D", val: 90 },
              { label: "1Y", val: 365 },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setDays(item.val)}
                className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer shrink-0 border transition-all ${
                  days === item.val
                    ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {isSuperAdmin && companies.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Org:</span>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-lg pl-3 pr-8 py-1.5 focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">All Organizations ({companies.length})</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Tier:</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-lg pl-3 pr-8 py-1.5 focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">All Tiers</option>
                <option value="Free">Free Tier</option>
                <option value="Business">Business Tier</option>
                <option value="Enterprise">Enterprise Tier</option>
              </select>
            </div>
          )}

          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-lg pl-3 pr-8 py-1.5 focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}

          {!isSuperAdmin && deptDist.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Department:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-lg pl-3 pr-8 py-1.5 focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {deptDist.map((d: any) => (
                  <option key={d.department} value={d.department}>
                    {d.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleResetFilters}
            className="ml-auto px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> Reset
          </button>
        </div>

        {isSuperAdmin ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Onboarded Organizations
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {filteredCompanies.length}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Active: {filteredCompanies.filter((c: any) => (c.status || "Active") === "Active").length}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Registered SaaS platform tenants
                </p>
              </div>

              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Total Enrolled Employees
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {summary?.total_employees || 0}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Cross-Org Combined
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Multi-tenant registered staff count
                </p>
              </div>

              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Platform AI Scan Telemetry
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {recognition?.total_scans || 0}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    <Zap className="w-3 h-3 mr-0.5" /> {recognition?.average_processing_time_ms || 120}ms
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  512-dim facial verification throughput
                </p>
              </div>

              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Multi-Tenant Spoof Shield
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {recognition?.spoof_attempts || 0}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Attempts Blocked
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Global kiosk liveness filter
                </p>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="tech-card-3d-minimal p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-zinc-100 tracking-wider">
                      Subscription Tier Distribution
                    </h3>
                  </div>
                </div>
                <ReactECharts option={concentric3DDonutOption} style={{ height: "320px" }} />
              </div>

              <div className="tech-card-3d-minimal lg:col-span-2 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-zinc-100 tracking-wider">
                      Organization Employee Quota Allocations
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                    Live Platform Allocations
                  </span>
                </div>
                <ReactECharts option={bar3DCylinderOption} style={{ height: "320px" }} />
              </div>

            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Attendance Rate
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {summary?.attendance_percentage || 0}%
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-zinc-705 dark:text-zinc-305 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Present: {summary?.present_today || 0}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Daily active staff attendance
                </p>
              </div>

              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Staff Strength
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {summary?.total_employees || 0}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-zinc-705 dark:text-zinc-305 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Late: {summary?.late_today || 0}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Active company personnel
                </p>
              </div>

              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Biometric Accuracy
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {recognition?.average_confidence ? (recognition.average_confidence * 100).toFixed(1) : 98.5}%
                  </p>
                  <span className="inline-flex items-center text-[10px] font-mono font-bold text-zinc-705 dark:text-zinc-305 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    <Zap className="w-3 h-3 mr-0.5" /> {recognition?.average_processing_time_ms || 120}ms
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  512-dim facial vector confidence
                </p>
              </div>

              <div className="tech-card-3d-minimal p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Spoof Attempts Blocked
                  </span>
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {recognition?.spoof_attempts || 0}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-zinc-705 dark:text-zinc-305 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Liveness Active
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  Kiosk scanner protection
                </p>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="tech-card-3d-minimal lg:col-span-2 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-zinc-500 dark:text-zinc-450" />
                    <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-zinc-100 tracking-wider">
                      Attendance Dynamics Curve ({days} Days)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                    Database Live Feed
                  </span>
                </div>
                <ReactECharts option={attendance3DLineOption} style={{ height: "300px" }} />
              </div>

              <div className="tech-card-3d-minimal p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                  <Building2 className="w-4 h-4 text-zinc-500 dark:text-zinc-450" />
                  <h3 className="text-xs font-black uppercase text-zinc-100 tracking-wider">
                    3D Isometric Department Cylinders
                  </h3>
                </div>
                <ReactECharts option={dept3DBarOption} style={{ height: "300px" }} />
              </div>

            </div>
          </>
        )}

      </div>
    </SidebarLayout>
  );
}
