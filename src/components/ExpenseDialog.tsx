import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Expense, type Member } from "@/lib/types";
import { brl } from "@/lib/split";
import { googleCalendarLink } from "@/lib/gcal";
import { useCategories } from "@/hooks/useCategories";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  me: string;
  members: Member[];
  editing: Expense | null;
  onSaved: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseDialog({ open, onOpenChange, householdId, me, members, editing, onSaved }: Props) {
  const [f, setF] = useState({ description: "", amount: "", category: "Mercado", expense_date: today(), paid_by: me, payer_share: 50, is_paid: true, due_date: "", notes: "" });
  const [addCal, setAddCal] = useState(true);
  const cats = useCategories(householdId);
  const [newCat, setNewCat] = useState<{ name: string; emoji: string } | null>(null);
  async function createCat() {
    if (!newCat?.name.trim()) return;
    const err = await cats.add(newCat.name, newCat.emoji);
    if (err) { toast.error(err.code === "23505" ? "Essa categoria já existe" : err.message); return; }
    setF((x) => ({ ...x, category: newCat.name.trim().slice(0, 30) }));
    setNewCat(null);
    toast.success("Categoria criada");
  }

  useEffect(() => {
    if (!open) return;
    setF(
      editing
        ? { description: editing.description, amount: String(editing.amount), category: editing.category, expense_date: editing.expense_date, paid_by: editing.paid_by, payer_share: Number(editing.payer_share), is_paid: editing.is_paid, due_date: editing.due_date ?? "", notes: editing.notes ?? "" }
        : { description: "", amount: "", category: "Mercado", expense_date: today(), paid_by: me, payer_share: 50, is_paid: true, due_date: "", notes: "" },
    );
  }, [open, editing, me]);

  const amount = Number(f.amount.replace(",", ".")) || 0;
  const payer = members.find((m) => m.user_id === f.paid_by);
  const other = members.find((m) => m.user_id !== f.paid_by);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.description.trim() || amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    const row = {
      household_id: householdId,
      description: f.description.trim().slice(0, 120),
      amount,
      category: f.category,
      expense_date: f.expense_date,
      paid_by: f.paid_by,
      payer_share: f.payer_share,
      is_paid: f.is_paid,
      due_date: f.due_date || null,
      notes: f.notes.trim().slice(0, 500) || null,
    };
    const { error } = editing
      ? await supabase.from("expenses").update(row).eq("id", editing.id)
      : await supabase.from("expenses").insert({ ...row, created_by: me });
    if (error) { toast.error(error.message); return; }
    if (f.due_date && !f.is_paid && addCal) {
      window.open(googleCalendarLink({ title: `💸 Pagar: ${row.description} (${brl(amount)})`, date: f.due_date, details: `Pago por ${payer?.display_name ?? ""}. Categoria: ${f.category}` }), "_blank");
    }
    toast.success(editing ? "Gasto atualizado" : "Gasto adicionado");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{editing ? "Editar gasto" : "Novo gasto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Supermercado" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              {newCat ? (
                <div className="flex gap-1">
                  <Input className="w-12 px-2 text-center" maxLength={2} value={newCat.emoji} onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value })} />
                  <Input autoFocus placeholder="Nome" maxLength={30} value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCat(); } if (e.key === "Escape") setNewCat(null); }} />
                  <Button type="button" size="sm" onClick={createCat}>OK</Button>
                </div>
              ) : (
                <Select value={f.category} onValueChange={(v) => (v === "__new" ? setNewCat({ name: "", emoji: "🏷️" }) : setF({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cats.all.map((c) => <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>)}
                    <SelectItem value="__new">➕ Nova categoria…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quem pagou?</Label>
            <div className="grid grid-cols-2 gap-2">
              {members.map((m) => (
                <Button key={m.user_id} type="button" variant={f.paid_by === m.user_id ? "default" : "outline"} onClick={() => setF({ ...f, paid_by: m.user_id })}>
                  {m.display_name}
                </Button>
              ))}
              {members.length < 2 && (
                <Button type="button" variant="outline" disabled>Seu par</Button>
              )}
            </div>
            {members.length < 2 && (
              <p className="text-xs text-muted-foreground">Quando seu par entrar com o código de convite, você poderá registrar gastos pagos por ele(a).</p>
            )}
          </div>
          {(
            <div className="rounded-xl bg-muted p-4">
              <div className="flex items-center justify-between text-sm">
                <Label>Divisão</Label>
                <div className="flex gap-1">
                  {[50, 60, 70, 100].map((p) => (
                    <button key={p} type="button" onClick={() => setF({ ...f, payer_share: p })} className={`rounded-full px-2.5 py-0.5 text-xs ${f.payer_share === p ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      {p === 100 ? "Só meu" : `${p}/${100 - p}`}
                    </button>
                  ))}
                </div>
              </div>
              <Slider className="my-4" min={0} max={100} step={5} value={[f.payer_share]} onValueChange={([v]) => setF({ ...f, payer_share: v ?? 50 })} />
              <div className="flex justify-between text-sm">
                <span><b>{payer?.display_name}</b> {f.payer_share}% · {brl((amount * f.payer_share) / 100)}</span>
                <span><b>{other?.display_name ?? "Seu par"}</b> {100 - f.payer_share}% · {brl((amount * (100 - f.payer_share)) / 100)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label>Já foi pago?</Label>
              <p className="text-xs text-muted-foreground">Desligue para contas a vencer (só entram no saldo quando pagas).</p>
            </div>
            <Switch checked={f.is_paid} onCheckedChange={(v) => setF({ ...f, is_paid: v })} />
          </div>
          {!f.is_paid && (
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={addCal} onCheckedChange={setAddCal} /> Adicionar lembrete no Google Agenda ao salvar
              </label>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" size="lg">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
