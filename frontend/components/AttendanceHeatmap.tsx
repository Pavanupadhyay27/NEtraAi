"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/app/utils/api";
import { Loader2, Calendar } from "lucide-react";

interface AttendanceHeatmapProps {
  employeeId?: number;
  title?: string;
}

export default function AttendanceHeatmap({ employeeId, title }: AttendanceHeatmapProps) {
  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ["attendance-heatmap", employeeId],
    queryFn: () => {
      const url = employeeId 
        ? `/analytics/heatmap?employee_id=${employeeId}` 
        : `/analytics/heatmap`;
      return fetchApi(url);
    }
  });

  // Generate date cells for the last 365 days (ending today)
  const cells: { dateStr: string; dateObj: Date; count: number }[] = [];
  const today = new Date();
  
  // Start from 365 days ago, offset to start on a Sunday if possible
  const totalDays = 365;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - totalDays);
  
  // Align start date to Sunday of that week
  const startDayOffset = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDayOffset);

  const currentDateIter = new Date(startDate);
  while (currentDateIter <= today) {
    const dateStr = currentDateIter.toISOString().split("T")[0];
    const count = heatmapData?.[dateStr] || 0;
    cells.push({
      dateStr,
      dateObj: new Date(currentDateIter),
      count
    });
    currentDateIter.setDate(currentDateIter.getDate() + 1);
  }

  // Group cells by week (column)
  const weeks: typeof cells[] = [];
  let currentWeek: typeof cells = [];
  
  cells.forEach((cell) => {
    if (cell.dateObj.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(cell);
  });
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const maxCount = Math.max(...Object.values(heatmapData || {}).map(v => Number(v) || 0), 1);

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-zinc-150 dark:bg-zinc-800/80 border-zinc-200/5";
    
    if (employeeId) {
      return "bg-emerald-500 dark:bg-emerald-400 border-emerald-600/10 shadow-[0_0_6px_rgba(16,185,129,0.15)]";
    }
    
    const ratio = count / maxCount;
    if (ratio <= 0.25) return "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-250/20";
    if (ratio <= 0.5) return "bg-emerald-300 dark:bg-emerald-800/60 border-emerald-450/20";
    if (ratio <= 0.75) return "bg-emerald-500 dark:bg-emerald-600 border-emerald-550/20";
    return "bg-emerald-700 dark:bg-emerald-400 border-emerald-850/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
  };

  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, colIdx) => {
    const firstDay = week[0]?.dateObj;
    if (firstDay && firstDay.getMonth() !== lastMonth) {
      const label = firstDay.toLocaleString([], { month: "short" });
      monthLabels.push({ label, colIndex: colIdx });
      lastMonth = firstDay.getMonth();
    }
  });

  return (
    <div className="tech-card-3d p-5">
      <div className="flex items-center gap-2 mb-4 border-b border-zinc-50 pb-3">
        <Calendar className="w-4 h-4 text-slate-450" />
        <h3 className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">
          {title || (employeeId ? "Attendance Ledger Map" : "Company Activity Heatmap")}
        </h3>
      </div>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
          <span>Retrieving heatmap data...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="min-w-[720px] flex flex-col space-y-1.5 select-none pr-2">
            
            {/* Month Header Row */}
            <div className="relative h-4 text-[9px] font-semibold text-slate-400 font-sans">
              {monthLabels.map((ml, idx) => (
                <div 
                  key={idx} 
                  className="absolute"
                  style={{ left: `${(ml.colIndex * 13) + 24}px` }}
                >
                  {ml.label}
                </div>
              ))}
            </div>

            {/* Grid Container */}
            <div className="flex gap-[3.5px]">
              
              {/* Day Labels Column */}
              <div className="flex flex-col justify-between text-[8px] font-semibold text-slate-400 font-sans w-5 pt-0.5 h-[80px]">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>

              {/* Weeks (Columns) */}
              <div className="flex gap-[3px] flex-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {week.map((cell, dIdx) => {
                      const label = cell.dateObj.toLocaleDateString([], {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      });
                      const tooltip = employeeId
                        ? `${label}: ${cell.count > 0 ? "Present" : "Absent"}`
                        : `${label}: ${cell.count} checked in`;

                      return (
                        <div
                          key={dIdx}
                          title={tooltip}
                          className={`w-2.5 h-2.5 rounded-[2px] border transition-all duration-200 hover:scale-125 cursor-pointer ${getIntensityClass(cell.count)}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend Row */}
            <div className="flex items-center justify-end gap-1.5 pt-3.5 text-[9px] font-mono text-slate-400 font-bold uppercase">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-[2px] bg-zinc-150 border border-zinc-200/5 shrink-0" />
              {!employeeId && (
                <>
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-250/20 shrink-0" />
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-300 dark:bg-emerald-800/60 border border-emerald-450/20 shrink-0" />
                  <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 dark:bg-emerald-600 border border-emerald-550/20 shrink-0" />
                </>
              )}
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700 dark:bg-emerald-400 border border-emerald-850/20 shrink-0" />
              <span>More</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
