import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { downloadReporte, deleteReporte, triggerBlobDownload } from "@/lib/reports/storage";
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
import { FileSpreadsheet, Download, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Reporte {
  id: string;
  type: string;
  fileName: string;
  storagePath: string | null;
  createdAt?: any;
}

export default function ReportesExcel() {
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clientes"), (snap) => {
      setClientes(snap.docs.map((d) => ({ id: d.id, nombre: (d.data() as any).nombre || "" })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedCliente) return;
    const q = query(
      collection(db, "clientes", selectedCliente.id, "reportes_excel"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReportes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsub;
  }, [selectedCliente?.id]);

  const handleDownload = async (r: Reporte) => {
    if (!r.storagePath) return;
    try {
      const blob = await downloadReporte(r.storagePath);
      triggerBlobDownload(blob, r.fileName);
    } catch {
      toast.error("No se pudo descargar el reporte.");
    }
  };

  const handleDelete = async (r: Reporte) => {
    if (!selectedCliente) return;
    try {
      await deleteReporte(selectedCliente.id, r.id, r.storagePath, "reportes_excel");
      toast.success("Reporte eliminado.");
    } catch {
      toast.error("No se pudo eliminar el reporte.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      {!selectedCliente ? (
        clientes.length === 0 ? (
          <p className="text-muted-foreground">No hay clientes registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCliente(c)}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
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
              <FileSpreadsheet className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{selectedCliente.nombre}</h2>
            </div>
          </div>

          {reportes.length === 0 ? (
            <p className="text-muted-foreground">No hay reportes generados para este cliente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.fileName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.createdAt?.toDate
                        ? r.createdAt.toDate().toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(r)} disabled={!r.storagePath}>
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
                              Se eliminará "{r.fileName}" permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(r)}>Eliminar</AlertDialogAction>
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
