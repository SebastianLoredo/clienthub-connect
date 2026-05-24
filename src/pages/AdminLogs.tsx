import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  userEmail: string | null;
  userName: string | null;
  userId: string | null;
  timestamp: Date | null;
  details: Record<string, unknown>;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "medium" });
}

export default function AdminLogs() {
  const { isAdmin, loading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(
        snap.docs.map((d) => {
          const data = d.data() as {
            action: string;
            userEmail?: string | null;
            userName?: string | null;
            userId?: string | null;
            timestamp?: Timestamp | null;
            details?: Record<string, unknown>;
          };
          return {
            id: d.id,
            action: data.action,
            userEmail: data.userEmail ?? null,
            userName: data.userName ?? null,
            userId: data.userId ?? null,
            timestamp: data.timestamp ? data.timestamp.toDate() : null,
            details: data.details ?? {},
          };
        }),
      );
    });
    return unsub;
  }, [isAdmin]);

  if (loading) return <p className="text-muted-foreground">Cargando...</p>;
  if (!isAdmin) return <Navigate to="/dashboard/clientes" replace />;

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(s) ||
      (l.userEmail ?? "").toLowerCase().includes(s) ||
      (l.userName ?? "").toLowerCase().includes(s) ||
      JSON.stringify(l.details).toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Logs de Auditoría</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas {logs.length} acciones registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por acción, usuario o detalles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-md"
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Fecha</TableHead>
                  <TableHead className="w-[200px]">Usuario</TableHead>
                  <TableHead className="w-[200px]">Acción</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No hay registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(l.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{l.userName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{l.userEmail || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{l.action}</code>
                      </TableCell>
                      <TableCell>
                        <pre className="text-xs whitespace-pre-wrap break-all text-muted-foreground max-w-md">
                          {Object.keys(l.details).length
                            ? JSON.stringify(l.details, null, 0)
                            : "—"}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
