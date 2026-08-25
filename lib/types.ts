export type ProspectStatus = 'NEW'|'QUALIFIED'|'DEMO_CREATED'|'CONTACTED'|'RESPONDED'|'FOLLOWUP_1'|'FOLLOWUP_2'|'INTERESTED'|'WON'|'LOST';

export type Prospect = {
  id: string;
  name: string;
  category: string;
  city: string;
  website?: string;
  phone?: string;
  whatsapp?: string;
  googleRating?: number;
  reviews?: number;
  hasWebsite: boolean;
  hasWhatsappVisible: boolean;
  sectorHighValue: boolean;
  opportunityScore: number;
  status: ProspectStatus;
  mainProblem?: string;
  salesOpportunity?: string;
  suggestedHeadline?: string;
  suggestedServices?: string[];
  personalizedMessage?: string;
};
