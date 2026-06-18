import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface UserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: Date | null;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-MX", { dateStyle: "medium" });
}

export default function Usuarios() {
  const { user, updateName, isAdmin } = useAuth();
  const [nombre, setNombre] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(
        snap.docs.map((d) => {
          const data = d.data() as {
            email?: string | null;
            displayName?: string | null;
            role?: string;
            createdAt?: Timestamp | null;
          };
          return {
            id: d.id,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            role: data.role ?? "user",
            createdAt: data.createdAt ? data.createdAt.toDate() : null,
          };
        }),
      );
    });
    return unsub;
  }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateName(nombre.trim());
      toast.success("Nombre actualizado");
    } catch {
      toast.error("No se pudo actualizar el nombre");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (u: UserRow, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", u.id), { role: newRole });
      void logAudit("user_role_change", { targetEmail: u.email, newRole });
      toast.success(`Rol actualizado a ${newRole}`);
    } catch {
      toast.error("No se pudo actualizar el rol");
    }
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.displayName ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Mi perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Todos los usuarios ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-4 max-w-md"
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead className="w-[160px]">Rol</TableHead>
                    <TableHead className="w-[140px]">Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No hay usuarios.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((u) => {
                      const isSelf = u.id === user?.uid;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>{u.displayName || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.email || "—"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(v) => handleRoleChange(u, v)}
                              disabled={isSelf}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">user</SelectItem>
                                <SelectItem value="admin">admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(u.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
