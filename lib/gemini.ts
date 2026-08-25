import { z } from 'zod';
import type { Prospect } from './types';

export const analysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  main_problem: z.string(),
  sales_opportunity: z.string(),
  suggested_headline: z.string(),
  suggested_services: z.array(z.string()),
  personalized_message: z.string(),
});

export type ProspectAnalysis = z.infer<typeof analysisSchema>;

export async function analyzeProspectWithGemini(prospect: Prospect): Promise<ProspectAnalysis> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!key) throw new Error('GEMINI_API_KEY no configurada');

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
    const raw = await response.text();
    let detail = raw;
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.error?.message || raw;
    } catch {}
    throw new Error(`Gemini respondió con error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini no devolvió contenido usando ${model}`);

  return analysisSchema.parse(JSON.parse(text));
}
