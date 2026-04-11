import { addDoc, collection, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

export type ReportType = "general" | "individual";

export async function uploadReportePptx(params: {
  clienteId: string;
  clienteNombre: string;
  type: ReportType;
  fileName: string;
  pptxBlob: Blob;
  puesto?: { id: string; nombre: string };
}) {
  const { clienteId, clienteNombre, type, fileName, pptxBlob, puesto } = params;

  // Save file to Supabase Storage (no CORS issues)
  const storagePath = `${clienteId}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("reportes")
    .upload(storagePath, pptxBlob, {
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  if (uploadError) throw uploadError;

  // Save metadata to Firestore
  const reportesCol = collection(db, "clientes", clienteId, "reportes");
  await addDoc(reportesCol, {
    type,
    fileName,
    clienteNombre,
    puestoId: puesto?.id ?? null,
    puestoNombre: puesto?.nombre ?? null,
    storagePath,
    createdAt: serverTimestamp(),
  });

  return { storagePath };
}

export async function downloadReporte(storagePath: string) {
  const { data, error } = await supabase.storage
    .from("reportes")
    .download(storagePath);
  if (error) throw error;
  return data;
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteReporte(clienteId: string, reporteId: string, storagePath: string | null, subcollection = "reportes") {
  if (storagePath) {
    await supabase.storage.from("reportes").remove([storagePath]);
  }
  await deleteDoc(doc(db, "clientes", clienteId, subcollection, reporteId));
}

export async function uploadReporteExcel(params: {
  clienteId: string;
  clienteNombre: string;
  fileName: string;
  excelBlob: Blob;
}) {
  const { clienteId, clienteNombre, fileName, excelBlob } = params;

  const storagePath = `${clienteId}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("reportes")
    .upload(storagePath, excelBlob, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  if (uploadError) throw uploadError;

  const reportesCol = collection(db, "clientes", clienteId, "reportes_excel");
  await addDoc(reportesCol, {
    type: "excel",
    fileName,
    clienteNombre,
    storagePath,
    createdAt: serverTimestamp(),
  });

  return { storagePath };
}
