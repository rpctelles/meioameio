import type { Expense, Member } from "./types";

export async function exportToExcel(expenses: Expense[], members: Member[], fileLabel: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Gastos");
  const name = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const [m1, m2] = members;
  ws.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Descrição", key: "desc", width: 32 },
    { header: "Categoria", key: "cat", width: 16 },
    { header: "Valor (R$)", key: "amount", width: 14 },
    { header: "Pago por", key: "payer", width: 16 },
    { header: "% de quem pagou", key: "pct", width: 16 },
    { header: `Parte ${m1?.display_name ?? "1"} (R$)`, key: "p1", width: 18 },
    { header: `Parte ${m2?.display_name ?? "2"} (R$)`, key: "p2", width: 18 },
    { header: "Vencimento", key: "due", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Notas", key: "notes", width: 30 },
  ];
  expenses.forEach((e, i) => {
    const r = i + 2;
    ws.addRow({
      date: new Date(e.expense_date + "T12:00:00"),
      desc: e.description,
      cat: e.category,
      amount: Number(e.amount),
      payer: name(e.paid_by),
      pct: Number(e.payer_share) / 100,
      p1: { formula: `IF(E${r}="${m1?.display_name ?? ""}",D${r}*F${r},D${r}*(1-F${r}))` },
      p2: { formula: `D${r}-G${r}` },
      due: e.due_date ? new Date(e.due_date + "T12:00:00") : null,
      status: e.is_paid ? "Pago" : "A pagar",
      notes: e.notes ?? "",
    });
  });
  const last = expenses.length + 1;
  const total = ws.addRow({ desc: "Total", amount: { formula: `SUM(D2:D${last})` }, p1: { formula: `SUM(G2:G${last})` }, p2: { formula: `SUM(H2:H${last})` } });
  total.font = { bold: true, name: "Arial" };
  ws.getRow(1).font = { bold: true, name: "Arial", color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4D3A" } };
  ["D", "G", "H"].forEach((c) => (ws.getColumn(c).numFmt = '"R$" #,##0.00'));
  ws.getColumn("F").numFmt = "0%";
  ["A", "I"].forEach((c) => (ws.getColumn(c).numFmt = "dd/mm/yyyy"));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `gastos-${fileLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
