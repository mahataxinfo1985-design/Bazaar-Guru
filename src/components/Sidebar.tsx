import React from 'react';
import { 
  LayoutDashboard, Receipt, ShoppingCart, Landmark, Users, 
  Boxes, BookOpen, BarChart3, Wallet, CloudUpload, Settings, 
  X, ChevronLeft, ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  businessName: string;
  businessGstin?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isOpen, 
  setIsOpen, 
  businessName,
  businessGstin,
  isCollapsed = false,
  onToggleCollapse
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
        className={`fixed inset-y-0 left-0 z-50 flex ${
          isCollapsed ? 'md:w-20 w-64' : 'w-64'
        } flex-col bg-white text-[#12263A] border-r border-[#E8DFCF] transition-all duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header with Centered Official Logo */}
        <div className="flex h-16 items-center justify-center px-4 border-b border-[#E8DFCF] bg-white relative">
          <div className="flex items-center justify-center w-full py-1">
            <img 
              src={isCollapsed ? "/app-icon.png" : "/logo.png"} 
              alt="Bazaar-Guru" 
              className={isCollapsed ? "h-10 w-10 object-contain mx-auto rounded-lg" : "h-11 w-auto max-w-[170px] object-contain mx-auto"} 
            />
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute right-3 rounded-lg p-1.5 hover:bg-[#EAF5FD] text-[#3E5368] md:hidden cursor-pointer"
            title="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Business Context (hidden when collapsed on desktop) */}
        {!isCollapsed && (
          <div className="px-5 py-3 bg-[#FFFBF3] border-b border-[#E8DFCF]">
            <p className="text-[12px] font-semibold text-[#12263A] truncate">{businessName || 'My Business'}</p>
            <p className="text-[12px] text-[#3E5368] truncate font-mono mt-0.5">
              GSTIN: {businessGstin && businessGstin.trim() ? businessGstin : 'Unregistered'}
            </p>
          </div>
        )}

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
                title={item.label}
                className={`flex w-full items-center ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'
                } text-[14px] font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-[#EAF5FD] text-[#14689F] font-semibold ' + (!isCollapsed ? 'border-l-4 border-[#1F86CC]' : '')
                    : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
                }`}
              >
                <Icon size={20} className={`${!isCollapsed ? 'mr-3' : ''} shrink-0 ${isActive ? 'text-[#1F86CC]' : 'text-[#3E5368]'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with Collapse / Expand button */}
        {onToggleCollapse && (
          <div className="p-3 border-t border-[#E8DFCF] bg-[#FFFBF3]">
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`hidden md:flex w-full items-center ${
                isCollapsed ? 'justify-center py-2.5 px-2' : 'justify-center gap-2 py-2.5 px-3'
              } bg-white hover:bg-[#EAF5FD] text-[#3E5368] hover:text-[#12263A] rounded-lg border border-[#E8DFCF] text-[13px] font-medium transition cursor-pointer shadow-2xs`}
              title={isCollapsed ? "Expand navigation panel" : "Collapse navigation panel"}
            >
              {isCollapsed ? (
                <ChevronRight size={18} className="text-[#1F86CC]" />
              ) : (
                <>
                  <ChevronLeft size={16} className="text-[#3E5368]" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
