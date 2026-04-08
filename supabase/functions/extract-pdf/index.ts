import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdf } = await req.json();

    if (!pdf) {
      return new Response(JSON.stringify({ error: "No se proporcionó PDF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Decode base64 PDF to extract text
    const pdfBytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
    const textContent = new TextDecoder("utf-8", { fatal: false }).decode(pdfBytes);

    // Clean up the text - extract readable portions
    const cleanText = textContent
      .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    const prompt = `Analiza el siguiente contenido extraído de un PDF que contiene descripciones de puestos de trabajo. Extrae todos los puestos que encuentres.

CONTENIDO DEL PDF:
${cleanText}

Extrae los puestos usando la función proporcionada. Si no encuentras puestos claros, intenta inferir la información del contenido disponible.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Eres un experto en extracción de información de documentos de recursos humanos." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extraer_puestos",
              description: "Extraer puestos de trabajo del contenido del PDF",
              parameters: {
                type: "object",
                properties: {
                  puestos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nombre: { type: "string", description: "Nombre del puesto" },
                        area: { type: "string", description: "Área o departamento" },
                        descripcion: { type: "string", description: "Descripción del puesto" },
                        tecnologias: { type: "string", description: "Tecnologías o herramientas mencionadas" },
                      },
                      required: ["nombre", "area", "descripcion", "tecnologias"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["puestos"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extraer_puestos" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
