import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProspect, updateProspectStatus } from '../../../../lib/prospects';

const statusSchema = z.object({
  status: z.enum(['NEW','QUALIFIED','DEMO_CREATED','CONTACTED','RESPONDED','FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON','LOST'])
});

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prospect = await getProspect(params.id);
    if (!prospect) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });
    return NextResponse.json(prospect);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error de base de datos' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = statusSchema.parse(await req.json());
    const prospect = await updateProspectStatus(params.id, status);
    if (!prospect) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });
    return NextResponse.json(prospect);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Solicitud inválida' }, { status: 400 });
  }
}
