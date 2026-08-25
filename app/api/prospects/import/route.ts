import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bulkCreateProspects } from '../../../../lib/prospects';

const itemSchema = z.object({
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

const bodySchema = z.object({ prospects: z.array(itemSchema).min(1).max(500) });

export async function POST(req: NextRequest) {
  try {
    const { prospects } = bodySchema.parse(await req.json());
    const created = await bulkCreateProspects(prospects);
    return NextResponse.json({ count: created.length, prospects: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Importación inválida' }, { status: 400 });
  }
}
