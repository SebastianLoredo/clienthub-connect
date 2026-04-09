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

  const storagePath = `${clienteId}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("reportes")
    .upload(storagePath, pptxBlob, {
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("reportes").insert({
    cliente_id: clienteId,
    cliente_nombre: clienteNombre,
    type,
    file_name: fileName,
    puesto_id: puesto?.id ?? null,
    puesto_nombre: puesto?.nombre ?? null,
    storage_path: storagePath,
  });

  if (insertError) throw insertError;

  return { storagePath };
}

export async function downloadReporte(storagePath: string) {
  const { data, error } = await supabase.storage
    .from("reportes")
    .download(storagePath);
  if (error) throw error;
  return data;
}

export async function deleteReporte(id: string, storagePath: string | null) {
  if (storagePath) {
    await supabase.storage.from("reportes").remove([storagePath]);
  }
  const { error } = await supabase.from("reportes").delete().eq("id", id);
  if (error) throw error;
}
