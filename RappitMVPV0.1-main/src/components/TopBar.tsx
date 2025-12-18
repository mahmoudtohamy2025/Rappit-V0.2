import { Building2, ChevronDown, LogOut, Bell, Settings } from 'lucide-react';
import { useState } from 'react';

interface TopBarProps {
  currentOrg: string;
  onOrgChange: (org: string) => void;
  onLogout: () => void;
}

export function TopBar({ currentOrg, onOrgChange, onLogout }: TopBarProps) {
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const orgs = [
    'متجر الإلكترونيات الذكية',
    'متجر الأزياء العصرية',
    'متجر المنزل والديكور'
  ];

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                <span>A</span>
              </div>
              <span className="text-sm">أحمد محمد</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showUserMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                <button className="w-full px-4 py-2 text-right hover:bg-gray-50 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>الإعدادات</span>
                </button>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-right hover:bg-gray-50 flex items-center gap-2 text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>

        {/* Org Selector */}
        <div className="relative">
          <button
            onClick={() => setShowOrgMenu(!setShowOrgMenu)}
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            <span>{currentOrg}</span>
            <Building2 className="w-5 h-5 text-blue-600" />
          </button>

          {showOrgMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
              {orgs.map((org) => (
                <button
                  key={org}
                  onClick={() => {
                    onOrgChange(org);
                    setShowOrgMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-right hover:bg-gray-50 ${
                    org === currentOrg ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                >
                  {org}
                </button>
              ))}
              <div className="border-t border-gray-200 mt-2 pt-2">
                <button className="w-full px-4 py-2 text-right hover:bg-gray-50 text-blue-600">
                  + إضافة منظمة جديدة
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl">Rappit</span>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <span>R</span>
          </div>
        </div>
      </div>
    </div>
  );
}
