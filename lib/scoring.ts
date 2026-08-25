import { Prospect } from './types';

export function calculateOpportunityScore(input: Pick<Prospect,'hasWebsite'|'hasWhatsappVisible'|'googleRating'|'reviews'|'sectorHighValue'|'phone'>){
  let score=0;

  // Mayor oportunidad si todavía no tiene un sitio propio.
  if(!input.hasWebsite) score+=40;

  // Falta de canales directos de conversión.
  if(!input.hasWhatsappVisible) score+=15;
  if(input.phone) score+=10;

  // Sectores donde una sola venta/paciente suele justificar mejor el costo de una web.
  if(input.sectorHighValue) score+=15;

  // Señales de demanda/reputación cuando están disponibles.
  if((input.googleRating??0)>=4) score+=10;
  if((input.reviews??0)>=30) score+=5;
  if((input.reviews??0)>=100) score+=5;

  return Math.min(score,100);
}
