import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";

interface LsoaCsvRow {
  LSOA21CD: string;
  LSOA21NM: string;
  LSOA21NMW: string;
  ObjectId: string;
}

const LSOA_CSV_URL = "/lsoa-west-midlands.csv";

const BASE =
  "https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/statistical/eng/lsoa_by_lad";

const WEST_MIDLANDS_LADS: Record<string, string> = {
  E08000025: "Birmingham",
  E08000026: "Coventry",
  E08000027: "Dudley",
  E08000028: "Sandwell",
  E08000029: "Solihull",
  E08000030: "Walsall",
  E08000031: "Wolverhampton",
  E07000218: "North Warwickshire",
  E07000219: "Nuneaton and Bedworth",
  E07000220: "Rugby",
  E07000221: "Stratford-on-Avon",
  E07000222: "Warwick",
};

export interface LsoaFeatureProperties {
  LSOA11CD: string;
  LSOA11NM: string;
  LSOA21CD?: string | null;
  LSOA21NM?: string;
  ladName: string;
}

export interface LsoaDataResult {
  geojson: GeoJSON.FeatureCollection;
  lookup: Map<string, string>;
  totalFeatures: number;
}

async function fetchLsoaCsv(): Promise<Map<string, string>> {
  const res = await fetch(LSOA_CSV_URL);
  const text = await res.text();
  const result = Papa.parse<LsoaCsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const map = new Map<string, string>();
  for (const row of result.data) {
    if (row.LSOA21NM) map.set(row.LSOA21NM.trim(), row.LSOA21CD);
  }
  return map;
}

async function fetchLadLsoas(
  ladCode: string,
  ladName: string,
  csv21: Map<string, string>
): Promise<GeoJSON.Feature[]> {
  const res = await fetch(`${BASE}/${ladCode}.json`);
  const data: GeoJSON.FeatureCollection = await res.json();
  return data.features.map((f) => {
    const properties = f.properties as Pick<LsoaFeatureProperties, "LSOA11CD" | "LSOA11NM">;
    const nm = properties.LSOA11NM;
    return {
      ...f,
      properties: {
        ...properties,
        LSOA21NM: nm,
        LSOA21CD: csv21.get(nm) ?? null,
        ladName,
      },
    };
  });
}

export function useLsoaData({ enabled = false } = {}) {
  return useQuery<LsoaDataResult>({
    queryKey: ["lsoa-west-midlands"],
    enabled,
    queryFn: async () => {
      const csv21 = await fetchLsoaCsv();

      const allFeaturesArrays = await Promise.all(
        Object.entries(WEST_MIDLANDS_LADS).map(([code, name]) =>
          fetchLadLsoas(code, name, csv21)
        )
      );

      const features = allFeaturesArrays.flat();

      const lookup = new Map<string, string>();
      for (const f of features) {
        const p = f.properties as LsoaFeatureProperties;
        if (p.LSOA11CD) lookup.set(p.LSOA11CD, p.LSOA11NM);
      }

      return {
        geojson: { type: "FeatureCollection", features } as GeoJSON.FeatureCollection,
        lookup,
        totalFeatures: features.length,
      };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
