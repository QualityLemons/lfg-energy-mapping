import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";

export interface WardRow {
  wd25cd: string;
  ward: string;
  lad25cd: string;
  localAuthority: string;
  residents: number;
  households: number;
  floodRiskPct: number;
  futureFloodRiskPct: number;
  heatMaxTemp: number;
  no2Mean: number;
  no2Max: number;
  pm25Mean: number;
  pm25Max: number;
  treeCanopyPct: number;
  sewageSpills: number;
  greenspacePerCapita: number;
  epcBandDPct: number;
  heatPumps: number;
  fuelPovertyPct: number;
  deprivationScore: number;
}

export interface LadAggregate {
  lad25cd: string;
  localAuthority: string;
  wardCount: number;
  floodRiskPct: number;
  heatMaxTemp: number;
  no2Mean: number;
  pm25Mean: number;
  treeCanopyPct: number;
  greenspacePerCapita: number;
  epcBandDPct: number;
  fuelPovertyPct: number;
  deprivationScore: number;
}

export interface MetricDef {
  key: keyof LadAggregate;
  wardKey: keyof WardRow;
  label: string;
  unit: string;
  higherIsBad: boolean;
  format: (v: number) => string;
}

export const WARD_METRICS: MetricDef[] = [
  { key: "no2Mean", wardKey: "no2Mean", label: "Air pollution — NO₂", unit: "μg/m³", higherIsBad: true, format: (v) => `${v.toFixed(1)} μg/m³` },
  { key: "pm25Mean", wardKey: "pm25Mean", label: "Air pollution — PM2.5", unit: "μg/m³", higherIsBad: true, format: (v) => `${v.toFixed(1)} μg/m³` },
  { key: "floodRiskPct", wardKey: "floodRiskPct", label: "Flood risk", unit: "% at risk", higherIsBad: true, format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "greenspacePerCapita", wardKey: "greenspacePerCapita", label: "Greenspace per person", unit: "m²/person", higherIsBad: false, format: (v) => `${v.toFixed(0)} m²` },
  { key: "epcBandDPct", wardKey: "epcBandDPct", label: "Low-efficiency homes (EPC D–G)", unit: "%", higherIsBad: true, format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "fuelPovertyPct", wardKey: "fuelPovertyPct", label: "Fuel poverty", unit: "%", higherIsBad: true, format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "deprivationScore", wardKey: "deprivationScore", label: "Deprivation index", unit: "score", higherIsBad: true, format: (v) => v.toFixed(1) },
  { key: "heatMaxTemp", wardKey: "heatMaxTemp", label: "Heat risk (peak temp 2022)", unit: "°C", higherIsBad: true, format: (v) => `${v.toFixed(1)}°C` },
  { key: "treeCanopyPct", wardKey: "treeCanopyPct", label: "Tree canopy cover", unit: "%", higherIsBad: false, format: (v) => `${(v * 100).toFixed(1)}%` },
];

function avg(vals: number[]): number {
  const valid = vals.filter((v) => v != null && !isNaN(v));
  if (!valid.length) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

export interface WardEnvDataResult {
  wardMap: Map<string, WardRow>;
  ladMap: Map<string, LadAggregate>;
  ladNames: Map<string, string>;
}

export function useWardEnvData() {
  return useQuery<WardEnvDataResult>({
    queryKey: ["ward-env-data"],
    queryFn: async () => {
      const resp = await fetch(
        "https://raw.githubusercontent.com/friendsoftheearth-data/friendsoftheearth-data.github.io/main/datasets/local-data/Ward-local-env-data-April26-v2.xlsx"
      );
      const arrayBuffer = await resp.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const wardMap = new Map<string, WardRow>();
      const ladBuckets = new Map<string, WardRow[]>();

      for (const r of rows) {
        const row: WardRow = {
          wd25cd: r["wd25cd"] as string,
          ward: r["Ward"] as string,
          lad25cd: r["lad25cd"] as string,
          localAuthority: r["Local authority"] as string,
          residents: Number(r["Census21: Residents"]) || 0,
          households: Number(r["Households (No.)"]) || 0,
          floodRiskPct: Number(r["Curent high flood risk: Properties at risk (%)"]) || 0,
          futureFloodRiskPct: Number(r["Future high flood risk: Properties at risk (%)"]) || 0,
          heatMaxTemp: Number(r["Heat risk: Summer 2022 max air temp (°C)"]) || 0,
          no2Mean: Number(r["Air pollution: NO2 mean conc (ug/m3)"]) || 0,
          no2Max: Number(r["Air pollution: NO2 max conc (ug/m3)"]) || 0,
          pm25Mean: Number(r["Air pollution: PM2.5 mean conc (ug/m3)"]) || 0,
          pm25Max: Number(r["Air pollution: PM2.5 max conc (ug/m3)"]) || 0,
          treeCanopyPct: Number(r["Tree canopy: area (% of ward)"]) || 0,
          sewageSpills: Number(r["Sewage overflows: Number of spills (2024)"]) || 0,
          greenspacePerCapita: Number(r["Greenspace: m2 per capita"]) || 0,
          epcBandDPct: Number(r["Energy efficiency: EPC band D or below (%)"]) || 0,
          heatPumps: Number(r["Low carbon: domestic heatpumps (est No.)"]) || 0,
          fuelPovertyPct: Number(r["Fuel poverty (%)"]) || 0,
          deprivationScore: Number(r["Indices of deprivation: Average LSOA score"]) || 0,
        };
        wardMap.set(row.wd25cd, row);
        const bucket = ladBuckets.get(row.lad25cd) ?? [];
        bucket.push(row);
        ladBuckets.set(row.lad25cd, bucket);
      }

      const ladMap = new Map<string, LadAggregate>();
      const ladNames = new Map<string, string>();
      for (const [lad25cd, wards] of ladBuckets) {
        ladNames.set(lad25cd, wards[0].localAuthority);
        ladMap.set(lad25cd, {
          lad25cd,
          localAuthority: wards[0].localAuthority,
          wardCount: wards.length,
          floodRiskPct: avg(wards.map((w) => w.floodRiskPct)),
          heatMaxTemp: avg(wards.map((w) => w.heatMaxTemp)),
          no2Mean: avg(wards.map((w) => w.no2Mean)),
          pm25Mean: avg(wards.map((w) => w.pm25Mean)),
          treeCanopyPct: avg(wards.map((w) => w.treeCanopyPct)),
          greenspacePerCapita: avg(wards.map((w) => w.greenspacePerCapita)),
          epcBandDPct: avg(wards.map((w) => w.epcBandDPct)),
          fuelPovertyPct: avg(wards.map((w) => w.fuelPovertyPct)),
          deprivationScore: avg(wards.map((w) => w.deprivationScore)),
        });
      }

      return { wardMap, ladMap, ladNames };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function getEnvColor(value: number, min: number, max: number, higherIsBad: boolean): string {
  if (value == null || isNaN(value) || max === min) return "#d1d5db";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const pct = higherIsBad ? t : 1 - t;

  // Green → Yellow → Red gradient
  if (pct < 0.5) {
    const r = Math.round(pct * 2 * 255);
    return `rgb(${r},200,${Math.round((1 - pct * 2) * 80 + 20)})`;
  } else {
    const g = Math.round((1 - (pct - 0.5) * 2) * 200);
    return `rgb(220,${g},30)`;
  }
}
