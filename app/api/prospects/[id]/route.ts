import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteProspect, getProspect, updateProspect, updateProspectStatus } from '../../../../lib/prospects';

const statusSchema = z.object({
  status: z.enum(['NEW','QUALIFIED','DEMO_CREATED','CONTACTED','RESPONDED','FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON','LOST'])
});

const updateSchema = z.object({
  name: z.string().min(1).max(180).optional(),
  category: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(120).optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  googleRating: z.number().min(0).max(5).optional(),
  reviews: z.number().int().min(0).optional(),
  hasWebsite: z.boolean().optional(),
  hasWhatsappVisible: z.boolean().optional(),
  sectorHighValue: z.boolean().optional(),
  status: z.enum(['NEW','QUALIFIED','DEMO_CREATED','CONTACTED','RESPONDED','FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON','LOST']).optional()
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
    const body = updateSchema.parse(await req.json());
    let prospect = await updateProspect(params.id, body);
    if (!prospect) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });
    if (body.status) prospect = await updateProspectStatus(params.id, statusSchema.parse({ status: body.status }).status);
    return NextResponse.json(prospect);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Solicitud inválida' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteProspect(params.id);
    if (!deleted) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo eliminar' }, { status: 500 });
  }
}
