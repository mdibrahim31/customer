import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useDelivery } from '../../context/DeliveryContext';
import { CustomerAddress } from '../../types/database';
import { findZoneForPoint } from '../../utils/geo';
import { 
  ArrowLeft, 
  MapPin, 
  Pencil, 
  Trash2, 
  X, 
  Navigation, 
  Layers, 
  Info, 
  Check, 
  Home, 
  Briefcase, 
  Search,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Pre-defined popular delivery areas in Chittagong & Bangladesh for instant search
const KNOWN_LOCATIONS = [
  {
    title: '305 Chasma Hill R/A Rd',
    city: 'Chittagong',
    area: 'Nasirabad, Chittagong',
    lat: 22.3705,
    lng: 91.8215,
  },
  {
    title: 'Sah amanot haowsing M. A.',
    city: 'Chittagong',
    area: 'Chandgaon, Chittagong',
    lat: 22.3831,
    lng: 91.8480,
  },
  {
    title: 'Jongghishah',
    city: 'Chittagong',
    area: 'Chittagong',
    lat: 22.3569,
    lng: 91.8325,
  },
  {
    title: 'Cda Avenue',
    city: 'Chittagong',
    area: 'GEC Circle, Chittagong',
    lat: 22.3610,
    lng: 91.8220,
  },
  {
    title: 'Asian Housing Society',
    city: 'Chittagong',
    area: 'Halishahar, Chittagong',
    lat: 22.3385,
    lng: 91.7925,
  },
  {
    title: 'Prabartak Circle',
    city: 'Chittagong',
    area: 'Panchlaish, Chittagong',
    lat: 22.3645,
    lng: 91.8290,
  },
  {
    title: 'Khulshi R/A Road 1',
    city: 'Chittagong',
    area: 'Khulshi, Chittagong',
    lat: 22.3680,
    lng: 91.8080,
  },
  {
    title: 'Agrabad Commercial Area',
    city: 'Chittagong',
    area: 'Agrabad, Double Mooring, Chittagong',
    lat: 22.3275,
    lng: 91.8155,
  },
  {
    title: 'Jamal Khan Road',
    city: 'Chittagong',
    area: 'Kotwali, Chittagong',
    lat: 22.3485,
    lng: 91.8350,
  },
  {
    title: 'House 42, Road 12, Block E',
    city: 'Dhaka',
    area: 'Banani, Dhaka',
    lat: 23.7915,
    lng: 90.4072,
  },
  {
    title: 'Crystal Palace, SE(D) 22',
    city: 'Dhaka',
    area: 'Gulshan 1, Dhaka',
    lat: 23.7794,
    lng: 90.4190,
  },
];

export const AddressBookModal: React.FC<AddressBookModalProps> = ({ isOpen, onClose }) => {
  const { 
    addresses, 
    selectedAddress, 
    setSelectedAddress, 
    activateAddress,
    addAddress, 
    updateAddress, 
    deleteAddress,
    zones,
    currentUser,
    isSupabaseConfigured
  } = useDelivery();

  // Navigation sub-views:
  // 'list'   -> Screen 1 (Screenshot_20260930_195647.jpg)
  // 'map'    -> Screen 2 (Screenshot_20260930_195705.jpg)
  // 'search' -> Screen 3 (Screenshot_20260930_195712.jpg)
  // 'details'-> Screen 4 (Final address details form)
  const [view, setView] = useState<'list' | 'map' | 'search' | 'details'>('list');

  // Currently edited address ID (null if creating new)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Map & Pin States (Default: 305 Chasma Hill R/A Rd, Chittagong from Screenshot_20260930_195705.jpg)
  const [pinnedLat, setPinnedLat] = useState(22.3705);
  const [pinnedLng, setPinnedLng] = useState(91.8215);
  const [pinnedTitle, setPinnedTitle] = useState('305 Chasma Hill R/A Rd');
  const [pinnedCity, setPinnedCity] = useState('Chittagong');
  const [tileMode, setTileMode] = useState<'street' | 'satellite'>('street');
  const [isLocating, setIsLocating] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('305 Chasma Hill R/A Rd Chittagong');
  const [customSearchResults, setCustomSearchResults] = useState<typeof KNOWN_LOCATIONS>([]);

  // Address Details Form States
  const [label, setLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [addressLine, setAddressLine] = useState('');
  const [cityField, setCityField] = useState('Chittagong');
  const [noteToRider, setNoteToRider] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Leaflet references
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setView('list');
      setEditingAddressId(null);
    }
  }, [isOpen]);

  // Leaflet Map Initialization for 'map' screen
  useEffect(() => {
    if (view !== 'map') {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      if (!leafletMapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          center: [pinnedLat, pinnedLng],
          zoom: 16,
          zoomControl: false, // Clean custom mobile view
        });

        const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

        const tile = L.tileLayer(tileMode === 'satellite' ? satelliteUrl : streetUrl, {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        tileLayerRef.current = tile;

        // When map drags or moves, update center pin coordinates
        map.on('moveend', () => {
          const center = map.getCenter();
          setPinnedLat(center.lat);
          setPinnedLng(center.lng);
          reverseGeocodeLocal(center.lat, center.lng);
        });

        leafletMapInstanceRef.current = map;
      }

      // Ensure proper viewport rendering
      leafletMapInstanceRef.current?.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [view]);

  // Update tile layer if tileMode changes
  useEffect(() => {
    if (!leafletMapInstanceRef.current || !tileLayerRef.current) return;
    const streetUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    tileLayerRef.current.setUrl(tileMode === 'satellite' ? satelliteUrl : streetUrl);
  }, [tileMode]);

  // Local / nominatim reverse geocoder
  const reverseGeocodeLocal = async (lat: number, lng: number) => {
    // 1. Find nearest known location first for instantaneous responsiveness
    let nearest = KNOWN_LOCATIONS[0];
    let minDistance = 999999;
    for (const loc of KNOWN_LOCATIONS) {
      const d = Math.hypot(loc.lat - lat, loc.lng - lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = loc;
      }
    }

    if (minDistance < 0.008) {
      setPinnedTitle(nearest.title);
      setPinnedCity(nearest.city);
      return;
    }

    // 2. Try Nominatim fetch with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const road = data.address?.road || data.address?.suburb || data.address?.neighbourhood || 'Road Location';
        const city = data.address?.city || data.address?.state_district || 'Chittagong';
        setPinnedTitle(`${road}`);
        setPinnedCity(city);
      }
    } catch {
      // Fallback to coordinates title
      setPinnedTitle(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  };

  // GPS Locate User
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPinnedLat(lat);
        setPinnedLng(lng);
        if (leafletMapInstanceRef.current) {
          leafletMapInstanceRef.current.setView([lat, lng], 17);
        }
        reverseGeocodeLocal(lat, lng);
        setIsLocating(false);
      },
      (err) => {
        // Fallback to Chittagong Chasma Hill
        setPinnedLat(22.3705);
        setPinnedLng(91.8215);
        if (leafletMapInstanceRef.current) {
          leafletMapInstanceRef.current.setView([22.3705, 91.8215], 16);
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Open Map to Add New Address
  const startAddNewAddress = () => {
    setEditingAddressId(null);
    setPinnedLat(22.3705);
    setPinnedLng(91.8215);
    setPinnedTitle('305 Chasma Hill R/A Rd');
    setPinnedCity('Chittagong');
    setSearchQuery('305 Chasma Hill R/A Rd Chittagong');
    setView('map');
  };

  // Open Map to Edit Existing Address
  const startEditAddress = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setPinnedLat(addr.latitude);
    setPinnedLng(addr.longitude);
    setPinnedTitle(addr.address_line);
    setPinnedCity(addr.details || 'Chittagong');
    setLabel((addr.label as 'Home' | 'Office' | 'Other') || 'Home');
    setNoteToRider(addr.details || '');
    setCustomerPhone(addr.customer_phone || '');
    setView('map');
  };

  // Select location from search screen
  const handleSelectLocation = (loc: typeof KNOWN_LOCATIONS[0]) => {
    setPinnedLat(loc.lat);
    setPinnedLng(loc.lng);
    setPinnedTitle(loc.title);
    setPinnedCity(loc.city);
    setSearchQuery(`${loc.title} ${loc.city}`);
    setView('map');
    if (leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([loc.lat, loc.lng], 16);
    }
  };

  // Proceed from Map to Address Details form
  const handleProceedToDetails = () => {
    setAddressLine(pinnedTitle);
    setCityField(pinnedCity);
    if (!noteToRider && editingAddressId) {
      const existing = addresses.find(a => a.id === editingAddressId);
      if (existing) setNoteToRider(existing.details || '');
    }
    setView('details');
  };

  // Save Address
  const handleSaveFinalAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine.trim()) return;

    const detectedZone = findZoneForPoint(pinnedLat, pinnedLng, zones);
    const zoneName = detectedZone?.name || 'Chawkbazar Zone';

    if (editingAddressId) {
      updateAddress(editingAddressId, {
        address_line: addressLine.trim(),
        details: noteToRider.trim() || cityField,
        label,
        latitude: pinnedLat,
        longitude: pinnedLng,
        zone: zoneName,
      });
    } else {
      addAddress({
        customer_name: currentUser?.name || 'Customer',
        customer_phone: customerPhone.trim() || currentUser?.phone || 'guest',
        label,
        address_line: addressLine.trim(),
        details: noteToRider.trim() || cityField,
        latitude: pinnedLat,
        longitude: pinnedLng,
        zone: zoneName,
        is_default: true,
        status: 'active'
      });
    }

    setView('list');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      {/* 
        ========================================================================
        MAIN CONTAINER (Phone aspect container styled like mobile screenshots)
        ========================================================================
      */}
      <div className="bg-white w-full max-w-md h-full sm:h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative font-sans">
        
        {/* 
          ========================================================================
          SCREEN 1: ADDRESSES LIST (100% Matching Screenshot_20260930_195647.jpg)
          ========================================================================
        */}
        {view === 'list' && (
          <div className="flex-1 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={onClose} 
                  className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition border border-slate-200/80 cursor-pointer active:scale-95 group shadow-xs"
                  title="Back"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
                </button>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Addresses</h2>
              </div>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 sm:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DB Connection Status Banner */}
            {!isSupabaseConfigured && (
              <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-[11px] text-amber-800 font-bold shrink-0">
                <span>⚠️ Database is not connected in this browser.</span>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-db-modal'))}
                  className="px-2 py-0.5 bg-amber-200/70 hover:bg-amber-300 text-amber-900 rounded-md transition cursor-pointer text-[10px] font-black uppercase tracking-wider"
                >
                  Connect DB
                </button>
              </div>
            )}

            {/* Address List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {addresses.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No saved addresses yet</p>
                  <p className="text-xs text-slate-500">
                    Add your delivery address to see accurate per-km delivery fees and place orders with Cash On Delivery.
                  </p>
                </div>
              ) : (
                addresses.map((addr) => {
                  const isActive = (selectedAddress?.id === addr.id) || (addr.status === 'active');
                  return (
                    <div 
                      key={addr.id}
                      onClick={() => {
                        activateAddress(addr.id);
                        onClose();
                      }}
                      className={`px-4 py-4 flex items-start justify-between cursor-pointer transition hover:bg-slate-50/80 ${
                        isActive ? 'bg-orange-50/40 border-l-4 border-l-orange-500' : ''
                      }`}
                    >
                      {/* Left: Map Pin Icon + Text */}
                      <div className="flex items-start space-x-3.5 flex-1 pr-3">
                        <div className="mt-0.5">
                          <MapPin className={`w-5 h-5 stroke-[2] ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                              {addr.address_line}
                            </h3>
                            {isActive ? (
                              <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs tracking-wide">
                                <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200/90 px-2 py-0.5 rounded-full tracking-wide">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {addr.details?.includes('Chittagong') || addr.details?.includes('Dhaka') 
                              ? addr.details 
                              : 'Chittagong'}
                          </p>
                          <p className="text-xs text-slate-500 font-medium">
                            Note to rider: {addr.details || addr.customer_phone || '01609470766'}
                          </p>
                        </div>
                      </div>

                      {/* Right Actions: Pencil Edit + Trash Delete */}
                      <div className="flex items-center space-x-2 pt-0.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditAddress(addr);
                          }}
                          className="p-1.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition cursor-pointer"
                          title="Edit address"
                        >
                          <Pencil className="w-4 h-4 stroke-[2]" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${addr.address_line}"?`)) {
                              deleteAddress(addr.id);
                            }
                          }}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete address"
                        >
                          <Trash2 className="w-4 h-4 stroke-[2]" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Button (Matching Screenshot_20260930_195647.jpg) */}
            <div className="p-4 bg-white border-t border-slate-100 shadow-lg">
              <button
                onClick={startAddNewAddress}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md transition cursor-pointer"
              >
                Add New Address
              </button>
            </div>
          </div>
        )}

        {/* 
          ========================================================================
          SCREEN 2: INTERACTIVE PINNING MAP (100% Matching Screenshot_20260930_195705.jpg)
          ========================================================================
        */}
        {view === 'map' && (
          <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-100">
            {/* Full Screen Map View */}
            <div ref={mapRef} className="absolute inset-0 z-0 clean-foodpanda-map" />

            {/* Top-Left Floating Close Button */}
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={() => setView('list')}
                className="w-10 h-10 rounded-full bg-white/95 text-slate-800 shadow-md flex items-center justify-center hover:bg-white transition active:scale-95"
              >
                <X className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Bottom-Left Layer Switcher (Street / Satellite) */}
            <div className="absolute bottom-60 left-4 z-20">
              <button
                onClick={() => setTileMode(prev => prev === 'street' ? 'satellite' : 'street')}
                className="w-11 h-11 rounded-2xl bg-white/95 border border-slate-200/80 shadow-md flex items-center justify-center text-slate-700 hover:bg-white transition"
                title="Toggle Satellite view"
              >
                <Layers className="w-5 h-5 stroke-[2]" />
              </button>
            </div>

            {/* Bottom-Right Floating "Locate Me" GPS Button */}
            <div className="absolute bottom-60 right-4 z-20">
              <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="w-12 h-12 rounded-full bg-white/95 text-orange-600 shadow-lg flex items-center justify-center hover:bg-white transition active:scale-95 border border-slate-100"
                title="Use Current Location"
              >
                <Navigation className={`w-5 h-5 stroke-[2.2] ${isLocating ? 'animate-spin text-orange-400' : ''}`} />
              </button>
            </div>

            {/* 
              Center Marker Pin (Fixed to center of viewport, exactly like Uber / Foodpanda / Google Maps)
            */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center mb-10">
              <div className="relative flex flex-col items-center">
                {/* Pin Head */}
                <div className="w-9 h-9 rounded-full bg-orange-600 border-2 border-white shadow-xl flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-white"></div>
                </div>
                {/* Pin Point */}
                <div className="w-2 h-2.5 bg-orange-600 rotate-45 -mt-1 shadow-xs"></div>
                {/* Ground Shadow Dot */}
                <div className="w-3 h-1 bg-black/30 rounded-full mt-0.5 blur-xs"></div>
              </div>
            </div>

            {/* 
              Bottom Floating Sheet (Matching Screenshot_20260930_195705.jpg)
            */}
            <div className="absolute bottom-0 inset-x-0 z-20 bg-white rounded-t-3xl shadow-2xl p-5 space-y-3.5 border-t border-slate-100">
              {/* Drag Handle */}
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto -mt-1 mb-2"></div>

              {/* Address Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="mt-0.5">
                    <MapPin className="w-5 h-5 text-slate-800 stroke-[2]" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      {pinnedTitle}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{pinnedCity}</p>
                  </div>
                </div>

                {/* Pencil Button (Opens Search Screen) */}
                <button
                  onClick={() => {
                    setSearchQuery(`${pinnedTitle} ${pinnedCity}`);
                    setView('search');
                  }}
                  className="p-1.5 text-slate-800 hover:text-orange-600 rounded-lg transition shrink-0"
                >
                  <Pencil className="w-4 h-4 stroke-[2]" />
                </button>
              </div>

              {/* Info Note Callout */}
              <div className="p-3 bg-sky-50 text-sky-950 border border-sky-100 rounded-2xl flex items-start space-x-2.5 text-xs">
                <div className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  i
                </div>
                <p className="text-sky-900 leading-relaxed font-medium">
                  Your rider will deliver to the pinned location. You can edit your written address on the next page.
                </p>
              </div>

              {/* Add Address Details Button */}
              <button
                onClick={handleProceedToDetails}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md transition cursor-pointer"
              >
                Add address details
              </button>
            </div>
          </div>
        )}

        {/* 
          ========================================================================
          SCREEN 3: SEARCH / AUTOCOMPLETE (100% Matching Screenshot_20260930_195712.jpg)
          ========================================================================
        */}
        {view === 'search' && (
          <div className="flex-1 flex flex-col h-full bg-white">
            {/* Top Search Bar */}
            <div className="sticky top-0 bg-white border-b border-slate-100 p-3 flex items-center space-x-2 z-10">
              <button
                onClick={() => setView('map')}
                className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition border border-slate-200/80 cursor-pointer active:scale-95 group shadow-2xs"
                title="Back to Map"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
              </button>

              <div className="flex-1 flex items-center bg-slate-100 rounded-2xl px-3 py-2 space-x-2">
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search street, area or building..."
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Suggestions & Search Results */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-4 pt-3 pb-1">
                Suggested Locations
              </p>

              {KNOWN_LOCATIONS
                .filter(loc => 
                  !searchQuery || 
                  loc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  loc.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  loc.city.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((loc, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectLocation(loc)}
                    className="px-4 py-3.5 flex items-start space-x-3 cursor-pointer hover:bg-slate-50 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-slate-900">{loc.title}</h4>
                      <p className="text-[11px] text-slate-500">{loc.area}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 self-center" />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 
          ========================================================================
          SCREEN 4: ADDRESS DETAILS FORM (Saving / Finalizing Address)
          ========================================================================
        */}
        {view === 'details' && (
          <div className="flex-1 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center space-x-3 z-10">
              <button 
                onClick={() => setView('map')} 
                className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition border border-slate-200/80 cursor-pointer active:scale-95 group shadow-2xs"
                title="Back to Map"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
              </button>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {editingAddressId ? 'Edit Address Details' : 'Address details'}
              </h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveFinalAddress} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Pinned Coordinates Overview Card */}
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-2xl flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">{addressLine || pinnedTitle}</p>
                  <p className="text-[11px] text-orange-700 font-mono">
                    Pinned GPS: {pinnedLat.toFixed(4)}, {pinnedLng.toFixed(4)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('map')}
                  className="text-xs font-bold text-orange-600 hover:underline shrink-0"
                >
                  Adjust Pin
                </button>
              </div>

              {/* Label Chips: Home / Office / Other */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Address Label</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Office', 'Other'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLabel(l)}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition ${
                        label === l
                          ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {l === 'Home' && <Home className="w-3.5 h-3.5" />}
                      {l === 'Office' && <Briefcase className="w-3.5 h-3.5" />}
                      {l === 'Other' && <MapPin className="w-3.5 h-3.5" />}
                      <span>{l}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Street / Building / Road <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="e.g. 305 Chasma Hill R/A Rd or Sah amanot haowsing M. A."
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={cityField}
                  onChange={(e) => setCityField(e.target.value)}
                  placeholder="Chittagong"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Note to Rider */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note to rider (Landmarks / Apartment / Suite)
                </label>
                <input
                  type="text"
                  value={noteToRider}
                  onChange={(e) => setNoteToRider(e.target.value)}
                  placeholder="e.g. Near the big mosque or 3rd floor"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Save Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md transition cursor-pointer"
                >
                  Save Address & Set Target
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
