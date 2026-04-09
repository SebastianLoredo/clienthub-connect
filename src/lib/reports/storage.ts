import { addDoc, collection, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export type ReportType = "general" | "individual";

export async function uploadReportePptx(params: {
  clienteId: string;
  type: ReportType;
  fileName: string;
  pptxArrayBuffer: ArrayBuffer;
  puesto?: { id: string; nombre: string };
}) {
  const { clienteId, type, fileName, pptxArrayBuffer, puesto } = params;
  const reportesCol = collection(db, "clientes", clienteId, "reportes");

  // Creamos primero el doc para usar su id como parte del path
  const docRef = await addDoc(reportesCol, {
    type,
    fileName,
    puestoId: puesto?.id ?? null,
    puestoNombre: puesto?.nombre ?? null,
    createdAt: serverTimestamp(),
    storagePath: null,
    downloadUrl: null,
  });

  const storagePath = `reportes/${clienteId}/${docRef.id}.pptx`;
  const storageRef = ref(storage, storagePath);
  const blob = new Blob([pptxArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  const downloadUrl = await getDownloadURL(storageRef);

  await updateDoc(docRef, {
    storagePath,
    downloadUrl,
  });

  return { id: docRef.id, downloadUrl, storagePath };
}

