import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enrichProspectWithGooglePlaces } from '../../../../lib/google-places';
import { listProspects, updateProspect } from '../../../../lib/prospects';

const schema=z.object({limit:z.number().int().min(1).max(10).default(5),minScore:z.number().int().min(0).max(100).default(0)});
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}

export async function POST(req:NextRequest){
  try{
    if(!process.env.GOOGLE_PLACES_API_KEY) return NextResponse.json({error:'GOOGLE_PLACES_API_KEY no configurada'},{status:400});
    const input=schema.parse(await req.json().catch(()=>({})));
    const all=await listProspects();
    const candidates=all.filter(p=>p.opportunityScore>=input.minScore && (!p.phone || !p.website || p.googleRating===undefined || p.reviews===undefined)).slice(0,input.limit);
    const results:{id:string;name:string;matched:boolean;ok:boolean;error?:string}[]=[];
    let enriched=0;
    for(let i=0;i<candidates.length;i++){
      const p=candidates[i];
      try{
        const result=await enrichProspectWithGooglePlaces(p);
        if(result.matched&&result.data){await updateProspect(p.id,result.data);enriched++;}
        results.push({id:p.id,name:p.name,matched:result.matched,ok:true});
      }catch(error){results.push({id:p.id,name:p.name,matched:false,ok:false,error:error instanceof Error?error.message:'Error inesperado'});}
      if(i<candidates.length-1) await sleep(800);
    }
    return NextResponse.json({found:candidates.length,enriched,failed:results.filter(r=>!r.ok).length,results,message:candidates.length?undefined:'No hay prospectos pendientes de enriquecimiento.'});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo enriquecer prospectos'},{status:400});}
}
