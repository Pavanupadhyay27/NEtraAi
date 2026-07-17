"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Calendar, Users, Building, Shield, 
  MessageSquare, FileText, Settings, Sparkles, Sun, Moon 
} from "lucide-react";

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const items = [
    { name: "Go to Dashboard",   icon: Sparkles,      action: () => router.push("/dashboard") },
    { name: "Manage Organizations", icon: Building,  action: () => router.push("/tenants") },
    { name: "Check Attendance Logs", icon: Calendar,  action: () => router.push("/attendance") },
    { name: "View Employees",    icon: Users,         action: () => router.push("/employees") },
    { name: "Helpdesk Support",  icon: MessageSquare, action: () => router.push("/tickets") },
    { name: "Generate Reports",  icon: FileText,      action: () => router.push("/reports") },
    { name: "System Settings",   icon: Settings,      action: () => router.push("/settings") },
  ];

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-md pt-[15vh] px-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-white/95 border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[60vh]">
        
        {/* Search bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 shrink-0">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs h-6 text-slate-800 focus:outline-none placeholder-slate-400"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => { item.action(); setIsOpen(false); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-colors text-xs font-semibold"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  {item.name}
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
              No matching commands or navigation routes found.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          <span>Navigate using shortcuts</span>
          <span>NetraID Enterprise Command Palette</span>
        </div>

      </div>
    </div>
  );
}
