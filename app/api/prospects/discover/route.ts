import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bulkCreateProspects, listProspects, type ProspectInput } from '../../../../lib/prospects';

const schema=z.object({
  city:z.string().min(2).max(120),
  category:z.enum(['dentistas','psicologos','abogados','arquitectos','talleres','inmobiliarias','clinicas','restaurantes','belleza']),
  limit:z.number().int().min(1).max(50).default(20),
});

const CATEGORY_MAP:Record<string,{label:string;selector:string;googleQuery:string;highValue:boolean}>={
  dentistas:{label:'Dentista',selector:'["amenity"="dentist"]',googleQuery:'dentistas',highValue:true},
  psicologos:{label:'Psicología',selector:'["healthcare"="psychotherapist"]',googleQuery:'psicólogos',highValue:true},
  abogados:{label:'Abogados',selector:'["office"="lawyer"]',googleQuery:'abogados',highValue:true},
  arquitectos:{label:'Arquitectos',selector:'["office"="architect"]',googleQuery:'arquitectos',highValue:true},
  talleres:{label:'Taller especializado',selector:'["shop"="car_repair"]',googleQuery:'talleres mecánicos',highValue:true},
  inmobiliarias:{label:'Inmobiliaria',selector:'["office"="estate_agent"]',googleQuery:'inmobiliarias',highValue:true},
  clinicas:{label:'Clínica',selector:'["amenity"="clinic"]',googleQuery:'clínicas',highValue:true},
  restaurantes:{label:'Restaurante',selector:'["amenity"="restaurant"]',googleQuery:'restaurantes',highValue:false},
  belleza:{label:'Belleza',selector:'["shop"="beauty"]',googleQuery:'salones de belleza',highValue:false},
};

const OVERPASS_ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
type NominatimItem={boundingbox:[string,string,string,string]};
type OsmElement={tags?:Record<string,string>};
type GooglePlace={displayName?:{text?:string};nationalPhoneNumber?:string;websiteUri?:string;rating?:number;userRatingCount?:number;businessStatus?:string};
function normalize(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')}
function cleanWhatsapp(v?:string){if(!v)return undefined;const d=v.replace(/\D/g,'');return d.length>=10?d:undefined}
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}

async function queryGooglePlaces(textQuery:string,limit:number):Promise<GooglePlace[]>{
  const key=process.env.GOOGLE_PLACES_API_KEY;
  if(!key) return [];
  const response=await fetch('https://places.googleapis.com/v1/places:searchText',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Goog-Api-Key':key,
      'X-Goog-FieldMask':'places.displayName,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus'
    },
    body:JSON.stringify({textQuery,pageSize:Math.min(limit,20),languageCode:'es',regionCode:'MX'}),
    cache:'no-store'
  });
  if(!response.ok){const raw=await response.text();throw new Error(`Google Places respondió ${response.status}: ${raw.slice(0,300)}`)}
  const data=await response.json() as {places?:GooglePlace[]};
  return data.places||[];
}

async function queryOverpass(query:string){
  const attempts:string[]=[];
  for(const endpoint of OVERPASS_ENDPOINTS){
    for(let attempt=1;attempt<=2;attempt++){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),22000);
      try{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'ProspeccionIA/1.2'},body:new URLSearchParams({data:query}).toString(),signal:controller.signal,cache:'no-store'});
        if(response.ok)return await response.json() as {elements:OsmElement[]};
        attempts.push(`${new URL(endpoint).hostname}: HTTP ${response.status}`);
      }catch(error){attempts.push(`${new URL(endpoint).hostname}: ${error instanceof Error?error.name:'error'}`)}finally{clearTimeout(timer)}
      await sleep(500*attempt);
    }
  }
  throw new Error(`Las fuentes públicas de negocios están temporalmente saturadas. Intentos: ${attempts.join(' · ')}`);
}

async function discoverOsm(input:z.infer<typeof schema>,category:(typeof CATEGORY_MAP)[string]):Promise<ProspectInput[]>{
  const geoRes=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${encodeURIComponent(input.city)}`,{headers:{'User-Agent':'ProspeccionIA/1.2'},cache:'no-store'});
  if(!geoRes.ok)throw new Error(`No pude localizar la ciudad (${geoRes.status})`);
  const geo=(await geoRes.json()) as NominatimItem[]; if(!geo[0])throw new Error('No encontré la ciudad indicada.');
  const [south,north,west,east]=geo[0].boundingbox; const bbox=`${south},${west},${north},${east}`;
  const osm=await queryOverpass(`[out:json][timeout:18];nwr${category.selector}(${bbox});out center tags ${Math.min(input.limit*3,120)};`);
  const items:ProspectInput[]=[];
  for(const element of osm.elements||[]){
    if(items.length>=input.limit)break; const t=element.tags||{}; const name=t.name?.trim(); if(!name)continue;
    const phone=(t['contact:phone']||t.phone||'').trim(); const website=(t['contact:website']||t.website||'').trim(); const whatsapp=cleanWhatsapp(t['contact:whatsapp']||t.whatsapp);
    items.push({name,category:category.label,city:input.city,website:website||undefined,phone:phone||undefined,whatsapp,hasWebsite:Boolean(website),hasWhatsappVisible:Boolean(whatsapp),sectorHighValue:category.highValue});
  }
  return items;
}

export async function POST(req:NextRequest){
  try{
    const input=schema.parse(await req.json()); const category=CATEGORY_MAP[input.category];
    const provider=(process.env.DISCOVERY_PROVIDER||'auto').toLowerCase();
    let raw:ProspectInput[]=[]; let usedProvider='OpenStreetMap';

    if(provider==='google'||(provider==='auto'&&process.env.GOOGLE_PLACES_API_KEY)){
      const places=await queryGooglePlaces(`${category.googleQuery} en ${input.city}`,input.limit);
      raw=places.filter(p=>p.businessStatus!=='CLOSED_PERMANENTLY').map(p=>({
        name:p.displayName?.text?.trim()||'',category:category.label,city:input.city,
        phone:p.nationalPhoneNumber||undefined,website:p.websiteUri||undefined,googleRating:p.rating,reviews:p.userRatingCount,
        hasWebsite:Boolean(p.websiteUri),hasWhatsappVisible:false,sectorHighValue:category.highValue
      })).filter(p=>Boolean(p.name));
      usedProvider='Google Places';
      if(!raw.length&&provider==='auto'){raw=await discoverOsm(input,category);usedProvider='OpenStreetMap fallback'}
    }else raw=await discoverOsm(input,category);

    const existing=await listProspects();
    const seen=new Set(existing.map(p=>`${normalize(p.name)}|${normalize(p.city)}`));
    const seenPhones=new Set(existing.map(p=>(p.phone||'').replace(/\D/g,'')).filter(Boolean));
    const discovered:ProspectInput[]=[];
    for(const p of raw){
      if(discovered.length>=input.limit)break;
      const phoneDigits=(p.phone||'').replace(/\D/g,''); const key=`${normalize(p.name)}|${normalize(input.city)}`;
      if(seen.has(key)||(phoneDigits&&seenPhones.has(phoneDigits)))continue;
      seen.add(key);if(phoneDigits)seenPhones.add(phoneDigits);discovered.push(p);
    }
    if(!discovered.length)return NextResponse.json({count:0,prospects:[],provider:usedProvider,message:'La búsqueda respondió, pero no encontré negocios nuevos para guardar.'});
    const created=await bulkCreateProspects(discovered);
    return NextResponse.json({count:created.length,prospects:created,provider:usedProvider});
  }catch(error){const message=error instanceof Error?error.message:'No se pudo buscar negocios';return NextResponse.json({error:message},{status:400})}
}
