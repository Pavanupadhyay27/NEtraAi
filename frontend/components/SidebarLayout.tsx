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
  Moon
} from "lucide-react";
import { getAccessToken, getUserProfile, clearTokens } from "@/app/utils/api";

const navItems = [
  { name: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
  { name: "Attendance",      href: "/attendance", icon: Clock },
  { name: "Employees",       href: "/employees",  icon: Users },
  { name: "Reports",         href: "/reports",    icon: FileSpreadsheet },
  { name: "Audit Logs",      href: "/audit",      icon: History },
  { name: "Settings",        href: "/settings",   icon: Settings },
];

function NavLink({ 
  item, 
  isActive, 
  isCollapsed, 
  onClick 
}: { 
  item: typeof navItems[0], 
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
      className={`group relative flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-xl transition-all duration-200 ${
        isActive
          ? "bg-[var(--border-subtle)] text-[var(--text-primary)] font-semibold"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]"
      }`}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[var(--text-primary)]" />
      )}

      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
        isActive
          ? "bg-[var(--text-primary)] text-[var(--bg-base)]"
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

      {isActive && !isCollapsed && <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
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
    }
  }, [router]);

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

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)] text-[var(--text-primary)] font-sans relative">
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
          <nav className="flex-1 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                isCollapsed={isCollapsed}
              />
            ))}

            {/* Separator */}
            <div className="my-3 border-t border-[var(--border-subtle)]" />

            {/* Kiosk Launch */}
            <a
              href="/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              data-tooltip={isCollapsed ? "Launch Kiosk" : undefined}
              className={`group flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-all duration-200`}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--border-subtle)] flex items-center justify-center group-hover:bg-[var(--text-primary)] transition-all">
                <Monitor className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--bg-base)]" />
              </div>
              {!isCollapsed && (
                <>
                  <div className="flex-1">
                    <p className="text-sm">Launch Kiosk</p>
                  </div>
                  <span className="text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--border-subtle)] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">
                    Live
                  </span>
                </>
              )}
            </a>

            {/* Admin Log Out */}
            <button
              onClick={handleLogout}
              data-tooltip={isCollapsed ? "Admin Log Out" : undefined}
              className={`group flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-all duration-200 w-full text-left cursor-pointer`}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--border-subtle)] flex items-center justify-center group-hover:bg-rose-600 transition-all">
                <LogOut className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white" />
              </div>
              {!isCollapsed && (
                <div className="flex-1">
                  <p className="text-sm font-medium">Admin Log Out</p>
                </div>
              )}
            </button>
          </nav>

          {/* User Profile Footer */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-2 rounded-xl hover:bg-[var(--border-subtle)] transition-all group cursor-default`}>
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center font-bold text-sm text-[var(--bg-base)] shadow-sm">
                  {initials}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate leading-none">
                      {user?.role?.name || "Admin"}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-1">
                      {user?.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign out"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            
            {isCollapsed && (
              <div className="flex justify-center mt-2">
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
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-xl">
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
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] p-4 flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-1 py-3 mb-6 mt-14">
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
              <h1 className="font-extrabold text-[17px] text-[var(--text-primary)] tracking-tight">NetraID</h1>
            </div>

            <nav className="flex-1 space-y-0.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                  isCollapsed={false}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
              <div className="my-3 border-t border-[var(--border-subtle)]" />
              <a
                href="/kiosk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-all"
              >
                <Monitor className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm">Launch Kiosk</span>
              </a>
            </nav>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center font-bold text-sm text-[var(--bg-base)]">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user?.role?.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 min-h-screen overflow-y-auto relative z-10 pt-14 md:pt-0">
        {/* Desktop Top Navbar */}
        <header className="hidden md:flex h-14 border-b border-[var(--border-subtle)] px-8 items-center justify-end bg-[var(--bg-surface)]/95 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-5 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
