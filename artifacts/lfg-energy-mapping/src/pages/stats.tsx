import { useGetEnergyStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Zap, Factory } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";

export default function StatsPage() {
  const { data: stats, isLoading } = useGetEnergyStats();

  return (
    <Layout>
      <div className="h-full w-full overflow-y-auto bg-background p-6 md:p-12 pt-24">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div>
            <h1 className="text-3xl font-bold text-foreground font-mono tracking-tight flex items-center gap-3">
              <Activity className="size-8 text-primary" />
              Grid Statistics
            </h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm max-w-2xl">
              Real-time analytics of energy infrastructure features mapped across the global OpenStreetMap database.
            </p>
          </div>

          {isLoading || !stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-card border-border shadow-lg">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-mono text-xs uppercase tracking-wider font-bold">Total Features</CardDescription>
                    <CardTitle className="text-4xl font-mono text-primary">
                      {stats.totalFeatures.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-1 w-full bg-primary/20 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-primary w-full" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border shadow-lg md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-2">
                      <Zap className="size-3" /> By Infrastructure Type
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[200px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.byType} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="type" type="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }} />
                        <RechartsTooltip 
                          cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {stats.byType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {stats.byGeneratorSource && (
                  <Card className="bg-card border-border shadow-lg md:col-span-3">
                    <CardHeader className="pb-2">
                      <CardDescription className="font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-2">
                        <Factory className="size-3" /> Generator Sources
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.byGeneratorSource} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <XAxis dataKey="type" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }} />
                          <YAxis hide />
                          <RechartsTooltip 
                            cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {stats.byGeneratorSource.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
