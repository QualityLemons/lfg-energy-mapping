import { GeoJSON } from "react-leaflet";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import { useEpcData, getEpcColor } from "@/hooks/use-epc-data";
import type { EpcBandRow } from "@/hooks/use-epc-data";

interface Props {
  onAreaClick?: (name: string, epc: EpcBandRow) => void;
}

export function EpcChoroplethLayer({ onAreaClick }: Props) {
  const { data, isLoading } = useEpcData();

  if (isLoading || !data) return null;

  return (
    <GeoJSON
      key="epc-choropleth"
      data={data.geojson}
      style={(feature): PathOptions => {
        const abcPct = (feature?.properties?.epc as EpcBandRow | null)?.ABC_pct;
        return {
          fillColor: getEpcColor(abcPct),
          weight: 0.8,
          opacity: 1,
          color: "#ffffff",
          fillOpacity: 0.7,
        };
      }}
      onEachFeature={(feature, layer: Layer) => {
        const props = feature.properties as {
          LAD13NM: string;
          LAD13CD: string;
          epc: EpcBandRow | null;
        };
        const epc = props.epc;
        const name = props.LAD13NM ?? "Unknown";

        if (epc) {
          const tooltip = `
            <div style="font-family:monospace;font-size:12px;line-height:1.6">
              <strong>${name}</strong><br/>
              <span style="color:#22c55e">A–C: ${(epc.ABC_pct * 100).toFixed(1)}%</span>
              &nbsp;|&nbsp;
              <span style="color:#ef4444">D–G: ${(epc.DEFG_pct * 100).toFixed(1)}%</span><br/>
              ${epc.number_of_epcs.toLocaleString()} certificates
            </div>`;

          (layer as any).bindTooltip(tooltip, { sticky: true, opacity: 0.95 });

          layer.on("mouseover", (e: LeafletMouseEvent) => {
            (e.target as any).setStyle({ weight: 2, color: "#1e293b", fillOpacity: 0.85 });
          });
          layer.on("mouseout", (e: LeafletMouseEvent) => {
            (e.target as any).setStyle({ weight: 0.8, color: "#ffffff", fillOpacity: 0.7 });
          });
          layer.on("click", () => {
            if (onAreaClick) onAreaClick(name, epc);
          });
        }
      }}
    />
  );
}
