import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { SubArea } from "@/data/mock";
import karnatakaGeo from "@/data/karnataka.geojson.json";

const MAPTILER_KEY = "vJbuGTzYMGTLnGWttx64";

const NAME_ALIAS: Record<string, string> = {
  "Bengaluru Urban": "Bengaluru Urban",
  "Mangaluru": "Dakshina Kannada",
  "Hubballi-Dharwad": "Dharwad",
};
const toGeo = (n: string) => NAME_ALIAS[n] ?? n;

function heatColor(heat: number, low: number, high: number) {
  if (heat >= high) return "#dc2626";
  if (heat >= (low + high) / 2) return "#f59e0b";
  if (heat >= low) return "#22d3ee";
  return "#a5f3fc";
}

type Ring = number[][];
function extractRings(geometry: unknown): Ring[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = geometry as any;
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates[0]];
  if (g.type === "MultiPolygon") return g.coordinates.map((p: Ring[]) => p[0]);
  return [];
}

function bboxOfRings(rings: Ring[]): [[number, number], [number, number]] | null {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!isFinite(minLng)) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
}

type Props = {
  areas: SubArea[];
  maxAreaFirs: number;
  selectedAreaId: string | null;
  onSelectArea: (id: string) => void;
  matchesFilters: (a: SubArea) => boolean;
  filtersActive: boolean;
  lowT: number;
  highT: number;
  districtName: string;
  spikeThreshold: number;
};


export function SubAreaMapGL({
  areas,
  maxAreaFirs,
  selectedAreaId,
  onSelectArea,
  matchesFilters,
  filtersActive,
  lowT,
  highT,
  districtName,
  spikeThreshold,
}: Props) {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelectArea);
  onSelectRef.current = onSelectArea;
  const loadedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const districtFeature = useMemo(() => {
    const target = toGeo(districtName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats = (karnatakaGeo as any).features as any[];
    return feats.find((f) => {
      const p = f.properties ?? {};
      return p.district === target || p.NAME === target || p.name === target;
    });
  }, [districtName]);

  const districtRings = useMemo(
    () => (districtFeature ? extractRings(districtFeature.geometry) : []),
    [districtFeature]
  );
  const districtBbox = useMemo(() => bboxOfRings(districtRings), [districtRings]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const style: StyleSpecification = {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "osm": {
          "type": "raster",
          "tiles": ["https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png"],
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
      center: [76.5, 15.0],
      zoom: 8,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl({ container: containerRef.current!.parentElement ?? containerRef.current! }), "top-right");

    const onLoad = () => {
      loadedRef.current = true;
      setReady(true);

      const worldRing: number[][] = [
        [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85],
      ];
      map.addSource("district-mask", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [worldRing] } },
      });
      map.addLayer({
        id: "district-mask-fill",
        type: "fill",
        source: "district-mask",
        paint: { "fill-color": "#f8fafc", "fill-opacity": 0.85 },
      });

      map.addSource("district-outline-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "district-outline",
        type: "line",
        source: "district-outline-src",
        paint: { "line-color": "#1e3a8a", "line-width": 2.5 },
      });

      map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "areas-pulse",
        type: "circle",
        source: "areas",
        filter: ["get", "pulse"],
        paint: {
          "circle-radius": ["+", ["get", "radius"], 8],
          "circle-color": "#dc2626",
          "circle-opacity": 0.25,
          "circle-blur": 0.5,
        },
      });
      map.addLayer({
        id: "areas-circles",
        type: "circle",
        source: "areas",
        paint: {
          "circle-radius": ["get", "radius"],
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": ["case", ["get", "selected"], "#1e3a8a", "#ffffff"],
          "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
        },
      });
      map.addLayer({
        id: "areas-labels",
        type: "symbol",
        source: "areas",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Open Sans Regular", "Arial Unicode MS"],
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      map.on("mouseenter", "areas-circles", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "areas-circles", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("mousemove", "areas-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:12px system-ui;padding:2px 4px">
               <div style="font-weight:600">${p.name ?? "—"}</div>
               <div style="color:#64748b">${p.firs ?? 0} FIRs · ${p.topCrime ?? ""}</div>
               <div style="color:#64748b">peak ${p.peakHours ?? ""}</div>
             </div>`,
          )
          .addTo(map);
      });
      map.on("click", "areas-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as { id?: string }).id;
        if (id) onSelectRef.current(id);
      });
    };
    if (map.isStyleLoaded()) onLoad();
    else map.on("load", onLoad);

    const handleResize = () => {
      const m = mapRef.current;
      if (!m) return;
      m.resize();
      setTimeout(() => m.resize(), 250);
    };
    document.addEventListener("fullscreenchange", handleResize);
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      document.removeEventListener("fullscreenchange", handleResize);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Update district outline + mask + fit bounds when district changes
  useEffect(() => {
    const map = mapRef.current;
    const apply = () => {
      const m = mapRef.current;
      if (!m || !loadedRef.current) return;

      const outlineSrc = m.getSource("district-outline-src") as maplibregl.GeoJSONSource | undefined;
      const maskSrc = m.getSource("district-mask") as maplibregl.GeoJSONSource | undefined;
      const worldRing: number[][] = [
        [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85],
      ];

      if (districtFeature && districtRings.length > 0) {
        outlineSrc?.setData({
          type: "FeatureCollection",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          features: [districtFeature as any],
        });
        maskSrc?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [worldRing, ...districtRings] },
        });
      } else {
        outlineSrc?.setData({ type: "FeatureCollection", features: [] });
        maskSrc?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [worldRing] },
        });
      }

      if (districtBbox) {
        // pad maxBounds a bit so the user can still nudge around
        const [[minLng, minLat], [maxLng, maxLat]] = districtBbox;
        const dLng = (maxLng - minLng) * 0.25 + 0.05;
        const dLat = (maxLat - minLat) * 0.25 + 0.05;
        m.setMaxBounds([[minLng - dLng, minLat - dLat], [maxLng + dLng, maxLat + dLat]]);
        m.fitBounds(districtBbox, { padding: 40, duration: 500, maxZoom: 12 });
      }
    };

    if (map && loadedRef.current) apply();
    else if (map) map.once("load", apply);
  }, [districtFeature, districtRings, districtBbox]);

  // Update marker data whenever inputs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("areas") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const features = areas.map((a) => {
      const heat = a.firs / Math.max(maxAreaFirs, 1);
      const dim = filtersActive && !matchesFilters(a);
      const selected = selectedAreaId === a.id;
      const color = dim ? "#cbd5e1" : heatColor(heat, lowT, highT);
      const radius = 8 + heat * 22;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
        properties: {
          id: a.id,
          name: a.name,
          firs: a.firs,
          topCrime: a.topCrime,
          peakHours: a.peakHours,
          color,
          radius,
          opacity: dim ? 0.3 : selected ? 0.95 : 0.8,
          selected,
          pulse: !dim && a.spike > spikeThreshold,
        },
      };
    });

    src.setData({ type: "FeatureCollection", features });
  }, [areas, maxAreaFirs, selectedAreaId, filtersActive, matchesFilters, lowT, highT, spikeThreshold]);


  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2/60 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Loading map…
          </div>
        </div>
      )}
    </>
  );
}
