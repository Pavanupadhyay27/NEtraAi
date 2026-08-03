"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getUserProfile, getAccessToken, getBackendUrl } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  MessageSquare, Plus, Send, CheckCircle2, Clock, 
  AlertCircle, Filter, Search, ChevronRight, User, Loader2,
  CheckCircle, Shield, Sparkles, Folder, RefreshCw, Lock, HelpCircle, 
  Building2, Briefcase, FileText, Check, CheckCheck, Info, Paperclip, MoreVertical, X, ArrowLeft
} from "lucide-react";

const avatarColors = [
  "from-blue-50 to-indigo-150 text-blue-600 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:text-blue-400 dark:border-blue-900/40",
  "from-emerald-50 to-teal-150 text-emerald-600 border-emerald-200 dark:from-emerald-950/20 dark:to-teal-950/20 dark:text-emerald-400 dark:border-emerald-900/40",
  "from-rose-50 to-orange-150 text-rose-600 border-rose-200 dark:from-rose-950/20 dark:to-orange-950/20 dark:text-rose-400 dark:border-rose-900/40",
  "from-purple-50 to-pink-150 text-purple-600 border-purple-200 dark:from-purple-950/20 dark:to-pink-950/20 dark:text-purple-400 dark:border-purple-900/40",
  "from-cyan-50 to-blue-150 text-cyan-600 border-cyan-200 dark:from-cyan-950/20 dark:to-blue-950/20 dark:text-cyan-400 dark:border-cyan-900/40",
];

function EmployeeAvatar({ 
  employee, 
  baseUrl, 
  size = "md", 
  avatarColor 
}: { 
  employee: any; 
  baseUrl: string; 
  size?: "sm" | "md" | "lg"; 
  avatarColor: string 
}) {
  const [imgError, setImgError] = useState(false);
  const displayName = employee?.name || (employee?.email ? employee.email.split("@")[0] : "?");
  const initials = displayName.charAt(0).toUpperCase();
  
  const sizeClasses = {
    sm: "w-8 h-8 rounded-lg text-[10px]",
    md: "w-10 h-10 rounded-xl text-xs",
    lg: "w-12 h-12 rounded-2xl text-sm"
  };

  const hasPhoto = employee?.images?.some((img: any) => img.pose_type.toLowerCase() === "front");

  if (hasPhoto && !imgError) {
    return (
      <img
        src={`${baseUrl}/uploads/${employee.employee_id}/front.jpg`}
        alt={employee.name}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} object-cover border border-zinc-200/50 dark:border-zinc-800 shadow-3xs`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br ${avatarColor} flex items-center justify-center border font-bold shadow-3xs uppercase`}>
      {initials}
    </div>
  );
}

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time Chat Connection & Presence States
  const [sseConnected, setSseConnected] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<"online" | "offline">("online");

  // WhatsApp-style UI Enhancements States
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);

  const handleRefreshTickets = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };
  
  // Filtering & Search states
  const [statusTab, setStatusTab] = useState<"ALL" | "UNRESOLVED" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Role-aware ticket creation states
  const [orgName, setOrgName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("System Bug / Error");
  const [customCategory, setCustomCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [initialMessage, setInitialMessage] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const usr = getUserProfile();
    setProfile(usr);
    if (usr?.company?.name) {
      setOrgName(usr.company.name);
    }
  }, []);

  const { data: tickets = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      return await fetchApi("/tickets/");
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: any) => {
      const ticket = await fetchApi("/tickets/", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          category: payload.category,
          priority: payload.priority
        })
      });
      
      if (payload.message && payload.message.trim().length > 0) {
        await fetchApi(`/tickets/${ticket.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ message: payload.message })
        });
      }
      return ticket;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Support ticket opened successfully");
      setShowAddModal(false);
      setTitle("");
      setInitialMessage("");
      setCustomCategory("");
      setSelectedTicket(data);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to open ticket");
    }
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: number; message: string }) => {
      return await fetchApi(`/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setReplyText("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send reply");
    }
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ ticketId, file }: { ticketId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return await fetchApi(`/tickets/${ticketId}/attachment`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setSelectedTicket((prev: any) => {
        if (!prev || prev.id !== data.ticket_id) return prev;
        const alreadyExists = prev.messages?.some((m: any) => m.id === data.id);
        if (alreadyExists) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), data]
        };
      });
      toast.success("Attachment uploaded successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload attachment");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      return await fetchApi(`/tickets/${ticketId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setSelectedTicket(data);
      toast.success(`Ticket status updated to ${data.status}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update ticket status");
    }
  });

  // Keep chat scrolled to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?.messages, isTyping]);

  // Sync selected ticket details after query updates - FIXED DEPENDENCY ARRAY SIZE CHANGES
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t: any) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets, selectedTicket?.id]);

  // Live SSE real-time messaging stream subscription
  useEffect(() => {
    if (!selectedTicket?.id) {
      setSseConnected(false);
      return;
    }

    const token = getAccessToken();
    const backendUrl = getBackendUrl();
    const streamUrl = `${backendUrl}/tickets/${selectedTicket.id}/stream?token=${token}`;

    const eventSource = new EventSource(streamUrl);
    setSseConnected(true);

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        setSseConnected(true);
        const data = JSON.parse(event.data);
        
        if (data.type === "typing") {
          const usr = getUserProfile();
          if (data.sender_id !== usr?.id) {
            setIsTyping(true);
            const globalObj = window as any;
            if (globalObj.typingTimeout) clearTimeout(globalObj.typingTimeout);
            globalObj.typingTimeout = setTimeout(() => {
              setIsTyping(false);
            }, 3000);
          }
          return;
        }

        setIsTyping(false);
        const newMsg = data;

        setSelectedTicket((prev: any) => {
          if (!prev || prev.id !== newMsg.ticket_id) return prev;
          
          const alreadyExists = prev.messages?.some((m: any) => m.id === newMsg.id);
          if (alreadyExists) return prev;
          
          return {
            ...prev,
            messages: [...(prev.messages || []), newMsg]
          };
        });

        // Trigger cache update
        queryClient.invalidateQueries({ queryKey: ["tickets"] });
      } catch (err) {
        console.error("SSE message parse error:", err);
      }
    };

    eventSource.onerror = (err) => {
      setSseConnected(false);
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("SSE connection closed permanently.");
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn("SSE connection lost. Reconnecting...");
      } else {
        console.error("SSE connection error:", err);
      }
    };

    return () => {
      eventSource.close();
      setSseConnected(false);
    };
  }, [selectedTicket?.id]);

  const sendTypingNotification = async () => {
    if (!selectedTicket) return;
    try {
      await fetchApi(`/tickets/${selectedTicket.id}/typing`, { method: "POST" });
    } catch (e) {
      // Ignore typing errors silently
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, message: replyText });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket) return;
    uploadAttachmentMutation.mutate({ ticketId: selectedTicket.id, file });
    if (e.target) e.target.value = "";
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialMessage.trim()) return;

    const finalCategory = category === "Other" && customCategory.trim() 
      ? customCategory.trim() 
      : category;

    const formattedTitle = orgName.trim() 
      ? `[${orgName.trim()}] ${title.trim()}` 
      : title.trim();

    createTicketMutation.mutate({ 
      title: formattedTitle, 
      category: finalCategory, 
      priority, 
      message: initialMessage 
    });
  };

  const isHR = profile?.role?.name === "Admin" || profile?.role?.name === "HR" || profile?.role?.name === "Super Admin";

  // Calculate ticket count metrics
  const totalCount = tickets.length;
  const unresolvedCount = tickets.filter((t: any) => t.status === "Open").length;
  const inProgressCount = tickets.filter((t: any) => t.status === "In Progress").length;
  const resolvedCount = tickets.filter((t: any) => t.status === "Closed").length;

  // Filter tickets according to selected tab and criteria
  const filteredTickets = tickets.filter((t: any) => {
    // 1. Status Filter Tab
    if (statusTab === "UNRESOLVED" && t.status !== "Open") return false;
    if (statusTab === "IN_PROGRESS" && t.status !== "In Progress") return false;
    if (statusTab === "RESOLVED" && t.status !== "Closed") return false;

    // 2. Category Filter
    if (selectedCategory !== "ALL" && t.category !== selectedCategory) return false;

    // 3. Priority Filter
    if (selectedPriority !== "ALL" && t.priority !== selectedPriority) return false;

    // 4. Search Text Query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchCategory = t.category?.toLowerCase().includes(q);
      const matchEmp = t.employee?.name?.toLowerCase().includes(q);
      const matchId = t.id?.toString().includes(q);
      if (!matchTitle && !matchCategory && !matchEmp && !matchId) return false;
    }

    return true;
  });

  // Filter individual messages within the active chat (WhatsApp Search Messages feature)
  const filteredMessages = selectedTicket?.messages?.filter((m: any) => {
    if (!chatSearchQuery.trim()) return true;
    return m.message.toLowerCase().includes(chatSearchQuery.toLowerCase());
  }) || [];

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "Closed":
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3 text-amber-500 animate-pulse" /> In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40">
            <AlertCircle className="w-3 h-3 text-sky-500" /> Open
          </span>
        );
    }
  };

  const getPriorityBadge = (priorityStr: string) => {
    switch (priorityStr) {
      case "High":
        return (
          <span className="text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
            High
          </span>
        );
      case "Medium":
        return (
          <span className="text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            Med
          </span>
        );
      default:
        return (
          <span className="text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-205 dark:border-zinc-700">
            Low
          </span>
        );
    }
  };

  const renderMessageTicks = (senderId: number) => {
    const isMe = senderId === profile?.id;
    if (!isMe) return null;

    if (selectedTicket?.status === "Closed") {
      return <CheckCheck className="w-3.5 h-3.5 text-sky-500 stroke-[2.5]" />;
    } else if (selectedTicket?.status === "In Progress") {
      return <CheckCheck className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 stroke-[2]" />;
    } else {
      return <Check className="w-3.5 h-3.5 text-zinc-400 stroke-[2]" />;
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-4">
        
        {/* Sleek Minimalist Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-zinc-150 dark:border-zinc-800/80 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-mono bg-cyan-50 dark:bg-cyan-950/30 px-2.5 py-1 rounded-md border border-cyan-100/60 dark:border-cyan-900/30">
                {isHR ? "Helpdesk & Support" : "Contact HR / Support"}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-zinc-50 tracking-tight mt-2.5">
              {isHR ? "Inquiries & Helpdesk" : "Contact HR"}
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {isHR 
                ? "Manage support tickets, employee questions, and biometrics resolution logs."
                : "Submit inquiries, report biometric latency, and communicate with HR administrators in real-time."
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshTickets}
              disabled={isRefreshing}
              className="p-2 bg-zinc-55/40 dark:bg-zinc-950/20 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-70"
              title="Refresh Tickets"
            >
              <RefreshCw className={`w-4 h-4 text-zinc-505 dark:text-zinc-400 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New Ticket
            </button>
          </div>
        </div>

        {/* Sleek Stats / Tab selector row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(["ALL", "UNRESOLVED", "IN_PROGRESS", "RESOLVED"] as const).map((tab) => {
            const isSelected = statusTab === tab;
            const title = 
              tab === "ALL" ? "All Tickets" :
              tab === "UNRESOLVED" ? "Unresolved" :
              tab === "IN_PROGRESS" ? "In Progress" :
              "Resolved";
            
            const count = 
              tab === "ALL" ? totalCount :
              tab === "UNRESOLVED" ? unresolvedCount :
              tab === "IN_PROGRESS" ? inProgressCount :
              resolvedCount;

            const borderLeftClass =
              tab === "ALL" ? "border-l-4 border-l-cyan-500" :
              tab === "UNRESOLVED" ? "border-l-4 border-l-amber-500" :
              tab === "IN_PROGRESS" ? "border-l-4 border-l-sky-500" :
              "border-l-4 border-l-emerald-500";

            const glowClass = isSelected
              ? (tab === "ALL" ? "ring-2 ring-cyan-500/20 border-cyan-500 bg-zinc-50/70 dark:bg-zinc-950/40" :
                 tab === "UNRESOLVED" ? "ring-2 ring-amber-500/20 border-amber-500 bg-zinc-50/70 dark:bg-zinc-950/40" :
                 tab === "IN_PROGRESS" ? "ring-2 ring-sky-500/20 border-sky-500 bg-zinc-50/70 dark:bg-zinc-950/40" :
                 "ring-2 ring-emerald-500/20 border-emerald-500 bg-zinc-50/70 dark:bg-zinc-950/40")
              : "border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/20 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-900/40";

            const colorClass =
              tab === "ALL" ? "text-slate-900 dark:text-zinc-105" :
              tab === "UNRESOLVED" ? "text-amber-500" :
              tab === "IN_PROGRESS" ? "text-sky-500 dark:text-sky-400" :
              "text-emerald-600 dark:text-emerald-400";

            return (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-[90px] transition-all cubic-bezier(0.16, 1, 0.3, 1) cursor-pointer shadow-3xs hover:-translate-y-0.5 active:translate-y-0 duration-200 ${borderLeftClass} ${glowClass}`}
              >
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono">{title}</span>
                <div className="flex items-baseline justify-between mt-auto w-full">
                  <span className={`text-2xl font-black leading-none ${colorClass}`}>{count}</span>
                  <span className="text-[9.5px] text-zinc-400 dark:text-zinc-500 font-mono font-bold">
                    {totalCount > 0 ? Math.round((count / totalCount) * 100) : 0}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Ticket Management Main Container - Split-pane view responsive control */}
        <div className="h-[calc(100vh-14.5rem)] min-h-[500px] flex flex-col md:flex-row tech-card-3d-minimal overflow-hidden shadow-none">
          
          {/* Left Panel: Ticket Directory & Categorised List (Collapsible on mobile when chat is active) */}
          <div className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 bg-white dark:bg-zinc-900 ${
            selectedTicket ? "hidden md:flex" : "flex"
          }`}>
            
            {/* Filtering & Search Bar */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2.5 bg-white dark:bg-zinc-900">
              
              {/* Text Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search tickets, ID, employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all duration-200"
                />
              </div>

              {/* Category & Priority Dropdowns */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Payroll">Payroll</option>
                  <option value="Attendance">Attendance</option>
                  <option value="IT Support">IT Support</option>
                  <option value="Leave Requests">Leave Requests</option>
                  <option value="General Queries">General Queries</option>
                </select>

                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="h-8 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

            </div>

            {/* List Feed - Renders as ultra compact sleek card list */}
            <div className="flex-1 overflow-y-auto p-2.5 bg-zinc-50/10 dark:bg-zinc-955/5 space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 animate-pulse space-y-2">
                    <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-2 w-20 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                  </div>
                ))
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map((t: any) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-2 relative overflow-hidden ${
                        isSelected
                          ? "bg-zinc-50 dark:bg-zinc-950/40 border-cyan-500/80 shadow-xs"
                          : "bg-white dark:bg-zinc-900 border-zinc-200/50 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-3xs active:translate-y-0 duration-200"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-r-md" />
                      )}

                      <div className="flex items-center justify-between w-full text-[8.5px] font-mono">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">
                          #TK-{t.id}
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider scale-90 origin-right">{t.category}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-150 truncate flex-1">
                          {t.title.split("] ").pop()}
                        </h3>
                        {getPriorityBadge(t.priority)}
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-zinc-405 dark:text-zinc-500 pt-1.5 border-t border-zinc-100/50 dark:border-zinc-800/20">
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.status === "Closed" ? "bg-emerald-500" : t.status === "In Progress" ? "bg-amber-500 animate-pulse" : "bg-sky-500"}`} />
                          <span>{t.status === "Closed" ? "Resolved" : t.status}</span>
                        </span>
                        <span className="font-mono">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "Now"}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-16 text-center space-y-2 px-4">
                  <HelpCircle className="w-8 h-8 mx-auto text-zinc-400 stroke-[1.5]" />
                  <p className="text-xs font-bold text-zinc-655 dark:text-zinc-400">No support tickets found</p>
                  <p className="text-[10px] text-zinc-405">Try adjusting your filters or open a new ticket</p>
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Detailed Conversation & Ticket Thread (Always shown on desktop, shown on mobile only when active) */}
          <div className={`flex-1 flex flex-col bg-white dark:bg-zinc-900 h-full overflow-hidden ${
            selectedTicket ? "flex" : "hidden md:flex"
          }`}>
            {selectedTicket ? (
              <div className="flex-1 flex h-full overflow-hidden">
                
                {/* Chat Section */}
                <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
                  
                  {/* Selected Ticket Header */}
                  {(() => {
                    const baseUrl = getBackendUrl().replace("/api/v1", "");
                    const avatarColor = avatarColors[selectedTicket.employee?.id % avatarColors.length] || avatarColors[0];

                    return (
                      <div className="p-3 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                        {/* Top Section / Row 1 (Mobile-friendly) */}
                        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 w-full sm:w-auto">
                          <div className="flex items-center gap-2 min-w-0">
                            <button 
                              onClick={() => setSelectedTicket(null)}
                              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-550 dark:text-zinc-455 cursor-pointer transition-all active:scale-90 duration-200"
                              title="Close Chat / Go Back"
                            >
                              <ArrowLeft className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                            </button>

                            <div className="shrink-0">
                              <EmployeeAvatar 
                                  employee={selectedTicket.employee} 
                                  baseUrl={baseUrl} 
                                  avatarColor={avatarColor} 
                                  size="md" 
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 px-1.5 py-0.25 rounded border border-cyan-150 dark:border-cyan-900/30">
                                  #TK-{selectedTicket.id}
                                </span>
                                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono">
                                  {selectedTicket.category}
                                </span>
                                {getPriorityBadge(selectedTicket.priority)}
                              </div>
                              <h2 className="text-xs font-black text-slate-900 dark:text-zinc-100 truncate max-w-[150px] sm:max-w-xs mt-0.5" title={selectedTicket.title}>
                                {selectedTicket.title.split("] ").pop()}
                              </h2>
                            </div>
                          </div>

                          {/* Mobile Actions (Search & Details Info) */}
                          <div className="flex sm:hidden items-center gap-1">
                            <button 
                              onClick={() => {
                                setShowChatSearch(!showChatSearch);
                                if (showChatSearch) setChatSearchQuery("");
                              }}
                              className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 duration-200 cursor-pointer ${showChatSearch ? "text-cyan-500 bg-cyan-500/10" : "text-zinc-500"}`}
                              title="Search messages"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                              className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 duration-200 cursor-pointer ${isRightPanelOpen ? "text-cyan-500 bg-cyan-500/10" : "text-zinc-500"}`}
                              title="Ticket Details"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Row 2 / Desktop Right: Status & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-zinc-100 dark:border-zinc-800/40 sm:border-t-0">
                          {/* Desktop-only action buttons, hidden on mobile since they are in Row 1 */}
                          <div className="hidden sm:flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setShowChatSearch(!showChatSearch);
                                if (showChatSearch) setChatSearchQuery("");
                              }}
                              className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 duration-200 cursor-pointer ${showChatSearch ? "text-cyan-500 bg-cyan-500/10" : "text-zinc-500"}`}
                              title="Search messages"
                            >
                              <Search className="w-4 h-4" />
                            </button>

                            <button 
                              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                              className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 duration-200 cursor-pointer ${isRightPanelOpen ? "text-cyan-500 bg-cyan-500/10" : "text-zinc-500"}`}
                              title="Ticket Details"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-850 px-2 py-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60 w-full sm:w-auto justify-between sm:justify-start">
                            <span className="text-[9.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono">Status:</span>
                            {isHR ? (
                              <select
                                value={selectedTicket.status}
                                onChange={(e) => updateStatusMutation.mutate({ ticketId: selectedTicket.id, status: e.target.value })}
                                className="text-[10px] font-bold h-6 border-0 bg-transparent text-zinc-850 dark:text-zinc-200 focus:outline-none cursor-pointer py-0 pr-6 pl-1"
                              >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Closed">Resolved</option>
                              </select>
                            ) : (
                              getStatusBadge(selectedTicket.status)
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Inside-chat message text search bar */}
                  {showChatSearch && (
                    <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-850/50 border-b border-zinc-150 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-405" />
                        <input
                          type="text"
                          placeholder="Search in this conversation..."
                          value={chatSearchQuery}
                          onChange={(e) => setChatSearchQuery(e.target.value)}
                          className="w-full h-8 pl-8 pr-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          setShowChatSearch(false);
                          setChatSearchQuery("");
                        }}
                        className="p-1 hover:bg-zinc-250 dark:hover:bg-zinc-700 rounded text-zinc-450"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Messages Chat Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20 dark:bg-zinc-950/20">
                    
                    <div className="p-3 rounded-xl bg-zinc-55/60 dark:bg-zinc-850/30 border border-zinc-200/50 dark:border-zinc-800/80 text-xs space-y-1">
                      <div className="flex items-center justify-between text-zinc-450 dark:text-zinc-500 font-bold text-[9.5px] font-mono">
                        <span>TICKET CREATED</span>
                        <span>{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : "Recently"}</span>
                      </div>
                      <p className="text-zinc-505 dark:text-zinc-400 text-[11px] leading-relaxed">
                        Support request registered under category <strong>{selectedTicket.category}</strong>. Real-time stream is active.
                      </p>
                    </div>

                    {(() => {
                      const baseUrl = getBackendUrl().replace("/api/v1", "");
                      return filteredMessages.map((m: any) => {
                        const isMe = m.sender_id === profile?.id;
                        const senderIsEmployee = m.sender?.email === selectedTicket.employee?.email;
                        
                        const senderProfile = senderIsEmployee 
                          ? selectedTicket.employee 
                          : (m.sender_id === profile?.id ? profile : { name: "Support Desk", email: m.sender?.email || "support@netraid.ai" });

                        const avatarColor = senderIsEmployee
                          ? (avatarColors[selectedTicket.employee?.id % avatarColors.length] || avatarColors[0])
                          : "from-zinc-700 to-zinc-900 text-zinc-300 border-zinc-700";

                        return (
                          <div key={m.id} className={`flex items-start gap-2.5 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                            <div className="shrink-0 mt-0.5">
                              <EmployeeAvatar 
                                employee={senderProfile} 
                                baseUrl={baseUrl} 
                                avatarColor={avatarColor} 
                                size="sm" 
                              />
                            </div>
                            
                            <div className="space-y-0.5">
                              <div className={`p-3 rounded-2xl text-xs leading-relaxed border shadow-3xs ${
                                isMe 
                                  ? "bg-slate-900 text-white dark:bg-cyan-950/40 dark:text-cyan-200 border-transparent dark:border-cyan-500/20 rounded-tr-none" 
                                  : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-150 border-zinc-200/50 dark:border-zinc-800 rounded-tl-none"
                              }`}>
                                {(() => {
                                  const attachmentMatch = m.message.match(/^\[ATTACHMENT:(.*?)\|(.*?)\]/);
                                  if (attachmentMatch) {
                                    const filename = attachmentMatch[1];
                                    const url = attachmentMatch[2];
                                    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(filename);
                                    const fullUrl = `${baseUrl}${url}`;
                                    
                                    if (isImage) {
                                      return (
                                        <div className="space-y-1.5 py-1">
                                          <a 
                                            href={fullUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="block overflow-hidden rounded-xl border border-zinc-200/50 dark:border-zinc-800 hover:opacity-90 transition-opacity"
                                          >
                                            <img 
                                              src={fullUrl} 
                                              alt={filename} 
                                              className="max-w-[240px] max-h-[180px] object-cover rounded-xl"
                                            />
                                          </a>
                                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium block truncate max-w-[200px]">
                                            {filename}
                                          </span>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="py-1">
                                        <a 
                                          href={fullUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                                            isMe 
                                              ? "bg-slate-800/40 dark:bg-cyan-900/20 border-slate-700/40 dark:border-cyan-800/30 hover:bg-slate-800 dark:hover:bg-cyan-900/40 text-white dark:text-cyan-100" 
                                              : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                                          }`}
                                        >
                                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shrink-0">
                                            <FileText className="w-4 h-4" />
                                          </div>
                                          <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[11.5px] font-bold truncate max-w-[130px]">
                                              {filename}
                                            </p>
                                            <p className="text-[9.5px] text-zinc-450 dark:text-zinc-400 font-medium font-mono">
                                              Download File
                                            </p>
                                          </div>
                                        </a>
                                      </div>
                                    );
                                  }
                                  return <p className="whitespace-pre-wrap font-medium">{m.message}</p>;
                                })()}
                              </div>
                              
                              <div className={`flex items-center gap-1 mt-0.5 text-[8.5px] text-zinc-405 font-mono ${isMe ? "justify-end" : "justify-start"}`}>
                                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {renderMessageTicks(m.sender_id)}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {isTyping && (
                      <div className="flex items-center gap-2 text-[10px] text-zinc-450 dark:text-zinc-500 font-bold ml-9 animate-pulse">
                        <div className="flex gap-0.5 items-center">
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span>{isHR ? (selectedTicket.employee?.name || "Employee") : "Support desk"} is typing...</span>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Reply Form & Presets */}
                  {selectedTicket.status !== "Closed" ? (
                    <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
                      
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        <span className="text-[9.5px] font-bold text-zinc-405 uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-500 animate-pulse" /> Presets:
                        </span>
                        {(isHR ? [
                          "We are reviewing your request.",
                          "Issue has been resolved.",
                          "Please provide attendance dates."
                        ] : [
                          "Thank you for the update.",
                          "I have verified the logs.",
                          "Please check my check-in record."
                        ]).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setReplyText(preset)}
                            className="px-2.5 py-1 text-[10px] font-semibold bg-zinc-55/60 dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg shrink-0 cursor-pointer transition-all border border-zinc-205 dark:border-zinc-705/60 hover:scale-[1.02] active:scale-95 duration-200"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSendReply} className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          accept="image/*,.pdf,.zip,.rar,.txt,.doc,.docx,.xls,.xlsx"
                        />
                        <button
                          type="button"
                          disabled={uploadAttachmentMutation.isPending}
                          onClick={() => {
                            fileInputRef.current?.click();
                          }}
                          className="p-2.5 text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-800 cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
                          title="Attach document/screenshot"
                        >
                          {uploadAttachmentMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                          ) : (
                            <Paperclip className="w-4 h-4" />
                          )}
                        </button>
                        
                        <input
                          type="text"
                          placeholder="Write support reply..."
                          value={replyText}
                          onChange={(e) => {
                            setReplyText(e.target.value);
                            const globalObj = window as any;
                            const now = Date.now();
                            if (!globalObj.lastTypingSent || now - globalObj.lastTypingSent > 2000) {
                              globalObj.lastTypingSent = now;
                              sendTypingNotification();
                            }
                          }}
                          className="flex-1 text-xs h-10 border border-zinc-200 dark:border-zinc-800 px-3.5 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 text-zinc-900 dark:text-zinc-100 bg-zinc-50/50 dark:bg-zinc-950 transition-all duration-200"
                        />
                        <button
                          type="submit"
                          disabled={replyMutation.isPending || !replyText.trim()}
                          className="h-10 px-4 sm:px-5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-955 font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-xs duration-200"
                        >
                          {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </form>

                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/10 border-t border-emerald-500/20 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2 shrink-0">
                      <Lock className="w-4 h-4" />
                      This support ticket is resolved and marked as closed.
                    </div>
                  )}

                </div>

                {/* WhatsApp-style Contact Details Panel */}
                {isRightPanelOpen && (() => {
                  const baseUrl = getBackendUrl().replace("/api/v1", "");
                  const avatarColor = avatarColors[selectedTicket.employee?.id % avatarColors.length] || avatarColors[0];

                  return (
                    <div className="w-64 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col shrink-0 overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                      
                      <div className="text-center pb-4 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
                        <div className="flex justify-center">
                          <EmployeeAvatar 
                            employee={selectedTicket.employee} 
                            baseUrl={baseUrl} 
                            avatarColor={avatarColor} 
                            size="lg" 
                          />
                        </div>
                        <div className="mt-2">
                          <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                            {selectedTicket.employee?.name || "Support Client"}
                          </h3>
                          <p className="text-[10px] text-zinc-405">
                            {selectedTicket.employee?.email || "No email linked"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3.5 text-[11px]">
                        
                        <div>
                          <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Ticket ID</span>
                          <span className="font-mono text-zinc-850 dark:text-zinc-200 bg-zinc-200/50 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            #TK-{selectedTicket.id}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Issue Status</span>
                          {getStatusBadge(selectedTicket.status)}
                        </div>

                        <div>
                          <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Issue Category</span>
                          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-305 font-bold">
                            <Folder className="w-3.5 h-3.5 text-zinc-450" />
                            <span>{selectedTicket.category}</span>
                          </div>
                        </div>

                        <div>
                          <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Priority</span>
                          {getPriorityBadge(selectedTicket.priority)}
                        </div>

                        <div>
                          <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Date Created</span>
                          <div className="flex items-center gap-1 text-zinc-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : "Recently"}</span>
                          </div>
                        </div>

                        {selectedTicket.employee?.company && (
                          <div>
                            <span className="block text-[9px] font-bold text-zinc-405 uppercase tracking-wider mb-1">Organization</span>
                            <div className="flex items-center gap-1 text-zinc-650 dark:text-zinc-355 font-bold">
                              <Building2 className="w-3.5 h-3.5 text-zinc-450" />
                              <span>{selectedTicket.employee.company.name}</span>
                            </div>
                          </div>
                        )}

                      </div>

                    </div>
                  );
                })()}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3 p-6 text-center bg-zinc-50/20 dark:bg-zinc-955/5">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  <MessageSquare className="w-8 h-8 text-cyan-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-750 dark:text-zinc-300">No Ticket Selected</h3>
                  <p className="text-xs text-zinc-405 max-w-xs">
                    Select a support ticket from the list to view conversation log and reply.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Dynamic Role-Aware Support Ticket Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs px-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeInUp p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-500" />
                  {isHR ? "Admin & Organization Ticket Portal" : "Submit Support Inquiry"}
                </h2>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {isHR ? "Raise system or organization level issues for platform support" : "Describe your grievance or inquiry for prompt resolution"}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              
              {isHR && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-405 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-cyan-500" /> Organization / Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NetraID Global Corp (or Main HQ)"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100 font-semibold transition-all duration-200"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-405 dark:text-zinc-500 uppercase tracking-wider">
                  Grievance Title / Problem Summary
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biometric verification latency on Kiosk #3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-405 dark:text-zinc-500 uppercase tracking-wider">
                    Grievance Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-205 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 bg-zinc-55/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer transition-all duration-200"
                  >
                    <option value="Attendance Correction / Missed Punch">Attendance Correction / Missed Punch</option>
                    <option value="Salary / Payroll Discrepancy">Salary / Payroll Discrepancy</option>
                    <option value="Leave / Shift Schedule Issue">Leave / Shift Schedule Issue</option>
                    <option value="Biometric Scan Failed">Biometric Scan Failed</option>
                    <option value="App Bug / Technical Issue">App Bug / Technical Issue</option>
                    <option value="Other">Other (Custom Grievance)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-405 dark:text-zinc-500 uppercase tracking-wider">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-205 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 bg-zinc-55/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer transition-all duration-200"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical / Urgent</option>
                  </select>
                </div>

              </div>

              {category === "Other" && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                    Specify Custom Grievance Category
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Describe specific grievance category..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-amber-300 dark:border-amber-500/50 focus:outline-none focus:border-amber-505 bg-amber-500/5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-405 dark:text-zinc-500 uppercase tracking-wider">
                  Detailed Grievance Description
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide full context, error codes, logs, or specific issues experienced..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 resize-none transition-all duration-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95 transition-all duration-200"
                >
                  {createTicketMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Grievance Ticket
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </SidebarLayout>
  );
}
