import "server-only";
import { inflateRawSync } from "node:zlib";

// Minimal .xlsx reader and writer (an .xlsx file is a zip of XML parts), so
// the stock import needs no spreadsheet library. Reads cell values only:
// formulas give their last calculated value, dates stay Excel serial numbers.

export type Cell = string | number | null;
export type SheetRow = { n: number; cells: Cell[] };
export type Sheet = { name: string; rows: SheetRow[] };

export class SpreadsheetError extends Error {}

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------

function unzip(buf: Buffer) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError("This is not an Excel .xlsx file.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new SpreadsheetError("The file is damaged.");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLength);
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    entries.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new SpreadsheetError("The file uses an unsupported compression.");
    });
  }
  return entries;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer) {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip with stored (uncompressed) entries. */
function zip(files: [string, string][]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12); // 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Text of an <si> / <is> element: every <t>, without phonetic runs. */
const richText = (xml: string) =>
  decode([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

const columnIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

export function readXlsx(buf: Buffer): Sheet[] {
  const files = unzip(buf);
  const text = (path: string) => files.get(path)?.().toString("utf8");
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new SpreadsheetError("This is not an Excel .xlsx file.");
  const rels = text("xl/_rels/workbook.xml.rels") ?? "";
  const targets = new Map(
    [...rels.matchAll(/<Relationship\b([^>]*)>/g)].map((m) => [attr(m[1], "Id"), attr(m[1], "Target")]),
  );
  const sharedXml = text("xl/sharedStrings.xml") ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => richText(m[1]));

  return [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const name = decode(attr(m[1], "name") ?? "Sheet");
    const target = targets.get(attr(m[1], "r:id")) ?? "";
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const xml = text(path) ?? "";
    const rows: SheetRow[] = [];
    let rowNumber = 0;
    for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      rowNumber = Number(attr(r[1], "r")) || rowNumber + 1;
      const cells: Cell[] = [];
      let col = -1;
      for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], "r");
        col = ref ? columnIndex(ref) : col + 1;
        const type = attr(c[1], "t");
        const body = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value: Cell = null;
        if (type === "s") value = v === undefined ? null : (shared[Number(v)] ?? null);
        else if (type === "inlineStr") value = richText(body);
        else if (type === "str") value = v === undefined ? null : decode(v);
        else if (type === "e") value = null;
        else if (v !== undefined) value = Number.isFinite(Number(v)) ? Number(v) : decode(v);
        if (typeof value === "string" && !value.trim()) value = null;
        cells[col] = value;
      }
      if (cells.some((c) => c !== null && c !== undefined)) {
        rows.push({ n: rowNumber, cells: Array.from(cells, (c) => c ?? null) });
      }
    }
    return { name, rows };
  });
}

/** A CSV file (e.g. "Save as CSV" from Excel) as a single sheet. */
export function readCsv(text: string, name = "CSV"): Sheet {
  const rows: SheetRow[] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  let n = 1;
  const pushRow = () => {
    row.push(field);
    field = "";
    const cells = row.map((c) => (c.trim() ? c : null));
    if (cells.some((c) => c !== null)) rows.push({ n, cells });
    row = [];
    n++;
  };
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") pushRow();
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) pushRow();
  return { name, rows };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const columnName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export type SheetSpec = { name: string; rows: Cell[][]; widths?: number[] };

/** Workbook whose first row on every sheet is a bold, frozen header. */
export function writeXlsx(sheets: SheetSpec[]) {
  const sheetXml = (s: SheetSpec) => {
    const cols = s.widths?.length
      ? `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
      : "";
    const rows = s.rows
      .map((row, r) => {
        const cells = row
          .map((v, c) => {
            if (v === null || v === "") return "";
            const ref = `${columnName(c)}${r + 1}`;
            const style = r === 0 ? ' s="1"' : "";
            return typeof v === "number"
              ? `<c r="${ref}"${style}><v>${v}</v></c>`
              : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `${cols}<sheetData>${rows}</sheetData></worksheet>`
    );
  };
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        `</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${ns} xmlns:r="${rel}"><sheets>` +
        sheets.map((s, i) => `<sheet name="${escape(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${ns}>` +
        `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
        `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill></fills>` +
        `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
        `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
        `</styleSheet>`,
    ],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zip(files);
}
