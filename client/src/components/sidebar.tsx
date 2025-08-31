import { useState } from "react";
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

export function Sidebar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 px-4 py-6 space-y-2" data-testid="sidebar-navigation">
      {navigation.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.name} href={item.href} onClick={onNavigate}>
            <div
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                isActive
                  ? "text-gray-700 bg-primary/10"
                  : "text-gray-600 hover:bg-gray-100"
              )}
              data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className={cn("mr-3 h-5 w-5", isActive && "text-primary")} />
              {item.name}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex md:hidden items-center justify-between h-14 px-4 bg-primary text-white sticky top-0 z-40 shadow">
        <h1 className="text-base font-bold">Van Gogh Fidelidad</h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" className="text-primary bg-white">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SheetHeader className="px-4 py-4 border-b bg-primary">
              <SheetTitle className="text-left text-white">Van Gogh Fidelidad</SheetTitle>
            </SheetHeader>
            <NavItems onNavigate={() => setOpen(false)} />
            {/* Close area at bottom for accessibility */}
            <div className="px-4 pb-4">
              <SheetClose asChild>
                <Button variant="outline" className="w-full">Cerrar</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0 md:w-64 bg-card shadow-lg">
        <div className="flex flex-col w-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-primary" data-testid="sidebar-logo">
            <h1 className="text-xl font-bold text-white">Van Gogh Fidelidad</h1>
          </div>
          <NavItems />
        </div>
      </div>
    </>
  );
}

export default Sidebar;
