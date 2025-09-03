import { useEffect, useMemo, useState } from "react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // si no tenés, usá <textarea className="...">
import { useToast } from "@/hooks/use-toast";
import { BurgerMenu } from "@/components/burgerMenu.jsx";

type Campaign = {
  id: string;
  name: string;
  enabled: boolean;
  from: string;
  subject: string;
  body: string;
  promoTexto?: string;
  promoPrecio?: string;
  promoFecha?: string;
};

const DEFAULT_HTML =
  `<h1>{{promoTexto}}</h1><p>Precio: <b>{{promoPrecio}}</b></p><p>Válido hasta {{promoFecha}}</p>`;

export default function CampaignsPage() {
  const { list, create, update, remove, send } = useCampaigns();
  const { toast } = useToast();

  const [items, setItems] = useState<Campaign[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("Promo: {{promoTexto}}");
  const [newBody, setNewBody] = useState(DEFAULT_HTML);

  useEffect(() => {
    if (list.data) setItems(list.data as any);
  }, [list.data]);

  const onCreate = async () => {
    try {
      await create.mutateAsync({
        name: newName || "Nueva campaña",
        subject: newSubject,
        body: newBody,
      });
      setCreating(false);
      setNewName("");
      setNewSubject("Promo: {{promoTexto}}");
      setNewBody(DEFAULT_HTML);
      toast({ title: "Campaña creada" });
    } catch (e: any) {
      toast({ title: "Error al crear", description: e?.message, variant: "destructive" });
    }
  };

  const onUpdate = async (c: Campaign) => {
    try {
      await update.mutateAsync(c);
      toast({ title: "Cambios guardados" });
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e?.message, variant: "destructive" });
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar campaña?")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "Eliminada" });
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e?.message, variant: "destructive" });
    }
  };

  const [sendTo, setSendTo] = useState<string>("");
  const [override, setOverride] = useState<{ [k: string]: string }>({
    promoTexto: "",
    promoPrecio: "",
    promoFecha: "",
  });

  const onSend = async (c: Campaign) => {
    if (!sendTo) return toast({ title: "Ingresá un destinatario", variant: "destructive" });
    try {
      await send.mutateAsync({
        campaignId: c.id,
        to: sendTo,
        data: {
          promoTexto: override.promoTexto || c.promoTexto,
          promoPrecio: override.promoPrecio || c.promoPrecio,
          promoFecha: override.promoFecha || c.promoFecha,
        },
      });
      toast({ title: "Enviado", description: `Se envió a ${sendTo}` });
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="p-6 space-y-6 max-w-6xl">
        {/* header */}
        <div className="flex items-center justify-between gap-2">
          <BurgerMenu />
          <h2 className="text-2xl font-semibold">Campañas</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setCreating(true)}>+ Nueva</Button>
          </div>
        </div>

        {/* listado */}
        {list.isLoading ? (
          <div className="text-sm text-neutral-400">Cargando…</div>
        ) : (
          <div className="grid gap-6">
            {items.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Input
                      value={c.name}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, name: e.target.value } : it))}
                      className="w-64"
                    />
                    <span className="text-xs text-neutral-500">ID: {c.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => onUpdate(c)} disabled={update.isPending}>Guardar</Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(c.id)} disabled={remove.isPending}>Borrar</Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <Input
                      value={c.from}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, from: e.target.value } : it))}
                    />

                    <Label>Asunto</Label>
                    <Input
                      value={c.subject}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, subject: e.target.value } : it))}
                    />

                    <Label>HTML</Label>
                    <Textarea
                      value={c.body}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, body: e.target.value } : it))}
                      rows={10}
                      className="font-mono"
                    />

                    <p className="text-xs text-neutral-400">
                      Placeholders disponibles: {"{{promoTexto}}, {{promoPrecio}}, {{promoFecha}}"} + los que pases al enviar.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold">Variables de promoción</h4>
                    <Label>Texto</Label>
                    <Input
                      value={c.promoTexto || ""}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, promoTexto: e.target.value } : it))}
                    />
                    <Label>Precio</Label>
                    <Input
                      value={c.promoPrecio || ""}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, promoPrecio: e.target.value } : it))}
                    />
                    <Label>Fecha</Label>
                    <Input
                      value={c.promoFecha || ""}
                      onChange={(e) => setItems((arr) => arr.map(it => it.id === c.id ? { ...it, promoFecha: e.target.value } : it))}
                    />

                    <div className="h-px bg-white/10 my-2" />

                    <h4 className="font-semibold">Enviar</h4>
                    <Label>Destinatario</Label>
                    <Input
                      placeholder="email@destino.com"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                    />

                    <Label>Overrides (opcional)</Label>
                    <Input
                      placeholder="promoTexto (override)"
                      value={override.promoTexto}
                      onChange={(e) => setOverride((o) => ({ ...o, promoTexto: e.target.value }))}
                    />
                    <Input
                      placeholder="promoPrecio (override)"
                      value={override.promoPrecio}
                      onChange={(e) => setOverride((o) => ({ ...o, promoPrecio: e.target.value }))}
                    />
                    <Input
                      placeholder="promoFecha (override)"
                      value={override.promoFecha}
                      onChange={(e) => setOverride((o) => ({ ...o, promoFecha: e.target.value }))}
                    />

                    <Button onClick={() => onSend(c)} disabled={send.isPending}>
                      {send.isPending ? "Enviando…" : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* modal crear */}
        {creating && (
          <div className="fixed inset-0 bg-black/60 grid place-items-center z-50">
            <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Nueva campaña</h3>
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />

              <Label>Asunto</Label>
              <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />

              <Label>HTML</Label>
              <Textarea rows={10} className="font-mono" value={newBody} onChange={(e) => setNewBody(e.target.value)} />

              <div className="flex items-center gap-2 justify-end">
                <Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button>
                <Button onClick={onCreate} disabled={create.isPending}>
                  {create.isPending ? "Creando…" : "Crear"}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

