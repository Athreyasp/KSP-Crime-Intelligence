import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { SubArea, Case } from "@/data/mock";
import { useLanguage } from "@/hooks/use-language";

const toGeoLngLat = (area: SubArea): [number, number] => [area.lng, area.lat];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64) {
  const coords = {
    latitude: center[1],
    longitude: center[0]
  };

  const km = radiusInKm;
  const ret: number[][] = [];
  const distanceX = km / (111.32 * Math.cos(coords.latitude * Math.PI / 180));
  const distanceY = km / 110.57;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]); // close the polygon loop

  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [ret]
    },
    properties: {}
  };
}

// Map major head IDs to Google Material design category colors
const getCrimeColor = (headId: number): string => {
  switch (headId) {
    case 1: return "#dc2626"; // Heinous / violent -> Red
    case 2: return "#f59e0b"; // Property -> Amber
    case 3: return "#0b57d0"; // Cyber -> Blue
    case 4: return "#10b981"; // Narcotics -> Green
    default: return "#8b5cf6"; // Others -> Purple
  }
};

type Props = {
  area: SubArea;
  cases: Case[];
  selectedSpotId: string | null;
  onSelectSpot: (id: string | null) => void;
  lowT: number;
  highT: number;
};

export function MicroSpotMapGL({
  area,
  cases,
  selectedSpotId,
  onSelectSpot,
  lowT,
  highT
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const { t } = useLanguage();
  const onSelectRef = useRef(onSelectSpot);
  onSelectRef.current = onSelectSpot;

  const center = useMemo(() => toGeoLngLat(area), [area]);

  // Geographically filter cases within a 3.5 km precinct boundary
  const localCases = useMemo(() => {
    return cases.filter(c => {
      if (!c.latitude || !c.longitude) return false;
      const dist = haversineDistance(c.latitude, c.longitude, area.lat, area.lng);
      return dist <= 3.5;
    });
  }, [cases, area]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const style: StyleSpecification = {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "osm": {
          "type": "raster",
          "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          "tileSize": 256,
          "attribution": "&copy; OpenStreetMap &copy; CartoDB"
        }
      },
      layers: [
        {
          "id": "osm-tiles",
          "type": "raster",
          "source": "osm",
          "minzoom": 0,
          "maxzoom": 19
        }
      ]
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: center,
      zoom: 14.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const onLoad = () => {
      loadedRef.current = true;

      // Add Sub-Area Circular Range Boundary Source & Layers
      const circleGeoJSON = createGeoJSONCircle(center, 3.0);
      map.addSource("precinct-boundary", {
        type: "geojson",
        data: circleGeoJSON
      });

      map.addLayer({
        id: "precinct-boundary-fill",
        type: "fill",
        source: "precinct-boundary",
        paint: {
          "fill-color": "#0b57d0",
          "fill-opacity": 0.05
        }
      });

      map.addLayer({
        id: "precinct-boundary-stroke",
        type: "line",
        source: "precinct-boundary",
        paint: {
          "line-color": "#3b82f6",
          "line-width": 1.2,
          "line-opacity": 0.35,
          "line-dasharray": [4, 4]
        }
      });

      // Add Cases GeoJSON Source & Layers
      map.addSource("case-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "case-markers-glow",
        type: "circle",
        source: "case-points",
        paint: {
          "circle-radius": 14,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.15,
          "circle-blur": 0.4
        }
      });

      map.addLayer({
        id: "case-markers",
        type: "circle",
        source: "case-points",
        paint: {
          "circle-radius": ["case", ["get", "selected"], 9, 6.5],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["get", "selected"], 0.95, 0.75],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["get", "selected"], 2.5, 1.5]
        }
      });

      map.addLayer({
        id: "case-labels",
        type: "symbol",
        source: "case-points",
        layout: {
          "text-field": ["get", "crimeNo"],
          "text-size": 9.5,
          "text-font": ["Open Sans Regular", "Arial Unicode MS"],
          "text-offset": [0, -1.3],
          "text-anchor": "bottom",
          "text-allow-overlap": false
        },
        paint: {
          "text-color": "#202124",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6
        }
      });

      // Setup Popups for Interactive Hovering
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      map.on("mouseenter", "case-markers", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "case-markers", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("mousemove", "case-markers", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font: 11px system-ui; padding: 4px; max-width: 220px; line-height: 1.4">
               <div style="font-weight: 700; color: #0b57d0">${p.crimeNo}</div>
               <div style="font-weight: 600; color: #202124; margin-top: 2px">${t(p.crimeHead)}</div>
               <div style="color: #5f6368; font-size: 10px; margin-top: 1px">${t(p.status)} · ${p.date}</div>
               <div style="color: #202124; font-size: 10px; margin-top: 4px; border-t: 1px solid #dadce0; padding-top: 4px">${p.facts}</div>
             </div>`
          )
          .addTo(map);
      });

      map.on("click", "case-markers", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as { id?: string }).id;
        if (id) onSelectRef.current(id);
      });

      setReady(true);
    };

    // Use style.load (fires when style spec is processed, not waiting for all tiles)
    if (map.isStyleLoaded()) {
      onLoad();
    } else {
      map.once("style.load", onLoad);
      map.once("load", onLoad); // Secondary fallback
    }

    const handleResize = () => {
      const m = mapRef.current;
      if (!m) return;
      m.resize();
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Update center and boundary overlay if area changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    map.flyTo({ center, zoom: 14.5, duration: 800 });

    const boundarySrc = map.getSource("precinct-boundary") as maplibregl.GeoJSONSource | undefined;
    if (boundarySrc) {
      boundarySrc.setData(createGeoJSONCircle(center, 3.0));
    }
  }, [center, ready]);

  // Update case data points
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("case-points") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const features = localCases.map((c) => {
      const selected = selectedSpotId === String(c.caseMasterId);
      const color = getCrimeColor(c.crimeHead.id);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [c.longitude, c.latitude] },
        properties: {
          id: String(c.caseMasterId),
          crimeNo: c.crimeNo,
          crimeHead: c.crimeHead.name,
          date: new Date(c.registeredDate).toLocaleDateString("en-IN"),
          status: c.status,
          facts: c.briefFacts,
          color,
          selected
        }
      };
    });

    src.setData({ type: "FeatureCollection", features });
  }, [localCases, selectedSpotId, ready]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2/60 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Loading precinct map…
          </div>
        </div>
      )}
    </>
  );
}
