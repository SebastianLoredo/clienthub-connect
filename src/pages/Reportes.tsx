import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadReporte, deleteReporte } from "@/lib/reports/storage";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Download, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Reporte {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  type: "general" | "individual";
  file_name: string;
  puesto_nombre: string | null;
  storage_path: string | null;
  created_at: string;
}

export default function Reportes() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);

  const fetchReportes = async () => {
    const { data, error } = await supabase
      .from("reportes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setReportes(data as unknown as Reporte[]);
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    reportes.forEach((r) => map.set(r.cliente_id, r.cliente_nombre));
    return Array.from(map, ([id, nombre]) => ({ id, nombre }));
  }, [reportes]);

  const reportesFiltrados = useMemo(() => {
    if (!selectedCliente) return [];
    return reportes
      .filter((r) => r.cliente_id === selectedCliente)
      .sort((a, b) => {
        const rank = (t: string) => (t === "general" ? 0 : 1);
        return rank(a.type) - rank(b.type);
      });
  }, [reportes, selectedCliente]);

  const handleDownload = async (r: Reporte) => {
    if (!r.storage_path) return;
    try {
      const blob = await downloadReporte(r.storage_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error descargando reporte:", e);
      toast.error("No se pudo descargar el reporte.");
    }
  };

  const handleDelete = async (r: Reporte) => {
    try {
      await deleteReporte(r.id, r.storage_path);
      setReportes((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Reporte eliminado.");
    } catch (e) {
      console.error("Error eliminando reporte:", e);
      toast.error("No se pudo eliminar el reporte.");
    }
  };

  const selectedClienteNombre = clientes.find((c) => c.id === selectedCliente)?.nombre;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      {!selectedCliente ? (
        clientes.length === 0 ? (
          <p className="text-muted-foreground">No hay reportes generados aún.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Reportes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedCliente(c.id)}
                >
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {reportes.filter((r) => r.cliente_id === c.id).length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCliente(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{selectedClienteNombre}</h2>
            </div>
          </div>

          {reportesFiltrados.length === 0 ? (
            <p className="text-muted-foreground">No hay reportes para este cliente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportesFiltrados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.type === "general" ? "General" : "Individual"}
                    </TableCell>
                    <TableCell>{r.file_name}</TableCell>
                    <TableCell>{r.puesto_nombre || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.created_at).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(r)}
                        disabled={!r.storage_path}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar reporte?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará el archivo "{r.file_name}" permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(r)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
