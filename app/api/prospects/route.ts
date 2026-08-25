import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProspect, listProspects } from '../../../lib/prospects';

const createSchema = z.object({
  name: z.string().min(1).max(180),
  category: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  website: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  googleRating: z.number().min(0).max(5).optional(),
  reviews: z.number().int().min(0).optional(),
  hasWebsite: z.boolean().optional(),
  hasWhatsappVisible: z.boolean().optional(),
  sectorHighValue: z.boolean().optional(),
});

export async function GET() {
  try {
    return NextResponse.json(await listProspects());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error de base de datos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = createSchema.parse(await req.json());
    const prospect = await createProspect(input);
    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Solicitud inválida' }, { status: 400 });
  }
}
