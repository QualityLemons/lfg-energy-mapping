import { useState, useMemo, useRef, useCallback } from "react";
import {
  getGetEnergyFeaturesQueryKey,
  getGetFlexibilityByPostcodeQueryKey,
  getGetIndustrialAreasQueryKey,
  useGetEnergyFeatures,
  useGetFlexibilityByPostcode,
  useGetIndustrialAreas,
  type FlexibilityLookup,
} from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { fixLeafletIcons } from "@/lib/leaflet-icons";
import { FeatureDetail } from "@/components/feature-detail";
import { EpcChoroplethLayer } from "@/components/map/epc-choropleth-layer";
import { IndustrialAreaLayer } from "@/components/map/industrial-area-layer";
import { LsoaBoundaryLayer } from "@/components/map/lsoa-boundary-layer";
import { Factory, Loader2, MapPin, Search, Zap, Plus, Minus, X } from "lucide-react";

fixLeafletIcons();

const createColorIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const ICONS = {
  generator: createColorIcon('#00ff88'),
  substation: createColorIcon('#00ccff'),
  tower: createColorIcon('#888888'),
  line: '#ff8800',
  cable: '#ff8800',
  plant: createColorIcon('#00ff88'),
  default: createColorIcon('#ffffff'),
};

const POSTCODE_ICON = L.divIcon({
  className: "postcode-marker",
  html: '<div style="background:#f97316;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px rgba(249,115,22,0.35),0 2px 8px rgba(0,0,0,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const LINE_COLORS = {
  line: '#ff8800',
  cable: '#ff8800',
  default: '#888888'
};

function MapEventHandler({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => { onBoundsChange(map.getBounds()); },
    zoomend: () => { onBoundsChange(map.getBounds()); }
  });
  useMemo(() => {
    setTimeout(() => { onBoundsChange(map.getBounds()); }, 100);
  }, [map, onBoundsChange]);
  return null;
}

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useMemo(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-1">
      <button
        onClick={() => map.zoomIn()}
        className="w-9 h-9 flex items-center justify-center bg-background/90 border border-border rounded-md shadow-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Zoom in"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-9 h-9 flex items-center justify-center bg-background/90 border border-border rounded-md shadow-md text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Zoom out"
      >
        <Minus className="w-4 h-4" />
      </button>
    </div>
  );
}

interface PostcodeResult {
  postcode: string;
  lat: number;
  lon: number;
  admin_district: string | null;
}

function normalisePostcode(postcode: string): string {
  return postcode.toUpperCase().replace(/\s+/g, "");
}

function PostcodeSearch({
  mapRef,
  onResult,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  onResult?: (result: PostcodeResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostcodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const flyToResult = useCallback((result: PostcodeResult) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([result.lat, result.lon], 14, { duration: 1.2 });
  }, [mapRef]);

  const handleResolvedResult = useCallback((result: PostcodeResult) => {
    flyToResult(result);
    setQuery(result.postcode);
    setShowDropdown(false);
    setResults([]);
    onResult?.(result);
  }, [flyToResult, onResult]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!q) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      // Try exact lookup first
      const exactRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`);
      if (exactRes.ok) {
        const json = await exactRes.json();
        if (json.result) {
          const r = json.result;
          const result: PostcodeResult = {
            postcode: r.postcode,
            lat: r.latitude,
            lon: r.longitude,
            admin_district: r.admin_district,
          };
          handleResolvedResult(result);
          return;
        }
      }

      // Fall back to autocomplete
      const autoRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete`);
      if (autoRes.ok) {
        const json = await autoRes.json();
        if (json.result && json.result.length > 0) {
          // Bulk lookup for coordinates
          const bulkRes = await fetch("https://api.postcodes.io/postcodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postcodes: json.result.slice(0, 8) }),
          });
          if (bulkRes.ok) {
            const bulkJson = await bulkRes.json();
            const found: PostcodeResult[] = (bulkJson.result ?? [])
              .filter((r: any) => r.result)
              .map((r: any) => ({
                postcode: r.result.postcode,
                lat: r.result.latitude,
                lon: r.result.longitude,
                admin_district: r.result.admin_district,
              }));
            if (found.length === 1) {
              handleResolvedResult(found[0]);
            } else if (found.length > 1) {
              setResults(found);
              setShowDropdown(true);
            } else {
              setError("No results found");
            }
          }
        } else {
          setError("No results found");
        }
      } else {
        setError("Postcode not found");
      }
    } catch {
      setError("Search failed — check your connection");
    } finally {
      setIsSearching(false);
    }
  }, [handleResolvedResult, query]);

  const handleSelect = (result: PostcodeResult) => {
    handleResolvedResult(result);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setShowDropdown(false);
  };

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] w-72">
      <form onSubmit={handleSearch} className="relative">
        <div className="flex items-center bg-background/95 border border-border rounded-md shadow-lg overflow-hidden">
          <Search className="w-4 h-4 ml-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
              if (!e.target.value) setShowDropdown(false);
            }}
            onKeyDown={(e) => e.key === "Escape" && setShowDropdown(false)}
            placeholder="Search postcode…"
            className="flex-1 px-2 py-2 text-sm font-mono bg-transparent outline-none placeholder:text-muted-foreground/60"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-3 py-2 text-xs font-mono bg-primary/10 border-l border-border text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
          >
            {isSearching ? "…" : "Go"}
          </button>
        </div>

        {error && (
          <div className="mt-1 px-3 py-1.5 bg-background/95 border border-border rounded-md text-xs font-mono text-destructive shadow-md">
            {error}
          </div>
        )}

        {showDropdown && results.length > 0 && (
          <ul className="mt-1 bg-background/95 border border-border rounded-md shadow-lg overflow-hidden">
            {results.map((r) => (
              <li key={r.postcode}>
                <button
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-accent hover:text-accent-foreground transition-colors flex items-baseline gap-2"
                >
                  <span className="text-foreground">{r.postcode}</span>
                  {r.admin_district && (
                    <span className="text-xs text-muted-foreground truncate">{r.admin_district}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}

function PostcodeContextPanel({
  result,
  flexibility,
  isFlexLoading,
  isIndustrialLoading,
  isFlexError,
  industrialCount,
  industrialEnabled,
  isIndustrialError,
}: {
  result: PostcodeResult;
  flexibility?: FlexibilityLookup;
  isFlexLoading: boolean;
  isIndustrialLoading: boolean;
  isFlexError: boolean;
  industrialCount: number | null;
  industrialEnabled: boolean;
  isIndustrialError: boolean;
}) {
  const zones = flexibility?.zones ?? [];

  return (
    <div className="absolute top-20 left-4 z-[1000] w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-background/95 shadow-lg backdrop-blur">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-sm font-bold text-foreground">
          <MapPin className="size-4 text-orange-500" />
          {result.postcode}
        </div>
        {result.admin_district && (
          <div className="mt-1 text-xs font-mono text-muted-foreground">
            {result.admin_district}
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Zap className="size-3.5 text-yellow-500" />
              NGED flexibility
            </div>
            {isFlexLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>

          {isFlexError ? (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive">
              Could not load NGED zones.
            </div>
          ) : zones.length > 0 ? (
            <div className="space-y-2">
              {zones.slice(0, 4).map((zone) => (
                <div key={`${zone.level}-${zone.code}`} className="rounded border border-border/70 bg-muted/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-bold text-foreground">
                        {zone.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {zone.code}
                      </div>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      zone.level === "HV"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-cyan-500/15 text-cyan-600"
                    }`}>
                      {zone.level}
                    </span>
                  </div>
                  {(zone.product || zone.substationName) && (
                    <div className="mt-2 space-y-0.5 font-mono text-[11px] leading-snug text-muted-foreground">
                      {zone.product && <div>{zone.product}</div>}
                      {zone.substationName && <div>{zone.substationName}</div>}
                    </div>
                  )}
                </div>
              ))}
              {zones.length > 4 && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  +{zones.length - 4} more zones
                </div>
              )}
            </div>
          ) : isFlexLoading ? (
            <div className="rounded border border-border/70 bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground">
              Checking postcode against NGED CMZs...
            </div>
          ) : (
            <div className="rounded border border-border/70 bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground">
              No NGED CMZ listed for this postcode.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded border border-border/70 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Factory className="size-3.5 text-purple-500" />
            Industrial estates
          </div>
          <div className="font-mono text-xs text-foreground">
            {industrialEnabled
              ? isIndustrialError
                ? "unavailable"
                : isIndustrialLoading
                  ? "loading..."
                  : industrialCount ?? "0"
              : "off"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EnergyMap() {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<{ id: string, type: 'node'|'way'|'relation' } | null>(null);
  const [selectedPostcode, setSelectedPostcode] = useState<PostcodeResult | null>(null);
  const [showEpc, setShowEpc] = useState(false);
  const [showIndustrial, setShowIndustrial] = useState(true);
  const [showLsoa, setShowLsoa] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const debouncedBounds = useDebounce(bounds, 400);

  const queryParams = debouncedBounds ? {
    south: debouncedBounds.getSouth(),
    west: debouncedBounds.getWest(),
    north: debouncedBounds.getNorth(),
    east: debouncedBounds.getEast(),
  } : null;

  const industrialQueryParams = useMemo(() => {
    if (!selectedPostcode) return null;

    return {
      south: selectedPostcode.lat - 0.01,
      west: selectedPostcode.lon - 0.015,
      north: selectedPostcode.lat + 0.01,
      east: selectedPostcode.lon + 0.015,
    };
  }, [selectedPostcode]);

  const { data: features, isLoading } = useGetEnergyFeatures(
    queryParams as any,
    {
      query: {
        enabled: !!queryParams,
        queryKey: getGetEnergyFeaturesQueryKey(queryParams as any),
        refetchOnWindowFocus: false,
        retry: false,
      },
    }
  );

  const {
    data: industrialAreas,
    isLoading: isIndustrialLoading,
    isError: isIndustrialError,
  } = useGetIndustrialAreas(
    industrialQueryParams as any,
    {
      request: { cache: "no-store" },
      query: {
        enabled: !!industrialQueryParams && showIndustrial,
        queryKey: getGetIndustrialAreasQueryKey(industrialQueryParams as any),
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 60_000,
      },
    },
  );

  const selectedPostcodeKey = selectedPostcode ? normalisePostcode(selectedPostcode.postcode) : "";
  const {
    data: flexibility,
    isLoading: isFlexLoading,
    isError: isFlexError,
  } = useGetFlexibilityByPostcode(selectedPostcodeKey, {
    request: { cache: "no-store" },
    query: {
      enabled: !!selectedPostcodeKey,
      queryKey: getGetFlexibilityByPostcodeQueryKey(selectedPostcodeKey),
      staleTime: Infinity,
    },
  });

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[52.48, -1.9]}
        zoom={10}
        minZoom={9}
        maxBounds={[[51.8, -2.8], [53.1, -0.8]]}
        maxBoundsViscosity={0.8}
        className="h-full w-full z-0 bg-gray-900"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <MapEventHandler onBoundsChange={setBounds} />
        <MapRefCapture mapRef={mapRef} />
        <ZoomControls />

        {showEpc && <EpcChoroplethLayer />}
        <LsoaBoundaryLayer enabled={showLsoa} />
        {showIndustrial && industrialAreas && <IndustrialAreaLayer areas={industrialAreas} />}

        {selectedPostcode && (
          <Marker
            position={[selectedPostcode.lat, selectedPostcode.lon]}
            icon={POSTCODE_ICON}
          />
        )}

        {features?.map((feature) => {
          if (feature.osmType === 'node' && feature.lat && feature.lon) {
            const icon = feature.powerType === 'generator' || feature.powerType === 'plant'
              ? ICONS.generator
              : feature.powerType === 'substation' ? ICONS.substation
              : feature.powerType === 'tower' ? ICONS.tower
              : ICONS.default;

            return (
              <Marker
                key={feature.id}
                position={[feature.lat, feature.lon]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelectedFeature({ id: feature.osmId, type: feature.osmType })
                }}
              />
            );
          } else if (feature.osmType === 'way' && feature.geometry && feature.geometry.coordinates) {
            const positions = (feature.geometry.coordinates as number[][]).map(c => [c[1], c[0]] as [number, number]);
            const color = feature.powerType === 'line' || feature.powerType === 'cable' ? LINE_COLORS.line : LINE_COLORS.default;

            return (
              <Polyline
                key={feature.id}
                positions={positions}
                pathOptions={{ color, weight: 3, opacity: 0.8 }}
                eventHandlers={{
                  click: () => setSelectedFeature({ id: feature.osmId, type: feature.osmType })
                }}
              />
            );
          }
          return null;
        })}
      </MapContainer>

      {/* Postcode search */}
      <PostcodeSearch mapRef={mapRef} onResult={setSelectedPostcode} />

      {selectedPostcode && (
        <PostcodeContextPanel
          result={selectedPostcode}
          flexibility={flexibility}
          isFlexLoading={isFlexLoading}
          isIndustrialLoading={isIndustrialLoading}
          isFlexError={isFlexError}
          industrialCount={showIndustrial ? industrialAreas?.length ?? null : null}
          industrialEnabled={showIndustrial}
          isIndustrialError={isIndustrialError}
        />
      )}

      {/* Layer toggles */}
      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={() => setShowLsoa((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono shadow-md transition-colors ${
            showLsoa
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-background/90 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
          title="Toggle LSOA postcode boundaries"
        >
          <span className={`size-2 rounded-full ${showLsoa ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
          LSOA areas
        </button>
        <button
          onClick={() => setShowEpc((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono shadow-md transition-colors ${
            showEpc
              ? "bg-green-600 border-green-500 text-white"
              : "bg-background/90 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
          title="Toggle UK EPC ratings overlay"
        >
          <span className={`size-2 rounded-full ${showEpc ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
          EPC ratings
        </button>
        <button
          onClick={() => setShowIndustrial((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono shadow-md transition-colors ${
            showIndustrial
              ? "bg-purple-600 border-purple-500 text-white"
              : "bg-background/90 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
          title="Toggle OSM industrial estates around the searched postcode"
        >
          <span className={`size-2 rounded-full ${showIndustrial ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
          Industrial estates
        </button>
        {showIndustrial && !selectedPostcode && (
          <div className="max-w-44 rounded-md border border-purple-500/30 bg-background/90 px-3 py-2 text-[11px] leading-snug text-muted-foreground shadow-md">
            Search a postcode to load nearby OSM industrial areas.
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {(isLoading || isIndustrialLoading) && (
        <div className="absolute bottom-6 left-6 z-[1000] bg-background/90 border border-border px-4 py-2 rounded-md shadow-lg flex items-center gap-3">
          <div className="size-2 bg-primary rounded-full animate-ping" />
          <span className="font-mono text-xs text-muted-foreground">
            {isIndustrialLoading ? "Scanning industrial estates..." : "Scanning grid..."}
          </span>
        </div>
      )}

      {/* Detail Panel */}
      {selectedFeature && (
        <FeatureDetail
          osmId={selectedFeature.id}
          osmType={selectedFeature.type}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
}
