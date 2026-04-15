

## Plan: Mejorar extracción de PDF — 1 puesto por PDF

### Problemas actuales
1. **Extracción de texto basura**: Se decodifica el PDF como UTF-8 crudo, lo que produce texto ilegible (el formato binario de PDF no es texto plano).
2. **Prompt pide múltiples puestos**: Dice "extrae todos los puestos que encuentres", lo que causa que la IA alucine puestos inventados.
3. **Schema permite array**: La tool function devuelve un array de puestos, incentivando múltiples resultados.

### Cambios propuestos

**1. Edge function `extract-pdf/index.ts` — Usar el modelo multimodal con el PDF directamente**

En vez de intentar parsear el PDF como texto, enviar el PDF en base64 como imagen/documento al modelo Gemini (que soporta PDFs nativamente via content parts). Esto elimina el problema de texto basura.

**2. Cambiar prompt y schema a 1 solo puesto**

- Nuevo system prompt: Enfatizar que el PDF contiene exactamente 1 posición/puesto.
- Nuevo user prompt: "Este PDF describe UNA SOLA posición de trabajo. Extrae la información de esa única posición."
- Cambiar el schema de `puestos: array` a un objeto plano con los campos: `nombre`, `area`, `descripcion`, `tecnologias`.

**3. Actualizar `ClienteDetalle.tsx` — Ajustar el handler del resultado**

- En vez de iterar sobre `data.puestos` (array), tomar el objeto único devuelto y crear 1 solo documento en Firestore.
- Mensaje de éxito: "Puesto extraído del PDF" (singular).

### Detalle técnico

**Edge function** — enviar PDF como content part multimodal:
```typescript
// Enviar el base64 como inline_data al modelo
messages: [
  { role: "system", content: "Eres un experto en extracción de JDs..." },
  { role: "user", content: [
    { type: "text", text: "Este PDF contiene UNA SOLA posición..." },
    { type: "image_url", url: `data:application/pdf;base64,${pdf}` }
  ]}
]
```

**Tool schema** — objeto singular:
```json
{
  "name": "extraer_puesto",
  "parameters": {
    "properties": {
      "nombre": { "type": "string" },
      "area": { "type": "string" },
      "descripcion": { "type": "string" },
      "tecnologias": { "type": "string" }
    }
  }
}
```

**Frontend** — resultado singular:
```typescript
if (data?.nombre) {
  await addDoc(..., { nombre: data.nombre, area: data.area, ... });
  toast.success("Puesto extraído del PDF");
}
```

### Archivos a modificar
- `supabase/functions/extract-pdf/index.ts` — reescribir extracción y prompt
- `src/pages/ClienteDetalle.tsx` — ajustar handler de resultado (líneas ~137-155)

