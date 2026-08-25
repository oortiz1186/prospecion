import { getProspect } from '../../../lib/prospects';

export const dynamic = 'force-dynamic';

export default async function DemoPage({params}:{params:{id:string}}){
  const p=await getProspect(params.id);
  if(!p) return <main className="shell"><div className="card">Prospecto no encontrado.</div></main>;
  const services=p.suggestedServices?.length?p.suggestedServices:['Servicio principal','Atención personalizada','Contacto directo'];
  return <main className="shell">
    <div className="demo">
      <section className="demo-hero">
        <div className="badge">Propuesta de demostración no oficial</div>
        <h2>{p.suggestedHeadline||`${p.name}: atención profesional en ${p.city}`}</h2>
        <p>Una presencia digital clara para que nuevos clientes conozcan los servicios y contacten directamente.</p>
        {p.whatsapp&&<a className="btn" href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noreferrer">Contactar por WhatsApp</a>}
      </section>
      <section className="demo-section"><h3>Servicios</h3><div className="demo-services">{services.map(s=><div className="service" key={s}>{s}</div>)}</div></section>
      <section className="demo-section"><h3>{p.name}</h3><p>{p.city} · {p.category}</p><p className="notice">Esta página es una propuesta comercial de demostración y no representa el sitio oficial del negocio.</p></section>
    </div>
  </main>
}
