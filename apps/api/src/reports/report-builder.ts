import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface TabularReport {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}

const cell = (v: string | number | null) => (v === null || v === undefined ? '' : String(v));

/** CSV com BOM (Excel pt-BR abre acentuação corretamente) e separador ";". */
export function buildCsv(report: TabularReport): Buffer {
  const escape = (v: string) => (/[";\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const lines = [
    report.columns.map(escape).join(';'),
    ...report.rows.map((row) => row.map((v) => escape(cell(v))).join(';')),
  ];
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
}

export async function buildXlsx(report: TabularReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Radar Contábil';
  const sheet = workbook.addWorksheet(report.title.slice(0, 31));
  sheet.addRow([report.title]).font = { bold: true, size: 14 };
  if (report.subtitle) sheet.addRow([report.subtitle]).font = { size: 10, color: { argb: 'FF666666' } };
  sheet.addRow([]);
  const header = sheet.addRow(report.columns);
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF7F2' } };
  });
  report.rows.forEach((row) => sheet.addRow(row.map(cell)));
  sheet.columns.forEach((column) => {
    let max = 10;
    column.eachCell?.({ includeEmpty: false }, (c) => {
      max = Math.min(60, Math.max(max, String(c.value ?? '').length + 2));
    });
    column.width = max;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildPdf(report: TabularReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#0f5438').text(report.title);
    if (report.subtitle) doc.fontSize(9).fillColor('#666666').text(report.subtitle);
    doc.moveDown(0.8);

    const usableWidth = doc.page.width - 80;
    const colWidth = usableWidth / report.columns.length;
    const drawRow = (values: string[], bold: boolean) => {
      const y = doc.y;
      if (y > doc.page.height - 60) {
        doc.addPage();
      }
      const rowY = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#111111');
      values.forEach((value, index) => {
        doc.text(value.slice(0, 60), 40 + index * colWidth, rowY, {
          width: colWidth - 6,
          lineBreak: false,
        });
      });
      doc.moveDown(0.6);
    };

    drawRow(report.columns, true);
    doc
      .moveTo(40, doc.y - 2)
      .lineTo(40 + usableWidth, doc.y - 2)
      .strokeColor('#cccccc')
      .stroke();
    report.rows.forEach((row) => drawRow(row.map(cell), false));

    doc.fontSize(7).fillColor('#999999');
    doc.text(`Gerado pelo Radar Contábil em ${new Date().toLocaleString('pt-BR')}`, 40, doc.page.height - 50);
    doc.end();
  });
}
