import { useGetRecentEdits } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListIcon, History, MapPin, MessageSquare, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function RecentEditsPage() {
  const { data: edits, isLoading } = useGetRecentEdits({ limit: 50 });

  return (
    <Layout>
      <div className="h-full w-full overflow-y-auto bg-background p-6 md:p-12 pt-24">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div>
            <h1 className="text-3xl font-bold text-foreground font-mono tracking-tight flex items-center gap-3">
              <ListIcon className="size-8 text-primary" />
              Recent Edits
            </h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm max-w-2xl">
              Live feed of energy infrastructure updates contributed to OpenStreetMap by the community.
            </p>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardHeader className="py-4">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4 mt-2" />
                  </CardHeader>
                </Card>
              ))
            ) : edits?.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 border border-border/50 rounded-lg">
                <History className="size-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="font-mono font-bold text-lg text-foreground">No recent edits found</h3>
                <p className="font-mono text-sm text-muted-foreground mt-2">The grid has been quiet lately.</p>
              </div>
            ) : (
              edits?.map((edit) => (
                <Card key={edit.changesetId} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-start justify-between">
                    
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs rounded-sm">
                          #{edit.changesetId}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <History className="size-3" />
                          {formatDistanceToNow(new Date(edit.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <p className="text-foreground text-sm font-medium flex items-start gap-2">
                        <MessageSquare className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        {edit.comment || <span className="italic text-muted-foreground">No comment provided</span>}
                      </p>
                    </div>

                    <div className="flex flex-row md:flex-col gap-4 md:gap-2 items-center md:items-end shrink-0">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-sm border border-border/50">
                        <User className="size-3.5" />
                        {edit.username}
                      </div>
                      {edit.featuresEdited !== null && edit.featuresEdited !== undefined && (
                        <div className="text-xs font-mono font-bold text-accent bg-accent/10 px-2 py-1 rounded-sm">
                          {edit.featuresEdited} features
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>
              ))
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
