import { Prospect } from './types';

export function calculateOpportunityScore(input: Pick<Prospect,'hasWebsite'|'hasWhatsappVisible'|'googleRating'|'reviews'|'sectorHighValue'>){
  let score=0;
  if(!input.hasWebsite) score+=35;
  if(!input.hasWhatsappVisible) score+=15;
  if((input.googleRating??0)>=4) score+=10;
  if((input.reviews??0)>=30) score+=10;
  if(input.sectorHighValue) score+=10;
  return Math.min(score,100);
}
