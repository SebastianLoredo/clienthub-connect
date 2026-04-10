import PptxGenJS from "pptxgenjs";

export type PuestoCliente = {
  id: string;
  nombre: string;
  area: string;
  descripcion: string;
  tecnologias: string;
};

export type PuestoTipo = {
  id: string;
  puesto: string;
  departamento: string;
  area: string;
  nivel: string;
  objetivo: string;
  responsabilidades: string;
};

export type Similitud = {
  puestoTipo: PuestoTipo;
  porcentaje: number;
  razon: string;
};

function top3(similitudes: Similitud[]): Similitud[] {
  return [...similitudes].sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 3);
}

function cellText(value: string | undefined | null): string {
  const v = (value ?? "").toString().trim();
  return v.length ? v : "-";
}

/**
 * Genera 1 slide con tabla de 3 columnas (hasta 3 puestos tipo).
 * Fila 1: "Descripción del puesto" (usa `objetivo` del puesto tipo)
 * Fila 2: "Responsabilidades" (usa `responsabilidades` del puesto tipo)
 */
export function buildReporteIndividualPptx(puesto: PuestoCliente, similitudes: Similitud[]) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const slide = pptx.addSlide();
  slide.addText(puesto.nombre, {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "111827",
  });

  const cols = top3(similitudes).map((s) => s.puestoTipo);
  const headers = ["", ...cols.map((c, i) => `Puesto Tipo ${i + 1}`)];
  const row1 = ["Descripción del puesto", ...cols.map((c) => cellText(c.objetivo))];
  const row2 = ["Responsabilidades", ...cols.map((c) => cellText(c.responsabilidades))];

  // tabla: 1 columna de etiquetas + hasta 3 columnas
  const colCount = Math.max(2, headers.length); // mínimo 2 (etiqueta + 1)
  const colW = 12.3 / colCount;

  const tableRows = [headers, row1, row2].map((r) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push("");
    return padded;
  });

  // Render sencillo usando cajas de texto para controlar el layout sin depender de tablas avanzadas.
  const x0 = 0.5;
  const y0 = 1.25;
  const rowH = 1.6;
  const headerH = 0.6;

  // header
  for (let c = 0; c < colCount; c++) {
    slide.addShape(pptx.ShapeType.rect, {
      x: x0 + c * colW,
      y: y0,
      w: colW,
      h: headerH,
      fill: { color: "111827" },
      line: { color: "111827" },
    });
    slide.addText(tableRows[0][c] ?? "", {
      x: x0 + c * colW + 0.1,
      y: y0 + 0.12,
      w: colW - 0.2,
      h: headerH - 0.2,
      fontSize: 14,
      bold: true,
      color: "FFFFFF",
    });
  }

  // body rows
  for (let r = 1; r <= 2; r++) {
    const y = y0 + headerH + (r - 1) * rowH;
    for (let c = 0; c < colCount; c++) {
      slide.addShape(pptx.ShapeType.rect, {
        x: x0 + c * colW,
        y,
        w: colW,
        h: rowH,
        fill: { color: c === 0 ? "F3F4F6" : "FFFFFF" },
        line: { color: "D1D5DB" },
      });
      slide.addText(tableRows[r][c] ?? "", {
        x: x0 + c * colW + 0.12,
        y: y + 0.12,
        w: colW - 0.24,
        h: rowH - 0.24,
        fontSize: c === 0 ? 14 : 12,
        bold: c === 0,
        color: "111827",
        valign: "top",
      });
    }
  }

  return pptx;
}

export function buildReporteGeneralPptx(
  clienteNombre: string,
  puestos: PuestoCliente[],
  similitudesPorPuestoId: Record<string, Similitud[]>,
) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  // Portada opcional muy ligera
  const cover = pptx.addSlide();
  cover.addText("Comparativa General", { x: 0.6, y: 1.6, w: 12.2, h: 0.8, fontSize: 40, bold: true, color: "111827" });
  cover.addText(clienteNombre, { x: 0.6, y: 2.5, w: 12.2, h: 0.6, fontSize: 24, color: "374151" });

  for (const puesto of puestos) {
    const sims = similitudesPorPuestoId[puesto.id] ?? [];
    const s = pptx.addSlide();
    s.addText(puesto.nombre, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: "111827",
    });

    const cols = top3(sims).map((x) => x.puestoTipo);
    const headers = ["", ...cols.map((_, i) => `Puesto Tipo ${i + 1}`)];
    const row1 = ["Descripción del puesto", ...cols.map((c) => cellText(c.objetivo))];
    const row2 = ["Responsabilidades", ...cols.map((c) => cellText(c.responsabilidades))];
    const colCount = Math.max(2, headers.length);
    const colW = 12.3 / colCount;
    const tableRows = [headers, row1, row2].map((r) => {
      const padded = [...r];
      while (padded.length < colCount) padded.push("");
      return padded;
    });
    const x0 = 0.5;
    const y0 = 1.25;
    const rowH = 1.6;
    const headerH = 0.6;

    for (let c = 0; c < colCount; c++) {
      s.addShape(pptx.ShapeType.rect, {
        x: x0 + c * colW,
        y: y0,
        w: colW,
        h: headerH,
        fill: { color: "111827" },
        line: { color: "111827" },
      });
      s.addText(tableRows[0][c] ?? "", {
        x: x0 + c * colW + 0.1,
        y: y0 + 0.12,
        w: colW - 0.2,
        h: headerH - 0.2,
        fontSize: 14,
        bold: true,
        color: "FFFFFF",
      });
    }
    for (let r = 1; r <= 2; r++) {
      const y = y0 + headerH + (r - 1) * rowH;
      for (let c = 0; c < colCount; c++) {
        s.addShape(pptx.ShapeType.rect, {
          x: x0 + c * colW,
          y,
          w: colW,
          h: rowH,
          fill: { color: c === 0 ? "F3F4F6" : "FFFFFF" },
          line: { color: "D1D5DB" },
        });
        s.addText(tableRows[r][c] ?? "", {
          x: x0 + c * colW + 0.12,
          y: y + 0.12,
          w: colW - 0.24,
          h: rowH - 0.24,
          fontSize: c === 0 ? 14 : 12,
          bold: c === 0,
          color: "111827",
          valign: "top",
        });
      }
    }
  }

  return pptx;
}

