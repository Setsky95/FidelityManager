import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ClipboardClock,
  List,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Socios", href: "/members", icon: Users },
  { name: "Listas", href: "/listas", icon: List },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Automations", href: "/automations", icon: ClipboardClock },
];

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (href: string) => location === href;

  return (
    <>
      {/* MOBILE: barra superior horizontal */}
      <div className="md:hidden sticky top-0 z-40 bg-card shadow">
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 bg-primary text-white">
          <h1 className="text-base font-bold">Van Gogh Fidelidad</h1>
        </div>

        {/* Nav horizontal */}
        <nav
          className="flex gap-2 px-2 py-2 overflow-x-auto"
          data-testid="sidebar-navigation"
        >
          {navigation.map((item) => {
            const Active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-full border cursor-pointer whitespace-nowrap transition-colors",
                    Active
                      ? "bg-primary/10 border-primary text-gray-800"
                      : "bg-background border-transparent text-gray-600 hover:bg-gray-100"
                  )}
                  data-testid={`nav-link-${item.name
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  <Icon
                    className={cn(
                      "mr-2 h-4 w-4",
                      Active && "text-primary"
                    )}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* DESKTOP: sidebar izquierda */}
      <div className="hidden md:flex md:flex-shrink-0 md:w-64 bg-card shadow-lg">
        <div className="flex flex-col w-full">
          {/* Logo */}
          <div
            className="flex items-center justify-center h-16 px-4 bg-primary"
            data-testid="sidebar-logo"
          >
            <h1 className="text-xl font-bold text-white">Van Gogh Fidelidad</h1>
          </div>

          {/* Nav vertical */}
          <nav
            className="flex-1 px-4 py-6 space-y-2"
            data-testid="sidebar-navigation"
          >
            {navigation.map((item) => {
              const Active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      Active
                        ? "text-gray-700 bg-primary/10"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                    data-testid={`nav-link-${item.name
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    <Icon
                      className={cn(
                        "mr-3 h-5 w-5",
                        Active && "text-primary"
                      )}
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
