import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

interface PuestoTipo {
  id: string;
  departamento: string;
  area: string;
  nivel: string;
  codigo: string;
  puesto: string;
  objetivo: string;
  responsabilidades: string;
}

const emptyForm = {
  departamento: "",
  area: "",
  nivel: "",
  codigo: "",
  puesto: "",
  objetivo: "",
  responsabilidades: "",
};

export default function PuestosTipo() {
  const [puestos, setPuestos] = useState<PuestoTipo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyForm);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "puestos_tipo"), (snap) => {
      setPuestos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PuestoTipo)));
    });
    return unsub;
  }, []);

  const handleAdd = async () => {
    if (!form.puesto.trim()) return;
    try {
      await addDoc(collection(db, "puestos_tipo"), form);
      setForm(emptyForm);
      setDialogOpen(false);
      toast.success("Puesto tipo creado");
    } catch {
      toast.error("Error al crear");
    }
  };

  const handleEdit = async () => {
    if (!editId) return;
    try {
      await updateDoc(doc(db, "puestos_tipo", editId), form);
      setEditDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      toast.success("Puesto actualizado");
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "puestos_tipo", id));
      toast.success("Puesto eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const filtered = puestos.filter((p) =>
    Object.keys(filters).every((key) => {
      const filterVal = filters[key as keyof typeof filters].toLowerCase();
      if (!filterVal) return true;
      return (p[key as keyof PuestoTipo] || "").toString().toLowerCase().includes(filterVal);
    })
  );

  const formFields = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {[
        { key: "departamento", label: "Departamento", placeholder: "Ej: TI" },
        { key: "area", label: "Área", placeholder: "Ej: Desarrollo" },
        { key: "nivel", label: "Nivel", placeholder: "Ej: Senior" },
        { key: "codigo", label: "Código del Puesto", placeholder: "Ej: DEV-001" },
        { key: "puesto", label: "Puesto", placeholder: "Ej: Desarrollador Full Stack" },
      ].map(({ key, label, placeholder }) => (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          <Input
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder}
          />
        </div>
      ))}
      <div className="space-y-2">
        <Label>Objetivo</Label>
        <Textarea
          value={form.objetivo}
          onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
          placeholder="Objetivo del puesto..."
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Responsabilidades</Label>
        <Textarea
          value={form.responsabilidades}
          onChange={(e) => setForm({ ...form, responsabilidades: e.target.value })}
          placeholder="Responsabilidades del puesto..."
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Puestos Tipo</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nuevo Puesto Tipo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuevo Puesto Tipo</DialogTitle></DialogHeader>
            {formFields}
            <Button onClick={handleAdd} className="w-full">Guardar</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { key: "departamento", label: "Departamento" },
          { key: "area", label: "Área" },
          { key: "nivel", label: "Nivel" },
          { key: "codigo", label: "Código" },
          { key: "puesto", label: "Puesto" },
          { key: "objetivo", label: "Objetivo" },
          { key: "responsabilidades", label: "Responsabilidades" },
        ].map(({ key, label }) => (
          <Input
            key={key}
            placeholder={`Filtrar ${label}`}
            value={filters[key as keyof typeof filters]}
            onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            className="text-xs"
          />
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Puesto Tipo</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Actualizar</Button>
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No hay puestos tipo registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead className="w-[100px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.departamento}</TableCell>
                  <TableCell>{p.area}</TableCell>
                  <TableCell>{p.nivel}</TableCell>
                  <TableCell>{p.codigo}</TableCell>
                  <TableCell className="font-medium">{p.puesto}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{p.objetivo}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditId(p.id);
                          setForm({
                            departamento: p.departamento,
                            area: p.area,
                            nivel: p.nivel,
                            codigo: p.codigo,
                            puesto: p.puesto,
                            objetivo: p.objetivo,
                            responsabilidades: p.responsabilidades,
                          });
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
                            <AlertDialogTitle>¿Eliminar puesto tipo?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
