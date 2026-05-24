import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export type AuditAction =
  | "login"
  | "logout"
  | "register"
  | "update_profile"
  | "cliente_create"
  | "cliente_update"
  | "cliente_delete"
  | "puesto_create"
  | "puesto_update"
  | "puesto_delete"
  | "puesto_pdf_extract"
  | "puesto_tipo_create"
  | "puesto_tipo_update"
  | "puesto_tipo_delete"
  | "puesto_tipo_bulk_import"
  | "reporte_general_generate"
  | "reporte_individual_generate"
  | "similitud_buscar";

export async function logAudit(
  action: AuditAction,
  details: Record<string, unknown> = {},
) {
  try {
    const u = auth.currentUser;
    await addDoc(collection(db, "audit_logs"), {
      action,
      details,
      userId: u?.uid ?? null,
      userEmail: u?.email ?? null,
      userName: u?.displayName ?? null,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    // No bloqueamos la UX si el log falla
    console.warn("audit log failed", action, e);
  }
}
