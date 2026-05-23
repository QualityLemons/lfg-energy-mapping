import { useState, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Layout } from "@/components/layout";
import { EpcChoroplethLayer } from "@/components/map/epc-choropleth-layer";
import { useEpcData, useEpcMsoaData, getEpcColor } from "@/hooks/use-epc-data";
import type { EpcBandRow, EpcMsoaRow } from "@/hooks/use-epc-data";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Home, Search, Plus, Minus, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";
import { fixLeafletIcons } from "@/lib/leaflet-icons";

fixLeafletIcons();

const BAND_COLORS: Record<string, string> = {
  A: "#15803d",
  B: "#22c55e",
  C: "#86efac",
  D: "#fde047",
  E: "#fb923c",
  F: "#ef4444",
  G: "#991b1b",
};

function EpcLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-background/90 border border-border rounded-md shadow-lg p-3">
      <p className="text-xs font-mono font-bold text-muted-foreground mb-2 uppercase tracking-wider">% Rated A–C</p>
      <div className="space-y-1">
        {[
          { label: "≥ 60%", color: "#15803d" },
          { label: "50–60%", color: "#22c55e" },
          { label: "40–50%", color: "#86efac" },
          { label: "35–40%", color: "#fde047" },
          { label: "28–35%", color: "#fb923c" },
          { label: "20–28%", color: "#ef4444" },
          { label: "< 20%", color: "#991b1b" },
          { label: "No data", color: "#d1d5db" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border border-border/30" style={{ backgroundColor: color }} />
            <span className="text-xs font-mono text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NationalBandChart({ totals }: { totals: { A: number; B: number; C: number; D: number; E: number; F: number; G: number; total: number } }) {
  const data = ["A", "B", "C", "D", "E", "F", "G"].map((band) => ({
    band,
    count: totals[band as keyof typeof totals] as number,
    pct: (((totals[band as keyof typeof totals] as number) / totals.total) * 100).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "monospace" }} />
        <YAxis hide />
        <RechartsTooltip
          cursor={{ fill: "hsl(var(--muted)/0.3)" }}
          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}
          formatter={(value, _name, props) => [`${props.payload.pct}% (${(value as number).toLocaleString()})`, "Homes"]}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.band} fill={BAND_COLORS[entry.band]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AreaRankList({ areas, label, selectedCode, onSelect }: {
  areas: Array<{ name: string; code: string; abcPct: number; total: number }>;
  label: string;
  selectedCode?: string | null;
  onSelect?: (code: string, name: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      {areas.map((area, i) => (
        <button
          key={area.code}
          className={`w-full text-left flex items-center gap-2 rounded px-1 py-0.5 transition-colors ${
            selectedCode === area.code ? "bg-primary/10" : "hover:bg-muted/50"
          }`}
          onClick={() => onSelect?.(area.code, area.name)}
        >
          <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono truncate">{area.name}</span>
              <span className="text-xs font-mono font-bold ml-2" style={{ color: getEpcColor(area.abcPct) }}>
                {(area.abcPct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-1 mt-0.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${area.abcPct * 100}%`, backgroundColor: getEpcColor(area.abcPct) }} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function EpcBandChart({ epc, height = 120 }: { epc: EpcBandRow | EpcMsoaRow; height?: number }) {
  const bands = ["A", "B", "C", "D", "E", "F", "G"].map((b) => ({
    band: b,
    count: epc[`${b}_n` as keyof typeof epc] as number,
    pct: ((epc[`${b}_pct` as keyof typeof epc] as number) * 100).toFixed(1),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bands} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "monospace" }} />
        <YAxis hide />
        <RechartsTooltip
          cursor={{ fill: "hsl(var(--muted)/0.3)" }}
          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "4px", fontFamily: "monospace", fontSize: "11px" }}
          formatter={(value, _name, props) => [`${props.payload.pct}% (${(value as number).toLocaleString()})`, "Homes"]}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {bands.map((entry) => (
            <Cell key={entry.band} fill={BAND_COLORS[entry.band]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SelectedAreaPanel({
  name,
  epc,
  postcode,
  msoa,
}: {
  name: string;
  epc: EpcBandRow;
  postcode?: string;
  msoa?: { code: string; name: string; epc: EpcMsoaRow } | null;
}) {
  return (
    <div className="space-y-3">
      {/* MSOA-level panel — shown when postcode search resolves to a neighbourhood */}
      {msoa && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div>
            <p className="text-xs font-mono text-primary/80 uppercase tracking-wider font-bold">Neighbourhood (MSOA)</p>
            <h3 className="font-mono font-bold text-foreground text-sm mt-0.5 leading-tight">{msoa.name}</h3>
            {postcode && <p className="text-xs font-mono text-muted-foreground/70">via {postcode}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: getEpcColor(msoa.epc.ABC_pct), color: getEpcColor(msoa.epc.ABC_pct) }}>
              {(msoa.epc.ABC_pct * 100).toFixed(1)}% A–C
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{msoa.epc.number_of_epcs.toLocaleString()} certs</span>
          </div>
          <EpcBandChart epc={msoa.epc} height={100} />
        </div>
      )}

      {/* LAD-level panel */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{msoa ? "Local Authority" : "Selected Area"}</p>
        <h3 className="font-mono font-bold text-foreground text-base mt-0.5">{name}</h3>
        {!msoa && postcode && (
          <p className="text-xs font-mono text-muted-foreground mt-0.5">via postcode {postcode}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: getEpcColor(epc.ABC_pct), color: getEpcColor(epc.ABC_pct) }}>
            {(epc.ABC_pct * 100).toFixed(1)}% A–C
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{epc.number_of_epcs.toLocaleString()} certs</span>
        </div>
      </div>
      <EpcBandChart epc={epc} height={120} />
    </div>
  );
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
  adminDistrictCode: string | null;
  adminDistrict: string | null;
  msoaCode: string | null;
  msoaName: string | null;
}

function EpcPostcodeSearch({
  mapRef,
  epcMap,
  msoaMap,
  onResult,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  epcMap: Map<string, EpcBandRow> | undefined;
  msoaMap: Map<string, EpcMsoaRow> | undefined;
  onResult: (
    postcode: string,
    code: string,
    name: string,
    epc: EpcBandRow,
    msoa: { code: string; name: string; epc: EpcMsoaRow } | null
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PostcodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!q) return;

    setIsSearching(true);
    setError(null);
    setSuggestions([]);

    try {
      // Try exact postcode first
      const exactRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`);
      if (exactRes.ok) {
        const json = await exactRes.json();
        if (json.result) {
          applyResult({
            postcode: json.result.postcode,
            lat: json.result.latitude,
            lon: json.result.longitude,
            adminDistrictCode: json.result.codes?.admin_district ?? null,
            adminDistrict: json.result.admin_district ?? null,
            msoaCode: json.result.codes?.msoa ?? null,
            msoaName: json.result.msoa ?? null,
          });
          return;
        }
      }

      // Fall back to autocomplete + bulk lookup
      const autoRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete`);
      if (autoRes.ok) {
        const autoJson = await autoRes.json();
        if (autoJson.result?.length > 0) {
          const bulkRes = await fetch("https://api.postcodes.io/postcodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postcodes: autoJson.result.slice(0, 8) }),
          });
          if (bulkRes.ok) {
            const bulkJson = await bulkRes.json();
            const found: PostcodeResult[] = (bulkJson.result ?? [])
              .filter((r: any) => r.result)
              .map((r: any) => ({
                postcode: r.result.postcode,
                lat: r.result.latitude,
                lon: r.result.longitude,
                adminDistrictCode: r.result.codes?.admin_district ?? null,
                adminDistrict: r.result.admin_district ?? null,
                msoaCode: r.result.codes?.msoa ?? null,
                msoaName: r.result.msoa ?? null,
              }));
            if (found.length === 1) {
              applyResult(found[0]);
            } else if (found.length > 1) {
              setSuggestions(found);
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
  }, [query, epcMap]);

  const applyResult = useCallback((result: PostcodeResult) => {
    setQuery(result.postcode);
    setShowDropdown(false);
    setSuggestions([]);

    mapRef.current?.flyTo([result.lat, result.lon], 11, { duration: 1.2 });

    const code = result.adminDistrictCode;
    const name = result.adminDistrict ?? "Unknown";
    const epc = code ? epcMap?.get(code) : undefined;

    const msoaCode = result.msoaCode;
    const msoaName = result.msoaName ?? msoaCode ?? "Unknown";
    const msoaEpc = msoaCode ? msoaMap?.get(msoaCode) : undefined;
    const msoa = msoaCode && msoaEpc ? { code: msoaCode, name: msoaName, epc: msoaEpc } : null;

    if (code && epc) {
      onResult(result.postcode, code, name, epc, msoa);
    } else if (msoa) {
      // We have MSOA data even if no LAD match — still show what we have
      setError(`No local authority EPC data for ${name}, showing neighbourhood only`);
      onResult(result.postcode, code ?? "", name, epc ?? {} as EpcBandRow, msoa);
    } else {
      setError(`No EPC data found for ${name}`);
    }
  }, [mapRef, epcMap, msoaMap, onResult]);

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setError(null);
    setShowDropdown(false);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-72">
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
            placeholder="Search postcode for EPC data…"
            className="flex-1 px-2 py-2 text-sm font-mono bg-transparent outline-none placeholder:text-muted-foreground/60"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" onClick={handleClear} className="px-2 text-muted-foreground hover:text-foreground transition-colors">
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

        {showDropdown && suggestions.length > 0 && (
          <ul className="mt-1 bg-background/95 border border-border rounded-md shadow-lg overflow-hidden">
            {suggestions.map((r) => (
              <li key={r.postcode}>
                <button
                  type="button"
                  onClick={() => applyResult(r)}
                  className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-accent hover:text-accent-foreground transition-colors flex items-baseline gap-2"
                >
                  <span className="text-foreground">{r.postcode}</span>
                  {r.adminDistrict && (
                    <span className="text-xs text-muted-foreground truncate">{r.adminDistrict}</span>
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

export default function EpcPage() {
  const { data, isLoading } = useEpcData();
  const { data: msoaMap } = useEpcMsoaData();
  const [selectedArea, setSelectedArea] = useState<{
    name: string;
    epc: EpcBandRow;
    postcode?: string;
    code: string;
    msoa?: { code: string; name: string; epc: EpcMsoaRow } | null;
  } | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const handlePostcodeResult = useCallback((
    postcode: string,
    code: string,
    name: string,
    epc: EpcBandRow,
    msoa: { code: string; name: string; epc: EpcMsoaRow } | null
  ) => {
    setSelectedArea({ name, epc, postcode, code, msoa });
  }, []);

  const handleAreaClick = useCallback((name: string, epc: EpcBandRow) => {
    const code = data?.epcMap
      ? Array.from(data.epcMap.entries()).find(([, v]) => v === epc)?.[0] ?? ""
      : "";
    setSelectedArea({ name, epc, code });
  }, [data]);

  const handleRankSelect = useCallback((code: string, name: string) => {
    const epc = data?.epcMap?.get(code);
    if (!epc) return;
    setSelectedArea({ name, epc, code });
    // Find a representative point for this LAD from the geojson and fly there
    const feature = data?.geojson.features.find((f) => f.properties?.LAD13CD === code);
    if (feature && mapRef.current) {
      // Use the first coordinate of the feature as an approximation
      try {
        const coords = (feature.geometry as GeoJSON.MultiPolygon | GeoJSON.Polygon).coordinates;
        const firstRing = Array.isArray(coords[0][0][0]) ? (coords as number[][][][])[0][0] : (coords as number[][][])[0];
        const lons = firstRing.map((c) => c[0]);
        const lats = firstRing.map((c) => c[1]);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        mapRef.current.flyTo([centerLat, centerLon], 9, { duration: 1.0 });
      } catch {
        // ignore navigation errors
      }
    }
  }, [data]);

  return (
    <Layout>
      <div className="flex h-full w-full pt-16">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <MapContainer
            center={[54.5, -3.5]}
            zoom={6}
            className="h-full w-full z-0"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <MapRefCapture mapRef={mapRef} />
            <ZoomControls />
            <EpcChoroplethLayer
              onAreaClick={handleAreaClick}
              selectedCode={selectedArea?.code ?? null}
            />
          </MapContainer>

          <EpcLegend />

          {data && (
            <EpcPostcodeSearch
              mapRef={mapRef}
              epcMap={data.epcMap}
              msoaMap={msoaMap}
              onResult={handlePostcodeResult}
            />
          )}

          {isLoading && (
            <div className="absolute bottom-6 right-6 z-[1000] bg-background/90 border border-border px-4 py-2 rounded-md shadow-lg flex items-center gap-3">
              <div className="size-2 bg-primary rounded-full animate-ping" />
              <span className="font-mono text-xs text-muted-foreground">Loading EPC data...</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 h-full border-l border-border bg-background overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-5">
            <div>
              <h2 className="font-mono font-bold text-lg flex items-center gap-2">
                <Home className="size-5 text-primary" />
                EPC Ratings
              </h2>
              <p className="text-xs text-muted-foreground font-mono mt-1 leading-relaxed">
                Energy Performance Certificates by Local Authority, England &amp; Wales. Source: Friends of the Earth, April 2025.
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : data ? (
              <>
                {/* National summary */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardDescription className="font-mono text-xs uppercase tracking-wider font-bold">National Overview</CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-mono font-bold" style={{ color: getEpcColor(data.nationalTotals.abcPct) }}>
                        {(data.nationalTotals.abcPct * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">rated A–C</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {data.nationalTotals.total.toLocaleString()} total certificates
                    </p>
                    <NationalBandChart totals={data.nationalTotals} />
                  </CardContent>
                </Card>

                {/* Selected area */}
                {selectedArea ? (
                  <Card className="bg-card border-border border-primary/30">
                    <CardContent className="p-3">
                      <SelectedAreaPanel
                        name={selectedArea.name}
                        epc={selectedArea.epc}
                        postcode={selectedArea.postcode}
                        msoa={selectedArea.msoa}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono italic">
                    Search a postcode above to see neighbourhood-level data, or click an area on the map.
                  </p>
                )}

                {/* Top performers */}
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <AreaRankList
                      areas={data.topAreas}
                      label="Best rated areas"
                      selectedCode={selectedArea?.code}
                      onSelect={handleRankSelect}
                    />
                  </CardContent>
                </Card>

                {/* Bottom performers */}
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <AreaRankList
                      areas={data.bottomAreas}
                      label="Lowest rated areas"
                      selectedCode={selectedArea?.code}
                      onSelect={handleRankSelect}
                    />
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
