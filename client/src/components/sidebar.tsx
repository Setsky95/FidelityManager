import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, BarChart3, ClipboardClock,List,Percent } from "lucide-react";


const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Socios", href: "/members", icon: Users },
  { name: "Listas", href: "/listas", icon: List },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Automations", href: "/automations", icon: ClipboardClock },
  { name: "Descuentos", href: "/descuentos", icon: Percent },


];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="hidden md:flex md:flex-shrink-0 md:w-64 bg-card shadow-lg">
      <div className="flex flex-col w-full">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 bg-primary" data-testid="sidebar-logo">
          <h1 className="text-xl font-bold text-white">Van Gogh Fidelidad</h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2" data-testid="sidebar-navigation">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "text-gray-700 bg-primary bg-opacity-10"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                  data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className={cn("mr-3 h-5 w-5", isActive ? "text-primary" : "")} />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
