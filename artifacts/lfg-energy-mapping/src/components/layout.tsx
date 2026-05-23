import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Map, Activity, ListIcon, Info, LogOut, Home, Leaf } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.reload();
      }
    });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between rounded-md border border-border/50 bg-background/80 px-4 py-2 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-mono font-bold tracking-tight text-primary">
            <div className="size-3 rounded-full bg-primary animate-pulse" />
            LFG_ENERGY
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors hover:bg-secondary/20 hover:text-secondary ${location === "/" ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-2"><Map className="size-4" /> Map</span>
            </Link>
            <Link href="/stats" className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors hover:bg-secondary/20 hover:text-secondary ${location === "/stats" ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-2"><Activity className="size-4" /> Stats</span>
            </Link>
            <Link href="/recent" className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors hover:bg-secondary/20 hover:text-secondary ${location === "/recent" ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-2"><ListIcon className="size-4" /> Recent Edits</span>
            </Link>
            <Link href="/contribute" className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors hover:bg-secondary/20 hover:text-secondary ${location === "/contribute" ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-2"><Info className="size-4" /> Contribute</span>
            </Link>
            <Link href="/epc" className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors hover:bg-secondary/20 hover:text-secondary ${location === "/epc" ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-2"><Home className="size-4" /> EPC Ratings</span>
            </Link>
            <Link href="/environment" className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors hover:bg-secondary/20 hover:text-secondary ${location === "/environment" ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-2"><Leaf className="size-4" /> Environment</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {!isLoading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 border border-primary/20">
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                      <AvatarFallback className="font-mono">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName || user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.changesetCount} changesets
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="default" size="sm" className="font-mono text-xs">
                <a href="/api/auth/osm/login" data-testid="button-login">
                  Sign in with OSM
                </a>
              </Button>
            )
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="h-screen w-full pt-0">
        {children}
      </main>
    </div>
  );
}
