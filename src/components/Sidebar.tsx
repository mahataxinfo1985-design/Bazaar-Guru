import { 
  FileText, ShoppingCart, Users, Package, BarChart3, 
  Settings, Menu, X, Landmark, FileCheck, RefreshCw, Receipt, LogOut, LogIn,
  BookOpen
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  businessName: string;
  onLogout?: () => void;
  onLoginClick?: () => void;
  isAuthenticated?: boolean;
}

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isOpen, 
  setIsOpen, 
  businessName,
  onLogout,
  onLoginClick,
  isAuthenticated
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'sales', label: 'Sales Invoices', icon: FileText },
    { id: 'purchase', label: 'Purchase Invoices', icon: ShoppingCart },
    { id: 'banking', label: 'Payments & Banking', icon: Landmark },
    { id: 'parties', label: 'Customers & Suppliers', icon: Users },
    { id: 'items', label: 'Product Inventory', icon: Package },
    { id: 'accounting', label: 'Accounting & Ledgers', icon: BookOpen },
    { id: 'reports', label: 'GST & Sales Reports', icon: Landmark },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'sync-backup', label: 'Sync & Backup', icon: RefreshCw },
    { id: 'settings', label: 'Business Profile', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white text-slate-800 border-r border-slate-200 transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue text-white font-bold text-xl">
              B
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-slate-900">Bazaar-Guru</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GST Workspace</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 hover:bg-slate-100 md:hidden text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Business Context Display */}
        <div className="px-6 py-3 bg-slate-50/80 border-b border-gray-100">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Active Business</p>
          <p className="text-xs text-slate-700 font-semibold truncate mt-0.5">{businessName}</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-6 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Menu</div>
          <div className="space-y-0.5">
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
                  className={`flex w-full items-center px-6 py-3 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'sidebar-active' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className="mr-3 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 bg-slate-50/30 space-y-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-[10px] font-bold text-blue-800 uppercase mb-0.5">GSTIN Status</p>
            <p className="text-xs text-blue-600 font-medium font-mono">07AAACH7409R1ZZ</p>
            <div className="mt-2 w-full bg-blue-200 h-1 rounded-full overflow-hidden">
              <div className="w-full bg-[#1E40AF] h-full"></div>
            </div>
          </div>

          {!isAuthenticated && onLoginClick && (
            <button
              onClick={onLoginClick}
              className="flex w-full items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-xs cursor-pointer shadow-sm"
            >
              <LogIn size={14} />
              <span>Sign In to Cloud Sync</span>
            </button>
          )}

          {isAuthenticated && onLogout && (
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-semibold rounded-lg transition text-xs cursor-pointer border border-slate-200 hover:border-rose-200"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
