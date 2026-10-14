import React, { useState } from 'react';
import { InteractiveMap } from './InteractiveMap';
import { DELIVERY_ZONES } from '../../types/database';
import { useDelivery } from '../../context/DeliveryContext';
import { MapPin, Check, X, Compass, Search } from 'lucide-react';

interface LocationPickerModalProps {
  initialLat: number;
  initialLng: number;
  title: string;
  subtitle?: string;
  initialZone?: string;
  onConfirm: (lat: number, lng: number, zone: string) => void;
  onClose: () => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  initialLat,
  initialLng,
  title,
  subtitle = 'Click on the map or drag the pin to set exact coordinates',
  initialZone = 'Chawkbazar Zone',
  onConfirm,
  onClose
}) => {
  const { zones } = useDelivery();
  const [pickedLat, setPickedLat] = useState(initialLat || 22.3590);
  const [pickedLng, setPickedLng] = useState(initialLng || 91.8380);
  const [pickedZone, setPickedZone] = useState(initialZone);

  // Quick preset locations in Chittagong & Dhaka for instant testing
  const presets = [
    { name: 'Chawkbazar, CTG', lat: 22.3585, lng: 91.8385, zone: 'Chawkbazar Zone' },
    { name: 'Khulshi, CTG', lat: 22.3620, lng: 91.8210, zone: 'Khulshi Zone' },
    { name: 'GEC Circle, CTG', lat: 22.3590, lng: 91.8215, zone: 'GEC Zone' },
    { name: 'Nasirabad, CTG', lat: 22.3569, lng: 91.8282, zone: 'Nasirabad Zone' },
    { name: 'Agrabad, CTG', lat: 22.3250, lng: 91.8120, zone: 'Agrabad Zone' },
    { name: 'Banani & Gulshan, DHK', lat: 23.7937, lng: 90.4049, zone: 'Banani & Gulshan Zone' },
    { name: 'Dhanmondi, DHK', lat: 23.7465, lng: 90.3760, zone: 'Dhanmondi Zone' },
  ];

  const handleMapClick = (lat: number, lng: number) => {
    setPickedLat(lat);
    setPickedLng(lng);
  };

  const handleMarkerDragEnd = (_id: string, lat: number, lng: number) => {
    setPickedLat(lat);
    setPickedLng(lng);
  };

  const handleUseCurrentGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPickedLat(pos.coords.latitude);
          setPickedLng(pos.coords.longitude);
        },
        () => {
          alert('Could not access device GPS. Please click directly on the map.');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-rose-600" />
              <span>{title}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/60 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Quick Presets:</span>
          {presets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                setPickedLat(p.lat);
                setPickedLng(p.lng);
                setPickedZone(p.zone);
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:border-rose-500 hover:text-rose-600 shrink-0 transition"
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={handleUseCurrentGPS}
            className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 shrink-0 transition flex items-center space-x-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>My GPS</span>
          </button>
        </div>

        {/* Interactive Leaflet Map */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] bg-slate-100">
          <InteractiveMap
            center={[pickedLat, pickedLng]}
            zoom={15}
            heightClass="h-full min-h-[300px] sm:min-h-[360px]"
            onMapClick={handleMapClick}
            onMarkerDragEnd={handleMarkerDragEnd}
            markers={[
              {
                id: 'pin-point',
                latitude: pickedLat,
                longitude: pickedLng,
                title: 'Selected Pin Point Location',
                subtitle: `Lat: ${pickedLat.toFixed(5)}, Lng: ${pickedLng.toFixed(5)}`,
                type: 'customer',
                isDraggable: true
              }
            ]}
          />

          <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-slate-100 text-xs font-bold text-slate-800 pointer-events-none">
            💡 Tap map or drag pin to position
          </div>
        </div>

        {/* Bottom Details & Zone Selection */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Selected Coordinates
              </label>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-slate-800 font-bold flex justify-between">
                <span>Lat: {pickedLat.toFixed(5)}</span>
                <span>Lng: {pickedLng.toFixed(5)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Assigned Delivery Zone
              </label>
              <select
                value={pickedZone}
                onChange={(e) => setPickedZone(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-hidden focus:border-rose-500"
              >
                {(zones || []).length > 0 ? (
                  zones.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))
                ) : (
                  <option value="Chawkbazar Zone">Chawkbazar Zone (Default)</option>
                )}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(pickedLat, pickedLng, pickedZone);
                onClose();
              }}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider rounded-xl text-xs shadow-lg shadow-rose-600/30 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm Location Pin Point</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
