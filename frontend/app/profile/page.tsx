"use client";

import React, { useEffect, useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { getUserProfile } from "@/app/utils/api";
import { 
  User, Shield, Mail, Key, Clock, ShieldCheck
} from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getUserProfile());
  }, []);

  return (
    <SidebarLayout>
      <div className="space-y-6 page-enter">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-150">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-700" />
              Platform Profile
            </h1>
            <p className="text-slate-450 text-[11px]">
              View your platform account information, roles, and security details
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="max-w-2xl border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div className="bg-zinc-50/80 px-6 py-8 border-b border-zinc-150 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white font-black text-2xl flex items-center justify-center shadow-md">
              {user?.email ? user.email[0].toUpperCase() : "U"}
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-zinc-800">{user?.email || "user@netraid.ai"}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-150 text-cyan-700 uppercase">
                <ShieldCheck className="w-3 h-3" />
                {user?.role?.name || "Member"}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Account Email</span>
                <div className="flex items-center gap-2 text-zinc-700 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <span>{user?.email || "user@netraid.ai"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Access Role</span>
                <div className="flex items-center gap-2 text-zinc-700 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
                  <Shield className="w-4 h-4 text-zinc-400" />
                  <span>{user?.role?.name || "Member"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">System Company</span>
                <div className="flex items-center gap-2 text-zinc-700 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
                  <Key className="w-4 h-4 text-zinc-400" />
                  <span>{user?.company?.name || "Global Platform Administrator"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Last Active</span>
                <div className="flex items-center gap-2 text-zinc-700 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span>Just now (active session)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
