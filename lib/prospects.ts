import { db } from './db';
import type { Prospect, ProspectStatus } from './types';
import { calculateOpportunityScore } from './scoring';

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

export type ProspectInput = {
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

function scoreFromInput(input: ProspectInput){
  return calculateOpportunityScore({
    hasWebsite: input.hasWebsite ?? Boolean(input.website),
    hasWhatsappVisible: input.hasWhatsappVisible ?? Boolean(input.whatsapp),
    googleRating: input.googleRating,
    reviews: input.reviews,
    sectorHighValue: input.sectorHighValue ?? false,
    phone: input.phone,
  });
}

export async function createProspect(input: ProspectInput): Promise<Prospect> {
  const score=scoreFromInput(input);
  const result = await db.query<ProspectRow>(
    `INSERT INTO prospects (
      name,category,city,website,phone,whatsapp,google_rating,reviews,
      has_website,has_whatsapp_visible,sector_high_value,opportunity_score,status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::prospect_status)
    RETURNING ${selectColumns}`,
    [input.name,input.category,input.city,input.website||null,input.phone||null,input.whatsapp||null,input.googleRating??null,input.reviews??null,input.hasWebsite??Boolean(input.website),input.hasWhatsappVisible??Boolean(input.whatsapp),input.sectorHighValue??false,score,score>=70?'QUALIFIED':'NEW']
  );
  return mapProspect(result.rows[0]);
}

export async function bulkCreateProspects(inputs: ProspectInput[]): Promise<Prospect[]> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const created: Prospect[] = [];
    for (const input of inputs) {
      const score=scoreFromInput(input);
      const result = await client.query<ProspectRow>(
        `INSERT INTO prospects (
          name,category,city,website,phone,whatsapp,google_rating,reviews,
          has_website,has_whatsapp_visible,sector_high_value,opportunity_score,status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::prospect_status)
        RETURNING ${selectColumns}`,
        [input.name,input.category,input.city,input.website||null,input.phone||null,input.whatsapp||null,input.googleRating??null,input.reviews??null,input.hasWebsite??Boolean(input.website),input.hasWhatsappVisible??Boolean(input.whatsapp),input.sectorHighValue??false,score,score>=70?'QUALIFIED':'NEW']
      );
      created.push(mapProspect(result.rows[0]));
    }
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProspect(id: string, input: Partial<ProspectInput>): Promise<Prospect | null> {
  const current = await getProspect(id);
  if (!current) return null;
  const next = {
    name: input.name ?? current.name,
    category: input.category ?? current.category,
    city: input.city ?? current.city,
    website: input.website ?? current.website ?? '',
    phone: input.phone ?? current.phone ?? '',
    whatsapp: input.whatsapp ?? current.whatsapp ?? '',
    googleRating: input.googleRating ?? current.googleRating,
    reviews: input.reviews ?? current.reviews,
    hasWebsite: input.hasWebsite ?? Boolean(input.website ?? current.website),
    hasWhatsappVisible: input.hasWhatsappVisible ?? Boolean(input.whatsapp ?? current.whatsapp),
    sectorHighValue: input.sectorHighValue ?? current.sectorHighValue,
  };
  const score=calculateOpportunityScore(next);
  const result = await db.query<ProspectRow>(
    `UPDATE prospects SET name=$2,category=$3,city=$4,website=$5,phone=$6,whatsapp=$7,google_rating=$8,reviews=$9,
      has_website=$10,has_whatsapp_visible=$11,sector_high_value=$12,opportunity_score=$13,
      status=CASE WHEN status IN ('NEW','QUALIFIED') THEN $14::prospect_status ELSE status END,updated_at=now()
     WHERE id=$1 RETURNING ${selectColumns}`,
    [id,next.name,next.category,next.city,next.website||null,next.phone||null,next.whatsapp||null,next.googleRating??null,next.reviews??null,next.hasWebsite,next.hasWhatsappVisible,next.sectorHighValue,score,score>=70?'QUALIFIED':'NEW']
  );
  return result.rows[0] ? mapProspect(result.rows[0]) : null;
}

export async function deleteProspect(id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM prospects WHERE id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
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
  const current=await getProspect(id);
  if(!current) return null;
  const score=calculateOpportunityScore(current);
  const status: ProspectStatus = score >= 70 ? 'QUALIFIED' : 'NEW';
  const result = await db.query<ProspectRow>(
    `UPDATE prospects SET
      opportunity_score=$2,
      main_problem=$3,
      sales_opportunity=$4,
      suggested_headline=$5,
      suggested_services=$6::jsonb,
      personalized_message=$7,
      status=CASE WHEN status IN ('NEW','QUALIFIED') THEN $8::prospect_status ELSE status END,
      updated_at=now()
    WHERE id=$1
    RETURNING ${selectColumns}`,
    [id, score, analysis.main_problem, analysis.sales_opportunity, analysis.suggested_headline, JSON.stringify(analysis.suggested_services), analysis.personalized_message, status]
  );
  return result.rows[0] ? mapProspect(result.rows[0]) : null;
}

export async function recalculateAllScores(): Promise<number>{
  const all=await listProspects();
  for(const prospect of all){
    const score=calculateOpportunityScore(prospect);
    await db.query(`UPDATE prospects SET opportunity_score=$2,status=CASE WHEN status IN ('NEW','QUALIFIED') THEN $3::prospect_status ELSE status END,updated_at=now() WHERE id=$1`,[prospect.id,score,score>=70?'QUALIFIED':'NEW']);
  }
  return all.length;
}
