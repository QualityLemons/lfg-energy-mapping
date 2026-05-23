import { useState } from "react";
import {
  getGetEnergyFeatureQueryKey,
  getGetEnergyFeaturesQueryKey,
  useCloseChangeset,
  useCreateChangeset,
  useUpdateFeatureTags,
  type EnergyFeature,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface FeatureEditorProps {
  feature: EnergyFeature;
  onClose: () => void;
}

export function FeatureEditor({ feature, onClose }: FeatureEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<Record<string, string>>({ ...feature.tags });
  const [comment, setComment] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const createChangeset = useCreateChangeset();
  const updateTags = useUpdateFeatureTags();
  const closeChangeset = useCloseChangeset();

  const isSubmitting = createChangeset.isPending || updateTags.isPending || closeChangeset.isPending;

  const handleAddTag = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setTags(prev => ({ ...prev, [newKey.trim()]: newValue.trim() }));
    setNewKey("");
    setNewValue("");
  };

  const handleRemoveTag = (key: string) => {
    setTags(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleTagChange = (key: string, val: string) => {
    setTags(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast({ title: "Comment required", description: "Please provide a changeset comment.", variant: "destructive" });
      return;
    }

    try {
      const changeset = await createChangeset.mutateAsync({ data: { comment, source: "LFG Energy Mapping" } });
      
      await updateTags.mutateAsync({
        osmType: feature.osmType,
        osmId: feature.osmId,
        data: {
          changesetId: changeset.id,
          tags: tags,
        }
      });

      await closeChangeset.mutateAsync({ changesetId: changeset.id });

      queryClient.invalidateQueries({ queryKey: getGetEnergyFeaturesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetEnergyFeatureQueryKey(feature.osmType, feature.osmId) });

      toast({ title: "Success", description: "Tags updated successfully." });
      onClose();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save edits.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] z-[1100] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <h3 className="font-mono font-bold text-sm tracking-tight text-foreground uppercase">
          Edit {feature.osmType}_{feature.osmId}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="size-8 rounded-full hover:bg-destructive/20 hover:text-destructive">
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Changeset Comment</Label>
            <Textarea 
              placeholder="e.g., Updated substation voltage..." 
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="resize-none font-mono text-xs bg-muted/20"
              data-testid="input-changeset-comment"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Edit Tags</Label>
            
            <div className="space-y-2">
              {Object.entries(tags).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input 
                    value={key}
                    readOnly
                    className="font-mono text-xs bg-muted/50 w-1/3"
                  />
                  <Input 
                    value={val}
                    onChange={e => handleTagChange(key, e.target.value)}
                    className="font-mono text-xs"
                    data-testid={`input-tag-value-${key}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveTag(key)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Input 
                placeholder="Key" 
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="font-mono text-xs w-1/3"
                data-testid="input-new-tag-key"
              />
              <Input 
                placeholder="Value" 
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="font-mono text-xs"
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                data-testid="input-new-tag-value"
              />
              <Button variant="secondary" size="icon" onClick={handleAddTag} className="shrink-0" data-testid="button-add-tag">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          
          <div className="bg-primary/10 border border-primary/20 rounded-md p-3 flex items-start gap-3">
            <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-primary/90 leading-relaxed font-mono">
              These changes will be saved directly to OpenStreetMap. Make sure your data is accurate and verifiable.
            </p>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border/50 bg-muted/20">
        <Button 
          className="w-full font-mono text-xs tracking-wide" 
          onClick={handleSubmit} 
          disabled={isSubmitting || !comment.trim()}
          data-testid="button-submit-edit"
        >
          {isSubmitting ? (
            <div className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin mr-2" />
          ) : (
            <Save className="size-3.5 mr-2" />
          )}
          {isSubmitting ? "Saving to OSM..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
