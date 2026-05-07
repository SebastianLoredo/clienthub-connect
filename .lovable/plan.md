
El usuario pregunta sobre los límites de uso de Gemini en Lovable. Esto es una pregunta de información, no requiere cambios de código. Respondo directamente sin plan.

## Respuesta sobre cupos de uso de Lovable AI (Gemini)

**Modelos Gemini gratis hasta el 6 de enero de 2026:**
Durante este periodo promocional, todos los modelos `google/gemini-*` (incluyendo `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`) son **gratuitos** en Lovable AI Gateway. No consumen del balance de AI.

**Después del 6 de enero de 2026 (o para modelos OpenAI):**
- Cada workspace recibe **$1 USD gratis de balance de AI** por mes.
- Una vez agotado, se debe recargar en **Settings → Workspace → Cloud & AI balance** (solo planes pagos pueden recargar).
- Los modelos OpenAI (GPT-5, GPT-5-mini, etc.) **sí consumen** balance desde el inicio.

**Rate limits (límites por minuto):**
- Hay un límite de requests por minuto por workspace.
- Si se excede → error **429 Too Many Requests** (esperar y reintentar).
- Si se acaban créditos → error **402 Payment Required**.
- Tu edge function `extract-pdf` y `buscar-similitudes` ya manejan ambos errores correctamente.

**En tu proyecto:**
Estás usando `google/gemini-3-flash-preview` en ambas edge functions, así que actualmente estás en el periodo **gratuito** hasta enero 2026.

**Documentación oficial:** https://docs.lovable.dev/features/ai

