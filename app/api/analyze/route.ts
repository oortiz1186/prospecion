import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const inputSchema=z.object({
  name:z.string().min(1),
  category:z.string().min(1),
  city:z.string().min(1),
  website:z.string().optional().default(''),
  businessInformation:z.string().optional().default('')
});

export async function POST(req:NextRequest){
  try{
    const input=inputSchema.parse(await req.json());
    const key=process.env.GEMINI_API_KEY;
    const model=process.env.GEMINI_MODEL||'gemini-2.0-flash';
    if(!key) return NextResponse.json({error:'GEMINI_API_KEY no configurada'},{status:500});

    const prompt=`Actúa como analista comercial de una agencia de desarrollo web. Analiza este negocio:\nNombre: ${input.name}\nCategoría: ${input.category}\nCiudad: ${input.city}\nSitio actual: ${input.website||'No indicado'}\nInformación pública: ${input.businessInformation||'No indicada'}\n\nDevuelve exclusivamente JSON válido con: {"score":0,"main_problem":"","sales_opportunity":"","suggested_headline":"","suggested_services":[],"personalized_message":""}. El score va de 0 a 100 y representa qué tan buena oportunidad es ofrecer una web orientada a conseguir contactos por WhatsApp. El mensaje debe ser breve, natural, específico y no mencionar inteligencia artificial.`;

    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})
    });
    if(!response.ok) return NextResponse.json({error:'Gemini respondió con error',details:await response.text()},{status:502});
    const data=await response.json();
    const text=data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text) return NextResponse.json({error:'Gemini no devolvió contenido'},{status:502});
    return NextResponse.json(JSON.parse(text));
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Solicitud inválida'},{status:400});
  }
}
