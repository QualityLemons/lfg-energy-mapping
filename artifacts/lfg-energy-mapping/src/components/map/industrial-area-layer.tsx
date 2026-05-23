import { GeoJSON as LeafletGeoJSON } from "react-leaflet";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import type { IndustrialArea } from "@workspace/api-client-react";

interface Props {
  areas: IndustrialArea[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function IndustrialAreaLayer({ areas }: Props) {
  const features = areas
    .filter((area) => area.geometry?.type && area.geometry.coordinates)
    .map((area) => ({
      type: "Feature" as const,
      geometry: area.geometry as GeoJSON.Geometry,
      properties: area,
    }));

  if (features.length === 0) return null;

  return (
    <LeafletGeoJSON
      key={areas.map((area) => area.id).join("|")}
      data={{ type: "FeatureCollection", features } as GeoJSON.FeatureCollection}
      style={(): PathOptions => ({
        color: "#7c3aed",
        fillColor: "#a855f7",
        fillOpacity: 0.24,
        opacity: 0.9,
        weight: 1.4,
      })}
      onEachFeature={(feature, layer: Layer) => {
        const props = feature.properties as IndustrialArea;
        const name = props.name || props.tags?.name || "Industrial area";
        const detail = props.industrial || props.tags?.industrial || props.landuse || "industrial";
        const tooltip = `
          <div style="font-family:monospace;font-size:12px;line-height:1.5">
            <strong>${escapeHtml(name)}</strong><br/>
            <span>${escapeHtml(detail)}</span><br/>
            <span style="color:#64748b">OpenStreetMap ${props.osmType}/${props.osmId}</span>
          </div>`;

        (layer as any).bindTooltip(tooltip, { sticky: true, opacity: 0.95 });
        layer.on("mouseover", (e: LeafletMouseEvent) => {
          (e.target as any).setStyle({ weight: 2.5, fillOpacity: 0.36 });
        });
        layer.on("mouseout", (e: LeafletMouseEvent) => {
          (e.target as any).setStyle({ weight: 1.4, fillOpacity: 0.24 });
        });
      }}
    />
  );
}
