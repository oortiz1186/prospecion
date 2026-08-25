import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProspect, saveAnalysis } from '../../../../../lib/prospects';

const analysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  main_problem: z.string(),
  sales_opportunity: z.string(),
  suggested_headline: z.string(),
  suggested_services: z.array(z.string()),
  personalized_message: z.string(),
});

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prospect = await getProspect(params.id);
    if (!prospect) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });

    const key = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

    const prompt = `Actúa como analista comercial de una agencia de desarrollo web.\n\nNegocio: ${prospect.name}\nCategoría: ${prospect.category}\nCiudad: ${prospect.city}\nSitio actual: ${prospect.website || 'No indicado'}\nRating Google: ${prospect.googleRating ?? 'No indicado'}\nReseñas: ${prospect.reviews ?? 'No indicado'}\nWhatsApp visible: ${prospect.hasWhatsappVisible ? 'Sí' : 'No'}\n\nDevuelve exclusivamente JSON válido con: {"score":0,"main_problem":"","sales_opportunity":"","suggested_headline":"","suggested_services":[],"personalized_message":""}. El score va de 0 a 100 y mide qué tan buena oportunidad es ofrecer una web enfocada en conseguir contactos por WhatsApp. El mensaje debe ser breve, natural, específico y no mencionar inteligencia artificial.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Gemini respondió con error', details: await response.text() }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: 'Gemini no devolvió contenido' }, { status: 502 });

    const analysis = analysisSchema.parse(JSON.parse(text));
    const updated = await saveAnalysis(params.id, analysis);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo analizar el prospecto' }, { status: 400 });
  }
}
