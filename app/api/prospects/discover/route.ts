import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bulkCreateProspects, listProspects, type ProspectInput } from '../../../../lib/prospects';

const schema = z.object({
  city: z.string().min(2).max(120),
  category: z.enum(['dentistas','psicologos','abogados','arquitectos','talleres','inmobiliarias','clinicas','restaurantes','belleza']),
  limit: z.number().int().min(1).max(50).default(20),
});

const CATEGORY_MAP: Record<string, { label: string; selector: string; highValue: boolean }> = {
  dentistas: { label: 'Dentista', selector: '["amenity"="dentist"]', highValue: true },
  psicologos: { label: 'Psicología', selector: '["healthcare"="psychotherapist"]', highValue: true },
  abogados: { label: 'Abogados', selector: '["office"="lawyer"]', highValue: true },
  arquitectos: { label: 'Arquitectos', selector: '["office"="architect"]', highValue: true },
  talleres: { label: 'Taller especializado', selector: '["shop"="car_repair"]', highValue: true },
  inmobiliarias: { label: 'Inmobiliaria', selector: '["office"="estate_agent"]', highValue: true },
  clinicas: { label: 'Clínica', selector: '["amenity"="clinic"]', highValue: true },
  restaurantes: { label: 'Restaurante', selector: '["amenity"="restaurant"]', highValue: false },
  belleza: { label: 'Belleza', selector: '["shop"="beauty"]', highValue: false },
};

type NominatimItem = { boundingbox: [string,string,string,string] };
type OsmElement = { id:number; type:string; tags?:Record<string,string> };

function normalize(value:string){
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}

function cleanWhatsapp(value?:string){
  if(!value) return undefined;
  const digits=value.replace(/\D/g,'');
  return digits.length >= 10 ? digits : undefined;
}

export async function POST(req: NextRequest){
  try{
    const input=schema.parse(await req.json());
    const category=CATEGORY_MAP[input.category];

    const geoRes=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${encodeURIComponent(input.city)}`,{
      headers:{'User-Agent':'ProspeccionIA/1.0 (business discovery; contact via repository)'}
    });
    if(!geoRes.ok) return NextResponse.json({error:`No pude localizar la ciudad (${geoRes.status})`},{status:502});
    const geo=(await geoRes.json()) as NominatimItem[];
    if(!geo[0]) return NextResponse.json({error:'No encontré la ciudad indicada.'},{status:404});

    const [south,north,west,east]=geo[0].boundingbox;
    const bbox=`${south},${west},${north},${east}`;
    const query=`[out:json][timeout:30];(nwr${category.selector}(${bbox}););out center ${Math.min(input.limit*4,200)};`;

    const overpassRes=await fetch('https://overpass-api.de/api/interpreter',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'ProspeccionIA/1.0'},
      body:new URLSearchParams({data:query}).toString(),
    });
    if(!overpassRes.ok) return NextResponse.json({error:`La fuente de negocios no respondió (${overpassRes.status}). Intenta de nuevo en unos minutos.`},{status:502});
    const osm=await overpassRes.json() as {elements:OsmElement[]};

    const existing=await listProspects();
    const seen=new Set(existing.map(p=>`${normalize(p.name)}|${normalize(p.city)}`));
    const seenPhones=new Set(existing.map(p=>(p.phone||'').replace(/\D/g,'')).filter(Boolean));
    const discovered:ProspectInput[]=[];

    for(const element of osm.elements||[]){
      if(discovered.length>=input.limit) break;
      const t=element.tags||{};
      const name=t.name?.trim();
      if(!name) continue;
      const phone=(t['contact:phone']||t.phone||'').trim();
      const phoneDigits=phone.replace(/\D/g,'');
      const key=`${normalize(name)}|${normalize(input.city)}`;
      if(seen.has(key)||(phoneDigits&&seenPhones.has(phoneDigits))) continue;
      seen.add(key); if(phoneDigits) seenPhones.add(phoneDigits);

      const website=(t['contact:website']||t.website||'').trim();
      const whatsapp=cleanWhatsapp(t['contact:whatsapp']||t.whatsapp);
      discovered.push({
        name,
        category:category.label,
        city:input.city,
        website:website||undefined,
        phone:phone||undefined,
        whatsapp,
        hasWebsite:Boolean(website),
        hasWhatsappVisible:Boolean(whatsapp),
        sectorHighValue:category.highValue,
      });
    }

    if(!discovered.length) return NextResponse.json({count:0,prospects:[],message:'No encontré negocios nuevos con datos públicos para esa búsqueda.'});
    const created=await bulkCreateProspects(discovered);
    return NextResponse.json({count:created.length,prospects:created});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'No se pudo buscar negocios'},{status:400});
  }
}
