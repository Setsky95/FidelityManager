import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ClipboardClock,
  List,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Socios", href: "/members", icon: Users },
  { name: "Listas", href: "/listas", icon: List },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Automations", href: "/automations", icon: ClipboardClock },
];

export function BurgerMenu() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  // Cerrar el menú cuando cambia la ruta
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menú"
            aria-haspopup="true"
            aria-expanded={open}
            className="rounded-2xl"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="p-0 w-80">
          {/* Header / Logo */}
          <div className="bg-primary text-primary-foreground">
            <SheetHeader className="items-start px-5 py-4">
              <SheetTitle className="text-lg font-bold">
                Van Gogh Fidelidad
              </SheetTitle>
            </SheetHeader>
          </div>

          {/* Navegación */}
          <nav className="px-3 py-4 space-y-1" data-testid="burger-navigation">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;

              return (
                <SheetClose asChild key={item.name}>
                  <Link href={item.href}>
                    <a
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      data-testid={`burger-link-${item.name
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                      <span>{item.name}</span>
                    </a>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>

          {/* Footer opcional */}
          <div className="mt-auto px-4 py-3 text-xs text-muted-foreground">
            <span>v1.0 • Menú</span>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
