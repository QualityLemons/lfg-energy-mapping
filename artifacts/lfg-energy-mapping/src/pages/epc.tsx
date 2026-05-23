import { useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { Layout } from "@/components/layout";
import { EpcChoroplethLayer } from "@/components/map/epc-choropleth-layer";
import { useEpcData, getEpcColor } from "@/hooks/use-epc-data";
import type { EpcBandRow } from "@/hooks/use-epc-data";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";
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

function AreaRankList({ areas, label }: { areas: Array<{ name: string; code: string; abcPct: number; total: number }>; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      {areas.map((area, i) => (
        <div key={area.code} className="flex items-center gap-2">
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
        </div>
      ))}
    </div>
  );
}

function SelectedAreaPanel({ name, epc }: { name: string; epc: EpcBandRow }) {
  const bands = ["A", "B", "C", "D", "E", "F", "G"].map((b) => ({
    band: b,
    count: epc[`${b}_n` as keyof EpcBandRow] as number,
    pct: ((epc[`${b}_pct` as keyof EpcBandRow] as number) * 100).toFixed(1),
  }));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Selected Area</p>
        <h3 className="font-mono font-bold text-foreground text-base mt-0.5">{name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: getEpcColor(epc.ABC_pct), color: getEpcColor(epc.ABC_pct) }}>
            {(epc.ABC_pct * 100).toFixed(1)}% A–C
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{epc.number_of_epcs.toLocaleString()} certs</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
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
    </div>
  );
}

export default function EpcPage() {
  const { data, isLoading } = useEpcData();
  const [selectedArea, setSelectedArea] = useState<{ name: string; epc: EpcBandRow } | null>(null);

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
            <EpcChoroplethLayer
              onAreaClick={(name, epc) => setSelectedArea({ name, epc })}
            />
          </MapContainer>

          <EpcLegend />

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
            {/* Header */}
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
                {selectedArea && (
                  <Card className="bg-card border-border border-primary/30">
                    <CardContent className="p-3">
                      <SelectedAreaPanel name={selectedArea.name} epc={selectedArea.epc} />
                    </CardContent>
                  </Card>
                )}

                {!selectedArea && (
                  <p className="text-xs text-muted-foreground font-mono italic">Click an area on the map to see its breakdown.</p>
                )}

                {/* Top performers */}
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <AreaRankList areas={data.topAreas} label="Best rated areas" />
                  </CardContent>
                </Card>

                {/* Bottom performers */}
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <AreaRankList areas={data.bottomAreas} label="Lowest rated areas" />
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
