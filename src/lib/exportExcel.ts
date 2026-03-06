import * as XLSX from "xlsx";

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function sheetFromRows(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows);
}

export function createWorkbook(...sheets: { name: string; rows: Record<string, unknown>[] }[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(wb, sheetFromRows(rows), name.slice(0, 31));
  }
  return wb;
}
