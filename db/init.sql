CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE prospect_status AS ENUM (
    'NEW','QUALIFIED','DEMO_CREATED','CONTACTED','RESPONDED',
    'FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON','LOST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(180) NOT NULL,
  category varchar(120) NOT NULL,
  city varchar(120) NOT NULL,
  website text,
  phone varchar(40),
  whatsapp varchar(40),
  google_rating numeric(2,1),
  reviews integer,
  has_website boolean NOT NULL DEFAULT false,
  has_whatsapp_visible boolean NOT NULL DEFAULT false,
  sector_high_value boolean NOT NULL DEFAULT false,
  opportunity_score integer NOT NULL DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  status prospect_status NOT NULL DEFAULT 'NEW',
  main_problem text,
  sales_opportunity text,
  suggested_headline text,
  suggested_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  personalized_message text,
  source varchar(80) NOT NULL DEFAULT 'manual',
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_city_category ON prospects(city, category);

INSERT INTO prospects (
  name, category, city, website, phone, whatsapp, google_rating, reviews,
  has_website, has_whatsapp_visible, sector_high_value, opportunity_score,
  status, main_problem, sales_opportunity, suggested_headline,
  suggested_services, personalized_message, source
)
SELECT * FROM (VALUES
  ('Dental Nova León','Dentista','León, Gto.',NULL,'4770000001','524770000001',4.7,84,false,true,true,80,'QUALIFIED'::prospect_status,
   'No cuenta con un sitio propio que capture búsquedas locales.',
   'Una landing orientada a tratamientos y WhatsApp puede convertir búsquedas locales en citas.',
   'Tu sonrisa merece atención profesional en León',
   '["Limpieza dental","Ortodoncia","Implantes"]'::jsonb,
   'Hola, vi Dental Nova León y noté que podrían facilitar mucho que nuevos pacientes encuentren sus tratamientos y contacten directo por WhatsApp. Preparé una propuesta rápida de cómo podría verse.',
   'seed'),
  ('Arquitectura Bajío','Arquitectos','León, Gto.',NULL,'4770000002','524770000002',4.5,31,false,false,true,65,'NEW'::prospect_status,
   NULL,NULL,NULL,'[]'::jsonb,NULL,'seed'),
  ('Psicología Integral','Psicología','León, Gto.',NULL,'4770000003','524770000003',4.9,52,false,true,true,80,'DEMO_CREATED'::prospect_status,
   'La captación depende de directorios y redes sociales.',
   'Una página enfocada en especialidades y contacto puede mejorar confianza y conversión.',
   'Acompañamiento psicológico profesional en León',
   '["Terapia individual","Terapia de pareja","Orientación familiar"]'::jsonb,
   'Hola, vi Psicología Integral y preparé una propuesta breve para mostrar cómo podrían presentar sus servicios y facilitar el contacto de nuevos pacientes.',
   'seed'),
  ('Taller Eurocar','Taller especializado','León, Gto.',NULL,'4770000004','524770000004',4.1,19,false,false,false,45,'CONTACTED'::prospect_status,
   NULL,NULL,NULL,'[]'::jsonb,NULL,'seed')
) AS seed(name,category,city,website,phone,whatsapp,google_rating,reviews,has_website,has_whatsapp_visible,sector_high_value,opportunity_score,status,main_problem,sales_opportunity,suggested_headline,suggested_services,personalized_message,source)
WHERE NOT EXISTS (SELECT 1 FROM prospects);
