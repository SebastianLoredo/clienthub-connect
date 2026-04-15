import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import * as ExcelJS from "exceljs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadReporteExcel, triggerBlobDownload } from "@/lib/reports/storage";

interface Puesto {
  id: string;
  nombre: string;
  area: string;
  descripcion: string;
  tecnologias: string;
}

interface PuestoTipo {
  id: string;
  puesto: string;
  departamento: string;
  area: string;
  nivel: string;
  objetivo: string;
  responsabilidades: string;
}

interface Similitud {
  puestoTipo: PuestoTipo;
  porcentaje: number;
  razon: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  puestos: Puesto[];
  clienteId: string;
  clienteNombre: string;
}

function top3(similitudes: Similitud[]): Similitud[] {
  return [...similitudes].sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 3);
}

export default function GenerarReporteDialog({ open, onClose, puestos, clienteId, clienteNombre }: Props) {
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [similitudesPorPuesto, setSimilitudesPorPuesto] = useState<Record<string, Similitud[]>>({});
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || puestos.length === 0) return;
    fetchSimilitudes();
  }, [open]);

  const fetchSimilitudes = async () => {
    setLoading(true);
    setSimilitudesPorPuesto({});
    setSelecciones({});
    try {
      const snap = await getDocs(collection(db, "puestos_tipo"));
      const puestosTipo = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PuestoTipo));
      if (puestosTipo.length === 0) {
        toast.warning("No hay puestos tipo para comparar.");
        setLoading(false);
        return;
      }

      const result: Record<string, Similitud[]> = {};
      for (const p of puestos) {
        const { data, error } = await supabase.functions.invoke("buscar-similitudes", {
          body: {
            puestoCliente: {
              nombre: p.nombre,
              area: p.area,
              descripcion: p.descripcion,
              tecnologias: p.tecnologias,
            },
            puestosTipo: puestosTipo.map((pt) => ({
              id: pt.id,
              puesto: pt.puesto,
              departamento: pt.departamento,
              area: pt.area,
              nivel: pt.nivel,
              objetivo: pt.objetivo,
              responsabilidades: pt.responsabilidades,
            })),
          },
        });
        if (error) throw error;
        result[p.id] = (data?.similitudes || []) as Similitud[];
      }
      setSimilitudesPorPuesto(result);
    } catch (e) {
      console.error("Error fetching similitudes:", e);
      toast.error("Error al buscar similitudes.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccion = (puestoId: string, puestoTipoId: string) => {
    setSelecciones((prev) => ({ ...prev, [puestoId]: puestoTipoId }));
  };

  const handleGenerar = async () => {
    const seleccionados = Object.entries(selecciones);
    if (seleccionados.length === 0) {
      toast.error("Selecciona al menos un puesto tipo por fila.");
      return;
    }

    setGenerando(true);
    try {
      const rows = seleccionados.map(([puestoId, puestoTipoId], idx) => {
        const sims = similitudesPorPuesto[puestoId] || [];
        const selected = sims.find((s) => s.puestoTipo.id === puestoTipoId);
        return {
          num: idx + 1,
          area: selected?.puestoTipo.area || "",
          puesto: selected?.puestoTipo.puesto || "",
        };
      });

      // Load template
      const resp = await fetch("/templates/reporte_template.xlsx");
      const templateBuf = await resp.arrayBuffer();
      
      // Create new ExcelJS workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(templateBuf);

      // --- Sheet 1: COMPETITIVIDAD ---
      const worksheet1 = workbook.getWorksheet('COMPETITIVIDAD');
      const SHEET1_DATA_START = 23; // row 23 in template (1-indexed)
      const SHEET1_EXAMPLE_ROWS = 20;

      // Clear example data rows (B23:I42) and write selected rows
      for (let r = SHEET1_DATA_START; r < SHEET1_DATA_START + SHEET1_EXAMPLE_ROWS; r++) {
        const cols = ["B", "C", "D", "E", "F", "G", "H", "I"];
        cols.forEach((c) => {
          const cell = worksheet1.getCell(`${c}${r}`);
          cell.value = null;
        });
      }

      // Write selected rows
      rows.forEach((row, i) => {
        const r = SHEET1_DATA_START + i;
        worksheet1.getCell(`B${r}`).value = row.num;
        worksheet1.getCell(`C${r}`).value = row.area;
        worksheet1.getCell(`D${r}`).value = row.puesto;
        // E-I left empty for now (25P, 50P, Promedio, 75P, Varianza)
      });

      // --- Sheet 2: COMPENSACIÓN TOTAL ---
      const worksheet2 = workbook.getWorksheet('COMPENSACIÓN TOTAL');
      
      // Clear summary table (rows 56-75, cols B-H)
      for (let r = 56; r <= 75; r++) {
        ["B", "C", "D", "E", "F", "G", "H"].forEach((c) => {
          const cell = worksheet2.getCell(`${c}${r}`);
          cell.value = null;
        });
      }
      // Write summary rows
      rows.forEach((row, i) => {
        const r = 56 + i;
        worksheet2.getCell(`B${r}`).value = row.num;
        worksheet2.getCell(`C${r}`).value = row.area;
        worksheet2.getCell(`D${r}`).value = row.puesto;
      });

      // Clear detail table (rows 87-106, cols B-P)
      for (let r = 87; r <= 106; r++) {
        ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"].forEach((c) => {
          const cell = worksheet2.getCell(`${c}${r}`);
          cell.value = null;
        });
      }
      // Write detail rows
      rows.forEach((row, i) => {
        const r = 87 + i;
        worksheet2.getCell(`B${r}`).value = row.num;
        worksheet2.getCell(`C${r}`).value = row.area;
        worksheet2.getCell(`D${r}`).value = row.puesto;
      });

      // Generate Excel buffer using ExcelJS
      const excelBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fileName = `Reporte - ${clienteNombre}.xlsx`;
      await uploadReporteExcel({ clienteId, clienteNombre, fileName, excelBlob: blob });
      triggerBlobDownload(blob, fileName);
      toast.success("Reporte generado y guardado.");
      onClose();
    } catch (e) {
      console.error("Error generando reporte:", e);
      toast.error("No se pudo generar el reporte.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Reporte</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Buscando similitudes para todos los puestos...</span>
          </div>
        ) : Object.keys(similitudesPorPuesto).length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No se encontraron similitudes.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona un puesto tipo por cada puesto del cliente para incluir en el reporte.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Puesto del Cliente</TableHead>
                  <TableHead>Puesto Tipo 1</TableHead>
                  <TableHead>Puesto Tipo 2</TableHead>
                  <TableHead>Puesto Tipo 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {puestos.map((p) => {
                  const sims = top3(similitudesPorPuesto[p.id] || []);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      {[0, 1, 2].map((i) => {
                        const sim = sims[i];
                        if (!sim) return <TableCell key={i} className="text-muted-foreground">-</TableCell>;
                        return (
                          <TableCell key={i}>
                            <RadioGroup
                              value={selecciones[p.id] || ""}
                              onValueChange={(val) => handleSeleccion(p.id, val)}
                            >
                              <label className="flex items-center gap-2 cursor-pointer">
                                <RadioGroupItem value={sim.puestoTipo.id} />
                                <span className="text-sm">
                                  {sim.puestoTipo.puesto}
                                  <span className="text-muted-foreground ml-1">({sim.porcentaje}%)</span>
                                </span>
                              </label>
                            </RadioGroup>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <Button onClick={handleGenerar} disabled={generando}>
                {generando ? "Generando…" : "Generar Reporte"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
