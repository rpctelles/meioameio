import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function SetupScreen({ onDone, defaultName }: { onDone: () => void; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [house, setHouse] = useState("Nossa casa");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: "create" | "join") {
    if (!name.trim()) return toast.error("Diga como quer ser chamado");
    setBusy(true);
    const { error } =
      fn === "create"
        ? await supabase.rpc("create_household", { _name: house, _display_name: name.trim() })
        : await supabase.rpc("join_household", { _code: code, _display_name: name.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    onDone();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center p-6">
      <h1 className="text-4xl">Vamos começar</h1>
      <p className="mt-2 text-muted-foreground">Crie a casa de vocês ou entre com o código que seu par compartilhou.</p>
      <div className="mt-6 max-w-xs space-y-1.5">
        <Label>Como você quer ser chamado?</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rodrigo" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-xl">Criar nova casa</h3>
          <p className="mt-1 text-sm text-muted-foreground">Você recebe um código para convidar seu par.</p>
          <Input className="mt-4" value={house} onChange={(e) => setHouse(e.target.value)} />
          <Button className="mt-3 w-full" disabled={busy} onClick={() => run("create")}>Criar</Button>
        </Card>
        <Card className="p-6">
          <h3 className="text-xl">Tenho um código</h3>
          <p className="mt-1 text-sm text-muted-foreground">Entre na casa que já foi criada.</p>
          <Input className="mt-4 uppercase tracking-widest" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" />
          <Button variant="secondary" className="mt-3 w-full" disabled={busy || code.length < 6} onClick={() => run("join")}>Entrar</Button>
        </Card>
      </div>
    </div>
  );
}
