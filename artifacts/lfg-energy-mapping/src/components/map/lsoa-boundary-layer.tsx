import { GeoJSON } from "react-leaflet";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import { useLsoaData } from "@/hooks/use-lsoa-data";
import type { LsoaFeatureProperties } from "@/hooks/use-lsoa-data";

const LAD_COLORS: Record<string, string> = {
  Birmingham: "#f97316",
  Coventry: "#8b5cf6",
  Dudley: "#06b6d4",
  Sandwell: "#10b981",
  Solihull: "#f59e0b",
  Walsall: "#ef4444",
  Wolverhampton: "#3b82f6",
  "North Warwickshire": "#84cc16",
  "Nuneaton and Bedworth": "#ec4899",
  Rugby: "#14b8a6",
  "Stratford-on-Avon": "#a855f7",
  Warwick: "#f43f5e",
};

interface Props {
  enabled: boolean;
}

export function LsoaBoundaryLayer({ enabled }: Props) {
  const { data, isLoading } = useLsoaData({ enabled });

  if (!enabled || isLoading || !data) return null;

  return (
    <GeoJSON
      key="lsoa-boundaries"
      data={data.geojson}
      style={(feature): PathOptions => {
        const ladName = (feature?.properties as LsoaFeatureProperties)?.ladName ?? "";
        return {
          color: LAD_COLORS[ladName] ?? "#94a3b8",
          weight: 1,
          opacity: 0.7,
          fillOpacity: 0.04,
          fillColor: LAD_COLORS[ladName] ?? "#94a3b8",
        };
      }}
      onEachFeature={(feature, layer: Layer) => {
        const props = feature.properties as LsoaFeatureProperties;
        const nm = props.LSOA21NM ?? props.LSOA11NM ?? "Unknown";
        const cd = props.LSOA21CD ?? props.LSOA11CD ?? "—";
        const lad = props.ladName ?? "";

        const color = LAD_COLORS[lad] ?? "#94a3b8";

        (layer as any).bindTooltip(
          `<div style="font-family:monospace;font-size:11px;line-height:1.6">
            <span style="color:${color};font-weight:bold">${lad}</span><br/>
            <strong>${nm}</strong><br/>
            <span style="color:#94a3b8">${cd}</span>
          </div>`,
          { sticky: true, opacity: 0.95 }
        );

        layer.on("mouseover", (e: LeafletMouseEvent) => {
          (e.target as any).setStyle({ weight: 2, fillOpacity: 0.12, opacity: 1 });
        });
        layer.on("mouseout", (e: LeafletMouseEvent) => {
          (e.target as any).setStyle({ weight: 1, fillOpacity: 0.04, opacity: 0.7 });
        });
      }}
    />
  );
}
