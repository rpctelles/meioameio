import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { SetupScreen } from "@/components/SetupScreen";
import { Dashboard } from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meio a Meio — gastos do casal" },
      { name: "description", content: "Controle e divida os gastos da casa com seu par, do jeito de vocês." },
      { property: "og:title", content: "Meio a Meio — gastos do casal" },
      { property: "og:description", content: "Controle e divida os gastos da casa com seu par, do jeito de vocês." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const home = useQuery({
    queryKey: ["home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mine, error } = await supabase.from("household_members").select("household_id").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      if (!mine) return null;
      const [{ data: household }, { data: members }] = await Promise.all([
        supabase.from("households").select("*").eq("id", mine.household_id).single(),
        supabase.from("household_members").select("*").eq("household_id", mine.household_id).order("joined_at"),
      ]);
      return { household: household!, members: members ?? [] };
    },
  });

  if (loading || (user && home.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center font-display text-2xl text-muted-foreground">Meio a Meio</div>;
  }
  if (!user) return <AuthScreen />;
  if (!home.data) {
    const n = (user.user_metadata?.['full_name'] as string | undefined)?.split(" ")[0] ?? "";
    return <SetupScreen defaultName={n} onDone={() => home.refetch()} />;
  }
  return <Dashboard me={user.id} household={home.data.household} members={home.data.members} />;
}
