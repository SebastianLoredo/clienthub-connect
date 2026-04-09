import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, ArrowLeft } from "lucide-react";

export default function Reportes() {
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [reportes, setReportes] = useState<
    {
      id: string;
      type: "general" | "individual";
      fileName: string;
      downloadUrl: string | null;
      puestoNombre: string | null;
      createdAt?: any;
    }[]
  >([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clientes"), (snap) => {
      setClientes(snap.docs.map((d) => ({ id: d.id, nombre: (d.data() as any).nombre || "" })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedCliente) return;
    const q = query(
      collection(db, "clientes", selectedCliente.id, "reportes"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReportes(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any,
      );
    });
    return unsub;
  }, [selectedCliente?.id]);

  const reportesOrdenados = useMemo(() => {
    const r = [...reportes];
    const rank = (t: string) => (t === "general" ? 0 : 1);
    r.sort((a, b) => {
      const ra = rank(a.type);
      const rb = rank(b.type);
      if (ra !== rb) return ra - rb;
      return 0;
    });
    return r;
  }, [reportes]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      {!selectedCliente ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => setSelectedCliente(c)}
              >
                <TableCell className="font-medium">{c.nombre}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCliente(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{selectedCliente.nombre}</h2>
            </div>
          </div>

          {reportesOrdenados.length === 0 ? (
            <p className="text-muted-foreground">Aún no hay reportes generados para este cliente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead className="text-right">Descargar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportesOrdenados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.type === "general" ? "General" : "Individual"}
                    </TableCell>
                    <TableCell>{r.fileName}</TableCell>
                    <TableCell>{r.puestoNombre || "-"}</TableCell>
                    <TableCell className="text-right">
                      {r.downloadUrl ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={r.downloadUrl} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Descargar
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
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
