import React from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { PortalRole } from '../../types/database';
import { 
  ShoppingBag, 
  Store, 
  Bike, 
  ShieldCheck, 
  MapPin, 
  Radio, 
  Database,
  Banknote
} from 'lucide-react';

export const Header: React.FC = () => {
  const { role, setRole, settings, orders, riders } = useDelivery();

  const activeOrdersCount = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const onlineRidersCount = riders.filter(r => r.is_online).length;

  const portals: { id: PortalRole; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    {
      id: 'customer',
      label: '1. Customer App',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      id: 'vendor',
      label: '2. Vendor Dashboard',
      icon: <Store className="w-4 h-4" />,
      badge: orders.filter(o => ['pending', 'vendor_accepted', 'food_preparing'].includes(o.status)).length || undefined
    },
    {
      id: 'rider',
      label: '3. Rider App',
      icon: <Bike className="w-4 h-4" />,
      badge: onlineRidersCount > 0 ? `${onlineRidersCount} Online` : undefined
    },
    {
      id: 'admin',
      label: '4. Admin Control',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} Active` : undefined
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      {/* Top Banner with COD badge and rates */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 font-medium">
          <Banknote className="w-4 h-4 text-amber-200" />
          <span>100% Cash On Delivery (COD) Model: Rider buys food with cash from vendor &rarr; collects full cash from customer</span>
        </div>
        <div className="flex items-center space-x-3 text-[11px] font-mono">
          <span className="bg-black/25 px-2 py-0.5 rounded">
            Rate: {settings.currency_symbol}{settings.base_delivery_charge} base + {settings.currency_symbol}{settings.per_km_delivery_charge}/km
          </span>
          <span className="bg-black/25 px-2 py-0.5 rounded flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-300" />
            Dispatch Radius: {settings.rider_match_radius_km} km
          </span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center text-white font-black text-xl shadow-md">
              FV
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-gray-900 tracking-tight text-lg">FoodVibe</span>
                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Multi-Site</span>
              </div>
              <p className="text-xs text-gray-500">Dhaka COD Delivery Network</p>
            </div>
          </div>

          {/* Portal Switcher Tabs */}
          <nav className="flex space-x-1 sm:space-x-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
            {portals.map((p) => {
              const isActive = role === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setRole(p.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-rose-600 shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  {p.icon}
                  <span className="hidden md:inline">{p.label}</span>
                  <span className="md:hidden">{p.label.split('.')[1]?.trim()}</span>
                  {p.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                      isActive ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {p.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
