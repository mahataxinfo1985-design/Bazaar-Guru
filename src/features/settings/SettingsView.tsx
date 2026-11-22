import React, { useState } from 'react';
import { Building2, CheckCircle2, Download, Upload, ShieldCheck, Database, AlertTriangle, Trash2 } from 'lucide-react';
import { BusinessProfile } from '../../types';
import { INDIAN_STATES } from '../../utils/gstEngine';
import { runTests } from '../../utils/gstEngine.test';
import { exportBusinessBackup, restoreBusinessBackup } from '../../services/storage/backupRestore';
import { idbClear } from '../../services/storage/idb';

interface SettingsViewProps {
  businessProfile: BusinessProfile;
  onUpdateProfile: (profile: BusinessProfile) => void;
  onRestoreSuccess: () => void;
}

export default function SettingsView({
  businessProfile,
  onUpdateProfile,
  onRestoreSuccess,
}: SettingsViewProps) {
  const [profile, setProfile] = useState<BusinessProfile>(businessProfile);
  const [testOutput, setTestOutput] = useState<{ success: boolean; results: string[] } | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Reset confirmation state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, signatureUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = await restoreBusinessBackup(content);
      if (res.success) {
        setRestoreMessage(res.message);
        onRestoreSuccess();
      } else {
        alert(res.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteReset = async () => {
    if (resetConfirmationInput.trim() !== profile.name.trim()) {
      alert('Business name does not match. Reset cancelled.');
      return;
    }
    try {
      const stores = [
        'invoices', 'parties', 'products', 'warehouses', 'stock_movements',
        'stock_transfers', 'stock_adjustments', 'product_batches', 'accounts',
        'journal_entries', 'bank_accounts', 'cash_accounts', 'payment_vouchers',
        'cheque_records', 'sync_outbox', 'sync_conflicts'
      ];
      for (const st of stores) {
        await idbClear(st as any).catch(() => {});
      }
      setIsResetModalOpen(false);
      alert('Local database successfully reset.');
      window.location.reload();
    } catch (err: any) {
      alert(`Error during reset: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#12263A]">Business Identity & System Settings</h2>
        <p className="text-xs text-[#3E5368] mt-0.5">
          Configure company registration, banking info, GST tax engine assertions, and full backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Profile Form */}
        <div className="lg:col-span-2 rounded-xl border border-[#E8DFCF] bg-white p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2.5">Corporation Records</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-medium">
            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">
                Company Trade Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">
                Corporate GSTIN (15 symbols)
              </label>
              <input
                type="text"
                maxLength={15}
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden uppercase font-semibold tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">
                Billing Street Address
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Primary State</label>
              <select
                value={profile.state}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
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
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Phone Number</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank Name</label>
              <input
                type="text"
                value={profile.bankName}
                onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank Account No.</label>
              <input
                type="text"
                value={profile.bankAccount}
                onChange={(e) => setProfile({ ...profile, bankAccount: e.target.value })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank IFSC Code</label>
              <input
                type="text"
                value={profile.bankIFSC}
                onChange={(e) => setProfile({ ...profile, bankIFSC: e.target.value.toUpperCase() })}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Bank UPI ID</label>
              <input
                type="text"
                value={profile.upiId || ''}
                onChange={(e) => setProfile({ ...profile, upiId: e.target.value })}
                placeholder="upi-address@upi"
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 text-xs bg-[#FFFBF3] text-[#12263A] focus:bg-white focus:border-[#3BA0E6] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Business Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 py-1.5 text-xs bg-[#FFFBF3] text-[#3E5368] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">Authorized Signature</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="w-full h-10 rounded-lg border border-[#E8DFCF] px-3 py-1.5 text-xs bg-[#FFFBF3] text-[#3E5368] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3.5 border-t border-[#E8DFCF] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="text-xs font-semibold text-[#C23B3B] hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 size={13} /> Reset Local Database
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateProfile(profile);
                alert('Business profile updated successfully!');
              }}
              className="rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition-all cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </div>

        {/* Right 1 Col: Backup & Reset */}
        <div className="space-y-4">
          {/* Backup & Restore Card */}
          <div className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs space-y-3">
            <h3 className="font-bold text-[#12263A] text-sm border-b border-[#E8DFCF] pb-2 flex items-center gap-1.5">
              <Database size={16} className="text-[#1F86CC]" /> Business Data Backup (v3.0)
            </h3>
            <p className="text-xs text-[#3E5368]">
              Download complete business dataset (invoices, ledgers, accounts, inventory, banking) as SHA-256 verified .invbak archive.
            </p>

            <button
              onClick={() => exportBusinessBackup()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#E8DFCF] bg-white py-2 text-xs font-semibold text-[#12263A] hover:bg-[#FFFBF3] transition cursor-pointer shadow-2xs"
            >
              <Download size={14} className="text-[#1F86CC]" />
              <span>Download Full Backup (.invbak)</span>
            </button>

            <div className="pt-2 border-t border-[#E8DFCF]">
              <label className="block text-[11px] font-semibold text-[#3E5368] mb-1">
                Restore from Backup (.invbak or .json)
              </label>
              <input
                type="file"
                accept=".invbak,.json"
                onChange={handleRestoreFile}
                className="w-full text-xs text-[#3E5368] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#EAF5FD] file:text-[#1F86CC] hover:file:bg-[#D4EBFA]"
              />
              {restoreMessage && (
                <p className="mt-2 text-xs font-semibold text-[#1E8E5A]">{restoreMessage}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Database Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[#E8DFCF] overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-[#C23B3B]">
              <AlertTriangle size={22} />
              <h3 className="text-base font-bold text-[#12263A]">Reset Local Database</h3>
            </div>
            <p className="text-xs text-[#3E5368] leading-relaxed">
              This will erase all locally stored data including invoices, parties, items, bank records, and vouchers.
              To confirm, please type your exact company name: <strong className="text-[#12263A]">{profile.name}</strong>
            </p>
            <input
              type="text"
              placeholder="Type company name exactly"
              value={resetConfirmationInput}
              onChange={(e) => setResetConfirmationInput(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#C23B3B]"
            />
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => { setIsResetModalOpen(false); setResetConfirmationInput(''); }}
                className="px-3.5 py-2 rounded-lg border border-[#E8DFCF] text-xs font-semibold text-[#3E5368] hover:bg-[#FFFBF3] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReset}
                disabled={resetConfirmationInput.trim() !== profile.name.trim()}
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
