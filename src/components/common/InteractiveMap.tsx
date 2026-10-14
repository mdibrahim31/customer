import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, Crosshair, MapPin, Compass } from 'lucide-react';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  type: 'vendor' | 'customer' | 'rider';
  isDraggable?: boolean;
}

export interface ZoneOverlayItem {
  id: string;
  name: string;
  bn_name?: string;
  center: [number, number];
  radiusKm?: number;
  color?: string;
  isActive?: boolean;
  boundary_coordinates?: [number, number][];
}

interface InteractiveMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarkerItem[];
  radiusCircle?: {
    center: [number, number];
    radiusMeters: number;
    color?: string;
    label?: string;
  };
  zonesOverlay?: ZoneOverlayItem[];
  selectedZoneId?: string;
  onZoneClick?: (zoneId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
  heightClass?: string;
  showControls?: boolean;
  showFullscreenButton?: boolean;
  showRecenterButton?: boolean;
  onFullscreenToggle?: () => void;
  polygonCoordinates?: [number, number][];
  disableDragging?: boolean;
  hideFill?: boolean;
  onVertexDragEnd?: (index: number, lat: number, lng: number) => void;
  selectedVertexIndex?: number | null;
  onVertexClick?: (index: number) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  center,
  zoom = 14,
  markers = [],
  radiusCircle,
  zonesOverlay,
  selectedZoneId,
  onZoneClick,
  onMapClick,
  onMarkerDragEnd,
  heightClass = 'h-72',
  showControls = true,
  showFullscreenButton = true,
  showRecenterButton = true,
  onFullscreenToggle,
  polygonCoordinates = [],
  disableDragging = false,
  hideFill = false,
  onVertexDragEnd,
  selectedVertexIndex = null,
  onVertexClick,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync Leaflet map size on fullscreen state changes
  useEffect(() => {
    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    const t1 = setTimeout(invalidate, 60);
    const t2 = setTimeout(invalidate, 200);
    const t3 = setTimeout(invalidate, 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullscreen]);

  // Handle native HTML5 fullscreen changes
  useEffect(() => {
    const handleNativeFsChange = () => {
      const isDocFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isDocFs);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
    };

    document.addEventListener('fullscreenchange', handleNativeFsChange);
    document.addEventListener('webkitfullscreenchange', handleNativeFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleNativeFsChange);
      document.removeEventListener('webkitfullscreenchange', handleNativeFsChange);
    };
  }, []);

  // Initialize Map Once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const safeCenter: [number, number] = [
      Number.isFinite(Number(center?.[0])) ? Number(center[0]) : 22.3590,
      Number.isFinite(Number(center?.[1])) ? Number(center[1]) : 91.8380,
    ];

    if (!mapInstanceRef.current) {
      try {
        const map = L.map(mapContainerRef.current, {
          center: safeCenter,
          zoom: Number.isFinite(zoom) ? zoom : 14,
          zoomControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        const layerGroup = L.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        mapInstanceRef.current = map;
      } catch (err) {
        console.warn('Leaflet map initialization warning:', err);
      }
    }

    // Auto-invalidate size on resize or dimension change
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Invalidate map size when fullscreen mode toggles
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Update Zoom smoothly on current viewport without resetting position
  useEffect(() => {
    if (mapInstanceRef.current && mapInstanceRef.current.getZoom() !== zoom) {
      mapInstanceRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Update Center only when camera center prop is explicitly shifted (e.g. pan map controls)
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const currentCenter = map.getCenter();
      const latDiff = Math.abs(currentCenter.lat - center[0]);
      const lngDiff = Math.abs(currentCenter.lng - center[1]);
      
      // Only setView if the difference is very significant (e.g. > 0.01) from explicit panning
      if (latDiff > 0.01 || lngDiff > 0.01) {
        const safeCenter: [number, number] = [
          Number.isFinite(Number(center?.[0])) ? Number(center[0]) : 22.3590,
          Number.isFinite(Number(center?.[1])) ? Number(center[1]) : 91.8380,
        ];
        map.panTo(safeCenter, { animate: true, duration: 0.25 });
      }
    }
  }, [center?.[0], center?.[1]]);

  // Dynamic dragging and manual movement controls to prevent accidental shifts when drawing
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (disableDragging) {
        map.dragging.disable();
        if (map.touchZoom) map.touchZoom.disable();
        if (map.doubleClickZoom) map.doubleClickZoom.disable();
        if (map.boxZoom) map.boxZoom.disable();
        if ((map as any).tap) (map as any).tap.disable();
      } else {
        map.dragging.enable();
        if (map.touchZoom) map.touchZoom.enable();
        if (map.doubleClickZoom) map.doubleClickZoom.enable();
        if (map.boxZoom) map.boxZoom.enable();
        if ((map as any).tap) (map as any).tap.enable();
      }
    }
  }, [disableDragging]);

  // Recenter Map on Target Location
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      const safeCenter: [number, number] = [
        Number.isFinite(Number(center?.[0])) ? Number(center[0]) : 22.3590,
        Number.isFinite(Number(center?.[1])) ? Number(center[1]) : 91.8380,
      ];
      mapInstanceRef.current.flyTo(safeCenter, 17, {
        animate: true,
        duration: 1,
      });
    }
  };

  // Long-Press / Touch & Hold Handler for placing pins (prevents accidental pin drops on quick touch or pan)
  useEffect(() => {
    if (!mapInstanceRef.current || !onMapClick) return;

    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!container) return;

    let longPressTimer: NodeJS.Timeout | null = null;
    let startX = 0;
    let startY = 0;
    let pendingLatLng: L.LatLng | null = null;

    const clearTimer = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      pendingLatLng = null;
    };

    const triggerLongPress = (latlng: L.LatLng) => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(40); } catch (_) {}
      }
      onMapClick(latlng.lat, latlng.lng);
    };

    // --- 1. TOUCH SCREEN LONG PRESS (MOBILE) ---
    const handleTouchStart = (e: TouchEvent) => {
      if (!e.touches[0] || e.touches.length > 1) return; // ignore multi-touch pinch zoom
      clearTimer();

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;

      const rect = container.getBoundingClientRect();
      const containerX = touch.clientX - rect.left;
      const containerY = touch.clientY - rect.top;

      pendingLatLng = map.containerPointToLatLng([containerX, containerY]);

      longPressTimer = setTimeout(() => {
        if (pendingLatLng) {
          triggerLongPress(pendingLatLng);
        }
        clearTimer();
      }, 400); // 400ms Touch & Hold duration
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!longPressTimer || !e.touches[0]) return;
      const touch = e.touches[0];
      const moveDist = Math.hypot(touch.clientX - startX, touch.clientY - startY);
      if (moveDist > 8) { // finger moved > 8px (panning/swiping map), cancel hold timer
        clearTimer();
      }
    };

    const handleTouchEnd = () => {
      clearTimer();
    };

    // --- 2. MOUSE LONG PRESS & CONTEXTMENU (DESKTOP) ---
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left click hold only
      clearTimer();

      startX = e.clientX;
      startY = e.clientY;

      const rect = container.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;

      pendingLatLng = map.containerPointToLatLng([containerX, containerY]);

      longPressTimer = setTimeout(() => {
        if (pendingLatLng) {
          triggerLongPress(pendingLatLng);
        }
        clearTimer();
      }, 400);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!longPressTimer) return;
      const moveDist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (moveDist > 8) {
        clearTimer();
      }
    };

    const handleMouseUp = () => {
      clearTimer();
    };

    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent) {
        L.DomEvent.preventDefault(e.originalEvent);
      }
      onMapClick(e.latlng.lat, e.latlng.lng);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);

    map.on('contextmenu', handleContextMenu);

    return () => {
      clearTimer();
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);

      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);

      map.off('contextmenu', handleContextMenu);
    };
  }, [onMapClick]);

  // Render Markers & Radius
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1. Draw Active Drawing Polygon if provided
    if (polygonCoordinates && Array.isArray(polygonCoordinates) && polygonCoordinates.length > 0) {
      if (polygonCoordinates.length >= 3) {
        L.polygon(polygonCoordinates, {
          color: radiusCircle?.color || '#E11D48',
          fillColor: hideFill ? 'transparent' : (radiusCircle?.color || '#E11D48'),
          fillOpacity: hideFill ? 0 : 0.18,
          weight: 3,
          dashArray: hideFill ? '5, 5' : undefined,
        }).addTo(layerGroup);
      } else if (polygonCoordinates.length === 2) {
        L.polyline(polygonCoordinates, {
          color: radiusCircle?.color || '#E11D48',
          weight: 3,
          dashArray: hideFill ? '5, 5' : undefined,
        }).addTo(layerGroup);
      }

      // Draw vertex markers with click-to-select capability
      polygonCoordinates.forEach((pt, idx) => {
        const isSelected = selectedVertexIndex === idx;

        const vertexIcon = L.divIcon({
          className: 'custom-vertex-marker-icon',
          html: `
            <div class="vertex-pin-btn w-8 h-8 ${
              isSelected 
                ? 'bg-amber-500 ring-4 ring-amber-300 scale-125 z-[9999]' 
                : 'bg-rose-600 hover:bg-rose-700'
            } border-2 border-white rounded-full shadow-xl flex items-center justify-center cursor-pointer transform transition-all touch-none select-none">
              <span class="text-[11px] text-white font-black select-none pointer-events-none">${idx + 1}</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const isDraggable = !hideFill; // Draggable when draft/unconfirmed

        const marker = L.marker(pt, {
          icon: vertexIcon,
          draggable: false,
        }).addTo(layerGroup);

        marker.bindTooltip(`Point ${idx + 1} ${isSelected ? '(SELECTED)' : '(Tap to select)'}`, { permanent: false, direction: 'top' });

        // Handle pin click to select/unselect for movement pad
        marker.on('click', (e) => {
          if ((e as any).originalEvent) {
            L.DomEvent.stopPropagation((e as any).originalEvent);
          }
          if (onVertexClick) {
            onVertexClick(idx);
          }
        });

        marker.on('add', () => {
          const el = marker.getElement();
          if (!el) return;

          L.DomEvent.disableClickPropagation(el);
          L.DomEvent.disableScrollPropagation(el);

          if (!isDraggable) return;

          const innerPin = el.querySelector('.vertex-pin-btn');

          // --- 1. TOUCH SCREEN DRAG (MOBILE) ---
          const handleTouchStart = (e: TouchEvent) => {
            if (hideFill) return;
            e.stopPropagation();

            let isDragging = true;
            if (innerPin) {
              innerPin.classList.add('ring-4', 'ring-amber-400', 'bg-amber-500', 'scale-125', 'z-[9999]');
            }

            const handleTouchMove = (moveEvt: TouchEvent) => {
              if (!isDragging || !mapInstanceRef.current || !moveEvt.touches[0]) return;
              if (moveEvt.cancelable) moveEvt.preventDefault();
              moveEvt.stopPropagation();

              const touch = moveEvt.touches[0];
              const rect = mapContainerRef.current?.getBoundingClientRect();
              if (!rect) return;

              const containerX = touch.clientX - rect.left;
              const containerY = touch.clientY - rect.top;

              // Compute LatLng from touch pixels
              const latLng = mapInstanceRef.current.containerPointToLatLng([containerX, containerY]);
              marker.setLatLng(latLng);

              if (onVertexDragEnd) {
                onVertexDragEnd(idx, latLng.lat, latLng.lng);
              }
            };

            const handleTouchEnd = (endEvt: TouchEvent) => {
              isDragging = false;
              if (innerPin) {
                innerPin.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-500', 'scale-125', 'z-[9999]');
              }
              window.removeEventListener('touchmove', handleTouchMove);
              window.removeEventListener('touchend', handleTouchEnd);
              window.removeEventListener('touchcancel', handleTouchEnd);
            };

            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd, { passive: false });
            window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
          };

          el.addEventListener('touchstart', handleTouchStart, { passive: false });

          // --- 2. MOUSE DRAG (DESKTOP) ---
          const handleMouseDown = (e: MouseEvent) => {
            if (hideFill) return;
            e.stopPropagation();
            e.preventDefault();

            let isDragging = true;
            if (innerPin) {
              innerPin.classList.add('ring-4', 'ring-amber-400', 'bg-amber-500', 'scale-125', 'z-[9999]');
            }

            const handleMouseMove = (moveEvt: MouseEvent) => {
              if (!isDragging || !mapInstanceRef.current) return;
              moveEvt.preventDefault();
              moveEvt.stopPropagation();

              const rect = mapContainerRef.current?.getBoundingClientRect();
              if (!rect) return;

              const containerX = moveEvt.clientX - rect.left;
              const containerY = moveEvt.clientY - rect.top;

              const latLng = mapInstanceRef.current.containerPointToLatLng([containerX, containerY]);
              marker.setLatLng(latLng);

              if (onVertexDragEnd) {
                onVertexDragEnd(idx, latLng.lat, latLng.lng);
              }
            };

            const handleMouseUp = (endEvt: MouseEvent) => {
              isDragging = false;
              if (innerPin) {
                innerPin.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-500', 'scale-125', 'z-[9999]');
              }
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          };

          el.addEventListener('mousedown', handleMouseDown);
        });
      });
    }

    // 1B. Draw Radius Circle if provided (only when polygon is not drawn)
    const hasActivePolygon = polygonCoordinates && polygonCoordinates.length > 0;
    if (!hasActivePolygon && radiusCircle && Array.isArray(radiusCircle.center) && radiusCircle.center.length >= 2 && !isNaN(Number(radiusCircle.center[0])) && !isNaN(Number(radiusCircle.center[1]))) {
      const circle = L.circle(radiusCircle.center as [number, number], {
        color: radiusCircle.color || '#10b981',
        fillColor: hideFill ? 'transparent' : (radiusCircle.color || '#10b981'),
        fillOpacity: hideFill ? 0 : 0.12,
        weight: 2,
        dashArray: '4, 4',
        radius: radiusCircle.radiusMeters,
      }).addTo(layerGroup);

      if (radiusCircle.label) {
        circle.bindTooltip(radiusCircle.label, { permanent: true, direction: 'top', className: 'bg-emerald-800 text-white text-xs px-2 py-1 rounded shadow' });
      }
    }

    // 1C. Draw All Configured Delivery/Rider Zones
    if (zonesOverlay && Array.isArray(zonesOverlay)) {
      zonesOverlay.forEach((z) => {
        if (!z) return;

        const isSelected = selectedZoneId === z.id;
        const color = z.color || '#E11D48';
        const radiusMeters = (z.radiusKm || 3.0) * 1000;

        let zoneOverlayShape;

        // Draw custom polygon boundary if it has valid custom coordinates
        if (z.boundary_coordinates && Array.isArray(z.boundary_coordinates) && z.boundary_coordinates.length >= 3) {
          zoneOverlayShape = L.polygon(z.boundary_coordinates, {
            color: color,
            fillColor: color,
            fillOpacity: isSelected ? 0.25 : z.isActive === false ? 0.04 : 0.12,
            weight: isSelected ? 3 : 2,
          }).addTo(layerGroup);
        } else {
          // Fallback to circular boundary
          if (
            !Array.isArray(z.center) || 
            z.center.length < 2 || 
            typeof z.center[0] !== 'number' || 
            typeof z.center[1] !== 'number' || 
            isNaN(z.center[0]) || 
            isNaN(z.center[1])
          ) {
            return;
          }

          zoneOverlayShape = L.circle(z.center as [number, number], {
            color: color,
            fillColor: color,
            fillOpacity: isSelected ? 0.25 : z.isActive === false ? 0.04 : 0.12,
            weight: isSelected ? 3 : 2,
            dashArray: isSelected ? undefined : '5, 5',
            radius: radiusMeters,
          }).addTo(layerGroup);
        }

        const tooltipText = `${z.name} ${z.bn_name ? `(${z.bn_name})` : ''} • ${z.boundary_coordinates && z.boundary_coordinates.length >= 3 ? 'Polygon Shape' : `${z.radiusKm || 3} KM`}`;
        zoneOverlayShape.bindTooltip(tooltipText, {
          permanent: isSelected,
          direction: 'center',
          className: `font-bold text-xs px-2.5 py-1 rounded-xl shadow-md border ${
            isSelected 
              ? 'bg-slate-900 text-white border-white/50' 
              : 'bg-white/95 text-slate-800 border-slate-300'
          }`
        });

        if (onZoneClick) {
          zoneOverlayShape.on('click', () => onZoneClick(z.id));
        }
      });
    }

    // 2. Custom Icons
    const createCustomIcon = (type: 'vendor' | 'customer' | 'rider') => {
      let bg = 'bg-orange-600';
      let iconSvg = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;

      if (type === 'customer') {
        bg = 'bg-blue-600';
        iconSvg = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`;
      } else if (type === 'rider') {
        bg = 'bg-emerald-600 animate-pulse';
        iconSvg = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
      }

      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="${bg} p-2 rounded-full shadow-lg border-2 border-white transform transition hover:scale-110">
              ${iconSvg}
            </div>
            ${type === 'rider' ? '<div class="absolute -inset-1 bg-emerald-400 rounded-full animate-ping opacity-40"></div>' : ''}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    };

    // 3. Add each marker
    markers.forEach((m) => {
      const lat = Number(m?.latitude);
      const lng = Number(m?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = L.marker([lat, lng], {
        icon: createCustomIcon(m.type),
        draggable: Boolean(m.isDraggable),
      }).addTo(layerGroup);

      const popupContent = `
        <div class="p-1 font-sans text-xs">
          <p class="font-bold text-gray-900">${m.title || 'Location'}</p>
          ${m.subtitle ? `<p class="text-gray-600 mt-0.5">${m.subtitle}</p>` : ''}
          <p class="text-[10px] text-gray-400 mt-1 font-mono">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
        </div>
      `;
      marker.bindPopup(popupContent);

      if (m.isDraggable && onMarkerDragEnd) {
        marker.on('dragend', (e) => {
          const target = e.target as L.Marker;
          const pos = target.getLatLng();
          onMarkerDragEnd(m.id, pos.lat, pos.lng);
        });
      }
    });
  }, [markers, radiusCircle, onMarkerDragEnd, zonesOverlay, selectedZoneId, polygonCoordinates]);

  const handleToggleFullscreen = async () => {
    if (onFullscreenToggle) {
      onFullscreenToggle();
      return;
    }

    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (wrapperRef.current?.requestFullscreen) {
          await wrapperRef.current.requestFullscreen();
        } else if ((wrapperRef.current as any)?.webkitRequestFullscreen) {
          await (wrapperRef.current as any).webkitRequestFullscreen();
        } else {
          setIsFullscreen(prev => !prev);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    } catch {
      // In case iframe blocks requestFullscreen, fallback to full-bleed CSS fixed mode
      setIsFullscreen(prev => !prev);
    }
  };

  return (
    <div 
      ref={wrapperRef}
      className={`relative transition-all duration-300 ${
        isFullscreen 
          ? 'fixed inset-0 z-[99999] w-screen h-screen bg-white text-slate-900 rounded-none border-none p-0 overflow-hidden flex flex-col' 
          : `w-full ${heightClass} rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0`
      }`}
    >
      {/* Top Banner when in CSS Fullscreen */}
      {isFullscreen && (
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs z-20 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-extrabold text-xs text-slate-800">Fullscreen Live Map View</span>
          </div>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            title="Exit Fullscreen"
          >
            <Minimize2 className="w-3.5 h-3.5 text-slate-700" />
            <span>Exit Fullscreen</span>
          </button>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full flex-1 h-full z-0 clean-foodpanda-map" />

      {/* Floating Map Overlay Control Buttons */}
      {showControls && (
        <div className="absolute top-3 right-3 z-10 flex flex-col space-y-2">
          {/* Recenter / Focus on Target Location */}
          {showRecenterButton && (
            <button
              type="button"
              onClick={handleRecenter}
              className="bg-white/95 hover:bg-white text-slate-800 p-2.5 rounded-2xl shadow-lg border border-slate-200 backdrop-blur-xs transition active:scale-95 flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
              title="Focus on Location / Rider GPS Pin"
            >
              <Crosshair className="w-4 h-4 text-rose-600 animate-pulse" />
              <span className="hidden sm:inline">Focus Location</span>
            </button>
          )}

          {/* Fullscreen Map Toggle */}
          {showFullscreenButton && (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="bg-white/95 hover:bg-white text-slate-800 p-2.5 rounded-2xl shadow-lg border border-slate-200 backdrop-blur-xs transition active:scale-95 flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen Map' : 'Expand Fullscreen Map'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Fullscreen Map</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
