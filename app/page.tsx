'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Prospect } from '../lib/types';

const emptyForm = { name:'', category:'', city:'León, Gto.', website:'', phone:'', whatsapp:'' };

export default function Home(){
  const [prospects,setProspects]=useState<Prospect[]>([]);
  const [selected,setSelected]=useState<Prospect|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState(emptyForm);

  async function loadProspects(){
    setLoading(true); setError('');
    try{
      const res=await fetch('/api/prospects',{cache:'no-store'});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'No se pudieron cargar los prospectos');
      setProspects(data);
      setSelected(current=>current ? data.find((p:Prospect)=>p.id===current.id)||data[0]||null : data[0]||null);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setLoading(false);}
  }

  useEffect(()=>{void loadProspects();},[]);

  const stats=useMemo(()=>({
    total:prospects.length,
    qualified:prospects.filter(p=>p.opportunityScore>=70).length,
    demos:prospects.filter(p=>['DEMO_CREATED','CONTACTED','RESPONDED','INTERESTED','WON'].includes(p.status)).length,
    contacted:prospects.filter(p=>['CONTACTED','RESPONDED','FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON'].includes(p.status)).length,
    won:prospects.filter(p=>p.status==='WON').length
  }),[prospects]);

  async function patchStatus(p:Prospect,status:Prospect['status']){
    setBusy(true); setError('');
    try{
      const res=await fetch(`/api/prospects/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
      const next=await res.json();
      if(!res.ok) throw new Error(next.error||'No se pudo actualizar');
      setProspects(items=>items.map(x=>x.id===next.id?next:x));
      setSelected(next);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function analyze(p:Prospect){
    setBusy(true); setError('');
    try{
      const res=await fetch(`/api/prospects/${p.id}/analyze`,{method:'POST'});
      const next=await res.json();
      if(!res.ok) throw new Error(next.error||'No se pudo analizar');
      setProspects(items=>items.map(x=>x.id===next.id?next:x));
      setSelected(next);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function createProspect(e:FormEvent){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const res=await fetch('/api/prospects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const created=await res.json();
      if(!res.ok) throw new Error(created.error||'No se pudo crear');
      setProspects(items=>[created,...items]);
      setSelected(created); setForm(emptyForm); setShowForm(false);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><h1>Prospección IA</h1><p>PostgreSQL propio + pipeline + scoring + demos personalizadas</p></div>
      <button className="btn" onClick={()=>setShowForm(v=>!v)}>{showForm?'Cerrar':'+ Agregar prospecto'}</button>
    </header>

    {error&&<div className="card" style={{marginBottom:18,borderColor:'#7f1d1d'}}>{error}</div>}

    {showForm&&<section className="card" style={{marginBottom:24}}>
      <h2 className="panel-title">Nuevo prospecto</h2>
      <form onSubmit={createProspect} className="form-grid">
        <Editable label="Negocio" value={form.name} onChange={v=>setForm({...form,name:v})}/>
        <Editable label="Categoría" value={form.category} onChange={v=>setForm({...form,category:v})}/>
        <Editable label="Ciudad" value={form.city} onChange={v=>setForm({...form,city:v})}/>
        <Editable label="Sitio web" value={form.website} onChange={v=>setForm({...form,website:v})}/>
        <Editable label="Teléfono" value={form.phone} onChange={v=>setForm({...form,phone:v})}/>
        <Editable label="WhatsApp" value={form.whatsapp} onChange={v=>setForm({...form,whatsapp:v})}/>
        <div className="toolbar full"><button className="btn" disabled={busy||!form.name||!form.category||!form.city}>Guardar prospecto</button></div>
      </form>
    </section>}

    <section className="grid stats">
      <Stat label="Prospectos" value={stats.total}/><Stat label="Calificados ≥70" value={stats.qualified}/><Stat label="Demos" value={stats.demos}/><Stat label="Contactados" value={stats.contacted}/><Stat label="Ventas" value={stats.won}/>
    </section>

    <section className="split">
      <div className="card">
        <h2 className="panel-title">Pipeline {loading&&<span className="muted"> · cargando...</span>}</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Negocio</th><th>Sector</th><th>Score</th><th>Estado</th></tr></thead><tbody>
          {prospects.map(p=><tr key={p.id} onClick={()=>setSelected(p)} style={{cursor:'pointer'}}><td>{p.name}<div className="muted">{p.city}</div></td><td>{p.category}</td><td className={`score ${p.opportunityScore>=70?'hot':p.opportunityScore>=50?'mid':''}`}>{p.opportunityScore}</td><td><span className="badge">{p.status}</span></td></tr>)}
          {!loading&&prospects.length===0&&<tr><td colSpan={4}>No hay prospectos. Agrega el primero.</td></tr>}
        </tbody></table></div>
      </div>

      <aside className="card">
        <h2 className="panel-title">Prospecto seleccionado</h2>
        {!selected?<p className="muted">Selecciona o agrega un prospecto.</p>:<>
          <div className="form-grid">
            <Field label="Negocio" value={selected.name}/><Field label="Categoría" value={selected.category}/><Field label="Ciudad" value={selected.city}/><Field label="Score" value={String(selected.opportunityScore)}/>
            <div className="field full"><label>Problema detectado</label><textarea readOnly value={selected.mainProblem||'Pendiente de análisis IA'}/></div>
            <div className="field full"><label>Mensaje sugerido</label><textarea readOnly value={selected.personalizedMessage||'Pendiente de generación IA'}/></div>
          </div>
          <div className="toolbar">
            <button className="btn" disabled={busy} onClick={()=>analyze(selected)}>{busy?'Procesando...':'Analizar con IA'}</button>
            <button className="btn secondary" disabled={busy} onClick={()=>patchStatus(selected,'CONTACTED')}>Marcar contactado</button>
            <a className="btn secondary" href={`/demo/${selected.id}`} target="_blank">Ver demo</a>
          </div>
        </>}
      </aside>
    </section>
  </main>
}

function Stat({label,value}:{label:string,value:number}){return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div></div>}
function Field({label,value}:{label:string,value:string}){return <div className="field"><label>{label}</label><input readOnly value={value}/></div>}
function Editable({label,value,onChange}:{label:string,value:string,onChange:(value:string)=>void}){return <div className="field"><label>{label}</label><input value={value} onChange={e=>onChange(e.target.value)}/></div>}
