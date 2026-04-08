import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

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
  open: boolean;
  onClose: () => void;
}

export default function SimilitudDialog({ puesto, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [similitudes, setSimilitudes] = useState<Similitud[]>([]);

  useEffect(() => {
    if (!open) return;
    buscarSimilitudes();
  }, [open]);

  const buscarSimilitudes = async () => {
    setLoading(true);
    setSimilitudes([]);

    try {
      // Fetch all puestos tipo
      const snap = await getDocs(collection(db, "puestos_tipo"));
      const puestosTipo = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PuestoTipo));

      if (puestosTipo.length === 0) {
        setLoading(false);
        return;
      }

      // Use simple text similarity (Jaccard-like) as fallback
      // In production, this would call an LLM edge function
      const results: Similitud[] = puestosTipo
        .map((pt) => {
          const score = calcularSimilitud(puesto, pt);
          return {
            puestoTipo: pt,
            porcentaje: score,
            razon: `Comparación basada en nombre, área y descripción`,
          };
        })
        .filter((s) => s.porcentaje > 10)
        .sort((a, b) => b.porcentaje - a.porcentaje)
        .slice(0, 10);

      setSimilitudes(results);
    } catch {
      console.error("Error buscando similitudes");
    } finally {
      setLoading(false);
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
            <span className="ml-2 text-muted-foreground">Buscando similitudes...</span>
          </div>
        ) : similitudes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No se encontraron puestos tipo similares. Asegúrate de tener puestos tipo registrados.
          </p>
        ) : (
          <div className="space-y-3">
            {similitudes.map((s) => (
              <div
                key={s.puestoTipo.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{s.puestoTipo.puesto}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.puestoTipo.departamento} · {s.puestoTipo.area} · {s.puestoTipo.nivel}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.razon}</p>
                </div>
                <Badge
                  variant={s.porcentaje >= 70 ? "default" : "secondary"}
                  className="text-lg px-3 py-1"
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

function calcularSimilitud(
  puesto: { nombre: string; area: string; descripcion: string; tecnologias: string },
  tipo: PuestoTipo
): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\W+/)
      .filter((w) => w.length > 2);

  const puestoWords = new Set([
    ...normalize(puesto.nombre),
    ...normalize(puesto.area),
    ...normalize(puesto.descripcion),
    ...normalize(puesto.tecnologias),
  ]);

  const tipoWords = new Set([
    ...normalize(tipo.puesto),
    ...normalize(tipo.area),
    ...normalize(tipo.departamento),
    ...normalize(tipo.objetivo),
    ...normalize(tipo.responsabilidades),
  ]);

  if (puestoWords.size === 0 || tipoWords.size === 0) return 0;

  let intersection = 0;
  puestoWords.forEach((w) => {
    if (tipoWords.has(w)) intersection++;
  });

  const union = new Set([...puestoWords, ...tipoWords]).size;
  return Math.round((intersection / union) * 100);
}
