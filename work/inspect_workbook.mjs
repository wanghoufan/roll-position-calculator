import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const sourcePath = "C:/Users/ZhuanZ/Desktop/滚仓计算.xlsx";
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
  tableMaxRows: 20,
  tableMaxCols: 20,
  tableMaxCellChars: 200,
});
console.log("=== SUMMARY ===");
console.log(summary.ndjson);

const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
console.log("=== SHEETS ===");
console.log(sheets.ndjson);

for (let i = 0; i < workbook.worksheets.items.length; i += 1) {
  const sheet = workbook.worksheets.getItemAt(i);
  const used = sheet.getUsedRange();
  console.log(`=== SHEET ${i + 1}: ${sheet.name} / USED ${used?.address ?? "none"} ===`);
  if (used) {
    console.log(JSON.stringify({
      values: used.values,
      formulas: used.formulas,
      displayFormulas: used.displayFormulas,
    }, null, 2));
  }
}

const preview = await workbook.render({
  sheetName: "Sheet1",
  autoCrop: "all",
  scale: 1.5,
  format: "png",
});
await fs.writeFile("work/source-workbook.png", new Uint8Array(await preview.arrayBuffer()));
