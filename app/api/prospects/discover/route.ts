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

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

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
function sleep(ms:number){ return new Promise(resolve=>setTimeout(resolve,ms)); }

async function queryOverpass(query:string){
  const attempts:string[]=[];
  for(const endpoint of OVERPASS_ENDPOINTS){
    for(let attempt=1;attempt<=2;attempt++){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),22000);
      try{
        const response=await fetch(endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'ProspeccionIA/1.1'},
          body:new URLSearchParams({data:query}).toString(),
          signal:controller.signal,
          cache:'no-store',
        });
        if(response.ok) return await response.json() as {elements:OsmElement[]};
        attempts.push(`${new URL(endpoint).hostname}: HTTP ${response.status}`);
        if(![429,502,503,504].includes(response.status)) break;
      }catch(error){
        attempts.push(`${new URL(endpoint).hostname}: ${error instanceof Error?error.name:'error'}`);
      }finally{ clearTimeout(timer); }
      await sleep(500*attempt);
    }
  }
  throw new Error(`Las fuentes públicas de negocios están temporalmente saturadas. Intentos: ${attempts.join(' · ')}`);
}

export async function POST(req: NextRequest){
  try{
    const input=schema.parse(await req.json());
    const category=CATEGORY_MAP[input.category];

    const geoRes=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${encodeURIComponent(input.city)}`,{
      headers:{'User-Agent':'ProspeccionIA/1.1'}, cache:'no-store'
    });
    if(!geoRes.ok) return NextResponse.json({error:`No pude localizar la ciudad (${geoRes.status})`},{status:502});
    const geo=(await geoRes.json()) as NominatimItem[];
    if(!geo[0]) return NextResponse.json({error:'No encontré la ciudad indicada.'},{status:404});

    const [south,north,west,east]=geo[0].boundingbox;
    const bbox=`${south},${west},${north},${east}`;
    // Pedimos tags explícitamente: son los que contienen nombre, teléfono, web y WhatsApp.
    const query=`[out:json][timeout:18];nwr${category.selector}(${bbox});out center tags ${Math.min(input.limit*3,120)};`;
    const osm=await queryOverpass(query);

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
        name, category:category.label, city:input.city,
        website:website||undefined, phone:phone||undefined, whatsapp,
        hasWebsite:Boolean(website), hasWhatsappVisible:Boolean(whatsapp), sectorHighValue:category.highValue,
      });
    }

    if(!discovered.length) return NextResponse.json({count:0,prospects:[],message:'La búsqueda respondió, pero no encontré negocios nuevos con nombre para guardar.'});
    const created=await bulkCreateProspects(discovered);
    return NextResponse.json({count:created.length,prospects:created});
  }catch(error){
    const message=error instanceof Error?error.message:'No se pudo buscar negocios';
    return NextResponse.json({error:message},{status:message.includes('temporalmente saturadas')?503:400});
  }
}
