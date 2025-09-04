// src/App.tsx
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { PrivateRouteSubscriber } from "@/components/PrivateRouteSubscriber";
import { PrivateRouteAdmin } from "@/components/PrivateRouteAdmin";
import { SubAuthProvider } from "@/providers/SubAuthProvider";
import { AdminAuthProvider } from "@/providers/AdminAuthProvider";
import AdminLoginPage from "@/pages/admin-login";

import { Sidebar } from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Reports from "@/pages/reports";
import SignIn from "@/pages/sign-in";
import NotFound from "@/pages/not-found";
import Automations from "@/pages/automations";
import SumatePage from "@/pages/SumatePage";
import Listas from "@/pages/lists";
import HomePage from "@/pages/homePage";
import LoginPage from "@/pages/loginPage";
import SubscriberDashboard from "@/pages/subscriber-dashboard";

function ProtectedAdminArea() {
  return (
    <div className="flex h-screen bg-surface" data-testid="app-layout">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/members" component={Members} />
          <Route path="/reports" component={Reports} />
          <Route path="/automations" component={Automations} />
          <Route path="/listas" component={Listas} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Contexto de SOCIO a nivel app */}
        <SubAuthProvider>
          <Switch>
            {/* Públicas */}
            <Route path="/admin-login" component={AdminLoginPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/sign-in" component={SignIn} />
            <Route path="/sumate" component={SumatePage} />
            <Route path="/" component={HomePage} />

            {/* Privada de SUSCRIPTOR */}
            <Route path="/mi-cuenta">
              <PrivateRouteSubscriber>
                <SubscriberDashboard />
              </PrivateRouteSubscriber>
            </Route>

            {/* Área ADMIN protegida (envuelta con su propio provider) */}
            <Route>
              <AdminAuthProvider>
                <PrivateRouteAdmin>
                  <ProtectedAdminArea />
                </PrivateRouteAdmin>
              </AdminAuthProvider>
            </Route>

            {/* 404 final */}
            <Route component={NotFound} />
          </Switch>

          <Toaster />
        </SubAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
