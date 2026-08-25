import { NextRequest, NextResponse } from 'next/server';
import { analyzeProspectWithGemini } from '../../../../../lib/gemini';
import { getProspect, saveAnalysis } from '../../../../../lib/prospects';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prospect = await getProspect(params.id);
    if (!prospect) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });

    const analysis = await analyzeProspectWithGemini(prospect);
    const updated = await saveAnalysis(params.id, analysis);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo analizar el prospecto';
    const status = message.includes('Gemini respondió con error') ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
