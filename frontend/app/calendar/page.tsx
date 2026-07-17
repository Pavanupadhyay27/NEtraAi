"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getUserProfile, getLocalDateString } from "@/app/utils/api";
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Compass, 
  Info,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserMinus,
  LogIn,
  LogOut,
  Coffee,
  CalendarDays,
  Activity,
  ArrowUpRight,
  Calendar as CalendarGridIcon
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
  { id: 2, name: "Pongal / Makar Sankranti", date: "2026-01-14", day: "Wednesday", type: "Gazetted", description: "Harvest festival dedicated to the Sun God." },
  { id: 3, name: "Republic Day", date: "2026-01-26", day: "Monday", type: "National", description: "Commemorates the enactment of the Constitution of India." },
  { id: 4, name: "Maha Shivratri", date: "2026-02-15", day: "Sunday", type: "Restricted", description: "Hindu festival celebrated annually in honor of God Shiva." },
  { id: 5, name: "Holi", date: "2026-03-03", day: "Tuesday", type: "Gazetted", description: "The festival of colors, celebrating the arrival of spring." },
  { id: 6, name: "Eid al-Fitr", date: "2026-03-20", day: "Friday", type: "Gazetted", description: "Islamic holiday marking the end of Ramadan fast." },
  { id: 7, name: "Ram Navami", date: "2026-03-28", day: "Saturday", type: "Restricted", description: "Celebrates the birth of Lord Rama." },
  { id: 8, name: "Good Friday", date: "2026-04-03", day: "Friday", type: "Restricted", description: "Christian holiday commemorating the crucifixion of Jesus." },
  { id: 9, name: "Ambedkar Jayanti", date: "2026-04-14", day: "Tuesday", type: "Gazetted", description: "Birth anniversary of Dr. B.R. Ambedkar, father of Indian constitution." },
  { id: 10, name: "May Day / Labor Day", date: "2026-05-01", day: "Friday", type: "Gazetted", description: "Celebration of laborers and the working class." },
  { id: 11, name: "Eid al-Adha", date: "2026-05-27", day: "Wednesday", type: "Gazetted", description: "Islamic feast of sacrifice." },
  { id: 12, name: "Muharram", date: "2026-06-26", day: "Friday", type: "Gazetted", description: "Islamic New Year." },
  { id: 13, name: "Independence Day", date: "2026-08-15", day: "Saturday", type: "National", description: "Marks the nation's independence from British rule." },
  { id: 14, name: "Raksha Bandhan", date: "2026-08-27", day: "Thursday", type: "Restricted", description: "Celebrating the sacred bond between brothers and sisters." },
  { id: 15, name: "Janmashtami", date: "2026-09-04", day: "Friday", type: "Restricted", description: "Celebrates the birth of Lord Krishna." },
  { id: 16, name: "Gandhi Jayanti", date: "2026-10-02", day: "Friday", type: "National", description: "Birthday tribute to Mahatma Gandhi, Father of the Nation." },
  { id: 17, name: "Dussehra", date: "2026-10-20", day: "Tuesday", type: "Gazetted", description: "Celebrating victory of Rama over Ravana / Good over Evil." },
  { id: 18, name: "Diwali / Deepavali", date: "2026-11-09", day: "Monday", type: "Gazetted", description: "Festival of lights celebrating the victory of light over darkness." },
  { id: 19, name: "Guru Nanak Jayanti", date: "2026-11-24", day: "Tuesday", type: "Gazetted", description: "Birth anniversary of Guru Nanak." },
  { id: 20, name: "Christmas Day", date: "2026-12-25", day: "Friday", type: "Gazetted", description: "Annual celebration commemorating the birth of Jesus Christ." },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CalendarPage() {
  const [profile, setProfile] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date()); // Default showing current system date
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  const employee = profile?.employee;

  // Fetch company geofence and policy rules
  const { data: rules } = useQuery({
    queryKey: ["attendance-policy-rules"],
    queryFn: () => fetchApi("/policy/rules").catch(() => null),
  });

  // Fetch employee attendance history
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["employee-calendar-history", employee?.id],
    queryFn: () => fetchApi(`/attendance/employee/${employee?.id}`),
    enabled: !!employee?.id
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const getHolidayForDay = (dayNum: number): Holiday | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return STATIC_HOLIDAYS.find((h) => h.date === dateStr);
  };

  const getAttendanceForDay = (dayNum: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return history.find((h: any) => h.date === dateStr);
  };

  // Determine cell state for coloring
  const getDayState = (dayNum: number) => {
    const holiday = getHolidayForDay(dayNum);
    if (holiday) return { type: "holiday", label: holiday.name, holiday };

    const att = getAttendanceForDay(dayNum);
    if (att) {
      if (["Present", "WFH"].includes(att.status)) return { type: "present", record: att };
      if (att.status === "Late") return { type: "late", record: att };
      if (att.status === "Absent") return { type: "absent", record: att };
      if (att.status === "On Leave") return { type: "leave", record: att };
    }

    // No record exists
    const cellDate = new Date(year, month, dayNum);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (cellDate > today) {
      return { type: "future" };
    }

    const dayOfWeek = cellDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) {
      return { type: "weekend" };
    }

    return { type: "absent" };
  };

  const daysArray = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  const selectedDayState = selectedDay ? getDayState(selectedDay) : null;
  const selectedHoliday = selectedDayState?.holiday || null;
  const selectedRecord = selectedDayState?.record || null;

  const activeMonthHolidays = STATIC_HOLIDAYS.filter((h) => {
    const hDate = new Date(h.date);
    return hDate.getMonth() === month && hDate.getFullYear() === year;
  });

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-zinc-100 font-sans">
        
        {/* Header Block */}
        <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 shadow-2xs">
                <CalendarIcon className="w-5.5 h-5.5 text-cyan-500" />
              </div>
              Calendar & Info Hub
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-400 mt-1.5">
              Tracks shift punches, holidays, and weekly-offs. Click on dates to view full check-in analytics.
            </p>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Calendar Card (Sleek Modern Layout) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] transition-all">
              
              {/* Month Selector Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-black text-slate-950 dark:text-zinc-200 uppercase font-mono tracking-wider">
                    {MONTHS[month]} {year}
                  </h3>
                  <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5 border border-zinc-200 dark:border-zinc-700/60">
                    <button onClick={prevMonth} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-slate-500 dark:text-zinc-450 cursor-pointer active:scale-95 transition-all">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={nextMonth} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-lg text-slate-500 dark:text-zinc-455 cursor-pointer active:scale-95 transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-cyan-600 dark:text-cyan-400 font-mono bg-cyan-50 dark:bg-cyan-950/30 px-2.5 py-0.5 rounded-lg border border-cyan-150 dark:border-cyan-900/30 uppercase tracking-wider">
                  <Activity className="w-3 h-3 text-cyan-500 animate-pulse" />
                  Live Sync Active
                </span>
              </div>

              {/* Weekdays Row wrapper with custom background pill */}
              <div className="grid grid-cols-7 gap-1.5 text-center font-bold text-[10px] font-mono text-zinc-450 dark:text-zinc-550 uppercase mb-3 bg-zinc-50 dark:bg-zinc-950/40 py-2 px-1.5 rounded-xl border border-zinc-200/40 dark:border-zinc-850/50">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-0.5 tracking-wider">{day.slice(0, 3)}</div>
                ))}
              </div>

              {/* Calendar Days grid */}
              <div className="grid grid-cols-7 gap-2">
                {daysArray.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="aspect-square bg-slate-50/10 dark:bg-zinc-950/5 rounded-xl border border-dashed border-zinc-150/20 dark:border-zinc-900/30" />;
                  }

                  const state = getDayState(day);
                  const isSelected = selectedDay === day;

                  // High-fidelity cell styling based on attendance status
                  let cellStyle = "bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-250 border-slate-200 dark:border-zinc-800 shadow-2xs hover:shadow-sm hover:translate-y-[-1px] active:translate-y-[1px]";
                  let dotStyle = "";

                  if (state.type === "present") {
                    cellStyle = "bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/20 shadow-xs border-b-[3px] border-b-emerald-500";
                    dotStyle = "bg-emerald-500";
                  } else if (state.type === "late") {
                    cellStyle = "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/35 hover:bg-amber-500/20 shadow-xs border-b-[3px] border-b-amber-500";
                    dotStyle = "bg-amber-500";
                  } else if (state.type === "absent") {
                    cellStyle = "bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-500/35 hover:bg-rose-500/20 shadow-xs border-b-[3px] border-b-rose-500";
                    dotStyle = "bg-rose-500";
                  } else if (state.type === "holiday") {
                    cellStyle = "bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border-cyan-500/35 hover:bg-cyan-500/20 shadow-xs border-b-[3px] border-b-cyan-500";
                    dotStyle = "bg-cyan-500";
                  } else if (state.type === "leave") {
                    cellStyle = "bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border-indigo-500/35 hover:bg-indigo-500/20 shadow-xs border-b-[3px] border-b-indigo-500";
                    dotStyle = "bg-indigo-500";
                  } else if (state.type === "weekend") {
                    cellStyle = "bg-zinc-50 dark:bg-zinc-950/20 text-slate-400 dark:text-zinc-500 border-zinc-200/50 dark:border-zinc-850 hover:bg-zinc-100/40 border-b-[3px] border-b-zinc-300 dark:border-b-zinc-700";
                  }

                  if (isSelected) {
                    cellStyle += " ring-2 ring-cyan-500 dark:ring-cyan-400 border-cyan-500 shadow-md translate-y-[-1px]";
                  }

                  return (
                    <button
                      key={`day-${day}`}
                      onClick={() => setSelectedDay(day)}
                      className={`aspect-square rounded-xl border flex flex-col justify-between p-2.5 transition-all text-left cursor-pointer ${cellStyle}`}
                    >
                      <span className="text-xs font-black leading-none">{day}</span>
                      {dotStyle && (
                        <span className={`w-1.5 h-1.5 rounded-full ${dotStyle} self-end mt-auto`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend indicator */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-4 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Late</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Leave</span>
                </div>
              </div>

            </div>

            {/* Holidays of the Month list */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4.5 h-4.5 text-cyan-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-slate-950 dark:text-zinc-200 uppercase tracking-wider font-mono">
                    Holidays in {MONTHS[month]}
                  </h3>
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/30 rounded">
                  {activeMonthHolidays.length} Holidays
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeMonthHolidays.length > 0 ? (
                  activeMonthHolidays.map((holiday) => {
                    const hDay = new Date(holiday.date).getDate();
                    const isHolidaySelected = selectedDay === hDay;
                    return (
                      <button
                        key={holiday.id}
                        onClick={() => setSelectedDay(hDay)}
                        className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group bg-zinc-50/50 dark:bg-zinc-950/20 ${
                          isHolidaySelected 
                            ? "border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500/20" 
                            : "border-zinc-150 dark:border-zinc-850 hover:border-cyan-300 dark:hover:border-cyan-800"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400">{holiday.name}</p>
                          <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">{holiday.date} &bull; {holiday.day}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          holiday.type === "National" ? "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" :
                          holiday.type === "Gazetted" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" :
                          "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                        }`} />
                      </button>
                    );
                  })
                ) : (
                  <p className="text-[10px] text-slate-450 dark:text-zinc-500 text-center py-6 italic font-mono col-span-2">No holidays scheduled this month.</p>
                )}
              </div>
            </div>

          </div>

          {/* Activity Logs of Selected Day (Greathr Detail Sidebar Panel) */}
          <div className="lg:col-span-5 space-y-6">
            {selectedDay ? (
              <div className="tech-card-3d bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 flex flex-col justify-between min-h-[400px]">
                
                <div className="space-y-5">
                  {/* Selected Day Info Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-200 uppercase tracking-wider font-mono">
                        Date Details & Activity
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-semibold">
                        {new Date(year, month, selectedDay).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    
                    {/* Status Pill */}
                    <span className={`text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-lg border ${
                      selectedDayState?.type === "present" ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                      selectedDayState?.type === "late" ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                      selectedDayState?.type === "absent" ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455" :
                      selectedDayState?.type === "holiday" ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400" :
                      selectedDayState?.type === "leave" ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400" :
                      selectedDayState?.type === "weekend" ? "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-405" :
                      "bg-slate-50 border-slate-200 text-slate-400"
                    }`}>
                      {selectedDayState?.type}
                    </span>
                  </div>

                  {/* Activity Details Display */}
                  <div className="space-y-4 text-xs">
                    {selectedHoliday && (
                      <div className="p-4 bg-cyan-500/5 dark:bg-cyan-950/10 border border-cyan-100 dark:border-cyan-900/60 rounded-xl space-y-1.5">
                        <p className="font-extrabold text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                          <Coffee className="w-3.5 h-3.5" />
                          Official Holiday: {selectedHoliday.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-normal font-medium">{selectedHoliday.description}</p>
                        <span className="inline-block text-[8px] font-mono font-semibold px-2 py-0.5 bg-cyan-100/50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded">
                          {selectedHoliday.type} Category
                        </span>
                      </div>
                    )}

                    {selectedRecord && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/30 border border-zinc-150/60 dark:border-zinc-850/80 flex items-center gap-3">
                          <LogIn className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono tracking-wider leading-none">Punch In</p>
                            <p className="font-extrabold text-slate-850 dark:text-zinc-200 mt-1 font-mono text-[13px]">
                              {selectedRecord.check_in ? new Date(selectedRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/30 border border-zinc-150/60 dark:border-zinc-850/80 flex items-center gap-3">
                          <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono tracking-wider leading-none">Punch Out</p>
                            <p className="font-extrabold text-slate-850 dark:text-zinc-200 mt-1 font-mono text-[13px]">
                              {selectedRecord.check_out ? new Date(selectedRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/30 border border-zinc-150/60 dark:border-zinc-850/80 flex items-center gap-3">
                          <Clock className="w-4 h-4 text-cyan-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono tracking-wider leading-none">Worked Hours</p>
                            <p className="font-extrabold text-slate-850 dark:text-zinc-200 mt-1 font-mono text-[13px]">
                              {(selectedRecord.working_hours || 0).toFixed(1)} hrs
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/30 border border-zinc-150/60 dark:border-zinc-850/80 flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase font-mono tracking-wider leading-none">GPS Geofence</p>
                            <p className="font-extrabold text-slate-855 dark:text-zinc-200 mt-1 text-[11px] truncate" title={selectedRecord.geofence_result || "Verified"}>
                              {selectedRecord.geofence_result || "Verified Match"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!selectedHoliday && !selectedRecord && (
                      <div className="p-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 dark:text-zinc-500 space-y-2.5 bg-zinc-50/20 dark:bg-zinc-950/10">
                        {selectedDayState?.type === "weekend" ? (
                          <>
                            <Coffee className="w-8 h-8 mx-auto text-zinc-400 opacity-40 animate-bounce" />
                            <p className="font-bold text-slate-700 dark:text-zinc-300">Weekly Off (Weekend)</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">No shift checks are required on Saturdays and Sundays.</p>
                          </>
                        ) : selectedDayState?.type === "future" ? (
                          <>
                            <Clock className="w-8 h-8 mx-auto text-zinc-400 opacity-40" />
                            <p className="font-bold text-slate-700 dark:text-zinc-300">Scheduled Workday</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">Shift starts at 09:00 AM. Biometric registration will open on date arrival.</p>
                          </>
                        ) : (
                          <>
                            <UserMinus className="w-8 h-8 mx-auto text-rose-500 opacity-40 animate-pulse" />
                            <p className="font-bold text-rose-700 dark:text-rose-455">Absent (No punch records found)</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">No logs detected. Contact HR if you require a retrospective override.</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Policy settings details footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-[10px] text-slate-500 dark:text-zinc-400 leading-normal flex items-start gap-2 bg-slate-50/50 dark:bg-zinc-950/20 p-2.5 rounded-xl font-medium mt-4">
                  <Info className="w-4 h-4 text-cyan-500 shrink-0" />
                  <span>
                    Shift timings are structured <strong>09:00 AM - 05:00 PM</strong> with a 15-minute grace period. Punch logs are cross-referenced with your active office geofence.
                  </span>
                </div>

              </div>
            ) : (
              <div className="tech-card-3d bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 text-center text-zinc-450 dark:text-zinc-400 text-xs italic font-medium">
                Click on any calendar day to inspect punch records.
              </div>
            )}
          </div>

        </div>

      </div>
    </SidebarLayout>
  );
}
