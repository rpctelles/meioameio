import { describe, expect, it } from "vitest";
import { computeBalance, shareOf } from "./split";

describe("divisão de gastos", () => {
  it("50/50: parceiro deve metade do que eu paguei", () => {
    expect(computeBalance("a", [{ amount: 100, paid_by: "a", payer_share: 50, is_paid: true }], [])).toBe(50);
  });
  it("divisão desigual 70/30: quem pagou fica com 70%", () => {
    expect(computeBalance("b", [{ amount: 200, paid_by: "a", payer_share: 70, is_paid: true }], [])).toBe(-60);
  });
  it("contas ainda não pagas não entram no saldo", () => {
    expect(computeBalance("a", [{ amount: 100, paid_by: "a", payer_share: 50, is_paid: false }], [])).toBe(0);
  });
  it("acerto de contas zera a dívida", () => {
    expect(
      computeBalance("a", [{ amount: 100, paid_by: "a", payer_share: 50, is_paid: true }], [{ from_user: "b", to_user: "a", amount: 50 }]),
    ).toBe(0);
  });
  it("parte de cada um", () => {
    const e = { amount: 100, paid_by: "a", payer_share: 70, is_paid: true };
    expect(shareOf("a", e)).toBe(70);
    expect(shareOf("b", e)).toBe(30);
  });
});
