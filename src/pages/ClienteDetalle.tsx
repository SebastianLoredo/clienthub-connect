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
import { supabase } from "@/integrations/supabase/client";
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
import GenerarReporteDialog from "@/components/GenerarReporteDialog";
import { buildReporteGeneralPptx, type Similitud as SimilitudIA, type PuestoTipo as PuestoTipoIA } from "@/lib/reports/pptx";
import { uploadReportePptx, triggerBlobDownload } from "@/lib/reports/storage";

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
  const [reporteDialogOpen, setReporteDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generandoGeneral, setGenerandoGeneral] = useState(false);

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
        const { data, error } = await supabase.functions.invoke("extract-pdf", {
          body: { pdf: base64 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.nombre) {
          await addDoc(collection(db, "clientes", clienteId, "puestos"), {
            nombre: data.nombre || "",
            area: data.area || "",
            descripcion: data.descripcion || "",
            tecnologias: data.tecnologias || "",
          });
          toast.success("Puesto extraído del PDF");
        } else {
          toast.warning("No se encontró información del puesto en el PDF");
        }
      } catch {
        toast.error("Error al procesar el PDF. Asegúrate de tener configurada la función de extracción.");
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerarReporteGeneral = async () => {
    if (!clienteId) return;
    if (puestos.length === 0) {
      toast.error("Este cliente no tiene puestos para generar el reporte.");
      return;
    }
    setGenerandoGeneral(true);
    try {
      // Cache puestos tipo 1 sola vez
      const snap = await (await import("firebase/firestore")).getDocs(collection(db, "puestos_tipo"));
      const puestosTipo = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PuestoTipoIA));
      if (puestosTipo.length === 0) {
        toast.error("No hay puestos tipo para comparar.");
        return;
      }

      const similitudesPorPuestoId: Record<string, SimilitudIA[]> = {};
      for (const p of puestos) {
        const { data, error } = await supabase.functions.invoke("buscar-similitudes", {
          body: {
            puestoCliente: {
              nombre: p.nombre,
              area: p.area,
              descripcion: p.descripcion,
              tecnologias: p.tecnologias,
            },
            puestosTipo: puestosTipo.map((pt) => ({
              id: pt.id,
              puesto: pt.puesto,
              departamento: pt.departamento,
              area: pt.area,
              nivel: pt.nivel,
              objetivo: pt.objetivo,
              responsabilidades: pt.responsabilidades,
            })),
          },
        });
        if (error) throw error;
        similitudesPorPuestoId[p.id] = (data?.similitudes || []) as SimilitudIA[];
      }

      const pptx = buildReporteGeneralPptx(clienteNombre || "Cliente", puestos, similitudesPorPuestoId);
      const fileName = `Comparativa General - ${clienteNombre || clienteId}.pptx`;
      const blob = (await pptx.write({ outputType: "blob" })) as Blob;
      await uploadReportePptx({
        clienteId: clienteId!,
        clienteNombre: clienteNombre || "Cliente",
        type: "general",
        fileName,
        pptxBlob: blob,
      });
      triggerBlobDownload(blob, fileName);
      toast.success("Reporte general generado.");
    } catch (e) {
      console.error("Error generando reporte general:", e);
      toast.error("No se pudo generar el reporte general.");
    } finally {
      setGenerandoGeneral(false);
    }
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

        <Button onClick={handleGenerarReporteGeneral} disabled={generandoGeneral} variant="secondary">
          {generandoGeneral ? "Generando…" : "Generar Comparativa"}
        </Button>
        <Button onClick={() => setReporteDialogOpen(true)} variant="outline">
          Generar Reporte
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
          clienteId={clienteId}
          open={!!similitudPuesto}
          onClose={() => setSimilitudPuesto(null)}
        />
      )}

      <GenerarReporteDialog
        open={reporteDialogOpen}
        onClose={() => setReporteDialogOpen(false)}
        puestos={puestos}
        clienteId={clienteId!}
        clienteNombre={clienteNombre}
      />
    </div>
  );
}
