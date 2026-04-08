import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { puestoCliente, puestosTipo } = await req.json();

    if (!puestoCliente || !puestosTipo || !Array.isArray(puestosTipo) || puestosTipo.length === 0) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const puestosTipoList = puestosTipo.map((p: any, i: number) =>
      `${i + 1}. Puesto: "${p.puesto}", Departamento: "${p.departamento}", Área: "${p.area}", Nivel: "${p.nivel}", Objetivo: "${p.objetivo}", Responsabilidades: "${p.responsabilidades}"`
    ).join("\n");

    const prompt = `Eres un experto en recursos humanos. Compara el siguiente puesto de un cliente con la lista de puestos tipo y devuelve los más similares con un porcentaje de similitud (0-100) y una breve razón.

PUESTO DEL CLIENTE:
- Nombre: "${puestoCliente.nombre}"
- Área: "${puestoCliente.area}"
- Descripción: "${puestoCliente.descripcion}"
- Tecnologías: "${puestoCliente.tecnologias}"

PUESTOS TIPO:
${puestosTipoList}

Responde ÚNICAMENTE con el resultado de la función.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Eres un experto en análisis de puestos de trabajo." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_similitudes",
              description: "Reportar los puestos tipo similares al puesto del cliente",
              parameters: {
                type: "object",
                properties: {
                  similitudes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        indice: { type: "number", description: "Índice del puesto tipo (1-based)" },
                        porcentaje: { type: "number", description: "Porcentaje de similitud 0-100" },
                        razon: { type: "string", description: "Breve razón de la similitud" },
                      },
                      required: ["indice", "porcentaje", "razon"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["similitudes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_similitudes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos momentos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Agrega fondos en Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Enrich with puesto tipo data
    const enriched = result.similitudes
      .map((s: any) => {
        const pt = puestosTipo[s.indice - 1];
        if (!pt) return null;
        return {
          puestoTipo: pt,
          porcentaje: s.porcentaje,
          razon: s.razon,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.porcentaje - a.porcentaje);

    return new Response(JSON.stringify({ similitudes: enriched }), {
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
