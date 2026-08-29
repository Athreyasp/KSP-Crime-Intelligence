import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Load GeoJSON boundary data for Karnataka
import karnatakaGeo from "@/data/karnataka.geojson.json";

function heatColor(ratio: number, low: number, high: number) {
  if (ratio >= high) return "#e61e2b";          // Red (High)
  if (ratio >= (low + high) / 2) return "#f5a649"; // Golden Orange (Medium-High)
  if (ratio >= low) return "#38c4da";            // Vibrant Cyan (Medium)
  if (ratio >= low / 2) return "#a0e1ef";       // Light Blue (Medium-Low)
  return "#cbeff4";                              // Very Light Cyan (Low)
}

interface StateMapLeafletProps {
  districtStats: any[];
  minTotal: number;
  maxTotal: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  lowT: number;
  highT: number;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
}

export function StateMapLeaflet({
  districtStats,
  minTotal,
  maxTotal,
  selectedId,
  onSelect,
  lowT,
  highT,
  hoveredId,
  onHover,
}: StateMapLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  
  const [ready, setReady] = useState(false);

  // Store callbacks and variables in refs to prevent stale closure issues in Leaflet events
  const propsRef = useRef({ districtStats, minTotal, maxTotal, selectedId, onSelect, lowT, highT, hoveredId, onHover });
  useEffect(() => {
    propsRef.current = { districtStats, minTotal, maxTotal, selectedId, onSelect, lowT, highT, hoveredId, onHover };
  }, [districtStats, minTotal, maxTotal, selectedId, onSelect, lowT, highT, hoveredId, onHover]);

  // Calculate style for a district feature
  const getStyle = (featureName: string, isSelected: boolean, isHovered: boolean) => {
    const { districtStats, minTotal, maxTotal, lowT, highT } = propsRef.current;
    
    // Exact match by name
    const stat = districtStats.find(s => s.district.name === featureName);
    const rawTotal = stat ? stat.total : 0;
    const ratio = maxTotal > minTotal ? (rawTotal - minTotal) / (maxTotal - minTotal || 1) : 0;

    const fillColor = heatColor(ratio, lowT, highT);
    
    return {
      fillColor,
      fillOpacity: isSelected ? 0.95 : isHovered ? 0.85 : 0.72,
      color: isSelected ? "#0d47a1" : isHovered ? "#29b6f6" : "#5a738e", // Colors matching the second image
      weight: isSelected ? 2.8 : isHovered ? 2.0 : 0.95,
    };
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Standard Karnataka bounds
    const bounds = L.latLngBounds([11.4, 73.9], [18.6, 78.7]);

    // Initialize Leaflet Map - no attribution control to avoid watermarks
    const map = L.map(containerRef.current, {
      center: [15.0, 76.5],
      zoom: 7.2,
      minZoom: 6,
      maxZoom: 11,
      maxBounds: bounds.pad(0.1),
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.1,
      zoomDelta: 0.1,
    });
    mapRef.current = map;

    // Add zoom controls at the top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Create group for labels and markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Track currently hovered feature layer
    let hoveredLayer: L.Layer | null = null;

    // Initialize GeoJSON Layer
    const geojsonLayer = L.geoJSON(karnatakaGeo as any, {
      style: (feature: any) => {
        const districtName = feature.properties?.district ?? "";
        return getStyle(districtName, false, false);
      },
      onEachFeature: (feature: any, layer: any) => {
        const districtName = feature.properties?.district ?? "";

        // Click to select/drill down
        layer.on({
          click: (e: L.LeafletMouseEvent) => {
            const { districtStats, onSelect } = propsRef.current;
            const stat = districtStats.find(s => s.district.name === districtName);
            if (stat) {
              onSelect(stat.district.id);
            }
          },
          mouseover: (e: L.LeafletMouseEvent) => {
            hoveredLayer = layer;
            const isSelected = propsRef.current.selectedId === propsRef.current.districtStats.find(s => s.district.name === districtName)?.district.id;
            layer.setStyle(getStyle(districtName, isSelected, true));
            layer.bringToFront();
            
            // Sync with sidebar
            const stat = propsRef.current.districtStats.find(s => s.district.name === districtName);
            if (stat) {
              propsRef.current.onHover(stat.district.id);
            }
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            hoveredLayer = null;
            const isSelected = propsRef.current.selectedId === propsRef.current.districtStats.find(s => s.district.name === districtName)?.district.id;
            layer.setStyle(getStyle(districtName, isSelected, false));
            
            // Sync with sidebar
            propsRef.current.onHover(null);
          },
        });
      },
    }).addTo(map);
    geojsonLayerRef.current = geojsonLayer;

    // Fit map to show Karnataka GeoJSON boundaries - negative padding zooms in tighter to enlarge the map
    map.fitBounds(geojsonLayer.getBounds(), { padding: [-30, -30] });

    setReady(true);

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      geojsonLayerRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Update styles and redraw markers when stats, selectedId, hoveredId, or ranges change
  useEffect(() => {
    const map = mapRef.current;
    const geojsonLayer = geojsonLayerRef.current;
    const markersGroup = markersGroupRef.current;

    if (!map || !geojsonLayer || !markersGroup || !ready) return;

    // Update GeoJSON polygon styles
    geojsonLayer.eachLayer((layer: any) => {
      const districtName = layer.feature.properties?.district ?? "";
      const stat = districtStats.find(s => s.district.name === districtName);
      const isSelected = stat ? selectedId === stat.district.id : false;
      const isHovered = stat ? hoveredId === stat.district.id : false;
      layer.setStyle(getStyle(districtName, isSelected, isHovered));
      if (isSelected || isHovered) {
        layer.bringToFront();
      }
    });

    // Clear and rebuild overlays (labels + pulsing radar)
    markersGroup.clearLayers();

    geojsonLayer.eachLayer((layer: any) => {
      const districtName = layer.feature.properties?.district ?? "";
      const stat = districtStats.find(s => s.district.name === districtName);
      if (!stat) return;

      const center = layer.getBounds().getCenter();

      // Adjust labeling offset if necessary for specific districts
      let labelLatLng = center;
      if (districtName === "Bengaluru Urban") {
        labelLatLng = L.latLng(center.lat - 0.05, center.lng + 0.05);
      } else if (districtName === "Bengaluru Rural") {
        labelLatLng = L.latLng(center.lat + 0.08, center.lng - 0.08);
      }

      // Add Custom Tooltip/Popup on hover
      layer.bindTooltip(
        `<div style="font-family:system-ui, sans-serif; padding:4px 6px;">
          <div style="font-weight:600; font-size:12px; color:#1e293b;">${stat.district.name}</div>
          <div style="font-size:10.5px; color:#64748b; margin-top:2px;">
            <span style="font-weight:600; color:#0f172a;">${stat.total}</span> FIRs &middot; 
            <span style="font-weight:600; color:${stat.spike > 0 ? '#dc2626' : '#16a34a'};">${stat.spike}%</span> spike
          </div>
         </div>`,
        {
          permanent: false,
          direction: "top",
          sticky: true,
          className: "rounded-md border border-slate-200 bg-white shadow-md p-0",
        }
      );

      // Add Centroid Text Label
      const isSelected = selectedId === stat.district.id;
      const labelHtml = `
        <div class="pointer-events-none select-none text-[9.5px] font-sans font-bold text-center transition-colors duration-150" 
             style="color: ${isSelected ? '#1e3a8a' : '#334155'};
                    -webkit-text-stroke: 2.5px white; 
                    paint-order: stroke fill; 
                    text-shadow: 0 0 1px white;">
          ${stat.district.name}
        </div>
      `;
      const labelIcon = L.divIcon({
        html: labelHtml,
        className: "bg-transparent border-none",
        iconSize: [80, 20],
        iconAnchor: [40, 10],
      });

      L.marker(labelLatLng, { icon: labelIcon, interactive: false }).addTo(markersGroup);

      // Add Pulsing Radar overlay if the spike is significant (>15%)
      if (stat.spike > 15) {
        const pulseHtml = `
          <div class="relative flex items-center justify-center h-4 w-4 pointer-events-none">
            <div class="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping"></div>
            <div class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></div>
          </div>
        `;
        const pulseIcon = L.divIcon({
          html: pulseHtml,
          className: "bg-transparent border-none",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        // Place pulse slightly offset from text label center to avoid overlapping
        const pulseLatLng = L.latLng(labelLatLng.lat - 0.09, labelLatLng.lng);
        L.marker(pulseLatLng, { icon: pulseIcon, interactive: false }).addTo(markersGroup);
      }
    });
  }, [districtStats, selectedId, hoveredId, lowT, highT, maxTotal, ready]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" style={{ background: "transparent" }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/60 backdrop-blur-sm pointer-events-none z-[1000]">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Loading Leaflet Map…
          </div>
        </div>
      )}
    </>
  );
}
