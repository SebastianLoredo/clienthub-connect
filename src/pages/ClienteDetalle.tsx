import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
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
import { ArrowLeft, Plus, Trash2, Pencil, Search, Upload } from "lucide-react";
import SimilitudDialog from "@/components/SimilitudDialog";

interface Puesto {
  id: string;
  nombre: string;
  area: string;
  descripcion: string;
  tecnologias: string;
}

export default function ClienteDetalle() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const [clienteNombre, setClienteNombre] = useState("");
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [similitudPuesto, setSimilitudPuesto] = useState<Puesto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ nombre: "", area: "", descripcion: "", tecnologias: "" });

  useEffect(() => {
    if (!clienteId) return;
    getDoc(doc(db, "clientes", clienteId)).then((snap) => {
      if (snap.exists()) setClienteNombre(snap.data().nombre);
    });

    const unsub = onSnapshot(
      collection(db, "clientes", clienteId, "puestos"),
      (snap) => {
        setPuestos(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Puesto))
        );
      }
    );
    return unsub;
  }, [clienteId]);

  const resetForm = () => setForm({ nombre: "", area: "", descripcion: "", tecnologias: "" });

  const handleAdd = async () => {
    if (!form.nombre.trim() || !clienteId) return;
    try {
      await addDoc(collection(db, "clientes", clienteId, "puestos"), form);
      resetForm();
      setDialogOpen(false);
      toast.success("Puesto agregado");
    } catch {
      toast.error("Error al agregar puesto");
    }
  };

  const handleEdit = async () => {
    if (!editId || !clienteId) return;
    try {
      await updateDoc(doc(db, "clientes", clienteId, "puestos", editId), form);
      setEditDialogOpen(false);
      setEditId(null);
      resetForm();
      toast.success("Puesto actualizado");
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!clienteId) return;
    try {
      await deleteDoc(doc(db, "clientes", clienteId, "puestos", id));
      toast.success("Puesto eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clienteId) return;

    toast.info("Procesando PDF... esto puede tomar unos momentos.");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        // We'll use the edge function for PDF extraction
        const response = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "placeholder"}.supabase.co/functions/v1/extract-pdf`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf: base64 }),
          }
        );
        if (!response.ok) throw new Error("Error procesando PDF");
        const data = await response.json();
        if (data.puestos && Array.isArray(data.puestos)) {
          for (const p of data.puestos) {
            await addDoc(collection(db, "clientes", clienteId, "puestos"), {
              nombre: p.nombre || "",
              area: p.area || "",
              descripcion: p.descripcion || "",
              tecnologias: p.tecnologias || "",
            });
          }
          toast.success(`${data.puestos.length} puestos extraídos del PDF`);
        } else {
          toast.warning("No se encontraron puestos en el PDF");
        }
      } catch {
        toast.error("Error al procesar el PDF. Asegúrate de tener configurada la función de extracción.");
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre del Puesto</Label>
        <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Desarrollador Web" />
      </div>
      <div className="space-y-2">
        <Label>Área</Label>
        <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Ej: Tecnología" />
      </div>
      <div className="space-y-2">
        <Label>Descripción del Puesto</Label>
        <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción detallada..." rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Tecnologías</Label>
        <Input value={form.tecnologias} onChange={(e) => setForm({ ...form, tecnologias: e.target.value })} placeholder="Ej: React, Node.js, Python" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/clientes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{clienteNombre}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Agregar Puesto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Puesto</DialogTitle></DialogHeader>
            {formFields}
            <Button onClick={handleAdd} className="w-full">Guardar</Button>
          </DialogContent>
        </Dialog>

        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          onChange={handlePdfUpload}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />Cargar PDF
        </Button>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Puesto</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Actualizar</Button>
        </DialogContent>
      </Dialog>

      {puestos.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No hay puestos registrados para este cliente.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Puesto</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tecnologías</TableHead>
              <TableHead className="w-[200px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {puestos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell>{p.area}</TableCell>
                <TableCell>{p.tecnologias}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setSimilitudPuesto(p)}>
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditId(p.id);
                        setForm({
                          nombre: p.nombre,
                          area: p.area,
                          descripcion: p.descripcion,
                          tecnologias: p.tecnologias,
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
                          <AlertDialogTitle>¿Eliminar puesto?</AlertDialogTitle>
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
      )}

      {similitudPuesto && (
        <SimilitudDialog
          puesto={similitudPuesto}
          open={!!similitudPuesto}
          onClose={() => setSimilitudPuesto(null)}
        />
      )}
    </div>
  );
}
