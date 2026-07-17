"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi } from "@/app/utils/api";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Award, 
  Compass, 
  Zap, 
  ChevronRight,
  Info
} from "lucide-react";

interface Holiday {
  id: number;
  name: string;
  date: string;
  day: string;
  type: "National" | "Gazetted" | "Restricted";
  description: string;
}

const STATIC_HOLIDAYS: Holiday[] = [
  { id: 1, name: "New Year's Day", date: "2026-01-01", day: "Thursday", type: "National", description: "First day of the new Gregorian calendar year." },
  { id: 2, name: "Republic Day", date: "2026-01-26", day: "Monday", type: "National", description: "Commemorates the enactment of the Constitution of India." },
  { id: 3, name: "Good Friday", date: "2026-04-03", day: "Friday", type: "Restricted", description: "Christian holiday commemorating the crucifixion of Jesus." },
  { id: 4, name: "May Day / Labor Day", date: "2026-05-01", day: "Friday", type: "Gazetted", description: "Celebration of laborers and the working class." },
  { id: 5, name: "Independence Day", date: "2026-08-15", day: "Saturday", type: "National", description: "Marks the nation's independence from British rule." },
  { id: 6, name: "Gandhi Jayanti", date: "2026-10-02", day: "Friday", type: "National", description: "Birthday tribute to Mahatma Gandhi, Father of the Nation." },
  { id: 7, name: "Diwali / Deepavali", date: "2026-11-09", day: "Monday", type: "Gazetted", description: "Festival of lights celebrating the victory of light over darkness." },
  { id: 8, name: "Christmas Day", date: "2026-12-25", day: "Friday", type: "Gazetted", description: "Annual celebration commemorating the birth of Jesus Christ." },
];

export default function HolidaysPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  // Fetch company geofence and policy rules
  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ["attendance-policy-rules"],
    queryFn: () => fetchApi("/policy/rules").catch(() => null),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredHolidays = STATIC_HOLIDAYS.filter((h) => {
    const hDate = new Date(h.date);
    if (activeTab === "upcoming") {
      return hDate >= today;
    } else {
      return hDate < today;
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter max-w-5xl mx-auto text-slate-800 dark:text-zinc-100 font-sans">
        
        {/* Header Block */}
        <div className="pb-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <Calendar className="w-5.5 h-5.5 text-cyan-500" />
              Holidays & Policy Hub
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-400 mt-1">
              Official annual company holidays list and active attendance policies.
            </p>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Holidays Listing */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-4 mb-4">
                <h3 className="text-xs font-bold text-slate-955 dark:text-zinc-200 uppercase tracking-wider font-mono">
                  Company Holidays Calendar
                </h3>
                
                {/* Tabs */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    onClick={() => setActiveTab("upcoming")}
                    className={`px-3 py-1 rounded-md transition-all uppercase cursor-pointer ${
                      activeTab === "upcoming" 
                        ? "bg-white dark:bg-zinc-750 text-slate-955 dark:text-white shadow-2xs" 
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => setActiveTab("past")}
                    className={`px-3 py-1 rounded-md transition-all uppercase cursor-pointer ${
                      activeTab === "past" 
                        ? "bg-white dark:bg-zinc-750 text-slate-955 dark:text-white shadow-2xs" 
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-800"
                    }`}
                  >
                    Past
                  </button>
                </div>
              </div>

              {/* Holiday Cards */}
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredHolidays.length > 0 ? (
                  filteredHolidays.map((holiday) => {
                    const isUpcoming = new Date(holiday.date) >= today;
                    return (
                      <div 
                        key={holiday.id} 
                        className={`p-3.5 rounded-xl border transition-all duration-250 flex items-start gap-4 ${
                          isUpcoming 
                            ? "bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800/80 hover:border-cyan-300 dark:hover:border-cyan-800 shadow-3xs" 
                            : "bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-100 dark:border-zinc-900 text-slate-400 dark:text-zinc-500"
                        }`}
                      >
                        {/* Calendar Icon Badge */}
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border font-bold text-center ${
                          isUpcoming
                            ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-100 dark:border-cyan-900 text-cyan-600 dark:text-cyan-400"
                            : "bg-zinc-100 dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
                        }`}>
                          <span className="text-[9px] uppercase tracking-wider font-extrabold -mb-0.5 leading-none">
                            {new Date(holiday.date).toLocaleDateString([], { month: "short" })}
                          </span>
                          <span className="text-sm font-black tracking-tight leading-none mt-0.5">
                            {new Date(holiday.date).getDate()}
                          </span>
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-xs font-bold truncate ${isUpcoming ? "text-slate-900 dark:text-zinc-100" : "text-slate-450 dark:text-zinc-500"}`}>
                              {holiday.name}
                            </h4>
                            <span className={`inline-block text-[8px] font-mono font-bold px-1.5 py-0.25 rounded border uppercase ${
                              holiday.type === "National"
                                ? "bg-red-50 dark:bg-red-950/30 border-red-150 dark:border-red-900 text-red-600 dark:text-red-400"
                                : holiday.type === "Gazetted"
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-150 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400"
                                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-150 dark:border-amber-900 text-amber-600 dark:text-amber-400"
                            }`}>
                              {holiday.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-450 dark:text-zinc-400 mt-1.5 leading-relaxed">
                            {holiday.description}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                            <span>{holiday.day}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 text-xs">
                    No holidays to display for this period.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Policy Information Side cards */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Geofence & Location */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-955 dark:text-zinc-200 uppercase tracking-wider font-mono">
                  Attendance Rules & Location
                </h3>
              </div>

              {loadingRules ? (
                <div className="space-y-3">
                  <div className="skeleton h-8 w-full" />
                  <div className="skeleton h-8 w-full" />
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="flex items-start justify-between p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-955/30 border border-zinc-100 dark:border-zinc-850">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Geofence Bounds</p>
                      <p className="font-semibold text-slate-800 dark:text-zinc-200">
                        {rules?.geofence_radius_meters || "500"} Meters Radius
                      </p>
                    </div>
                    <Compass className="w-4 h-4 text-zinc-400" />
                  </div>

                  <div className="flex items-start justify-between p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-955/30 border border-zinc-100 dark:border-zinc-850">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Face Recognition Quality</p>
                      <p className="font-semibold text-slate-800 dark:text-zinc-200">
                        {rules?.face_match_threshold ? `${Math.round(rules.face_match_threshold * 100)}%` : "60%"} Accuracy Threshold
                      </p>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-zinc-400" />
                  </div>

                  <div className="flex items-start justify-between p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-955/30 border border-zinc-100 dark:border-zinc-850">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Coordinates Lock</p>
                      <p className="font-semibold text-slate-800 dark:text-zinc-200 font-mono text-[10.5px]">
                        Lat: {rules?.office_latitude?.toFixed(4) || "—"} , Lng: {rules?.office_longitude?.toFixed(4) || "—"}
                      </p>
                    </div>
                    <MapPin className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Shift Timing Card */}
            <div className="bg-gradient-to-br from-zinc-900 to-slate-950 text-white rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-zinc-200">
                  Standard Shift Policy
                </h3>
              </div>

              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Shift Timings</span>
                  <span className="font-bold font-mono">09:00 AM - 05:00 PM</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Grace Period</span>
                  <span className="font-bold font-mono">15 Minutes Allowed</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Policy Version</span>
                  <span className="font-bold font-mono text-[10px] bg-cyan-950 border border-cyan-800/60 px-2 py-0.5 rounded text-cyan-400 uppercase">
                    {rules?.policy_version || "v2.0-Enterprise"}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-zinc-800/80 flex items-start gap-2.5 text-[10.5px] text-zinc-450 leading-normal">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Checks outside coordinates lock or after grace periods are logged as anomalies requiring HR approvals.
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </SidebarLayout>
  );
}
