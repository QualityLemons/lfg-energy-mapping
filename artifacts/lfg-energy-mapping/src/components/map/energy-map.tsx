import { useState, useMemo } from "react";
import { useGetEnergyFeatures, getGetEnergyFeaturesQueryKey } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { fixLeafletIcons } from "@/lib/leaflet-icons";
import { FeatureDetail } from "@/components/feature-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { EpcChoroplethLayer } from "@/components/map/epc-choropleth-layer";

fixLeafletIcons();

// Custom icons per power type
const createColorIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const ICONS = {
  generator: createColorIcon('#00ff88'), // accent/green
  substation: createColorIcon('#00ccff'), // secondary/cyan
  tower: createColorIcon('#888888'), // gray
  line: '#ff8800', // primary/orange (for lines)
  cable: '#ff8800', 
  plant: createColorIcon('#00ff88'),
  default: createColorIcon('#ffffff'),
};

const LINE_COLORS = {
  line: '#ff8800',
  cable: '#ff8800',
  default: '#888888'
};

function MapEventHandler({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    },
    zoomend: () => {
      onBoundsChange(map.getBounds());
    }
  });
  
  // Initial bounds
  useMemo(() => {
    setTimeout(() => {
      onBoundsChange(map.getBounds());
    }, 100);
  }, [map, onBoundsChange]);

  return null;
}

export function EnergyMap() {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<{ id: string, type: 'node'|'way'|'relation' } | null>(null);
  const [showEpc, setShowEpc] = useState(false);

  const debouncedBounds = useDebounce(bounds, 400);

  const queryParams = debouncedBounds ? {
    south: debouncedBounds.getSouth(),
    west: debouncedBounds.getWest(),
    north: debouncedBounds.getNorth(),
    east: debouncedBounds.getEast(),
  } : null;

  const { data: features, isLoading } = useGetEnergyFeatures(
    queryParams as any, 
    { query: { enabled: !!queryParams, queryKey: getGetEnergyFeaturesQueryKey(queryParams as any) } }
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[37.7749, -122.4194]}
        zoom={13}
        className="h-full w-full z-0 bg-gray-900"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <MapEventHandler onBoundsChange={setBounds} />

        {showEpc && <EpcChoroplethLayer />}

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
            // Leaflet expects [lat, lon], GeoJSON provides [lon, lat]
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

      {/* EPC overlay toggle */}
      <button
        onClick={() => setShowEpc((v) => !v)}
        className={`absolute top-20 right-4 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono shadow-md transition-colors ${
          showEpc
            ? "bg-green-600 border-green-500 text-white"
            : "bg-background/90 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
        }`}
        title="Toggle UK EPC ratings overlay"
      >
        <span className={`size-2 rounded-full ${showEpc ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
        EPC overlay
      </button>

      {/* Loading overlay for data fetching */}
      {isLoading && (
        <div className="absolute bottom-6 left-6 z-[1000] bg-background/90 border border-border px-4 py-2 rounded-md shadow-lg flex items-center gap-3">
          <div className="size-2 bg-primary rounded-full animate-ping" />
          <span className="font-mono text-xs text-muted-foreground">Scanning grid...</span>
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
