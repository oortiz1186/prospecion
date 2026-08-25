import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeProspectWithGemini } from '../../../../lib/gemini';
import { listProspects, saveAnalysis, updateProspectStatus } from '../../../../lib/prospects';

const schema = z.object({
  limit: z.number().int().min(1).max(10).default(5),
  autoDemoMinScore: z.number().int().min(0).max(100).default(70),
});

function sleep(ms:number){ return new Promise(resolve=>setTimeout(resolve,ms)); }

export async function POST(req: NextRequest){
  try{
    const input = schema.parse(await req.json().catch(()=>({})));
    const all = await listProspects();
    const pending = all
      .filter(p=>!p.mainProblem && ['NEW','QUALIFIED'].includes(p.status))
      .slice(0,input.limit);

    const results:{id:string;name:string;score?:number;status?:string;ok:boolean;error?:string}[]=[];
    let analyzed=0, qualified=0, demos=0;

    for(let i=0;i<pending.length;i++){
      const prospect=pending[i];
      try{
        const analysis=await analyzeProspectWithGemini(prospect);
        let updated=await saveAnalysis(prospect.id,analysis);
        analyzed++;
        if(analysis.score>=70) qualified++;

        if(updated && analysis.score>=input.autoDemoMinScore){
          updated=await updateProspectStatus(prospect.id,'DEMO_CREATED');
          demos++;
        }

        results.push({id:prospect.id,name:prospect.name,score:analysis.score,status:updated?.status,ok:true});
      }catch(error){
        const message=error instanceof Error?error.message:'Error inesperado';
        results.push({id:prospect.id,name:prospect.name,ok:false,error:message});
        if(message.includes('(429)') || message.toLowerCase().includes('quota')) break;
      }

      if(i<pending.length-1) await sleep(4200);
    }

    return NextResponse.json({
      pendingFound: pending.length,
      analyzed,
      qualified,
      demos,
      failed: results.filter(r=>!r.ok).length,
      results,
      message: pending.length ? undefined : 'No hay prospectos pendientes de análisis.'
    });
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'No se pudo ejecutar el análisis masivo'},{status:400});
  }
}
