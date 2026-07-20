import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataDir = path.join(repoRoot, 'samples', 'invoices', 'metadata');
const pdfDir = path.join(repoRoot, 'samples', 'invoices', 'pdf');

function asText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function escapePdfText(value) {
  return asText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatCurrency(value, currency = 'USD') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatShortDate(value) {
  const parsed = new Date(asText(value));
  if (Number.isNaN(parsed.getTime())) {
    return asText(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function addDays(value, days) {
  const parsed = new Date(asText(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const next = new Date(parsed);
  next.setDate(next.getDate() + days);
  return next;
}

function initials(name) {
  const text = asText(name).trim();
  if (!text) {
    return 'IN';
  }

  const letters = text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return letters || 'IN';
}

function wrapText(text, maxChars) {
  const value = asText(text).trim();
  if (!value) {
    return [''];
  }

  const words = value.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      continue;
    }

    current = candidate;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function rgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const int = Number.parseInt(value, 16);
  const red = ((int >> 16) & 255) / 255;
  const green = ((int >> 8) & 255) / 255;
  const blue = (int & 255) / 255;
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`;
}

function createPdfStream(lines) {
  return lines.join('\n');
}

function textOp(x, y, text, size, font = 'F1', color = '#111827') {
  return `BT /${font} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`;
}

function rectFill(x, y, w, h, color) {
  return `${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`;
}

function rectStroke(x, y, w, h, color = '#d1d5db', width = 1) {
  return `${rgb(color)} RG ${width.toFixed(2)} w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`;
}

function line(x1, y1, x2, y2, color = '#d1d5db', width = 1) {
  return `${rgb(color)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function createInvoiceContent(meta) {
  const supplierName = asText(meta.SupplierName || meta.supplierName || 'Invoice Vendor') || 'Invoice Vendor';
  const supplierNumber = asText(meta.SupplierNumber || meta.supplierNumber || '').trim();
  const invoiceNumber = asText(meta.InvoiceNumber || meta.invoiceNumber || path.basename(meta.FileName || meta.fileName || '', '.pdf')).trim() || 'INV-000000';
  const invoiceDate = asText(meta.InvoiceDate || meta.invoiceDate || '');
  const dueDate = addDays(invoiceDate, 30);
  const poNumber = asText(meta.PurchaseOrderNumber || meta.purchaseOrderNumber || 'PO-000000');
  const afeNumber = asText(meta.AfeNumber || meta.afeNumber || 'AFE-0000');
  const costCenter = asText(meta.CostCenter || meta.costCenter || 'General Operations');
  const currency = asText(meta.Currency || meta.currency || 'USD') || 'USD';
  const subtotal = Number(meta.Subtotal ?? meta.subtotal ?? 0) || 0;
  const tax = Number(meta.Tax ?? meta.tax ?? 0) || 0;
  const total = Number(meta.TotalAmount ?? meta.totalAmount ?? subtotal + tax) || subtotal + tax;
  const brand = initials(supplierName);
  const remitName = brand;
  const lineItems = Array.isArray(meta.LineItems || meta.lineItems) ? (meta.LineItems || meta.lineItems) : [];
  const itemLines = lineItems.length > 0
    ? lineItems
    : [{
        lineNumber: 1,
        description: 'Invoice services',
        quantity: 1,
        unitPrice: subtotal || total || 0,
        amount: total || subtotal || 0,
        coding: costCenter,
      }];

  const ops = [];
  ops.push('q');
  ops.push(rectFill(0, 0, PAGE_WIDTH, PAGE_HEIGHT, '#ffffff'));
  ops.push(rectFill(0, PAGE_HEIGHT - 74, PAGE_WIDTH, 74, '#f3f5f7'));

  // Brand block.
  ops.push(rectFill(MARGIN, PAGE_HEIGHT - 112, 150, 84, '#0b4da2'));
  ops.push(textOp(MARGIN + 42, PAGE_HEIGHT - 59, brand, 30, 'F2', '#ffffff'));
  ops.push(textOp(MARGIN + 8, PAGE_HEIGHT - 128, 'Invoice Document', 11, 'F2', '#6b7280'));

  // Header right.
  ops.push(textOp(376, PAGE_HEIGHT - 54, 'Invoice No.', 12, 'F2', '#111827'));
  ops.push(textOp(458, PAGE_HEIGHT - 54, invoiceNumber, 16, 'F2', '#111827'));
  ops.push(textOp(376, PAGE_HEIGHT - 78, supplierName, 13, 'F2', '#111827'));
  if (supplierNumber) {
    ops.push(textOp(376, PAGE_HEIGHT - 96, supplierNumber, 10, 'F1', '#4b5563'));
  }

  const addressStartY = PAGE_HEIGHT - 150;
  ops.push(textOp(MARGIN, addressStartY, 'Bill To', 10, 'F2', '#111827'));
  ops.push(textOp(186, addressStartY, 'Ship To', 10, 'F2', '#111827'));

  const billTo = [
    'Accounts Payable',
    'InvoiceLens Operations',
    '500 Market Street, Suite 800',
    'San Francisco, CA 94105',
    'United States',
  ];
  const shipTo = [
    costCenter,
    'InvoiceLens Receiving',
    '500 Market Street, Suite 800',
    'San Francisco, CA 94105',
    'United States',
  ];

  billTo.forEach((lineText, index) => {
    ops.push(textOp(MARGIN, addressStartY - 16 - (index * 12), lineText, 10, 'F1', '#111827'));
  });

  shipTo.forEach((lineText, index) => {
    ops.push(textOp(186, addressStartY - 16 - (index * 12), lineText, 10, 'F1', '#111827'));
  });

  ops.push(textOp(MARGIN, PAGE_HEIGHT - 236, 'PO#', 10, 'F2', '#111827'));
  ops.push(textOp(96, PAGE_HEIGHT - 236, poNumber || 'N/A', 10, 'F1', '#111827'));
  ops.push(textOp(186, PAGE_HEIGHT - 236, 'Contract:', 10, 'F2', '#111827'));
  ops.push(textOp(244, PAGE_HEIGHT - 236, `Standard Services ${afeNumber}`, 10, 'F1', '#111827'));

  // Amount panel.
  const amountX = 326;
  const amountY = PAGE_HEIGHT - 282;
  ops.push(rectFill(amountX, amountY, 250, 136, '#e6e6e6'));
  ops.push(textOp(amountX + 12, amountY + 112, 'Invoice Amount', 14, 'F2', '#2b2b2b'));
  ops.push(textOp(amountX + 145, amountY + 110, formatCurrency(total, currency), 16, 'F1', '#2b2b2b'));
  ops.push(textOp(amountX + 198, amountY + 78, currency, 11, 'F2', '#2b2b2b'));
  ops.push(textOp(amountX + 114, amountY + 52, `Invoice Date: ${formatShortDate(invoiceDate)}`, 10, 'F2', '#2b2b2b'));
  ops.push(textOp(amountX + 126, amountY + 32, `Due Date: ${dueDate ? formatShortDate(dueDate) : 'Pending'}`, 10, 'F2', '#2b2b2b'));
  ops.push(textOp(amountX + 135, amountY + 12, 'Terms: Net 30', 10, 'F2', '#2b2b2b'));

  // Table header.
  const tableTop = PAGE_HEIGHT - 320;
  ops.push(rectFill(MARGIN, tableTop - 18, PAGE_WIDTH - (MARGIN * 2), 28, '#e5e7eb'));
  ops.push(textOp(MARGIN + 8, tableTop, 'Item', 10, 'F2', '#111827'));
  ops.push(textOp(338, tableTop, 'Quantity', 10, 'F2', '#111827'));
  ops.push(textOp(424, tableTop, 'Rate', 10, 'F2', '#111827'));
  ops.push(textOp(500, tableTop, `Amount (${currency})`, 10, 'F2', '#111827'));

  let currentY = tableTop - 18;
  itemLines.forEach((item) => {
    const description = asText(item.description || item.Description || 'Line item');
    const descriptionLines = wrapText(description, 56);
    const coding = asText(item.coding || item.Coding || '').trim();
    const rowHeight = Math.max(32, (descriptionLines.length * 12) + (coding ? 10 : 0) + 8);
    const rowBottom = currentY - rowHeight;

    ops.push(line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY, '#e5e7eb', 0.8));
    ops.push(textOp(MARGIN + 6, currentY - 14, descriptionLines[0] || '', 10, 'F1', '#111827'));
    descriptionLines.slice(1).forEach((lineText, index) => {
      ops.push(textOp(MARGIN + 6, currentY - 14 - ((index + 1) * 12), lineText, 10, 'F1', '#111827'));
    });
    if (coding) {
      ops.push(textOp(MARGIN + 6, rowBottom + 8, coding, 8.5, 'F1', '#6b7280'));
    }

    ops.push(textOp(338, currentY - 14, String(item.quantity ?? item.Quantity ?? 1), 10, 'F1', '#111827'));
    ops.push(textOp(424, currentY - 14, formatCurrency(item.unitPrice ?? item.UnitPrice ?? 0, currency), 10, 'F1', '#111827'));
    ops.push(textOp(500, currentY - 14, formatCurrency(item.amount ?? item.Amount ?? 0, currency), 10, 'F1', '#111827'));
    currentY = rowBottom;
  });

  ops.push(line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY, '#d1d5db', 1));

  // Totals box.
  const totalsX = 314;
  const totalsY = 146;
  ops.push(rectFill(totalsX, totalsY, 262, 116, '#ffffff'));
  ops.push(line(totalsX, totalsY + 116, totalsX + 262, totalsY + 116, '#d1d5db', 1));
  ops.push(textOp(totalsX + 20, totalsY + 88, 'Subtotal', 10, 'F2', '#111827'));
  ops.push(textOp(totalsX + 196, totalsY + 88, formatCurrency(subtotal, currency), 10, 'F1', '#111827'));
  ops.push(textOp(totalsX + 20, totalsY + 66, 'Tax', 10, 'F2', '#111827'));
  ops.push(textOp(totalsX + 208, totalsY + 66, formatCurrency(tax, currency), 10, 'F1', '#111827'));
  ops.push(rectFill(totalsX, totalsY + 20, 262, 30, '#e5e7eb'));
  ops.push(textOp(totalsX + 20, totalsY + 38, 'Invoice Amount', 10, 'F2', '#111827'));
  ops.push(textOp(totalsX + 158, totalsY + 38, formatCurrency(total, currency), 10, 'F1', '#111827'));

  // Footer remittance / contact.
  ops.push(line(MARGIN, 112, PAGE_WIDTH - MARGIN, 112, '#9ca3af', 1));
  ops.push(textOp(MARGIN, 100, 'Please Remit To', 10, 'F2', '#111827'));
  ops.push(textOp(MARGIN, 88, `Account Name: ${remitName}`, 9, 'F1', '#111827'));
  ops.push(textOp(MARGIN, 76, 'ACH Routing: 111000614', 9, 'F1', '#111827'));
  ops.push(textOp(MARGIN, 64, 'Wire Routing: 021000021', 9, 'F1', '#111827'));
  ops.push(textOp(MARGIN, 52, 'Account Number: 539300902', 9, 'F1', '#111827'));
  ops.push(textOp(MARGIN, 40, 'JP Morgan Chase Bank, N.A.', 9, 'F1', '#111827'));

  ops.push(textOp(300, 100, 'Lockbox', 10, 'F2', '#111827'));
  ops.push(textOp(300, 88, 'P.O. Box 734962', 9, 'F1', '#111827'));
  ops.push(textOp(300, 76, 'Dallas, TX 75373-4962', 9, 'F1', '#111827'));
  ops.push(textOp(300, 52, 'Questions: billing@invoicelens.com', 9, 'F1', '#111827'));
  ops.push(textOp(300, 40, 'Remittance notifications: remittance@invoicelens.com', 9, 'F1', '#111827'));
  ops.push(textOp(380, 20, '1 of 1', 9, 'F1', '#111827'));
  ops.push('Q');

  return createPdfStream(ops);
}

function createPdfDocument(contentStream) {
  const header = '%PDF-1.4\n';
  const objectBodies = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
  ];

  let body = '';
  const offsets = [0];
  for (const objectBody of objectBodies) {
    offsets.push(Buffer.byteLength(header + body, 'utf8'));
    body += objectBody;
  }

  const xrefStart = Buffer.byteLength(header + body, 'utf8');
  let xref = `xref\n0 ${objectBodies.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, 'utf8');
}

async function main() {
  const entries = await fs.readdir(metadataDir, { withFileTypes: true });
  const metadataFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en-US'));

  await fs.mkdir(pdfDir, { recursive: true });

  for (const fileName of metadataFiles) {
    const metadataPath = path.join(metadataDir, fileName);
    const pdfPath = path.join(pdfDir, fileName.replace(/\.json$/i, '.pdf'));
    const raw = await fs.readFile(metadataPath, 'utf8');
    const meta = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const contentStream = createInvoiceContent(meta);
    const pdf = createPdfDocument(contentStream);
    await fs.writeFile(pdfPath, pdf);
    process.stdout.write(`Generated ${path.relative(repoRoot, pdfPath)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
