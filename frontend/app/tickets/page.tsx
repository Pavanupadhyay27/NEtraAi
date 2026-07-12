"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi, getUserProfile } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  MessageSquare, Plus, Send, CheckCircle, Clock, 
  AlertTriangle, Filter, Search, ChevronRight, User, Loader2
} from "lucide-react";

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New ticket form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Payroll");
  const [priority, setPriority] = useState("Medium");
  const [initialMessage, setInitialMessage] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
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
      
      // Post the initial message if provided
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
      toast.success("Support ticket opened");
      setShowAddModal(false);
      setTitle("");
      setInitialMessage("");
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
      toast.error(err.message || "Failed to send message");
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
      toast.success(`Ticket status marked as ${data.status}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update ticket status");
    }
  });

  // Keep chat scrolled to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?.messages]);

  // Sync selected ticket details after query updates
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t: any) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets, selectedTicket]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, message: replyText });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialMessage.trim()) return;
    createTicketMutation.mutate({ title, category, priority, message: initialMessage });
  };

  const isHR = profile?.role?.name === "Admin" || profile?.role?.name === "HR" || profile?.role?.name === "Super Admin";

  return (
    <SidebarLayout>
      <div className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        
        {/* Left pane: Tickets list */}
        <div className="w-full md:w-80 border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-slate-700" />
              Helpdesk Support
            </h1>
            {!isHR && (
              <button
                onClick={() => setShowAddModal(true)}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer active:scale-95 transition-all"
                title="Create Ticket"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 border border-slate-50 rounded-xl animate-pulse space-y-2">
                  <div className="h-3 w-28 bg-slate-100 rounded" />
                  <div className="h-2 w-20 bg-slate-100 rounded" />
                </div>
              ))
            ) : tickets.length > 0 ? (
              tickets.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    selectedTicket?.id === t.id
                      ? "border-slate-300 bg-slate-50"
                      : "border-transparent hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t.category}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                      t.priority === "High" 
                        ? "bg-rose-50 border-rose-100 text-rose-600" 
                        : t.priority === "Medium"
                          ? "bg-amber-50 border-amber-100 text-amber-600"
                          : "bg-slate-50 border-slate-150 text-slate-600"
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 truncate">{t.title}</h3>
                    {isHR && t.employee && (
                      <p className="text-[10px] text-slate-450 mt-0.5">By: {t.employee.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      t.status === "Closed" ? "bg-emerald-500" : t.status === "In Progress" ? "bg-amber-500" : "bg-blue-500"
                    }`} />
                    <span className="text-[9px] font-bold text-slate-450 uppercase">{t.status}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No support tickets found.
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Message details */}
        <div className="flex-1 flex flex-col bg-slate-50/50 h-full">
          {selectedTicket ? (
            <>
              {/* Ticket header details */}
              <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{selectedTicket.category} Support Ticket</span>
                  <h2 className="text-xs font-bold text-slate-900">{selectedTicket.title}</h2>
                  {isHR && selectedTicket.employee && (
                    <p className="text-[10px] text-slate-450">Submitted by: <strong className="text-slate-700">{selectedTicket.employee.name}</strong> ({selectedTicket.employee.email})</p>
                  )}
                </div>
                
                {/* HR Status updater action */}
                {isHR ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">STATUS:</span>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => updateStatusMutation.mutate({ ticketId: selectedTicket.id, status: e.target.value })}
                      className="text-[10px] font-bold h-7 border border-slate-200 rounded-lg bg-white px-2 text-slate-800"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                ) : (
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-full ${
                    selectedTicket.status === "Closed"
                      ? "bg-emerald-50 border-emerald-150 text-emerald-700"
                      : selectedTicket.status === "In Progress"
                        ? "bg-amber-50 border-amber-150 text-amber-700"
                        : "bg-blue-50 border-blue-150 text-blue-700"
                  }`}>
                    {selectedTicket.status}
                  </span>
                )}
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {selectedTicket.messages && selectedTicket.messages.map((m: any) => {
                  const isMe = m.sender_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex items-start gap-2.5 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                      <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-1">
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMe 
                            ? "bg-slate-900 text-white rounded-tr-none" 
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                        }`}>
                          <p>{m.message}</p>
                        </div>
                        <p className={`text-[8px] text-slate-400 font-mono ${isMe ? "text-right" : ""}`}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Reply Form */}
              {selectedTicket.status !== "Closed" ? (
                <form onSubmit={handleSendReply} className="p-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Type support reply message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 text-xs h-9 border border-slate-200 px-3 rounded-xl focus:outline-none focus:border-cyan-400 text-slate-900 bg-white"
                  />
                  <button
                    type="submit"
                    disabled={replyMutation.isPending || !replyText.trim()}
                    className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {replyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
                  🔒 This support ticket is closed and resolved.
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-6">
              <MessageSquare className="w-10 h-10 text-slate-300" />
              <p className="text-xs font-medium">Select a ticket from the left panel to open chat support</p>
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeInUp p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Open Support Ticket</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Subject Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discrepancy in check-in logs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                  >
                    <option value="Payroll">Payroll</option>
                    <option value="Attendance">Attendance</option>
                    <option value="IT Support">IT Support</option>
                    <option value="Leave Requests">Leave Requests</option>
                    <option value="General Queries">General Queries</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Message Description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your issue or query here..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white text-slate-900 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                >
                  {createTicketMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Open Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
