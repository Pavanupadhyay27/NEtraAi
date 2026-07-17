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
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
      }, 2500);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send reply");
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
        const newMsg = JSON.parse(event.data);
        setIsTyping(false);

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
      console.error("SSE connection closed or error encountered:", err);
      setSseConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setSseConnected(false);
    };
  }, [selectedTicket?.id]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, message: replyText });
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
        
        {/* Top Header Block & Overview Counters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
                <MessageSquare className="w-5 h-5 text-cyan-500" />
              </div>
              Helpdesk & Support Desk
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">
              Manage categorized support tickets, employee inquiries, and resolution workflows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshTickets}
              disabled={isRefreshing}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-655 dark:text-zinc-300 rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-70"
              title="Refresh Tickets"
            >
              <RefreshCw 
                className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 inline-block ${isRefreshing ? "animate-spin" : ""}`} 
              />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New Support Ticket
            </button>
          </div>
        </div>

        {/* Categorization Counter Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          
          <button
            onClick={() => setStatusTab("ALL")}
            className={`p-3.5 rounded-xl text-left cursor-pointer transition-none ${
              statusTab === "ALL" 
                ? "tech-card-3d-minimal font-extrabold" 
                : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            }`}
          >
            <div className={`flex justify-between items-center mb-1 ${statusTab === "ALL" ? "text-zinc-900 dark:text-zinc-100 font-bold" : "text-zinc-400 dark:text-zinc-500"}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider">All Tickets</span>
              <Folder className="w-3.5 h-3.5" />
            </div>
            <p className={`text-2xl font-black tracking-tight ${statusTab === "ALL" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-650 dark:text-zinc-455"}`}>
              {totalCount}
            </p>
          </button>

          <button
            onClick={() => setStatusTab("UNRESOLVED")}
            className={`p-3.5 rounded-xl text-left cursor-pointer transition-none ${
              statusTab === "UNRESOLVED" 
                ? "tech-card-3d-minimal font-extrabold" 
                : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            }`}
          >
            <div className={`flex justify-between items-center mb-1 ${statusTab === "UNRESOLVED" ? "text-zinc-900 dark:text-zinc-100 font-bold" : "text-zinc-400 dark:text-zinc-500"}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Unresolved / Open</span>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <p className={`text-2xl font-black tracking-tight ${statusTab === "UNRESOLVED" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-650 dark:text-zinc-455"}`}>
              {unresolvedCount}
            </p>
          </button>

          <button
            onClick={() => setStatusTab("IN_PROGRESS")}
            className={`p-3.5 rounded-xl text-left cursor-pointer transition-none ${
              statusTab === "IN_PROGRESS" 
                ? "tech-card-3d-minimal font-extrabold" 
                : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            }`}
          >
            <div className={`flex justify-between items-center mb-1 ${statusTab === "IN_PROGRESS" ? "text-zinc-900 dark:text-zinc-100 font-bold" : "text-zinc-400 dark:text-zinc-500"}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider">In Progress</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <p className={`text-2xl font-black tracking-tight ${statusTab === "IN_PROGRESS" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-650 dark:text-zinc-455"}`}>
              {inProgressCount}
            </p>
          </button>

          <button
            onClick={() => setStatusTab("RESOLVED")}
            className={`p-3.5 rounded-xl text-left cursor-pointer transition-none ${
              statusTab === "RESOLVED" 
                ? "tech-card-3d-minimal font-extrabold" 
                : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            }`}
          >
            <div className={`flex justify-between items-center mb-1 ${statusTab === "RESOLVED" ? "text-zinc-900 dark:text-zinc-100 font-bold" : "text-zinc-400 dark:text-zinc-500"}`}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Resolved / Closed</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <p className={`text-2xl font-black tracking-tight ${statusTab === "RESOLVED" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-650 dark:text-zinc-450"}`}>
              {resolvedCount}
            </p>
          </button>

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
                  className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500"
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
                  className="h-8 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

            </div>

            {/* List Feed - Renders as ultra compact sleek card list */}
            <div className="flex-1 overflow-y-auto p-2 bg-zinc-50/10 dark:bg-zinc-955/5 space-y-1.5">
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
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 relative overflow-hidden ${
                        isSelected
                          ? "bg-white dark:bg-zinc-900 border-cyan-500 shadow-sm ring-1 ring-cyan-500/20"
                          : "bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                      )}

                      <div className="flex items-center justify-between w-full text-[9px] font-mono">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">
                          #TK-{t.id}
                        </span>
                        <span className="text-zinc-400 font-bold uppercase tracking-wider scale-95 origin-right">{t.category}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex-1">
                          {t.title}
                        </h3>
                        {getPriorityBadge(t.priority)}
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-zinc-400 pt-1 border-t border-zinc-100/50 dark:border-zinc-800/20">
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.status === "Closed" ? "bg-emerald-500" : t.status === "In Progress" ? "bg-amber-500 animate-pulse" : "bg-sky-500"}`} />
                          <span>{t.status}</span>
                        </span>
                        <span>
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
                  <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                    <div className="space-y-0.5">
                      
                      {/* Back button (always visible to allow deselecting / returning to list) */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedTicket(null)}
                          className="mr-1 p-1 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-lg text-zinc-550 dark:text-zinc-450 cursor-pointer transition-transform active:scale-90"
                          title="Close Chat / Go Back"
                        >
                          <ArrowLeft className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800/40">
                            #TK-{selectedTicket.id}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">
                            {selectedTicket.category} Support
                          </span>
                          {getPriorityBadge(selectedTicket.priority)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pl-7">
                        <h2 className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] md:max-w-xs" title={selectedTicket.title}>
                          {selectedTicket.title}
                        </h2>
                        <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-450"}`} />
                      </div>
                    </div>
                    
                    {/* Status & Options Action Strip */}
                    <div className="flex items-center gap-2.5 self-end sm:self-auto pl-7">
                      
                      <button 
                        onClick={() => {
                          setShowChatSearch(!showChatSearch);
                          if (showChatSearch) setChatSearchQuery("");
                        }}
                        className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${showChatSearch ? "text-cyan-500 bg-cyan-500/10" : "text-zinc-500"}`}
                        title="Search messages"
                      >
                        <Search className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                        className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${isRightPanelOpen ? "text-cyan-500 bg-cyan-500/10" : "text-zinc-500"}`}
                        title="Ticket Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-850 px-2 py-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                        <span className="text-[10px] font-bold text-zinc-405 px-0.5 uppercase">Status:</span>
                        {isHR ? (
                          <select
                            value={selectedTicket.status}
                            onChange={(e) => updateStatusMutation.mutate({ ticketId: selectedTicket.id, status: e.target.value })}
                            className="text-[10px] font-bold h-6.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 px-1 text-zinc-900 dark:text-zinc-100 focus:outline-none"
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

                  {/* Inside-chat message text search bar */}
                  {showChatSearch && (
                    <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-850/50 border-b border-zinc-150 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
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
                  <div 
                    className="flex-1 overflow-y-auto p-4 space-y-4 relative"
                    style={{
                      backgroundImage: `radial-gradient(var(--bg-elevated) 0.8px, transparent 0.8px)`,
                      backgroundSize: '16px 16px',
                    }}
                  >
                    
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-850/70 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 font-bold text-[10px]">
                        <span>TICKET CREATED</span>
                        <span>{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : "Recently"}</span>
                      </div>
                      <p className="text-zinc-655 dark:text-zinc-355 text-[11px]">
                        Support request registered under category <strong>{selectedTicket.category}</strong>. Real-time stream is active.
                      </p>
                    </div>

                    {filteredMessages.map((m: any) => {
                      const isMe = m.sender_id === profile?.id;
                      return (
                        <div key={m.id} className={`flex items-start gap-2 max-w-[80%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                            isMe 
                              ? "bg-cyan-500 text-slate-950 border-cyan-400" 
                              : "bg-zinc-850 text-white border-zinc-700"
                          }`}>
                            {isMe ? <User className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5 text-cyan-400" />}
                          </div>
                          
                          <div className="space-y-0.5">
                            <div className={`p-3 rounded-2xl text-xs leading-relaxed border relative ${
                              isMe 
                                ? "bg-cyan-500/10 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-900/60 rounded-tr-none" 
                                : "bg-slate-50 text-slate-900 dark:bg-zinc-900/90 dark:text-zinc-100 border-slate-200/80 dark:border-zinc-800/80 rounded-tl-none"
                            }`}>
                              <p className="whitespace-pre-wrap font-medium">{m.message}</p>
                            </div>
                            
                            <div className={`flex items-center gap-1 mt-0.5 text-[8.5px] text-zinc-450 font-mono ${isMe ? "justify-end" : "justify-start"}`}>
                              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {renderMessageTicks(m.sender_id)}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isTyping && (
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold ml-9">
                        <div className="flex gap-0.5 items-center">
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span>Support desk typing...</span>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Reply Form & Presets */}
                  {selectedTicket.status !== "Closed" ? (
                    <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
                      
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        <span className="text-[9.5px] font-bold text-zinc-405 uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-500" /> Presets:
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
                            className="px-2.5 py-1 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg shrink-0 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-700/60"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSendReply} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            toast.info("Attachment uploading is available in Enterprise edition.");
                          }}
                          className="p-2.5 text-zinc-400 hover:text-cyan-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-750 cursor-pointer flex items-center justify-center shrink-0"
                          title="Attach document/screenshot"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        
                        <input
                          type="text"
                          placeholder="Write support reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 text-xs h-10 border border-zinc-200 dark:border-zinc-700/80 px-3.5 rounded-xl focus:outline-none focus:border-cyan-500 text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-955"
                        />
                        <button
                          type="submit"
                          disabled={replyMutation.isPending || !replyText.trim()}
                          className="h-10 px-5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Send
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
                {isRightPanelOpen && (
                  <div className="w-64 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col shrink-0 overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                    
                    <div className="text-center pb-4 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex items-center justify-center text-2xl font-bold">
                        {selectedTicket.employee?.name ? selectedTicket.employee.name.charAt(0).toUpperCase() : "#"}
                      </div>
                      <div>
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
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-200/50 dark:bg-zinc-800 px-2 py-0.5 rounded">
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
                )}

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
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-405 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-cyan-500" /> Organization / Company Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. NetraID Global Corp (or Main HQ)"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-405 uppercase tracking-wider">
                  Grievance Title / Problem Summary
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biometric verification latency on Kiosk #3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-250 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-405 uppercase tracking-wider">
                    Grievance Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-850 focus:outline-none focus:border-cyan-500 bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer"
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
                  <label className="text-[10px] font-bold text-zinc-405 uppercase tracking-wider">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-850 focus:outline-none focus:border-cyan-500 bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer"
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
                <label className="text-[10px] font-bold text-zinc-405 uppercase tracking-wider">
                  Detailed Grievance Description
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide full context, error codes, logs, or specific issues experienced..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-cyan-500 bg-zinc-50 dark:bg-zinc-955 text-zinc-900 dark:text-zinc-100 resize-none"
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
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
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
