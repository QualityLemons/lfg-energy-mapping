import { useState, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import { Layout } from "@/components/layout";
import { useWardEnvData, getEnvColor, WARD_METRICS } from "@/hooks/use-ward-env-data";
import type { WardRow, LadAggregate, MetricDef } from "@/hooks/use-ward-env-data";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Leaf, Search, Plus, Minus, X, ChevronDown } from "lucide-react";
import { fixLeafletIcons } from "@/lib/leaflet-icons";

fixLeafletIcons();

const UK_LAD_GEOJSON_URL =
  "https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/administrative/gb/lad.json";

function useUkLadGeoJson() {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  useMemo(() => {
    setLoading(true);
    fetch(UK_LAD_GEOJSON_URL)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading };
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
      <button onClick={() => map.zoomIn()} className="w-9 h-9 flex items-center justify-center bg-background/90 border border-border rounded-md shadow-md text-foreground hover:bg-accent transition-colors" title="Zoom in">
        <Plus className="w-4 h-4" />
      </button>
      <button onClick={() => map.zoomOut()} className="w-9 h-9 flex items-center justify-center bg-background/90 border border-border rounded-md shadow-md text-foreground hover:bg-accent transition-colors" title="Zoom out">
        <Minus className="w-4 h-4" />
      </button>
    </div>
  );
}

function EnvChoroplethLayer({
  geojson,
  ladMap,
  metric,
  selectedCode,
  onAreaClick,
}: {
  geojson: GeoJSON.FeatureCollection;
  ladMap: Map<string, LadAggregate>;
  metric: MetricDef;
  selectedCode: string | null;
  onAreaClick: (code: string, name: string, agg: LadAggregate) => void;
}) {
  const values = Array.from(ladMap.values()).map((a) => a[metric.key] as number).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <GeoJSON
      key={`env-${metric.key}-${selectedCode ?? "none"}`}
      data={geojson}
      style={(feature): PathOptions => {
        const code = feature?.properties?.LAD13CD as string;
        const agg = ladMap.get(code);
        const value = agg ? (agg[metric.key] as number) : null;
        const isSelected = selectedCode === code;
        return {
          fillColor: value != null ? getEnvColor(value, min, max, metric.higherIsBad) : "#d1d5db",
          weight: isSelected ? 3 : 0.6,
          color: isSelected ? "#f97316" : "#ffffff",
          fillOpacity: isSelected ? 0.9 : 0.72,
          opacity: 1,
        };
      }}
      onEachFeature={(feature, layer: Layer) => {
        const code = feature.properties?.LAD13CD as string;
        const name = feature.properties?.LAD13NM as string ?? "Unknown";
        const agg = ladMap.get(code);

        if (agg) {
          const val = agg[metric.key] as number;
          const tooltip = `
            <div style="font-family:monospace;font-size:12px;line-height:1.7">
              <strong>${name}</strong><br/>
              ${metric.label}: <strong>${metric.format(val)}</strong><br/>
              <span style="color:#888">${agg.wardCount} wards</span>
            </div>`;
          (layer as any).bindTooltip(tooltip, { sticky: true, opacity: 0.95 });

          layer.on("mouseover", (e: LeafletMouseEvent) => {
            (e.target as any).setStyle({ weight: 2, color: "#1e293b", fillOpacity: 0.88 });
          });
          layer.on("mouseout", (e: LeafletMouseEvent) => {
            const isSel = selectedCode === code;
            (e.target as any).setStyle({
              weight: isSel ? 3 : 0.6,
              color: isSel ? "#f97316" : "#ffffff",
              fillOpacity: isSel ? 0.9 : 0.72,
            });
          });
          layer.on("click", () => onAreaClick(code, name, agg));
        }
      }}
    />
  );
}

function EnvLegend({ metric, ladMap }: { metric: MetricDef; ladMap: Map<string, LadAggregate> }) {
  const values = Array.from(ladMap.values()).map((a) => a[metric.key] as number).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const steps = 5;
  const ticks = Array.from({ length: steps }, (_, i) => {
    const v = min + (max - min) * (i / (steps - 1));
    return { v, color: getEnvColor(v, min, max, metric.higherIsBad) };
  });

  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-background/90 border border-border rounded-md shadow-lg p-3 min-w-[140px]">
      <p className="text-xs font-mono font-bold text-muted-foreground mb-2 uppercase tracking-wider">{metric.label}</p>
      <div className="space-y-1">
        {(metric.higherIsBad ? [...ticks].reverse() : [...ticks].reverse()).map(({ v, color }, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border border-border/20" style={{ backgroundColor: color }} />
            <span className="text-xs font-mono text-muted-foreground">{metric.format(v)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border border-border/20" style={{ backgroundColor: "#d1d5db" }} />
          <span className="text-xs font-mono text-muted-foreground">No data</span>
        </div>
      </div>
    </div>
  );
}

function WardDetailPanel({ ward, postcode }: { ward: WardRow; postcode?: string }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Ward</p>
        <h3 className="font-mono font-bold text-foreground text-base mt-0.5">{ward.ward}</h3>
        <p className="text-xs font-mono text-muted-foreground">{ward.localAuthority}</p>
        {postcode && <p className="text-xs font-mono text-muted-foreground/70 mt-0.5">via {postcode}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Residents", value: ward.residents.toLocaleString() },
          { label: "Households", value: ward.households.toLocaleString() },
          { label: "NO₂ mean", value: `${ward.no2Mean.toFixed(1)} μg/m³`, bad: ward.no2Mean > 10 },
          { label: "PM2.5 mean", value: `${ward.pm25Mean.toFixed(1)} μg/m³`, bad: ward.pm25Mean > 5 },
          { label: "Flood risk", value: `${(ward.floodRiskPct * 100).toFixed(1)}%`, bad: ward.floodRiskPct > 0.1 },
          { label: "Peak heat 2022", value: `${ward.heatMaxTemp.toFixed(1)}°C`, bad: ward.heatMaxTemp > 38 },
          { label: "Greenspace", value: `${ward.greenspacePerCapita.toFixed(0)} m²/person` },
          { label: "Tree canopy", value: `${(ward.treeCanopyPct * 100).toFixed(1)}%` },
          { label: "EPC D–G", value: `${(ward.epcBandDPct * 100).toFixed(1)}%`, bad: ward.epcBandDPct > 0.7 },
          { label: "Fuel poverty", value: `${(ward.fuelPovertyPct * 100).toFixed(1)}%`, bad: ward.fuelPovertyPct > 0.15 },
          { label: "Sewage spills", value: ward.sewageSpills.toString(), bad: ward.sewageSpills > 10 },
          { label: "Deprivation", value: ward.deprivationScore.toFixed(1) },
        ].map(({ label, value, bad }) => (
          <div key={label} className="bg-muted/30 rounded px-2 py-1.5">
            <p className="text-xs font-mono text-muted-foreground leading-tight">{label}</p>
            <p className={`text-sm font-mono font-bold leading-tight mt-0.5 ${bad ? "text-destructive" : "text-foreground"}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LadDetailPanel({ agg, metric }: { agg: LadAggregate; metric: MetricDef }) {
  const otherMetrics = WARD_METRICS.filter((m) => m.key !== metric.key);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Local Authority</p>
        <h3 className="font-mono font-bold text-foreground text-base mt-0.5">{agg.localAuthority}</h3>
        <p className="text-xs font-mono text-muted-foreground">{agg.wardCount} wards (ward averages shown)</p>
      </div>
      <div className="bg-muted/40 rounded px-3 py-2 border border-primary/20">
        <p className="text-xs font-mono text-muted-foreground">{metric.label}</p>
        <p className="text-xl font-mono font-bold text-foreground">{metric.format(agg[metric.key] as number)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {otherMetrics.map((m) => (
          <div key={m.key} className="bg-muted/30 rounded px-2 py-1.5">
            <p className="text-xs font-mono text-muted-foreground leading-tight">{m.label}</p>
            <p className="text-sm font-mono font-bold leading-tight mt-0.5">{m.format(agg[m.key] as number)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostcodeSearch({
  mapRef,
  wardMap,
  onWardFound,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  wardMap: Map<string, WardRow> | undefined;
  onWardFound: (postcode: string, ward: WardRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ postcode: string; wardCode: string; ward: string; lat: number; lon: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDrop, setShowDrop] = useState(false);

  const applyResult = useCallback((postcode: string, wardCode: string, lat: number, lon: number) => {
    setQuery(postcode);
    setShowDrop(false);
    setSuggestions([]);
    mapRef.current?.flyTo([lat, lon], 11, { duration: 1.2 });
    const ward = wardMap?.get(wardCode);
    if (ward) onWardFound(postcode, ward);
    else setError("No environment data found for this ward");
  }, [mapRef, wardMap, onWardFound]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!q) return;
    setIsSearching(true);
    setError(null);
    setSuggestions([]);
    try {
      // Exact lookup
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          const r = json.result;
          applyResult(r.postcode, r.codes?.admin_ward, r.latitude, r.longitude);
          return;
        }
      }
      // Autocomplete
      const autoRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete`);
      if (autoRes.ok) {
        const autoJson = await autoRes.json();
        if (autoJson.result?.length > 0) {
          const bulkRes = await fetch("https://api.postcodes.io/postcodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postcodes: autoJson.result.slice(0, 8) }),
          });
          const bulkJson = await bulkRes.json();
          const found = (bulkJson.result ?? [])
            .filter((r: any) => r.result)
            .map((r: any) => ({
              postcode: r.result.postcode,
              wardCode: r.result.codes?.admin_ward,
              ward: r.result.admin_ward,
              lat: r.result.latitude,
              lon: r.result.longitude,
            }));
          if (found.length === 1) applyResult(found[0].postcode, found[0].wardCode, found[0].lat, found[0].lon);
          else if (found.length > 1) { setSuggestions(found); setShowDrop(true); }
          else setError("No results found");
        } else setError("No results found");
      } else setError("Postcode not found");
    } catch { setError("Search failed"); }
    finally { setIsSearching(false); }
  }, [query, applyResult]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-72">
      <form onSubmit={handleSearch}>
        <div className="flex items-center bg-background/95 border border-border rounded-md shadow-lg overflow-hidden">
          <Search className="w-4 h-4 ml-3 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); if (!e.target.value) setShowDrop(false); }}
            onKeyDown={(e) => e.key === "Escape" && setShowDrop(false)}
            placeholder="Search postcode for ward data…"
            className="flex-1 px-2 py-2 text-sm font-mono bg-transparent outline-none placeholder:text-muted-foreground/60"
            autoComplete="off" spellCheck={false}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setSuggestions([]); setError(null); setShowDrop(false); }} className="px-2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="submit" disabled={isSearching || !query.trim()} className="px-3 py-2 text-xs font-mono bg-primary/10 border-l border-border text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors">
            {isSearching ? "…" : "Go"}
          </button>
        </div>
        {error && <div className="mt-1 px-3 py-1.5 bg-background/95 border border-border rounded-md text-xs font-mono text-destructive shadow-md">{error}</div>}
        {showDrop && suggestions.length > 0 && (
          <ul className="mt-1 bg-background/95 border border-border rounded-md shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <li key={s.postcode}>
                <button type="button" onClick={() => applyResult(s.postcode, s.wardCode, s.lat, s.lon)}
                  className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-accent transition-colors flex items-baseline gap-2">
                  <span>{s.postcode}</span>
                  {s.ward && <span className="text-xs text-muted-foreground truncate">{s.ward}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}

export default function EnvironmentPage() {
  const { data, isLoading } = useWardEnvData();
  const { data: geojson, loading: geoLoading } = useUkLadGeoJson();
  const [metricKey, setMetricKey] = useState<string>(WARD_METRICS[0].key as string);
  const [selection, setSelection] = useState<
    | { kind: "ward"; ward: WardRow; postcode?: string }
    | { kind: "lad"; code: string; name: string; agg: LadAggregate }
    | null
  >(null);
  const mapRef = useRef<L.Map | null>(null);

  const metric = WARD_METRICS.find((m) => m.key === metricKey) ?? WARD_METRICS[0];

  const handleAreaClick = useCallback((code: string, name: string, agg: LadAggregate) => {
    setSelection({ kind: "lad", code, name, agg });
  }, []);

  const handleWardFound = useCallback((postcode: string, ward: WardRow) => {
    setSelection({ kind: "ward", ward, postcode });
  }, []);

  const isMapLoading = isLoading || geoLoading;

  return (
    <Layout>
      <div className="flex h-full w-full pt-16">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <MapContainer center={[52.8, -1.8]} zoom={6} className="h-full w-full z-0" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <MapRefCapture mapRef={mapRef} />
            <ZoomControls />
            {data && geojson && (
              <EnvChoroplethLayer
                geojson={geojson}
                ladMap={data.ladMap}
                metric={metric}
                selectedCode={selection?.kind === "lad" ? selection.code : null}
                onAreaClick={handleAreaClick}
              />
            )}
          </MapContainer>

          {data && <EnvLegend metric={metric} ladMap={data.ladMap} />}

          {data && (
            <PostcodeSearch mapRef={mapRef} wardMap={data.wardMap} onWardFound={handleWardFound} />
          )}

          {isMapLoading && (
            <div className="absolute bottom-6 right-6 z-[1000] bg-background/90 border border-border px-4 py-2 rounded-md shadow-lg flex items-center gap-3">
              <div className="size-2 bg-primary rounded-full animate-ping" />
              <span className="font-mono text-xs text-muted-foreground">Loading environment data...</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 h-full border-l border-border bg-background overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            <div>
              <h2 className="font-mono font-bold text-lg flex items-center gap-2">
                <Leaf className="size-5 text-primary" />
                Local Environment
              </h2>
              <p className="text-xs text-muted-foreground font-mono mt-1 leading-relaxed">
                Ward-level environmental data across England. Source: Friends of the Earth, April 2026.
              </p>
            </div>

            {/* Metric selector */}
            <div>
              <label className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Map metric
              </label>
              <div className="relative">
                <select
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  className="w-full appearance-none bg-muted/40 border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground pr-8 outline-none focus:border-primary/50 cursor-pointer"
                >
                  {WARD_METRICS.map((m) => (
                    <option key={m.key as string} value={m.key as string}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : (
              <>
                {/* Selection detail */}
                {selection ? (
                  <Card className="bg-card border-border border-primary/20">
                    <CardContent className="p-3">
                      {selection.kind === "ward" ? (
                        <WardDetailPanel ward={selection.ward} postcode={selection.postcode} />
                      ) : (
                        <LadDetailPanel agg={selection.agg} metric={metric} />
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono italic">
                    Search a postcode above to see ward-level data, or click an area for the local authority summary.
                  </p>
                )}

                {/* Summary stats */}
                {data && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardDescription className="font-mono text-xs uppercase tracking-wider font-bold">England — {metric.label}</CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      {(() => {
                        const vals = Array.from(data.ladMap.values())
                          .map((a) => a[metric.key] as number)
                          .filter((v) => v > 0)
                          .sort((a, b) => a - b);
                        const median = vals[Math.floor(vals.length / 2)];
                        const best = metric.higherIsBad ? vals[0] : vals[vals.length - 1];
                        const worst = metric.higherIsBad ? vals[vals.length - 1] : vals[0];
                        return (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {[
                              { label: "Best", value: metric.format(best) },
                              { label: "Median", value: metric.format(median) },
                              { label: "Worst", value: metric.format(worst) },
                            ].map(({ label, value }) => (
                              <div key={label} className="bg-muted/30 rounded p-2">
                                <p className="text-xs font-mono text-muted-foreground">{label}</p>
                                <p className="text-xs font-mono font-bold mt-0.5 leading-tight">{value}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <p className="text-xs font-mono text-muted-foreground">
                        {data.ladMap.size} local authorities · {data.wardMap.size.toLocaleString()} wards
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
