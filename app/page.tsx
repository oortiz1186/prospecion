'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Prospect } from '../lib/types';

const emptyForm = { name:'', category:'', city:'León, Gto.', website:'', phone:'', whatsapp:'' };
type ProspectForm = typeof emptyForm;
const discoveryCategories=[
  ['dentistas','Dentistas'],['psicologos','Psicólogos'],['abogados','Abogados'],['arquitectos','Arquitectos'],['talleres','Talleres'],['inmobiliarias','Inmobiliarias'],['clinicas','Clínicas'],['restaurantes','Restaurantes'],['belleza','Belleza']
] as const;

export default function Home(){
  const [prospects,setProspects]=useState<Prospect[]>([]);
  const [selected,setSelected]=useState<Prospect|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showForm,setShowForm]=useState(false);
  const [showDiscover,setShowDiscover]=useState(false);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState<ProspectForm>(emptyForm);
  const [editForm,setEditForm]=useState<ProspectForm>(emptyForm);
  const [discover,setDiscover]=useState({city:'León, Guanajuato',category:'dentistas',limit:20});
  const fileRef=useRef<HTMLInputElement>(null);

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
  useEffect(()=>{if(selected)setEditForm({name:selected.name,category:selected.category,city:selected.city,website:selected.website||'',phone:selected.phone||'',whatsapp:selected.whatsapp||''});},[selected]);

  const stats=useMemo(()=>({
    total:prospects.length,
    qualified:prospects.filter(p=>p.opportunityScore>=70).length,
    demos:prospects.filter(p=>['DEMO_CREATED','CONTACTED','RESPONDED','INTERESTED','WON'].includes(p.status)).length,
    contacted:prospects.filter(p=>['CONTACTED','RESPONDED','FOLLOWUP_1','FOLLOWUP_2','INTERESTED','WON'].includes(p.status)).length,
    won:prospects.filter(p=>p.status==='WON').length,
    pending:prospects.filter(p=>!p.mainProblem&&['NEW','QUALIFIED'].includes(p.status)).length,
  }),[prospects]);

  function applyProspect(next:Prospect){setProspects(items=>items.map(x=>x.id===next.id?next:x));setSelected(next);}

  async function patchStatus(p:Prospect,status:Prospect['status']){
    setBusy(true); setError(''); setNotice('');
    try{
      const res=await fetch(`/api/prospects/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
      const next=await res.json();
      if(!res.ok) throw new Error(next.error||'No se pudo actualizar');
      applyProspect(next);
      if(status==='DEMO_CREATED') setNotice('Demo generada y registrada en el pipeline.');
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function analyze(p:Prospect){
    setBusy(true); setError(''); setNotice('');
    try{
      const res=await fetch(`/api/prospects/${p.id}/analyze`,{method:'POST'});
      const next=await res.json();
      if(!res.ok) throw new Error(next.error||'No se pudo analizar');
      applyProspect(next); setNotice(`Análisis completado. Score: ${next.opportunityScore}/100.`);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function analyzeBatch(){
    setBusy(true); setError(''); setNotice('Analizando hasta 5 prospectos. Puede tardar unos segundos...');
    try{
      const res=await fetch('/api/prospects/analyze-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:5,autoDemoMinScore:70})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'No se pudo ejecutar el análisis masivo');
      await loadProspects();
      if(!data.pendingFound){setNotice(data.message||'No hay prospectos pendientes de análisis.');return;}
      setNotice(`Lote terminado: ${data.analyzed} analizados · ${data.qualified} con score ≥70 · ${data.demos} demos generadas${data.failed?` · ${data.failed} con error`:''}.`);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');setNotice('');}
    finally{setBusy(false);}
  }

  async function createProspect(e:FormEvent){
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try{
      const res=await fetch('/api/prospects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const created=await res.json();
      if(!res.ok) throw new Error(created.error||'No se pudo crear');
      setProspects(items=>[created,...items]); setSelected(created); setForm(emptyForm); setShowForm(false); setNotice('Prospecto guardado en PostgreSQL.');
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function discoverBusinesses(e:FormEvent){
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try{
      const res=await fetch('/api/prospects/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(discover)});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'No se pudo buscar negocios');
      await loadProspects();
      setNotice(data.count?`${data.count} negocios nuevos encontrados y guardados en PostgreSQL.`:(data.message||'No se encontraron negocios nuevos.'));
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function saveEdit(e:FormEvent){
    e.preventDefault(); if(!selected)return; setBusy(true); setError(''); setNotice('');
    try{
      const res=await fetch(`/api/prospects/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(editForm)});
      const next=await res.json();
      if(!res.ok) throw new Error(next.error||'No se pudo editar');
      applyProspect(next); setEditing(false); setNotice('Prospecto actualizado.');
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function removeSelected(){
    if(!selected||!confirm(`¿Eliminar ${selected.name}? Esta acción no se puede deshacer.`))return;
    setBusy(true); setError(''); setNotice('');
    try{
      const res=await fetch(`/api/prospects/${selected.id}`,{method:'DELETE'}); const data=await res.json();
      if(!res.ok) throw new Error(data.error||'No se pudo eliminar');
      const remaining=prospects.filter(p=>p.id!==selected.id); setProspects(remaining); setSelected(remaining[0]||null); setEditing(false); setNotice('Prospecto eliminado.');
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false);}
  }

  async function importCsv(file:File){
    setBusy(true); setError(''); setNotice('');
    try{
      const text=await file.text(); const rows=parseCsv(text);
      if(rows.length<2) throw new Error('El CSV no contiene registros.');
      const headers=rows[0].map(h=>normalizeHeader(h));
      if(['name','category','city'].some(r=>!headers.includes(r))) throw new Error('El CSV debe incluir las columnas name, category y city.');
      const items=rows.slice(1).filter(r=>r.some(v=>v.trim())).map(row=>{
        const value=(key:string)=>row[headers.indexOf(key)]?.trim()||''; const rating=value('googlerating'); const reviews=value('reviews');
        return {name:value('name'),category:value('category'),city:value('city'),website:value('website'),phone:value('phone'),whatsapp:value('whatsapp'),...(rating?{googleRating:Number(rating)}:{}),...(reviews?{reviews:Number(reviews)}:{})};
      }).filter(x=>x.name&&x.category&&x.city);
      if(!items.length) throw new Error('No encontré filas válidas para importar.');
      const res=await fetch('/api/prospects/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prospects:items})}); const data=await res.json();
      if(!res.ok) throw new Error(data.error||'No se pudo importar'); await loadProspects(); setNotice(`${data.count} prospectos importados correctamente.`);
    }catch(e){setError(e instanceof Error?e.message:'Error inesperado');}
    finally{setBusy(false); if(fileRef.current)fileRef.current.value='';}
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><h1>Prospección IA</h1><p>PostgreSQL propio + descubrimiento + scoring + demos personalizadas</p></div><div className="toolbar">
      <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&void importCsv(e.target.files[0])}/>
      <button className="btn secondary" disabled={busy} onClick={()=>setShowDiscover(v=>!v)}>{showDiscover?'Cerrar búsqueda':'Buscar negocios'}</button>
      <button className="btn secondary" disabled={busy||stats.pending===0} onClick={()=>void analyzeBatch()}>{busy?'Procesando...':`Analizar pendientes (${stats.pending})`}</button>
      <button className="btn secondary" disabled={busy} onClick={()=>fileRef.current?.click()}>Importar CSV</button>
      <button className="btn" onClick={()=>setShowForm(v=>!v)}>{showForm?'Cerrar':'+ Agregar prospecto'}</button>
    </div></header>

    {error&&<div className="card" style={{marginBottom:18,borderColor:'#7f1d1d'}}>{error}</div>}
    {notice&&<div className="card" style={{marginBottom:18,borderColor:'#166534'}}>{notice}</div>}

    {showDiscover&&<section className="card" style={{marginBottom:24}}><h2 className="panel-title">Buscar negocios reales</h2>
      <p className="muted">Usa datos públicos de OpenStreetMap. No requiere API key. Los resultados se deduplican antes de guardarse.</p>
      <form onSubmit={discoverBusinesses} className="form-grid">
        <Editable label="Ciudad" value={discover.city} onChange={v=>setDiscover({...discover,city:v})}/>
        <div className="field"><label>Categoría</label><select value={discover.category} onChange={e=>setDiscover({...discover,category:e.target.value})}>{discoveryCategories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label>Máximo de resultados</label><input type="number" min={1} max={50} value={discover.limit} onChange={e=>setDiscover({...discover,limit:Number(e.target.value)})}/></div>
        <div className="toolbar full"><button className="btn" disabled={busy||!discover.city}>{busy?'Buscando...':'Buscar y guardar'}</button></div>
      </form>
    </section>}

    {showForm&&<section className="card" style={{marginBottom:24}}><h2 className="panel-title">Nuevo prospecto</h2><form onSubmit={createProspect} className="form-grid">
      <Editable label="Negocio" value={form.name} onChange={v=>setForm({...form,name:v})}/><Editable label="Categoría" value={form.category} onChange={v=>setForm({...form,category:v})}/><Editable label="Ciudad" value={form.city} onChange={v=>setForm({...form,city:v})}/><Editable label="Sitio web" value={form.website} onChange={v=>setForm({...form,website:v})}/><Editable label="Teléfono" value={form.phone} onChange={v=>setForm({...form,phone:v})}/><Editable label="WhatsApp" value={form.whatsapp} onChange={v=>setForm({...form,whatsapp:v})}/><div className="toolbar full"><button className="btn" disabled={busy||!form.name||!form.category||!form.city}>Guardar prospecto</button></div>
    </form></section>}

    <section className="grid stats"><Stat label="Prospectos" value={stats.total}/><Stat label="Pendientes IA" value={stats.pending}/><Stat label="Calificados ≥70" value={stats.qualified}/><Stat label="Demos" value={stats.demos}/><Stat label="Contactados" value={stats.contacted}/><Stat label="Ventas" value={stats.won}/></section>

    <section className="split"><div className="card"><h2 className="panel-title">Pipeline {loading&&<span className="muted"> · cargando...</span>}</h2><div className="table-wrap"><table className="table"><thead><tr><th>Negocio</th><th>Sector</th><th>Score</th><th>Estado</th></tr></thead><tbody>
      {prospects.map(p=><tr key={p.id} onClick={()=>{setSelected(p);setEditing(false);}} style={{cursor:'pointer'}}><td>{p.name}<div className="muted">{p.city}</div></td><td>{p.category}</td><td className={`score ${p.opportunityScore>=70?'hot':p.opportunityScore>=50?'mid':''}`}>{p.opportunityScore}</td><td><span className="badge">{p.status}</span></td></tr>)}
      {!loading&&prospects.length===0&&<tr><td colSpan={4}>No hay prospectos.</td></tr>}
    </tbody></table></div></div>

    <aside className="card"><h2 className="panel-title">Prospecto seleccionado</h2>{!selected?<p className="muted">Selecciona o agrega un prospecto.</p>:editing?<form onSubmit={saveEdit} className="form-grid">
      <Editable label="Negocio" value={editForm.name} onChange={v=>setEditForm({...editForm,name:v})}/><Editable label="Categoría" value={editForm.category} onChange={v=>setEditForm({...editForm,category:v})}/><Editable label="Ciudad" value={editForm.city} onChange={v=>setEditForm({...editForm,city:v})}/><Editable label="Sitio web" value={editForm.website} onChange={v=>setEditForm({...editForm,website:v})}/><Editable label="Teléfono" value={editForm.phone} onChange={v=>setEditForm({...editForm,phone:v})}/><Editable label="WhatsApp" value={editForm.whatsapp} onChange={v=>setEditForm({...editForm,whatsapp:v})}/><div className="toolbar full"><button className="btn" disabled={busy}>Guardar cambios</button><button type="button" className="btn secondary" onClick={()=>setEditing(false)}>Cancelar</button></div>
    </form>:<><div className="form-grid"><Field label="Negocio" value={selected.name}/><Field label="Categoría" value={selected.category}/><Field label="Ciudad" value={selected.city}/><Field label="Score" value={String(selected.opportunityScore)}/><Field label="Sitio web" value={selected.website||'No indicado'}/><Field label="WhatsApp" value={selected.whatsapp||'No indicado'}/><div className="field full"><label>Problema detectado</label><textarea readOnly value={selected.mainProblem||'Pendiente de análisis IA'}/></div><div className="field full"><label>Oportunidad comercial</label><textarea readOnly value={selected.salesOpportunity||'Pendiente de análisis IA'}/></div><div className="field full"><label>Mensaje sugerido</label><textarea readOnly value={selected.personalizedMessage||'Pendiente de generación IA'}/></div></div>
      <div className="toolbar"><button className="btn" disabled={busy} onClick={()=>analyze(selected)}>{busy?'Procesando...':'Analizar con IA'}</button><button className="btn secondary" disabled={busy||!selected.suggestedHeadline} onClick={()=>patchStatus(selected,'DEMO_CREATED')}>Generar demo</button><a className="btn secondary" href={`/demo/${selected.id}`} target="_blank">Ver demo</a><button className="btn secondary" disabled={busy} onClick={()=>patchStatus(selected,'CONTACTED')}>Marcar contactado</button><button className="btn secondary" disabled={busy} onClick={()=>setEditing(true)}>Editar</button><button className="btn secondary" disabled={busy} onClick={removeSelected}>Eliminar</button></div>
    </>}</aside></section>
  </main>
}

function parseCsv(text:string){
  const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted;
    } else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&text[i+1]==='\n') i++;
      row.push(cell); if(row.some(v=>v.length)) rows.push(row); row=[]; cell='';
    } else cell+=c;
  }
  row.push(cell); if(row.some(v=>v.length)) rows.push(row);
  return rows;
}
function normalizeHeader(value:string){return value.trim().toLowerCase().replace(/[ _-]/g,'');}
function Stat({label,value}:{label:string,value:number}){return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div></div>}
function Field({label,value}:{label:string,value:string}){return <div className="field"><label>{label}</label><input readOnly value={value}/></div>}
function Editable({label,value,onChange}:{label:string,value:string,onChange:(value:string)=>void}){return <div className="field"><label>{label}</label><input value={value} onChange={e=>onChange(e.target.value)}/></div>}
