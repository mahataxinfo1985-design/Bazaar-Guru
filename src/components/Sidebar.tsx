import React from 'react';
import { 
  LayoutDashboard, Receipt, ShoppingCart, Landmark, Users, 
  Boxes, BookOpen, BarChart3, Wallet, CloudUpload, Settings, 
  X, LogIn, LogOut, Compass
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  businessName: string;
  businessGstin?: string;
  onLogout?: () => void;
  onLoginClick?: () => void;
  isAuthenticated?: boolean;
  onOpenLanding?: () => void;
}

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isOpen, 
  setIsOpen, 
  businessName,
  businessGstin,
  onLogout,
  onLoginClick,
  isAuthenticated,
  onOpenLanding
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales Invoices', icon: Receipt },
    { id: 'purchase', label: 'Purchase Invoices', icon: ShoppingCart },
    { id: 'banking', label: 'Payments & Banking', icon: Landmark },
    { id: 'parties', label: 'Customers & Suppliers', icon: Users },
    { id: 'items', label: 'Product Inventory', icon: Boxes },
    { id: 'accounting', label: 'Accounting & Ledgers', icon: BookOpen },
    { id: 'reports', label: 'GST & Sales Reports', icon: BarChart3 },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'sync-backup', label: 'Sync & Backup', icon: CloudUpload },
    { id: 'settings', label: 'Business Profile', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white text-[#12263A] border-r border-[#E8DFCF] transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header with Official Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-[#E8DFCF] bg-white">
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="Bazaar-Guru" 
              className="h-9 w-auto max-w-[170px] object-contain" 
            />
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 hover:bg-[#EAF5FD] text-[#3E5368] md:hidden cursor-pointer"
            title="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Business Context */}
        <div className="px-5 py-3 bg-[#FFFBF3] border-b border-[#E8DFCF]">
          <p className="text-[12px] font-semibold text-[#12263A] truncate">{businessName || 'My Business'}</p>
          <p className="text-[12px] text-[#3E5368] truncate font-mono mt-0.5">
            GSTIN: {businessGstin && businessGstin.trim() ? businessGstin : 'Unregistered'}
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center px-3.5 py-2.5 text-[14px] font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-[#EAF5FD] text-[#14689F] font-semibold border-l-4 border-[#1F86CC]' 
                    : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
                }`}
              >
                <Icon size={20} className={`mr-3 shrink-0 ${isActive ? 'text-[#1F86CC]' : 'text-[#3E5368]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E8DFCF] bg-[#FFFBF3] space-y-2">
          {onOpenLanding && (
            <button
              onClick={onOpenLanding}
              className="flex w-full items-center justify-center gap-2 py-2 px-3 text-[13px] font-medium text-[#14689F] hover:bg-[#EAF5FD] rounded-lg transition cursor-pointer"
            >
              <Compass size={16} />
              <span>Explore Landing Page</span>
            </button>
          )}

          {!isAuthenticated && onLoginClick && (
            <button
              onClick={onLoginClick}
              className="flex w-full items-center justify-center gap-2 py-2 px-3 bg-[#EAF5FD] hover:bg-[#D4EBFA] text-[#14689F] font-semibold rounded-lg transition text-[13px] cursor-pointer border border-[#1F86CC]/20"
            >
              <LogIn size={15} />
              <span>Sign In / Cloud Sync</span>
            </button>
          )}

          {isAuthenticated && onLogout && (
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-[#FDECEC] text-[#C23B3B] font-semibold rounded-lg transition text-[13px] cursor-pointer border border-[#E8DFCF]"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
