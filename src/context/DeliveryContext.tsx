import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  PortalRole, 
  SystemSettings, 
  Vendor, 
  MenuItem, 
  CustomerAddress, 
  CustomerUser,
  Rider, 
  Order, 
  OrderStatus,
  UserAccount,
  DELIVERY_ZONES,
  DeliveryZone,
  RiderMessage,
  AdBanner,
  VendorReview
} from '../types/database';
import { 
  DEFAULT_SETTINGS, 
  INITIAL_ZONES,
  INITIAL_VENDORS, 
  INITIAL_MENU_ITEMS, 
  INITIAL_ADDRESSES, 
  INITIAL_CUSTOMERS,
  INITIAL_RIDERS, 
  INITIAL_ORDERS,
  INITIAL_FOOD_CATEGORIES,
  supabase,
  isSupabaseConfigured,
  updateSupabaseCredentials,
  getSupabaseConfig
} from '../services/supabase';
import { calculateDistanceKm, calculateDeliveryFee, findZoneForPoint, isPointInZone } from '../utils/geo';
import { FoodCategory } from '../types/database';
import { MASTER_FOOD_CATEGORIES } from '../utils/categories';

export interface CartItemOption {
  groupName: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedVariations?: CartItemOption[];
  specialInstructions?: string;
  unitPrice?: number;
}

interface DeliveryContextType {
  role: PortalRole;
  setRole: (role: PortalRole) => void;
  
  // Auth & Multi-User Privacy State
  currentUser: UserAccount | null;
  currentCustomer: CustomerUser | null;
  customers: CustomerUser[];
  loginUser: (role: PortalRole, phone: string, password?: string) => { success: boolean; requiresPasswordSetup?: boolean; message?: string };
  setPasswordForUser: (role: PortalRole, phone: string, newPassword: string) => boolean;
  registerCustomer: (data: { name: string; phone: string; password: string; email?: string }) => { success: boolean; message?: string };
  requestCustomerSignupOtp: (data: { name: string; phone: string; password: string; email?: string }) => Promise<{ success: boolean; customerId?: string; message?: string }>;
  verifyCustomerSignupOtp: (customerId: string, enteredOtp: string, data: { name: string; phone: string; password: string; email?: string }) => Promise<{ success: boolean; message?: string }>;
  updateCustomerProfile: (data: { name: string; phone: string; email?: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; message: string }>;
  requestCustomerProfileOtp: (phone: string) => Promise<{ success: boolean; otpId?: string; message?: string }>;
  verifyCustomerProfileOtp: (otpId: string, enteredOtp: string, phone: string) => Promise<{ success: boolean; message?: string }>;
  deleteCustomer?: (id: string) => void;
  logoutUser: () => void;

  // Delivery & Rider Zones (Admin Configured Boundary & Map)
  zones: DeliveryZone[];
  addZone: (zone: Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'>) => Promise<DeliveryZone>;
  updateZone: (id: string, updates: Partial<DeliveryZone>) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;
  toggleZoneActive: (id: string) => Promise<void>;

  // System Settings
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  
  // Vendors & Admin Management
  vendors: Vendor[];
  currentVendor: Vendor | null;
  setCurrentVendor: (vendor: Vendor) => void;
  adminRegisterVendor: (data: {
    name: string;
    phone: string;
    address: string;
    cuisine: string;
    zone: string;
    latitude: number;
    longitude: number;
    description?: string;
    vendor_type?: 'restaurant' | 'shop';
    restaurant_type?: 'restaurant' | 'cloud_kitchen' | 'home_kitchen';
    google_maps_link?: string;
  }) => Promise<{ vendor: Vendor; savedToDatabase: boolean; dbMessage?: string }>;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  uploadVendorImage: (
    vendorName: string, 
    file: File, 
    type: 'logo' | 'cover',
    oldUrl?: string
  ) => Promise<{ success: boolean; url?: string; message?: string }>;
  deleteVendorImage: (
    vendorId: string,
    type: 'logo' | 'cover'
  ) => Promise<{ success: boolean; message?: string }>;
  toggleVendorPause: (id: string) => void;
  deleteVendor: (id: string) => void;
  
  // Menu Items
  menuItems: MenuItem[];
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  toggleMenuItemAvailability: (id: string) => void;
  deleteMenuItem: (id: string) => void;

  // Food Categories (Configurable by Admin)
  foodCategories: FoodCategory[];
  addFoodCategory: (category: Omit<FoodCategory, 'id'>) => void;
  updateFoodCategory: (id: string, updates: Partial<FoodCategory>) => void;
  deleteFoodCategory: (id: string) => void;

  // Promotional Ads & Hero Banners
  adBanners: AdBanner[];
  addAdBanner: (ad: Omit<AdBanner, 'id'>) => void;
  updateAdBanner: (id: string, updates: Partial<AdBanner>) => void;
  deleteAdBanner: (id: string) => void;
  toggleAdBannerStatus: (id: string) => void;
  
  // Customer Addresses & Map Pin Points
  addresses: CustomerAddress[];
  selectedAddress: CustomerAddress | null;
  setSelectedAddress: (addr: CustomerAddress) => void;
  activateAddress: (id: string) => Promise<void>;
  addAddress: (addr: Omit<CustomerAddress, 'id'>) => CustomerAddress;
  updateAddress: (id: string, updates: Partial<CustomerAddress>) => void;
  deleteAddress: (id: string) => void;
  
  // Customer Favorites
  favorites: string[];
  toggleFavorite: (vendorId: string, e?: React.MouseEvent) => Promise<void>;
  isFavorite: (vendorId: string) => boolean;

  
  // Riders & Fleet Management
  riders: Rider[];
  currentRider: Rider | null;
  setCurrentRider: (rider: Rider) => void;
  adminRegisterRider: (data: {
    phone: string;
    name?: string;
    photo_url?: string;
    home_address?: string;
    zone?: string;
    vehicle_type?: 'Motorcycle' | 'Bicycle' | 'Scooter';
    latitude?: number;
    longitude?: number;
  }) => Promise<{ rider: Rider; savedToDatabase: boolean; dbMessage?: string }>;
  completeRiderRegistration: (data: {
    phone: string;
    name?: string;
    password: string;
    zone?: string;
    vehicle_type?: 'Motorcycle' | 'Bicycle' | 'Scooter';
  }) => Promise<{ success: boolean; message: string; rider?: Rider }>;
  updateRiderProfile: (riderId: string, updates: Partial<Rider>) => Promise<{ success: boolean; message: string }>;
  toggleRiderOnline: (riderId: string, isOnline: boolean) => Promise<boolean>;
  toggleRiderPause: (riderId: string) => void;
  deleteRider: (riderId: string) => void;
  updateRiderLocation: (riderId: string, lat: number, lng: number) => void;
  simulateRiderMovement: (stepLat: number, stepLng: number) => void;
  
  // Cart & Order Workflow
  orders: Order[];
  cart: CartItem[];
  cartVendor: Vendor | null;
  addToCart: (
    item: MenuItem, 
    vendor: Vendor, 
    quantityToAdd?: number, 
    selectedVariations?: CartItemOption[], 
    specialInstructions?: string,
    customUnitPrice?: number
  ) => void;
  removeFromCart: (menuItemId: string) => void;
  updateCartQuantity: (menuItemId: string, qty: number) => void;
  clearCart: () => void;
  placeOrder: (instructions?: string) => Promise<Order | null>;
  
  // Step-by-Step Vendor Prep & Customer Confirmation
  vendorAcceptOrderWithPrepTime: (orderId: string, prepMinutes: number) => void;
  customerRespondToPrepTime: (orderId: string, accept: boolean) => void;
  vendorMarkFoodReady: (orderId: string) => void;
  
  // Intelligent Single-Rider Proximity & Zone Dispatch
  triggerRiderDispatch: (orderId: string) => boolean;
  riderAcceptOrder: (orderId: string, riderId: string) => void;
  riderRejectOrder: (orderId: string, riderId: string) => void;
  
  // Cash on Delivery Handover
  riderConfirmCashPaidToVendor: (orderId: string) => void;
  riderConfirmCashCollectedFromCustomer: (orderId: string) => void;
  
  updateOrderStatus: (orderId: string, status: OrderStatus, extra?: Partial<Order>) => void;
  playNotificationSound: () => void;

  // Reviews & Ratings
  reviews: VendorReview[];
  addOrderReview: (review: Omit<VendorReview, 'id' | 'created_at'>) => Promise<{ success: boolean; message: string; review?: VendorReview }>;

  // Admin Broadcast & Direct Messaging to Riders
  riderMessages: RiderMessage[];
  sendAdminMessage: (msg: Omit<RiderMessage, 'id' | 'created_at'>) => void;
  markRiderMessageAsRead: (msgId: string) => void;
  isSupabaseConfigured: boolean;
  supabaseConfig: { url: string; anonKey: string; isConfigured: boolean };
  connectSupabase: (url: string, anonKey: string) => Promise<{ success: boolean; message: string }>;
  syncAllToSupabase: () => Promise<{ success: boolean; message: string; vendorsCount: number; ridersCount: number }>;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'foodvibe_v3_';
const PAUSED_RIDERS_STORAGE_KEY = `${STORAGE_KEY_PREFIX}paused_rider_ids`;

export const getStoredPausedRiderIds = (): Set<string> => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(PAUSED_RIDERS_STORAGE_KEY) : null;
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

export const saveStoredPausedRiderIds = (ids: Set<string>) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PAUSED_RIDERS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
    }
  } catch (e) {
    console.warn('Failed to save paused rider IDs to storage:', e);
  }
};

const foodiplaceRealtimeChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('foodiplace_realtime_sync')
  : null;

function safeJsonParse<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.error(`Failed to parse localStorage key "${key}":`, err);
    return fallback;
  }
}

const isValidUUID = (str?: string): boolean => {
  return Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str));
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const DeliveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State
  // Persistent Role: checks URL hash, query param, and localStorage so refreshing never resets to home
  const [role, setRoleState] = useState<PortalRole>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('subadmin.html')) return 'subadmin';
      if (path.includes('vendor.html')) return 'vendor';
      if (path.includes('rider.html')) return 'rider';
      if (path.includes('admin.html')) return 'admin';

      const params = new URLSearchParams(window.location.search);
      const portalQuery = params.get('portal') as PortalRole;
      if (['customer', 'vendor', 'rider', 'admin', 'subadmin'].includes(portalQuery)) return portalQuery;

      // Persist active portal from logged in user role if they are logged in
      const savedUser = safeJsonParse<UserAccount | null>(`${STORAGE_KEY_PREFIX}current_user`, null);
      if (savedUser && ['customer', 'vendor', 'rider', 'admin', 'subadmin'].includes(savedUser.role)) {
        return savedUser.role;
      }

      const rawHash = window.location.hash.replace('#', '').split('?')[0] as PortalRole;
      if (['customer', 'vendor', 'rider', 'admin', 'subadmin'].includes(rawHash)) return rawHash;
    }
    return 'customer';
  });

  const setRole = (newRole: PortalRole) => {
    setRoleState(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodiplace_active_portal', newRole);
      const currentHash = window.location.hash.replace('#', '').split('?')[0];
      if (currentHash !== newRole) {
        window.location.hash = `#${newRole}`;
      }
    }
  };

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    return safeJsonParse<UserAccount | null>(`${STORAGE_KEY_PREFIX}current_user`, null);
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    return safeJsonParse(`${STORAGE_KEY_PREFIX}settings`, DEFAULT_SETTINGS);
  });

  const [zones, setZones] = useState<DeliveryZone[]>(() => {
    const parsed = safeJsonParse(`${STORAGE_KEY_PREFIX}zones`, INITIAL_ZONES);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ZONES;
  });

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    const parsed = safeJsonParse<Vendor[]>(`${STORAGE_KEY_PREFIX}vendors`, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const [currentVendor, setCurrentVendorState] = useState<Vendor | null>(() => {
    const initialList = safeJsonParse<Vendor[]>(`${STORAGE_KEY_PREFIX}vendors`, []);
    const list = Array.isArray(initialList) ? initialList : [];
    const savedVendorId = typeof window !== 'undefined' ? localStorage.getItem(`${STORAGE_KEY_PREFIX}selected_vendor_id`) : null;
    if (savedVendorId) {
      const match = list.find(v => v.id === savedVendorId);
      if (match) return match;
    }
    return list[0] || null;
  });

  const setCurrentVendor = (vendor: Vendor | ((prev: Vendor | null) => Vendor | null)) => {
    setCurrentVendorState(prev => {
      const next = typeof vendor === 'function' ? vendor(prev) : vendor;
      if (typeof window !== 'undefined' && next?.id) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}selected_vendor_id`, next.id);
      }
      return next;
    });
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const parsed = safeJsonParse(`${STORAGE_KEY_PREFIX}menu_items`, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  // Customer accounts ONLY load from the database (never hardcoded or persisted to localStorage)
  const [customers, setCustomers] = useState<CustomerUser[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}customers`);
        localStorage.removeItem('foodvibe_v3_customers');
        localStorage.removeItem('foodiplace_customers');
        localStorage.removeItem('delivery_app_customers');
      } catch {}
    }
    return [];
  });

  const [allAddresses, setAllAddresses] = useState<CustomerAddress[]>(() => {
    const parsed = safeJsonParse<CustomerAddress[]>(`${STORAGE_KEY_PREFIX}addresses`, []);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map(item => ({
      ...item,
      id: isValidUUID(item.id) ? item.id : generateUUID(),
      status: item.status || (item.is_default ? 'active' : 'inactive')
    }));
  });

  const [reviews, setReviews] = useState<VendorReview[]>(() => {
    const parsed = safeJsonParse<VendorReview[]>(`${STORAGE_KEY_PREFIX}reviews`, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}reviews`, JSON.stringify(reviews));
    } catch {}
  }, [reviews]);

  // Strict user-isolated addresses list (Only shows the logged-in customer's own addresses)
  const addresses = React.useMemo(() => {
    if (!currentUser || currentUser.role !== 'customer') {
      return allAddresses.filter(a => !a.customer_phone || a.customer_phone === 'guest');
    }
    const cleanPhone = (currentUser.phone || '').replace(/\D/g, '');
    return allAddresses.filter(a => {
      const aClean = (a.customer_phone || '').replace(/\D/g, '');
      return (cleanPhone && aClean && aClean === cleanPhone) || 
             (a.customer_id && currentUser.id && a.customer_id === currentUser.id) ||
             (a.customer_phone && currentUser.phone && a.customer_phone === currentUser.phone);
    });
  }, [allAddresses, currentUser]);

  const [selectedAddress, setSelectedAddressState] = useState<CustomerAddress | null>(() => {
    const active = addresses.find(a => a?.status === 'active');
    if (active) return active;
    const def = addresses.find(a => a?.is_default);
    if (def) return def;
    return addresses[0] || null;
  });

  // Sync addresses to localStorage whenever allAddresses changes
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}addresses`, JSON.stringify(allAddresses));
    } catch {}
  }, [allAddresses]);

  // Customer Favorites State (Isolated per customer, supports guest)
  const [favorites, setFavorites] = useState<string[]>(() => {
    const custPhone = currentUser?.phone || 'guest';
    const custId = currentUser?.id || '';
    const cleanIdentifier = (custPhone || '').replace(/\D/g, '') || custId || 'guest';
    const local = safeJsonParse<string[]>(`${STORAGE_KEY_PREFIX}favorites_${cleanIdentifier}`, []);
    return Array.isArray(local) ? local : [];
  });

  // Load favorites for active customer from local storage, server API & Supabase
  useEffect(() => {
    const custPhone = (currentUser?.phone || '').replace(/\D/g, '') || 'guest';
    const custId = currentUser?.id || '';
    const cleanIdentifier = custPhone !== 'guest' ? custPhone : (custId || 'guest');

    // 1. Load from local cache immediately
    try {
      const saved = safeJsonParse<string[]>(`${STORAGE_KEY_PREFIX}favorites_${cleanIdentifier}`, []);
      if (Array.isArray(saved) && saved.length > 0) {
        setFavorites(saved);
      }
    } catch {}

    // 2. Fetch from backend server API
    fetch(`/api/favorites/${encodeURIComponent(cleanIdentifier)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.favorites && Array.isArray(data.favorites)) {
          setFavorites(data.favorites);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}favorites_${cleanIdentifier}`, JSON.stringify(data.favorites));
          } catch {}
        }
      })
      .catch(() => {});

    // 3. Fetch from Supabase favorites table
    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          let query = supabase.from('favorites').select('vendor_id');
          if (cleanIdentifier !== 'guest') {
            const orConditions = [`customer_phone.eq.${cleanIdentifier}`];
            if (currentUser?.phone) orConditions.push(`customer_phone.eq.${currentUser.phone}`);
            if (custId && isValidUUID(custId)) orConditions.push(`customer_id.eq.${custId}`);
            query = query.or(orConditions.join(','));
          } else {
            query = query.eq('customer_phone', 'guest');
          }

          const { data, error } = await query;
          if (!error && data && Array.isArray(data)) {
            const list = data.map((d: any) => d.vendor_id).filter(Boolean);
            if (list.length > 0) {
              setFavorites(list);
              try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}favorites_${cleanIdentifier}`, JSON.stringify(list));
              } catch {}
            }
          }
        } catch (err) {
          console.warn('Supabase fetch favorites error:', err);
        }
      })();
    }
  }, [currentUser?.id, currentUser?.phone, isSupabaseConfigured]);


  // Strict user-isolated vendor sync (Ensure vendor account only loads logged-in vendor data)
  useEffect(() => {
    if (currentUser?.role === 'vendor') {
      const match = vendors.find(v => 
        (currentUser.reference_id && v.id === currentUser.reference_id) || 
        (currentUser.phone && v.phone === currentUser.phone)
      );
      if (match) {
        setCurrentVendorState(match);
      }
    }
  }, [currentUser, vendors]);

  // Load addresses strictly for active customer from server database & Supabase
  useEffect(() => {
    const cleanIdentifier = currentUser && currentUser.role === 'customer'
      ? (currentUser.phone || '').replace(/\D/g, '') || currentUser.id
      : 'guest';

    const fetchAddresses = async () => {
      let loadedRemote: CustomerAddress[] = [];

      // 1. Fetch from server backend API
      try {
        const res = await fetch(`/api/addresses/${encodeURIComponent(cleanIdentifier)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.addresses && Array.isArray(data.addresses)) {
            loadedRemote = data.addresses;
          }
        }
      } catch (err) {
        console.warn('Backend addresses fetch error:', err);
      }

      // 2. Fetch from Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          let query = supabase.from('customer_addresses').select('*');
          if (cleanIdentifier !== 'guest') {
            const rawPhone = currentUser?.phone || '';
            query = query.or(`customer_phone.eq.${rawPhone},customer_phone.eq.${cleanIdentifier}`);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data) && data.length > 0) {
            for (const row of data) {
              const existingIdx = loadedRemote.findIndex(a => a.id === row.id);
              if (existingIdx >= 0) {
                loadedRemote[existingIdx] = { ...loadedRemote[existingIdx], ...row };
              } else {
                loadedRemote.push(row as CustomerAddress);
              }
            }
          }
        } catch (supaErr) {
          console.warn('Supabase customer_addresses load notice:', supaErr);
        }
      }

      if (loadedRemote.length > 0) {
        // Ensure at least one has status: 'active'
        const hasActive = loadedRemote.some(a => a.status === 'active');
        if (!hasActive) {
          const defIdx = loadedRemote.findIndex(a => a.is_default);
          const activeItem = defIdx >= 0 ? loadedRemote[defIdx] : loadedRemote[0];
          activeItem.status = 'active';
          activeItem.is_default = true;
          loadedRemote.forEach(a => {
            if (a.id !== activeItem.id) {
              a.status = 'inactive';
              a.is_default = false;
            }
          });
        }

        setAllAddresses(prev => {
          const others = prev.filter(a => {
            const aClean = (a.customer_phone || '').replace(/\D/g, '');
            return cleanIdentifier !== 'guest' 
              ? (aClean !== cleanIdentifier && a.customer_id !== currentUser?.id)
              : (a.customer_phone && a.customer_phone !== 'guest');
          });
          return [...loadedRemote, ...others];
        });

        const activeAddr = loadedRemote.find(a => a.status === 'active') || loadedRemote.find(a => a.is_default) || loadedRemote[0] || null;
        setSelectedAddressState(activeAddr);
      } else {
        // Fallback to local
        const userLocal = allAddresses.filter(a => {
          if (cleanIdentifier === 'guest') return !a.customer_phone || a.customer_phone === 'guest';
          const aClean = (a.customer_phone || '').replace(/\D/g, '');
          return (cleanIdentifier && aClean && aClean === cleanIdentifier) || 
                 (a.customer_id && currentUser?.id && a.customer_id === currentUser.id);
        });
        const active = userLocal.find(a => a.status === 'active') || userLocal.find(a => a.is_default) || userLocal[0] || null;
        setSelectedAddressState(active);
      }
    };

    fetchAddresses();
  }, [currentUser?.id, currentUser?.phone, currentUser?.role, isSupabaseConfigured]);

  // Riders state: strictly enforces persistent is_paused so paused riders never auto-resume
  const [riders, setRiders] = useState<Rider[]>(() => {
    const list: Rider[] = safeJsonParse(`${STORAGE_KEY_PREFIX}riders`, []);
    const validList = Array.isArray(list) ? list : [];
    const pausedIds = getStoredPausedRiderIds();
    return validList.map(r => {
      if (!r) return r;
      const isPaused = pausedIds.has(r.id) ? true : Boolean(r.is_paused);
      return {
        ...r,
        is_paused: isPaused,
        is_online: isPaused ? false : Boolean(r.is_online)
      };
    });
  });

  const [currentRider, setCurrentRider] = useState<Rider | null>(() => riders[0] || null);

  const [orders, setOrders] = useState<Order[]>(() => {
    const parsed = safeJsonParse(`${STORAGE_KEY_PREFIX}orders`, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const [foodCategories, setFoodCategories] = useState<FoodCategory[]>(() => {
    const parsed = safeJsonParse<FoodCategory[]>(`${STORAGE_KEY_PREFIX}food_categories`, []);
    const masterMap = new Map(MASTER_FOOD_CATEGORIES.map(c => [c.name.toLowerCase().trim(), c]));
    if (Array.isArray(parsed)) {
      parsed.forEach(c => {
        if (c && c.name) {
          const norm = c.name.toLowerCase().trim();
          if (!masterMap.has(norm)) {
            masterMap.set(norm, c);
          }
        }
      });
    }
    return Array.from(masterMap.values());
  });

  const [adBanners, setAdBanners] = useState<AdBanner[]>([]);

  // Fetch ad banners from backend server and Supabase on mount
  useEffect(() => {
    const fetchAdBanners = async () => {
      let loadedRemote: AdBanner[] = [];

      // 1. Fetch from server backend API
      try {
        const res = await fetch('/api/banners');
        if (res.ok) {
          const sBanners = await res.json();
          if (Array.isArray(sBanners) && sBanners.length > 0) {
            loadedRemote = sBanners;
          }
        }
      } catch (e) {
        console.warn('Server banners fetch notice:', e);
      }

      // 2. Fetch from Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('ads_banners')
            .select('*')
            .order('order_index', { ascending: true });
          
          if (error) {
            console.error('Error fetching ads from Supabase:', error);
          } else if (data && data.length > 0) {
            const supaAds = data.map((d: any) => ({
              ...d,
              portal_type: d.portal_type || (d.target_category === 'grocery' ? 'grocery' : 'food')
            })) as AdBanner[];
            
            for (const sa of supaAds) {
              if (!loadedRemote.some(r => r.id === sa.id)) {
                loadedRemote.push(sa);
              }
            }
          }
        } catch (err) {
          console.error('Failed to load ads from database:', err);
        }
      }
      
      const savedAds = safeJsonParse<AdBanner[]>(`${STORAGE_KEY_PREFIX}ad_banners`, []);
      
      // Combine remote and local ads (filtering out any legacy dummy/sample banners)
      let combined = loadedRemote.filter(a => !a.id?.startsWith('ad-top-hero-') && !a.id?.startsWith('ad-middle-') && !a.id?.startsWith('default-'));
      
      if (Array.isArray(savedAds)) {
        for (const localAd of savedAds) {
          if (localAd.id?.startsWith('ad-top-hero-') || localAd.id?.startsWith('ad-middle-') || localAd.id?.startsWith('default-')) {
            continue;
          }
          if (!combined.some(c => c.id === localAd.id)) {
            combined.push(localAd);
          }
        }
      }

      setAdBanners(combined);
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}ad_banners`, JSON.stringify(combined));
      } catch (e) {}
    };

    fetchAdBanners();
  }, [isSupabaseConfigured, supabase]);

  // Listen for real-time broadcast updates across open browser tabs
  useEffect(() => {
    if (!foodiplaceRealtimeChannel) return;
    const handleBroadcastMsg = (e: MessageEvent) => {
      const data = e.data;
      if (data?.type === 'RIDER_UPDATE') {
        const { riderId, updates } = data;
        const pausedIds = getStoredPausedRiderIds();
        if (updates.is_paused !== undefined) {
          if (updates.is_paused) pausedIds.add(riderId);
          else pausedIds.delete(riderId);
          saveStoredPausedRiderIds(pausedIds);
        }
        setRiders(prev => prev.map(r => {
          if (r.id !== riderId) return r;
          const isPaused = updates.is_paused !== undefined 
            ? updates.is_paused 
            : (pausedIds.has(r.id) ? true : Boolean(r.is_paused));
          return {
            ...r,
            ...updates,
            is_paused: isPaused,
            is_online: isPaused ? false : (updates.is_online !== undefined ? updates.is_online : r.is_online)
          };
        }));
        setCurrentRider(prev => (prev && prev.id === riderId ? { ...prev, ...updates } : prev));
      } else if (data?.type === 'ORDER_UPDATE') {
        const { order } = data;
        setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      } else if (data?.type === 'NEW_ORDER') {
        const { order } = data;
        setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
      } else if (data?.type === 'ORDERS_SYNC') {
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      } else if (data?.type === 'ORDER_REVIEW_SUBMITTED' && data?.review) {
        setReviews(prev => {
          const idx = prev.findIndex(r => r.order_code === data.review.order_code || r.id === data.review.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.review;
            return copy;
          }
          return [data.review, ...prev];
        });
      } else if (data?.type === 'BANNER_SYNC' && Array.isArray(data.banners)) {
        setAdBanners(data.banners);
      } else if (data?.type === 'ADDRESS_ACTIVATED' && data?.addressId) {
        const { addressId, cleanIdentifier } = data;
        setAllAddresses(prev => prev.map(a => {
          const aClean = (a.customer_phone || '').replace(/\D/g, '');
          const isSameCust = (cleanIdentifier && aClean && cleanIdentifier === aClean) ||
                             (cleanIdentifier === 'guest' && (!a.customer_phone || a.customer_phone === 'guest'));
          if (isSameCust) {
            return {
              ...a,
              status: (a.id === addressId ? 'active' : 'inactive') as 'active' | 'inactive',
              is_default: a.id === addressId
            };
          }
          return a;
        }));
        setSelectedAddressState(prev => {
          if (!prev) return null;
          return prev.id === addressId ? { ...prev, status: 'active', is_default: true } : prev;
        });
      } else if (data?.type === 'CUSTOMER_PROFILE_UPDATED') {
        const { customer } = data;
        if (customer && customer.id) {
          setCustomers(prev => {
            const idx = prev.findIndex(c => c.id === customer.id || c.phone === customer.phone);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...customer };
              return updated;
            }
            return [...prev, customer];
          });
        }
      }
    };
    foodiplaceRealtimeChannel.addEventListener('message', handleBroadcastMsg);
    return () => foodiplaceRealtimeChannel.removeEventListener('message', handleBroadcastMsg);
  }, []);

  // Listen to window storage event for instant cross-tab sync of paused riders
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PAUSED_RIDERS_STORAGE_KEY) {
        const pausedIds = getStoredPausedRiderIds();
        setRiders(prev => prev.map(r => {
          const isPaused = pausedIds.has(r.id);
          return {
            ...r,
            is_paused: isPaused,
            is_online: isPaused ? false : r.is_online
          };
        }));
        setCurrentRider(prev => {
          if (!prev) return null;
          const isPaused = pausedIds.has(prev.id);
          return {
            ...prev,
            is_paused: isPaused,
            is_online: isPaused ? false : prev.is_online
          };
        });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Fetch vendors and riders from database on mount & continuously poll every 2 seconds
  useEffect(() => {
    let isSubscribed = true;

    const fetchVendorsAndRiders = async () => {
      let fetchedRiders: Rider[] | null = null;

      // 1. Try Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: zData, error: zError } = await supabase
            .from('zones')
            .select('*')
            .order('name', { ascending: true });
          if (!zError && zData && Array.isArray(zData) && zData.length > 0 && isSubscribed) {
            setZones(zData as DeliveryZone[]);
          }

          const { data: vData, error: vError } = await supabase
            .from('vendors')
            .select('*');
          if (!vError && vData && isSubscribed) {
            setVendors(vData as Vendor[]);
          }

          const { data: rData, error: rError } = await supabase
            .from('riders')
            .select('*');
          if (!rError && rData && Array.isArray(rData) && rData.length > 0) {
            fetchedRiders = rData as Rider[];
          }

          const { data: catData, error: catError } = await supabase
            .from('food_categories')
            .select('*');
          if (!catError && catData && isSubscribed && Array.isArray(catData)) {
            setFoodCategories(() => {
              const masterMap = new Map(MASTER_FOOD_CATEGORIES.map(c => [c.name.toLowerCase().trim(), c]));
              (catData as FoodCategory[]).forEach(c => {
                if (c && c.name) {
                  const norm = c.name.toLowerCase().trim();
                  if (!masterMap.has(norm)) {
                    masterMap.set(norm, c);
                  }
                }
              });
              return Array.from(masterMap.values());
            });
          }

          const { data: menuData, error: menuError } = await supabase
            .from('menu_items')
            .select('*');
          if (!menuError && menuData && isSubscribed && Array.isArray(menuData)) {
            setMenuItems(menuData as MenuItem[]);
          }

          // Fetch customers strictly from Supabase customers table (single source of truth)
          const { data: custData, error: custError } = await supabase
            .from('customers')
            .select('*');
          if (!custError && isSubscribed) {
            setCustomers(Array.isArray(custData) ? (custData as CustomerUser[]) : []);
          }

          // Fetch orders from Supabase with relational items
          const { data: oSupadata, error: oSupaerror } = await supabase
            .from('orders')
            .select('*');
          if (!oSupaerror && oSupadata && isSubscribed && Array.isArray(oSupadata) && oSupadata.length > 0) {
            const { data: itemsData } = await supabase.from('order_items').select('*');
            const resolvedOrders = oSupadata.map(o => {
              const oItems = Array.isArray(itemsData) ? itemsData.filter(it => it.order_id === o.id) : [];
              return {
                ...o,
                items: oItems,
                vendor: vendors.find(v => v.id === o.vendor_id) || null
              };
            });
            resolvedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setOrders(resolvedOrders);
          }
        } catch (err) {
          console.error('Failed to load from Supabase:', err);
        }
      }

      // 2. Query backend server database /api/zones and /api/riders for cross-browser synchronization
      try {
        const vRes = await fetch('/api/vendors');
        if (vRes.ok) {
          const vData = await vRes.json();
          if (Array.isArray(vData) && isSubscribed) {
            setVendors(vData);
          }
        }
      } catch {}

      try {
        const mRes = await fetch('/api/menu-items');
        if (mRes.ok) {
          const mData = await mRes.json();
          if (Array.isArray(mData) && isSubscribed) {
            setMenuItems(mData);
          }
        }
      } catch {}

      try {
        const catRes = await fetch('/api/food-categories');
        if (catRes.ok) {
          const catData = await catRes.json();
          if (Array.isArray(catData) && isSubscribed) {
            setFoodCategories(() => {
              const masterMap = new Map(MASTER_FOOD_CATEGORIES.map(c => [c.name.toLowerCase().trim(), c]));
              catData.forEach(c => {
                if (c && c.name) {
                  const norm = c.name.toLowerCase().trim();
                  if (!masterMap.has(norm)) {
                    masterMap.set(norm, c);
                  }
                }
              });
              return Array.from(masterMap.values());
            });
          }
        }
      } catch {}

      try {
        const oRes = await fetch('/api/orders');
        if (oRes.ok) {
          const oData = await oRes.json();
          if (Array.isArray(oData) && isSubscribed) {
            setOrders(oData);
          }
        }
      } catch {}

      try {
        const revRes = await fetch('/api/reviews');
        if (revRes.ok) {
          const revData = await revRes.json();
          if (Array.isArray(revData) && isSubscribed) {
            setReviews(revData);
          }
        }
      } catch {}

      try {
        const zRes = await fetch('/api/zones');
        if (zRes.ok) {
          const zData = await zRes.json();
          if (Array.isArray(zData) && zData.length > 0 && isSubscribed) {
            setZones(zData as DeliveryZone[]);
          }
        }
      } catch {
        // Ignore offline network error
      }

      try {
        const res = await fetch('/api/riders');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // If Supabase didn't provide riders or as fallback, use server database
            if (!fetchedRiders) {
              fetchedRiders = data as Rider[];
            } else {
              // Merge server paused state if present
              const serverMap = new Map((data as Rider[]).map(r => [r.id, r]));
              fetchedRiders = fetchedRiders.map(r => {
                const sRider = serverMap.get(r.id);
                if (sRider && sRider.is_paused !== undefined && r.is_paused === undefined) {
                  return { ...r, is_paused: sRider.is_paused };
                }
                return r;
              });
            }
          }
        }
      } catch {
        // Ignore offline network error
      }

      // 3. Query backend server database /api/customers for cross-browser synchronization when Supabase is not configured
      if (!isSupabaseConfigured) {
        try {
          const cRes = await fetch('/api/customers');
          if (cRes.ok) {
            const cData = await cRes.json();
            if (isSubscribed) {
              setCustomers(Array.isArray(cData) ? (cData as CustomerUser[]) : []);
            }
          }
        } catch {
          // Ignore offline network error
        }
      }

      if (fetchedRiders && isSubscribed) {
        const safeRiders: Rider[] = fetchedRiders.map(r => {
          const isPaused = Boolean(r.is_paused);
          return {
            ...r,
            is_paused: isPaused,
            is_online: isPaused ? false : Boolean(r.is_online)
          };
        });

        setRiders(safeRiders);
        // If current rider is in list, sync currentRider state
        setCurrentRider(prev => {
          if (!prev) return null;
          const matched = safeRiders.find(r => r.id === prev.id);
          return matched ? { ...prev, ...matched } : prev;
        });
      }
    };

    fetchVendorsAndRiders();

    // 2s periodic polling ensures live updates across separate browsers/devices
    const intervalId = setInterval(fetchVendorsAndRiders, 2000);

    // Also connect to Supabase Realtime channel if available
    let realtimeChannelInstance: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        realtimeChannelInstance = supabase
          .channel('public:riders_live_channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, (payload: any) => {
            if (!isSubscribed) return;
            if (payload.eventType === 'UPDATE' && payload.new) {
              const rNew = payload.new as Rider;
              const remotePaused = Boolean(rNew.is_paused);
              const safeNew: Rider = {
                ...rNew,
                is_paused: remotePaused,
                is_online: remotePaused ? false : Boolean(rNew.is_online)
              };
              setRiders(prev => prev.map(r => r.id === safeNew.id ? safeNew : r));
              setCurrentRider(prev => (prev && prev.id === safeNew.id ? { ...prev, ...safeNew } : prev));
            } else if (payload.eventType === 'INSERT' && payload.new) {
              const rNew = payload.new as Rider;
              const remotePaused = Boolean(rNew.is_paused);
              const safeNew: Rider = {
                ...rNew,
                is_paused: remotePaused,
                is_online: remotePaused ? false : Boolean(rNew.is_online)
              };
              setRiders(prev => [safeNew, ...prev.filter(r => r.id !== safeNew.id)]);
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setRiders(prev => prev.filter(r => r.id !== payload.old.id));
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload: any) => {
            if (!isSubscribed) return;
            if (payload.eventType === 'INSERT' && payload.new) {
              const cNew = payload.new as CustomerUser;
              setCustomers(prev => [...prev.filter(c => c.id !== cNew.id), cNew]);
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const cNew = payload.new as CustomerUser;
              setCustomers(prev => prev.map(c => c.id === cNew.id ? { ...c, ...cNew } : c));
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription warning:', err);
      }
    }

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      if (realtimeChannelInstance && supabase) {
        supabase.removeChannel(realtimeChannelInstance);
      }
    };
  }, []);

  const [riderMessages, setRiderMessages] = useState<RiderMessage[]>(() => {
    const defaultMsgs: RiderMessage[] = [
      {
        id: 'msg-101',
        recipient_rider_id: 'ALL',
        sender: 'foodiplace Admin',
        title: 'Welcome to foodiplace Rider Fleet! 🛵',
        body: 'Keep your GPS location active and status set to Online to receive automatic cash order dispatches.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        is_read: false
      },
      {
        id: 'msg-102',
        recipient_rider_id: 'ALL',
        sender: 'foodiplace Operations',
        title: 'Daily Cash Bonus Alert! 💰',
        body: 'Complete 10 cash deliveries today in Chawkbazar or GEC Zone and earn an extra ৳200 bonus credited to your wallet.',
        created_at: new Date(Date.now() - 18000000).toISOString(),
        is_read: false
      }
    ];
    const parsed = safeJsonParse(`${STORAGE_KEY_PREFIX}rider_messages`, defaultMsgs);
    return Array.isArray(parsed) ? parsed : defaultMsgs;
  });

  const getCustomerCartKey = (user: UserAccount | null): string => {
    if (user && user.role === 'customer') {
      const cleanPhone = user.phone ? user.phone.replace(/\D/g, '') : '';
      const id = cleanPhone || user.reference_id || user.id;
      return `cust_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
    return 'guest';
  };

  const [cart, setCart] = useState<CartItem[]>(() => {
    const custKey = getCustomerCartKey(safeJsonParse<UserAccount | null>(`${STORAGE_KEY_PREFIX}current_user`, null));
    return safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${custKey}`, []);
  });

  const [cartVendor, setCartVendor] = useState<Vendor | null>(() => {
    const custKey = getCustomerCartKey(safeJsonParse<UserAccount | null>(`${STORAGE_KEY_PREFIX}current_user`, null));
    return safeJsonParse<Vendor | null>(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`, null);
  });

  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(cfg => {
        if (cfg && cfg.url && cfg.anonKey) {
          const current = getSupabaseConfig();
          if (!current.isConfigured || !current.url) {
            updateSupabaseCredentials(cfg.url, cfg.anonKey);
            setSupabaseConfig(getSupabaseConfig());
          }
        }
      })
      .catch(() => {});
  }, []);

  // Switch and load cart dynamically and strictly per customer account
  useEffect(() => {
    const custKey = getCustomerCartKey(currentUser);
    const localCart = safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${custKey}`, []);
    const localVendor = safeJsonParse<Vendor | null>(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`, null);
    setCart(localCart);
    setCartVendor(localVendor);

    // 1. Fetch from backend database server (Fast local cache)
    fetch(`/api/cart/${encodeURIComponent(custKey)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.cart && Array.isArray(data.cart.items) && data.cart.items.length > 0) {
          setCart(data.cart.items);
          setCartVendor(data.cart.vendor || null);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${custKey}`, JSON.stringify(data.cart.items));
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`, JSON.stringify(data.cart.vendor || null));
        } else if (localCart.length > 0) {
          // Sync local to server if server is empty
          fetch(`/api/cart/${encodeURIComponent(custKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: localCart, vendor: localVendor })
          }).catch(() => {});
        }
      })
      .catch(() => {});

    // 2. Fetch from Supabase (Persistent remote storage)
    if (supabaseConfig.isConfigured && supabase) {
      supabase
        .from('customer_carts')
        .select('*')
        .eq('customer_id', custKey)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            const remoteItems = data.cart_items || [];
            const remoteVendor = data.vendor || null;
            
            // Only update if remote is newer or local is empty
            if (remoteItems.length > 0) {
              setCart(remoteItems);
              setCartVendor(remoteVendor);
              localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${custKey}`, JSON.stringify(remoteItems));
              localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`, JSON.stringify(remoteVendor));
            }
          }
        });
    }
  }, [currentUser?.reference_id, currentUser?.phone, currentUser?.role, currentUser?.id, supabaseConfig.isConfigured]);

  const persistCustomerCart = (items: CartItem[], vendor: Vendor | null, custKeyOverride?: string) => {
    const custKey = custKeyOverride || getCustomerCartKey(currentUser);
    
    if (items.length === 0) {
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_${custKey}`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`);
      } catch {}
      fetch(`/api/cart/${encodeURIComponent(custKey)}`, { method: 'DELETE' }).catch(() => {});
      if (supabaseConfig.isConfigured && supabase) {
        supabase.from('customer_carts').delete().eq('customer_id', custKey).then(() => {}, () => {});
      }
      return;
    }

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${custKey}`, JSON.stringify(items));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`, JSON.stringify(vendor));
    } catch {}

    // Save to Database server
    fetch(`/api/cart/${encodeURIComponent(custKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, vendor })
    }).catch(err => console.warn('Failed to save cart to server:', err));

    // Save to Supabase if configured
    if (supabaseConfig.isConfigured && supabase) {
      supabase
        .from('customer_carts')
        .upsert([{
          customer_id: custKey,
          cart_items: items,
          vendor: vendor,
          updated_at: new Date().toISOString()
        }])
        .then(({ error }) => {
          if (error) {
            console.error('Supabase cart sync error:', error);
          }
        }, (err: any) => {
          console.warn('Supabase cart sync exception:', err);
        });
    }
  };

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}vendors`, JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}menu_items`, JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}zones`, JSON.stringify(zones));
  }, [zones]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}vendors`, JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}menu_items`, JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}food_categories`, JSON.stringify(foodCategories));
  }, [foodCategories]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}ad_banners`, JSON.stringify(adBanners));
  }, [adBanners]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}rider_messages`, JSON.stringify(riderMessages));
  }, [riderMessages]);

  // Customer accounts are NOT stored in localStorage - only loaded from database

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}riders`, JSON.stringify(riders));
  }, [riders]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}orders`, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user`, JSON.stringify(currentUser));
  }, [currentUser]);

  // -------------------------------------------------------------
  // RIDERS & DELIVERY ZONES (ADMIN MAP BOUNDARY & CONFIG)
  // -------------------------------------------------------------
  const addZone = async (zoneData: Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryZone> => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
    const newZone: DeliveryZone = {
      ...zoneData,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setZones(prev => {
      const updated = [...prev.filter(z => z.id !== newId && z.name.toLowerCase() !== newZone.name.toLowerCase()), newZone];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}zones`, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newZone)
      });
    } catch (err) {
      console.warn('API add zone error:', err);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('zones').upsert([newZone]);
      } catch (err) {
        console.warn('Supabase add zone error:', err);
      }
    }

    return newZone;
  };

  const updateZone = async (id: string, updates: Partial<DeliveryZone>) => {
    setZones(prev => {
      const updated = prev.map(z => z.id === id ? { ...z, ...updates, updated_at: new Date().toISOString() } : z);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}zones`, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await fetch(`/api/zones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.warn('API update zone error:', err);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('zones').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase update zone error:', err);
      }
    }
  };

  const deleteZone = async (id: string) => {
    setZones(prev => {
      const updated = prev.filter(z => z.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}zones`, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await fetch(`/api/zones/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('API delete zone error:', err);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('zones').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete zone error:', err);
      }
    }
  };

  const toggleZoneActive = async (id: string) => {
    const target = zones.find(z => z.id === id);
    if (!target) return;
    const nextActive = !target.is_active;
    await updateZone(id, { is_active: nextActive });
  };

  // Derived current customer
  const currentCustomer = currentUser && currentUser.role === 'customer'
    ? customers.find(c => {
        if (currentUser.reference_id && c.id === currentUser.reference_id) return true;
        if (c.phone === currentUser.phone) return true;
        const cDigits = (c.phone || '').replace(/\D/g, '');
        const uDigits = (currentUser.phone || '').replace(/\D/g, '');
        return Boolean(cDigits && uDigits && (cDigits === uDigits || cDigits.endsWith(uDigits) || uDigits.endsWith(cDigits)));
      }) || null
    : null;

  // Sound notification
  const addOrderReview = async (reviewData: Omit<VendorReview, 'id' | 'created_at'>) => {
    const newReview: VendorReview = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    // 1. Update local reviews immediately
    setReviews(prev => {
      const idx = prev.findIndex(r => 
        (r.order_code && r.order_code === newReview.order_code) ||
        (r.order_id && r.order_id === newReview.order_id)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newReview;
        return copy;
      }
      return [newReview, ...prev];
    });

    // 2. Recalculate vendor rating locally
    setVendors(prev => prev.map(v => {
      if (v.id === newReview.vendor_id) {
        const allVendorReviews = [newReview, ...reviews.filter(r => r.vendor_id === v.id && r.order_code !== newReview.order_code)];
        const avg = allVendorReviews.reduce((sum, r) => sum + r.rating, 0) / allVendorReviews.length;
        return { ...v, rating: Math.round(avg * 10) / 10 };
      }
      return v;
    }));

    // 3. Post to backend server /api/reviews
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview)
      });
    } catch (e) {
      console.warn('Failed to post review to server:', e);
    }

    // 4. Save to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('reviews')
          .upsert([{
            id: newReview.id,
            vendor_id: newReview.vendor_id,
            order_id: newReview.order_id || null,
            order_code: newReview.order_code,
            customer_id: newReview.customer_id || null,
            customer_name: newReview.customer_name || 'Customer',
            customer_phone: newReview.customer_phone || null,
            rating: newReview.rating,
            comment: newReview.comment,
            mentioned_items: newReview.mentioned_items || [],
            vendor_reply: newReview.vendor_reply || null,
            created_at: newReview.created_at
          }], { onConflict: 'order_code' });
      } catch (err) {
        console.warn('Supabase review insert notice:', err);
      }
    }

    // 5. Broadcast to other tabs
    try {
      if (foodiplaceRealtimeChannel) {
        foodiplaceRealtimeChannel.postMessage({
          type: 'ORDER_REVIEW_SUBMITTED',
          review: newReview
        });
      }
    } catch {}

    return { success: true, message: 'Review submitted successfully!', review: newReview };
  };

  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Ignore
    }
  };

  // -------------------------------------------------------------
  // USER AUTHENTICATION & LOGIN WORKFLOW
  // -------------------------------------------------------------
  const loginUser = (userRole: PortalRole, phone: string, password?: string) => {
    const cleanPhone = phone.trim();

    if (userRole === 'admin') {
      if (password === 'admin123' || password === '123' || !password) {
        const adminAccount: UserAccount = {
          id: 'admin-001',
          role: 'admin',
          name: 'System Admin',
          phone: cleanPhone || '01700000000',
          is_password_set: true
        };
        setCurrentUser(adminAccount);
        return { success: true };
      }
      return { success: false, message: 'Invalid Admin Password' };
    }

    if (userRole === 'vendor') {
      const vendor = vendors.find(v => v.phone.replace(/\D/g, '').endsWith(cleanPhone.replace(/\D/g, '')) || v.phone === cleanPhone);
      if (!vendor) {
        return { success: false, message: 'This phone number is not registered as a Vendor by Admin.' };
      }

      // If first time login (no password set yet)
      if (!vendor.is_password_set || !vendor.password) {
        return { 
          success: false, 
          requiresPasswordSetup: true, 
          message: 'First-time login detected. Please set your new password.' 
        };
      }

      if (vendor.password !== password) {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }

      const vendorAccount: UserAccount = {
        id: `u-v-${vendor.id}`,
        role: 'vendor',
        name: vendor.name,
        phone: vendor.phone,
        is_password_set: true,
        reference_id: vendor.id,
        zone: vendor.zone
      };
      setCurrentUser(vendorAccount);
      setCurrentVendor(vendor);
      return { success: true };
    }

    if (userRole === 'rider') {
      const rider = riders.find(r => {
        if (!r || !r.phone) return false;
        const rDigits = String(r.phone).replace(/\D/g, '');
        const cleanDigits = String(cleanPhone).replace(/\D/g, '');
        return (rDigits && cleanDigits && rDigits.endsWith(cleanDigits)) || r.phone === cleanPhone;
      });
      if (!rider) {
        return { 
          success: false, 
          message: 'Phone number not found. If you are new, click Rider Registration below to join.' 
        };
      }

      if (!rider.is_password_set || !rider.password) {
        return { 
          success: false, 
          requiresPasswordSetup: true, 
          message: 'First-time login detected. Please set your new password.' 
        };
      }

      if (rider.password !== password) {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }

      const riderAccount: UserAccount = {
        id: `u-r-${rider.id}`,
        role: 'rider',
        name: rider.name,
        phone: rider.phone,
        is_password_set: true,
        reference_id: rider.id,
        zone: rider.zone,
        photo_url: rider.photo_url
      };
      setCurrentUser(riderAccount);
      setCurrentRider(rider);
      return { success: true };
    }

    if (userRole === 'customer') {
      const customer = customers.find(c => c.phone.replace(/\D/g, '').endsWith(cleanPhone.replace(/\D/g, '')) || c.phone === cleanPhone);
      if (!customer) {
        return { success: false, message: 'Account not found. Please register first.' };
      }

      if (customer.password && customer.password !== password) {
        return { success: false, message: 'Incorrect password.' };
      }

      const customerAccount: UserAccount = {
        id: `u-c-${customer.id}`,
        role: 'customer',
        name: customer.name,
        phone: customer.phone,
        is_password_set: true,
        reference_id: customer.id
      };

      // If guest had cart items and logging-in customer has no cart, migrate guest cart
      const guestKey = 'guest';
      const guestCart = safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${guestKey}`, []);
      const guestVendor = safeJsonParse<Vendor | null>(`${STORAGE_KEY_PREFIX}cart_vendor_${guestKey}`, null);
      const userKey = getCustomerCartKey(customerAccount);
      const userCart = safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${userKey}`, []);
      if (userCart.length === 0 && guestCart.length > 0) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${userKey}`, JSON.stringify(guestCart));
        localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${userKey}`, JSON.stringify(guestVendor));
        fetch(`/api/cart/${encodeURIComponent(userKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: guestCart, vendor: guestVendor })
        }).catch(() => {});
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_${guestKey}`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_vendor_${guestKey}`);
        fetch(`/api/cart/${encodeURIComponent(guestKey)}`, { method: 'DELETE' }).catch(() => {});
      }

      setCurrentUser(customerAccount);
      return { success: true };
    }

    return { success: false, message: 'Unknown role' };
  };

  const setPasswordForUser = (userRole: PortalRole, phone: string, newPassword: string): boolean => {
    const cleanPhone = phone.trim();

    if (userRole === 'vendor') {
      const vendor = vendors.find(v => v.phone.replace(/\D/g, '').endsWith(cleanPhone.replace(/\D/g, '')) || v.phone === cleanPhone);
      if (!vendor) return false;
      
      setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, password: newPassword, is_password_set: true } : v));
      
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('vendors')
          .update({ password: newPassword, is_password_set: true })
          .eq('id', vendor.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error updating vendor password in Supabase:', error);
            }
          });
      }

      const vendorAccount: UserAccount = {
        id: `u-v-${vendor.id}`,
        role: 'vendor',
        name: vendor.name,
        phone: vendor.phone,
        is_password_set: true,
        reference_id: vendor.id,
        zone: vendor.zone
      };
      setCurrentUser(vendorAccount);
      setCurrentVendor({ ...vendor, password: newPassword, is_password_set: true });
      return true;
    }

    if (userRole === 'rider') {
      const rider = riders.find(r => r.phone.replace(/\D/g, '').endsWith(cleanPhone.replace(/\D/g, '')) || r.phone === cleanPhone);
      if (!rider) return false;

      setRiders(prev => prev.map(r => r.id === rider.id ? { ...r, password: newPassword, is_password_set: true } : r));

      if (isSupabaseConfigured && supabase) {
        supabase
          .from('riders')
          .update({ password: newPassword, is_password_set: true })
          .eq('id', rider.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error updating rider password in Supabase:', error);
            }
          });
      }

      const riderAccount: UserAccount = {
        id: `u-r-${rider.id}`,
        role: 'rider',
        name: rider.name,
        phone: rider.phone,
        is_password_set: true,
        reference_id: rider.id,
        zone: rider.zone,
        photo_url: rider.photo_url
      };
      setCurrentUser(riderAccount);
      setCurrentRider({ ...rider, password: newPassword, is_password_set: true });
      return true;
    }

    return false;
  };

  const registerCustomer = (data: { name: string; phone: string; password: string; email?: string }) => {
    const cleanPhone = data.phone.trim();
    const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');
    if (customers.some(c => (c.phone || '').replace(/\D/g, '') === cleanPhoneDigits)) {
      return { success: false, message: 'This phone number is already registered. Please login.' };
    }

    const newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    const newCustomer: CustomerUser = {
      id: newId,
      name: data.name.trim(),
      phone: cleanPhone,
      password: data.password,
      email: data.email?.trim(),
      avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
      addresses: [],
      created_at: new Date().toISOString()
    };

    setCustomers(prev => [...prev, newCustomer]);
    
    const customerAccount: UserAccount = {
      id: `u-c-${newCustomer.id}`,
      role: 'customer',
      name: newCustomer.name,
      phone: newCustomer.phone,
      is_password_set: true,
      reference_id: newCustomer.id
    };

    // Save customer account to database server
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer)
    }).catch(() => {});

    // Save directly to Supabase `customers` table
    if (isSupabaseConfigured && supabase) {
      const supaCustPayload = {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone,
        password: newCustomer.password || '',
        email: newCustomer.email || null,
        avatar_url: newCustomer.avatar_url || null,
        created_at: newCustomer.created_at
      };
      supabase.from('customers').upsert([supaCustPayload]).then(({ error }) => {
        if (error) console.warn('Supabase customer upsert warning:', error);
      });
    }

    // Migrate any guest cart items to new customer account
    const guestKey = 'guest';
    const guestCart = safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${guestKey}`, []);
    const guestVendor = safeJsonParse<Vendor | null>(`${STORAGE_KEY_PREFIX}cart_vendor_${guestKey}`, null);
    const userKey = getCustomerCartKey(customerAccount);
    if (guestCart.length > 0) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${userKey}`, JSON.stringify(guestCart));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${userKey}`, JSON.stringify(guestVendor));
      fetch(`/api/cart/${encodeURIComponent(userKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: guestCart, vendor: guestVendor })
      }).catch(() => {});
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_${guestKey}`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_vendor_${guestKey}`);
      fetch(`/api/cart/${encodeURIComponent(guestKey)}`, { method: 'DELETE' }).catch(() => {});
    }

    setCurrentUser(customerAccount);
    return { success: true };
  };

  const requestCustomerSignupOtp = async (data: {
    name: string;
    phone: string;
    password: string;
    email?: string;
  }): Promise<{ success: boolean; customerId?: string; message?: string }> => {
    const cleanPhone = (data.phone || '').trim();
    const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');

    if (!data.name?.trim() || !cleanPhone || !data.password) {
      return { success: false, message: 'Name, Phone and Password are required.' };
    }

    // Customer accounts only exist if registered in database (Supabase / server database)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existingCusts, error: checkErr } = await supabase
          .from('customers')
          .select('id, phone');
        if (!checkErr && Array.isArray(existingCusts) && existingCusts.length > 0) {
          const alreadyExists = existingCusts.some((c: any) => 
            (c.phone || '').replace(/\D/g, '') === cleanPhoneDigits || (c.phone || '').trim() === cleanPhone
          );
          if (alreadyExists) {
            return { success: false, message: 'This phone number is already registered. Please login.' };
          }
        }
      } catch (err) {
        console.warn('Supabase customer verification check:', err);
      }
    } else {
      try {
        const res = await fetch('/api/customers');
        if (res.ok) {
          const dbCusts: CustomerUser[] = await res.json();
          if (Array.isArray(dbCusts) && dbCusts.some(c => (c.phone || '').replace(/\D/g, '') === cleanPhoneDigits)) {
            return { success: false, message: 'This phone number is already registered. Please login.' };
          }
        }
      } catch {}
    }

    const customerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    // In accordance with user requirement and exact schema:
    // Table: `otp_sender`
    // Columns: `id` (uuid), `phone_number` (text), `otp` (text - left empty for SMS app)
    const otpPayload: Record<string, any> = {
      id: customerId,
      phone_number: cleanPhone
    };

    // 1. Insert into Supabase `otp_sender` table
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('otp_sender').insert([{
          id: customerId,
          phone_number: cleanPhone
        }]);

        if (error) {
          console.warn('Supabase otp_sender insert error (phone_number):', error.message || error);
          // Fallback if column happens to be named phone
          const fallbackRes = await supabase.from('otp_sender').insert([{
            id: customerId,
            phone: cleanPhone
          }]);
          if (fallbackRes.error) {
            console.warn('Supabase otp_sender insert fallback error:', fallbackRes.error.message || fallbackRes.error);
          } else {
            console.log('Successfully inserted row into otp_sender (phone column)');
          }
        } else {
          console.log('Successfully inserted row into Supabase otp_sender table:', { id: customerId, phone_number: cleanPhone });
        }
      } catch (err) {
        console.warn('Supabase otp_sender insert exception:', err);
      }
    }

    // 2. Insert into server database /api/otp_sender
    try {
      await fetch('/api/otp_sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otpPayload)
      });
    } catch (err) {
      console.warn('Server /api/otp_sender insert exception:', err);
    }

    return { success: true, customerId };
  };

  const verifyCustomerSignupOtp = async (
    customerId: string,
    enteredOtp: string,
    data: { name: string; phone: string; password: string; email?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    const cleanInput = (enteredOtp || '').trim();
    if (!cleanInput) {
      return { success: false, message: 'Please enter the OTP verification code sent via SMS.' };
    }

    const cleanPhone = (data.phone || '').trim();
    let dbOtp: string | null = null;

    // 1. Read from Supabase `otp_sender` table
    if (isSupabaseConfigured && supabase) {
      try {
        // Query by id
        const { data: supaRow } = await supabase
          .from('otp_sender')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();

        if (supaRow && (supaRow.otp || supaRow.Otp || supaRow.OTP)) {
          dbOtp = String(supaRow.otp || supaRow.Otp || supaRow.OTP).trim();
        } else {
          // Query latest row by phone_number
          const { data: pNumRow } = await supabase
            .from('otp_sender')
            .select('*')
            .eq('phone_number', cleanPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pNumRow && (pNumRow.otp || pNumRow.Otp || pNumRow.OTP)) {
            dbOtp = String(pNumRow.otp || pNumRow.Otp || pNumRow.OTP).trim();
          } else {
            // Also check by phone column if exists
            const { data: phoneRow } = await supabase
              .from('otp_sender')
              .select('*')
              .eq('phone', cleanPhone)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (phoneRow && (phoneRow.otp || phoneRow.Otp || phoneRow.OTP)) {
              dbOtp = String(phoneRow.otp || phoneRow.Otp || phoneRow.OTP).trim();
            }
          }
        }
      } catch (e) {
        console.warn('Supabase otp_sender query notice:', e);
      }
    }

    // 2. If not found in Supabase or Supabase unconfigured, query server DB /api/otp_sender/:id
    if (!dbOtp) {
      try {
        const res = await fetch(`/api/otp_sender/${encodeURIComponent(customerId)}`);
        if (res.ok) {
          const sRow = await res.json();
          if (sRow && (sRow.otp || sRow.Otp || sRow.OTP)) {
            dbOtp = String(sRow.otp || sRow.Otp || sRow.OTP).trim();
          }
        }
      } catch (e) {
        console.warn('Server /api/otp_sender query notice:', e);
      }
    }

    // If OTP column is not yet generated by the external app
    if (!dbOtp) {
      return { 
        success: false, 
        message: 'OTP is still being generated or dispatched by SMS app. Please wait a few seconds and try again.' 
      };
    }

    // Check & Match: "system check and match kore dekbe Otp colum a create howa code er shate customer er privide kora code er mil ace ki na ba match hochche ki na"
    if (cleanInput !== dbOtp) {
      return { 
        success: false, 
        message: 'Incorrect OTP code. The code you entered does not match the code in SMS.' 
      };
    }

    // MATCH SUCCESS: "jodi match hoy tahole customer signup complate hobe then customers table a add hobe"
    const newCustomer: CustomerUser = {
      id: customerId,
      name: data.name.trim(),
      phone: cleanPhone,
      password: data.password,
      email: data.email?.trim(),
      avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
      addresses: [],
      created_at: new Date().toISOString()
    };

    setCustomers(prev => {
      if (prev.some(c => c.id === customerId)) return prev;
      return [...prev, newCustomer];
    });

    const customerAccount: UserAccount = {
      id: `u-c-${newCustomer.id}`,
      role: 'customer',
      name: newCustomer.name,
      phone: newCustomer.phone,
      is_password_set: true,
      reference_id: newCustomer.id
    };

    // Save directly to Supabase `customers` table
    if (isSupabaseConfigured && supabase) {
      const supaCustPayload = {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone,
        password: newCustomer.password || '',
        email: newCustomer.email || null,
        avatar_url: newCustomer.avatar_url || null,
        created_at: newCustomer.created_at
      };
      supabase.from('customers').upsert([supaCustPayload]).then(({ error }) => {
        if (error) console.warn('Supabase customer upsert warning:', error);
      });
    }

    // Save to server database (/api/customers)
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer)
    }).catch(() => {});

    // Migrate any guest cart items to new customer account
    const guestKey = 'guest';
    const guestCart = safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${guestKey}`, []);
    const guestVendor = safeJsonParse<Vendor | null>(`${STORAGE_KEY_PREFIX}cart_vendor_${guestKey}`, null);
    const userKey = getCustomerCartKey(customerAccount);
    if (guestCart.length > 0) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${userKey}`, JSON.stringify(guestCart));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${userKey}`, JSON.stringify(guestVendor));
      fetch(`/api/cart/${encodeURIComponent(userKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: guestCart, vendor: guestVendor })
      }).catch(() => {});
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_${guestKey}`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_vendor_${guestKey}`);
      fetch(`/api/cart/${encodeURIComponent(guestKey)}`, { method: 'DELETE' }).catch(() => {});
    }

    setCurrentUser(customerAccount);
    return { success: true, message: 'Signup completed successfully!' };
  };

  const requestCustomerProfileOtp = async (phone: string): Promise<{ success: boolean; otpId?: string; message?: string }> => {
    const cleanPhone = (phone || '').trim();
    if (!cleanPhone) {
      return { success: false, message: 'Valid phone number is required.' };
    }

    const otpId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    const otpPayload: Record<string, any> = {
      id: otpId,
      phone_number: cleanPhone
    };

    // 1. Insert into Supabase `otp_sender` table
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('otp_sender').insert([{
          id: otpId,
          phone_number: cleanPhone
        }]);

        if (error) {
          console.warn('Supabase otp_sender insert error (phone_number):', error.message || error);
          const fallbackRes = await supabase.from('otp_sender').insert([{
            id: otpId,
            phone: cleanPhone
          }]);
          if (fallbackRes.error) {
            console.warn('Supabase otp_sender insert fallback error:', fallbackRes.error.message || fallbackRes.error);
          } else {
            console.log('Successfully inserted row into otp_sender (phone column)');
          }
        } else {
          console.log('Successfully inserted row into Supabase otp_sender table:', { id: otpId, phone_number: cleanPhone });
        }
      } catch (err) {
        console.warn('Supabase otp_sender insert exception:', err);
      }
    }

    // 2. Insert into server database /api/otp_sender
    try {
      await fetch('/api/otp_sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otpPayload)
      });
    } catch (err) {
      console.warn('Server /api/otp_sender insert exception:', err);
    }

    return { success: true, otpId };
  };

  const verifyCustomerProfileOtp = async (
    otpId: string,
    enteredOtp: string,
    phone: string
  ): Promise<{ success: boolean; message?: string }> => {
    const cleanInput = (enteredOtp || '').trim();
    if (!cleanInput) {
      return { success: false, message: 'Please enter the OTP verification code sent via SMS.' };
    }

    const cleanPhone = (phone || '').trim();
    let dbOtp: string | null = null;

    // 1. Read from Supabase `otp_sender` table
    if (isSupabaseConfigured && supabase) {
      try {
        // Query by id
        const { data: supaRow } = await supabase
          .from('otp_sender')
          .select('*')
          .eq('id', otpId)
          .maybeSingle();

        if (supaRow && (supaRow.otp || supaRow.Otp || supaRow.OTP)) {
          dbOtp = String(supaRow.otp || supaRow.Otp || supaRow.OTP).trim();
        } else {
          // Query latest row by phone_number
          const { data: pNumRow } = await supabase
            .from('otp_sender')
            .select('*')
            .eq('phone_number', cleanPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pNumRow && (pNumRow.otp || pNumRow.Otp || pNumRow.OTP)) {
            dbOtp = String(pNumRow.otp || pNumRow.Otp || pNumRow.OTP).trim();
          } else {
            // Also check by phone column if exists
            const { data: phoneRow } = await supabase
              .from('otp_sender')
              .select('*')
              .eq('phone', cleanPhone)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (phoneRow && (phoneRow.otp || phoneRow.Otp || phoneRow.OTP)) {
              dbOtp = String(phoneRow.otp || phoneRow.Otp || phoneRow.OTP).trim();
            }
          }
        }
      } catch (e) {
        console.warn('Supabase otp_sender query notice:', e);
      }
    }

    // 2. If not found in Supabase or Supabase unconfigured, query server DB /api/otp_sender/:id
    if (!dbOtp) {
      try {
        const res = await fetch(`/api/otp_sender/${encodeURIComponent(otpId)}`);
        if (res.ok) {
          const sRow = await res.json();
          if (sRow && (sRow.otp || sRow.Otp || sRow.OTP)) {
            dbOtp = String(sRow.otp || sRow.Otp || sRow.OTP).trim();
          }
        }
      } catch (e) {
        console.warn('Server /api/otp_sender query notice:', e);
      }
    }

    if (!dbOtp) {
      return { 
        success: false, 
        message: 'OTP is still being generated or dispatched by SMS app. Please wait a few seconds and try again.' 
      };
    }

    if (cleanInput !== dbOtp) {
      return { 
        success: false, 
        message: 'Incorrect OTP code. The code you entered does not match the code in SMS.' 
      };
    }

    return { success: true };
  };

  const updateCustomerProfile = async (data: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    avatar_url?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanPhone = data.phone.trim();
    const cleanName = data.name.trim();
    const cleanEmail = (data.email || '').trim();
    const cleanPassword = (data.password || '').trim();

    if (!cleanName) {
      return { success: false, message: 'Name cannot be empty.' };
    }
    if (!cleanPhone) {
      return { success: false, message: 'Phone number cannot be empty.' };
    }

    // Determine target customer
    let targetCustomer = currentCustomer;
    if (!targetCustomer && currentUser && currentUser.role === 'customer') {
      const cleanUserPhone = (currentUser.phone || '').replace(/\D/g, '');
      targetCustomer = customers.find(c => 
        c.id === currentUser.reference_id || 
        c.phone === currentUser.phone || 
        (cleanUserPhone && c.phone && c.phone.replace(/\D/g, '') === cleanUserPhone)
      ) || null;
    }

    const previousPhone = targetCustomer?.phone || currentUser?.phone || '';
    const customerId = targetCustomer?.id || currentUser?.reference_id || (currentUser?.id ? currentUser.id.replace(/^u-c-/, '') : `c-${Date.now()}`);

    const updatedCustomer: CustomerUser = {
      ...(targetCustomer || {
        id: customerId,
        password: cleanPassword,
        created_at: new Date().toISOString(),
        addresses: []
      }),
      id: customerId,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      ...(cleanPassword ? { password: cleanPassword } : {}),
      avatar_url: data.avatar_url || targetCustomer?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    };

    // 1. Update customers state & local storage
    setCustomers(prev => {
      const cleanPrevPhone = previousPhone.replace(/\D/g, '');
      const idx = prev.findIndex(c => 
        c.id === customerId || 
        (cleanPrevPhone && c.phone && c.phone.replace(/\D/g, '') === cleanPrevPhone) || 
        c.phone === previousPhone
      );
      let updated: CustomerUser[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], ...updatedCustomer };
      } else {
        updated = [...prev, updatedCustomer];
      }
      return updated;
    });

    // 2. Update currentUser session state & localStorage
    const updatedAccount: UserAccount = {
      id: `u-c-${customerId}`,
      role: 'customer',
      name: cleanName,
      phone: cleanPhone,
      is_password_set: true,
      reference_id: customerId
    };
    setCurrentUser(updatedAccount);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}current_user`, JSON.stringify(updatedAccount));
      localStorage.setItem('foodhub_customer_phone', cleanPhone);
      localStorage.setItem('foodhub_customer_name', cleanName);
    }

    // 3. Update customer addresses (if phone/name changed)
    setAllAddresses((prev: CustomerAddress[]) => {
      const cleanPrevPhone = previousPhone.replace(/\D/g, '');
      const updated = prev.map((a: CustomerAddress) => {
        const aClean = (a.customer_phone || '').replace(/\D/g, '');
        if (
          a.customer_id === customerId || 
          (cleanPrevPhone && aClean === cleanPrevPhone) || 
          a.customer_phone === previousPhone
        ) {
          return {
            ...a,
            customer_name: cleanName,
            customer_phone: cleanPhone,
            customer_id: customerId
          };
        }
        return a;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}addresses`, JSON.stringify(updated));
      }
      return updated;
    });

    // 4. Migrate cart if phone key changed
    if (previousPhone && previousPhone !== cleanPhone) {
      const oldUserAccount: UserAccount = {
        id: `u-c-${customerId}`,
        role: 'customer',
        name: cleanName,
        phone: previousPhone,
        is_password_set: true,
        reference_id: customerId
      };
      const oldCartKey = getCustomerCartKey(oldUserAccount);
      const newCartKey = getCustomerCartKey(updatedAccount);
      if (oldCartKey !== newCartKey) {
        const oldCart = safeJsonParse<CartItem[]>(`${STORAGE_KEY_PREFIX}cart_${oldCartKey}`, []);
        const oldVendor = safeJsonParse<Vendor | null>(`${STORAGE_KEY_PREFIX}cart_vendor_${oldCartKey}`, null);
        if (oldCart.length > 0) {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_${newCartKey}`, JSON.stringify(oldCart));
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cart_vendor_${newCartKey}`, JSON.stringify(oldVendor));
          fetch(`/api/cart/${encodeURIComponent(newCartKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: oldCart, vendor: oldVendor })
          }).catch(() => {});
          localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_${oldCartKey}`);
          localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_vendor_${oldCartKey}`);
          fetch(`/api/cart/${encodeURIComponent(oldCartKey)}`, { method: 'DELETE' }).catch(() => {});
        }
      }
    }

    // 5. Save to backend database server (/api/customers)
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedCustomer,
          oldPhone: previousPhone
        })
      });
    } catch (e) {
      console.warn('Backend /api/customers sync warning:', e);
    }

    // 6. Save directly to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
        const candidateTables = ['customers', 'customer_users'];

        for (const table of candidateTables) {
          try {
            let existingRow: any = null;

            // Search 1: by exact customerId (ONLY if valid UUID format to avoid Postgres syntax error)
            if (isUuid) {
              try {
                const { data: rowById, error: idErr } = await supabase
                  .from(table)
                  .select('*')
                  .eq('id', customerId)
                  .maybeSingle();
                if (!idErr && rowById) existingRow = rowById;
              } catch (e) {
                console.warn(`[Supabase] Search by ID error on ${table}:`, e);
              }
            }

            // Search 2: by cleanPhone or previousPhone
            if (!existingRow) {
              const phonesToSearch = [cleanPhone, previousPhone].filter(Boolean);
              for (const p of phonesToSearch) {
                try {
                  const { data: pRow } = await supabase
                    .from(table)
                    .select('*')
                    .eq('phone', p)
                    .maybeSingle();
                  if (pRow) {
                    existingRow = pRow;
                    break;
                  }
                  const { data: pNumRow } = await supabase
                    .from(table)
                    .select('*')
                    .eq('phone_number', p)
                    .maybeSingle();
                  if (pNumRow) {
                    existingRow = pNumRow;
                    break;
                  }
                } catch {}
              }
            }

            // Search 3: Normalized digits match from table
            if (!existingRow && cleanPhone) {
              try {
                const digits = cleanPhone.replace(/\D/g, '');
                const { data: recents } = await supabase
                  .from(table)
                  .select('*')
                  .limit(50);
                if (Array.isArray(recents) && recents.length > 0) {
                  existingRow = recents.find((r: any) => {
                    const rDig = String(r.phone || r.phone_number || '').replace(/\D/g, '');
                    return rDig && digits && (rDig === digits || rDig.endsWith(digits) || digits.endsWith(rDig));
                  }) || null;
                }
              } catch {}
            }

            if (existingRow) {
              const rowCols = Object.keys(existingRow);
              const payloadToUpdate: Record<string, any> = {
                name: cleanName
              };
              if (rowCols.includes('phone') && cleanPhone) {
                payloadToUpdate.phone = cleanPhone;
              } else if (rowCols.includes('phone_number') && cleanPhone) {
                payloadToUpdate.phone_number = cleanPhone;
              }
              if (cleanPassword && rowCols.includes('password')) {
                payloadToUpdate.password = cleanPassword;
              }
              if (cleanEmail && rowCols.includes('email')) {
                payloadToUpdate.email = cleanEmail;
              }
              if (rowCols.includes('updated_at')) {
                payloadToUpdate.updated_at = new Date().toISOString();
              }

              console.log(`[Supabase] Updating ${table} row ${existingRow.id} with payload:`, payloadToUpdate);
              const { error: updErr } = await supabase
                .from(table)
                .update(payloadToUpdate)
                .eq('id', existingRow.id);

              if (!updErr) {
                console.log(`✅ [Supabase] Updated customer successfully in ${table}:`, existingRow.id, cleanName);
                updatedCustomer.id = existingRow.id;
                break;
              } else {
                console.warn(`[Supabase] Full update failed in ${table}, retrying with { name }:`, updErr);
                const { error: minErr } = await supabase
                  .from(table)
                  .update({ name: cleanName })
                  .eq('id', existingRow.id);
                if (!minErr) {
                  console.log(`✅ [Supabase] Minimal name update succeeded in ${table}:`, existingRow.id, cleanName);
                  updatedCustomer.id = existingRow.id;
                  break;
                }
              }
            } else {
              // Direct fallback: try updating by phone or upserting row if it does not exist yet
              try {
                const { error: phoneDirectErr } = await supabase
                  .from(table)
                  .update({ name: cleanName })
                  .eq('phone', cleanPhone);
                if (!phoneDirectErr) {
                  console.log(`✅ [Supabase] Direct update by phone succeeded in ${table}:`, cleanPhone, cleanName);
                  break;
                }
              } catch {}

              // If row was not found in Supabase, upsert it so it is guaranteed to exist
              try {
                const newRowId = isUuid ? customerId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
                const upsertPayload: Record<string, any> = {
                  name: cleanName,
                  phone: cleanPhone,
                  password: cleanPassword || (targetCustomer?.password || '123456'),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                if (newRowId) upsertPayload.id = newRowId;
                if (cleanEmail) upsertPayload.email = cleanEmail;

                const { error: upsertErr } = await supabase
                  .from(table)
                  .upsert([upsertPayload]);
                if (!upsertErr) {
                  console.log(`✅ [Supabase] Upserted customer successfully in ${table}:`, cleanName, cleanPhone);
                  break;
                }
              } catch (uErr) {
                console.warn(`[Supabase] Upsert fallback warning in ${table}:`, uErr);
              }
            }
          } catch (tErr) {
            console.warn(`[Supabase] Table ${table} exception:`, tErr);
          }
        }

        // Re-query fresh customers from Supabase so local cache is in sync
        try {
          const { data: freshCusts } = await supabase.from('customers').select('*');
          if (Array.isArray(freshCusts) && freshCusts.length > 0) {
            setCustomers(freshCusts as CustomerUser[]);
          }
        } catch {}

        // Also update customer_addresses table
        if (previousPhone && previousPhone !== cleanPhone) {
          try {
            await supabase
              .from('customer_addresses')
              .update({ customer_phone: cleanPhone, customer_name: cleanName })
              .or(`customer_phone.eq.${previousPhone},customer_phone.eq.${cleanPhone}`);
          } catch {}
        }
      } catch (err) {
        console.warn('Supabase customer update exception:', err);
      }
    }

    // 7. Cross-tab sync
    try {
      foodiplaceRealtimeChannel?.postMessage({
        type: 'CUSTOMER_PROFILE_UPDATED',
        customer: updatedCustomer
      });
    } catch {}

    return { success: true, message: 'Profile updated in database!' };
  };

  const logoutUser = () => {
    setCurrentUser(null);
    setCart([]);
    setCartVendor(null);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}current_user`);
    } catch {}
  };

  const connectSupabase = async (url: string, anonKey: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = updateSupabaseCredentials(url, anonKey);
      setSupabaseConfig(getSupabaseConfig());
      
      if (!res.isConfigured || !res.client) {
        return { success: false, message: 'Please provide valid Supabase Project URL and Public Anon Key.' };
      }

      // Test querying riders
      const { error } = await res.client.from('riders').select('id').limit(1);
      if (error) {
        return { 
          success: false, 
          message: `Connected, but query to riders table failed: ${error.message} (${error.hint || error.details || 'Check if table exists & RLS is disabled'})` 
        };
      }

      // Load live records from Supabase
      try {
        const { data: vData } = await res.client.from('vendors').select('*');
        if (vData && vData.length > 0) {
          setVendors(vData as Vendor[]);
        }

        const { data: rData } = await res.client.from('riders').select('*');
        if (rData && rData.length > 0) {
          setRiders(rData as Rider[]);
        }
      } catch (loadErr) {
        console.warn('Initial data load warning:', loadErr);
      }

      return { success: true, message: 'Connected to Supabase database successfully!' };
    } catch (e: any) {
      return { success: false, message: `Connection error: ${e?.message || String(e)}` };
    }
  };

  const syncAllToSupabase = async () => {
    if (!supabase || !isSupabaseConfigured) {
      return { 
        success: false, 
        message: 'Supabase is not connected in this browser session. Enter URL and Key first.', 
        vendorsCount: 0, 
        ridersCount: 0 
      };
    }

    let rCount = 0;
    let vCount = 0;

    for (const r of riders) {
      try {
        const payload: Record<string, any> = {
          id: r.id,
          name: r.name,
          phone: r.phone,
          zone: r.zone || 'Chawkbazar Zone',
          is_online: r.is_online || false,
          is_paused: r.is_paused || false,
          is_approved: true,
          is_password_set: r.is_password_set || false,
          password: r.password || null
        };
        const { error } = await supabase.from('riders').upsert([payload]);
        if (!error) rCount++;
      } catch (err) {
        console.warn('Sync rider error:', err);
      }
    }

    for (const v of vendors) {
      try {
        const payload: Record<string, any> = {
          id: v.id,
          name: v.name,
          phone: v.phone,
          address: v.address || 'Chittagong',
          cuisine: v.cuisine || 'Fast Food',
          zone: v.zone || 'Chawkbazar Zone',
          latitude: v.latitude || 22.3585,
          longitude: v.longitude || 91.8385,
          is_active: v.is_active ?? true,
          is_paused: v.is_paused ?? false,
          vendor_type: v.vendor_type || 'restaurant'
        };
        const { error } = await supabase.from('vendors').upsert([payload]);
        if (!error) vCount++;
      } catch (err) {
        console.warn('Sync vendor error:', err);
      }
    }

    let zCount = 0;
    for (const z of zones) {
      try {
        const { error } = await supabase.from('zones').upsert([z]);
        if (!error) zCount++;
      } catch (err) {
        console.warn('Sync zone error:', err);
      }
    }

    let adCount = 0;
    for (const ad of adBanners) {
      try {
        const payload = {
          id: ad.id,
          title: ad.title,
          subtitle: ad.subtitle || null,
          action_text: ad.action_text || 'Redeem now',
          image_url: ad.image_url,
          target_vendor_id: ad.target_vendor_id || null,
          is_active: ad.is_active,
          order_index: ad.order_index || 0,
          portal_type: ad.portal_type || 'food'
        };
        const { error } = await supabase.from('ads_banners').upsert([payload]);
        if (!error) adCount++;
      } catch (err) {
        console.warn('Sync ad error:', err);
      }
    }

    let catCount = 0;
    for (const cat of foodCategories) {
      try {
        const payload = {
          id: cat.id,
          name: cat.name,
          icon: cat.icon || '🍽️',
          image_url: cat.image_url || null,
          is_active: cat.is_active !== false,
          order_index: cat.order_index || 0,
          category_type: cat.category_type || 'food'
        };
        const { error } = await supabase.from('food_categories').upsert([payload]);
        if (!error) catCount++;
      } catch (err) {
        console.warn('Sync category error:', err);
      }
    }

    let custCount = 0;
    for (const c of customers) {
      try {
        const payload = {
          id: c.id,
          name: c.name,
          phone: c.phone,
          password: c.password || '',
          email: c.email || null,
          avatar_url: c.avatar_url || null,
          created_at: c.created_at
        };
        const { error } = await supabase.from('customers').upsert([payload]);
        if (!error) custCount++;
      } catch (err) {
        console.warn('Sync customer error:', err);
      }
    }

    let addrCount = 0;
    for (const a of allAddresses) {
      try {
        const payload: Record<string, any> = {
          id: isValidUUID(a.id) ? a.id : generateUUID(),
          customer_phone: a.customer_phone || 'guest',
          customer_name: a.customer_name || 'Customer',
          label: a.label || 'Home',
          address_line: a.address_line,
          details: a.details || null,
          latitude: Number(a.latitude) || 22.3705,
          longitude: Number(a.longitude) || 91.8215,
          zone: a.zone || null,
          is_default: a.is_default ?? false,
          status: a.status || (a.is_default ? 'active' : 'inactive')
        };
        if (a.customer_id && isValidUUID(a.customer_id)) {
          payload.customer_id = a.customer_id;
        }
        const { error } = await supabase.from('customer_addresses').upsert([payload]);
        if (!error) addrCount++;
      } catch (err) {
        console.warn('Sync address error:', err);
      }
    }

    let favCount = 0;
    for (const vId of favorites) {
      try {
        const payload: Record<string, any> = {
          id: generateUUID(),
          vendor_id: vId,
          customer_phone: (currentUser?.phone || '').replace(/\D/g, '') || 'guest'
        };
        if (currentUser?.id && isValidUUID(currentUser.id)) {
          payload.customer_id = currentUser.id;
        }
        const { error } = await supabase.from('favorites').upsert([payload]);
        if (!error) favCount++;
      } catch (err) {
        console.warn('Sync favorite error:', err);
      }
    }

    return { 
      success: true, 
      message: `Synced ${rCount} riders, ${vCount} vendors, ${zCount} zones, ${adCount} banners, ${catCount} categories, ${custCount} customers, ${addrCount} addresses, and ${favCount} favorites!`, 
      ridersCount: rCount, 
      vendorsCount: vCount 
    };
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    if (isSupabaseConfigured && supabase) {
      supabase.from('customers').delete().eq('id', id).then();
    }
  };

  // -------------------------------------------------------------
  // ADMIN VENDOR & RIDER REGISTRATION
  // -------------------------------------------------------------
  const adminRegisterVendor = async (data: {
    name: string;
    phone: string;
    address: string;
    cuisine: string;
    zone: string;
    latitude: number;
    longitude: number;
    description?: string;
    vendor_type?: 'restaurant' | 'shop';
    restaurant_type?: 'restaurant' | 'cloud_kitchen' | 'home_kitchen';
    google_maps_link?: string;
  }): Promise<{ vendor: Vendor; savedToDatabase: boolean; dbMessage?: string }> => {
    const newVendor: Vendor = {
      id: crypto.randomUUID(),
      unique_id: `VND-${Math.floor(1000 + Math.random() * 9000)}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      cuisine: data.cuisine.trim(),
      zone: data.zone || 'Chawkbazar Zone',
      latitude: data.latitude,
      longitude: data.longitude,
      google_maps_link: data.google_maps_link || '',
      description: data.description || 'Quality food prepared with fresh ingredients',
      is_active: true,
      is_paused: false,
      rating: 5.0,
      estimated_prep_time_minutes: 20,
      is_password_set: false,
      vendor_type: data.vendor_type || 'restaurant',
      restaurant_type: data.restaurant_type || 'restaurant',
      cover_image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString()
    };

    let savedToDatabase = false;
    let dbMessage = '';

    if (isSupabaseConfigured && supabase) {
      try {
        const fullPayload = {
          id: newVendor.id,
          unique_id: newVendor.unique_id,
          name: newVendor.name,
          phone: newVendor.phone,
          address: newVendor.address,
          cuisine: newVendor.cuisine,
          zone: newVendor.zone,
          latitude: newVendor.latitude,
          longitude: newVendor.longitude,
          google_maps_link: newVendor.google_maps_link,
          description: newVendor.description,
          is_active: newVendor.is_active,
          is_paused: newVendor.is_paused,
          rating: newVendor.rating,
          estimated_prep_time_minutes: newVendor.estimated_prep_time_minutes,
          is_password_set: newVendor.is_password_set,
          password: null,
          vendor_type: newVendor.vendor_type,
          logo_url: newVendor.logo_url,
          cover_image: newVendor.cover_image,
          created_at: newVendor.created_at
        };

        const { error } = await supabase.from('vendors').insert([fullPayload]);
        if (error) {
          console.warn('Vendor full payload insert error:', error);
          const fallbackPayload: Record<string, any> = {
            id: newVendor.id,
            name: newVendor.name,
            phone: newVendor.phone,
            address: newVendor.address,
            latitude: newVendor.latitude,
            longitude: newVendor.longitude
          };
          const retryRes = await supabase.from('vendors').insert([fallbackPayload]);
          if (!retryRes.error) {
            savedToDatabase = true;
            dbMessage = 'Saved to Supabase vendors table (essential columns).';
          } else {
            dbMessage = `Database Error: ${retryRes.error.message || error.message}`;
          }
        } else {
          savedToDatabase = true;
          dbMessage = 'Saved to Supabase vendors table successfully.';
        }

        // Create a dedicated folder for this vendor in the 'images' bucket using vendor name
        try {
          const folderName = newVendor.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
          await supabase.storage.from('images').upload(`${folderName}/.keep`, new Blob(['folder created'], { type: 'text/plain' }), { upsert: true });
        } catch (storageErr) {
          console.warn('Storage bucket folder creation note:', storageErr);
        }
      } catch (err: any) {
        dbMessage = `Database Exception: ${err?.message || String(err)}`;
      }
    } else {
      dbMessage = 'Supabase is not connected in this browser session. Saved in Local Storage.';
    }

    setVendors(prev => [newVendor, ...prev]);
    return { vendor: newVendor, savedToDatabase, dbMessage };
  };

  const toggleVendorPause = (id: string) => {
    setVendors(prev => {
      const updated = prev.map(v => v.id === id ? { ...v, is_paused: !v.is_paused } : v);
      if (isSupabaseConfigured && supabase) {
        const matched = updated.find(x => x.id === id);
        if (matched) {
          supabase.from('vendors').update({ is_paused: matched.is_paused }).eq('id', id).then();
        }
      }
      return updated;
    });
  };

  const deleteVendor = async (id: string) => {
    const vendorToDelete = vendors.find(v => v.id === id);
    if (isSupabaseConfigured && supabase && vendorToDelete) {
      try {
        const folderName = vendorToDelete.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const { data: fileList } = await supabase.storage.from('images').list(folderName);
        if (fileList && fileList.length > 0) {
          const paths = fileList.map(f => `${folderName}/${f.name}`);
          await supabase.storage.from('images').remove(paths);
        }
      } catch (err) {
        console.warn('Vendor folder storage delete error:', err);
      }
      supabase.from('vendors').delete().eq('id', id).then();
    }
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const adminRegisterRider = async (data: {
    phone: string;
    name?: string;
    photo_url?: string;
    home_address?: string;
    zone?: string;
    vehicle_type?: 'Motorcycle' | 'Bicycle' | 'Scooter';
    latitude?: number;
    longitude?: number;
  }): Promise<{ rider: Rider; savedToDatabase: boolean; dbMessage?: string }> => {
    const cleanPhone = data.phone.trim();
    const cleanName = data.name?.trim() || `Rider ${cleanPhone.slice(-4) || 'Fleet'}`;
    const newRider: Rider = {
      id: crypto.randomUUID(),
      name: cleanName,
      phone: cleanPhone,
      photo_url: data.photo_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
      home_address: data.home_address?.trim() || 'Chittagong',
      zone: data.zone || 'Chawkbazar Zone',
      vehicle_type: data.vehicle_type || 'Motorcycle',
      is_online: false,
      is_paused: false,
      current_latitude: data.latitude || 22.3590,
      current_longitude: data.longitude || 91.8380,
      last_location_updated_at: new Date().toISOString(),
      cash_in_hand: 0,
      is_approved: true,
      is_password_set: false,
      created_at: new Date().toISOString()
    };

    let savedToDatabase = false;
    let dbMessage = '';

    // Save to backend server API
    try {
      await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRider)
      });
      savedToDatabase = true;
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        const fullPayload = {
          id: newRider.id,
          name: newRider.name,
          phone: newRider.phone,
          photo_url: newRider.photo_url,
          home_address: newRider.home_address,
          zone: newRider.zone,
          vehicle_type: newRider.vehicle_type,
          is_online: newRider.is_online,
          is_paused: newRider.is_paused,
          current_latitude: newRider.current_latitude,
          current_longitude: newRider.current_longitude,
          last_location_updated_at: newRider.last_location_updated_at,
          cash_in_hand: newRider.cash_in_hand,
          is_approved: newRider.is_approved,
          is_password_set: newRider.is_password_set,
          password: null,
          created_at: newRider.created_at
        };

        const { error } = await supabase.from('riders').insert([fullPayload]);
        
        if (error) {
          console.warn('Initial rider payload insert failed:', error);
          const fallbackPayload: Record<string, any> = {
            id: newRider.id,
            name: newRider.name,
            phone: newRider.phone,
          };
          const retryRes = await supabase.from('riders').insert([fallbackPayload]);
          if (!retryRes.error) {
            savedToDatabase = true;
            dbMessage = 'Saved to Supabase riders table.';
          } else {
            dbMessage = `Database Error: ${retryRes.error.message || error.message}`;
          }
        } else {
          savedToDatabase = true;
          dbMessage = 'Saved to Supabase riders table successfully.';
        }
      } catch (err: any) {
        dbMessage = `Database Exception: ${err?.message || String(err)}`;
      }
    } else {
      dbMessage = 'Saved to server database and local session.';
    }

    setRiders(prev => [newRider, ...prev.filter(r => r.phone !== newRider.phone)]);
    return { rider: newRider, savedToDatabase, dbMessage };
  };

  const completeRiderRegistration = async (data: {
    phone: string;
    name?: string;
    password: string;
    zone?: string;
    vehicle_type?: 'Motorcycle' | 'Bicycle' | 'Scooter';
  }): Promise<{ success: boolean; message: string; rider?: Rider }> => {
    const cleanPhone = (data.phone || '').trim();
    const cleanName = (data.name || '').trim();
    const password = (data.password || '').trim();

    if (!cleanPhone || !password) {
      return { success: false, message: 'ফোন নম্বর এবং পাসওয়ার্ড দিন।' };
    }

    // 1. Search in memory riders
    let existingRider = riders.find(r => {
      if (!r || !r.phone) return false;
      const rDigits = String(r.phone).replace(/\D/g, '');
      const cleanDigits = String(cleanPhone).replace(/\D/g, '');
      return (rDigits && cleanDigits && rDigits.endsWith(cleanDigits)) || r.phone === cleanPhone;
    });

    // 2. Search in backend server database if not in memory
    if (!existingRider) {
      try {
        const res = await fetch('/api/riders');
        if (res.ok) {
          const allRiders: Rider[] = await res.json();
          existingRider = allRiders.find(r => {
            const rDigits = String(r.phone).replace(/\D/g, '');
            const cleanDigits = String(cleanPhone).replace(/\D/g, '');
            return (rDigits && cleanDigits && rDigits.endsWith(cleanDigits)) || r.phone === cleanPhone;
          });
        }
      } catch {}
    }

    // 3. Search in Supabase if not found
    if (!existingRider && isSupabaseConfigured && supabase) {
      try {
        const { data: sData } = await supabase.from('riders').select('*').eq('phone', cleanPhone).maybeSingle();
        if (sData) existingRider = sData as Rider;
      } catch {}
    }

    // STRICT ADMIN-ONLY POLICY: If phone is NOT pre-added by Admin, reject registration!
    if (!existingRider) {
      return {
        success: false,
        message: '❌ এই ফোন নম্বরটি এডমিন প্যানেল থেকে আগে যোগ করা হয়নি। শুধুমাত্র এডমিনের অ্যাড করা নম্বরে রেজিস্ট্রেশন করা সম্ভব। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।'
      };
    }

    // If rider has already set a password:
    if (existingRider.is_password_set && existingRider.password) {
      return {
        success: false,
        message: '⚠️ আপনার অ্যাকাউন্ট ইতিমধ্যে সক্রিয় করা হয়েছে। অনুগ্রহ করে লগইন ট্যাবে গিয়ে পাসওয়ার্ড দিয়ে লগইন করুন।'
      };
    }

    // Update empty columns with details provided by rider
    const resolvedName = cleanName || existingRider.name || `Rider ${cleanPhone.slice(-4)}`;
    const targetRider: Rider = {
      ...existingRider,
      name: resolvedName,
      password: password,
      is_password_set: true,
      vehicle_type: data.vehicle_type || existingRider.vehicle_type || 'Motorcycle',
      zone: data.zone || existingRider.zone || 'Chawkbazar Zone',
      is_online: false,
      is_approved: true,
    };

    // Save to backend server API
    try {
      await fetch(`/api/riders/${encodeURIComponent(existingRider.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetRider)
      });
    } catch {}

    // Save to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('riders').update({
          name: targetRider.name,
          password: targetRider.password,
          is_password_set: true,
          vehicle_type: targetRider.vehicle_type,
          zone: targetRider.zone
        }).eq('id', existingRider.id);

        if (error) {
          console.warn('Supabase rider update warning:', error);
        }
      } catch (err) {
        console.warn('Supabase rider update exception:', err);
      }
    }

    setRiders(prev => prev.map(r => r.id === existingRider!.id ? targetRider : r));

    const riderAccount: UserAccount = {
      id: `u-r-${targetRider.id}`,
      role: 'rider',
      name: targetRider.name,
      phone: targetRider.phone,
      is_password_set: true,
      reference_id: targetRider.id,
      zone: targetRider.zone,
      photo_url: targetRider.photo_url
    };

    setCurrentUser(riderAccount);
    setCurrentRider(targetRider);

    return { 
      success: true, 
      message: '✅ রেজিস্ট্রেশন ও অ্যাকাউন্ট অ্যাক্টিভেশন সফল হয়েছে! রাইডার অ্যাপে স্বাগতম।', 
      rider: targetRider 
    };
  };

  const updateRiderProfile = async (riderId: string, updates: Partial<Rider>): Promise<{ success: boolean; message: string }> => {
    setRiders(prev => prev.map(r => r.id === riderId ? { ...r, ...updates } : r));
    
    if (currentRider && currentRider.id === riderId) {
      setCurrentRider(prev => prev ? { ...prev, ...updates } : null);
    }
    
    if (currentUser && currentUser.reference_id === riderId) {
      setCurrentUser(prev => prev ? { 
        ...prev, 
        name: updates.name !== undefined ? updates.name : prev.name, 
        zone: updates.zone !== undefined ? updates.zone : prev.zone,
        photo_url: updates.photo_url !== undefined ? updates.photo_url : prev.photo_url
      } : null);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('riders').update(updates).eq('id', riderId);
        if (error) {
          console.warn('Supabase updateRiderProfile error:', error);
        }
      } catch (err) {
        console.warn('Supabase exception in updateRiderProfile:', err);
      }
    }

    return { success: true, message: 'Rider profile updated successfully!' };
  };

  const toggleRiderPause = async (id: string) => {
    const pausedIds = getStoredPausedRiderIds();
    const currentTarget = riders.find(r => r.id === id);
    const nextPaused = currentTarget ? !currentTarget.is_paused : !pausedIds.has(id);

    if (nextPaused) {
      pausedIds.add(id);
    } else {
      pausedIds.delete(id);
    }
    saveStoredPausedRiderIds(pausedIds);

    // 1. Instant local UI update
    setRiders(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r;
        return { 
          ...r, 
          is_paused: nextPaused,
          is_online: nextPaused ? false : r.is_online
        };
      });

      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}riders`, JSON.stringify(updated));
      } catch {
        // Ignore
      }

      return updated;
    });

    setCurrentRider(prev => {
      if (prev && prev.id === id) {
        return {
          ...prev,
          is_paused: nextPaused,
          is_online: nextPaused ? false : prev.is_online
        };
      }
      return prev;
    });

    // 2. Broadcast across open browser tabs
    foodiplaceRealtimeChannel?.postMessage({
      type: 'RIDER_UPDATE',
      riderId: id,
      updates: { 
        is_paused: nextPaused,
        is_online: nextPaused ? false : (currentTarget?.is_online ?? false)
      }
    });

    // 3. Fire local storage event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PAUSED_RIDERS_STORAGE_KEY,
        newValue: JSON.stringify(Array.from(pausedIds))
      }));
    }

    // 4. Save to backend database server for cross-browser synchronization
    try {
      await fetch(`/api/riders/${encodeURIComponent(id)}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paused: nextPaused })
      });
    } catch (err) {
      console.warn('Backend API pause sync error:', err);
    }

    // 5. Sync to Supabase Postgres database column is_paused
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('riders')
          .update({ 
            is_paused: nextPaused,
            is_online: nextPaused ? false : Boolean(currentTarget?.is_online)
          })
          .eq('id', id);
        if (error) {
          console.warn('Supabase is_paused update status:', error.message);
        }
      } catch (err) {
        console.warn('Supabase update error:', err);
      }
    }

    // 6. If rider is paused by admin, immediately withdraw any pending order dispatched to them
    if (nextPaused) {
      setOrders(prevOrders => {
        let changed = false;
        const updatedOrders = prevOrders.map(ord => {
          if (ord.dispatched_rider_id === id && !ord.rider_id && !['delivered', 'cancelled'].includes(ord.status)) {
            changed = true;
            return {
              ...ord,
              dispatched_rider_id: undefined,
              dispatch_sent_at: undefined
            };
          }
          return ord;
        });

        if (changed) {
          foodiplaceRealtimeChannel?.postMessage({
            type: 'ORDERS_SYNC',
            orders: updatedOrders
          });
        }
        return updatedOrders;
      });
    }
  };

  const deleteRider = (id: string) => {
    setRiders(prev => prev.filter(r => r.id !== id));
    foodiplaceRealtimeChannel?.postMessage({
      type: 'RIDER_DELETE',
      riderId: id
    });
    if (isSupabaseConfigured && supabase) {
      supabase.from('riders').delete().eq('id', id).then();
    }
  };

  const updateVendor = async (id: string, updates: Partial<Vendor>) => {
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    if (currentVendor && currentVendor.id === id) {
      setCurrentVendor(prev => prev ? { ...prev, ...updates } : null);
    }

    try {
      await fetch(`/api/vendors/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.warn('Server vendor update error:', err);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('vendors').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase vendor update error:', err);
      }
    }
  };

  const deleteVendorImageFile = async (imageUrl?: string) => {
    if (!imageUrl) return;
    try {
      // 1. If stored in Supabase storage bucket 'images'
      if (isSupabaseConfigured && supabase && imageUrl.includes('/storage/v1/object/public/images/')) {
        const parts = imageUrl.split('/storage/v1/object/public/images/');
        if (parts[1]) {
          const filePath = decodeURIComponent(parts[1]);
          await supabase.storage.from('images').remove([filePath]);
          console.log('[Supabase Storage] Deleted previous image file:', filePath);
        }
      }
      // 2. If stored on Express server upload directory
      if (imageUrl.startsWith('/uploads/images/')) {
        await fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imageUrl })
        });
        console.log('[Server Storage] Deleted previous image file:', imageUrl);
      }
    } catch (err) {
      console.warn('Error deleting old image file:', err);
    }
  };

  const deleteVendorImage = async (
    vendorId: string, 
    type: 'logo' | 'cover'
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const targetVendor = vendors.find(v => v.id === vendorId) || currentVendor;
      const oldUrl = type === 'logo' ? targetVendor?.logo_url : targetVendor?.cover_image;
      
      // Delete old file from storage/filesystem
      if (oldUrl) {
        await deleteVendorImageFile(oldUrl);
      }

      // Update database and local state to clear image url
      const updateData = type === 'logo' ? { logo_url: '' } : { cover_image: '' };
      await updateVendor(vendorId, updateData);

      return { 
        success: true, 
        message: `${type === 'logo' ? 'Profile photo' : 'Cover photo'} deleted from database successfully.` 
      };
    } catch (err: any) {
      console.error('Delete vendor image error:', err);
      return { success: false, message: err?.message || 'Failed to delete image.' };
    }
  };

  const uploadVendorImage = async (
    vendorName: string, 
    file: File, 
    type: 'logo' | 'cover',
    oldUrl?: string
  ): Promise<{ success: boolean; url?: string; message?: string }> => {
    // Delete prior image from storage if changing
    if (oldUrl) {
      await deleteVendorImageFile(oldUrl);
    }

    const folderName = (vendorName || 'vendor')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '_');

    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${type}_${Date.now()}.${ext}`;
    const filePath = `${folderName}/${fileName}`;

    // 1. Try Supabase Storage bucket "images" if configured
    if (isSupabaseConfigured && supabase) {
      try {
        let { error: uploadErr } = await supabase.storage
          .from('images')
          .upload(filePath, file, { upsert: true, cacheControl: '3600' });

        if (uploadErr && uploadErr.message?.toLowerCase().includes('bucket not found')) {
          await supabase.storage.createBucket('images', { public: true });
          const retry = await supabase.storage
            .from('images')
            .upload(filePath, file, { upsert: true, cacheControl: '3600' });
          uploadErr = retry.error;
        }

        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          
          if (publicUrlData?.publicUrl) {
            return {
              success: true,
              url: publicUrlData.publicUrl,
              message: `Uploaded to Supabase bucket "images/${folderName}/${fileName}"`
            };
          }
        }
      } catch (err) {
        console.warn('Supabase storage upload fallback:', err);
      }
    }

    // 2. Fallback to Express backend `/api/upload` or FileReader
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folderName,
              fileName,
              fileData: base64Data
            })
          });
          if (res.ok) {
            const json = await res.json();
            if (json.url) {
              return resolve({
                success: true,
                url: json.url,
                message: `Uploaded to "images/${folderName}/${fileName}"`
              });
            }
          }
        } catch {}

        resolve({
          success: true,
          url: base64Data,
          message: `Saved image to "images/${folderName}/${fileName}"`
        });
      };
      reader.onerror = () => {
        resolve({ success: false, message: 'Failed to read image file.' });
      };
      reader.readAsDataURL(file);
    });
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings, updated_at: new Date().toISOString() }));
  };

  // -------------------------------------------------------------
  // MENU ITEMS
  // -------------------------------------------------------------
  const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = { 
      ...item, 
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}` 
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('menu_items').insert([{
          id: newItem.id,
          vendor_id: newItem.vendor_id,
          name: newItem.name,
          description: newItem.description || null,
          price: newItem.price,
          image_url: newItem.image_url || null,
          category: newItem.category || 'Main Course',
          is_available: newItem.is_available ?? true,
          variations: newItem.variations || null
        }]);
        if (error) {
          console.error('Supabase error inserting menu item:', error);
        }
      } catch (err) {
        console.error('Failed to insert menu item in database:', err);
      }
    }

    setMenuItems(prev => [newItem, ...prev]);
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('menu_items').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase update menu item error:', err);
      }
    }
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const toggleMenuItemAvailability = async (id: string) => {
    const target = menuItems.find(m => m.id === id);
    if (!target) return;
    const nextAvail = !target.is_available;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('menu_items').update({ is_available: nextAvail }).eq('id', id);
      } catch (err) {
        console.warn('Supabase toggle menu availability error:', err);
      }
    }

    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, is_available: nextAvail } : m));
  };

  const deleteMenuItem = async (id: string) => {
    const itemToDelete = menuItems.find(m => m.id === id);
    if (itemToDelete && itemToDelete.image_url && isSupabaseConfigured && supabase) {
      try {
        const url = itemToDelete.image_url;
        if (url.includes('/storage/v1/object/public/images/')) {
          const relativePath = url.split('/storage/v1/object/public/images/')[1];
          if (relativePath) {
            await supabase.storage.from('images').remove([decodeURIComponent(relativePath)]);
          }
        }
      } catch (err) {
        console.warn('Menu image storage delete error:', err);
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('menu_items').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete menu item error:', err);
      }
    }

    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  // -------------------------------------------------------------
  // FOOD CATEGORIES (Admin Configurable)
  // -------------------------------------------------------------
  const addFoodCategory = async (category: Omit<FoodCategory, 'id'>) => {
    const newCat: FoodCategory = {
      ...category,
      id: crypto.randomUUID()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('food_categories')
          .insert([
            {
              id: newCat.id,
              name: newCat.name,
              icon: newCat.icon || '🍽️',
              image_url: newCat.image_url || null,
              is_active: newCat.is_active,
              order_index: newCat.order_index || 0,
              category_type: newCat.category_type || 'food'
            }
          ]);
        if (error) {
          console.error('Supabase error inserting category:', error);
          alert('Database Error: ' + error.message);
          return;
        }
      } catch (err) {
        console.error('Failed to insert category in database:', err);
      }
    }

    setFoodCategories(prev => [...prev, newCat]);
  };

  const updateFoodCategory = async (id: string, updates: Partial<FoodCategory>) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('food_categories')
          .update({
            name: updates.name,
            icon: updates.icon,
            image_url: updates.image_url,
            is_active: updates.is_active,
            order_index: updates.order_index,
            category_type: updates.category_type
          })
          .eq('id', id);
        if (error) {
          console.error('Supabase error updating category:', error);
        }
      } catch (err) {
        console.error('Failed to update category in database:', err);
      }
    }
    setFoodCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteFoodCategory = async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('food_categories')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('Supabase error deleting category:', error);
        }
      } catch (err) {
        console.error('Failed to delete category from database:', err);
      }
    }
    setFoodCategories(prev => prev.filter(c => c.id !== id));
  };

  // -------------------------------------------------------------
  // PROMOTIONAL ADS & HERO BANNERS
  // -------------------------------------------------------------
  const addAdBanner = async (ad: Omit<AdBanner, 'id'>) => {
    const newId = `ad-${Date.now()}`;
    const newAd: AdBanner = {
      ...ad,
      id: newId,
      created_at: new Date().toISOString()
    };

    // Always immediately update local state and localStorage
    const nextBanners = [newAd, ...adBanners];
    setAdBanners(nextBanners);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}ad_banners`, JSON.stringify(nextBanners));
    } catch {}

    // Broadcast in realtime to customer site and other tabs
    try {
      foodiplaceRealtimeChannel?.postMessage({
        type: 'BANNER_SYNC',
        banners: nextBanners
      });
    } catch {}

    // Save to backend server API
    try {
      await fetch('/api/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAd)
      });
    } catch (e) {
      console.warn('Failed to save banner to backend API:', e);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const payload: any = {
          id: newAd.id,
          title: newAd.title || 'Promotional Banner',
          subtitle: newAd.subtitle || null,
          action_text: newAd.action_text || 'Redeem now',
          image_url: newAd.image_url,
          target_vendor_id: newAd.target_vendor_id || null,
          target_category: newAd.portal_type || 'food',
          is_active: newAd.is_active,
          order_index: newAd.order_index || 0,
          created_at: newAd.created_at
        };

        const { error } = await supabase.from('ads_banners').insert([payload]);
        if (error) {
          console.warn('Supabase error inserting banner:', error);
          if (error.code === '23503' || error.message?.includes('foreign key')) {
            const fallbackPayload = { ...payload, target_vendor_id: null };
            try {
              await supabase.from('ads_banners').insert([fallbackPayload]);
            } catch (retryErr) {
              console.warn('Fallback insert also failed:', retryErr);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to insert banner in database:', err);
      }
    }
  };

  const updateAdBanner = async (id: string, updates: Partial<AdBanner>) => {
    const nextBanners = adBanners.map(a => a.id === id ? { ...a, ...updates } : a);
    setAdBanners(nextBanners);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}ad_banners`, JSON.stringify(nextBanners));
    } catch {}

    // Broadcast in realtime
    try {
      foodiplaceRealtimeChannel?.postMessage({
        type: 'BANNER_SYNC',
        banners: nextBanners
      });
    } catch {}

    // Save to backend server API
    try {
      await fetch(`/api/banners/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.warn('Failed to update banner on server API:', e);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const payload: any = {};
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle || null;
        if (updates.action_text !== undefined) payload.action_text = updates.action_text;
        if (updates.image_url !== undefined) payload.image_url = updates.image_url;
        if (updates.target_vendor_id !== undefined) payload.target_vendor_id = updates.target_vendor_id || null;
        if (updates.is_active !== undefined) payload.is_active = updates.is_active;
        if (updates.order_index !== undefined) payload.order_index = updates.order_index;
        if (updates.portal_type !== undefined) payload.target_category = updates.portal_type;

        await supabase.from('ads_banners').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Failed to update banner in database:', err);
      }
    }
  };

  const deleteAdBanner = async (id: string) => {
    const nextBanners = adBanners.filter(a => a.id !== id);
    setAdBanners(nextBanners);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}ad_banners`, JSON.stringify(nextBanners));
    } catch {}

    // Broadcast in realtime
    try {
      foodiplaceRealtimeChannel?.postMessage({
        type: 'BANNER_SYNC',
        banners: nextBanners
      });
    } catch {}

    // Delete from backend server API
    try {
      await fetch(`/api/banners/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('Failed to delete banner on server API:', e);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('ads_banners')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('Supabase error deleting banner:', error);
        }
      } catch (err) {
        console.error('Failed to delete banner in database:', err);
      }
    }
  };

  const toggleAdBannerStatus = async (id: string) => {
    const targetAd = adBanners.find(a => a.id === id);
    if (!targetAd) return;

    const newStatus = !targetAd.is_active;
    const nextBanners = adBanners.map(a => a.id === id ? { ...a, is_active: newStatus } : a);
    setAdBanners(nextBanners);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}ad_banners`, JSON.stringify(nextBanners));
    } catch {}

    // Broadcast in realtime
    try {
      foodiplaceRealtimeChannel?.postMessage({
        type: 'BANNER_SYNC',
        banners: nextBanners
      });
    } catch {}

    // Update in backend server API
    try {
      await fetch(`/api/banners/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });
    } catch (e) {
      console.warn('Failed to toggle banner on server API:', e);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('ads_banners')
          .update({ is_active: newStatus })
          .eq('id', id);
        if (error) {
          console.error('Supabase error toggling banner status:', error);
        }
      } catch (err) {
        console.error('Failed to toggle status in database:', err);
      }
    }
  };

  // -------------------------------------------------------------
  // CUSTOMER ADDRESSES (Strictly isolated by logged-in customer account & database synced)
  // -------------------------------------------------------------
  const activateAddress = async (id: string) => {
    const custPhone = currentUser?.phone || 'guest';
    const custId = currentUser?.id || '';
    const cleanIdentifier = (custPhone || '').replace(/\D/g, '') || custId || 'guest';

    // 1. Update in memory state & localStorage
    let activatedAddr: CustomerAddress | null = null;
    const updated = allAddresses.map(a => {
      const aClean = (a.customer_phone || '').replace(/\D/g, '');
      const isSameCust = (cleanIdentifier && aClean && cleanIdentifier === aClean) ||
                         (custId && a.customer_id === custId) ||
                         (custPhone && a.customer_phone === custPhone) ||
                         (cleanIdentifier === 'guest' && (!a.customer_phone || a.customer_phone === 'guest'));

      if (isSameCust) {
        if (a.id === id) {
          const activeItem: CustomerAddress = { ...a, status: 'active', is_default: true };
          activatedAddr = activeItem;
          return activeItem;
        } else {
          return { ...a, status: 'inactive' as const, is_default: false };
        }
      }
      return a;
    });

    setAllAddresses(updated);
    if (activatedAddr) {
      setSelectedAddressState(activatedAddr);
    }

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}addresses`, JSON.stringify(updated));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}active_addr_${cleanIdentifier}`, id);
    } catch {}

    // 2. Persist active status to backend server database API
    try {
      await fetch(`/api/addresses/${encodeURIComponent(cleanIdentifier)}/${encodeURIComponent(id)}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.warn('Failed to persist active address to server API:', e);
    }

    // 3. Persist active status to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        if (cleanIdentifier !== 'guest') {
          await supabase
            .from('customer_addresses')
            .update({ status: 'inactive', is_default: false })
            .or(`customer_phone.eq.${custPhone},customer_phone.eq.${cleanIdentifier}`);
        }
        if (isValidUUID(id)) {
          await supabase
            .from('customer_addresses')
            .update({ status: 'active', is_default: true })
            .eq('id', id);
        }
      } catch (err) {
        console.warn('Supabase activate address error:', err);
      }
    }

    // 4. Realtime broadcast sync across other open tabs
    try {
      foodiplaceRealtimeChannel?.postMessage({
        type: 'ADDRESS_ACTIVATED',
        addressId: id,
        cleanIdentifier
      });
    } catch {}
  };

  const setSelectedAddress = (addr: CustomerAddress) => {
    setSelectedAddressState(addr);
    if (addr?.id) {
      activateAddress(addr.id);
    }
  };

  const addAddress = (addr: Omit<CustomerAddress, 'id'>) => {
    const custPhone = currentUser?.phone || 'guest';
    const custId = currentUser?.id || '';
    const custName = currentUser?.name || addr.customer_name || 'Customer';
    const cleanIdentifier = (custPhone || '').replace(/\D/g, '') || custId || 'guest';

    // Auto-detect zone if not specified
    const detectedZone = addr.zone || findZoneForPoint(addr.latitude, addr.longitude, zones)?.name || '';

    // Generate valid UUID for compatibility with Postgres UUID primary key
    const newId = generateUUID();
    const newAddr: CustomerAddress = { 
      ...addr, 
      id: newId,
      customer_phone: custPhone,
      customer_id: custId,
      customer_name: custName,
      zone: detectedZone,
      status: 'active',
      is_default: true
    };

    // Mark previous addresses of this customer as inactive
    const updatedPrev = allAddresses.map(a => {
      const aClean = (a.customer_phone || '').replace(/\D/g, '');
      const isSameCust = (cleanIdentifier && aClean && cleanIdentifier === aClean) ||
                         (custId && a.customer_id === custId) ||
                         (custPhone && a.customer_phone === custPhone) ||
                         (cleanIdentifier === 'guest' && (!a.customer_phone || a.customer_phone === 'guest'));
      if (isSameCust) {
        return { ...a, status: 'inactive' as const, is_default: false };
      }
      return a;
    });

    const nextAll = [newAddr, ...updatedPrev];
    setAllAddresses(nextAll);
    setSelectedAddressState(newAddr);

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}addresses`, JSON.stringify(nextAll));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}active_addr_${cleanIdentifier}`, newId);
    } catch {}

    // Save to Database server
    fetch(`/api/addresses/${encodeURIComponent(cleanIdentifier)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAddr)
    }).catch(e => console.warn('Failed to save address to server API:', e));

    // Save to Supabase
    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          if (cleanIdentifier !== 'guest') {
            await supabase
              .from('customer_addresses')
              .update({ status: 'inactive', is_default: false })
              .or(`customer_phone.eq.${custPhone},customer_phone.eq.${cleanIdentifier}`);
          }

          const payload: Record<string, any> = {
            id: newAddr.id,
            customer_phone: newAddr.customer_phone || custPhone || 'guest',
            customer_name: newAddr.customer_name || custName || 'Customer',
            label: newAddr.label || 'Home',
            address_line: newAddr.address_line,
            details: newAddr.details || null,
            latitude: Number(newAddr.latitude) || 22.3705,
            longitude: Number(newAddr.longitude) || 91.8215,
            zone: newAddr.zone || null,
            is_default: true,
            status: 'active'
          };

          // Verify customer_id exists in Supabase customers table to prevent foreign key violation
          if (custId && isValidUUID(custId)) {
            try {
              const { data: cRow } = await supabase.from('customers').select('id').eq('id', custId).maybeSingle();
              if (cRow?.id) {
                payload.customer_id = cRow.id;
              }
            } catch {}
          }

          console.log('[Supabase] Attempting to insert address:', payload);
          let { error: insertErr } = await supabase.from('customer_addresses').upsert([payload]);
          if (insertErr) {
            console.warn('[Supabase] Upsert notice, trying direct insert:', insertErr);
            const res = await supabase.from('customer_addresses').insert([payload]);
            insertErr = res.error;
          }

          // If error occurs (e.g. status column missing in Supabase or foreign key violation)
          if (insertErr) {
            console.warn('[Supabase] Primary insert failed, trying clean fallback payload:', insertErr);
            const fallbackPayload: Record<string, any> = {
              id: newAddr.id,
              customer_phone: newAddr.customer_phone || custPhone || 'guest',
              customer_name: newAddr.customer_name || custName || 'Customer',
              label: newAddr.label || 'Home',
              address_line: newAddr.address_line,
              details: newAddr.details || null,
              latitude: Number(newAddr.latitude) || 22.3705,
              longitude: Number(newAddr.longitude) || 91.8215,
              is_default: true
            };
            const fbRes = await supabase.from('customer_addresses').insert([fallbackPayload]);
            if (fbRes.error) {
              console.error('❌ [Supabase] Fallback address insert error:', fbRes.error);
            } else {
              console.log('✅ [Supabase] Address inserted with fallback payload!');
            }
          } else {
            console.log('✅ [Supabase] Address inserted successfully!');
          }
        } catch (supaErr) {
          console.warn('Supabase addAddress error:', supaErr);
        }
      })();
    }

    return newAddr;
  };

  const updateAddress = (id: string, updates: Partial<CustomerAddress>) => {
    const custPhone = currentUser?.phone || 'guest';
    const custId = currentUser?.id || '';
    const cleanIdentifier = (custPhone || '').replace(/\D/g, '') || custId || 'guest';

    setAllAddresses(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, ...updates };
      if (!updates.zone && (updates.latitude || updates.longitude)) {
        const detected = findZoneForPoint(updated.latitude, updated.longitude, zones);
        if (detected) updated.zone = detected.name;
      }
      return updated;
    }));

    if (selectedAddress && selectedAddress.id === id) {
      setSelectedAddressState(prev => {
        if (!prev) return null;
        const updated = { ...prev, ...updates };
        if (!updates.zone && (updates.latitude || updates.longitude)) {
          const detected = findZoneForPoint(updated.latitude, updated.longitude, zones);
          if (detected) updated.zone = detected.name;
        }
        return updated;
      });
    }

    const targetAddr = allAddresses.find(a => a.id === id);
    if (targetAddr) {
      const merged = { ...targetAddr, ...updates };
      fetch(`/api/addresses/${encodeURIComponent(cleanIdentifier)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).catch(() => {});

      if (isSupabaseConfigured && supabase) {
        const payload: Record<string, any> = {
          id: isValidUUID(merged.id) ? merged.id : generateUUID(),
          customer_phone: merged.customer_phone,
          customer_name: merged.customer_name,
          label: merged.label,
          address_line: merged.address_line,
          details: merged.details || null,
          latitude: Number(merged.latitude) || 22.3705,
          longitude: Number(merged.longitude) || 91.8215,
          zone: merged.zone || null,
          is_default: merged.is_default,
          status: merged.status || 'active'
        };
        if (custId && isValidUUID(custId)) {
          payload.customer_id = custId;
        }
        supabase.from('customer_addresses').upsert([payload]).then();
      }
    }
  };

  const deleteAddress = (id: string) => {
    const custPhone = currentUser?.phone || 'guest';
    const custId = currentUser?.id || '';
    const cleanIdentifier = (custPhone || '').replace(/\D/g, '') || custId || 'guest';

    const wasActive = selectedAddress?.id === id || allAddresses.find(a => a.id === id)?.status === 'active';
    const remaining = addresses.filter(a => a.id !== id);

    setAllAddresses(prev => prev.filter(a => a.id !== id));

    if (wasActive && remaining.length > 0) {
      activateAddress(remaining[0].id);
    } else if (remaining.length === 0) {
      setSelectedAddressState(null);
    }

    fetch(`/api/addresses/${encodeURIComponent(cleanIdentifier)}/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(() => {});

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      supabase.from('customer_addresses').delete().eq('id', id).then();
    }
  };

  // -------------------------------------------------------------
  // CUSTOMER FAVORITES MANAGEMENT
  // -------------------------------------------------------------
  const toggleFavorite = async (vendorId: string, e?: React.MouseEvent) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (!vendorId) return;

    const custPhone = (currentUser?.phone || '').replace(/\D/g, '') || 'guest';
    const custId = currentUser?.id || '';
    const cleanIdentifier = custPhone !== 'guest' ? custPhone : (custId || 'guest');

    const isFav = favorites.includes(vendorId);
    const updated = isFav 
      ? favorites.filter(id => id !== vendorId) 
      : [...favorites, vendorId];

    // Optimistically update state and local cache
    setFavorites(updated);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}favorites_${cleanIdentifier}`, JSON.stringify(updated));
    } catch {}

    // 1. Sync with backend API
    fetch(`/api/favorites/${encodeURIComponent(cleanIdentifier)}`, {
      method: isFav ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId })
    }).catch(() => {});

    // 2. Sync with Supabase favorites table
    if (isSupabaseConfigured && supabase) {
      try {
        if (isFav) {
          // DELETE from favorites
          let delQuery = supabase.from('favorites').delete().eq('vendor_id', vendorId);
          if (cleanIdentifier !== 'guest') {
            const orConditions = [`customer_phone.eq.${cleanIdentifier}`];
            if (currentUser?.phone) orConditions.push(`customer_phone.eq.${currentUser.phone}`);
            if (custId && isValidUUID(custId)) orConditions.push(`customer_id.eq.${custId}`);
            delQuery = delQuery.or(orConditions.join(','));
          } else {
            delQuery = delQuery.eq('customer_phone', 'guest');
          }
          const { error: delErr } = await delQuery;
          if (delErr) {
            console.warn('Supabase delete favorite error:', delErr);
          }
        } else {
          // INSERT into favorites
          const favPayload: Record<string, any> = {
            id: generateUUID(),
            vendor_id: vendorId,
            customer_phone: cleanIdentifier !== 'guest' ? (currentUser?.phone || cleanIdentifier) : 'guest'
          };
          if (custId && isValidUUID(custId)) {
            favPayload.customer_id = custId;
          }

          let { error: insErr } = await supabase.from('favorites').insert([favPayload]);
          
          // If customer_id foreign key failed, retry without customer_id
          if (insErr && insErr.code === '23503' && favPayload.customer_id) {
            delete favPayload.customer_id;
            const retryRes = await supabase.from('favorites').insert([favPayload]);
            insErr = retryRes.error;
          }

          // If duplicate unique constraint (23505), try upsert
          if (insErr && insErr.code === '23505') {
            await supabase.from('favorites').upsert([favPayload]);
          } else if (insErr) {
            console.warn('Supabase insert favorite error:', insErr);
          }
        }
      } catch (err) {
        console.warn('Supabase favorite toggle exception:', err);
      }
    }
  };

  const isFavorite = (vendorId: string) => favorites.includes(vendorId);


  // -------------------------------------------------------------
  // RIDER GPS & LOCATION UPDATES
  // -------------------------------------------------------------
  const updateRiderLocation = async (riderId: string, lat: number, lng: number) => {
    const safeLat = Number(lat);
    const safeLng = Number(lng);
    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return;

    const nowIso = new Date().toISOString();

    setRiders(prev => prev.map(r => 
      r.id === riderId ? { 
        ...r, 
        current_latitude: safeLat, 
        current_longitude: safeLng, 
        last_location_updated_at: nowIso 
      } : r
    ));

    if (currentRider && currentRider.id === riderId) {
      setCurrentRider(prev => prev ? { 
        ...prev, 
        current_latitude: safeLat, 
        current_longitude: safeLng, 
        last_location_updated_at: nowIso 
      } : null);
    }

    // Broadcast update across open browser tabs immediately
    foodiplaceRealtimeChannel?.postMessage({
      type: 'RIDER_UPDATE',
      riderId,
      updates: {
        current_latitude: safeLat,
        current_longitude: safeLng,
        last_location_updated_at: nowIso
      }
    });

    // Save live location to backend API
    try {
      fetch(`/api/riders/${encodeURIComponent(riderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_latitude: safeLat,
          current_longitude: safeLng,
          last_location_updated_at: nowIso
        })
      }).catch(() => {});
    } catch {}

    // Save live location to Supabase database
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('riders')
          .update({
            current_latitude: safeLat,
            current_longitude: safeLng,
            last_location_updated_at: nowIso
          })
          .eq('id', riderId);
      } catch (err) {
        console.warn('Error syncing rider GPS location to Supabase:', err);
      }
    }
  };

  const simulateRiderMovement = (stepLat: number, stepLng: number) => {
    if (!currentRider) return;
    const curLat = Number(currentRider.current_latitude) || 22.3590;
    const curLng = Number(currentRider.current_longitude) || 91.8380;
    updateRiderLocation(
      currentRider.id,
      curLat + stepLat,
      curLng + stepLng
    );
  };

  const toggleRiderOnline = async (riderId: string, isOnline: boolean): Promise<boolean> => {
    // If rider is paused by admin, they cannot go online
    const target = riders.find(r => r.id === riderId);
    if (target?.is_paused && isOnline) {
      return false;
    }

    let newLat: number | undefined;
    let newLng: number | undefined;

    if (isOnline && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true
          });
        });
        if (Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude)) {
          newLat = pos.coords.latitude;
          newLng = pos.coords.longitude;
        }
      } catch {
        // Fallback to existing or default coordinates
      }
    }

    const nowIso = new Date().toISOString();

    setRiders(prev => prev.map(r => {
      if (r.id !== riderId) return r;
      return {
        ...r,
        is_online: isOnline,
        ...(newLat !== undefined && newLng !== undefined ? {
          current_latitude: newLat,
          current_longitude: newLng,
          last_location_updated_at: nowIso
        } : {
          last_location_updated_at: nowIso
        })
      };
    }));

    if (currentRider && currentRider.id === riderId) {
      setCurrentRider(prev => {
        if (!prev) return null;
        return {
          ...prev,
          is_online: isOnline,
          ...(newLat !== undefined && newLng !== undefined ? {
            current_latitude: newLat,
            current_longitude: newLng,
            last_location_updated_at: nowIso
          } : {
            last_location_updated_at: nowIso
          })
        };
      });
    }

    // Broadcast rider online status across tabs immediately
    foodiplaceRealtimeChannel?.postMessage({
      type: 'RIDER_UPDATE',
      riderId,
      updates: {
        is_online: isOnline,
        ...(newLat !== undefined && newLng !== undefined ? {
          current_latitude: newLat,
          current_longitude: newLng,
          last_location_updated_at: nowIso
        } : {
          last_location_updated_at: nowIso
        })
      }
    });

    // Save online status & location to backend server API
    try {
      fetch(`/api/riders/${encodeURIComponent(riderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_online: isOnline,
          last_location_updated_at: nowIso,
          ...(newLat !== undefined && newLng !== undefined ? {
            current_latitude: newLat,
            current_longitude: newLng
          } : {})
        })
      }).catch(() => {});
    } catch {}

    // Save online status & location to Supabase database
    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: Record<string, any> = {
          is_online: isOnline,
          last_location_updated_at: nowIso
        };
        if (newLat !== undefined && newLng !== undefined) {
          updatePayload.current_latitude = newLat;
          updatePayload.current_longitude = newLng;
        }

        const { error } = await supabase
          .from('riders')
          .update(updatePayload)
          .eq('id', riderId);

        if (error) {
          console.warn('Supabase rider online update error:', error);
        }
      } catch (err) {
        console.warn('Supabase rider online update exception:', err);
      }
    }

    return true;
  };

  // -------------------------------------------------------------
  // CART & ORDER CREATION (EXACT PIN POINT DELIVERY CALCULATION)
  // -------------------------------------------------------------
  const addToCart = (
    item: MenuItem, 
    vendor: Vendor, 
    quantityToAdd: number = 1, 
    selectedVariations?: CartItemOption[], 
    specialInstructions?: string,
    customUnitPrice?: number
  ) => {
    const finalUnitPrice = customUnitPrice !== undefined ? customUnitPrice : item.price;

    if (cartVendor && cartVendor.id !== vendor.id && cart.length > 0) {
      const confirmReset = window.confirm(
        `Your cart contains items from ${cartVendor.name}. Clear cart and add from ${vendor.name}?`
      );
      if (!confirmReset) return;
      const newItems: CartItem[] = [{ 
        menuItem: item, 
        quantity: quantityToAdd, 
        selectedVariations, 
        specialInstructions, 
        unitPrice: finalUnitPrice 
      }];
      setCart(newItems);
      setCartVendor(vendor);
      persistCustomerCart(newItems, vendor);
      return;
    }

    setCartVendor(vendor);
    setCart(prev => {
      const varKey = JSON.stringify(selectedVariations || []);
      const existingIndex = prev.findIndex(ci => 
        ci.menuItem.id === item.id && JSON.stringify(ci.selectedVariations || []) === varKey
      );

      let updated: CartItem[];
      if (existingIndex >= 0) {
        updated = prev.map((ci, idx) => 
          idx === existingIndex ? { ...ci, quantity: ci.quantity + quantityToAdd } : ci
        );
      } else {
        updated = [...prev, { 
          menuItem: item, 
          quantity: quantityToAdd, 
          selectedVariations, 
          specialInstructions, 
          unitPrice: finalUnitPrice 
        }];
      }
      persistCustomerCart(updated, vendor);
      return updated;
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => {
      const filtered = prev.filter(ci => ci.menuItem.id !== menuItemId);
      const nextVendor = filtered.length === 0 ? null : cartVendor;
      if (filtered.length === 0) {
        setCartVendor(null);
        clearCart();
        return [];
      }
      persistCustomerCart(filtered, nextVendor);
      return filtered;
    });
  };

  const updateCartQuantity = (menuItemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    setCart(prev => {
      const updated = prev.map(ci => ci.menuItem.id === menuItemId ? { ...ci, quantity: qty } : ci);
      persistCustomerCart(updated, cartVendor);
      return updated;
    });
  };

  const clearCart = () => {
    const custKey = getCustomerCartKey(currentUser);
    setCart([]);
    setCartVendor(null);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_${custKey}`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cart_vendor_${custKey}`);
    } catch {}
    fetch(`/api/cart/${encodeURIComponent(custKey)}`, { method: 'DELETE' }).catch(() => {});
    if (supabaseConfig.isConfigured && supabase) {
      supabase.from('customer_carts').delete().eq('customer_id', custKey).then(() => {}, () => {});
    }
  };

  const placeOrder = async (instructions?: string): Promise<Order | null> => {
    if (!currentUser || currentUser.role !== 'customer') {
      alert('Please log in first from your Account profile page with your Name, Phone, and Password before placing an order.');
      return null;
    }
    if (cart.length === 0) {
      alert('Your shopping cart is empty. Please add some food items first!');
      return null;
    }
    if (!cartVendor) {
      alert('No restaurant is selected for this cart. Please select items from a restaurant.');
      return null;
    }
    if (!selectedAddress) {
      alert('Please add or select a delivery address before placing your order.');
      return null;
    }

    const foodTotal = cart.reduce((sum, ci) => sum + (ci.unitPrice ?? ci.menuItem.price) * ci.quantity, 0);
    const distanceKm = calculateDistanceKm(
      cartVendor.latitude,
      cartVendor.longitude,
      selectedAddress.latitude,
      selectedAddress.longitude
    );
    const deliveryFee = calculateDeliveryFee(
      distanceKm,
      settings.base_delivery_charge,
      settings.per_km_delivery_charge
    );
    const totalCashPayable = foodTotal + deliveryFee;

    // Use a clean valid UUID for orderId so it never fails Supabase UUID constraints
    const orderId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
      
    const orderCode = `FV-${Math.floor(10000 + Math.random() * 90000)}`;

    const newOrder: Order = {
      id: orderId,
      order_code: orderCode,
      customer_id: currentCustomer?.id || currentUser?.id || 'guest',
      customer_name: currentUser?.name || 'Customer',
      customer_phone: currentUser?.phone || '01800000000',
      vendor_id: cartVendor.id,
      zone: cartVendor.zone || selectedAddress.zone || 'Chawkbazar Zone',
      delivery_address: `${selectedAddress.address_line}${selectedAddress.details ? ` (${selectedAddress.details})` : ''}`,
      delivery_latitude: selectedAddress.latitude,
      delivery_longitude: selectedAddress.longitude,
      food_total: foodTotal,
      delivery_distance_km: distanceKm,
      delivery_fee: deliveryFee,
      total_cash_payable: totalCashPayable,
      food_cash_paid_to_vendor: false,
      food_and_delivery_cash_collected_from_customer: false,
      status: 'pending',
      special_instructions: instructions || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: cart.map((ci, index) => {
        // Use a clean valid UUID for each order item id to satisfy database constraints
        const itemId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `00000000-0000-4000-9000-${(Date.now() + index).toString(16).padStart(12, '0')}`;
          
        const unitPrice = ci.unitPrice ?? ci.menuItem.price;
        const selectedVarStrings = ci.selectedVariations?.map(v => `${v.groupName}: ${v.optionName}${v.price > 0 ? ` (+৳${v.price})` : ''}`);

        return {
          id: itemId,
          order_id: orderId,
          menu_item_id: ci.menuItem.id,
          item_name: ci.menuItem.name,
          item_price: unitPrice,
          quantity: ci.quantity,
          subtotal: unitPrice * ci.quantity,
          selected_variations: selectedVarStrings,
          special_instructions: ci.specialInstructions || ''
        };
      }),
      vendor: cartVendor
    };

    setOrders(prev => [newOrder, ...prev]);

    // Save to Database server
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
    } catch (err) {
      console.warn('Failed to persist order to local server API:', err);
    }

    // Save to Supabase if configured with strict UUID format validations
    if (isSupabaseConfigured && supabase) {
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUuid = (str: string) => uuidRegex.test(str);

        // Sanitize customer_id to ensure it's a valid UUID, otherwise set to null
        let cleanCustId = newOrder.customer_id;
        if (cleanCustId?.startsWith('u-c-')) {
          cleanCustId = cleanCustId.slice(4);
        }
        const sCustomerId = cleanCustId && isUuid(cleanCustId) ? cleanCustId : null;

        // Resolve vendor_id to a valid UUID if possible
        let vId = newOrder.vendor_id;
        if (vId) {
          const matchedVendor = vendors.find(v => v.id === vId || v.unique_id === vId);
          if (matchedVendor && isUuid(matchedVendor.id)) vId = matchedVendor.id;
        }
        const sVendorId = vId && isUuid(vId) ? vId : null;

        // 1. Ensure customer exists in Supabase to satisfy foreign key constraints
        if (sCustomerId && currentUser) {
          try {
            const { data: cExists } = await supabase.from('customers').select('id').eq('id', sCustomerId).maybeSingle();
            if (!cExists) {
              const customerPayload = {
                id: sCustomerId,
                name: currentUser.name || 'Customer',
                phone: currentUser.phone || '01800000000',
                password: '123', // placeholder password
                email: (currentUser as any).email || currentCustomer?.email || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              await supabase.from('customers').upsert([customerPayload]);
            }
          } catch (cErr) {
            console.warn('Customer auto-create on order failed:', cErr);
          }
        }

        // 2. Ensure vendor exists in Supabase to satisfy foreign key constraints
        if (sVendorId && cartVendor) {
          try {
            const { data: vExists } = await supabase.from('vendors').select('id').eq('id', sVendorId).maybeSingle();
            if (!vExists) {
              const vendorPayload = {
                id: sVendorId,
                unique_id: cartVendor.unique_id || `v-${Date.now()}`,
                name: cartVendor.name,
                phone: cartVendor.phone || '01700000000',
                address: cartVendor.address || 'Chattogram',
                latitude: cartVendor.latitude || 22.3590,
                longitude: cartVendor.longitude || 91.8380,
                zone: cartVendor.zone || 'Chawkbazar Zone',
                is_active: cartVendor.is_active !== false,
                is_paused: cartVendor.is_paused === true,
                rating: cartVendor.rating || 4.8,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              await supabase.from('vendors').upsert([vendorPayload]);
            }
          } catch (vErr) {
            console.warn('Vendor auto-create on order failed:', vErr);
          }
        }

        const supabaseOrderPayload = {
          id: newOrder.id,
          order_code: newOrder.order_code,
          customer_id: sCustomerId,
          customer_name: newOrder.customer_name,
          customer_phone: newOrder.customer_phone,
          vendor_id: sVendorId,
          zone: newOrder.zone,
          delivery_address: newOrder.delivery_address,
          delivery_latitude: newOrder.delivery_latitude,
          delivery_longitude: newOrder.delivery_longitude,
          food_total: newOrder.food_total,
          delivery_distance_km: newOrder.delivery_distance_km,
          delivery_fee: newOrder.delivery_fee,
          total_cash_payable: newOrder.total_cash_payable,
          status: newOrder.status,
          special_instructions: newOrder.special_instructions,
          created_at: newOrder.created_at,
          updated_at: newOrder.updated_at
        };

        const { error: oError } = await supabase.from('orders').upsert([supabaseOrderPayload]);
        if (!oError) {
          const itemsPayload = (newOrder.items || []).map(it => ({
            id: it.id,
            order_id: newOrder.id,
            menu_item_id: it.menu_item_id && isUuid(it.menu_item_id) ? it.menu_item_id : null,
            item_name: it.item_name,
            item_price: it.item_price,
            quantity: it.quantity,
            subtotal: it.subtotal,
            selected_variations: it.selected_variations || null,
            special_instructions: it.special_instructions || null
          }));
          await supabase.from('order_items').upsert(itemsPayload);
        } else {
          console.error('Supabase order save error:', oError);
          // If foreign key constraint failed on vendor_id/customer_id, retry with null IDs
          if (oError.message?.includes('foreign key') || oError.code === '23503') {
            const fallbackPayload = { ...supabaseOrderPayload, vendor_id: null, customer_id: null };
            const { error: fbErr } = await supabase.from('orders').upsert([fallbackPayload]);
            if (!fbErr && newOrder.items && newOrder.items.length > 0) {
              const itemsPayload = newOrder.items.map(it => ({
                id: it.id,
                order_id: newOrder.id,
                menu_item_id: null,
                item_name: it.item_name,
                item_price: it.item_price,
                quantity: it.quantity,
                subtotal: it.subtotal,
                selected_variations: it.selected_variations || null,
                special_instructions: it.special_instructions || null
              }));
              await supabase.from('order_items').upsert(itemsPayload);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to persist order to Supabase:', err);
      }
    }

    // "order place hoye cart Ei thakbe" -> clearCart() is commented out/removed!
    // clearCart();
    playNotificationSound();
    return newOrder;
  };

  // -------------------------------------------------------------
  // STEP 2 & 3: VENDOR PREP TIME & CUSTOMER PERMISSION WINDOW
  // -------------------------------------------------------------
  const vendorAcceptOrderWithPrepTime = (orderId: string, prepMinutes: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const nextOrder = {
          ...o,
          status: 'vendor_accepted' as OrderStatus,
          vendor_prep_minutes: prepMinutes,
          customer_confirmed_prep: false,
          updated_at: new Date().toISOString()
        };

        // Post to backend API
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextOrder)
        }).catch(() => {});

        // Save to Supabase
        if (isSupabaseConfigured && supabase) {
          supabase
            .from('orders')
            .update({
              status: 'vendor_accepted',
              vendor_prep_minutes: prepMinutes,
              customer_confirmed_prep: false,
              updated_at: nextOrder.updated_at
            })
            .eq('id', orderId)
            .then();
        }

        return nextOrder;
      }
      return o;
    }));
    playNotificationSound();
  };

  const customerRespondToPrepTime = (orderId: string, accept: boolean) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        let nextOrder: Order;
        if (accept) {
          const prepMinutes = o.vendor_prep_minutes || 15;
          const prepEndsAt = new Date(Date.now() + prepMinutes * 60 * 1000).toISOString();
          nextOrder = {
            ...o,
            status: 'food_preparing' as OrderStatus,
            customer_confirmed_prep: true,
            prep_ends_at: prepEndsAt,
            updated_at: new Date().toISOString()
          };
        } else {
          nextOrder = {
            ...o,
            status: 'cancelled' as OrderStatus,
            customer_confirmed_prep: false,
            cancellation_reason: 'Customer declined preparation wait time',
            updated_at: new Date().toISOString()
          };
        }

        // Post to backend API
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextOrder)
        }).catch(() => {});

        // Save to Supabase
        if (isSupabaseConfigured && supabase) {
          supabase
            .from('orders')
            .update({
              status: nextOrder.status,
              customer_confirmed_prep: nextOrder.customer_confirmed_prep,
              prep_ends_at: nextOrder.prep_ends_at || null,
              cancellation_reason: nextOrder.cancellation_reason || null,
              updated_at: nextOrder.updated_at
            })
            .eq('id', orderId)
            .then();
        }

        return nextOrder;
      }
      return o;
    }));
    playNotificationSound();
  };

  const vendorMarkFoodReady = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const nextOrder = {
          ...o,
          status: 'ready_for_pickup' as OrderStatus,
          updated_at: new Date().toISOString()
        };

        // Post to backend API
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextOrder)
        }).catch(() => {});

        // Save to Supabase
        if (isSupabaseConfigured && supabase) {
          supabase
            .from('orders')
            .update({
              status: 'ready_for_pickup',
              updated_at: nextOrder.updated_at
            })
            .eq('id', orderId)
            .then();
        }

        return nextOrder;
      }
      return o;
    }));
    playNotificationSound();
    // Immediately attempt rider dispatch
    triggerRiderDispatch(orderId);
  };

  // -------------------------------------------------------------
  // STEP 4: INTELLIGENT SINGLE-RIDER PROXIMITY & ZONE DISPATCH ENGINE
  // Strict User Rule:
  // "j zone er order she zone er riders der kace jabe onno zone er riders der kace jabe na"
  // -------------------------------------------------------------
  const triggerRiderDispatch = (orderId: string): boolean => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    const vendor = vendors.find(v => v.id === order.vendor_id);
    if (!vendor) return false;

    // Strict Target Zone: Order zone or Vendor zone
    const targetZone = (order.zone || vendor.zone || '').trim().toLowerCase();
    const rejectedRiderIds = order.rejected_rider_ids || [];

    // STRICT ZONE MATCHING:
    // Only riders that belong to the EXACT same zone as the order/vendor!
    // Riders from other zones are NEVER dispatched this order.
    const zoneRiders = riders.filter(r => {
      if (!r.is_online || r.is_paused) return false;
      if (r.is_approved === false) return false;
      if (rejectedRiderIds.includes(r.id)) return false;

      const riderZone = (r.zone || '').trim().toLowerCase();
      // If target zone is set, only match riders in this exact zone!
      if (targetZone && riderZone !== targetZone) {
        return false;
      }
      return true;
    });

    if (zoneRiders.length === 0) {
      console.log(`[Dispatch Engine] No online riders available in zone "${order.zone || vendor.zone || 'Default'}". Waiting for zone riders.`);
      return false;
    }

    // Proximity distance check within zone
    const ridersWithDistance = zoneRiders.map(r => {
      const dist = calculateDistanceKm(
        vendor.latitude,
        vendor.longitude,
        r.current_latitude,
        r.current_longitude
      );
      return { rider: r, dist };
    });

    // Match closest within radius, or closest in zone
    const matchRadius = settings.rider_match_radius_km || 2.5;
    const withinRadius = ridersWithDistance.filter(item => item.dist <= matchRadius);

    const candidate = withinRadius.length > 0
      ? withinRadius.sort((a, b) => a.dist - b.dist)[0].rider
      : ridersWithDistance.sort((a, b) => a.dist - b.dist)[0].rider;

    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      zone: order.zone || vendor.zone,
      dispatched_rider_id: candidate.id,
      dispatch_sent_at: new Date().toISOString()
    } : o));

    playNotificationSound();
    return true;
  };

  const riderAcceptOrder = (orderId: string, riderId: string) => {
    const rider = riders.find(r => r.id === riderId);
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'rider_assigned',
          rider_id: riderId,
          rider: rider || undefined,
          dispatched_rider_id: undefined,
          updated_at: new Date().toISOString()
        };
      }
      return o;
    }));
    playNotificationSound();
  };

  const riderRejectOrder = (orderId: string, riderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const rejected = o.rejected_rider_ids || [];
        return {
          ...o,
          dispatched_rider_id: undefined,
          rejected_rider_ids: [...rejected, riderId],
          updated_at: new Date().toISOString()
        };
      }
      return o;
    }));

    // Auto dispatch to the next eligible rider in zone
    setTimeout(() => {
      triggerRiderDispatch(orderId);
    }, 500);
  };

  // -------------------------------------------------------------
  // CASH ON DELIVERY HANDOVER
  // -------------------------------------------------------------
  const riderConfirmCashPaidToVendor = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        if (o.rider_id) {
          setRiders(rList => rList.map(r => 
            r.id === o.rider_id ? { ...r, cash_in_hand: r.cash_in_hand - o.food_total } : r
          ));
        }
        return {
          ...o,
          status: 'food_picked_up',
          food_cash_paid_to_vendor: true,
          updated_at: new Date().toISOString()
        };
      }
      return o;
    }));
  };

  const riderConfirmCashCollectedFromCustomer = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        if (o.rider_id) {
          setRiders(rList => rList.map(r => 
            r.id === o.rider_id ? { ...r, cash_in_hand: r.cash_in_hand + o.total_cash_payable } : r
          ));
        }
        return {
          ...o,
          status: 'delivered',
          food_and_delivery_cash_collected_from_customer: true,
          updated_at: new Date().toISOString()
        };
      }
      return o;
    }));
    playNotificationSound();
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus, extra?: Partial<Order>) => {
    let updatedOrder: Order | null = null;

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        updatedOrder = {
          ...o,
          status,
          updated_at: new Date().toISOString(),
          ...extra
        };
        return updatedOrder;
      }
      return o;
    }));

    if (updatedOrder) {
      const orderToSave = updatedOrder as Order;
      // Post to backend API
      fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderToSave)
      }).catch((err) => console.warn('Failed to update order status on server:', err));

      // Save to Supabase if configured
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('orders')
          .update({
            status: orderToSave.status,
            updated_at: orderToSave.updated_at,
            ...extra
          })
          .eq('id', orderId)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to sync order status to Supabase:', error);
            }
          });
      }
    }

    playNotificationSound();
  };

  const sendAdminMessage = (msg: Omit<RiderMessage, 'id' | 'created_at'>) => {
    const newMsg: RiderMessage = {
      ...msg,
      id: `msg-${Date.now()}`,
      created_at: new Date().toISOString(),
      is_read: false
    };
    setRiderMessages(prev => [newMsg, ...prev]);
    playNotificationSound();
  };

  const markRiderMessageAsRead = (msgId: string) => {
    setRiderMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true } : m));
  };

  return (
    <DeliveryContext.Provider
      value={{
        role,
        setRole,
        currentUser,
        currentCustomer,
        customers,
        loginUser,
        setPasswordForUser,
        registerCustomer,
        requestCustomerSignupOtp,
        verifyCustomerSignupOtp,
        updateCustomerProfile,
        requestCustomerProfileOtp,
        verifyCustomerProfileOtp,
        deleteCustomer,
        logoutUser,
        zones,
        addZone,
        updateZone,
        deleteZone,
        toggleZoneActive,
        settings,
        updateSettings,
        vendors,
        currentVendor,
        setCurrentVendor,
        adminRegisterVendor,
        updateVendor,
        uploadVendorImage,
        deleteVendorImage,
        toggleVendorPause,
        deleteVendor,
        menuItems,
        addMenuItem,
        updateMenuItem,
        toggleMenuItemAvailability,
        deleteMenuItem,
        foodCategories,
        addFoodCategory,
        updateFoodCategory,
        deleteFoodCategory,
        adBanners,
        addAdBanner,
        updateAdBanner,
        deleteAdBanner,
        toggleAdBannerStatus,
        addresses,
        selectedAddress,
        setSelectedAddress,
        activateAddress,
        addAddress,
        updateAddress,
        deleteAddress,
        favorites,
        toggleFavorite,
        isFavorite,
        riders,
        currentRider,
        setCurrentRider,
        adminRegisterRider,
        completeRiderRegistration,
        updateRiderProfile,
        toggleRiderOnline,
        toggleRiderPause,
        deleteRider,
        updateRiderLocation,
        simulateRiderMovement,
        orders,
        cart,
        cartVendor,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        placeOrder,
        vendorAcceptOrderWithPrepTime,
        customerRespondToPrepTime,
        vendorMarkFoodReady,
        triggerRiderDispatch,
        riderAcceptOrder,
        riderRejectOrder,
        riderConfirmCashPaidToVendor,
        riderConfirmCashCollectedFromCustomer,
        updateOrderStatus,
        playNotificationSound,
        reviews,
        addOrderReview,
        riderMessages,
        sendAdminMessage,
        markRiderMessageAsRead,
        isSupabaseConfigured: supabaseConfig.isConfigured,
        supabaseConfig,
        connectSupabase,
        syncAllToSupabase
      }}
    >
      {children}
    </DeliveryContext.Provider>
  );
};

export const useDelivery = (): DeliveryContextType => {
  const context = useContext(DeliveryContext);
  if (!context) {
    throw new Error('useDelivery must be used within a DeliveryProvider');
  }
  return context;
};
