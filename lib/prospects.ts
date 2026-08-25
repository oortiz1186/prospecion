import { db } from './db';
import type { Prospect, ProspectStatus } from './types';

type ProspectRow = {
  id: string;
  name: string;
  category: string;
  city: string;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  google_rating: string | null;
  reviews: number | null;
  has_website: boolean;
  has_whatsapp_visible: boolean;
  sector_high_value: boolean;
  opportunity_score: number;
  status: ProspectStatus;
  main_problem: string | null;
  sales_opportunity: string | null;
  suggested_headline: string | null;
  suggested_services: string[];
  personalized_message: string | null;
};

function mapProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    website: row.website || undefined,
    phone: row.phone || undefined,
    whatsapp: row.whatsapp || undefined,
    googleRating: row.google_rating ? Number(row.google_rating) : undefined,
    reviews: row.reviews ?? undefined,
    hasWebsite: row.has_website,
    hasWhatsappVisible: row.has_whatsapp_visible,
    sectorHighValue: row.sector_high_value,
    opportunityScore: row.opportunity_score,
    status: row.status,
    mainProblem: row.main_problem || undefined,
    salesOpportunity: row.sales_opportunity || undefined,
    suggestedHeadline: row.suggested_headline || undefined,
    suggestedServices: row.suggested_services || [],
    personalizedMessage: row.personalized_message || undefined,
  };
}

const selectColumns = `
  id,name,category,city,website,phone,whatsapp,google_rating,reviews,
  has_website,has_whatsapp_visible,sector_high_value,opportunity_score,status,
  main_problem,sales_opportunity,suggested_headline,suggested_services,personalized_message
`;

export async function listProspects(): Promise<Prospect[]> {
  const result = await db.query<ProspectRow>(`SELECT ${selectColumns} FROM prospects ORDER BY created_at DESC`);
  return result.rows.map(mapProspect);
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const result = await db.query<ProspectRow>(`SELECT ${selectColumns} FROM prospects WHERE id=$1 LIMIT 1`, [id]);
  return result.rows[0] ? mapProspect(result.rows[0]) : null;
}

export async function createProspect(input: {
  name: string;
  category: string;
  city: string;
  website?: string;
  phone?: string;
  whatsapp?: string;
  googleRating?: number;
  reviews?: number;
  hasWebsite?: boolean;
  hasWhatsappVisible?: boolean;
  sectorHighValue?: boolean;
}): Promise<Prospect> {
  const result = await db.query<ProspectRow>(
    `INSERT INTO prospects (
      name,category,city,website,phone,whatsapp,google_rating,reviews,
      has_website,has_whatsapp_visible,sector_high_value
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING ${selectColumns}`,
    [
      input.name,
      input.category,
      input.city,
      input.website || null,
      input.phone || null,
      input.whatsapp || null,
      input.googleRating ?? null,
      input.reviews ?? null,
      input.hasWebsite ?? Boolean(input.website),
      input.hasWhatsappVisible ?? Boolean(input.whatsapp),
      input.sectorHighValue ?? false,
    ]
  );
  return mapProspect(result.rows[0]);
}

export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<Prospect | null> {
  const lastContact = status === 'CONTACTED' ? ', last_contact_at=now()' : '';
  const result = await db.query<ProspectRow>(
    `UPDATE prospects SET status=$2, updated_at=now() ${lastContact} WHERE id=$1 RETURNING ${selectColumns}`,
    [id, status]
  );
  return result.rows[0] ? mapProspect(result.rows[0]) : null;
}

export async function saveAnalysis(id: string, analysis: {
  score: number;
  main_problem: string;
  sales_opportunity: string;
  suggested_headline: string;
  suggested_services: string[];
  personalized_message: string;
}): Promise<Prospect | null> {
  const status: ProspectStatus = analysis.score >= 70 ? 'QUALIFIED' : 'NEW';
  const result = await db.query<ProspectRow>(
    `UPDATE prospects SET
      opportunity_score=$2,
      main_problem=$3,
      sales_opportunity=$4,
      suggested_headline=$5,
      suggested_services=$6::jsonb,
      personalized_message=$7,
      status=CASE WHEN status='NEW' THEN $8::prospect_status ELSE status END,
      updated_at=now()
    WHERE id=$1
    RETURNING ${selectColumns}`,
    [id, analysis.score, analysis.main_problem, analysis.sales_opportunity, analysis.suggested_headline, JSON.stringify(analysis.suggested_services), analysis.personalized_message, status]
  );
  return result.rows[0] ? mapProspect(result.rows[0]) : null;
}
