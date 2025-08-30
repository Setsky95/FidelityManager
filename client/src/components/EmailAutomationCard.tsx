import { useMemo, useState } from "react";
import { Mail, ChevronDown, Send, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AutomationEmailSettings = {
  enabled: boolean;
  to?: string;
  from: string;
  subject: string;
  body: string; // HTML o texto
};

type Props = {
  idBase: string;
  title: string;
  description?: string;
  value: AutomationEmailSettings;
  onChange: (next: AutomationEmailSettings) => void;
  onSendTest?: (to: string, value: AutomationEmailSettings) => Promise<any> | void;
  isTesting?: boolean;
  disabled?: boolean;
  helper?: {
    from?: string;
    body?: string;
  };
  /** Controles extra debajo del template (ej. umbral) */
  extra?: React.ReactNode;
  /** Contexto adicional para placeholders del preview (ej. { threshold: 10 }) */
  previewContext?: Record<string, string | number>;
};

const SAMPLE_CONTEXT_BASE: Record<string, string> = {
  nombre: "Sebastián",
  apellido: "Pavlotsky",
  email: "socio@ejemplo.com",
  id: "VG123",
  puntos: "8",
  delta: "1",
};

function toStringDict(ctx: Record<string, string | number | undefined>) {
  const out: Record<string, string> = {};
  for (const k of Object.keys(ctx || {})) {
    const v = ctx[k];
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

function applyPlaceholders(tpl: string, ctx: Record<string, string>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = ctx[k];
    return typeof v === "string" ? v : "";
  });
}

function buildPreviewHTML(body: string, ctx: Record<string, string>): string {
  const compiled = applyPlaceholders(body, ctx);
  const hasHtml = /<html[\s>]/i.test(compiled);
  if (hasHtml) return compiled;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vista previa</title>
<style>
  body { margin:0; padding:24px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; background:#f7f7f8; color:#111; }
  .wrapper { max-width: 720px; margin: 0 auto; background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; }
</style>
</head>
<body>
  <div class="wrapper">
    ${compiled}
  </div>
</body>
</html>`;
}

export default function EmailAutomationCard({
  idBase,
  title,
  description,
  value,
  onChange,
  onSendTest,
  isTesting,
  disabled,
  helper,
  extra,
  previewContext,
}: Props) {
  const [open, setOpen] = useState(false);
  const [testTo, setTestTo] = useState(value.to ?? "");
  const [showPreview, setShowPreview] = useState(false);

  const mergedCtx = useMemo(
    () => ({ ...SAMPLE_CONTEXT_BASE, ...toStringDict(previewContext || {}) }),
    [previewContext]
  );

  const compiledSubject = useMemo(
    () => applyPlaceholders(value.subject || "", mergedCtx),
    [value.subject, mergedCtx]
  );

  const previewDoc = useMemo(
    () => buildPreviewHTML(value.body || "", mergedCtx),
    [value.body, mergedCtx]
  );

  const set = (patch: Partial<AutomationEmailSettings>) =>
    onChange({ ...value, ...patch });

  const handleSendTest = async () => {
    if (!onSendTest) return;
    await onSendTest(testTo, value);
  };

  return (
    <Card className="border border-gray-200">
      <CardContent className="p-0">
        {/* Header plegable */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "w-full px-5 py-4 flex items-center justify-between",
            "hover:bg-gray-50 transition-colors"
          )}
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">{title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="hidden sm:inline">{description}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor={`${idBase}-enabled`}>Activo</Label>
              <Switch
                id={`${idBase}-enabled`}
                checked={value.enabled}
                onCheckedChange={(v) => set({ enabled: v })}
                disabled={disabled}
              />
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-gray-500 transition-transform",
                open ? "rotate-180" : "rotate-0"
              )}
            />
          </div>
        </button>

        {/* Contenido desplegable */}
        {open && (
          <div className="p-6 space-y-4 border-t border-gray-100">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idBase}-to`}>Destinatario (prueba)</Label>
                <Input
                  id={`${idBase}-to`}
                  placeholder="tucorreo@ejemplo.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  disabled={disabled}
                />
                <p className="text-xs text-gray-500">
                  Solo para enviar email de prueba.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${idBase}-from`}>Remitente (From)</Label>
                <Input
                  id={`${idBase}-from`}
                  value={value.from}
                  onChange={(e) => set({ from: e.target.value })}
                  disabled={disabled}
                />
                {helper?.from && (
                  <p className="text-xs text-gray-500">{helper.from}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idBase}-subject`}>Asunto</Label>
              <Input
                id={`${idBase}-subject`}
                value={value.subject}
                onChange={(e) => set({ subject: e.target.value })}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idBase}-body`}>Cuerpo (HTML o texto)</Label>
              <Textarea
                id={`${idBase}-body`}
                rows={10}
                value={value.body}
                onChange={(e) => set({ body: e.target.value })}
                disabled={disabled}
              />
              {helper?.body && (
                <p className="text-xs text-gray-500">{helper.body}</p>
              )}
              {/* Extra controls debajo del template (umbral, etc.) */}
              {extra && <div className="pt-2">{extra}</div>}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Vista previa
                </Button>

                {onSendTest && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTest}
                    disabled={isTesting || !testTo}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar test
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal de vista previa */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Vista previa — {title}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4 text-sm text-gray-600">
            Placeholders: <code className="ml-1">
              {"{nombre, apellido, email, id, puntos, delta, threshold}"}
            </code>
          </div>
          <div className="h-[70vh]">
            <iframe
              title={`preview-${idBase}`}
              srcDoc={previewDoc}
              style={{ border: 0 }}
              className="w-full h-full"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
