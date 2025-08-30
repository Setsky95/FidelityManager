// src/App.tsx
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/providers/AuthProvider";
import { PrivateRoute } from "@/components/PrivateRoute";

import { Sidebar } from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Reports from "@/pages/reports";
import SignIn from "@/pages/sign-in";       // <- si querés mantener esta ruta pública
import NotFound from "@/pages/not-found";   // <- usalo como 404
import Automations from "@/pages/automations";
import SumatePage from "@/pages/SumatePage";
import Listas from "@/pages/lists";
import HomePage from "@/pages/homePage";    // <- asegurate que exporte `default function HomePage() { ... }`
import LoginPage from "@/pages/loginPage";

function ProtectedArea() {
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
        <AuthProvider>
          <Switch>
            {/* Públicas */}
            <Route path="/login" component={LoginPage} />
            <Route path="/sign-in" component={SignIn} />   {/* opcional; podés borrar si no lo usás */}
            <Route path="/sumate" component={SumatePage} />
            <Route path="/" component={HomePage} />

            {/* Protegidas: catch-all después de las públicas */}
            <Route>
              <PrivateRoute>
                <ProtectedArea />
              </PrivateRoute>
            </Route>

            {/* 404 final */}
            <Route component={NotFound} />
          </Switch>

          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
