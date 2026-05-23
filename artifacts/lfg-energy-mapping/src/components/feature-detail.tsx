import { X, Edit2, ExternalLink, Calendar, MapPin, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetEnergyFeature, getGetEnergyFeatureQueryKey, getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useState } from "react";
import { FeatureEditor } from "./feature-editor";

interface FeatureDetailProps {
  osmId: string;
  osmType: 'node' | 'way' | 'relation';
  onClose: () => void;
}

export function FeatureDetail({ osmId, osmType, onClose }: FeatureDetailProps) {
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: feature, isLoading } = useGetEnergyFeature(osmType, osmId, {
    query: { enabled: !!osmId && !!osmType, queryKey: getGetEnergyFeatureQueryKey(osmType, osmId) }
  });

  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <div className="absolute top-20 bottom-6 right-6 w-96 z-[1000] bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-8 fade-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h3 className="font-mono font-bold text-sm tracking-tight text-foreground uppercase">
              {feature?.osmType || osmType}_{feature?.osmId || osmId}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8 rounded-full hover:bg-destructive/20 hover:text-destructive">
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {isLoading || !feature ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4 bg-border/50" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 bg-border/50" />
                <Skeleton className="h-6 w-20 bg-border/50" />
              </div>
              <Skeleton className="h-32 w-full mt-4 bg-border/50" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  {feature.name || "Unnamed Feature"}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono border-primary/30 text-primary bg-primary/10">
                    power={feature.powerType || "unknown"}
                  </Badge>
                  {feature.generatorSource && (
                    <Badge variant="outline" className="font-mono border-accent/30 text-accent bg-accent/10">
                      source={feature.generatorSource}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Last Edited</span>
                  <span className="font-mono text-foreground">
                    {feature.lastEdited ? format(new Date(feature.lastEdited), "MMM d, yyyy") : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Tag className="size-3.5" /> Version</span>
                  <span className="font-mono text-foreground">v{feature.version || 1}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Tag className="size-3" /> Raw Tags
                </h4>
                <div className="bg-muted/50 rounded-md p-3 border border-border/50 font-mono text-xs space-y-1.5 overflow-x-auto">
                  {Object.entries(feature.tags || {}).map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                      <span className="text-secondary font-medium shrink-0">{key}:</span>
                      <span className="text-foreground break-all">{value}</span>
                    </div>
                  ))}
                  {Object.keys(feature.tags || {}).length === 0 && (
                    <span className="text-muted-foreground italic">No tags</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50 bg-muted/20 flex gap-2">
          {user && feature && (
            <Button 
              className="flex-1 font-mono text-xs tracking-wide group" 
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-feature"
            >
              <Edit2 className="size-3.5 mr-2 group-hover:scale-110 transition-transform" />
              Edit Tags
            </Button>
          )}
          <Button variant="outline" className="flex-1 font-mono text-xs tracking-wide" asChild>
            <a 
              href={`https://www.openstreetmap.org/${osmType}/${osmId}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3.5 mr-2" />
              View OSM
            </a>
          </Button>
        </div>
      </div>

      {isEditing && feature && (
        <FeatureEditor 
          feature={feature} 
          onClose={() => setIsEditing(false)} 
        />
      )}
    </>
  );
}
