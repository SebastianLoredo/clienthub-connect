import { useState, useEffect, type CSSProperties } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildReporteIndividualPptx } from "@/lib/reports/pptx";
import { uploadReportePptx, triggerBlobDownload } from "@/lib/reports/storage";


interface PuestoCliente {
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
  puesto: PuestoCliente;
  clienteId: string;
  open: boolean;
  onClose: () => void;
}

/** 0% → rojo (hue 0), 100% → verde (hue 120), valores intermedios en el arco rojo–amarillo–verde. */
function estiloPorcentajeSimilitud(porcentaje: number): CSSProperties {
  const p = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  const hue = (p / 100) * 120;
  return {
    backgroundColor: `hsl(${hue}, 72%, 40%)`,
    color: "#fafafa",
  };
}

export default function SimilitudDialog({ puesto, clienteId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [similitudes, setSimilitudes] = useState<Similitud[]>([]);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open) return;
    buscarSimilitudes();
  }, [open]);

  const buscarSimilitudes = async () => {
    setLoading(true);
    setSimilitudes([]);

    try {
      const snap = await getDocs(collection(db, "puestos_tipo"));
      const puestosTipo = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PuestoTipo));

      if (puestosTipo.length === 0) {
        toast.warning("No hay puestos tipo registrados para comparar.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("buscar-similitudes", {
        body: {
          puestoCliente: {
            nombre: puesto.nombre,
            area: puesto.area,
            descripcion: puesto.descripcion,
            tecnologias: puesto.tecnologias,
          },
          puestosTipo: puestosTipo.map((p) => ({
            id: p.id,
            puesto: p.puesto,
            departamento: p.departamento,
            area: p.area,
            nivel: p.nivel,
            objetivo: p.objetivo,
            responsabilidades: p.responsabilidades,
          })),
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Error al buscar similitudes con IA.");
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      setSimilitudes(data.similitudes || []);
    } catch (e) {
      console.error("Error buscando similitudes:", e);
      toast.error("Error al buscar similitudes.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarReporte = async () => {
    if (!clienteId) return;
    if (similitudes.length === 0) {
      toast.error("No hay similitudes para generar el reporte.");
      return;
    }
    setGenerando(true);
    try {
      // Get client name from Firestore
      const clienteDoc = await getDoc(doc(db, "clientes", clienteId));
      const clienteNombre = (clienteDoc.data() as any)?.nombre || "Cliente";

      const pptx = buildReporteIndividualPptx(puesto, similitudes);
      const fileName = `Comparativa - ${puesto.nombre}.pptx`;
      const blob = (await pptx.write({ outputType: "blob" })) as Blob;
      await uploadReportePptx({
        clienteId,
        clienteNombre,
        type: "individual",
        fileName,
        pptxBlob: blob,
        puesto: { id: puesto.id, nombre: puesto.nombre },
      });
      triggerBlobDownload(blob, fileName);
      toast.success("Reporte individual generado.");
    } catch (e) {
      console.error("Error generando reporte individual:", e);
      toast.error("No se pudo generar el reporte.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Similitudes para: {puesto.nombre}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Analizando con IA...</span>
          </div>
        ) : similitudes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No se encontraron puestos tipo similares.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={handleGenerarReporte} disabled={generando}>
                {generando ? "Generando…" : "Generar comparativa"}
              </Button>
            </div>
            {similitudes.map((s, i) => (
              <div
                key={i}
                className="flex items-start justify-between rounded-lg border p-4 gap-4"
              >
                <div className="space-y-1 flex-1">
                  <p className="font-medium">{s.puestoTipo.puesto}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.puestoTipo.departamento} · {s.puestoTipo.area} · {s.puestoTipo.nivel}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.razon}</p>
                </div>
                <Badge
                  variant="secondary"
                  className="text-lg px-3 py-1 shrink-0 border-0 shadow-none hover:opacity-95"
                  style={estiloPorcentajeSimilitud(s.porcentaje)}
                >
                  {s.porcentaje}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
