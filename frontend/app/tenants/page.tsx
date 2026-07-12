"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SidebarLayout from "@/components/SidebarLayout";
import { fetchApi } from "@/app/utils/api";
import { useToast } from "@/app/utils/toast";
import { 
  Building2, Plus, Edit2, ShieldAlert, CheckCircle2, 
  Search, Shield, AlertTriangle, Users, Database, MapPin, Phone, Mail, Loader2
} from "lucide-react";

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  // Form states
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [maxEmployees, setMaxEmployees] = useState(100);
  const [availableTokens, setAvailableTokens] = useState(1000);
  const [status, setStatus] = useState("Active");

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      return await fetchApi("/companies/");
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await fetchApi("/companies/", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Organization onboarded successfully");
      setShowAddModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to onboard organization");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return await fetchApi(`/companies/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Organization details updated");
      setShowEditModal(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update organization");
    }
  });

  const resetForm = () => {
    setName("");
    setAdminEmail("");
    setPhone("");
    setAddress("");
    setMaxEmployees(100);
    setAvailableTokens(1000);
    setStatus("Active");
  };

  const handleOpenEdit = (tenant: any) => {
    setSelectedTenant(tenant);
    setName(tenant.name);
    setAdminEmail(tenant.admin_email || "");
    setPhone(tenant.phone || "");
    setAddress(tenant.address || "");
    setMaxEmployees(tenant.max_employees || 100);
    setAvailableTokens(tenant.available_tokens || 1000);
    setStatus(tenant.status || "Active");
    setShowEditModal(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      admin_email: adminEmail,
      phone,
      address,
      max_employees: Number(maxEmployees),
      available_tokens: Number(availableTokens),
      status
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    updateMutation.mutate({
      id: selectedTenant.id,
      payload: {
        name,
        admin_email: adminEmail,
        phone,
        address,
        max_employees: Number(maxEmployees),
        available_tokens: Number(availableTokens),
        status
      }
    });
  };

  const filteredTenants = tenants.filter((t: any) => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.admin_email && t.admin_email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-700" />
              Organizations
            </h1>
            <p className="text-slate-450 text-[11px]">
              Onboard, monitor, suspend, and configure client company accounts
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Onboard Company
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by company name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs h-10 pl-9 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white"
          />
        </div>

        {/* Organizations grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-slate-100 rounded-2xl p-5 bg-white space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-28 bg-slate-100 rounded" />
                    <div className="h-2.5 w-16 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-10 bg-slate-50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredTenants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTenants.map((t: any) => (
              <div 
                key={t.id}
                className="border border-slate-200 rounded-2xl p-5 bg-white hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  t.status === "Active" ? "bg-emerald-500" : t.status === "Suspended" ? "bg-amber-500" : "bg-rose-500"
                }`} />

                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{t.name}</h3>
                        <span className={`inline-flex items-center text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border mt-1 ${
                          t.status === "Active" 
                            ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                            : t.status === "Suspended" 
                              ? "bg-amber-50 border-amber-150 text-amber-700" 
                              : "bg-rose-50 border-rose-150 text-rose-700"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-[10px] text-slate-450 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{t.admin_email || "No email"}</span>
                    </div>
                    {t.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{t.phone}</span>
                      </div>
                    )}
                    {t.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{t.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tokens and employees metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="space-y-0.5 text-center">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                      <Users className="w-2.5 h-2.5" /> Max Users
                    </span>
                    <p className="text-xs font-black text-slate-800">{t.max_employees}</p>
                  </div>
                  <div className="space-y-0.5 text-center border-l border-slate-200">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                      <Database className="w-2.5 h-2.5" /> Tokens Left
                    </span>
                    <p className="text-xs font-black text-slate-800">{t.available_tokens}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center text-slate-400 text-xs font-semibold">
            No organizations found matching search criteria.
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeInUp p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Onboard New Organization</h2>
              <form onSubmit={handleAddSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Max Employees</label>
                    <input
                      type="number"
                      required
                      value={maxEmployees}
                      onChange={(e) => setMaxEmployees(Number(e.target.value))}
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Seeded Tokens</label>
                    <input
                      type="number"
                      required
                      value={availableTokens}
                      onChange={(e) => setAvailableTokens(Number(e.target.value))}
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
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
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeInUp p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Edit Organization: {selectedTenant?.name}</h2>
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Company Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Deauthorized">Deauthorized</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Max Employees</label>
                    <input
                      type="number"
                      required
                      value={maxEmployees}
                      onChange={(e) => setMaxEmployees(Number(e.target.value))}
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Available Tokens</label>
                    <input
                      type="number"
                      required
                      value={availableTokens}
                      onChange={(e) => setAvailableTokens(Number(e.target.value))}
                      className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    {updateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
