import { useState, useEffect } from "react";
import { FirebaseError } from "firebase/app";
import { collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

interface Cliente {
  id: string;
  nombre: string;
  createdAt: Date;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clientes"), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        nombre: d.data().nombre,
        createdAt: d.data().createdAt?.toDate() || new Date(),
      }));
      setClientes(data);
    });
    return unsub;
  }, []);

  const handleAdd = async () => {
    if (!nombre.trim()) return;
    try {
      await addDoc(collection(db, "clientes"), {
        nombre: nombre.trim(),
        createdAt: new Date(),
      });
      setNombre("");
      setDialogOpen(false);
      toast.success("Cliente creado exitosamente");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "unknown";
      toast.error(`Error al crear el cliente (${code})`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "clientes", id));
      toast.success("Cliente eliminado");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "unknown";
      toast.error(`Error al eliminar el cliente (${code})`);
    }
  };

  const handleEdit = async () => {
    if (!editId || !editNombre.trim()) return;
    try {
      await updateDoc(doc(db, "clientes", editId), { nombre: editNombre.trim() });
      setEditDialogOpen(false);
      setEditId(null);
      toast.success("Cliente actualizado");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "unknown";
      toast.error(`Error al actualizar (${code})`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Clientes</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nuevo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del Cliente</Label>
                <Input
                  placeholder="Ej: Towa Software"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <Button onClick={handleAdd} className="w-full">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del Cliente</Label>
              <Input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
            <Button onClick={handleEdit} className="w-full">Actualizar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {clientes.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No hay clientes registrados.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-[180px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => navigate(`/dashboard/clientes/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/dashboard/clientes/${c.id}`);
                  }
                }}
                tabIndex={0}
                aria-label={`Ver detalle de ${c.nombre}`}
              >
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditId(c.id);
                        setEditNombre(c.nombre);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
