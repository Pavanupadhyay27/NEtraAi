"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileSpreadsheet, 
  Settings, 
  Monitor, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  Scan,
  History,
  Sun,
  Moon,
  Building2,
  MessageSquare,
  User,
  TrendingUp,
  Calendar,
  FileText,
  Shield
} from "lucide-react";
import { getAccessToken, getUserProfile, clearTokens } from "@/app/utils/api";
import CommandPalette from "@/components/CommandPalette";

function NavLink({ 
  item, 
  isActive, 
  isCollapsed, 
  onClick 
}: { 
  item: { name: string; href: string; icon: any }, 
  isActive: boolean, 
  isCollapsed: boolean, 
  onClick?: () => void 
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      data-tooltip={isCollapsed ? item.name : undefined}
      className={`group relative flex items-center ${isCollapsed ? "justify-center px-2" : "gap-2.5 px-2.5 mx-1"} py-2.5 rounded-xl transition-all duration-200 ${
        isActive
          ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]"
      }`}
    >
      <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 transition-all ${
        isActive
          ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
          : "bg-[var(--border-subtle)] text-[var(--text-muted)] group-hover:bg-[var(--border-strong)] group-hover:text-[var(--text-secondary)]"
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      
      {!isCollapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            {item.name}
          </p>
        </div>
      )}
    </Link>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load theme and sidebar state from localStorage on client side
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }

    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = (savedTheme as "light" | "dark") || (systemPrefersDark ? "dark" : "light");
    
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem("sidebar_collapsed", String(nextVal));
  };

  useEffect(() => {
    const token = getAccessToken();
    const profile = getUserProfile();
    
    if (!token || !profile) {
      clearTokens();
      router.push("/");
    } else {
      setUser(profile);
      setAuthorized(true);
      
       // Auto-redirect employees to dashboard if they attempt to access any admin views
      if (profile?.role?.name === "Employee" && pathname !== "/dashboard" && pathname !== "/tickets" && pathname !== "/profile" && pathname !== "/calendar") {
        router.push("/dashboard");
      } else if (profile?.role?.name !== "Super Admin" && (pathname === "/tenants" || pathname === "/users" || pathname === "/analytics")) {
        router.push("/dashboard");
      }
    }
  }, [router, pathname]);

  const [currentQuery, setCurrentQuery] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleUpdate = () => {
        setCurrentQuery(window.location.search);
      };
      handleUpdate();
      const interval = setInterval(handleUpdate, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const isLinkActive = (href: string) => {
    if (href.includes("?")) {
      const [linkPath, linkSearch] = href.split("?");
      if (pathname !== linkPath) return false;
      const linkParams = new URLSearchParams(linkSearch);
      const currentParams = new URLSearchParams(currentQuery);
      return linkParams.get("tab") === currentParams.get("tab");
    } else {
      if (href === "/dashboard") {
        const currentParams = new URLSearchParams(currentQuery);
        if (currentParams.has("tab")) return false;
        return pathname === "/dashboard";
      }
      return pathname === href || pathname.startsWith(href + "/");
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
            <div className="absolute inset-0 rounded-full border-2 border-[var(--text-primary)] border-t-transparent animate-spin" />
          </div>
          <p className="text-[var(--text-secondary)] text-sm font-mono">Authenticating...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearTokens();
    router.push("/");
  };

  const initials = user?.email ? user.email[0].toUpperCase() : "A";
  const isEmployee = user?.role?.name === "Employee";
  const isSuperAdmin = user?.role?.name === "Super Admin";

  const getVisibleNavItems = () => {
    const role = user?.role?.name;
    if (role === "Super Admin") {
      return [
        { name: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
        { name: "Organizations",   href: "/tenants",    icon: Building2 },
        { name: "Analytics",       href: "/analytics",  icon: TrendingUp },
        { name: "Helpdesk",        href: "/tickets",    icon: MessageSquare },
        { name: "Audit Logs",      href: "/audit",      icon: History },
        { name: "Settings",        href: "/settings",   icon: Settings },
        { name: "Kiosk Mode",      href: "/kiosk",      icon: Scan },
      ];
    } else if (role === "Admin") {
      return [
        { name: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
        { name: "Attendance",      href: "/attendance", icon: Clock },
        { name: "Employees",       href: "/employees",  icon: Users },
        { name: "Leave",           href: "/leaves",     icon: Calendar },
        { name: "Helpdesk",        href: "/tickets",    icon: MessageSquare },
        { name: "Reports",         href: "/reports",    icon: FileSpreadsheet },
        { name: "Settings",        href: "/settings",   icon: Settings },
        { name: "Kiosk Mode",      href: "/kiosk",      icon: Scan },
      ];
    } else if (role === "HR") {
      return [
        { name: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
        { name: "Attendance",      href: "/attendance", icon: Clock },
        { name: "Employees",       href: "/employees",  icon: Users },
        { name: "Leave",           href: "/leaves",     icon: Calendar },
        { name: "Helpdesk",        href: "/tickets",    icon: MessageSquare },
        { name: "Reports",         href: "/reports",    icon: FileSpreadsheet },
        { name: "Kiosk Mode",      href: "/kiosk",      icon: Scan },
      ];
    } else {
      return [
        { name: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
        { name: "Attendance",      href: "/dashboard?tab=attendance", icon: Clock },
        { name: "Leave",           href: "/dashboard?tab=leave",      icon: Calendar },
        { name: "Calendar",        href: "/calendar",                 icon: Calendar },
        { name: "Contact HR",      href: "/tickets",                  icon: MessageSquare },
      ];
    }
  };

  const visibleNavItems = getVisibleNavItems();

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)] text-[var(--text-primary)] font-sans relative">
      <CommandPalette />
      {/* Ambient background */}
      <div className="ambient-bg" />

      {/* ─── Desktop Sidebar ─── */}
      <aside className={`hidden md:flex flex-col ${isCollapsed ? "w-20" : "w-60"} shrink-0 border-r border-[var(--border-subtle)] relative z-10 transition-all duration-200`}>
        {/* Sidebar inner background */}
        <div className="absolute inset-0 bg-[var(--bg-surface)]/95 backdrop-blur-xl" />
        
        <div className="relative flex flex-col h-full p-4">
          {/* Logo & Toggle */}
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-1 py-3 mb-6`}>
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] overflow-hidden shrink-0">
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
                  <h1 className="font-extrabold text-[17px] tracking-tight text-[var(--text-primary)] leading-none">
                    NetraID
                  </h1>
                </div>
              </div>
            )}

            {isCollapsed && (
              <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] overflow-hidden shrink-0">
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
            )}

            {!isCollapsed && (
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-all cursor-pointer"
                title="Collapse sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <div className="flex justify-center mb-6">
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-all cursor-pointer"
                title="Expand sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-4">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isLinkActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </nav>

          {/* User Profile Footer */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-2 rounded-xl hover:bg-[var(--border-subtle)] transition-all group cursor-default`}>
              <Link href="/profile" className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center font-bold text-sm text-[var(--bg-base)] shadow-sm">
                    {initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate leading-none">
                      {user?.role?.name || "Admin"}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-1">
                      {user?.email}
                    </p>
                  </div>
                )}
              </Link>
              {!isCollapsed && (
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href="/profile"
                    title="View Profile"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-all opacity-80 hover:opacity-100 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={handleLogout}
                    title="Sign out"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-all opacity-80 hover:opacity-100 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            
            {isCollapsed && (
              <div className="flex flex-col items-center gap-2 mt-2">
                <Link
                  href="/profile"
                  title="View Profile"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-all cursor-pointer"
                >
                  <User className="w-4 h-4" />
                </Link>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Mobile Top Bar ─── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-xl no-print">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />
            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white z-20" />
            <svg viewBox="0 0 100 100" className="w-6 h-6 relative z-10 animate-fade-in" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" stroke="#334155" strokeWidth="2" strokeDasharray="8 12" className="animate-rotate-ring" />
              <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#64748b" strokeWidth="2.5" />
              <g className="animate-eye-lid">
                <circle cx="50" cy="50" r="22" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
                <circle cx="50" cy="50" r="7" fill="#22d3ee" className="animate-pupil" />
              </g>
              <line x1="15" y1="50" x2="85" y2="50" stroke="#22d3ee" strokeWidth="2" className="animate-laser" />
            </svg>
          </div>
          <span className="font-extrabold text-[17px] text-[var(--text-primary)] tracking-tight">NetraID</span>
          {currentTime && (
            <span className="text-[10px] font-mono bg-[var(--border-subtle)] px-2 py-0.5 rounded-lg text-[var(--text-secondary)] tabular-nums font-semibold">
              {currentTime.split(" ")[0]} {currentTime.split(" ")[1] || ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Theme Toggle Mobile */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ─── Mobile Drawer ─── */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 no-print ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <aside
          className={`fixed top-0 left-0 w-[280px] h-full bg-[var(--bg-surface)] shadow-2xl border-r border-[var(--border-subtle)] flex flex-col z-50 transform transition-transform duration-300 ease-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header inside Drawer */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] animate-pulse" />
                <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white z-20" />
                <svg viewBox="0 0 100 100" className="w-5 h-5 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="45" stroke="#334155" strokeWidth="2" strokeDasharray="8 12" />
                  <path d="M15 50 C 30 25, 70 25, 85 50 C 70 75, 30 75, 15 50 Z" stroke="#64748b" strokeWidth="2.5" />
                  <circle cx="50" cy="50" r="22" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
                  <circle cx="50" cy="50" r="7" fill="#22d3ee" />
                </svg>
              </div>
              <h1 className="font-extrabold text-[18px] text-[var(--text-primary)] tracking-tight">NetraID</h1>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-4 p-4">
            <div className="mb-2 px-3 text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Menu</div>
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isLinkActive(item.href)}
                isCollapsed={false}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
            
          </nav>

          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--border-subtle)]/50 border border-[var(--border-subtle)]">
              <Link href="/profile" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[var(--text-primary)] flex items-center justify-center font-bold text-sm text-[var(--bg-base)] shadow-md">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{user?.role?.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email}</p>
                </div>
              </Link>
              <Link href="/profile" onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-all">
                <User className="w-4 h-4" />
              </Link>
              <button onClick={handleLogout} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-all">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Main Content ─── */}
      <main className="flex-1 min-h-screen overflow-y-auto relative z-10 pt-14 md:pt-0">
        {/* Desktop Top Navbar */}
        <header className="hidden md:flex h-14 border-b border-[var(--border-subtle)] px-8 items-center justify-between bg-[var(--bg-surface)]/95 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex-1" />
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-mono text-[12px] text-[var(--text-secondary)] font-medium">
              <Clock className="w-4 h-4 text-cyan-500 animate-pulse" />
              <span>{currentDate}</span>
              {currentTime && (
                <>
                  <span className="text-[var(--border-subtle)] px-1">|</span>
                  <span className="tabular-nums font-bold text-[var(--text-primary)]">{currentTime}</span>
                </>
              )}
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div 
          key={pathname}
          className="max-w-7xl mx-auto px-5 py-6 md:px-8 md:py-8 page-enter"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
