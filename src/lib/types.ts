import type { Tables } from "@/integrations/supabase/types";
export type Expense = Tables<"expenses">;
export type Member = Tables<"household_members">;
export type Household = Tables<"households">;
export type Settlement = Tables<"settlements">;

export const CATEGORIES = [
  { name: "Mercado", emoji: "🛒" },
  { name: "Moradia", emoji: "🏠" },
  { name: "Contas", emoji: "💡" },
  { name: "Transporte", emoji: "🚗" },
  { name: "Restaurantes", emoji: "🍽️" },
  { name: "Lazer", emoji: "🎬" },
  { name: "Saúde", emoji: "💊" },
  { name: "Viagem", emoji: "✈️" },
  { name: "Pets", emoji: "🐾" },
  { name: "Outros", emoji: "📦" },
];
export const catEmoji = (c: string) => CATEGORIES.find((x) => x.name === c)?.emoji ?? "📦";
