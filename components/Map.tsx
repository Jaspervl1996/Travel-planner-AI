import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Maximize } from 'lucide-react';
import { Destination, Stop, Activity, Flight } from '../types';

const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  destinations?: Destination[];
  stops?: Stop[];
  flights?: Flight[];
  activeDayActivities?: Activity[]; // For day view
  interactive?: boolean;
  onCountrySelect?: (country: { name: string; lat: number; lng: number }) => void;
  showCountries?: boolean;
  onMarkerClick?: (id: string) => void; 
  onMapClick?: (coords: { lat: number; lng: number }) => void;
}

const normalizeName = (name: string) => {
    const n = name.toLowerCase().trim();
    if (n === 'united states of america' || n === 'usa' || n === 'us') return 'united states';
    if (n === 'great britain' || n === 'united kingdom' || n === 'uk') return 'uk';
    if (n.startsWith('the ')) return n.replace('the ', '');
    return n;
};

const Map: React.FC<MapProps> = ({ 
  destinations = [], 
  stops = [], 
  flights = [],
  activeDayActivities = [], 
  interactive = true,
  onCountrySelect,
  showCountries = false,
  onMarkerClick,
  onMapClick
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  
  const destinationsRef = useRef(destinations);
  useEffect(() => { destinationsRef.current = destinations; }, [destinations]);

  // Handle map click events
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Remove existing click handlers to prevent duplicates if props change
    mapRef.current.off('click');

    if (onMapClick) {
        mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
             // If clicking on a country feature, we might want to ignore this generic click
             // But usually Leaflet handles event propagation. 
             // We can check if the target has specific properties if needed.
             onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
    }
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        fadeAnimation: false, 
        markerZoomAnimation: false,
        zoomAnimation: false 
    }).setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    layerGroupRef.current = L.layerGroup().addTo(mapRef.current);

    // FIX: Invalidate size after mount to ensure proper rendering if container size was fluctuating
    const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
    }, 200);

    return () => {
        clearTimeout(timer);
        if (mapRef.current) {
            mapRef.current.off();
            mapRef.current.remove();
            mapRef.current = null;
        }
        layerGroupRef.current = null;
        geoJsonLayerRef.current = null;
    }
  }, [interactive]);

  // FIX: Add ResizeObserver to handle container size changes
  useEffect(() => {
      if (!containerRef.current) return;
      
      const resizeObserver = new ResizeObserver(() => {
          if (mapRef.current) {
              mapRef.current.invalidateSize();
          }
      });
      
      resizeObserver.observe(containerRef.current);
      
      return () => {
          resizeObserver.disconnect();
      };
  }, []);

  useEffect(() => {
    if (!showCountries) {
        if (geoJsonLayerRef.current) {
            geoJsonLayerRef.current.remove();
            geoJsonLayerRef.current = null;
        }
        return;
    }

    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
        .then(res => res.json())
        .then(data => {
            if (!mapRef.current) return;
            
            if (geoJsonLayerRef.current) {
                geoJsonLayerRef.current.clearLayers();
                geoJsonLayerRef.current.remove();
            }

            geoJsonLayerRef.current = L.geoJSON(data, {
                style: (feature) => {
                    const currentDests = destinationsRef.current;
                    const featureName = normalizeName(feature?.properties?.name || '');
                    
                    const isSelected = feature && currentDests.some(d => normalizeName(d.name) === featureName);

                    return {
                        fillColor: isSelected ? '#4f46e5' : '#f1f5f9', // Indigo-600 vs Slate-100
                        weight: isSelected ? 2 : 1,
                        opacity: 1,
                        color: isSelected ? '#4338ca' : '#cbd5e1', // Indigo-700 vs Slate-300
                        dashArray: isSelected ? '' : '3',
                        fillOpacity: isSelected ? 0.6 : 0.0 // Only highlight selected/hovered effectively
                    };
                },
                onEachFeature: (feature, layer) => {
                    layer.on({
                        click: (e) => {
                            L.DomEvent.stopPropagation(e); // Stop the map click event from firing
                            const center = (e.target as any).getBounds().getCenter();
                            if (onCountrySelect) {
                                onCountrySelect({
                                    name: feature.properties.name,
                                    lat: center.lat,
                                    lng: center.lng
                                });
                            }
                        },
                        mouseover: (e) => {
                            const layer = e.target;
                            if (mapRef.current && mapRef.current.hasLayer(layer)) {
                                layer.setStyle({ weight: 2, color: '#6366f1', fillOpacity: 0.4 });
                                layer.bringToFront();
                            }
                        },
                        mouseout: (e) => {
                            if (geoJsonLayerRef.current && mapRef.current && mapRef.current.hasLayer(e.target)) {
                                try { geoJsonLayerRef.current.resetStyle(e.target); } catch (err) {}
                            }
                        }
                    });
                }
            }).addTo(mapRef.current);
        })
        .catch(err => console.error("Failed to load GeoJSON", err));

  }, [showCountries]);

  // Update styles when destinations change
  useEffect(() => {
      if (geoJsonLayerRef.current && showCountries && mapRef.current) {
          geoJsonLayerRef.current.eachLayer((layer) => {
              if (geoJsonLayerRef.current) {
                geoJsonLayerRef.current.resetStyle(layer as L.Path);
              }
          });
          
          // Optional: Fit bounds to selected countries if any
          if (destinations.length > 0) {
              const bounds = L.latLngBounds([]);
              let hasBounds = false;
              destinations.forEach(d => {
                  if (d.lat && d.lng) {
                      bounds.extend([d.lat, d.lng]);
                      hasBounds = true;
                  }
              });
              if (hasBounds) {
                  mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
              }
          }
      }
  }, [destinations, showCountries]);

  // Markers and Routes (Step 2 & 3)
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    try {
        map.closePopup();
        layerGroup.clearLayers();
    } catch (e) {}

    const bounds = L.latLngBounds([]);
    let hasLayers = false;

    // 1. Destinations Markers (Only if not showing countries layer to avoid clutter, or keep them?)
    // Let's keep markers but small
    if (!showCountries) {
        destinations.forEach(d => {
            if (d.lat && d.lng) {
                L.marker([d.lat, d.lng])
                 .bindPopup(`<b>${d.name}</b>`)
                 .addTo(layerGroup);
                bounds.extend([d.lat, d.lng]);
                hasLayers = true;
            }
        });
    }

    // 2. Stops & Route
    if (stops.length > 0 && activeDayActivities.length === 0) {
        const validStops = stops.filter(s => s && typeof s.lat === 'number' && typeof s.lng === 'number' && s.lat !== 0 && s.lng !== 0);
        
        if (validStops.length > 0) {
            const latlngs = validStops.map(s => [s.lat, s.lng] as L.LatLngExpression);
            
            // Draw land routes
            if (latlngs.length > 1) {
                L.polyline(latlngs, { color: '#0ea5a4', weight: 3, dashArray: '5, 10' }).addTo(layerGroup);
            }

            validStops.forEach((s) => {
                const numIcon = L.divIcon({
                    className: 'bg-teal-600 text-white rounded-full border-2 border-white w-8 h-8 flex items-center justify-center font-bold shadow-md',
                    html: `${s.seq}`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
                const marker = L.marker([s.lat, s.lng], { icon: numIcon })
                 .bindPopup(`<b>Stop ${s.seq}: ${s.place}</b><br>${s.start} - ${s.end}`)
                 .addTo(layerGroup);
                
                if (onMarkerClick) {
                    marker.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        onMarkerClick(s.id);
                    });
                }

                bounds.extend([s.lat, s.lng]);
                hasLayers = true;
            });
        }
    }

    // Flights (Step 2/3) - Curved Dashed Lines
    if (flights.length > 0 && activeDayActivities.length === 0) {
        flights.forEach(f => {
            if (f.fromLat && f.fromLng && f.toLat && f.toLng) {
                // Simple Quadratic Bezier Curve Simulation
                const start = { x: f.fromLng, y: f.fromLat };
                const end = { x: f.toLng, y: f.toLat };
                
                // Control point (simple offset to create curve)
                const offsetX = (end.x - start.x) / 4 - (end.y - start.y) / 4;
                const offsetY = (end.y - start.y) / 4 + (end.x - start.x) / 4;
                const control = { x: (start.x + end.x) / 2 + offsetX, y: (start.y + end.y) / 2 + offsetY };

                const curvePoints: L.LatLngExpression[] = [];
                for (let t = 0; t <= 1; t += 0.05) {
                    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
                    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
                    curvePoints.push([y, x]);
                }

                L.polyline(curvePoints, { color: '#6366f1', weight: 2, dashArray: '4, 8', opacity: 0.8 }).addTo(layerGroup);
                
                // Small plane icon at midpoint
                const midIndex = Math.floor(curvePoints.length / 2);
                const midPoint = curvePoints[midIndex];
                
                const planeIcon = L.divIcon({
                    className: 'text-indigo-600',
                    html: '✈',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                L.marker(midPoint, { icon: planeIcon, interactive: false }).addTo(layerGroup);

                bounds.extend([f.fromLat, f.fromLng]);
                bounds.extend([f.toLat, f.toLng]);
                hasLayers = true;
            }
        });
    }

    // 3. Day Activities
    if (activeDayActivities.length > 0) {
        activeDayActivities.forEach((act) => {
            if (typeof act.lat === 'number' && typeof act.lng === 'number' && act.lat !== 0) {
                 const actIcon = L.divIcon({
                    className: 'bg-indigo-500 text-white rounded-full border-2 border-white w-7 h-7 flex items-center justify-center font-bold shadow-md text-xs',
                    html: '★',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                });
                L.marker([act.lat, act.lng], { icon: actIcon })
                 .bindPopup(`<b>${act.name}</b><br>${act.time || ''}`)
                 .addTo(layerGroup);
                bounds.extend([act.lat, act.lng]);
                hasLayers = true;
            }
        });
    }

    if (hasLayers && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    } else if (!hasLayers && !showCountries) {
        // If we just enabled countries and have no other layers, reset view maybe?
        // But we handle fitBounds for destinations above in the showCountries effect
    }

  }, [destinations, stops, activeDayActivities, flights, showCountries, onMarkerClick]);

  const handleFitBounds = (e: React.MouseEvent) => {
      e.stopPropagation();
      const map = mapRef.current;
      if (!map) return;
      const bounds = L.latLngBounds([]);
      let valid = false;
      destinations.forEach(d => { if(d.lat && d.lng) { bounds.extend([d.lat, d.lng]); valid = true; }});
      stops.filter(s => s && s.lat && s.lng).forEach(s => { bounds.extend([s.lat, s.lng]); valid = true; });
      flights.forEach(f => {
         if (f.fromLat && f.fromLng && f.toLat && f.toLng) {
            bounds.extend([f.fromLat as number, f.fromLng as number]); 
            bounds.extend([f.toLat as number, f.toLng as number]); 
            valid = true; 
         }
      });
      activeDayActivities.filter(a => a.lat && a.lng).forEach(a => { bounds.extend([a.lat, a.lng]); valid = true; });
      if (valid) map.fitBounds(bounds, { padding: [50, 50] });
  };

  const showFitButton = destinations.length > 0 || stops.length > 0 || activeDayActivities.length > 0 || flights.length > 0;

  return (
    <div className="relative w-full h-full min-h-[300px] md:min-h-[400px] rounded-lg overflow-hidden shadow-inner bg-slate-100 group">
        <div ref={containerRef} className="w-full h-full" />
        {showFitButton && (
            <button 
                onClick={handleFitBounds}
                className="absolute top-4 right-4 z-[400] bg-white p-2 rounded-lg shadow-md border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                title="Zoom to fit content"
            >
                <Maximize className="w-5 h-5" />
            </button>
        )}
    </div>
  );
};

export default Map;