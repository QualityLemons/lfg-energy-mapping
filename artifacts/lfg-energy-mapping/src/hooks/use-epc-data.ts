import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";

export interface EpcBandRow {
  oslaua: string;
  A_n: number;
  B_n: number;
  C_n: number;
  D_n: number;
  E_n: number;
  F_n: number;
  G_n: number;
  number_of_epcs: number;
  A_pct: number;
  B_pct: number;
  C_pct: number;
  D_pct: number;
  E_pct: number;
  F_pct: number;
  G_pct: number;
  ABC_n: number;
  ABC_pct: number;
  DEFG_n: number;
  DEFG_pct: number;
}

export interface EpcMsoaRow {
  msoa21: string;
  A_n: number;
  B_n: number;
  C_n: number;
  D_n: number;
  E_n: number;
  F_n: number;
  G_n: number;
  number_of_epcs: number;
  A_pct: number;
  B_pct: number;
  C_pct: number;
  D_pct: number;
  E_pct: number;
  F_pct: number;
  G_pct: number;
  ABC_n: number;
  ABC_pct: number;
  DEFG_n: number;
  DEFG_pct: number;
}

export interface EpcInsRow {
  loftins_n: number;
  cavitywallins_n: number;
  solidwallins_n: number;
  cavity_and_loftins_n: number;
  number_of_epcs: number;
  loftins_pct: number;
  cavitywallins_pct: number;
  solidwallins_pct: number;
  cavity_and_loftins_pct: number;
}

const EPC_BANDS_URL =
  "https://raw.githubusercontent.com/friendsoftheearth-data/friendsoftheearth-data.github.io/main/datasets/epcs/epc-bands-by-oslaua-April25.csv";

const EPC_MSOA_URL =
  "https://raw.githubusercontent.com/friendsoftheearth-data/friendsoftheearth-data.github.io/main/datasets/epcs/epc-bands-by-msoa21-April25.csv";

const EPC_INS_MSOA_URL =
  "https://raw.githubusercontent.com/friendsoftheearth-data/friendsoftheearth-data.github.io/main/datasets/epcs/epc-ins-recommendations-by-msoa21-April25.csv";

const EPC_INS_LAD_URL =
  "https://raw.githubusercontent.com/friendsoftheearth-data/friendsoftheearth-data.github.io/main/datasets/epcs/epc-ins-recommendations-by-oslaua-April25.csv";

const UK_LAD_GEOJSON_URL =
  "https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/administrative/gb/lad.json";

async function fetchEpcBands(): Promise<Map<string, EpcBandRow>> {
  const response = await fetch(EPC_BANDS_URL);
  const text = await response.text();
  const result = Papa.parse<EpcBandRow>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const map = new Map<string, EpcBandRow>();
  for (const row of result.data) {
    if (row.oslaua) map.set(row.oslaua, row);
  }
  return map;
}

async function fetchUkBoundaries(): Promise<GeoJSON.FeatureCollection> {
  const response = await fetch(UK_LAD_GEOJSON_URL);
  return response.json() as Promise<GeoJSON.FeatureCollection>;
}

export interface EpcEnrichedFeature extends GeoJSON.Feature {
  properties: {
    LAD13CD: string;
    LAD13NM: string;
    epc: EpcBandRow | null;
  };
}

export interface EpcDataResult {
  geojson: GeoJSON.FeatureCollection;
  epcMap: Map<string, EpcBandRow>;
  nationalTotals: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
    G: number;
    total: number;
    abcPct: number;
  };
  topAreas: Array<{ name: string; code: string; abcPct: number; total: number }>;
  bottomAreas: Array<{ name: string; code: string; abcPct: number; total: number }>;
}

export function getEpcColor(abcPct: number | null | undefined): string {
  if (abcPct == null) return "#d1d5db";
  if (abcPct >= 0.6) return "#15803d";
  if (abcPct >= 0.5) return "#22c55e";
  if (abcPct >= 0.4) return "#86efac";
  if (abcPct >= 0.35) return "#fde047";
  if (abcPct >= 0.28) return "#fb923c";
  if (abcPct >= 0.2) return "#ef4444";
  return "#991b1b";
}

export function useEpcMsoaData() {
  return useQuery<Map<string, EpcMsoaRow>>({
    queryKey: ["epc-msoa-data"],
    queryFn: async () => {
      const response = await fetch(EPC_MSOA_URL);
      const text = await response.text();
      const result = Papa.parse<EpcMsoaRow>(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
      const map = new Map<string, EpcMsoaRow>();
      for (const row of result.data) {
        if (row.msoa21) map.set(row.msoa21, row);
      }
      return map;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

async function fetchEpcInsData(url: string, keyField: string): Promise<Map<string, EpcInsRow>> {
  const response = await fetch(url);
  const text = await response.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const map = new Map<string, EpcInsRow>();
  for (const row of result.data as unknown as (EpcInsRow & Record<string, string>)[]) {
    const key = row[keyField as keyof typeof row] as string;
    if (key) map.set(key, row as unknown as EpcInsRow);
  }
  return map;
}

export function useEpcInsMsoaData() {
  return useQuery<Map<string, EpcInsRow>>({
    queryKey: ["epc-ins-msoa"],
    queryFn: () => fetchEpcInsData(EPC_INS_MSOA_URL, "msoa21"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useEpcInsLadData() {
  return useQuery<Map<string, EpcInsRow>>({
    queryKey: ["epc-ins-lad"],
    queryFn: () => fetchEpcInsData(EPC_INS_LAD_URL, "oslaua"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useEpcData() {
  return useQuery<EpcDataResult>({
    queryKey: ["epc-data"],
    queryFn: async () => {
      const [epcMap, boundaries] = await Promise.all([
        fetchEpcBands(),
        fetchUkBoundaries(),
      ]);

      const enrichedFeatures: EpcEnrichedFeature[] = boundaries.features.map((feature) => {
        const properties = feature.properties as { LAD13CD: string; LAD13NM: string };
        const code = properties.LAD13CD;
        const epc = epcMap.get(code) ?? null;
        return {
          ...feature,
          properties: {
            ...properties,
            epc,
          },
        } as EpcEnrichedFeature;
      });

      const allRows = Array.from(epcMap.values());
      const A = allRows.reduce((s, r) => s + (r.A_n ?? 0), 0);
      const B = allRows.reduce((s, r) => s + (r.B_n ?? 0), 0);
      const C = allRows.reduce((s, r) => s + (r.C_n ?? 0), 0);
      const D = allRows.reduce((s, r) => s + (r.D_n ?? 0), 0);
      const E = allRows.reduce((s, r) => s + (r.E_n ?? 0), 0);
      const F = allRows.reduce((s, r) => s + (r.F_n ?? 0), 0);
      const G = allRows.reduce((s, r) => s + (r.G_n ?? 0), 0);
      const total = allRows.reduce((s, r) => s + (r.number_of_epcs ?? 0), 0);

      const areaList = enrichedFeatures
        .filter((f) => f.properties.epc && f.properties.epc.number_of_epcs >= 500)
        .map((f) => ({
          name: f.properties.LAD13NM as string,
          code: f.properties.LAD13CD as string,
          abcPct: (f.properties.epc as EpcBandRow).ABC_pct,
          total: (f.properties.epc as EpcBandRow).number_of_epcs,
        }))
        .sort((a, b) => b.abcPct - a.abcPct);

      return {
        geojson: { ...boundaries, features: enrichedFeatures } as GeoJSON.FeatureCollection,
        epcMap,
        nationalTotals: { A, B, C, D, E, F, G, total, abcPct: (A + B + C) / total },
        topAreas: areaList.slice(0, 10),
        bottomAreas: areaList.slice(-10).reverse(),
      };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
