import type { Prospect, } from './types';
import type { ProspectInput } from './prospects';

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
};

export type EnrichmentResult = {
  matched: boolean;
  provider: 'google_places';
  data?: Partial<ProspectInput>;
  place?: GooglePlace;
};

function cleanPhone(value?: string){
  if(!value) return undefined;
  return value.trim();
}

export async function enrichProspectWithGooglePlaces(
  prospect: Pick<Prospect,'name'|'city'|'category'|'website'|'phone'|'whatsapp'>
): Promise<EnrichmentResult>{
  const apiKey=process.env.GOOGLE_PLACES_API_KEY;
  if(!apiKey) throw new Error('GOOGLE_PLACES_API_KEY no configurada');

  const textQuery=`${prospect.name}, ${prospect.category}, ${prospect.city}, México`;
  const response=await fetch('https://places.googleapis.com/v1/places:searchText',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Goog-Api-Key':apiKey,
      'X-Goog-FieldMask':'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus',
    },
    body:JSON.stringify({textQuery,languageCode:'es',regionCode:'MX',pageSize:1}),
    cache:'no-store',
  });

  if(!response.ok){
    const raw=await response.text();
    let detail=raw;
    try{detail=JSON.parse(raw)?.error?.message||raw}catch{}
    throw new Error(`Google Places respondió con error (${response.status}): ${detail}`);
  }

  const json=await response.json() as {places?:GooglePlace[]};
  const place=json.places?.[0];
  if(!place) return {matched:false,provider:'google_places'};

  const phone=cleanPhone(place.internationalPhoneNumber||place.nationalPhoneNumber);
  const website=place.websiteUri?.trim();
  return {
    matched:true,
    provider:'google_places',
    place,
    data:{
      phone:phone||prospect.phone,
      website:website||prospect.website,
      googleRating:place.rating,
      reviews:place.userRatingCount,
      hasWebsite:Boolean(website||prospect.website),
      hasWhatsappVisible:Boolean(prospect.whatsapp),
    },
  };
}
