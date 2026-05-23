import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Info, Map, Terminal, Zap } from "lucide-react";

export default function ContributePage() {
  return (
    <Layout>
      <div className="h-full w-full overflow-y-auto bg-background p-6 md:p-12 pt-24">
        <div className="max-w-3xl mx-auto space-y-12">
          
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-primary/20 flex items-center justify-center rounded-full border border-primary/30 mb-6">
              <Zap className="size-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground font-mono tracking-tight">
              Map the Grid.
            </h1>
            <p className="text-muted-foreground text-lg font-mono max-w-2xl mx-auto leading-relaxed">
              LFG Energy Mapping is a community-driven tool for visualizing and contributing to the world's open energy infrastructure data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6 rounded-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Map className="size-24" /></div>
              <h3 className="text-xl font-bold font-mono mb-3 text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                What we map
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground font-mono list-inside">
                <li className="flex items-start gap-2"><span className="text-primary mt-1">»</span> Power lines and cables</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">»</span> Substations and transformers</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">»</span> Power generation plants</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">»</span> Solar arrays & wind turbines</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">»</span> Transmission towers</li>
              </ul>
            </div>

            <div className="bg-card border border-border p-6 rounded-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Terminal className="size-24" /></div>
              <h3 className="text-xl font-bold font-mono mb-3 text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-secondary rounded-full" />
                How to help
              </h3>
              <p className="text-sm text-muted-foreground font-mono mb-4 leading-relaxed">
                All data is stored directly in OpenStreetMap. By authenticating with your OSM account, you can add tags, fix inaccuracies, and expand the grid directly from this interface.
              </p>
              
              <Button asChild variant="default" className="w-full font-mono font-bold tracking-wide mt-2">
                <a href="/api/auth/osm/login" data-testid="button-login-contribute">
                  Sign in with OSM
                </a>
              </Button>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/50 p-6 rounded-lg">
            <h4 className="font-mono font-bold text-sm text-foreground mb-2 flex items-center gap-2">
              <Info className="size-4 text-primary" /> Data Source & Licensing
            </h4>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed">
              Map data © OpenStreetMap contributors. OpenStreetMap® is open data, licensed under the Open Data Commons Open Database License (ODbL) by the OpenStreetMap Foundation (OSMF). You are free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors. If you alter or build upon our data, you may distribute the result only under the same licence.
            </p>
          </div>

        </div>
      </div>
    </Layout>
  );
}
