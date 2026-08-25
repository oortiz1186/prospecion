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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  if (!key) throw new Error('GEMINI_API_KEY no configurada');

  const prompt = `Analiza este prospecto para venderle una página web.\nNegocio: ${prospect.name}\nCategoría: ${prospect.category}\nCiudad: ${prospect.city}\nWeb: ${prospect.website || 'No indicada'}\nRating: ${prospect.googleRating ?? 'N/D'}\nReseñas: ${prospect.reviews ?? 'N/D'}\nWhatsApp visible: ${prospect.hasWhatsappVisible ? 'Sí' : 'No'}\n\nDevuelve SOLO JSON válido con esta forma exacta: {"score":0,"main_problem":"máx 140 caracteres","sales_opportunity":"máx 180 caracteres","suggested_headline":"máx 90 caracteres","suggested_services":["servicio 1","servicio 2","servicio 3"],"personalized_message":"máx 260 caracteres"}. Score 0-100 según oportunidad comercial. No menciones IA.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 420,
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 },
      },
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
