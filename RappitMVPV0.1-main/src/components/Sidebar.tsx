import { LayoutDashboard, Package, Warehouse, ShoppingBag, Truck } from 'lucide-react';

type Page = 'dashboard' | 'orders' | 'inventory' | 'channels' | 'shipping';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const menuItems = [
    { id: 'orders' as Page, label: 'الطلبات', icon: Package },
    { id: 'inventory' as Page, label: 'المخزون', icon: Warehouse },
    { id: 'channels' as Page, label: 'القنوات', icon: ShoppingBag },
    { id: 'shipping' as Page, label: 'الشحن', icon: Truck },
  ];

  return (
    <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-l border-gray-200 p-4">
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span>{item.label}</span>
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>
    </div>
  );
}