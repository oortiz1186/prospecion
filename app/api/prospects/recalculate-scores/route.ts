import { NextResponse } from 'next/server';
import { recalculateAllScores } from '../../../../lib/prospects';

export async function POST(){
  try{
    const count=await recalculateAllScores();
    return NextResponse.json({count,message:`${count} scores recalculados sin usar Gemini.`});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'No se pudieron recalcular los scores'},{status:500});
  }
}
