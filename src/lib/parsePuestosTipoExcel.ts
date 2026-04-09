import * as XLSX from "xlsx";

export type PuestoTipoImportRow = {
  departamento: string;
  area: string;
  nivel: string;
  codigo: string;
  puesto: string;
  objetivo: string;
  responsabilidades: string;
};

function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Encabezado normalizado → campo (solo la primera columna que coincida por campo). */
function mapHeaderToField(normalized: string): keyof PuestoTipoImportRow | null {
  const exact: Record<string, keyof PuestoTipoImportRow> = {
    departamento: "departamento",
    depto: "departamento",
    dpto: "departamento",
    department: "departamento",
    area: "area",
    nivel: "nivel",
    level: "nivel",
    grado: "nivel",
    codigo: "codigo",
    clave: "codigo",
    code: "codigo",
    "codigo del puesto": "codigo",
    "codigo puesto": "codigo",
    puesto: "puesto",
    nombre: "puesto",
    "nombre del puesto": "puesto",
    "nombre puesto": "puesto",
    titulo: "puesto",
    title: "puesto",
    "job title": "puesto",
    position: "puesto",
    cargo: "puesto",
    objetivo: "objetivo",
    objective: "objetivo",
    proposito: "objetivo",
    responsabilidades: "responsabilidades",
    responsibilities: "responsabilidades",
    funciones: "responsabilidades",
    duties: "responsabilidades",
  };

  if (exact[normalized]) return exact[normalized];

  if (normalized.includes("depart") && !normalized.includes("puesto")) return "departamento";
  if (normalized === "área" || (normalized.startsWith("area") && normalized.length <= 6))
    return "area";
  if (normalized.includes("responsabil") || normalized.includes("funcion"))
    return "responsabilidades";
  if (normalized.includes("objetiv") || normalized.includes("objective")) return "objetivo";
  if (normalized.includes("codigo") || normalized.includes("código") || normalized === "code")
    return "codigo";
  if (normalized.includes("puesto") || normalized.includes("cargo") || normalized.includes("titulo"))
    return "puesto";
  if (normalized.includes("nivel") || normalized === "level") return "nivel";

  return null;
}

function cellValue(row: unknown[], colIndex: number | undefined): string {
  if (colIndex === undefined || colIndex < 0) return "";
  const v = row[colIndex];
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v);
  }
  return String(v).trim();
}

/**
 * Lee la primera hoja de un .xlsx/.xls.
 * Fila 1 = encabezados. Se importan filas con "puesto" no vacío.
 */
export function parsePuestosTipoExcel(arrayBuffer: ArrayBuffer): PuestoTipoImportRow[] {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];

  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!matrix.length) return [];

  const headerRow = (matrix[0] || []).map((c) => String(c ?? ""));
  const colIndex: Partial<Record<keyof PuestoTipoImportRow, number>> = {};

  headerRow.forEach((h, i) => {
    const field = mapHeaderToField(normalizeHeader(h));
    if (field !== null && colIndex[field] === undefined) {
      colIndex[field] = i;
    }
  });

  const out: PuestoTipoImportRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;

    const item: PuestoTipoImportRow = {
      departamento: cellValue(row, colIndex.departamento),
      area: cellValue(row, colIndex.area),
      nivel: cellValue(row, colIndex.nivel),
      codigo: cellValue(row, colIndex.codigo),
      puesto: cellValue(row, colIndex.puesto),
      objetivo: cellValue(row, colIndex.objetivo),
      responsabilidades: cellValue(row, colIndex.responsabilidades),
    };

    if (!item.puesto.trim()) continue;
    out.push(item);
  }

  return out;
}
