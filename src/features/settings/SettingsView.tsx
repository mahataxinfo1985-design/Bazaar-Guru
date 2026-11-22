import React, { useState, useEffect } from 'react';
import {
  Building2,
  Calendar,
  FileText,
  Receipt,
  Boxes,
  CreditCard,
  Users,
  Bell,
  Shield,
  Database,
  Upload,
  Download,
  Trash2,
  LogOut,
  Key,
  Check,
  AlertTriangle,
  Clock,
  Plus,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Lock,
  Unlock,
  Printer,
  QrCode,
  Info,
  ExternalLink,
  Save,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { BusinessProfile } from '../../types';
import { INDIAN_STATES } from '../../utils/gstEngine';
import {
  CompleteBusinessSettings,
  DEFAULT_COMPLETE_SETTINGS,
  TeamMemberSetting
} from '../../types/settings';
import {
  loadCompleteSettings,
  saveCompleteSettings,
  exportInvoicesToCSV,
  exportPartiesToCSV,
  exportInventoryToCSV,
  exportAccountsToCSV
} from '../../services/settings/settingsService';
import {
  exportBusinessBackup,
  previewBackup,
  restoreBusinessBackup
} from '../../services/storage/backupRestore';
import { idbClear, idbGetAll } from '../../services/storage/idb';
import { supabase } from '../../lib/supabase';
import { ROLE_PERMISSIONS } from '../../services/auth/rbacService';
import { BusinessAuditEvent } from '../../types/workspace';

interface SettingsViewProps {
  businessProfile: BusinessProfile;
  onUpdateProfile: (profile: BusinessProfile) => void;
  onRestoreSuccess: () => void;
}

type SettingsTab =
  | 'profile'
  | 'financial'
  | 'invoicedocs'
  | 'taxgst'
  | 'inventory'
  | 'payments'
  | 'team'
  | 'notifications'
  | 'security'
  | 'backup';

export default function SettingsView({
  businessProfile,
  onUpdateProfile,
  onRestoreSuccess
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<CompleteBusinessSettings>(DEFAULT_COMPLETE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Authentication & session
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<string | null>(null);

  // Backup & Restore states
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<any | null>(null);
  const [restoreFileRaw, setRestoreFileRaw] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Local DB Reset confirmation
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');

  // Add Team Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState<{ name: string; email: string; role: any }>({
    name: '',
    email: '',
    role: 'sales_staff'
  });

  // Audit events for Security tab
  const [recentAudits, setRecentAudits] = useState<BusinessAuditEvent[]>([]);

  // 1. Initial Load & Synchronization
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const loaded = await loadCompleteSettings(businessProfile);
        if (isMounted) {
          setSettings(loaded);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed loading settings', err);
        if (isMounted) setLoading(false);
      }
    })();

    // Supabase auth subscription
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) setUserEmail(session?.user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [businessProfile]);

  // Load audit trail when security tab opens
  useEffect(() => {
    if (activeTab === 'security') {
      idbGetAll('audit_events')
        .then((events) => {
          const sorted = (events || []).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setRecentAudits(sorted.slice(0, 8));
        })
        .catch(() => setRecentAudits([]));
    }
  }, [activeTab]);

  // Handle Save
  const handleSaveAll = async () => {
    try {
      const updatedProfile = await saveCompleteSettings(settings);
      onUpdateProfile(updatedProfile);
      setSaveSuccessMessage('Settings successfully saved and synchronized!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out from Bazaar-Guru cloud?')) {
      await supabase.auth.signOut();
      setUserEmail(null);
      alert('You have successfully signed out.');
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordChangeStatus('Password updated successfully!');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordChangeStatus(null);
        setNewPassword('');
      }, 1500);
    } catch (err: any) {
      alert(`Failed to update password: ${err.message}`);
    }
  };

  // Upload Logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({
          ...prev,
          branding: { ...prev.branding, logoUrl: reader.result as string }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload Signature
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({
          ...prev,
          branding: { ...prev.branding, signatureUrl: reader.result as string }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // State code auto-detection from GSTIN
  const handleGstinChange = (gstinInput: string) => {
    const upper = gstinInput.toUpperCase().trim();
    let stateDetected = settings.contact.state;
    if (upper.length >= 2) {
      const stateCode = upper.substring(0, 2);
      const codeMap: Record<string, string> = {
        '27': 'Maharashtra', '29': 'Karnataka', '07': 'Delhi', '33': 'Tamil Nadu',
        '24': 'Gujarat', '09': 'Uttar Pradesh', '19': 'West Bengal', '36': 'Telangana',
        '37': 'Andhra Pradesh', '08': 'Rajasthan', '23': 'Madhya Pradesh', '06': 'Haryana',
        '03': 'Punjab', '32': 'Kerala', '21': 'Odisha', '10': 'Bihar', '20': 'Jharkhand',
        '22': 'Chhattisgarh', '30': 'Goa', '05': 'Uttarakhand', '02': 'Himachal Pradesh',
        '01': 'Jammu and Kashmir', '18': 'Assam'
      };
      if (codeMap[stateCode]) {
        stateDetected = codeMap[stateCode];
      }
    }
    const panExtracted = upper.length >= 12 ? upper.substring(2, 12) : settings.identity.pan;

    setSettings((prev) => ({
      ...prev,
      identity: {
        ...prev.identity,
        gstin: upper,
        pan: panExtracted
      },
      contact: {
        ...prev.contact,
        state: stateDetected
      }
    }));
  };

  // Restore file selection with manifest preview
  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      setRestoreFileRaw(content);
      const previewRes = await previewBackup(content);
      setRestorePreviewData(previewRes);
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFileRaw) return;
    setIsRestoring(true);
    const res = await restoreBusinessBackup(restoreFileRaw);
    setIsRestoring(false);
    if (res.success) {
      setRestoreMessage(res.message);
      setRestorePreviewData(null);
      setRestoreFileRaw(null);
      onRestoreSuccess();
    } else {
      alert(res.message);
    }
  };

  // Reset database handler
  const handleExecuteReset = async () => {
    const requiredConfirmation = settings.identity.tradeName?.trim() || 'RESET';
    if (resetConfirmationInput.trim() !== requiredConfirmation) {
      alert(`Confirmation does not match "${requiredConfirmation}". Reset cancelled.`);
      return;
    }
    try {
      const stores = [
        'invoices', 'parties', 'items', 'warehouses', 'stock_movements',
        'stock_transfers', 'stock_adjustments', 'product_batches', 'accounts',
        'journal_entries', 'bank_accounts', 'cash_accounts', 'payment_vouchers',
        'cheque_records', 'sync_outbox', 'sync_conflicts', 'audit_events',
        'quotations', 'sales_orders', 'delivery_challans', 'purchase_orders',
        'goods_receipt_notes', 'business_documents', 'notifications'
      ];
      for (const st of stores) {
        await idbClear(st as any).catch(() => {});
      }
      localStorage.removeItem('invoice_pro_profile');
      localStorage.removeItem('invoice_pro_parties');
      localStorage.removeItem('invoice_pro_items');
      localStorage.removeItem('invoice_pro_invoices');
      localStorage.removeItem('bazaar_guru_complete_settings_v1');
      localStorage.removeItem('bazaar_guru_dismissed_notifications_v1');
      setIsResetModalOpen(false);
      alert('Local database and cache successfully reset.');
      window.location.reload();
    } catch (err: any) {
      alert(`Error during reset: ${err.message}`);
    }
  };

  // Add team member handler
  const handleAddTeamMember = () => {
    if (!newMember.name || !newMember.email) {
      alert('Name and Email are required.');
      return;
    }
    const member: TeamMemberSetting = {
      id: `usr_${Date.now()}`,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      isActive: true,
      assignedWarehouseId: 'wh_main',
      createdAt: new Date().toISOString()
    };
    setSettings((prev) => ({
      ...prev,
      team: [...prev.team, member]
    }));
    setNewMember({ name: '', email: '', role: 'sales_staff' });
    setIsAddMemberOpen(false);
  };

  const handleRemoveTeamMember = (id: string) => {
    if (confirm('Are you sure you want to remove this user from the workspace?')) {
      setSettings((prev) => ({
        ...prev,
        team: prev.team.filter((m) => m.id !== id)
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-[#3E5368]">
        <RefreshCw className="animate-spin text-[#1F86CC] mr-2" size={18} />
        Loading Settings Centre...
      </div>
    );
  }

  // Navigation tab list
  const navTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Business Profile', icon: <Building2 size={15} /> },
    { id: 'financial', label: 'Financial & FY', icon: <Calendar size={15} /> },
    { id: 'invoicedocs', label: 'Invoice & Docs', icon: <FileText size={15} /> },
    { id: 'taxgst', label: 'Tax & GST', icon: <Receipt size={15} /> },
    { id: 'inventory', label: 'Inventory', icon: <Boxes size={15} /> },
    { id: 'payments', label: 'Payments & Banking', icon: <CreditCard size={15} /> },
    { id: 'team', label: 'Team & RBAC', icon: <Users size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'security', label: 'Security & Audit', icon: <Shield size={15} /> },
    { id: 'backup', label: 'Data & Backup', icon: <Database size={15} /> }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-[#E8DFCF] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#12263A]">Settings Centre</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5FD] text-[#1F86CC] border border-[#1F86CC]/20">
              Bazaar-Guru v3.2
            </span>
          </div>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Configure enterprise identity, GST rules, numbering series, invoice layouts, and data governance.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#C23B3B]/30 text-xs font-semibold text-[#C23B3B] hover:bg-[#FDECEC] transition cursor-pointer shadow-2xs"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Reset DB</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] text-xs font-semibold text-white shadow-2xs transition cursor-pointer"
          >
            <Save size={14} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Save Success Toast */}
      {saveSuccessMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#E6F6EE] border border-[#1E8E5A]/30 text-[#1E8E5A] text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 2. Secondary Horizontal Navigation Bar */}
      <div className="border-b border-[#E8DFCF] bg-white rounded-xl shadow-2xs p-1.5 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 min-w-max" aria-label="Settings Tabs">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs'
                    : 'text-[#3E5368] hover:text-[#12263A] hover:bg-[#FFFBF3]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Tab Contents */}
      <div className="bg-white rounded-xl border border-[#E8DFCF] p-5 shadow-2xs">
        {/* ========================================================================= */}
        {/* TAB 1: BUSINESS PROFILE (Section A)                                       */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* A1. Business Identity */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Building2 size={16} className="text-[#1F86CC]" /> A1. Business Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Company Trade Name *</label>
                  <input
                    type="text"
                    value={settings.identity.tradeName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        identity: { ...settings.identity, tradeName: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Legal Registered Name</label>
                  <input
                    type="text"
                    value={settings.identity.legalName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        identity: { ...settings.identity, legalName: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Corporate GSTIN (15 chars) *</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={settings.identity.gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden uppercase font-semibold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={settings.identity.pan}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        identity: { ...settings.identity, pan: e.target.value.toUpperCase() }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden uppercase font-semibold tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Constitution of Business</label>
                  <select
                    value={settings.identity.constitution}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        identity: { ...settings.identity, constitution: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="pvt_ltd">Private Limited Company</option>
                    <option value="proprietorship">Sole Proprietorship</option>
                    <option value="partnership">Partnership Firm</option>
                    <option value="llp">Limited Liability Partnership (LLP)</option>
                    <option value="public_ltd">Public Limited Company</option>
                    <option value="individual_huf">Individual / HUF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Corporate Identity (CIN)</label>
                  <input
                    type="text"
                    value={settings.identity.cin || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        identity: { ...settings.identity, cin: e.target.value }
                      })
                    }
                    placeholder="U72900MH2021PTC123456"
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">MSME / Udyam Registration</label>
                  <input
                    type="text"
                    value={settings.identity.msmeRegNo || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        identity: { ...settings.identity, msmeRegNo: e.target.value }
                      })
                    }
                    placeholder="UDYAM-MH-01-0012345"
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* A2. Contact Information */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Info size={16} className="text-[#1F86CC]" /> A2. Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Billing Street Address</label>
                  <input
                    type="text"
                    value={settings.contact.address}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, address: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Primary State *</label>
                  <select
                    value={settings.contact.state}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, state: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">City / District</label>
                  <input
                    type="text"
                    value={settings.contact.city}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, city: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">PIN Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={settings.contact.pincode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, pincode: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Official Phone Number</label>
                  <input
                    type="text"
                    value={settings.contact.phone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, phone: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Official Email Address</label>
                  <input
                    type="email"
                    value={settings.contact.email}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, email: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Business Website</label>
                  <input
                    type="url"
                    value={settings.contact.website || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        contact: { ...settings.contact, website: e.target.value }
                      })
                    }
                    placeholder="https://example.com"
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* A3. Branding & Assets */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <QrCode size={16} className="text-[#1F86CC]" /> A3. Branding & Invoice Assets
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
                {/* Logo Box */}
                <div className="p-3.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
                  <span className="font-semibold text-[#12263A]">Business Logo</span>
                  <p className="text-[11px] text-[#3E5368]">Displayed in the top header of tax invoices and bills.</p>
                  <div className="flex items-center gap-3">
                    {settings.branding.logoUrl ? (
                      <div className="w-16 h-16 rounded border border-[#E8DFCF] bg-white flex items-center justify-center overflow-hidden p-1">
                        <img src={settings.branding.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded border border-dashed border-[#E8DFCF] bg-white flex items-center justify-center text-[10px] text-[#3E5368]">
                        No Logo
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="w-full text-xs text-[#3E5368] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#EAF5FD] file:text-[#1F86CC] hover:file:bg-[#D4EBFA] cursor-pointer"
                      />
                      {settings.branding.logoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              branding: { ...settings.branding, logoUrl: '' }
                            })
                          }
                          className="text-[11px] text-[#C23B3B] hover:underline cursor-pointer"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Signature Box */}
                <div className="p-3.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
                  <span className="font-semibold text-[#12263A]">Authorized Signature</span>
                  <p className="text-[11px] text-[#3E5368]">Printed in the signature box on final customer invoices.</p>
                  <div className="flex items-center gap-3">
                    {settings.branding.signatureUrl ? (
                      <div className="w-24 h-16 rounded border border-[#E8DFCF] bg-white flex items-center justify-center overflow-hidden p-1">
                        <img src={settings.branding.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded border border-dashed border-[#E8DFCF] bg-white flex items-center justify-center text-[10px] text-[#3E5368]">
                        No Signature
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="w-full text-xs text-[#3E5368] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#EAF5FD] file:text-[#1F86CC] hover:file:bg-[#D4EBFA] cursor-pointer"
                      />
                      {settings.branding.signatureUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              branding: { ...settings.branding, signatureUrl: '' }
                            })
                          }
                          className="text-[11px] text-[#C23B3B] hover:underline cursor-pointer"
                        >
                          Remove Signature
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Invoice Tagline / Subtitle</label>
                <input
                  type="text"
                  value={settings.branding.tagline || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      branding: { ...settings.branding, tagline: e.target.value }
                    })
                  }
                  placeholder="Reliable GST Invoicing & Accounting Software That Works Offline"
                  className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                />
              </div>
            </div>

            {/* A4. Primary Bank Account */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <CreditCard size={16} className="text-[#1F86CC]" /> A4. Bank Account & Settlement Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={settings.primaryBank.bankName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryBank: { ...settings.primaryBank, bankName: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={settings.primaryBank.accountHolderName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryBank: { ...settings.primaryBank, accountHolderName: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={settings.primaryBank.bankAccount}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryBank: { ...settings.primaryBank, bankAccount: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden tabular-nums font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank IFSC Code</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={settings.primaryBank.bankIFSC}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryBank: { ...settings.primaryBank, bankIFSC: e.target.value.toUpperCase() }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={settings.primaryBank.bankBranch}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryBank: { ...settings.primaryBank, bankBranch: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">UPI ID / VPA</label>
                  <input
                    type="text"
                    value={settings.primaryBank.upiId || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        primaryBank: { ...settings.primaryBank, upiId: e.target.value }
                      })
                    }
                    placeholder="merchant@upi"
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FINANCIAL & NUMBERING (Section B)                                  */}
        {/* ========================================================================= */}
        {activeTab === 'financial' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* B1. Financial Year */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Calendar size={16} className="text-[#1F86CC]" /> B1. Financial Year & Period Locking
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Current Financial Year</label>
                  <select
                    value={settings.financialYear.currentFY}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        financialYear: { ...settings.financialYear, currentFY: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] font-semibold"
                  >
                    <option value="2023-24">2023-24 (1 Apr 2023 - 31 Mar 2024)</option>
                    <option value="2024-25">2024-25 (1 Apr 2024 - 31 Mar 2025)</option>
                    <option value="2025-26">2025-26 (1 Apr 2025 - 31 Mar 2026)</option>
                    <option value="2026-27">2026-27 (1 Apr 2026 - 31 Mar 2027)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Books Beginning Date</label>
                  <input
                    type="date"
                    value={settings.financialYear.booksBeginningDate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        financialYear: { ...settings.financialYear, booksBeginningDate: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.financialYear.isPeriodLocked}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          financialYear: { ...settings.financialYear, isPeriodLocked: e.target.checked }
                        })
                      }
                      className="rounded text-[#E0771A] focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-[#12263A] flex items-center gap-1.5">
                      {settings.financialYear.isPeriodLocked ? <Lock size={13} className="text-[#C23B3B]" /> : <Unlock size={13} className="text-[#1E8E5A]" />}
                      Lock Prior Accounting Period
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* B2. Regional Preferences */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Receipt size={16} className="text-[#1F86CC]" /> B2. Regional & Currency Formatting
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Currency Code</label>
                  <input
                    type="text"
                    disabled
                    value={settings.regional.currency}
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-gray-100 text-[#3E5368] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    disabled
                    value={settings.regional.currencySymbol}
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-gray-100 text-[#3E5368] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Numbering Grouping System</label>
                  <select
                    value={settings.regional.numberSystem}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        regional: { ...settings.regional, numberSystem: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="indian">Indian (Lakhs & Crores: 1,00,000)</option>
                    <option value="international">International (Millions: 100,000)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Date Format</label>
                  <select
                    value={settings.regional.dateFormat}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        regional: { ...settings.regional, dateFormat: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Standard)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 15-Jun-2026)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* B3. Document Numbering Series */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Layers size={16} className="text-[#1F86CC]" /> B3. Document Numbering Configuration
              </h3>
              <p className="text-[11px] text-[#3E5368] mt-1">
                Configure auto-incrementing serial numbering rules for each document type. Counter resets can be locked to financial years.
              </p>

              <div className="overflow-x-auto mt-3 border border-[#E8DFCF] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] font-semibold">
                    <tr>
                      <th className="p-2.5">Document Type</th>
                      <th className="p-2.5">Prefix</th>
                      <th className="p-2.5">Separator</th>
                      <th className="p-2.5">Next Number</th>
                      <th className="p-2.5">Padding</th>
                      <th className="p-2.5">FY Suffix</th>
                      <th className="p-2.5">Generated Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DFCF]">
                    {Object.entries(settings.numbering.sequences || {}).map(([key, seq]) => {
                      const paddedNum = String(seq.currentNumber).padStart(seq.padding, '0');
                      const previewString = `${seq.prefix}${seq.separator}${paddedNum}${
                        seq.fyReset ? `${seq.separator}${seq.financialYear}` : ''
                      }`;

                      return (
                        <tr key={key} className="hover:bg-[#FFFBF3]/50">
                          <td className="p-2.5 font-bold text-[#12263A]">{seq.docType}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={seq.prefix}
                              onChange={(e) => {
                                const updated = { ...settings.numbering.sequences };
                                updated[key] = { ...seq, prefix: e.target.value.toUpperCase() };
                                setSettings({
                                  ...settings,
                                  numbering: { ...settings.numbering, sequences: updated }
                                });
                              }}
                              className="w-20 h-8 rounded border border-[#E8DFCF] px-2 text-xs uppercase bg-[#FFFBF3]"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={seq.separator}
                              onChange={(e) => {
                                const updated = { ...settings.numbering.sequences };
                                updated[key] = { ...seq, separator: e.target.value };
                                setSettings({
                                  ...settings,
                                  numbering: { ...settings.numbering, sequences: updated }
                                });
                              }}
                              className="h-8 rounded border border-[#E8DFCF] px-2 text-xs bg-[#FFFBF3]"
                            >
                              <option value="-">- (Hyphen)</option>
                              <option value="/">/ (Slash)</option>
                              <option value="">None</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={seq.currentNumber}
                              onChange={(e) => {
                                const updated = { ...settings.numbering.sequences };
                                updated[key] = { ...seq, currentNumber: parseInt(e.target.value) || 1 };
                                setSettings({
                                  ...settings,
                                  numbering: { ...settings.numbering, sequences: updated }
                                });
                              }}
                              className="w-20 h-8 rounded border border-[#E8DFCF] px-2 text-xs bg-[#FFFBF3] tabular-nums"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={seq.padding}
                              onChange={(e) => {
                                const updated = { ...settings.numbering.sequences };
                                updated[key] = { ...seq, padding: parseInt(e.target.value) || 4 };
                                setSettings({
                                  ...settings,
                                  numbering: { ...settings.numbering, sequences: updated }
                                });
                              }}
                              className="h-8 rounded border border-[#E8DFCF] px-2 text-xs bg-[#FFFBF3]"
                            >
                              <option value={3}>3 digits (001)</option>
                              <option value={4}>4 digits (0001)</option>
                              <option value={5}>5 digits (00001)</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={seq.fyReset}
                                onChange={(e) => {
                                  const updated = { ...settings.numbering.sequences };
                                  updated[key] = { ...seq, fyReset: e.target.checked };
                                  setSettings({
                                    ...settings,
                                    numbering: { ...settings.numbering, sequences: updated }
                                  });
                                }}
                                className="rounded text-[#E0771A]"
                              />
                              <span className="text-[11px] text-[#3E5368]">Reset on FY</span>
                            </label>
                          </td>
                          <td className="p-2 font-mono font-bold text-[#1F86CC]">{previewString}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: INVOICE & DOCUMENTS (Section C)                                    */}
        {/* ========================================================================= */}
        {activeTab === 'invoicedocs' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* C1. Invoice Defaults */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <FileText size={16} className="text-[#1F86CC]" /> C1. Standard Invoice Defaults
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default Payment Terms</label>
                  <select
                    value={settings.invoiceDefaults.paymentTerms}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoiceDefaults: { ...settings.invoiceDefaults, paymentTerms: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="immediate">Immediate / Due on Receipt</option>
                    <option value="net15">Net 15 Days</option>
                    <option value="net30">Net 30 Days (Standard)</option>
                    <option value="net45">Net 45 Days</option>
                    <option value="net60">Net 60 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Due Date Calculation (Days)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.invoiceDefaults.dueDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoiceDefaults: { ...settings.invoiceDefaults, dueDays: parseInt(e.target.value) || 0 }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Place of Supply Mode</label>
                  <select
                    value={settings.invoiceDefaults.placeOfSupplyMode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoiceDefaults: { ...settings.invoiceDefaults, placeOfSupplyMode: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="auto_customer">Auto-determine from Customer State</option>
                    <option value="business_state">Default to Business Home State</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default Terms & Conditions</label>
                  <textarea
                    rows={3}
                    value={settings.invoiceDefaults.termsConditions}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoiceDefaults: { ...settings.invoiceDefaults, termsConditions: e.target.value }
                      })
                    }
                    className="w-full rounded-lg border border-[#E8DFCF] p-2.5 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* C2. Invoice Appearance & Template Selection */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Eye size={16} className="text-[#1F86CC]" /> C2. Print Template & Element Visibility
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default Invoice Template</label>
                  <select
                    value={settings.invoiceAppearance.defaultTemplate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        invoiceAppearance: { ...settings.invoiceAppearance, defaultTemplate: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] font-semibold"
                  >
                    <option value="classic">Classic Professional</option>
                    <option value="modern">Modern Minimalist</option>
                    <option value="compact">Compact Dense</option>
                    <option value="elegant">Elegant Executive</option>
                    <option value="bold">Bold Vibrant</option>
                    <option value="monochrome">Monochrome Clean</option>
                  </select>
                </div>

                <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.invoiceAppearance.showBankDetails}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoiceAppearance: { ...settings.invoiceAppearance, showBankDetails: e.target.checked }
                        })
                      }
                      className="rounded text-[#E0771A]"
                    />
                    <span className="text-xs font-semibold text-[#12263A]">Show Bank Details</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.invoiceAppearance.showUpiQr}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoiceAppearance: { ...settings.invoiceAppearance, showUpiQr: e.target.checked }
                        })
                      }
                      className="rounded text-[#E0771A]"
                    />
                    <span className="text-xs font-semibold text-[#12263A]">Show UPI QR Code</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.invoiceAppearance.showSignature}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoiceAppearance: { ...settings.invoiceAppearance, showSignature: e.target.checked }
                        })
                      }
                      className="rounded text-[#E0771A]"
                    />
                    <span className="text-xs font-semibold text-[#12263A]">Show Authorized Signature</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.invoiceAppearance.showTotalInWords}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoiceAppearance: { ...settings.invoiceAppearance, showTotalInWords: e.target.checked }
                        })
                      }
                      className="rounded text-[#E0771A]"
                    />
                    <span className="text-xs font-semibold text-[#12263A]">Show Amount In Words</span>
                  </label>
                </div>
              </div>
            </div>

            {/* C4. Print Preferences */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Printer size={16} className="text-[#1F86CC]" /> C4. Print & PDF Export Defaults
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Standard Paper Size</label>
                  <select
                    value={settings.printExport.paperSize}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        printExport: { ...settings.printExport, paperSize: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="A4">A4 (210mm x 297mm) - Recommended</option>
                    <option value="Letter">US Letter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default Copy Watermark</label>
                  <select
                    value={settings.printExport.copyMarkType}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        printExport: { ...settings.printExport, copyMarkType: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="original">Original for Recipient</option>
                    <option value="duplicate">Duplicate for Transporter</option>
                    <option value="triplicate">Triplicate for Supplier</option>
                    <option value="none">None / Standard</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.printExport.autoPrintAfterSave}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          printExport: { ...settings.printExport, autoPrintAfterSave: e.target.checked }
                        })
                      }
                      className="rounded text-[#E0771A]"
                    />
                    <span className="text-xs font-semibold text-[#12263A]">Auto-Open Print Dialog After Save</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: TAX & GST (Section D)                                              */}
        {/* ========================================================================= */}
        {activeTab === 'taxgst' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* D1. GST Configuration */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Receipt size={16} className="text-[#1F86CC]" /> D1. GST Registration & Behavior
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">GST Registration Type</label>
                  <select
                    value={settings.taxGst.registrationType}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taxGst: { ...settings.taxGst, registrationType: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] font-semibold"
                  >
                    <option value="regular">Regular GST Payer</option>
                    <option value="composition">Composition Scheme Payer</option>
                    <option value="sez_unit">SEZ Unit</option>
                    <option value="sez_developer">SEZ Developer</option>
                    <option value="deemed_export">Deemed Exporter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default GST Rate for New Items</label>
                  <select
                    value={settings.taxGst.defaultGstRate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taxGst: { ...settings.taxGst, defaultGstRate: parseFloat(e.target.value) }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value={0}>0% (Nil / Exempt)</option>
                    <option value={5}>5% (Essential Commodities)</option>
                    <option value={12}>12% (Standard Low)</option>
                    <option value={18}>18% (Standard General)</option>
                    <option value={28}>28% (Luxury / De-merit)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">E-Way Bill Mandatory Threshold</label>
                  <input
                    type="number"
                    value={settings.taxGst.ewayBillThreshold}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taxGst: { ...settings.taxGst, ewayBillThreshold: parseInt(e.target.value) || 50000 }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* D2. Tax Calculation Mechanics */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Receipt size={16} className="text-[#1F86CC]" /> D2. Calculation Rules & Round-Off
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3 text-xs">
                <div className="p-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
                  <span className="font-semibold text-[#12263A]">GST Round-off Rule</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="roundOffMode"
                        checked={settings.taxGst.roundOffTaxMode === 'total'}
                        onChange={() =>
                          setSettings({
                            ...settings,
                            taxGst: { ...settings.taxGst, roundOffTaxMode: 'total' }
                          })
                        }
                      />
                      <span>Invoice Total Level (Recommended)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="roundOffMode"
                        checked={settings.taxGst.roundOffTaxMode === 'item'}
                        onChange={() =>
                          setSettings({
                            ...settings,
                            taxGst: { ...settings.taxGst, roundOffTaxMode: 'item' }
                          })
                        }
                      />
                      <span>Line Item Level</span>
                    </label>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
                  <span className="font-semibold text-[#12263A]">Default Product Price Mode</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="priceTaxMode"
                        checked={settings.taxGst.priceTaxMode === 'exclusive'}
                        onChange={() =>
                          setSettings({
                            ...settings,
                            taxGst: { ...settings.taxGst, priceTaxMode: 'exclusive' }
                          })
                        }
                      />
                      <span>Tax Exclusive (Base + GST)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="priceTaxMode"
                        checked={settings.taxGst.priceTaxMode === 'inclusive'}
                        onChange={() =>
                          setSettings({
                            ...settings,
                            taxGst: { ...settings.taxGst, priceTaxMode: 'inclusive' }
                          })
                        }
                      />
                      <span>Tax Inclusive (MRP Style)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* D5. Future Government Integration Readiness */}
            <div className="p-4 rounded-xl border border-[#3BA0E6]/30 bg-[#EAF5FD]/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#12263A] text-xs flex items-center gap-1.5">
                  <ExternalLink size={14} className="text-[#1F86CC]" /> D5. Government Portal & NIC Readiness
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EAF5FD] text-[#1F86CC] border border-[#1F86CC]/20">
                  Sandbox Active
                </span>
              </div>
              <p className="text-[11px] text-[#3E5368] leading-relaxed">
                Bazaar-Guru includes native schema mappings for E-Invoice IRP (Invoice Registration Portal) and NIC E-Way Bill JSON generators.
                Enter your authorized GSP/NIC Sandbox credentials below for seamless staging.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-[#3E5368] mb-1">IRP Sandbox Client ID</label>
                  <input
                    type="password"
                    placeholder="TEST-GSP-CLIENT-SECRET"
                    value={settings.taxGst.irpApiKey || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taxGst: { ...settings.taxGst, irpApiKey: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded border border-[#E8DFCF] px-2 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#3E5368] mb-1">NIC E-Way Bill Staging User</label>
                  <input
                    type="text"
                    placeholder="sandbox_eway_user"
                    value={settings.taxGst.ewayBillUsername || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        taxGst: { ...settings.taxGst, ewayBillUsername: e.target.value }
                      })
                    }
                    className="w-full h-8 rounded border border-[#E8DFCF] px-2 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: INVENTORY SETTINGS (Section E)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* E1. Behaviour & Valuation */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Boxes size={16} className="text-[#1F86CC]" /> E1 & E2. Inventory Rules & Cost Valuation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Stock Cost Valuation Method</label>
                  <select
                    value={settings.inventory.defaultValuationMethod}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, defaultValuationMethod: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] font-semibold"
                  >
                    <option value="weighted_average">Weighted Average Cost (AVCO)</option>
                    <option value="fifo">First-In First-Out (FIFO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default Unit of Measurement</label>
                  <select
                    value={settings.inventory.defaultUOM}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, defaultUOM: e.target.value }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="KGS">KGS (Kilograms)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="NOS">NOS (Numbers)</option>
                    <option value="MTR">MTR (Meters)</option>
                    <option value="LTR">LTR (Liters)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Global Low Stock Alert (Units)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.inventory.lowStockAlertThreshold || 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, lowStockAlertThreshold: parseInt(e.target.value) || 0 }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] tabular-nums font-semibold"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.inventory.allowNegativeStock}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, allowNegativeStock: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Allow Negative Stock</span>
                    <span className="text-[10px] text-[#3E5368]">Enables sales billing even if physical inventory count is zero.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.inventory.autoDeductOnInvoice}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, autoDeductOnInvoice: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Auto-Deduct Stock on Invoicing</span>
                    <span className="text-[10px] text-[#3E5368]">Automatically writes real-time stock reduction on sales invoice save.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.inventory.enableBatches}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, enableBatches: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Batch & Lot Tracking</span>
                    <span className="text-[10px] text-[#3E5368]">Tracks manufacturing batch numbers and expiry dates per item.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.inventory.multiWarehouseEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventory: { ...settings.inventory, multiWarehouseEnabled: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Multi-Godown / Warehouse Mode</span>
                    <span className="text-[10px] text-[#3E5368]">Manage stock transfers between different depots and branch stores.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: PAYMENTS & BANKING (Section F)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'payments' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <CreditCard size={16} className="text-[#1F86CC]" /> F1. Payment Modes & Automation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Default Payment Mode</label>
                  <select
                    value={settings.paymentsBanking.defaultPaymentMode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        paymentsBanking: { ...settings.paymentsBanking, defaultPaymentMode: e.target.value as any }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] font-semibold"
                  >
                    <option value="upi">UPI / QR Transfer</option>
                    <option value="neft">NEFT / RTGS / IMPS</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Bank Cheque</option>
                    <option value="card">Credit / Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Cheque Clearance Grace Days</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.paymentsBanking.chequeGraceDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        paymentsBanking: { ...settings.paymentsBanking, chequeGraceDays: parseInt(e.target.value) || 3 }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">PDC Maturity Reminder (Days)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.paymentsBanking.autoRemindPdcDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        paymentsBanking: { ...settings.paymentsBanking, autoRemindPdcDays: parseInt(e.target.value) || 3 }
                      })
                    }
                    className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6] tabular-nums"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.paymentsBanking.autoCreateJournalEntry}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        paymentsBanking: { ...settings.paymentsBanking, autoCreateJournalEntry: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Auto-Post Double-Entry Journal</span>
                    <span className="text-[10px] text-[#3E5368]">Every payment voucher writes instant debit/credit ledger postings.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.paymentsBanking.allowPartialPayments}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        paymentsBanking: { ...settings.paymentsBanking, allowPartialPayments: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Allow Partial Invoice Settlements</span>
                    <span className="text-[10px] text-[#3E5368]">Permit multi-installment receipts with automatic FIFO allocation.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* F2. Ageing Brackets */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Clock size={16} className="text-[#1F86CC]" /> F2. Receivables Ageing Brackets
              </h3>
              <p className="text-[11px] text-[#3E5368] mt-1">
                Customize overdue bracket intervals for debtors and creditors aging analysis reports.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs font-semibold text-[#12263A]">Brackets:</span>
                <span className="px-3 py-1 rounded bg-[#EAF5FD] text-[#1F86CC] text-xs font-bold border border-[#1F86CC]/20">0 - 30 Days</span>
                <span className="px-3 py-1 rounded bg-[#FFF3E0] text-[#E0771A] text-xs font-bold border border-[#E0771A]/20">31 - 60 Days</span>
                <span className="px-3 py-1 rounded bg-[#FDECEC] text-[#C23B3B] text-xs font-bold border border-[#C23B3B]/20">61 - 90 Days</span>
                <span className="px-3 py-1 rounded bg-red-100 text-red-700 text-xs font-bold border border-red-300">90+ Days</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: USERS & RBAC (Section G)                                          */}
        {/* ========================================================================= */}
        {activeTab === 'team' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E8DFCF] pb-2">
              <div>
                <h3 className="font-bold text-[#12263A] text-sm flex items-center gap-2">
                  <Users size={16} className="text-[#1F86CC]" /> G1. Team Members & Access Roles
                </h3>
                <p className="text-[11px] text-[#3E5368]">
                  Manage authorized users, assigns roles, and enforce role-based access control policies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF5FD] text-[#1F86CC] border border-[#1F86CC]/30 hover:bg-[#D4EBFA] text-xs font-semibold cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Member</span>
              </button>
            </div>

            {/* Team Members List */}
            <div className="overflow-x-auto border border-[#E8DFCF] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] font-semibold">
                  <tr>
                    <th className="p-2.5">Member Name</th>
                    <th className="p-2.5">Email Address</th>
                    <th className="p-2.5">Assigned Role</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCF]">
                  {settings.team.map((member) => (
                    <tr key={member.id} className="hover:bg-[#FFFBF3]/50">
                      <td className="p-2.5 font-bold text-[#12263A]">{member.name}</td>
                      <td className="p-2.5 text-[#3E5368]">{member.email}</td>
                      <td className="p-2.5">
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-[#EAF5FD] text-[#1F86CC]">
                          {member.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6F6EE] text-[#1E8E5A]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1E8E5A]" /> Active
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        {member.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTeamMember(member.id)}
                            className="text-[#C23B3B] hover:underline text-[11px] font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* G3. Visual Permissions Matrix */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Shield size={16} className="text-[#1F86CC]" /> G3. Interactive Permissions Matrix
              </h3>
              <p className="text-[11px] text-[#3E5368] mt-1">
                Visual policy map showing active access privileges granted to roles across core business subsystems.
              </p>

              <div className="overflow-x-auto mt-3 border border-[#E8DFCF] rounded-lg">
                <table className="w-full text-center text-[11px]">
                  <thead className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] font-semibold">
                    <tr>
                      <th className="p-2 text-left">Role</th>
                      <th className="p-2">Sales</th>
                      <th className="p-2">Purchases</th>
                      <th className="p-2">Inventory</th>
                      <th className="p-2">Banking</th>
                      <th className="p-2">Accounts</th>
                      <th className="p-2">Reports</th>
                      <th className="p-2">Settings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DFCF]">
                    {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
                      <tr key={role} className="hover:bg-[#FFFBF3]/40">
                        <td className="p-2 text-left font-bold text-[#12263A] capitalize">
                          {role.replace('_', ' ')}
                        </td>
                        <td className="p-2">{perms.sales ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                        <td className="p-2">{perms.purchases ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                        <td className="p-2">{perms.inventory ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                        <td className="p-2">{perms.banking ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                        <td className="p-2">{perms.accounting ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                        <td className="p-2">{perms.reports ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                        <td className="p-2">{perms.settings ? <Check size={14} className="mx-auto text-[#1E8E5A]" /> : <span className="text-gray-300">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: NOTIFICATIONS (Section H)                                          */}
        {/* ========================================================================= */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Bell size={16} className="text-[#1F86CC]" /> H1. In-App Notification Triggers
              </h3>
              <p className="text-[11px] text-[#3E5368] mt-1">
                Configure contextual alerts that surface inside the top notification center.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.alertLowStock}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, alertLowStock: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Low Stock Alerts</span>
                    <span className="text-[10px] text-[#3E5368]">Notify whenever an item quantity drops below its reorder threshold.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.alertOverdueReceivable}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, alertOverdueReceivable: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Overdue Payment Reminders</span>
                    <span className="text-[10px] text-[#3E5368]">Flag customer invoices that exceed their agreed payment due date.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.alertExpiringBatch}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, alertExpiringBatch: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Expiring Batch Warnings</span>
                    <span className="text-[10px] text-[#3E5368]">Warn 30 days prior to product batch expiry dates.</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.alertSyncAlert}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, alertSyncAlert: e.target.checked }
                      })
                    }
                    className="rounded text-[#E0771A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#12263A] block">Cloud Sync Status Warnings</span>
                    <span className="text-[10px] text-[#3E5368]">Alert when offline mutations exceed 50 entries or conflict occurs.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* H3. Channels Readiness */}
            <div className="p-4 rounded-xl border border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
              <span className="font-bold text-[#12263A] text-xs">H3. Multi-Channel Dispatch Readiness</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-2.5 rounded bg-white border border-[#E8DFCF]">
                  <span className="font-semibold text-[#12263A] block">WhatsApp Web API</span>
                  <span className="text-[10px] text-[#1E8E5A] font-bold">Enabled & Connected</span>
                  <p className="text-[10px] text-[#3E5368] mt-1">Direct click-to-send invoice PDF sharing via WhatsApp.</p>
                </div>
                <div className="p-2.5 rounded bg-white border border-[#E8DFCF]">
                  <span className="font-semibold text-[#12263A] block">Email (SMTP / SendGrid)</span>
                  <span className="text-[10px] text-[#1F86CC] font-bold">Ready for Gateway Setup</span>
                  <p className="text-[10px] text-[#3E5368] mt-1">Direct customer statement dispatch via email.</p>
                </div>
                <div className="p-2.5 rounded bg-white border border-[#E8DFCF]">
                  <span className="font-semibold text-[#12263A] block">SMS DLT Gateway</span>
                  <span className="text-[10px] text-[#3E5368] font-bold">DLT Template Ready</span>
                  <p className="text-[10px] text-[#3E5368] mt-1">Payment reminder SMS gateway architecture.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: SECURITY & AUDIT (Section I)                                       */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* I1. Account Security */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield size={16} className="text-[#1F86CC]" /> I1. Account Security & Session
                </span>
                {userEmail ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F6EE] text-[#1E8E5A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E8E5A]" /> Cloud Synchronized
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEF2F6] text-[#3E5368]">
                    Local Offline Mode
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
                <div className="p-3.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] space-y-1">
                  <span className="text-[11px] font-semibold text-[#3E5368]">Authenticated Identity:</span>
                  <p className="font-bold text-[#12263A] text-sm">
                    {userEmail || 'Local Browser Database (Offline)'}
                  </p>
                  <p className="text-[11px] text-[#3E5368]">
                    {userEmail
                      ? 'Securely connected to Supabase private business database.'
                      : 'Data is persisted locally in IndexedDB storage on this device.'}
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-2">
                  {userEmail ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsChangePasswordOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8DFCF] bg-white hover:bg-[#FFFBF3] text-xs font-semibold text-[#12263A] transition cursor-pointer shadow-2xs"
                      >
                        <Key size={13} className="text-[#1F86CC]" />
                        <span>Change Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#C23B3B]/30 bg-white hover:bg-[#FDECEC] text-xs font-semibold text-[#C23B3B] transition cursor-pointer shadow-2xs"
                      >
                        <LogOut size={13} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[#3E5368]">
                      Sign in through Cloud Sync to enable remote cloud backups and multi-device replication.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* I2. Live Audit Trail Log */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Clock size={16} className="text-[#1F86CC]" /> I2. Recent Business Audit Trail
              </h3>
              <p className="text-[11px] text-[#3E5368] mt-1">
                Immutable event stream tracking modifications across documents, parties, and accounts.
              </p>

              <div className="overflow-x-auto mt-3 border border-[#E8DFCF] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFFBF3] border-b border-[#E8DFCF] text-[#3E5368] font-semibold">
                    <tr>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">Actor</th>
                      <th className="p-2">Action</th>
                      <th className="p-2">Entity Type</th>
                      <th className="p-2">Identifier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8DFCF]">
                    {recentAudits.length > 0 ? (
                      recentAudits.map((evt) => (
                        <tr key={evt.id} className="hover:bg-[#FFFBF3]/40">
                          <td className="p-2 font-mono text-[11px] text-[#3E5368]">
                            {new Date(evt.timestamp).toLocaleString()}
                          </td>
                          <td className="p-2 font-semibold text-[#12263A]">{evt.userName || evt.userId}</td>
                          <td className="p-2 font-bold text-[#1F86CC] uppercase text-[10px]">{evt.action}</td>
                          <td className="p-2 capitalize">{evt.entityType}</td>
                          <td className="p-2 font-mono text-[11px]">{evt.entityNumber || evt.entityId}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-xs text-[#3E5368]">
                          No recent audit events recorded. System actions are automatically logged here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* I3. Data Privacy Statement */}
            <div className="p-3.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] space-y-1 text-xs">
              <span className="font-bold text-[#12263A]">I3. Enterprise Data Privacy & Ownership</span>
              <p className="text-[#3E5368] leading-relaxed">
                Your invoices, client GSTINs, and banking transactions are strictly your business property.
                Bazaar-Guru processes all accounting calculations locally on your machine and stores your records
                in your dedicated isolated database schema.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: DATA, BACKUP & RESTORE (Section J)                                */}
        {/* ========================================================================= */}
        {activeTab === 'backup' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* J1. Backup Engine */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Database size={16} className="text-[#1F86CC]" /> J1. Complete Business Data Backup (v3.0)
              </h3>
              <p className="text-xs text-[#3E5368] mt-1 leading-relaxed">
                Generates a SHA-256 integrity-verified snapshot of all 18 database stores (invoices, ledgers, inventory, banking, and numbering).
              </p>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => exportBusinessBackup()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E8DFCF] bg-white hover:bg-[#FFFBF3] text-xs font-semibold text-[#12263A] transition cursor-pointer shadow-2xs"
                >
                  <Download size={15} className="text-[#1F86CC]" />
                  <span>Download Complete Backup Archive (.invbak)</span>
                </button>
              </div>
            </div>

            {/* J2. Restore Engine with Manifest Preview */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <Upload size={16} className="text-[#1F86CC]" /> J2. Restore from Backup Archive
              </h3>
              <p className="text-xs text-[#3E5368] mt-1 leading-relaxed">
                Select a valid <code>.invbak</code> or <code>.json</code> backup archive. You will see a manifest preview before applying changes.
              </p>

              <div className="mt-3">
                <input
                  type="file"
                  accept=".invbak,.json"
                  onChange={handleRestoreFileSelected}
                  className="w-full sm:w-auto text-xs text-[#3E5368] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#EAF5FD] file:text-[#1F86CC] hover:file:bg-[#D4EBFA] cursor-pointer"
                />
              </div>

              {/* Restore Manifest Preview Card */}
              {restorePreviewData && (
                <div className="mt-4 p-4 rounded-xl border border-[#3BA0E6]/30 bg-[#EAF5FD]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#12263A] text-xs flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-[#1E8E5A]" /> Backup Manifest Verified
                    </span>
                    <span className="text-[10px] font-semibold text-[#3E5368]">
                      Exported: {new Date(restorePreviewData.metadata?.exportedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-white border border-[#E8DFCF]">
                      <span className="text-[10px] text-[#3E5368] block">Business Name</span>
                      <strong className="text-[#12263A] truncate block">{restorePreviewData.summary?.businessName}</strong>
                    </div>
                    <div className="p-2 rounded bg-white border border-[#E8DFCF]">
                      <span className="text-[10px] text-[#3E5368] block">Corporate GSTIN</span>
                      <strong className="text-[#12263A] block">{restorePreviewData.summary?.gstin || 'N/A'}</strong>
                    </div>
                    <div className="p-2 rounded bg-white border border-[#E8DFCF]">
                      <span className="text-[10px] text-[#3E5368] block">Total Records</span>
                      <strong className="text-[#1F86CC] block">{restorePreviewData.summary?.totalRecords}</strong>
                    </div>
                    <div className="p-2 rounded bg-white border border-[#E8DFCF]">
                      <span className="text-[10px] text-[#3E5368] block">Integrity Check</span>
                      <strong className="text-[#1E8E5A] block">SHA-256 Valid</strong>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setRestorePreviewData(null); setRestoreFileRaw(null); }}
                      className="px-3 py-1.5 rounded-lg border border-[#E8DFCF] bg-white text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={handleExecuteRestore}
                      className="px-4 py-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] text-xs font-semibold text-white shadow-2xs transition cursor-pointer"
                    >
                      {isRestoring ? 'Applying Restore...' : 'Confirm & Restore Records'}
                    </button>
                  </div>
                </div>
              )}

              {restoreMessage && (
                <p className="mt-3 text-xs font-semibold text-[#1E8E5A] bg-[#E6F6EE] p-2.5 rounded-lg border border-[#1E8E5A]/20">
                  {restoreMessage}
                </p>
              )}
            </div>

            {/* J3. CSV Data Exporters */}
            <div>
              <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#1F86CC]" /> J3. One-Click CSV Data Exports
              </h3>
              <p className="text-xs text-[#3E5368] mt-1">
                Export operational datasets into spreadsheet-compatible CSV files for external audit or CA reporting.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await exportInvoicesToCSV();
                    alert(`Exported ${res.count} invoices to ${res.filename}`);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] hover:bg-white text-xs font-semibold text-[#12263A] transition cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={14} className="text-[#1F86CC]" /> Invoices Register
                  </span>
                  <Download size={13} className="text-[#3E5368]" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await exportPartiesToCSV();
                    alert(`Exported ${res.count} parties to ${res.filename}`);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] hover:bg-white text-xs font-semibold text-[#12263A] transition cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Users size={14} className="text-[#1F86CC]" /> Parties & Contacts
                  </span>
                  <Download size={13} className="text-[#3E5368]" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await exportInventoryToCSV();
                    alert(`Exported ${res.count} inventory items to ${res.filename}`);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] hover:bg-white text-xs font-semibold text-[#12263A] transition cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Boxes size={14} className="text-[#1F86CC]" /> Stock Inventory
                  </span>
                  <Download size={13} className="text-[#3E5368]" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await exportAccountsToCSV();
                    alert(`Exported ${res.count} ledger accounts to ${res.filename}`);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] hover:bg-white text-xs font-semibold text-[#12263A] transition cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Receipt size={14} className="text-[#1F86CC]" /> Chart of Accounts
                  </span>
                  <Download size={13} className="text-[#3E5368]" />
                </button>
              </div>
            </div>

            {/* J4. Danger Zone */}
            <div className="p-4 rounded-xl border border-[#C23B3B]/30 bg-[#FDECEC]/40 space-y-3">
              <div className="flex items-center gap-2 text-[#C23B3B]">
                <AlertTriangle size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Danger Zone: Reset Local Database</h4>
              </div>
              <p className="text-xs text-[#3E5368] leading-relaxed">
                Clears all local invoices, parties, items, and vouchers stored in this browser. Cloud records remain unaffected if previously synced.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-[#C23B3B] hover:bg-[#A82B2B] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  Reset Local Database
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD TEAM MEMBER                                                  */}
      {/* ========================================================================= */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[#E8DFCF] p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#12263A]">Add Workspace Member</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="e.g. Ramesh Kulkarni"
                  className="w-full h-9 rounded-lg border border-[#E8DFCF] px-3 bg-[#FFFBF3]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Email Address *</label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full h-9 rounded-lg border border-[#E8DFCF] px-3 bg-[#FFFBF3]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Assign Role</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full h-9 rounded-lg border border-[#E8DFCF] px-3 bg-[#FFFBF3]"
                >
                  <option value="admin">Administrator (Full operational access)</option>
                  <option value="accountant">Accountant (Ledgers, GST, Banking)</option>
                  <option value="sales_staff">Sales Staff (Invoicing & Customers)</option>
                  <option value="inventory_manager">Inventory Manager (Stock & Godowns)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8DFCF]">
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#E8DFCF] text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTeamMember}
                className="px-4 py-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] text-xs font-semibold text-white shadow-2xs"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE PASSWORD                                                  */}
      {/* ========================================================================= */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <form onSubmit={handleChangePassword} className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-[#E8DFCF] p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#12263A] flex items-center gap-1.5">
              <Key size={15} className="text-[#1F86CC]" /> Update Cloud Password
            </h3>
            <p className="text-xs text-[#3E5368]">
              Set a new secure password for your connected cloud account (<strong>{userEmail}</strong>).
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">New Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-9 rounded-lg border border-[#E8DFCF] px-3 bg-[#FFFBF3] text-xs"
              />
            </div>

            {passwordChangeStatus && (
              <p className="text-xs font-semibold text-[#1E8E5A]">{passwordChangeStatus}</p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8DFCF]">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#E8DFCF] text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#1F86CC] hover:bg-[#14689F] text-xs font-semibold text-white shadow-2xs"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DATABASE RESET CONFIRMATION                                      */}
      {/* ========================================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[#E8DFCF] overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-[#C23B3B]">
              <AlertTriangle size={22} />
              <h3 className="text-base font-bold text-[#12263A]">Reset Local Database</h3>
            </div>
            <p className="text-xs text-[#3E5368] leading-relaxed">
              This will erase all locally stored data including invoices, parties, items, bank records, and vouchers.
              To confirm, please type: <strong className="text-[#12263A]">{settings.identity.tradeName?.trim() || 'RESET'}</strong>
            </p>
            <input
              type="text"
              placeholder={settings.identity.tradeName?.trim() || 'RESET'}
              value={resetConfirmationInput}
              onChange={(e) => setResetConfirmationInput(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#C23B3B]"
            />
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetConfirmationInput('');
                }}
                className="px-3.5 py-2 rounded-lg border border-[#E8DFCF] text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReset}
                disabled={resetConfirmationInput.trim() !== (settings.identity.tradeName?.trim() || 'RESET')}
                className="px-4 py-2 rounded-lg bg-[#C23B3B] hover:bg-[#A82B2B] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Confirm & Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
