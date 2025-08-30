import { useState, useEffect } from "react";
import EmailAutomationCard from "@/components/EmailAutomationCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAutomations } from "@/hooks/use-automations";
import { useToast } from "@/hooks/use-toast";
import type { AutomationsSettingsFile } from "@/../shared/schema";

// === DEFAULTS ===
const DEFAULTS: AutomationsSettingsFile = {
  welcomeEmail: {
    enabled: false,
    to: "",
    from: "Van Gogh Fidelidad <sebapavlotsky@gmail.com>",
    subject: "¡Bienvenido/a, {{nombre}}!",
    body: "<h1>Hola {{nombre}}</h1><p>Tu ID es {{id}}</p>",
  },
  pointsAddEmail: {
    enabled: false,
    to: "",
    from: "Van Gogh Fidelidad <sebapavlotsky@gmail.com>",
    subject: "¡Sumaste {{delta}} puntos!",
    body:
      "<p>Hola {{nombre}}, acabás de sumar <b>{{delta}}</b> puntos. " +
      "Tu total ahora es <b>{{puntos}}</b>.</p>",
  },
  levelUpEmail: {
    enabled: false,
    to: "",
    from: "Van Gogh Fidelidad <sebapavlotsky@gmail.com>",
    subject: "¡Llegaste a {{threshold}} puntos!",
    body:
      "<h2>¡Felicitaciones, {{nombre}}!</h2>" +
      "<p>Tu total alcanzó <b>{{puntos}}</b> puntos (umbral: <b>{{threshold}}</b>).</p>",
    threshold: 10,
  },
};

export default function AutomationsPage() {
  const { settings, isLoading, save, sendTest } = useAutomations();
  const { toast } = useToast();

  // Estado local controlado
  const [local, setLocal] = useState<AutomationsSettingsFile>(DEFAULTS);

  // Hidratar desde el JSON cuando llegan settings
  useEffect(() => {
    if (!isLoading && settings) {
      setLocal({
        welcomeEmail:   { ...DEFAULTS.welcomeEmail,   ...(settings.welcomeEmail   || {}) },
        pointsAddEmail: { ...DEFAULTS.pointsAddEmail, ...(settings.pointsAddEmail || {}) },
        levelUpEmail:   { ...DEFAULTS.levelUpEmail,   ...(settings.levelUpEmail   || {}) },
      });
    }
  }, [isLoading, settings]);

  const handleSave = async () => {
    try {
      await save.mutateAsync(local); // guarda TODO el JSON (incluye threshold)
      toast({
        title: "✅ Cambios guardados",
        description: "Las plantillas de automations se actualizaron correctamente.",
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: "❌ Error al guardar",
        description: err?.message || "No se pudieron guardar los cambios.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Automations</h2>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>

        {/* 1) Bienvenida */}
        <EmailAutomationCard
          idBase="welcome"
          title="Bienvenida"
          description="Se envía automáticamente cuando se crea un socio nuevo."
          value={local.welcomeEmail}
          onChange={(next) => setLocal((p) => ({ ...p, welcomeEmail: next }))}
          onSendTest={(to, tpl) => sendTest.mutateAsync({ to, template: tpl })}
          isTesting={sendTest.isPending}
          helper={{
            from: 'Formato recomendado: Nombre <no-reply@tudominio.com>',
            body: "Placeholders: {{nombre}}, {{apellido}}, {{email}}, {{id}}, {{puntos}}",
          }}
        />

        {/* 2) Suma de puntos */}
        <EmailAutomationCard
          idBase="pointsAdd"
          title="Suma de puntos"
          description="Se envía automáticamente cuando se suman puntos."
          value={local.pointsAddEmail}
          onChange={(next) => setLocal((p) => ({ ...p, pointsAddEmail: next }))}
          onSendTest={(to, tpl) => sendTest.mutateAsync({ to, template: tpl })}
          isTesting={sendTest.isPending}
          helper={{
            from: 'Formato recomendado: Nombre <no-reply@tudominio.com>',
            body:
              "Placeholders: {{nombre}}, {{apellido}}, {{email}}, {{id}}, {{puntos}} (total), {{delta}} (sumado)",
          }}
        />

        {/* 3) Umbral de puntos */}
        <EmailAutomationCard
          idBase="levelUp"
          title="Umbral de puntos"
          description="Se envía cuando el socio llega o supera el umbral configurado."
          value={local.levelUpEmail}
          onChange={(next) => setLocal((p) => ({ ...p, levelUpEmail: next }))}
          onSendTest={(to, tpl) => sendTest.mutateAsync({ to, template: tpl })}
          isTesting={sendTest.isPending}
          helper={{
            from: 'Formato recomendado: Nombre <no-reply@tudominio.com>',
            body: "Placeholders: {{nombre}}, {{apellido}}, {{email}}, {{id}}, {{puntos}}, {{threshold}}",
          }}
          extra={
            <div className="space-y-2">
              <Label htmlFor="levelup-threshold">Umbral de puntos</Label>
              <Input
                id="levelup-threshold"
                type="number"
                min={1}
                value={local.levelUpEmail.threshold}
                onChange={(e) =>
                  setLocal((p) => ({
                    ...p,
                    levelUpEmail: {
                      ...p.levelUpEmail,
                      threshold: Math.max(1, parseInt(e.target.value || "1", 10)),
                    },
                  }))
                }
                disabled={isLoading || save.isPending}
              />
              <p className="text-xs text-gray-500">
                Cuando el total de <code>{"{{puntos}}"}</code> llegue o supere este valor, se enviará el email.
                Podés usar <code>{"{{threshold}}"}</code> en asunto/cuerpo.
              </p>
            </div>
          }
          // 👇 Para que {{threshold}} se vea en el preview
          previewContext={{ threshold: local.levelUpEmail.threshold }}
        />
      </div>
    </div>
  );
}
