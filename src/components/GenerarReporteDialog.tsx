import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
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
      // Build rows from selections
      const rows = seleccionados.map(([puestoId, puestoTipoId], idx) => {
        const sims = similitudesPorPuesto[puestoId] || [];
        const selected = sims.find((s) => s.puestoTipo.id === puestoTipoId);
        return {
          num: idx + 1,
          area: selected?.puestoTipo.area || "",
          puesto: selected?.puestoTipo.puesto || "",
        };
      });

      const sheetData = [
        ["#", "Área", "Puesto", "25P", "50P", "Promedio", "75P", "Varianza en mercado"],
        ...rows.map((r) => [r.num, r.area, r.puesto, "", "", "", "", ""]),
      ];

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(sheetData);
      const ws2 = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths
      const colWidths = [5, 20, 30, 10, 10, 12, 10, 18].map((w) => ({ wch: w }));
      ws1["!cols"] = colWidths;
      ws2["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws1, "Hoja 1");
      XLSX.utils.book_append_sheet(wb, ws2, "Hoja 2");

      const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([xlsxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fileName = `Reporte - ${clienteNombre}.xlsx`;
      await uploadReporteExcel({
        clienteId,
        clienteNombre,
        fileName,
        excelBlob: blob,
      });
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
