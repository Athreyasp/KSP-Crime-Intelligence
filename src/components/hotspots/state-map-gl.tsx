import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";


import karnatakaGeo from "@/data/karnataka.geojson.json";

const MAPTILER_KEY = "vJbuGTzYMGTLnGWttx64";

const NAME_ALIAS: Record<string, string> = {
  "Bengaluru Urban": "Bengaluru Urban",
  Mangaluru: "Dakshina Kannada",
  "Hubballi-Dharwad": "Dharwad",
};
const toGeo = (n: string) => NAME_ALIAS[n] ?? n;

function heatColor(heat: number, low: number, high: number) {
  if (heat >= high) return "#dc2626";
  if (heat >= (low + high) / 2) return "#f59e0b";
  if (heat >= low) return "#22d3ee";
  return "#a5f3fc";
}

export function StateMapGL({
  districtStats,
  maxTotal,
  selectedId,
  onSelect,
  lowT,
  highT,
}: {
  districtStats: any[];
  maxTotal: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  lowT: number;
  highT: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const loadedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const style: StyleSpecification = {
      version: 8,
      glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`,
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

    // Karnataka bounding box (approx)
    const KA_BOUNDS: [[number, number], [number, number]] = [
      [73.9, 11.4],
      [78.7, 18.6],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [76.5, 15.0],
      zoom: 6.4,
      minZoom: 5.5,
      maxZoom: 12.0,
      maxBounds: [
        [73.0, 10.5],
        [79.5, 19.5],
      ],
      attributionControl: { compact: true },
      scrollZoom: true,
      boxZoom: true,
      doubleClickZoom: true,
      dragRotate: false,
      dragPan: true,
      touchZoomRotate: true,
      keyboard: true,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.FullscreenControl({ container: containerRef.current!.parentElement ?? containerRef.current! }), "top-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.fitBounds(
      KA_BOUNDS,
      { padding: 10, duration: 0 },
    );

    const onLoad = () => {
      loadedRef.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geo: any = JSON.parse(JSON.stringify(karnatakaGeo));

      // annotate features with heat + district id
      const heatByName = new Map<string, { heat: number; districtId: number; total: number; spike: number; name: string }>();
      for (const s of districtStats) {
        heatByName.set(toGeo(s.district.name), {
          heat: s.total / (maxTotal || 1),
          districtId: s.district.id,
          total: s.total,
          spike: s.spike,
          name: s.district.name,
        });
      }
      for (const f of geo.features) {
        const info = heatByName.get(f.properties?.district ?? f.properties?.NAME ?? f.properties?.name);
        f.properties = {
          ...(f.properties ?? {}),
          heat: info?.heat ?? 0,
          districtId: info?.districtId ?? -1,
          total: info?.total ?? 0,
          spike: info?.spike ?? 0,
          districtName: info?.name ?? f.properties?.district ?? f.properties?.NAME,
        };
      }

      if (!map.getSource("ka-districts")) {
        map.addSource("ka-districts", { type: "geojson", data: geo });
      }

      // Build a world-covering mask with Karnataka cut out
      const holes: number[][][] = [];
      for (const f of geo.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === "Polygon") {
          holes.push(g.coordinates[0]);
        } else if (g.type === "MultiPolygon") {
          for (const poly of g.coordinates) holes.push(poly[0]);
        }
      }
      const worldRing: number[][] = [
        [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85],
      ];
      if (!map.getSource("ka-mask")) {
        map.addSource("ka-mask", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [worldRing, ...holes] },
          },
        });
      }
      if (!map.getLayer("ka-mask-fill")) {
        map.addLayer({
          id: "ka-mask-fill",
          type: "fill",
          source: "ka-mask",
          paint: { "fill-color": "#e2e8f0", "fill-opacity": 0.96 },
        });
      }



      if (!map.getLayer("ka-fill")) {
        map.addLayer({
          id: "ka-fill",
          type: "fill",
          source: "ka-districts",
          paint: {
            "fill-color": [
              "case",
              [">=", ["get", "heat"], highT],
              "#dc2626",
              [">=", ["get", "heat"], (lowT + highT) / 2],
              "#f59e0b",
              [">=", ["get", "heat"], lowT],
              "#22d3ee",
              "#a5f3fc",
            ],
            "fill-opacity": [
              "case",
              ["==", ["get", "districtId"], selectedId ?? -999],
              0.88,
              ["boolean", ["feature-state", "hover"], false],
              0.75,
              0.62,
            ],
          },
        });
      }

      if (!map.getLayer("ka-outline")) {
        map.addLayer({
          id: "ka-outline",
          type: "line",
          source: "ka-districts",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "districtId"], selectedId ?? -999],
              "#1e40af",
              "#ffffff",
            ],
            "line-width": [
              "case",
              ["==", ["get", "districtId"], selectedId ?? -999],
              3.0,
              1.4,
            ],
            "line-opacity": [
              "case",
              ["==", ["get", "districtId"], selectedId ?? -999],
              1.0,
              0.85,
            ],
          },
        });
      }

      // Outer Karnataka state border (thicker white/dark)
      if (!map.getLayer("ka-state-border")) {
        map.addLayer({
          id: "ka-state-border",
          type: "line",
          source: "ka-districts",
          paint: {
            "line-color": "#1e293b",
            "line-width": 2.2,
            "line-opacity": 0.55,
          },
        });
      }

      if (!map.getLayer("ka-labels")) {
        map.addLayer({
          id: "ka-labels",
          type: "symbol",
          source: "ka-districts",
          layout: {
            "text-field": ["get", "districtName"],
            "text-size": 10.5,
            "text-font": ["Open Sans Regular"],
            "text-max-width": 8,
          },
          paint: {
            "text-color": "#0f172a",
            "text-halo-color": "rgba(255,255,255,0.92)",
            "text-halo-width": 1.8,
            "text-opacity": 0.95,
          },
        });
      }

      let hoveredId: number | string | null = null;
      map.on("mousemove", "ka-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        if (hoveredId !== null) {
          map.setFeatureState({ source: "ka-districts", id: hoveredId }, { hover: false });
        }
        hoveredId = f.id ?? null;
        if (hoveredId !== null) {
          map.setFeatureState({ source: "ka-districts", id: hoveredId }, { hover: true });
        }
      });
      map.on("mouseleave", "ka-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState({ source: "ka-districts", id: hoveredId }, { hover: false });
        }
        hoveredId = null;
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      map.on("mousemove", "ka-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:12px system-ui;padding:2px 4px">
               <div style="font-weight:600">${p.districtName ?? "—"}</div>
               <div style="color:#64748b">${p.total ?? 0} FIRs · ${p.spike ?? 0}% spike</div>
             </div>`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "ka-fill", () => popup.remove());

      map.on("click", "ka-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as { districtId?: number }).districtId;
        if (typeof id === "number" && id > 0) onSelectRef.current(id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update paint on threshold / selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("ka-fill")) return;
    map.setPaintProperty("ka-fill", "fill-color", [
      "case",
      [">=", ["get", "heat"], highT],
      "#dc2626",
      [">=", ["get", "heat"], (lowT + highT) / 2],
      "#f59e0b",
      [">=", ["get", "heat"], lowT],
      "#22d3ee",
      "#a5f3fc",
    ]);
    map.setPaintProperty("ka-fill", "fill-opacity", [
      "case",
      ["==", ["get", "districtId"], selectedId ?? -999],
      0.78,
      0.5,
    ]);
    map.setPaintProperty("ka-outline", "line-color", [
      "case",
      ["==", ["get", "districtId"], selectedId ?? -999],
      "#1e40af",
      "#ffffff",
    ]);
    map.setPaintProperty("ka-outline", "line-width", [
      "case",
      ["==", ["get", "districtId"], selectedId ?? -999],
      3.0,
      1.4,
    ]);
    map.setPaintProperty("ka-outline", "line-opacity", [
      "case",
      ["==", ["get", "districtId"], selectedId ?? -999],
      1.0,
      0.85,
    ]);
  }, [lowT, highT, selectedId]);

  // Update map source data dynamically when districtStats or maxTotal changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    
    const source = map.getSource("ka-districts") as maplibregl.GeoJSONSource;
    if (!source) return;

    const geo: any = JSON.parse(JSON.stringify(karnatakaGeo));
    const heatByName = new Map<string, { heat: number; districtId: number; total: number; spike: number; name: string }>();
    
    for (const s of districtStats) {
      heatByName.set(toGeo(s.district.name), {
        heat: s.total / (maxTotal || 1),
        districtId: s.district.id,
        total: s.total,
        spike: s.spike,
        name: s.district.name,
      });
    }

    for (const f of geo.features) {
      const info = heatByName.get(f.properties?.district ?? f.properties?.NAME ?? f.properties?.name);
      f.properties = {
        ...(f.properties ?? {}),
        heat: info?.heat ?? 0,
        districtId: info?.districtId ?? -1,
        total: info?.total ?? 0,
        spike: info?.spike ?? 0,
        districtName: info?.name ?? f.properties?.district ?? f.properties?.NAME,
      };
    }

    source.setData(geo);
  }, [districtStats, maxTotal, ready]);

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

export { heatColor as heatColorGL };
