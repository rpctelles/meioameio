import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMonths, format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Download, HandCoins, LogOut, Pencil, Plus, Search, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseDialog } from "./ExpenseDialog";
import { type Expense, type Household, type Member, type Settlement } from "@/lib/types";
import { brl, computeBalance, shareOf } from "@/lib/split";
import { googleCalendarLink } from "@/lib/gcal";
import { exportToExcel } from "@/lib/export";
import { useCategories } from "@/hooks/useCategories";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function Dashboard({ me, household, members }: { me: string; household: Household; members: Member[] }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const cats = useCategories(household.id);
  const catEmoji = cats.emojiOf;

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", household.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("household_id", household.id).order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ["settlements", household.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("settlements").select("*").eq("household_id", household.id).order("settled_on", { ascending: false });
      if (error) throw error;
      return data as Settlement[];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["settlements"] });
  };

  const meM = members.find((m) => m.user_id === me)!;
  const partner = members.find((m) => m.user_id !== me);
  const name = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const balance = computeBalance(me, expenses, settlements);
  const monthKey = format(month, "yyyy-MM");

  const monthExp = useMemo(() => expenses.filter((e) => e.expense_date.startsWith(monthKey)), [expenses, monthKey]);
  const filtered = monthExp.filter((e) => (cat === "all" || e.category === cat) && e.description.toLowerCase().includes(q.toLowerCase()));
  const total = monthExp.reduce((s, e) => s + Number(e.amount), 0);
  const prevKey = format(addMonths(month, -1), "yyyy-MM");
  const prevTotal = expenses.filter((e) => e.expense_date.startsWith(prevKey)).reduce((s, e) => s + Number(e.amount), 0);
  const myShare = monthExp.reduce((s, e) => s + shareOf(me, e), 0);
  const byCat = Object.entries(monthExp.reduce<Record<string, number>>((a, e) => ((a[e.category] = (a[e.category] ?? 0) + Number(e.amount)), a), {}))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const upcoming = expenses.filter((e) => !e.is_paid).sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));

  async function remove(e: Expense) {
    if (!confirm(`Excluir "${e.description}"?`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function markPaid(e: Expense) {
    const { error } = await supabase.from("expenses").update({ is_paid: true, expense_date: new Date().toISOString().slice(0, 10) }).eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marcado como pago");
    refresh();
  }
  async function settle() {
    if (!partner || balance === 0) return;
    const amt = Math.abs(balance);
    if (!confirm(`Registrar acerto de ${brl(amt)}?`)) return;
    const { error } = await supabase.from("settlements").insert({
      household_id: household.id,
      from_user: balance > 0 ? partner.user_id : me,
      to_user: balance > 0 ? me : partner.user_id,
      amount: amt,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Contas acertadas! 🎉");
    refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {meM?.display_name}</p>
          <h1 className="text-3xl">{household.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToExcel(filtered, members, monthKey)}>
            <Download className="size-4" /> <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Sair">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {!partner && (
        <Card className="mt-6 flex flex-col items-start justify-between gap-3 border-accent/40 bg-accent/10 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Convide seu par</p>
            <p className="text-sm text-muted-foreground">Peça para criar uma conta e entrar com o código abaixo.</p>
          </div>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(household.invite_code); toast.success("Código copiado"); }}>
            <span className="font-mono tracking-widest">{household.invite_code}</span> <Copy className="size-4" />
          </Button>
        </Card>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="bg-hero relative overflow-hidden border-0 p-6 text-primary-foreground shadow-soft md:col-span-2">
          <p className="text-sm text-primary-foreground/70">Saldo entre vocês</p>
          <p className="mt-2 font-display text-4xl md:text-5xl">
            {balance === 0 ? "Tudo certo ✨" : brl(Math.abs(balance))}
          </p>
          <p className="mt-1 text-primary-foreground/80">
            {balance > 0 ? `${partner?.display_name ?? "Seu par"} te deve` : balance < 0 ? `Você deve a ${partner?.display_name}` : "Ninguém deve nada a ninguém"}
          </p>
          {balance !== 0 && partner && (
            <Button variant="secondary" className="mt-5" onClick={settle}>
              <HandCoins className="size-4" /> Acertar contas
            </Button>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="size-4" /></Button>
            <span className="font-semibold capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
            <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="size-4" /></Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Total do mês</p>
          <p className="font-display text-3xl">{brl(total)}</p>
          {prevTotal > 0 && (
            <p className={`text-xs ${total > prevTotal ? "text-destructive" : "text-success"}`}>
              {total > prevTotal ? "▲" : "▼"} {Math.abs(Math.round(((total - prevTotal) / prevTotal) * 100))}% vs mês anterior
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">Sua parte: <b className="text-foreground">{brl(myShare)}</b></p>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="text-lg">Por categoria</h3>
          {byCat.length ? (
            <>
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCat} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => brl(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-sm">
                {byCat.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{catEmoji(c.name)} {c.name}</span>
                    <span className="font-medium">{brl(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="mt-6 text-sm text-muted-foreground">Sem gastos neste mês.</p>}
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-lg">Contas a pagar</h3>
          {upcoming.length ? (
            <ul className="mt-3 divide-y">
              {upcoming.slice(0, 6).map((e) => {
                const days = e.due_date ? differenceInCalendarDays(parseISO(e.due_date), new Date()) : null;
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-xl">{catEmoji(e.category)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.due_date ? format(parseISO(e.due_date), "dd 'de' MMM", { locale: ptBR }) : "Sem data"} · {name(e.paid_by)}
                      </p>
                    </div>
                    {days !== null && (
                      <Badge variant={days < 0 ? "destructive" : "secondary"}>
                        {days < 0 ? `${-days}d atrasada` : days === 0 ? "Hoje" : `em ${days}d`}
                      </Badge>
                    )}
                    <span className="w-24 text-right font-semibold">{brl(Number(e.amount))}</span>
                    {e.due_date && (
                      <Button asChild variant="ghost" size="icon" aria-label="Google Agenda">
                        <a target="_blank" rel="noreferrer" href={googleCalendarLink({ title: `💸 Pagar: ${e.description} (${brl(Number(e.amount))})`, date: e.due_date })}>
                          <CalendarPlus className="size-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => markPaid(e)} aria-label="Marcar como pago"><Check className="size-4" /></Button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-6 text-sm text-muted-foreground">Nenhuma conta pendente. Cadastre um gasto como “não pago” para lembrar do vencimento.</p>}
        </Card>
      </section>

      <Card className="mt-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg">Gastos do mês</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input className="w-44 pl-8" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {cats.all.map((c) => <SelectItem key={c.name} value={c.name}>{c.emoji} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtered.length ? (
          <ul className="mt-4 divide-y">
            {filtered.map((e) => (
              <li key={e.id} className="group flex items-center gap-3 py-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-lg">{catEmoji(e.category)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description} {!e.is_paid && <Badge variant="outline" className="ml-1">a pagar</Badge>}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(e.expense_date), "dd/MM")} · {name(e.paid_by)} pagou · {Number(e.payer_share)}/{100 - Number(e.payer_share)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{brl(Number(e.amount))}</p>
                  <p className="text-xs text-muted-foreground">sua parte {brl(shareOf(me, e))}</p>
                </div>
                <div className="flex opacity-60 group-hover:opacity-100">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }} aria-label="Editar"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(e)} aria-label="Excluir"><Trash2 className="size-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="py-10 text-center text-muted-foreground">Nada por aqui ainda. Toque em “Novo gasto”.</p>}
      </Card>

      {settlements.length > 0 && (
        <Card className="mt-4 p-6">
          <h3 className="text-lg">Acertos de contas</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {settlements.slice(0, 5).map((s) => (
              <li key={s.id} className="flex justify-between text-muted-foreground">
                <span>{format(parseISO(s.settled_on), "dd/MM/yyyy")} · {name(s.from_user)} → {name(s.to_user)}</span>
                <span className="font-medium text-foreground">{brl(Number(s.amount))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button size="lg" className="fixed bottom-6 right-6 rounded-full shadow-soft" onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="size-5" /> Novo gasto
      </Button>

      <ExpenseDialog open={open} onOpenChange={setOpen} householdId={household.id} me={me} members={members} editing={editing} onSaved={refresh} />
    </div>
  );
}
