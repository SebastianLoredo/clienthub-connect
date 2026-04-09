import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
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
import { Plus, Trash2, Pencil, FileSpreadsheet, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  parsePuestosTipoExcel,
  type PuestoTipoImportRow,
} from "@/lib/parsePuestosTipoExcel";
import { cn } from "@/lib/utils";

/** Comparación de códigos para duplicados (trim + minúsculas). */
function normalizeCodigo(c: string): string {
  return c.trim().toLowerCase();
}

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

/** Valor sentinela para filas con campo vacío en el desplegable. */
const FILTER_EMPTY = "__FILTER_EMPTY__";

type PuestoTipoFilterField = "departamento" | "area" | "nivel" | "codigo" | "puesto";

const emptyFilterSelections: Record<PuestoTipoFilterField, string[]> = {
  departamento: [],
  area: [],
  nivel: [],
  codigo: [],
  puesto: [],
};

function labelOpcionFiltro(valor: string): string {
  return valor === FILTER_EMPTY ? "(Sin valor)" : valor;
}

function opcionesUnicasPorCampo(puestos: PuestoTipo[], campo: PuestoTipoFilterField): string[] {
  const set = new Set<string>();
  let hayVacios = false;
  for (const p of puestos) {
    const raw = (p[campo] ?? "").toString();
    const v = raw.trim();
    if (v === "") hayVacios = true;
    else set.add(v);
  }
  const lista = Array.from(set).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  if (hayVacios) lista.unshift(FILTER_EMPTY);
  return lista;
}

function valorCeldaParaFiltro(p: PuestoTipo, campo: PuestoTipoFilterField): string {
  const v = (p[campo] ?? "").toString().trim();
  return v === "" ? FILTER_EMPTY : v;
}

export default function PuestosTipo() {
  const [puestos, setPuestos] = useState<PuestoTipo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterSelections, setFilterSelections] = useState(emptyFilterSelections);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<PuestoTipoImportRow[]>([]);
  const [excelSaving, setExcelSaving] = useState(false);

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

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const rows = parsePuestosTipoExcel(buf);
      if (rows.length === 0) {
        toast.warning(
          "No hay filas válidas. Usa la primera fila como encabezados e incluye al menos la columna del puesto (ej. “Puesto” o “Nombre”).",
        );
        return;
      }
      setExcelRows(rows);
      setExcelImportOpen(true);
      toast.success(`${rows.length} fila(s) cargadas desde el archivo. Revisa y edita antes de subir.`);
    } catch {
      toast.error("No se pudo leer el archivo Excel. Comprueba que sea .xlsx o .xls.");
    }
  };

  const updateExcelRow = (index: number, field: keyof PuestoTipoImportRow, value: string) => {
    setExcelRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeExcelRow = (index: number) => {
    setExcelRows((prev) => prev.filter((_, i) => i !== index));
  };

  const codigosEnBase = useMemo(() => {
    const s = new Set<string>();
    for (const p of puestos) {
      const k = normalizeCodigo(p.codigo ?? "");
      if (k) s.add(k);
    }
    return s;
  }, [puestos]);

  type DupReason = "db" | "import";

  const excelImportAnnotated = useMemo(() => {
    const rows = excelRows.map((row, index) => {
      const k = normalizeCodigo(row.codigo);
      let duplicateReason: DupReason | null = null;
      if (k) {
        if (codigosEnBase.has(k)) duplicateReason = "db";
        else {
          const firstIdx = excelRows.findIndex((r) => normalizeCodigo(r.codigo) === k);
          if (firstIdx !== index) duplicateReason = "import";
        }
      }
      return { row, index, duplicateReason };
    });

    const rank = (d: DupReason | null) => {
      if (d === "db") return 0;
      if (d === "import") return 1;
      return 2;
    };

    return [...rows].sort((a, b) => {
      const ra = rank(a.duplicateReason);
      const rb = rank(b.duplicateReason);
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    });
  }, [excelRows, codigosEnBase]);

  const excelSaveableCount = useMemo(() => {
    return excelImportAnnotated.filter(
      ({ row, duplicateReason }) => row.puesto.trim() && duplicateReason === null,
    ).length;
  }, [excelImportAnnotated]);

  const handleExcelBulkSave = async () => {
    const toSave = excelImportAnnotated.filter(
      ({ row, duplicateReason }) => row.puesto.trim() && duplicateReason === null,
    );
    if (toSave.length === 0) {
      toast.error(
        "No hay registros válidos para subir (todos están duplicados por código o falta el puesto).",
      );
      return;
    }
    setExcelSaving(true);
    try {
      let batch = writeBatch(db);
      let ops = 0;
      for (const { row } of toSave) {
        const ref = doc(collection(db, "puestos_tipo"));
        batch.set(ref, {
          departamento: row.departamento,
          area: row.area,
          nivel: row.nivel,
          codigo: row.codigo,
          puesto: row.puesto.trim(),
          objetivo: row.objetivo,
          responsabilidades: row.responsabilidades,
        });
        ops += 1;
        if (ops >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
      const conPuesto = excelRows.filter((r) => r.puesto.trim()).length;
      const skipped = conPuesto - toSave.length;
      if (skipped > 0) {
        toast.success(
          `${toSave.length} puesto(s) tipo guardados. ${skipped} omitido(s) por código duplicado.`,
        );
      } else {
        toast.success(`${toSave.length} puesto(s) tipo guardados en la base de datos.`);
      }
      setExcelImportOpen(false);
      setExcelRows([]);
    } catch {
      toast.error("Error al guardar en la base de datos.");
    } finally {
      setExcelSaving(false);
    }
  };

  const opcionesFiltros = useMemo(() => {
    const keys: PuestoTipoFilterField[] = [
      "departamento",
      "area",
      "nivel",
      "codigo",
      "puesto",
    ];
    return Object.fromEntries(keys.map((k) => [k, opcionesUnicasPorCampo(puestos, k)])) as Record<
      PuestoTipoFilterField,
      string[]
    >;
  }, [puestos]);

  const filtered = useMemo(() => {
    return puestos.filter((p) =>
      (Object.keys(emptyFilterSelections) as PuestoTipoFilterField[]).every((key) => {
        const selected = filterSelections[key];
        if (selected.length === 0) return true;
        const cell = valorCeldaParaFiltro(p, key);
        return selected.includes(cell);
      }),
    );
  }, [puestos, filterSelections]);

  const toggleFiltro = (campo: PuestoTipoFilterField, valor: string) => {
    setFilterSelections((prev) => {
      const cur = prev[campo];
      const next = cur.includes(valor) ? cur.filter((v) => v !== valor) : [...cur, valor];
      return { ...prev, [campo]: next };
    });
  };

  const limpiarFiltro = (campo: PuestoTipoFilterField) => {
    setFilterSelections((prev) => ({ ...prev, [campo]: [] }));
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Puestos Tipo</h1>
        <div className="flex flex-wrap gap-2">
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={handleExcelFile}
          />
          <Button type="button" variant="outline" onClick={() => excelInputRef.current?.click()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Cargar Excel
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Puesto Tipo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo Puesto Tipo</DialogTitle>
              </DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">
                Guardar
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog
        open={excelImportOpen}
        onOpenChange={(o) => {
          if (!o && !excelSaving) {
            setExcelImportOpen(false);
            setExcelRows([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Importar desde Excel</DialogTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Primera fila = encabezados reconocidos (Puesto, Departamento, Área, Nivel, Código, Objetivo,
              Responsabilidades). El código no puede repetir uno ya guardado ni duplicarse en el archivo; esas
              filas aparecen arriba en rojo y no se suben.
            </p>
          </DialogHeader>
          {excelImportAnnotated.some((x) => x.duplicateReason !== null) && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Las filas en rojo tienen un código duplicado (en base de datos o en el archivo) y no se incluirán
              al subir.
            </p>
          )}
          <ScrollArea className="h-[min(55vh,480px)] pr-4">
            <div className="space-y-6">
              {excelImportAnnotated.map(({ row, index, duplicateReason }, displayIdx) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-lg border p-4 space-y-3",
                    duplicateReason &&
                      "border-red-500 bg-red-50 dark:bg-red-950/40 dark:border-red-600",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Fila {displayIdx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8"
                      onClick={() => removeExcelRow(index)}
                      disabled={excelSaving}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Quitar
                    </Button>
                  </div>
                  {duplicateReason === "db" && (
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Duplicado: este código ya existe en la base de datos. No se subirá.
                    </p>
                  )}
                  {duplicateReason === "import" && (
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Duplicado: el mismo código aparece más arriba en el archivo. No se subirá.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        ["departamento", "Departamento"],
                        ["area", "Área"],
                        ["nivel", "Nivel"],
                        ["codigo", "Código"],
                        ["puesto", "Puesto"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          value={row[key]}
                          onChange={(e) => updateExcelRow(index, key, e.target.value)}
                          disabled={excelSaving}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Objetivo</Label>
                    <Textarea
                      value={row.objetivo}
                      onChange={(e) => updateExcelRow(index, "objetivo", e.target.value)}
                      rows={2}
                      disabled={excelSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Responsabilidades</Label>
                    <Textarea
                      value={row.responsabilidades}
                      onChange={(e) => updateExcelRow(index, "responsabilidades", e.target.value)}
                      rows={2}
                      disabled={excelSaving}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Separator />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={excelSaving}
              onClick={() => {
                setExcelImportOpen(false);
                setExcelRows([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={excelSaving || excelSaveableCount === 0}
              onClick={handleExcelBulkSave}
            >
              {excelSaving ? "Subiendo…" : `Subir a la base de datos (${excelSaveableCount})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filtros (multi-selección por columna) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {(
          [
            ["departamento", "Departamento"],
            ["area", "Área"],
            ["nivel", "Nivel"],
            ["codigo", "Código"],
            ["puesto", "Puesto"],
          ] as const
        ).map(([key, label]) => {
          const k = key as PuestoTipoFilterField;
          const selected = filterSelections[k];
          const opciones = opcionesFiltros[k];
          return (
            <Popover key={key}>
              <div className="flex gap-1">
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "flex-1 justify-between h-9 px-2 text-xs font-normal",
                      selected.length > 0 && "border-primary/60",
                    )}
                  >
                    <span className="truncate">{label}</span>
                    <span className="flex items-center gap-1 shrink-0 ml-1">
                      {selected.length > 0 && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          {selected.length}
                        </Badge>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </span>
                  </Button>
                </PopoverTrigger>
                {selected.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => limpiarFiltro(k)}
                    aria-label={`Limpiar filtro ${label}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
                <div className="p-2 border-b text-xs text-muted-foreground">
                  Marca una o más opciones (OR dentro de {label})
                </div>
                <ScrollArea className="h-[min(280px,40vh)]">
                  <div className="p-2 space-y-2">
                    {opciones.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-2">Sin valores en los datos.</p>
                    ) : (
                      opciones.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/80 cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selected.includes(opt)}
                            onCheckedChange={() => toggleFiltro(k, opt)}
                            className="mt-0.5"
                          />
                          <span className="break-words leading-snug">{labelOpcionFiltro(opt)}</span>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          );
        })}
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
