import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/types";

export type Category = { name: string; emoji: string; id?: string };

export function useCategories(householdId: string) {
  const qc = useQueryClient();
  const { data: custom = [] } = useQuery({
    queryKey: ["categories", householdId],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_categories").select("*").eq("household_id", householdId).order("name");
      if (error) throw error;
      return data;
    },
  });
  const all: Category[] = [
    ...CATEGORIES.filter((c) => c.name !== "Outros"),
    ...custom.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    CATEGORIES.find((c) => c.name === "Outros")!,
  ];
  const emojiOf = (n: string) => all.find((c) => c.name === n)?.emoji ?? "🏷️";
  const add = async (name: string, emoji: string) => {
    const { error } = await supabase.from("custom_categories").insert({ household_id: householdId, name: name.trim().slice(0, 30), emoji: emoji.trim() || "🏷️" });
    if (!error) qc.invalidateQueries({ queryKey: ["categories", householdId] });
    return error;
  };
  return { all, custom, emojiOf, add };
}
