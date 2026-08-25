import type { Prospect } from './types';
import type { ProspectInput } from './prospects';

export type FreeEnrichmentResult = {
  matched: boolean;
  provider: 'public_website';
  data?: Partial<ProspectInput>;
  found: { phone?: string; whatsapp?: string };
};

function isUnsafeHost(hostname:string){
  const h=hostname.toLowerCase();
  if(h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='::1') return true;
  if(/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)) return true;
  const m=h.match(/^172\.(\d+)\./); if(m&&Number(m[1])>=16&&Number(m[1])<=31) return true;
  return false;
}
function safeUrl(value:string){
  try{
    const u=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);
    if(!['http:','https:'].includes(u.protocol)||isUnsafeHost(u.hostname)) return null;
    return u;
  }catch{return null;}
}
function digits(value:string){return value.replace(/\D/g,'');}
function normalizeMxPhone(value:string){
  let d=digits(value);
  if(d.startsWith('52')&&d.length>=12) d=d.slice(2);
  if(d.length===10) return d;
  return undefined;
}
function extractWhatsapp(html:string){
  const patterns=[/wa\.me\/(?:52)?(\d{10})/i,/api\.whatsapp\.com\/send\?[^"'<>]*phone=(?:52)?(\d{10})/i,/whatsapp:[^"'<>]*(?:52)?(\d{10})/i];
  for(const p of patterns){const m=html.match(p);if(m?.[1])return m[1];}
  return undefined;
}
function extractPhone(html:string){
  const tel=html.match(/href=["']tel:([^"']+)["']/i);
  if(tel?.[1]){const n=normalizeMxPhone(tel[1]);if(n)return n;}
  const candidates=html.match(/(?:\+?52[\s().-]*)?(?:\d[\s().-]*){10}/g)||[];
  for(const value of candidates){const n=normalizeMxPhone(value);if(n)return n;}
  return undefined;
}

export async function enrichProspectFromPublicWebsite(prospect: Pick<Prospect,'website'|'phone'|'whatsapp'>):Promise<FreeEnrichmentResult>{
  if(!prospect.website) return {matched:false,provider:'public_website',found:{}};
  const url=safeUrl(prospect.website);
  if(!url) throw new Error('URL del sitio no permitida para enriquecimiento');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(url,{headers:{'User-Agent':'ProspeccionIA/1.0 (+public business contact enrichment)','Accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'manual',cache:'no-store'});
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');
      if(location){
        const next=safeUrl(new URL(location,url).toString());
        if(next){
          const r2=await fetch(next,{headers:{'User-Agent':'ProspeccionIA/1.0 (+public business contact enrichment)','Accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'manual',cache:'no-store'});
          if(r2.ok) return parseHtml(await r2.text(),prospect);
        }
      }
    }
    if(!response.ok) throw new Error(`Sitio respondió HTTP ${response.status}`);
    return parseHtml(await response.text(),prospect);
  }finally{clearTimeout(timeout);}
}

function parseHtml(html:string,prospect:Pick<Prospect,'phone'|'whatsapp'>):FreeEnrichmentResult{
  const limited=html.slice(0,750000);
  const whatsapp=prospect.whatsapp||extractWhatsapp(limited);
  const phone=prospect.phone||extractPhone(limited)||whatsapp;
  const changed=Boolean((phone&&!prospect.phone)||(whatsapp&&!prospect.whatsapp));
  return {matched:changed,provider:'public_website',found:{phone,whatsapp},data:changed?{phone,whatsapp,hasWhatsappVisible:Boolean(whatsapp)}:undefined};
}
