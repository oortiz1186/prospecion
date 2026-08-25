'use client';

import { useMemo, useState } from 'react';
import { sampleProspects } from '../lib/sample-data';
import type { Prospect } from '../lib/types';

export default function Home(){
  const [prospects,setProspects]=useState<Prospect[]>(sampleProspects);
  const [selected,setSelected]=useState<Prospect>(sampleProspects[0]);

  const stats=useMemo(()=>({
    total:prospects.length,
    qualified:prospects.filter(p=>p.opportunityScore>=70).length,
    demos:prospects.filter(p=>['DEMO_CREATED','CONTACTED','RESPONDED','INTERESTED','WON'].includes(p.status)).length,
    contacted:prospects.filter(p=>['CONTACTED','RESPONDED','FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON'].includes(p.status)).length,
    won:prospects.filter(p=>p.status==='WON').length
  }),[prospects]);

  function markContacted(p:Prospect){
    const next={...p,status:'CONTACTED' as const};
    setProspects(items=>items.map(x=>x.id===p.id?next:x));
    setSelected(next);
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><h1>Prospección IA</h1><p>Pipeline comercial + scoring + demos personalizadas</p></div>
      <button className="btn" onClick={()=>alert('Siguiente integración: importación de prospectos y análisis con Gemini.')}>+ Importar prospectos</button>
    </header>

    <section className="grid stats">
      <Stat label="Prospectos" value={stats.total}/><Stat label="Calificados ≥70" value={stats.qualified}/><Stat label="Demos" value={stats.demos}/><Stat label="Contactados" value={stats.contacted}/><Stat label="Ventas" value={stats.won}/>
    </section>

    <section className="split">
      <div className="card">
        <h2 className="panel-title">Pipeline</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Negocio</th><th>Sector</th><th>Score</th><th>Estado</th></tr></thead><tbody>
          {prospects.map(p=><tr key={p.id} onClick={()=>setSelected(p)} style={{cursor:'pointer'}}><td>{p.name}<div className="muted">{p.city}</div></td><td>{p.category}</td><td className={`score ${p.opportunityScore>=70?'hot':p.opportunityScore>=50?'mid':''}`}>{p.opportunityScore}</td><td><span className="badge">{p.status}</span></td></tr>)}
        </tbody></table></div>
      </div>

      <aside className="card">
        <h2 className="panel-title">Prospecto seleccionado</h2>
        <div className="form-grid">
          <Field label="Negocio" value={selected.name}/><Field label="Categoría" value={selected.category}/><Field label="Ciudad" value={selected.city}/><Field label="Score" value={String(selected.opportunityScore)}/>
          <div className="field full"><label>Problema detectado</label><textarea readOnly value={selected.mainProblem||'Pendiente de análisis IA'}/></div>
          <div className="field full"><label>Mensaje sugerido</label><textarea readOnly value={selected.personalizedMessage||'Pendiente de generación IA'}/></div>
        </div>
        <div className="toolbar"><button className="btn" onClick={()=>markContacted(selected)}>Marcar contactado</button><a className="btn secondary" href={`/demo/${selected.id}`}>Ver demo</a></div>
      </aside>
    </section>
  </main>
}

function Stat({label,value}:{label:string,value:number}){return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div></div>}
function Field({label,value}:{label:string,value:string}){return <div className="field"><label>{label}</label><input readOnly value={value}/></div>}
