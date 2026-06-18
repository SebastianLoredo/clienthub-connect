## Plan: Lista de usuarios para administradores

### Situación actual
- La página `/dashboard/usuarios` solo muestra el perfil del usuario logueado (editar nombre).
- No existe ninguna vista donde el admin pueda ver todos los usuarios registrados.
- Los usuarios ya se guardan en la colección `users` de Firestore (uid, email, displayName, role, createdAt) — creada por `ensureUserDoc` en `AuthContext`.

### Propuesta
Convertir `/dashboard/usuarios` en una página con dos comportamientos según el rol:

**Si el usuario es admin:**
- Mostrar arriba la sección "Mi perfil" (igual que hoy: editar nombre).
- Debajo, una tarjeta **"Todos los usuarios"** con una tabla:
  - Columnas: Nombre · Correo · Rol · Fecha de registro
  - Buscador por nombre/correo
  - Selector de rol por fila (`user` / `admin`) que actualiza el campo `role` en `users/{uid}` en Firestore
  - El admin no puede degradarse a sí mismo (selector deshabilitado en su propia fila para evitar quedarse sin admin)
  - Cada cambio de rol registra un `logAudit("user_role_change", { targetEmail, newRole })`

**Si el usuario NO es admin:**
- Solo ve "Mi perfil" (comportamiento actual, sin cambios).

### Archivos a modificar
- `src/pages/Usuarios.tsx` — agregar tabla condicional para admin, suscripción a colección `users`, handler para actualizar rol.

### Notas técnicas
- Listado en tiempo real con `onSnapshot(collection(db, "users"))`, ordenado por `createdAt desc`.
- Actualización de rol con `updateDoc(doc(db, "users", uid), { role: nuevoRol })`.
- No se crea ninguna página nueva ni ruta nueva — se aprovecha la existente del menú "Usuarios".
- No se tocan reglas de Firestore en este plan (asumimos que el admin ya tiene permisos de lectura/escritura sobre `users`). Si las reglas lo bloquean, se aborda en un plan posterior.
