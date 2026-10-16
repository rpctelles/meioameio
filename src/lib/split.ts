export type SplitExpense = {
  amount: number;
  paid_by: string;
  payer_share: number; // % of the expense that belongs to whoever paid
  is_paid: boolean;
};

export type SplitSettlement = { from_user: string; to_user: string; amount: number };

/** How much the partner owes `me`. Positive: partner owes me. Negative: I owe partner. */
export function computeBalance(
  me: string,
  expenses: SplitExpense[],
  settlements: SplitSettlement[],
): number {
  let bal = 0;
  for (const e of expenses) {
    if (!e.is_paid) continue;
    const otherPart = (Number(e.amount) * (100 - Number(e.payer_share))) / 100;
    bal += e.paid_by === me ? otherPart : -otherPart;
  }
  for (const s of settlements) {
    if (s.from_user === me) bal += Number(s.amount);
    else if (s.to_user === me) bal -= Number(s.amount);
  }
  return Math.round(bal * 100) / 100;
}

/** Portion of an expense that belongs to `user`. */
export function shareOf(user: string, e: SplitExpense): number {
  const payerPart = (Number(e.amount) * Number(e.payer_share)) / 100;
  return e.paid_by === user ? payerPart : Number(e.amount) - payerPart;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
