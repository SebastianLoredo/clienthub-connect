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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Eres un experto en extracción de información de descripciones de puestos de trabajo (Job Descriptions). Cada PDF que recibes contiene EXACTAMENTE UNA SOLA posición de trabajo. NUNCA inventes ni alucines información que no esté en el documento. Si un campo no está presente en el PDF, devuelve una cadena vacía para ese campo.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Este PDF contiene UNA SOLA posición/puesto de trabajo. Extrae la información de esa única posición usando la función proporcionada. NO inventes puestos adicionales. Solo extrae lo que está explícitamente en el documento.",
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdf}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extraer_puesto",
              description: "Extraer la información del único puesto de trabajo descrito en el PDF",
              parameters: {
                type: "object",
                properties: {
                  nombre: { type: "string", description: "Nombre del puesto de trabajo" },
                  area: { type: "string", description: "Área o departamento al que pertenece" },
                  descripcion: { type: "string", description: "Descripción general del puesto, objetivo y responsabilidades principales" },
                  tecnologias: { type: "string", description: "Tecnologías, herramientas o conocimientos técnicos mencionados" },
                },
                required: ["nombre", "area", "descripcion", "tecnologias"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extraer_puesto" } },
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
