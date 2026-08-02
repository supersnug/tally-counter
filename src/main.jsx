import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Plus, Minus, Settings2, RotateCcw, Trash2, X, Check, Target, Hash, Sparkles, Moon, Sun, Code2, Copy, BarChart3, Download, Upload, User, Cloud, LogOut } from 'lucide-react'
import './styles.css'
import { supabase, supabaseConfigured } from './supabase'

const COLORS = ['#ef6a47', '#2f7e70', '#4e65a8', '#d59c2e', '#9b5f85', '#63705b']
const EMBED_ORIGIN = 'https://your-tally-domain.example'
const TRASH_LIFETIME = 5 * 24 * 60 * 60 * 1000
const encodeCounter = counter => btoa(unescape(encodeURIComponent(JSON.stringify(sanitize(counter)))))
const decodeCounter = value => { try { return JSON.parse(decodeURIComponent(escape(atob(value)))) } catch { return null } }
const starter = [
  { id: 1, name: 'Morning laps', value: 18, start: 0, plusStep: 1, minusStep: 1, goals: [10, 20, 25], goalDirection: 'more', min: 0, max: 30, color: COLORS[1] },
  { id: 2, name: 'Inventory balance', value: -12, start: 0, plusStep: 5, minusStep: 3, goals: [-10, -20], goalDirection: 'less', min: -30, max: 50, color: COLORS[0] },
  { id: 3, name: 'Ideas captured', value: 42, start: 0, plusStep: 1, minusStep: 1, goals: [10, 25, 40], goalDirection: 'more', min: null, max: null, color: COLORS[2] },
]

const getGoals = counter => {
  const values = Array.isArray(counter.goals) ? counter.goals : (counter.goal == null || counter.goal === '' ? [] : [counter.goal])
  const direction = counter.goalDirection || (Number(counter.goal) < Number(counter.start) ? 'less' : 'more')
  return [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => direction === 'less' ? b - a : a - b)
}

const sanitize = (raw) => {
  let min = raw.min === '' || raw.min == null ? null : Number(raw.min)
  let max = raw.max === '' || raw.max == null ? null : Number(raw.max)
  if (min != null && max != null && min > max) [min, max] = [max, min]
  const clamp = value => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Number(value) || 0))
  return {
    ...raw,
    name: raw.name.trim() || 'Untitled counter',
    value: clamp(raw.value),
    start: clamp(raw.start),
    plusStep: Math.abs(Number(raw.plusStep)) || 1,
    minusStep: Math.abs(Number(raw.minusStep)) || 1,
    goals: getGoals(raw),
    goalDirection: raw.goalDirection === 'less' ? 'less' : 'more',
    min,
    max,
  }
}
const counterSignature = raw => {
  const counter = sanitize(raw)
  return [String(counter.id),counter.name,counter.value,counter.start,counter.plusStep,counter.minusStep,counter.goals,counter.goalDirection,counter.min,counter.max,counter.color]
}
const countersEqual = (first,second) => JSON.stringify(first.map(counterSignature)) === JSON.stringify(second.map(counterSignature))
const normalizeSuperSettings = raw => ({
  ...(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}),
  counterCustomizations:raw?.counterCustomizations&&typeof raw.counterCustomizations==='object'&&!Array.isArray(raw.counterCustomizations)?raw.counterCustomizations:{},
  uiCustomizations:raw?.uiCustomizations&&typeof raw.uiCustomizations==='object'&&!Array.isArray(raw.uiCustomizations)?raw.uiCustomizations:{},
})

function App() {
  const [counters, setCounters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tally-counters')) || [] } catch { return [] }
  })
  const [trash, setTrash] = useState(() => {
    try { return (JSON.parse(localStorage.getItem('tally-trash')) || []).filter(counter=>Date.now()-Number(counter.deletedAt)<TRASH_LIFETIME) } catch { return [] }
  })
  const [editing, setEditing] = useState(null)
  const [editingTrash, setEditingTrash] = useState(false)
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState(null)
  const [embedding, setEmbedding] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('tally-theme') || 'light')
  const [history, setHistory] = useState([])
  const [menu, setMenu] = useState(null)
  const [superEditorOpen,setSuperEditorOpen] = useState(false)
  const [statResets, setStatResets] = useState({})
  const [session,setSession] = useState(null)
  const [authOpen,setAuthOpen] = useState(false)
  const [syncReady,setSyncReady] = useState(false)
  const [syncStatus,setSyncStatus] = useState('Local only')
  const [syncConflict,setSyncConflict] = useState(null)
  const [authNotice,setAuthNotice] = useState('')
  const [superSettings,setSuperSettings] = useState(() => {
    try { return normalizeSuperSettings(JSON.parse(localStorage.getItem('tally-super'))) } catch { return normalizeSuperSettings({}) }
  })
  const [preferences, setPreferences] = useState(() => {
    const defaults = {density:'comfortable', columns:'auto', numberSize:'standard', showBounds:true, animations:true, defaultColor:COLORS[0], trashEnabled:true, syncTrash:true}
    try { return {...defaults,...JSON.parse(localStorage.getItem('tally-preferences'))} } catch { return defaults }
  })

  const route = new URLSearchParams(location.search)
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const relativePath = basePath && location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : location.pathname
  const currentPath = `/${relativePath}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'

  const validateRemoteUser = async () => {
    if (!supabase || !session) return true
    const {data,error} = await supabase.auth.getUser()
    if (data?.user) return true
    const accountIsGone = error?.status === 401 || error?.status === 403 || error?.code === 'user_not_found'
    if (!accountIsGone) return null
    await supabase.auth.signOut({scope:'local'})
    setSession(null)
    setSyncReady(false)
    setSyncConflict(null)
    setSyncStatus('Local only')
    setAuthNotice('Your account was deleted or this device is no longer authorized. You have been signed out, but your counters remain saved locally.')
    return false
  }

  useEffect(() => { if (currentPath === '/counters') localStorage.setItem('tally-counters', JSON.stringify(counters)) }, [counters, currentPath])
  useEffect(() => localStorage.setItem('tally-trash', JSON.stringify(trash)), [trash])
  useEffect(() => {
    const purge = () => setTrash(items=>{ const kept=items.filter(counter=>Date.now()-Number(counter.deletedAt)<TRASH_LIFETIME); return kept.length===items.length?items:kept })
    purge(); const timer=setInterval(purge,1000); return ()=>clearInterval(timer)
  },[])
  useEffect(() => localStorage.setItem('tally-preferences', JSON.stringify(preferences)), [preferences])
  useEffect(() => localStorage.setItem('tally-super', JSON.stringify(superSettings)), [superSettings])
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,nextSession)=>{ setSession(nextSession); if (nextSession) setAuthNotice('') })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !session) return
    const checkAccount = () => { if (document.visibilityState === 'visible') validateRemoteUser() }
    window.addEventListener('focus',checkAccount)
    document.addEventListener('visibilitychange',checkAccount)
    return () => {
      window.removeEventListener('focus',checkAccount)
      document.removeEventListener('visibilitychange',checkAccount)
    }
  },[session?.user?.id])
  useEffect(() => {
    if (!supabase || !session) { setSyncReady(false); setSyncConflict(null); setSyncStatus('Local only'); return }
    let cancelled=false
    const loadCloud = async () => {
      setSyncStatus('Loading cloud data…')
      const {data,error} = await supabase.from('user_data').select('counters,preferences,tally_super').eq('user_id',session.user.id).maybeSingle()
      if (cancelled) return
      if (error) { if (await validateRemoteUser() !== false) setSyncStatus('Sync error'); return }
      if (data) {
        const localCounters = counters.filter(counter=>counter.localOnly).map(sanitize)
        const deviceCounters = counters.filter(counter=>!counter.localOnly).map(sanitize)
        const cloudRows = Array.isArray(data.counters) ? data.counters : []
        const cloudCounters = cloudRows.filter(counter=>!counter.deletedAt).map(counter=>sanitize({...counter,localOnly:false}))
        const cloudTrash = cloudRows.filter(counter=>counter.deletedAt&&Date.now()-Number(counter.deletedAt)<TRASH_LIFETIME).map(counter=>sanitize({...counter,localOnly:false}))
        const mergedTrash = [...trash]
        cloudTrash.forEach(counter=>{if(!mergedTrash.some(item=>String(item.id)===String(counter.id)))mergedTrash.push(counter)})
        const syncCloudTrash = data.preferences?.syncTrash ?? preferences.syncTrash
        if (syncCloudTrash) setTrash(mergedTrash)
        const countersDiffer = !countersEqual(deviceCounters,cloudCounters)
        if (deviceCounters.length && cloudCounters.length && countersDiffer) {
          setSyncConflict({deviceCounters:[...localCounters,...deviceCounters],cloudCounters:[...localCounters,...cloudCounters],cloudPreferences:data.preferences,cloudSuper:data.tally_super})
          setSyncStatus('Choose sync data')
          return
        }
        if (cloudCounters.length) {
          setCounters([...localCounters,...cloudCounters])
          if (data.preferences) setPreferences(current=>({...current,...data.preferences}))
          if (data.tally_super) setSuperSettings(normalizeSuperSettings(data.tally_super))
        } else if (deviceCounters.length) {
          const {error:saveError} = await supabase.from('user_data').upsert({user_id:session.user.id,counters:[...deviceCounters,...(syncCloudTrash?mergedTrash.filter(counter=>!counter.localOnly):[])],preferences,tally_super:superSettings,updated_at:new Date().toISOString()},{onConflict:'user_id'})
          if (saveError) { if (await validateRemoteUser() !== false) setSyncStatus('Sync error'); return }
        } else {
          if (data.preferences) setPreferences(current=>({...current,...data.preferences}))
          if (data.tally_super) setSuperSettings(normalizeSuperSettings(data.tally_super))
        }
      } else {
        const {error:saveError} = await supabase.from('user_data').insert({user_id:session.user.id,counters:[...counters.filter(counter=>!counter.localOnly),...(preferences.syncTrash?trash.filter(counter=>!counter.localOnly):[])],preferences,tally_super:superSettings})
        if (saveError) { if (await validateRemoteUser() !== false) setSyncStatus('Sync error'); return }
      }
      setSyncReady(true); setSyncStatus('Synced')
    }
    loadCloud()
    return ()=>{cancelled=true}
  }, [session?.user?.id])
  const resolveSyncConflict = choice => {
    if (!syncConflict) return
    if (choice === 'cloud') {
      setCounters(syncConflict.cloudCounters)
      if (syncConflict.cloudPreferences) setPreferences(current=>({...current,...syncConflict.cloudPreferences}))
      if (syncConflict.cloudSuper) setSuperSettings(normalizeSuperSettings(syncConflict.cloudSuper))
    } else if (choice === 'merge') {
      const merged = [...syncConflict.deviceCounters]
      const existing = new Map(merged.map(counter=>[String(counter.id),counter]))
      syncConflict.cloudCounters.forEach((counter,index) => {
        const matching = existing.get(String(counter.id))
        if (!matching) {
          merged.push(counter)
          existing.set(String(counter.id),counter)
        } else if (!countersEqual([matching],[counter])) {
          merged.push({...counter,id:`${counter.id}-cloud-${Date.now()}-${index}`,name:`${counter.name} (cloud)`})
        }
      })
      setCounters(merged)
    }
    setSyncConflict(null)
    setSyncReady(true)
    setSyncStatus('Saving…')
  }
  useEffect(() => {
    if (!supabase || !session || !syncReady) return
    setSyncStatus('Saving…')
    const timer=setTimeout(async()=>{
      const {error}=await supabase.from('user_data').upsert({user_id:session.user.id,counters:[...counters.filter(counter=>!counter.localOnly),...(preferences.syncTrash?trash.filter(counter=>!counter.localOnly):[])],preferences,tally_super:superSettings,updated_at:new Date().toISOString()},{onConflict:'user_id'})
      if (error) {
        if (await validateRemoteUser() !== false) setSyncStatus('Sync error')
      } else setSyncStatus('Synced')
    },700)
    return ()=>clearTimeout(timer)
  },[counters,trash,preferences,superSettings,session?.user?.id,syncReady])
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const isEmbedPage = location.pathname.replace(/\/$/, '').endsWith('/embed') || query.has('embedData')
    if (isEmbedPage) return
    localStorage.setItem('tally-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  if (currentPath === '/embed' || route.has('embedData')) {
    const embeddedCounter = decodeCounter(route.get('data') || route.get('embedData'))
    return embeddedCounter ? <EmbeddedCounter initial={embeddedCounter} params={route}/> : <div className="embed-error"><Hash/><h1>Counter not found</h1><p>This embed link is missing its counter data.</p></div>
  }
  if (currentPath !== '/' && currentPath !== '/counters') return <NotFound/>

  const setValue = (id, requested, kind = 'set') => {
    const counter = counters.find(c=>c.id===id)
    if (!counter) return
    const value = Math.max(counter.min ?? -Infinity, Math.min(counter.max ?? Infinity, Number(requested)))
    if (!Number.isFinite(value) || value === counter.value) return
    setHistory(log => [...log.slice(-999), {id, name:counter.name, from:counter.value, to:value, kind, time:Date.now()}])
    setCounters(items => items.map(c => c.id === id ? {...c,value} : c))
  }
  const change = (id, amount) => {
    const counter = counters.find(c=>c.id===id)
    if (counter) setValue(id, counter.value + amount, amount > 0 ? 'increment' : 'decrement')
  }
  const patchCounter=(id,changes)=>setCounters(items=>items.map(counter=>counter.id===id?sanitize({...counter,...changes}):counter))
  const reset = id => {
    const counter = counters.find(c=>c.id===id)
    if (counter) setValue(id, counter.start, 'reset')
  }
  const importBackup = (data,scope,options={}) => {
    if (!data || typeof data !== 'object') throw new Error('This file is not a valid Tally backup.')
    let importedCounters
    if (scope==='counters'||scope==='all') {
      if (!Array.isArray(data.counters)) throw new Error('This backup does not contain counter data.')
      if (data.counters.some(counter=>!counter||typeof counter!=='object'||typeof counter.name!=='string')) throw new Error('The backup contains invalid counter data.')
      importedCounters=data.counters.map((counter,index)=>sanitize({...counter,id:counter.id??`${Date.now()}-${index}`}))
    }
    if ((scope==='super'||scope==='all') && (!data.tallySuper||typeof data.tallySuper!=='object'||Array.isArray(data.tallySuper))) throw new Error('This backup does not contain Tally Super data.')
    if ((scope==='super'||scope==='all') && (!data.preferences||typeof data.preferences!=='object'||Array.isArray(data.preferences))) throw new Error('This backup does not contain customization settings.')
    if (scope==='counters'&&options.includeCounterCustomizations&&(!data.counterCustomizations||typeof data.counterCustomizations!=='object'||Array.isArray(data.counterCustomizations))) throw new Error('This counter backup does not contain per-counter customizations.')
    const label=scope==='all'?'all Tally data':scope==='super'?'Tally Super and customization settings':'counter data'
    if (!confirm(`Replace the current ${label} with this backup?`)) return false
    if (importedCounters) { setCounters(importedCounters); setHistory([]) }
    if (scope==='counters'&&options.includeCounterCustomizations) setSuperSettings(current=>({...current,counterCustomizations:data.counterCustomizations}))
    if (scope==='super'||scope==='all') {
      setSuperSettings(normalizeSuperSettings(data.tallySuper))
      if (data.preferences&&typeof data.preferences==='object'&&!Array.isArray(data.preferences)) setPreferences(current=>({...current,...data.preferences}))
    }
    return true
  }
  const save = draft => {
    const clean = sanitize(draft)
    if (editingTrash) setTrash(items=>items.map(counter=>counter.id===clean.id?{...clean,deletedAt:counter.deletedAt}:counter))
    else setCounters(items => items.some(c => c.id === clean.id) ? items.map(c => c.id === clean.id ? clean : c) : [...items, clean])
    setEditing(null)
    setEditingTrash(false)
  }
  const edit = (counter,inTrash=false) => { setEditingTrash(inTrash); setEditing({...counter, goals: getGoals(counter), goalDirection: counter.goalDirection || (counter.goal < counter.start ? 'less' : 'more')}) }
  const create = () => { setEditingTrash(false); setEditing({ id: Date.now(), name: '', value: 0, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: 'more', min: '', max: '', color: preferences.defaultColor, localOnly:false }) }
  const removeCounter = counter => {
    if (!preferences.trashEnabled) { setPendingPermanentDelete(counter); return }
    setCounters(items=>items.filter(item=>item.id!==counter.id))
    setTrash(items=>[{...counter,deletedAt:Date.now()},...items.filter(item=>item.id!==counter.id)])
  }
  const restoreCounter = counter => {
    const {deletedAt,...restored}=counter
    setTrash(items=>items.filter(item=>item.id!==counter.id))
    setCounters(items=>[...items,{...restored,id:items.some(item=>String(item.id)===String(restored.id))?`${restored.id}-restored-${Date.now()}`:restored.id}])
  }
  const changeTrash = (id,amount) => setTrash(items=>items.map(counter=>counter.id===id?{...counter,value:Math.max(counter.min??-Infinity,Math.min(counter.max??Infinity,counter.value+amount))}:counter))
  const removeSuperItem = id => setSuperSettings(current=>({...current,uiCustomizations:{...current.uiCustomizations,items:(current.uiCustomizations.items||[]).filter(item=>item.id!==id)}}))
  const updateSuperItem = (id,changes) => setSuperSettings(current=>({...current,uiCustomizations:{...current.uiCustomizations,items:(current.uiCustomizations.items||[]).map(item=>item.id===id?{...item,...changes}:item)}}))

  if (currentPath === '/') return <LandingPage theme={theme}/>

  return <div className={`app-shell density-${preferences.density} numbers-${preferences.numberSize} ${preferences.animations?'':'no-animations'} ${superEditorOpen?'super-editing':''}`} data-theme={theme}>
    <header data-super-zone="top">
      <a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark"><span></span><span></span><span></span><span></span></span>TALLY</a>
      <SuperZoneContent zone="top" items={superSettings.uiCustomizations.items} counters={counters} history={history} onRemove={superEditorOpen?removeSuperItem:null} onUpdate={superEditorOpen?updateSuperItem:null}/>
      <div className="header-actions"><button className={`account-button ${session?'signed-in':''}`} onClick={()=>setAuthOpen(true)} title={session?.user?.email||'Sign in'}>{session?<Cloud/>:<User/>}<span>{session?syncStatus:'Sign in'}</span></button><button className="header-tool" onClick={()=>setMenu('trash')}><Trash2/> <span>Trash{trash.length?` (${trash.length})`:''}</span></button><button className="header-tool" onClick={()=>setMenu('stats')}><BarChart3/> <span>Stats</span></button><button className="header-tool" onClick={()=>setMenu('settings')}><Settings2/> <span>Settings</span></button><button className="theme-toggle" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label={`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon/>:<Sun/>}</button><button className="add-top" onClick={create}><Plus size={18}/> New counter</button></div>
    </header>
    {authNotice&&<div className="session-notice" role="alert"><div><strong>Account access ended</strong><span>{authNotice}</span></div><button onClick={()=>setAuthNotice('')} aria-label="Dismiss message"><X/></button></div>}

    <main data-super-zone="workspace">
      <SuperZoneContent zone="workspace" items={superSettings.uiCustomizations.items} counters={counters} history={history} onRemove={superEditorOpen?removeSuperItem:null} onUpdate={superEditorOpen?updateSuperItem:null}/>
      <section className="workspace-heading">
        <div><span className="eyebrow"><Hash/> YOUR WORKSPACE</span><h1>My counters</h1></div>
        <div className="summary">
          <div><strong>{counters.length}</strong><span>active counters</span></div>
          <i></i>
          <div><strong>{counters.filter(isComplete).length}</strong><span>goals complete</span></div>
        </div>
      </section>

      <section className="counter-section">
        <div className="section-heading"><div><span>MY COUNTERS</span><h2>Today’s tallies</h2></div><button className="round-add" onClick={create} aria-label="Add counter"><Plus/></button></div>
        <div className={`grid columns-${preferences.columns}`}>
          {counters.map((counter, index) => <CounterCard key={counter.id} counter={counter} index={index} showBounds={preferences.showBounds} showLocalBanner={Boolean(session)} customization={superSettings.counterCustomizations?.[String(counter.id)]} onPatch={patchCounter} onChange={change} onEdit={() => edit(counter)} onEmbed={() => setEmbedding(counter)} onDelete={() => removeCounter(counter)} onReset={() => reset(counter.id)}/>) }
          <button className="new-card" onClick={create}><span><Plus/></span><strong>Add another counter</strong><small>Start tracking something new</small></button>
        </div>
      </section>
    </main>
    <footer data-super-zone="bottom"><span>Built for the little things that add up.</span><SuperZoneContent zone="bottom" items={superSettings.uiCustomizations.items} counters={counters} history={history} onRemove={superEditorOpen?removeSuperItem:null} onUpdate={superEditorOpen?updateSuperItem:null}/><div><span>{session?'Saved on this device and synced to the cloud':'Saved automatically on this device'}</span><a href="https://github.com/supersnug/tally-counter" target="_blank" rel="noreferrer">View on GitHub</a></div></footer>
    {editing && <Editor draft={editing} setDraft={setEditing} isNew={!editingTrash&&!counters.some(counter=>counter.id===editing.id)} showLocalOption={Boolean(session)&&(!editingTrash||preferences.syncTrash)} superCustomization={superSettings.counterCustomizations?.[String(editing.id)]} onSuperCustomization={customization=>setSuperSettings(current=>({...current,counterCustomizations:{...current.counterCustomizations,[String(editing.id)]:customization}}))} onClose={() => {setEditing(null);setEditingTrash(false)}} onSave={save}/>}
    {embedding && <EmbedBuilder counter={embedding} onClose={()=>setEmbedding(null)}/>}
    {menu==='settings'&&<AppSettings counters={counters} history={history} preferences={preferences} superSettings={superSettings} onStartSuperEditor={()=>{setMenu(null);setSuperEditorOpen(true)}} onSuperSettings={setSuperSettings} onPreferences={setPreferences} onImport={importBackup} onClose={()=>setMenu(null)}/>}
    {menu==='trash'&&<TrashModal items={trash} showBounds={preferences.showBounds} showLocalBanner={Boolean(session)&&preferences.syncTrash} onChange={changeTrash} onEdit={counter=>{setMenu(null);edit(counter,true)}} onEmbed={setEmbedding} onRestore={restoreCounter} onDelete={counter=>setTrash(items=>items.filter(item=>item.id!==counter.id))} onClose={()=>setMenu(null)}/>}
    {menu==='stats'&&<StatsModal history={history} counters={counters} superItems={superSettings.uiCustomizations.items} resets={statResets} onResetStat={key=>setStatResets(r=>({...r,[key]:Date.now()}))} onResetAll={()=>{setHistory([]);setStatResets({})}} onClose={()=>setMenu(null)}/>}
    {pendingPermanentDelete&&<div className="modal-backdrop trash-confirm-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setPendingPermanentDelete(null)}><div className="modal trash-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="active-delete-confirm-title"><div className="modal-head"><div><span>PERMANENT DELETE</span><h2 id="active-delete-confirm-title">Delete “{pendingPermanentDelete.name}” forever?</h2></div><button onClick={()=>setPendingPermanentDelete(null)}><X/></button></div><p>Trash is turned off, so this counter cannot be restored after it is deleted.</p><div className="modal-footer"><button className="cancel" onClick={()=>setPendingPermanentDelete(null)}>Cancel</button><button className="save trash-confirm-delete" onClick={()=>{setCounters(items=>items.filter(item=>item.id!==pendingPermanentDelete.id));setPendingPermanentDelete(null)}}><Trash2/> Delete forever</button></div></div></div>}
    {authOpen&&<AuthModal session={session} configured={supabaseConfigured} syncStatus={syncStatus} onDeleted={()=>{setCounters([]);setTrash([]);localStorage.removeItem('tally-counters');localStorage.removeItem('tally-trash');setAuthOpen(false)}} onClose={()=>setAuthOpen(false)}/>}
    {syncConflict&&<SyncConflictModal deviceCount={syncConflict.deviceCounters.length} cloudCount={syncConflict.cloudCounters.length} onChoose={resolveSyncConflict}/>}
    {superEditorOpen&&<SuperEditorPane counters={counters} value={superSettings.uiCustomizations} onChange={uiCustomizations=>setSuperSettings(current=>({...current,uiCustomizations}))} onClose={()=>setSuperEditorOpen(false)}/>}
  </div>
}

function LandingPage({theme}) {
  const [demos,setDemos] = useState(()=>starter.map(counter=>({...counter,goals:[...counter.goals]})))
  const [editing,setEditing] = useState(null)
  const [embedding,setEmbedding] = useState(null)
  const setValue = (id,requested) => setDemos(items=>items.map(counter=>counter.id===id?{...counter,value:Math.max(counter.min??-Infinity,Math.min(counter.max??Infinity,requested))}:counter))
  const save = draft => { const clean=sanitize(draft); setDemos(items=>items.map(counter=>counter.id===clean.id?clean:counter)); setEditing(null) }
  const countersUrl = `${import.meta.env.BASE_URL}counters`
  return <div className="landing-page" data-theme={theme}>
    <main className="landing-main">
      <section className="landing-hero"><a className="brand landing-brand" href={import.meta.env.BASE_URL}><span className="brand-mark"><span></span><span></span><span></span><span></span></span>TALLY</a><div className="eyebrow"><Sparkles/> Your everyday counting space</div><h1>Keep count.<br/><em>Stay on track.</em></h1><p>Flexible, private counters for goals, habits, inventory, scores, and everything else that adds up.</p><a className="start-counting" href={countersUrl}>Start counting <span>→</span></a><small>Account optional · Saved on your device</small></section>
      <section className="landing-demo"><div className="landing-section-title"><span>TRY IT NOW</span><h2>Real counters. No commitment.</h2><p>These demos have every feature enabled. Change their values, goals, colors, or limits—they reset when you leave.</p></div><div className="grid demo-grid">{demos.map((counter,index)=><CounterCard key={counter.id} counter={counter} index={index} showBounds onChange={(id,amount)=>setValue(id,counter.value+amount)} onEdit={()=>setEditing({...counter,goals:getGoals(counter)})} onEmbed={()=>setEmbedding(counter)} onDelete={()=>setDemos(items=>items.filter(c=>c.id!==counter.id))} onReset={()=>setValue(counter.id,counter.start)}/>)}</div></section>
      <section className="landing-features"><div><Hash/><h3>Count your way</h3><p>Use positive or negative values, different step sizes, and exact hard limits.</p></div><div><Target/><h3>Milestones that move</h3><p>Build multi-goal paths with smooth progress in either direction.</p></div><div><Code2/><h3>Ready to share</h3><p>Customize and embed an interactive counter into another website.</p></div></section>
      <section className="landing-cta"><span>READY WHEN YOU ARE</span><h2>Start with one.<br/>Count anything.</h2><a className="start-counting" href={countersUrl}>Open my counters <span>→</span></a></section>
    </main>
    <footer><span>Built for the little things that add up.</span><div><a href="https://github.com/supersnug/tally-counter" target="_blank" rel="noreferrer">View on GitHub</a></div></footer>
    {editing&&<Editor draft={editing} setDraft={setEditing} isNew={false} onClose={()=>setEditing(null)} onSave={save}/>}
    {embedding&&<EmbedBuilder counter={embedding} onClose={()=>setEmbedding(null)}/>}
  </div>
}

function isComplete(c) {
  const goals = getGoals(c)
  if (!goals.length) return false
  const finalGoal = goals.at(-1)
  const direction = c.goalDirection || (c.goal < c.start ? 'less' : 'more')
  return direction === 'less' ? c.value <= finalGoal : c.value >= finalGoal
}

const COUNTER_SUPER_PARTS=[
  ['embed','Embed button',true,true],['reset','Reset button',true,true],['settings','Settings button',false,true],['delete','Delete button',false,true],['title','Counter title',false,false],['count','Count',false,false],['goal','Goal bar',true,false],['add','Add button',false,false],['subtract','Subtract button',true,false],['minimum','Minimum indicator',true,false],['maximum','Maximum indicator',true,false],
  ['quick-plusStep','Quick setting · Positive step',true,false],['quick-minusStep','Quick setting · Negative step',true,false],['quick-min','Quick setting · Minimum',true,false],['quick-max','Quick setting · Maximum',true,false],['quick-color','Quick setting · Color',true,false],['quick-goalDirection','Quick setting · Goal direction',true,false],
]
const counterPartStyle=(customization,type,{button=false,fixed=false}={})=>{
  const part=customization?.parts?.[type]||{}
  if(part.hidden)return{display:'none'}
  const x=part.x||0,y=part.y||0,rotation=part.rotation||0,scaleX=part.scaleX||1,scaleY=part.scaleY||1
  if(button&&!fixed)return{transform:`translate(${x}px,${y}px) rotate(${rotation}deg)`,width:part.width||undefined,height:part.height||undefined}
  return{transform:`translate(${x}px,${y}px) rotate(${rotation}deg) scale(${fixed?1:scaleX},${fixed?1:scaleY})`}
}

function CounterCard({counter:c, index, showBounds, showLocalBanner=false, customization={}, onPatch, onChange, onEdit, onEmbed, onDelete, onReset}) {
  const goals = getGoals(c)
  const [visualValue,setVisualValue] = useState(c.value)
  const animationQueue = useRef([])
  useEffect(() => {
    if (visualValue === c.value) return
    const boundaries = goals
      .filter(goal => c.value > visualValue ? goal > visualValue && goal < c.value : goal < visualValue && goal > c.value)
      .sort((a,b) => c.value > visualValue ? a-b : b-a)
    animationQueue.current = [...boundaries,c.value]
    setVisualValue(animationQueue.current.shift())
  }, [c.value])
  const continueProgressAnimation = event => {
    if (event.propertyName !== 'width' || !animationQueue.current.length) return
    setVisualValue(animationQueue.current.shift())
  }
  const direction = c.goalDirection || (c.goal < c.start ? 'less' : 'more')
  const finalGoal = goals.at(-1)
  const complete = goals.length > 0 && (direction === 'less' ? visualValue <= finalGoal : visualValue >= finalGoal)
  const hasGoal = goals.length > 0
  const reached = goal => direction === 'less' ? visualValue <= goal : visualValue >= goal
  const completedCount = goals.filter(reached).length
  const nextGoal = goals.find(goal => !reached(goal))
  const directedProgress = (value, from, to) => {
    const distance = direction === 'less' ? from - to : to - from
    const travelled = direction === 'less' ? from - value : value - from
    if (distance <= 0) return reached(to) ? 100 : 0
    return (travelled / distance) * 100
  }
  const boundedProgress = value => Math.max(0, Math.min(100, value))
  const activeIndex = complete ? goals.length : completedCount
  const activeOrigin = activeIndex > 0
    ? goals[activeIndex - 1]
    : c.start
  const nextProgress = nextGoal == null ? 100 : directedProgress(visualValue, activeOrigin, nextGoal)
  const finalProgress = directedProgress(visualValue, c.start, goals.at(-1))
  const maximumProgress = c.max == null || c.max === c.start ? null : ((visualValue - c.start) / (c.max - c.start)) * 100
  const atMin = c.min != null && c.value <= c.min
  const atMax = c.max != null && c.value >= c.max
  const renderQuickSetting=raw=>{const key=typeof raw==='string'?raw:raw.type,control=key==='color'?<input type="color" value={c.color} title="Counter color" onChange={event=>onPatch?.(c.id,{color:event.target.value})}/>:key==='goalDirection'?<button type="button" onClick={()=>onPatch?.(c.id,{goalDirection:c.goalDirection==='less'?'more':'less'})}>Goal: {c.goalDirection}</button>:<label>{key}<input type="number" value={c[key]??''} onChange={event=>onPatch?.(c.id,{[key]:event.target.value===''?null:Number(event.target.value)})}/></label>;return <div key={key} data-counter-part={`quick-${key}`} style={counterPartStyle(customization,`quick-${key}`)}>{control}</div>}
  return <article className="counter-card" data-counter-id={c.id} style={{'--accent': c.color, '--delay': `${index * 60}ms`}}>
    {c.localOnly&&showLocalBanner&&<div className="local-counter-banner">Local counter</div>}
    <div className="card-top"><span className="counter-index">{String(index+1).padStart(2,'0')}</span><div className="card-actions"><button data-counter-part="embed" style={counterPartStyle(customization,'embed',{fixed:true})} onClick={onEmbed} title="Embed"><Code2/></button><button data-counter-part="reset" style={counterPartStyle(customization,'reset',{fixed:true})} onClick={onReset} title="Reset"><RotateCcw/></button><button data-counter-part="settings" style={counterPartStyle(customization,'settings',{fixed:true})} onClick={onEdit} title="Settings"><Settings2/></button><button data-counter-part="delete" style={counterPartStyle(customization,'delete',{fixed:true})} onClick={onDelete} title="Delete"><Trash2/></button></div></div>
    <h3 data-counter-part="title" style={counterPartStyle(customization,'title')}>{c.name}</h3>
    <div className="number" data-counter-part="count" style={counterPartStyle(customization,'count')}>{c.value.toLocaleString()}</div>
    {hasGoal ? <div data-counter-part="goal" className={`goal direction-${direction} ${complete ? 'complete':''}`} style={counterPartStyle(customization,'goal')}>
      <div className="goal-label"><span>{complete ? <><Check/> All goals complete</> : <><Target/> Next: {nextGoal.toLocaleString()} or {direction}</>}</span><div className="progress-detail" tabIndex="0"><b>{Math.round(nextProgress)}%</b><div className="progress-tooltip"><span>To next goal<strong>{Math.round(nextProgress)}%</strong></span><span>To final goal<strong>{Math.round(finalProgress)}%</strong></span>{maximumProgress != null && <span>To maximum<strong>{Math.round(maximumProgress)}%</strong></span>}</div></div></div>
      <div className={`track sliced direction-${direction}`}>{goals.map((goal, i) => {
        const from = i > 0 ? goals[i - 1] : c.start
        const fill = reached(goal) ? 100 : (i === activeIndex ? boundedProgress(directedProgress(visualValue, from, goal)) : 0)
        return <span key={goal} className={reached(goal) ? 'reached' : ''} title={`Goal ${i + 1}: ${goal}`}><em style={{width:`${fill}%`}} onTransitionEnd={continueProgressAnimation}></em><i>{goal}</i></span>
      })}</div>
    </div> : <div className="no-goal" data-counter-part="goal" style={counterPartStyle(customization,'goal')}><Hash/> No goal set</div>}
    <div className="controls">
      <button type="button" data-counter-part="subtract" className="count-button negative" style={counterPartStyle(customization,'subtract',{button:true})} disabled={atMin} onClick={() => onChange(c.id, -c.minusStep)}><Minus/><span>−{c.minusStep}</span></button>
      <button type="button" data-counter-part="add" className="count-button positive" style={counterPartStyle(customization,'add',{button:true})} disabled={atMax} onClick={() => onChange(c.id, c.plusStep)}><Plus/><span>+{c.plusStep}</span></button>
    </div>
    {showBounds&&<div className="bounds"><span data-counter-part="minimum" style={counterPartStyle(customization,'minimum')}>{c.min == null ? 'No minimum' : `Min ${c.min}`}{atMin && ' · reached'}</span><span data-counter-part="maximum" style={counterPartStyle(customization,'maximum')}>{c.max == null ? 'No maximum' : `Max ${c.max}`}{atMax && ' · reached'}</span></div>}
    {customization.quickSettings?.length>0&&<div className="counter-quick-settings">{customization.quickSettings.map(renderQuickSetting)}</div>}
  </article>
}

function CounterSuperInspector({value={},onChange,selectedFromStage}) {
  const activeQuick=value.quickSettings||[]
  const quickLabels={plusStep:'Positive step',minusStep:'Negative step',min:'Minimum',max:'Maximum',color:'Color',goalDirection:'Goal direction'}
  COUNTER_SUPER_PARTS.forEach(partDefinition=>{if(partDefinition[0].startsWith('quick-')){const key=partDefinition[0].slice(6);partDefinition[1]=activeQuick.includes(key)?`Quick setting · ${quickLabels[key]}`:''}})
  const [selected,setSelected]=useState(selectedFromStage||'title'),parts=value.parts||{},definition=COUNTER_SUPER_PARTS.find(([key])=>key===selected),part=parts[selected]||{}
  useEffect(()=>{if(selectedFromStage)setSelected(selectedFromStage)},[selectedFromStage])
  useEffect(()=>{if(selected.startsWith('quick-')&&!activeQuick.includes(selected.slice(6)))setSelected('title')},[activeQuick.join('|'),selected])
  const update=changes=>{if(selected.startsWith('quick-')&&changes.hidden){const key=selected.slice(6);onChange?.({...value,quickSettings:activeQuick.filter(item=>item!==key),parts:{...parts,[selected]:{}}});setSelected('title');return}onChange?.({...value,parts:{...parts,[selected]:{...part,...changes}}})}
  const quick=value.quickSettings||[]
  const toggleQuick=key=>{const partKey=`quick-${key}`,enabled=quick.includes(key);onChange?.({...value,quickSettings:enabled?quick.filter(item=>item!==key):[...quick,key],parts:{...parts,[partKey]:enabled?{}:{...parts[partKey],hidden:false}}})}
  return <div className="counter-super-editor"><div className="counter-super-toolbox"><span className="super-logo"><Sparkles/> TALLY SUPER</span><small>Choose a counter element to transform.</small>{COUNTER_SUPER_PARTS.map(([key,label,deletable,fixed])=><button type="button" key={key} className={`${selected===key?'active':''} ${part.hidden?'hidden':''}`} onClick={()=>setSelected(key)}><span>{label}</span><small>{fixed?'Fixed size':deletable?'Optional':'Required'}</small></button>)}</div><div className="counter-super-inspector"><div className="counter-part-preview" style={{transform:`translate(${part.x||0}px,${part.y||0}px) rotate(${part.rotation||0}deg) scale(${part.scaleX||1},${part.scaleY||1})`}}>{definition?.[1]}</div><div className="counter-transform-grid"><label>X position<input type="range" min="-120" max="120" value={part.x||0} onChange={event=>update({x:Number(event.target.value)})}/><b>{part.x||0}px</b></label><label>Y position<input type="range" min="-120" max="120" value={part.y||0} onChange={event=>update({y:Number(event.target.value)})}/><b>{part.y||0}px</b></label><label>Rotation<input type="range" min="-180" max="180" value={part.rotation||0} onChange={event=>update({rotation:Number(event.target.value)})}/><b>{part.rotation||0}°</b></label>{!definition?.[3]&&selected!=='add'&&selected!=='subtract'&&<><label>Width scale<input type="range" min="25" max="400" value={(part.scaleX||1)*100} onChange={event=>update({scaleX:Number(event.target.value)/100})}/><b>{Math.round((part.scaleX||1)*100)}%</b></label><label>Height scale<input type="range" min="25" max="400" value={(part.scaleY||1)*100} onChange={event=>update({scaleY:Number(event.target.value)/100})}/><b>{Math.round((part.scaleY||1)*100)}%</b></label></>}{(selected==='add'||selected==='subtract')&&<><label>Button width<input type="range" min="70" max="280" value={part.width||140} onChange={event=>update({width:Number(event.target.value)})}/><b>{part.width||140}px</b></label><label>Button height<input type="range" min="40" max="140" value={part.height||62} onChange={event=>update({height:Number(event.target.value)})}/><b>{part.height||62}px</b></label></>}</div><div className="counter-part-actions">{definition?.[2]&&<button type="button" className={part.hidden?'restore':''} onClick={()=>update({hidden:!part.hidden})}>{part.hidden?<><Plus/> Restore element</>:<><Trash2/> Delete element</>}</button>}<button type="button" onClick={()=>onChange?.({...value,parts:{...parts,[selected]:{}}})}><RotateCcw/> Reset transform</button></div><div className="quick-settings-builder"><b>Quick settings</b><small>Add live controls directly to this counter.</small><div>{[['plusStep','Positive step'],['minusStep','Negative step'],['min','Minimum'],['max','Maximum'],['color','Color'],['goalDirection','Goal direction']].map(([key,label])=><button type="button" key={key} className={quick.includes(key)?'active':''} onClick={()=>toggleQuick(key)}>{quick.includes(key)?<Check/>:<Plus/>}{label}</button>)}</div></div></div></div>
}

function CounterSuperCustomization({counter,value={},onChange,onDone}) {
  const [selected,setSelected]=useState('title')
  const [sourceStyle,setSourceStyle]=useState(null)
  useEffect(()=>{
    const source=[...document.querySelectorAll(`[data-counter-id="${counter.id}"]`)].find(element=>!element.closest('.counter-super-card-wrap'))
    if(!source)return
    const cardStyle=getComputedStyle(source),numberStyle=getComputedStyle(source.querySelector('.number')),buttonStyle=getComputedStyle(source.querySelector('.count-button')),box=source.getBoundingClientRect()
    setSourceStyle({width:box.width,height:box.height,padding:cardStyle.padding,fontSize:numberStyle.fontSize,buttonHeight:buttonStyle.height})
  },[counter.id])
  useEffect(()=>{
    const editor=document.querySelector('.counter-super-fullscreen');if(!editor||!sourceStyle)return
    editor.style.setProperty('--editor-counter-width',`${sourceStyle.width}px`);editor.style.setProperty('--editor-counter-height',`${sourceStyle.height}px`);editor.style.setProperty('--editor-counter-padding',sourceStyle.padding);editor.style.setProperty('--editor-number-size',sourceStyle.fontSize);editor.style.setProperty('--editor-button-height',sourceStyle.buttonHeight)
  },[sourceStyle])
  const dragPart=event=>{
    const target=event.target.closest('[data-counter-part]');if(!target||event.button!==0)return
    const key=target.dataset.counterPart;setSelected(key);if(event.target.closest('input,select')||(key.startsWith('quick-')&&event.target.closest('button')))return
    const card=target.closest('.counter-card'),cardBox=card.getBoundingClientRect(),targetBox=target.getBoundingClientRect(),part=value.parts?.[key]||{},origin={clientX:event.clientX,clientY:event.clientY,x:part.x||0,y:part.y||0};event.preventDefault()
    const move=next=>{const dx=Math.max(cardBox.left-targetBox.left,Math.min(cardBox.right-targetBox.right,next.clientX-origin.clientX)),dy=Math.max(cardBox.top-targetBox.top,Math.min(cardBox.bottom-targetBox.bottom,next.clientY-origin.clientY));onChange({...value,parts:{...(value.parts||{}),[key]:{...part,x:origin.x+dx,y:origin.y+dy}}})}
    const end=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end)}
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',end)
  }
  return <div className="counter-super-fullscreen"><main className="counter-super-stage"><div className="counter-super-stage-head"><span className="super-logo"><Sparkles/> COUNTER EDITOR</span><small>Drag any highlighted counter element to move it.</small></div><div className="counter-super-card-wrap" onPointerDown={dragPart}><CounterCard counter={counter} index={0} showBounds customization={value} onPatch={()=>{}} onChange={()=>{}} onEdit={()=>{}} onEmbed={()=>{}} onDelete={()=>{}} onReset={()=>{}}/></div></main><aside className="counter-super-side"><div className="counter-super-side-head"><b>Tally Super</b><button type="button" onClick={onDone}><X/></button></div><CounterSuperInspector value={value} onChange={onChange} selectedFromStage={selected}/><button type="button" className="super-editor-done" onClick={onDone}>Done</button></aside></div>
}

function Editor({draft, setDraft, isNew, showLocalOption=false, superCustomization={}, onSuperCustomization, onClose, onSave}) {
  const field = (key, value) => setDraft(d => ({...d, [key]:value, ...(isNew&&key==='start'?{value}: {})}))
  const [goalInput, setGoalInput] = useState('')
  const [tab,setTab]=useState('counter')
  const addGoal = () => {
    const goal = Number(goalInput)
    if (!Number.isFinite(goal) || goalInput.trim() === '') return
    field('goals', [...new Set([...(draft.goals || []), goal])])
    setGoalInput('')
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={e => {e.preventDefault(); if(tab==='counter')onSave(draft)}}>
      <div className="modal-head"><div><span>COUNTER SETTINGS</span><h2>{isNew?'Create a new counter':'Fine-tune your tally'}</h2></div><button type="button" onClick={onClose}><X/></button></div>
      {!isNew&&<nav className="counter-settings-tabs"><button type="button" className={tab==='counter'?'active':''} onClick={()=>setTab('counter')}>Counter</button><button type="button" className={tab==='super'?'active':''} onClick={()=>setTab('super')}>Tally Super</button></nav>}
      {tab==='counter'?<>
      <label className="wide">Counter name<input autoFocus value={draft.name} onChange={e=>field('name',e.target.value)} placeholder="e.g. Water glasses"/></label>
      <div className="form-grid">
        <label className={isNew?'editor-start-wide':''}>Starting value<input type="number" value={draft.start} onChange={e=>field('start',e.target.value)}/></label>
        {!isNew&&<label>Exact value<input type="number" value={draft.value} onChange={e=>field('value',e.target.value)}/></label>}
        <label>Positive step<input type="number" min="0.000001" step="any" value={draft.plusStep} onChange={e=>field('plusStep',e.target.value)}/></label>
        <label>Negative step<input type="number" min="0.000001" step="any" value={draft.minusStep} onChange={e=>field('minusStep',e.target.value)}/></label>
      </div>
      {!isNew&&<label className="jump-select">Jump to saved value<select value="" onChange={e=>{if(e.target.value!=='')field('value',Number(e.target.value))}}><option value="">Choose a value…</option>{[draft.start,draft.min,draft.max,...getGoals(draft)].filter((v,i,a)=>v!==''&&v!=null&&a.indexOf(v)===i).map(value=><option value={value} key={value}>{value===draft.start?'Start':getGoals(draft).includes(Number(value))?'Goal':value===draft.min?'Minimum':'Maximum'} · {value}</option>)}</select></label>}
      <div className="form-divider"><span>Optional limits & goals</span></div>
      <div className="form-grid">
        <label>Minimum<input type="number" value={draft.min ?? ''} onChange={e=>field('min',e.target.value)} placeholder="None"/></label>
        <label>Maximum<input type="number" value={draft.max ?? ''} onChange={e=>field('max',e.target.value)} placeholder="None"/></label>
      </div>
      <div className="goal-builder">
        <label>Goal direction<div className="direction-toggle"><button type="button" className={draft.goalDirection === 'more' ? 'active':''} onClick={()=>field('goalDirection','more')}>More than ↑</button><button type="button" className={draft.goalDirection === 'less' ? 'active':''} onClick={()=>field('goalDirection','less')}>Less than ↓</button></div></label>
        <label>Milestone values<div className="goal-input"><input type="number" value={goalInput} onChange={e=>setGoalInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addGoal()}}} placeholder="Enter a goal"/><button type="button" onClick={addGoal}><Plus/> Add</button></div></label>
      </div>
      <div className="goal-chips">{getGoals(draft).map((goal, i)=><button type="button" key={goal} onClick={()=>field('goals',draft.goals.filter(x=>Number(x)!==goal))}><small>{i+1}</small>{goal}<X/></button>)}{!getGoals(draft).length && <span>No goals added yet</span>}</div>
      <label className="color-label">Counter color<div className="swatches">{COLORS.map(color=><button aria-label={color} type="button" key={color} className={draft.color===color?'selected':''} style={{background:color}} onClick={()=>field('color',color)}>{draft.color===color&&<Check/>}</button>)}<span className="custom-color"><input type="color" value={draft.color || COLORS[0]} onChange={e=>field('color',e.target.value)}/><em>Custom</em></span></div></label>
      {showLocalOption&&<div className="counter-local-setting"><div><b>Local counter</b><small>Keep this counter on this device and remove its cloud copy.</small></div><button type="button" className={`setting-switch ${draft.localOnly?'active':''}`} onClick={()=>field('localOnly',!draft.localOnly)} aria-pressed={Boolean(draft.localOnly)}><i></i></button></div>}
      </>:<CounterSuperCustomization counter={draft} value={superCustomization} onChange={onSuperCustomization} onDone={()=>setTab('counter')}/>}
      <div className="modal-footer"><button type="button" className="cancel" onClick={onClose}>{tab==='super'?'Done':'Cancel'}</button>{tab==='counter'&&<button className="save"><Check/> Save counter</button>}</div>
    </form>
  </div>
}

const formatTrashTime = milliseconds => {
  const seconds=Math.max(0,Math.ceil(milliseconds/1000)), minutes=Math.floor(seconds/60), hours=Math.floor(minutes/60), days=Math.floor(hours/24)
  if (days) return `${days}d ${hours%24}h`
  if (hours) return `${hours}h ${minutes%60}m`
  if (minutes) return `${minutes}m`
  return `${seconds}s`
}

function TrashModal({items,showBounds,showLocalBanner,onChange,onEdit,onEmbed,onRestore,onDelete,onClose}) {
  const [now,setNow]=useState(Date.now())
  const [pendingDelete,setPendingDelete]=useState(null)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  return <><div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><div className="modal trash-modal"><div className="modal-head"><div><span>TRASH</span><h2>Recently deleted</h2></div><button onClick={onClose}><X/></button></div><p className="trash-intro">Counters here still work normally and are permanently deleted five days after they enter Trash.</p>{items.length?<div className="trash-list">{items.map((counter,index)=><div className="trash-item" key={counter.id}><div className="trash-toolbar"><span><Trash2/> Deletes in <b>{formatTrashTime(TRASH_LIFETIME-(now-Number(counter.deletedAt)))}</b></span><button onClick={()=>onRestore(counter)}><RotateCcw/> Restore</button></div><CounterCard counter={counter} index={index} showBounds={showBounds} showLocalBanner={showLocalBanner} onChange={onChange} onEdit={()=>onEdit(counter)} onEmbed={()=>onEmbed(counter)} onDelete={()=>setPendingDelete(counter)} onReset={()=>onChange(counter.id,counter.start-counter.value)}/></div>)}</div>:<div className="trash-empty"><Trash2/><b>Trash is empty</b><span>Deleted counters will appear here for five days.</span></div>}</div></div>{pendingDelete&&<div className="modal-backdrop trash-confirm-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setPendingDelete(null)}><div className="modal trash-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="trash-confirm-title"><div className="modal-head"><div><span>PERMANENT DELETE</span><h2 id="trash-confirm-title">Delete “{pendingDelete.name}” forever?</h2></div><button onClick={()=>setPendingDelete(null)}><X/></button></div><p>This counter cannot be restored after it is permanently deleted.</p><div className="modal-footer"><button className="cancel" onClick={()=>setPendingDelete(null)}>Cancel</button><button className="save trash-confirm-delete" onClick={()=>{onDelete(pendingDelete);setPendingDelete(null)}}><Trash2/> Delete forever</button></div></div></div>}</>
}

function AppSettings({counters, history, preferences, superSettings, onStartSuperEditor, onSuperSettings, onPreferences, onImport, onClose}) {
  const [status,setStatus] = useState('')
  const [section,setSection] = useState('customize')
  const [includeCounterCustomizations,setIncludeCounterCustomizations] = useState(false)
  const [counterTransferAction,setCounterTransferAction] = useState('')
  const counterImportRef = useRef(null)
  const preference = (key,value) => onPreferences(current=>({...current,[key]:value}))
  const exportData = scope => {
    const data={version:2,scope,exportedAt:new Date().toISOString()}
    if (scope==='counters'||scope==='all') data.counters=counters
    if (scope==='counters'&&includeCounterCustomizations) data.counterCustomizations=superSettings.counterCustomizations||{}
    if (scope==='super'||scope==='all') { data.tallySuper=superSettings; data.preferences=preferences }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const link = document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`tally-${scope}-backup.json`; link.click(); URL.revokeObjectURL(link.href)
  }
  const importData = async (event,scope) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (onImport(data,scope,{includeCounterCustomizations})) setStatus(`${scope==='all'?'All data':scope==='super'?'Tally Super settings':'Counters'} imported successfully.`)
    } catch (error) { setStatus(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message) }
    finally { event.target.value=''; if (scope==='counters') setCounterTransferAction('') }
  }
  return <><div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={`modal utility-modal settings-modal ${section==='super'?'super-open':''}`}><div className="modal-head"><div><span>APP SETTINGS</span><h2>Make Tally yours</h2></div><button onClick={onClose}><X/></button></div><SuperZoneContent zone="settings" items={superSettings.uiCustomizations.items} counters={counters} history={history}/><nav className="settings-tabs"><button className={section==='customize'?'active':''} onClick={()=>setSection('customize')}>Customize</button><button className={section==='super'?'active':''} onClick={()=>setSection('super')}>Tally Super</button><button className={section==='backup'?'active':''} onClick={()=>setSection('backup')}>Backup & transfer</button></nav>
  {section==='backup'?<div className="settings-section"><p className="utility-intro">Choose exactly which part of Tally to transfer. Importing replaces only the selected data on this device.</p><div className="backup-groups">{[['counters','Counters','Counter values, goals, limits, and colors'],['super','Tally Super','Super data and all customization settings'],['all','All Tally data','Counters, Super data, and customization settings']].map(([scope,title,description])=><div className="backup-group" key={scope}><div><b>{title}</b><small>{description}</small></div><div><button onClick={()=>scope==='counters'?setCounterTransferAction('export'):exportData(scope)}><Download/> Export</button>{scope==='counters'?<><button onClick={()=>setCounterTransferAction('import')}><Upload/> Import</button><input ref={counterImportRef} type="file" accept="application/json,.json" onChange={event=>importData(event,scope)}/></>:<label><Upload/> Import<input type="file" accept="application/json,.json" onChange={event=>importData(event,scope)}/></label>}</div></div>)}</div>{status&&<div className="utility-status">{status}</div>}</div>:section==='super'?<SuperSettings value={superSettings.uiCustomizations} onChange={uiCustomizations=>onSuperSettings(current=>({...current,uiCustomizations}))} onStart={onStartSuperEditor}/>:
  <div className="settings-section customize-settings">
    <SettingChoice label="Card spacing" description="Choose how much room each counter uses." value={preferences.density} options={[['compact','Compact'],['comfortable','Comfortable'],['spacious','Spacious']]} onChange={value=>preference('density',value)}/>
    <SettingChoice label="Grid columns" description="Control the dashboard layout on larger screens." value={preferences.columns} options={[['auto','Automatic'],['2','Two'],['3','Three']]} onChange={value=>preference('columns',value)}/>
    <SettingChoice label="Number size" description="Adjust the main count to suit your layout." value={preferences.numberSize} options={[['small','Small'],['standard','Standard'],['large','Large']]} onChange={value=>preference('numberSize',value)}/>
    <div className="setting-row"><div><b>Counter details</b><small>Show minimum and maximum labels on cards.</small></div><button className={`setting-switch ${preferences.showBounds?'active':''}`} onClick={()=>preference('showBounds',!preferences.showBounds)}><i></i></button></div>
    <div className="setting-row"><div><b>Animations</b><small>Animate cards and progress changes.</small></div><button className={`setting-switch ${preferences.animations?'active':''}`} onClick={()=>preference('animations',!preferences.animations)}><i></i></button></div>
    <div className="setting-row"><div><b>Trash</b><small>Keep deleted counters for five days before removing them permanently.</small></div><button className={`setting-switch ${preferences.trashEnabled?'active':''}`} onClick={()=>preference('trashEnabled',!preferences.trashEnabled)}><i></i></button></div>
    <div className="setting-row"><div><b>Save Trash to cloud</b><small>Sync deleted counters between signed-in devices.</small></div><button className={`setting-switch ${preferences.syncTrash?'active':''}`} onClick={()=>preference('syncTrash',!preferences.syncTrash)}><i></i></button></div>
    <div className="setting-row"><div><b>Default counter color</b><small>Used when creating a new counter.</small></div><input className="default-color" type="color" value={preferences.defaultColor} onChange={e=>preference('defaultColor',e.target.value)}/></div>
  </div>}</div></div>{counterTransferAction&&<div className="modal-backdrop backup-option-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setCounterTransferAction('')}><div className="modal backup-option-modal"><div className="modal-head"><div><span>COUNTER {counterTransferAction.toUpperCase()}</span><h2>Include customizations?</h2></div><button onClick={()=>setCounterTransferAction('')}><X/></button></div><p>Choose whether per-counter Tally Super customizations should be included with this {counterTransferAction}.</p><label className="backup-customization-toggle"><input type="checkbox" checked={includeCounterCustomizations} onChange={event=>setIncludeCounterCustomizations(event.target.checked)}/><i></i><span><b>Include per-counter customizations</b><small>{counterTransferAction==='export'?'Add them to this counter backup.':'Restore them from the selected counter backup.'}</small></span></label><div className="modal-footer"><button className="cancel" onClick={()=>setCounterTransferAction('')}>Cancel</button><button className="save" onClick={()=>{if(counterTransferAction==='export'){exportData('counters');setCounterTransferAction('')}else counterImportRef.current?.click()}}>{counterTransferAction==='export'?'Export counters':'Choose file'}</button></div></div></div>}</>
}

const SUPER_ZONES = [['workspace','Counters page'],['top','Top bar'],['bottom','Bottom bar'],['stats','Stats menu'],['settings','Settings menu']]
const SUPER_STATS = ['Session actions','Net movement','Total distance','Most active','Active counters','Goals complete','Increments','Decrements','Resets']
const SUPER_TOOLBOX = [
  {type:'text',label:'Tally text',family:'normal'},
  {type:'text-alt',label:'Alternative text',family:'alternative'},
  ...SUPER_STATS.flatMap((label,index)=>[
    {type:`stat-${index}`,label,family:'normal',size:'normal'},
    {type:`stat-${index}-mini`,label:`${label} · mini`,family:'alternative',size:'mini'},
  ]),
  {type:'counters-grid',label:'Counters grid',component:true},
  {type:'top-bar-copy',label:'Top bar text copy',component:true},
  {type:'bottom-bar-copy',label:'Bottom bar text copy',component:true},
  {type:'layout-free',label:'Free positioning',layoutControl:true,layoutMode:'free',structural:true},
  {type:'layout-row',label:'Arrange in a row',layoutControl:true,layoutMode:'row',structural:true},
  {type:'layout-column',label:'Arrange in a column',layoutControl:true,layoutMode:'column',structural:true},
]

function SuperElement({item,counters=[],history=[],preview=false}) {
  const elementColor=item.color==='#24231f'?'var(--super-text)':item.color
  const statMatch=item.type?.match(/^stat-(\d+)/)
  if(statMatch){
    const index=Number(statMatch[1]), net=history.reduce((sum,entry)=>sum+entry.to-entry.from,0), distance=history.reduce((sum,entry)=>sum+Math.abs(entry.to-entry.from),0)
    const counts=history.reduce((map,entry)=>({...map,[entry.name]:(map[entry.name]||0)+1}),{}), mostActive=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]
    const values=[history.length,net,distance,mostActive||'—',counters.length,counters.filter(isComplete).length,history.filter(entry=>entry.kind==='increment').length,history.filter(entry=>entry.kind==='decrement').length,history.filter(entry=>entry.kind==='reset').length]
    const samples=[24,'+12',38,'Morning laps',3,2,15,7,2]
    const value=preview?samples[index]:values[index]
    return item.size==='mini'
      ? <div className="super-live-element super-stat-mini" style={{color:elementColor}}><span>{SUPER_STATS[index]}</span><b>{value}</b></div>
      : <div className="super-live-element super-stat-normal" style={{color:elementColor}}><span>{SUPER_STATS[index]}</span><strong className={index===3?'text-stat':''}>{value}</strong>{index===3&&<small>{preview?'8 actions':history.length?'Most actions this session':'No activity yet'}</small>}</div>
  }
  if(item.type==='text'||item.type==='text-alt')return <div className={`super-live-element super-live-text ${item.type==='text-alt'?'super-alt':''} ${item.size==='mini'?'mini':''}`} style={{color:elementColor}}>{item.text||'Custom text'}</div>
  if(item.type==='counter'){
    const counter=counters.find(candidate=>String(candidate.id)===String(item.counterId))||{name:item.label||'Counter',value:preview?18:0,start:0,goals:preview?[30]:[],goalDirection:'more',color:'#2f7e70'}
    const goals=getGoals(counter),direction=counter.goalDirection||((counter.goal??0)<counter.start?'less':'more'),finalGoal=goals.at(-1),complete=goals.length>0&&(direction==='less'?counter.value<=finalGoal:counter.value>=finalGoal)
    const distance=finalGoal==null?0:direction==='less'?counter.start-finalGoal:finalGoal-counter.start,travelled=finalGoal==null?0:direction==='less'?counter.start-counter.value:counter.value-counter.start
    const progress=!goals.length?0:distance<=0?(complete?100:0):Math.max(0,Math.min(100,(travelled/distance)*100))
    return <div className={`super-live-element super-live-counter ${complete?'complete':''}`} style={{'--accent':counter.color}}><span>{counter.name}</span><strong>{counter.value}</strong><i title={goals.length?complete?'Final goal complete':`${Math.round(progress)}% to final goal ${finalGoal}`:'No goal set'}><em style={{width:`${progress}%`}}></em></i></div>
  }
  if(item.type==='counters-grid')return <div className="super-live-element super-live-grid"><span></span><span></span><span></span></div>
  if(item.layoutControl)return <div className={`super-layout-preview mode-${item.layoutMode}`}><i></i><i></i><i></i></div>
  if(item.type==='top-bar-copy')return <div className="super-live-element super-live-layout"><span className="brand-mark"><span></span><span></span><span></span><span></span></span><b>TALLY</b></div>
  if(item.type==='bottom-bar-copy')return <div className="super-live-element super-live-layout">Built for the little things that add up.</div>
  return <div className="super-live-element super-live-layout"><Sparkles/><span>{item.label||item.text}</span></div>
}

function TransformableSuperItem({item,zone,counters,history,onUpdate,onRemove}) {
  const moveStart=event=>{
    if(event.button!==0||event.target.closest('button,.super-resize-handle'))return
    event.preventDefault();const rect=document.querySelector(`[data-super-zone="${zone}"]`)?.getBoundingClientRect();if(!rect)return
    const origin={clientX:event.clientX,clientY:event.clientY,x:item.x??50,y:item.y??50}
    const move=next=>onUpdate(item.id,{x:Math.max(0,Math.min(100,origin.x+((next.clientX-origin.clientX)/rect.width)*100)),y:Math.max(0,Math.min(100,origin.y+((next.clientY-origin.clientY)/rect.height)*100))})
    const end=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end)}
    document.addEventListener('pointermove',move);document.addEventListener('pointerup',end)
  }
  const resizeStart=event=>{
    event.preventDefault();event.stopPropagation();const box=event.currentTarget.parentElement.getBoundingClientRect(),center={x:box.left+box.width/2,y:box.top+box.height/2},origin={x:Math.max(1,event.clientX-center.x),y:Math.max(1,event.clientY-center.y),scaleX:item.scaleX??item.scale??1,scaleY:item.scaleY??item.scale??1}
    const resize=next=>onUpdate(item.id,{scaleX:Math.max(.25,Math.min(4,origin.scaleX*((next.clientX-center.x)/origin.x))),scaleY:Math.max(.25,Math.min(4,origin.scaleY*((next.clientY-center.y)/origin.y)))})
    const end=()=>{document.removeEventListener('pointermove',resize);document.removeEventListener('pointerup',end)}
    document.addEventListener('pointermove',resize);document.addEventListener('pointerup',end)
  }
  const scaleX=item.scaleX??item.scale??1,scaleY=item.scaleY??item.scale??1
  const uniform=amount=>onUpdate(item.id,{scaleX:Math.max(.25,Math.min(4,scaleX+amount)),scaleY:Math.max(.25,Math.min(4,scaleY+amount))})
  const rotation=item.rotation||0
  return <div className={`super-positioned-element editable custom-size ${item.width||item.height?'resized':''}`} onPointerDown={moveStart} style={{left:`${item.x??50}%`,top:`${item.y??50}%`,width:item.width||'auto',height:item.height||'auto','--super-scale-x':scaleX,'--super-scale-y':scaleY,'--super-rotation':`${rotation}deg`}}><SuperElement item={item} counters={counters} history={history}/><div className="super-transform-tools"><button onClick={()=>uniform(-.1)} title="Scale down">−</button><span>{Math.round(scaleX*100)}% × {Math.round(scaleY*100)}%</span><button onClick={()=>uniform(.1)} title="Scale up">+</button><button onClick={()=>onUpdate(item.id,{rotation:rotation-15})} title="Rotate left">↶</button><span className="rotation-value">{rotation}°</span><button onClick={()=>onUpdate(item.id,{rotation:rotation+15})} title="Rotate right">↷</button></div><button className="remove-super-item" onClick={()=>onRemove(item.id)} title="Remove customization"><X/></button><i className="super-resize-handle" onPointerDown={resizeStart}></i></div>
}

function SuperZoneContent({zone,items=[],counters,history,onRemove,onUpdate}) {
  const zoneItems=(Array.isArray(items)?items:[]).filter(item=>item.zone===zone), layout=zoneItems.find(item=>item.layoutControl)?.layoutMode||'free'
  const placed=zoneItems.filter(item=>!item.layoutControl)
  if(!placed.length)return null
  return <div className={`super-zone-content super-zone-${zone} super-layout-${layout}`}>{placed.map(item=>onUpdate?<TransformableSuperItem key={item.id} item={item} zone={zone} counters={counters} history={history} onUpdate={onUpdate} onRemove={onRemove}/>:<div className="super-positioned-element" key={item.id} style={{left:`${item.x??50}%`,top:`${item.y??50}%`,width:item.width||'auto',height:item.height||'auto','--super-scale-x':item.scaleX??item.scale??1,'--super-scale-y':item.scaleY??item.scale??1,'--super-rotation':`${item.rotation||0}deg`}}><SuperElement item={item} counters={counters} history={history}/></div>)}</div>
}

function SuperSettings({value,onChange,onStart}) {
  const setting=(key,next)=>onChange({...value,[key]:next})
  const removeAll=()=>{if(confirm('Remove every Tally Super UI customization? This cannot be undone.'))onChange({...value,items:[]})}
  return <div className="settings-section super-settings"><div className="super-title"><span className="super-logo"><Sparkles/> TALLY SUPER</span><p>Rearrange Tally with a drag-and-drop workspace.</p></div><div className="customize-settings"><div className="setting-row"><div><b>Snap to interface zones</b><small>Highlight compatible places while dragging.</small></div><button className={`setting-switch ${value?.snapToZones!==false?'active':''}`} onClick={()=>setting('snapToZones',value?.snapToZones===false)}><i/></button></div><div className="setting-row"><div><b>Editor labels</b><small>Show the names of drop zones over the page.</small></div><button className={`setting-switch ${value?.showEditorLabels!==false?'active':''}`} onClick={()=>setting('showEditorLabels',value?.showEditorLabels===false)}><i/></button></div></div><button className="start-super-editor" onClick={onStart}><Sparkles/> Start editor</button><button className="remove-super-customizations" disabled={!value?.items?.length} onClick={removeAll}><Trash2/> Remove all UI customizations</button></div>
}

function SuperEditorPane({counters,value,onChange,onClose}) {
  const items=Array.isArray(value?.items)?value.items:[]
  const templates=[...SUPER_TOOLBOX,...counters.map(counter=>({type:'counter',counterId:counter.id,label:counter.name,component:true}))]
  const [expanded,setExpanded]=useState(null)
  const [presets,setPresets]=useState({})
  const [dragging,setDragging]=useState(null)
  const [reminder,setReminder]=useState('')
  const clickRef=useRef({type:'',count:0,timer:null})
  const draggedRef=useRef(false)
  const templateKey=template=>template.counterId?`${template.type}-${template.counterId}`:template.type
  useEffect(()=>()=>clearTimeout(clickRef.current.timer),[])
  const preset=template=>presets[templateKey(template)]||{text:template.type==='text'||template.type==='text-alt'?'Custom text':template.label,color:'#24231f',size:template.size||'normal'}
  const setPreset=(template,changes)=>setPresets(current=>({...current,[templateKey(template)]:{...preset(template),...changes}}))
  const add=(template,zone,position={x:50,y:50})=>{const settings=preset(template);const next={...template,...settings,id:template.layoutControl?`layout-${zone}`:`super-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,zone,...position};onChange({...value,items:template.layoutControl?[...items.filter(item=>!(item.layoutControl&&item.zone===zone)),next]:[...items,next]})}
  const clicked=template=>{
    if(draggedRef.current){draggedRef.current=false;return}
    const key=templateKey(template),same=clickRef.current.type===key
    const count=same?clickRef.current.count+1:1
    clearTimeout(clickRef.current.timer);setReminder('');setExpanded(key)
    clickRef.current={type:key,count,timer:setTimeout(()=>{clickRef.current={type:'',count:0,timer:null};setReminder('')},2000)}
    if(same&&count>=3)setReminder(key)
  }
  const drop=(event,zone)=>{event.preventDefault();const destination=document.querySelector(`[data-super-zone="${zone}"]`),rect=destination?.getBoundingClientRect()||event.currentTarget.getBoundingClientRect();const position={x:Math.max(0,Math.min(100,((event.clientX-rect.left)/rect.width)*100)),y:Math.max(0,Math.min(100,((event.clientY-rect.top)/rect.height)*100))};if(dragging)add(dragging,zone,position);setDragging(null)}
  const remove=id=>onChange({...value,items:items.filter(item=>item.id!==id)})
  return <><div className={`super-drop-layer ${dragging?'active':''}`}>{[['top','Top bar'],['workspace','Counters page'],['bottom','Bottom bar']].map(([zone,label])=><div key={zone} className={`super-drop-${zone}`} onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,zone)}>{value?.showEditorLabels!==false&&<span>{label}</span>}</div>)}</div><aside className="super-editor-pane"><div className="super-pane-head"><span className="super-logo"><Sparkles/> TALLY SUPER</span><button onClick={onClose}><X/></button></div><p>Drag an element from the toolbox onto the page.</p><div className="super-menu-drops"><span onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,'stats')}>Stats menu</span><span onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,'settings')}>Settings menu</span></div><div className="super-pane-tools">{templates.map(template=>{const key=templateKey(template),open=expanded===key,settings=preset(template);return <section key={key} className={open?'expanded':''} draggable onDragStart={event=>{draggedRef.current=true;setDragging(template);event.dataTransfer.effectAllowed='copy'}} onDragEnd={()=>{setDragging(null);setTimeout(()=>{draggedRef.current=false},0)}} onClick={()=>clicked(template)}><div><b>{template.label}</b><small>{template.structural?'Layout':template.size==='mini'?'Mini':'Element'}</small></div>{reminder===key&&<em>Drag this element onto the screen to add it.</em>}{open&&<div className="super-tool-details" onClick={event=>event.stopPropagation()}><div className="super-tool-preview"><SuperElement item={{...template,...settings}} counters={counters} preview/></div>{!template.structural&&<><label>Size<select value={settings.size} onChange={event=>setPreset(template,{size:event.target.value})}><option value="mini">Mini</option><option value="normal">Normal</option></select></label><label>Color<input type="color" value={settings.color} onChange={event=>setPreset(template,{color:event.target.value})}/></label></>}{(template.type==='text'||template.type==='text-alt')&&<label className="super-preset-text">Text<input value={settings.text} onChange={event=>setPreset(template,{text:event.target.value})}/></label>}</div>}</section>})}</div><button className="super-editor-done" onClick={onClose}>Done</button></aside></>
}

function SettingChoice({label,description,value,options,onChange}) {
  return <div className="setting-row choice-row"><div><b>{label}</b><small>{description}</small></div><div className="setting-choice">{options.map(([key,text])=><button key={key} className={value===key?'active':''} onClick={()=>onChange(key)}>{text}</button>)}</div></div>
}

function SyncConflictModal({deviceCount,cloudCount,onChoose}) {
  return <div className="modal-backdrop sync-conflict-backdrop"><div className="modal sync-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title"><div className="modal-head"><div><span>SYNC CONFLICT</span><h2 id="sync-conflict-title">Which counters should Tally keep?</h2></div></div><p className="sync-conflict-intro">This device and your account both contain counters. Nothing will be overwritten until you choose.</p><div className="sync-conflict-options"><button onClick={()=>onChoose('device')}><strong>Keep this device</strong><span>Upload these {deviceCount} counter{deviceCount===1?'':'s'} and replace the cloud copy.</span></button><button onClick={()=>onChoose('cloud')}><strong>Use cloud counters</strong><span>Load the {cloudCount} counter{cloudCount===1?'':'s'} from your account onto this device.</span></button><button onClick={()=>onChoose('merge')}><strong>Merge both</strong><span>Keep counters from both places. Conflicting cloud copies are clearly labeled.</span></button></div></div></div>
}

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~"
const passwordChecks = password => ({length:password.length>=8,lower:/[a-z]/.test(password),upper:/[A-Z]/.test(password),digit:/\d/.test(password),symbol:[...password].some(character=>PASSWORD_SYMBOLS.includes(character))})
const validPassword = password => Object.values(passwordChecks(password)).every(Boolean)

function PasswordFields({password,setPassword,confirmation,setConfirmation,autoFocus=false}) {
  const checks=passwordChecks(password)
  return <><label>New password<input type="password" required minLength="8" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoFocus={autoFocus}/></label><label>Confirm password<input type="password" required minLength="8" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Enter it again"/></label><div className="password-requirements" aria-label="Password requirements"><span className={checks.length?'met':''}>8+ characters</span><span className={checks.lower?'met':''}>Lowercase</span><span className={checks.upper?'met':''}>Uppercase</span><span className={checks.digit?'met':''}>Number</span><span className={checks.symbol?'met':''}>Symbol</span></div></>
}

function AuthModal({session,configured,syncStatus,onDeleted,onClose}) {
  const [mode,setMode] = useState('signin')
  const [flow,setFlow] = useState('')
  const [email,setEmail] = useState('')
  const [pendingEmail,setPendingEmail] = useState('')
  const [newEmail,setNewEmail] = useState('')
  const [verificationEmail,setVerificationEmail] = useState('')
  const [password,setPassword] = useState('')
  const [confirmation,setConfirmation] = useState('')
  const [token,setToken] = useState('')
  const [status,setStatus] = useState('')
  const [busy,setBusy] = useState(false)
  const [deleting,setDeleting] = useState(false)
  const [deleteText,setDeleteText] = useState('')
  const clearForm = () => { setPassword(''); setConfirmation(''); setToken(''); setStatus('') }
  const passwordError = () => !validPassword(password) ? 'Password must meet every requirement.' : password!==confirmation ? 'Passwords do not match.' : ''
  const submit = async event => {
    event.preventDefault(); if (!supabase) return
    if (mode==='signup') { const error=passwordError(); if (error) { setStatus(error); return } }
    setBusy(true); setStatus('')
    const result = mode==='signup' ? await supabase.auth.signUp({email,password}) : await supabase.auth.signInWithPassword({email,password})
    setBusy(false)
    if (result.error) setStatus(result.error.message)
    else if (mode==='signup'&&!result.data.session) { setPendingEmail(email); setFlow('signup-token'); setToken('') }
    else onClose()
  }
  const verifySignup = async event => {
    event.preventDefault(); setBusy(true); setStatus('')
    const {error}=await supabase.auth.verifyOtp({email:pendingEmail,token:token.trim(),type:'email'})
    setBusy(false); if (error) setStatus(error.message); else onClose()
  }
  const requestRecovery = async event => {
    event.preventDefault(); setBusy(true); setStatus('')
    const {error}=await supabase.auth.resetPasswordForEmail(email)
    setBusy(false)
    if (error) setStatus(error.message); else { setPendingEmail(email); setToken(''); setFlow('recovery-token') }
  }
  const verifyRecovery = async event => {
    event.preventDefault(); setBusy(true); setStatus('')
    const {error}=await supabase.auth.verifyOtp({email:pendingEmail,token:token.trim(),type:'recovery'})
    setBusy(false)
    if (error) setStatus(error.message); else { clearForm(); setFlow('recovery-password') }
  }
  const updateRecoveredPassword = async event => {
    event.preventDefault(); const message=passwordError(); if (message) { setStatus(message); return }
    setBusy(true); setStatus('')
    const {error}=await supabase.auth.updateUser({password})
    setBusy(false)
    if (error) setStatus(error.message); else { clearForm(); setFlow(''); setStatus('Password updated successfully.') }
  }
  const changePassword = async event => {
    event.preventDefault(); const message=passwordError(); if (message) { setStatus(message); return }
    setBusy(true); setStatus('')
    const {error}=await supabase.auth.updateUser({password})
    if (error?.code==='reauth_nonce_missing'||error?.code==='reauthentication_needed') {
      const {error:reauthError}=await supabase.auth.reauthenticate()
      setBusy(false)
      if (reauthError) setStatus(reauthError.message); else { setToken(''); setFlow('reauth-password'); setStatus('Enter the reauthentication code sent to your email.') }
      return
    }
    setBusy(false)
    if (error) setStatus(error.message); else { clearForm(); setFlow(''); setStatus('Password updated successfully.') }
  }
  const finishSecurePasswordChange = async event => {
    event.preventDefault(); setBusy(true); setStatus('')
    const {error}=await supabase.auth.updateUser({password,nonce:token.trim()})
    setBusy(false)
    if (error) setStatus(error.message); else { clearForm(); setFlow(''); setStatus('Password updated successfully.') }
  }
  const requestEmailChange = async event => {
    event.preventDefault(); setBusy(true); setStatus('')
    const {data,error}=await supabase.auth.updateUser({email:newEmail})
    setBusy(false)
    if (error) setStatus(error.message)
    else if (data.user?.email===newEmail) { setFlow(''); setStatus('Email updated successfully.') }
    else { setVerificationEmail(newEmail); setToken(''); setFlow('email-token'); setStatus('Enter the code sent by Supabase. Secure email change may require a code from both inboxes.') }
  }
  const verifyEmailChange = async event => {
    event.preventDefault(); setBusy(true); setStatus('')
    const {error}=await supabase.auth.verifyOtp({email:verificationEmail,token:token.trim(),type:'email_change'})
    if (error) { setBusy(false); setStatus(error.message); return }
    const {data}=await supabase.auth.getUser(); setBusy(false); setToken('')
    if (data.user?.email===newEmail) { setFlow(''); setStatus('Email updated successfully.') }
    else setStatus('That address is confirmed. Enter the code from the other inbox and change the email field to match it.')
  }
  const resendSignup = async () => { setBusy(true); const {error}=await supabase.auth.resend({type:'signup',email:pendingEmail}); setBusy(false); setStatus(error?error.message:'A new verification code was sent.') }
  const signOut = async () => { setBusy(true); await supabase?.auth.signOut(); setBusy(false); onClose() }
  const deleteAccount = async () => {
    if (deleteText!=='DELETE'||!supabase) return
    setBusy(true); setStatus('')
    const {error}=await supabase.functions.invoke('delete-account',{body:{confirmation:'DELETE'}})
    if (error) { setStatus(error.message||'Account deletion failed.'); setBusy(false); return }
    await supabase.auth.signOut({scope:'local'}); onDeleted()
  }
  const back = () => { clearForm(); setFlow(''); setDeleting(false) }
  const title = flow==='signup-token'?'Enter verification code':flow==='recovery-request'?'Reset your password':flow==='recovery-token'?'Enter recovery code':flow==='recovery-password'?'Choose a new password':flow==='change-password'?'Change password':flow==='reauth-password'?'Confirm it’s you':flow==='change-email'?'Change email address':flow==='email-token'?'Confirm email change':session?'Your Tally account':mode==='signin'?'Sign in to sync':'Create an account'
  let content
  if (!configured) content=<div className="auth-notice"><b>Supabase is not configured yet.</b><p>Add your project URL and publishable key to a local <code>.env</code> file, then restart the development server.</p></div>
  else if (flow==='signup-token') content=<><p className="auth-code-intro">We sent a verification code to <strong>{pendingEmail}</strong>.</p><form className="auth-form" onSubmit={verifySignup}><TokenField token={token} setToken={setToken}/>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy||!token}>{busy?'Verifying…':'Verify account'}</button></form><div className="auth-code-actions"><button onClick={resendSignup} disabled={busy}>Resend code</button><button onClick={back}>Change email</button></div></>
  else if (flow==='recovery-request') content=<><p className="auth-code-intro">Enter your account email and we’ll send a password-reset code.</p><form className="auth-form" onSubmit={requestRecovery}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus/></label>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy}>{busy?'Sending…':'Send reset code'}</button></form><BackButton onClick={back}/></>
  else if (flow==='recovery-token') content=<><p className="auth-code-intro">Enter the recovery code sent to <strong>{pendingEmail}</strong>.</p><form className="auth-form" onSubmit={verifyRecovery}><TokenField token={token} setToken={setToken}/>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy||!token}>{busy?'Verifying…':'Continue'}</button></form><BackButton onClick={()=>setFlow('recovery-request')}/></>
  else if (flow==='recovery-password') content=<form className="auth-form" onSubmit={updateRecoveredPassword}><PasswordFields password={password} setPassword={setPassword} confirmation={confirmation} setConfirmation={setConfirmation} autoFocus/>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy}>{busy?'Updating…':'Update password'}</button></form>
  else if (flow==='change-password') content=<><form className="auth-form" onSubmit={changePassword}><PasswordFields password={password} setPassword={setPassword} confirmation={confirmation} setConfirmation={setConfirmation} autoFocus/>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy}>{busy?'Updating…':'Change password'}</button></form><BackButton onClick={back}/></>
  else if (flow==='reauth-password') content=<><p className="auth-code-intro">Your session is more than 24 hours old, so Supabase sent a reauthentication code to your email.</p><form className="auth-form" onSubmit={finishSecurePasswordChange}><TokenField token={token} setToken={setToken}/>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy||!token}>{busy?'Updating…':'Confirm and change password'}</button></form><BackButton onClick={back}/></>
  else if (flow==='change-email') content=<><p className="auth-code-intro">Your current email is <strong>{session?.user?.email}</strong>.</p><form className="auth-form" onSubmit={requestEmailChange}><label>New email address<input type="email" required autoComplete="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} autoFocus/></label>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy}>{busy?'Sending…':'Send confirmation code'}</button></form><BackButton onClick={back}/></>
  else if (flow==='email-token') content=<><p className="auth-code-intro">Enter a code and the exact email address where you received it.</p><form className="auth-form" onSubmit={verifyEmailChange}><label>Email receiving this code<input type="email" required value={verificationEmail} onChange={e=>setVerificationEmail(e.target.value)}/></label><TokenField token={token} setToken={setToken}/>{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy||!token}>{busy?'Verifying…':'Verify email'}</button></form><BackButton onClick={back}/></>
  else if (session) content=<div className="account-view"><div className="account-avatar"><User/></div><strong>{session.user.email}</strong><span><Cloud/> {syncStatus}</span><p>Your counters and preferences sync automatically while you’re signed in. They also remain saved on this device.</p>{status&&<div className="auth-status account-status">{status}</div>}<div className="account-security-actions"><button onClick={()=>{clearForm();setFlow('change-password')}}>Change password</button><button onClick={()=>{clearForm();setNewEmail('');setFlow('change-email')}}>Change email</button></div><button onClick={signOut} disabled={busy}><LogOut/> Sign out</button>{!deleting?<button className="delete-account-link" onClick={()=>setDeleting(true)} disabled={busy}><Trash2/> Delete account</button>:<div className="delete-account-panel"><b>Permanently delete this account?</b><p>This removes the account, cloud counters, and counters saved in this browser. Type <strong>DELETE</strong> to continue.</p><input value={deleteText} onChange={e=>setDeleteText(e.target.value)} placeholder="Type DELETE" autoComplete="off"/>{status&&<div className="auth-status">{status}</div>}<div><button onClick={()=>{setDeleting(false);setDeleteText('');setStatus('')}}>Cancel</button><button className="confirm-delete" disabled={deleteText!=='DELETE'||busy} onClick={deleteAccount}>{busy?'Deleting…':'Delete forever'}</button></div></div>}</div>
  else content=<><div className="auth-tabs"><button className={mode==='signin'?'active':''} onClick={()=>{setMode('signin');clearForm()}}>Sign in</button><button className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');clearForm()}}>Create account</button></div><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={mode==='signup'?8:1} autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signin'?'Your password':'At least 8 characters'}/></label>{mode==='signup'&&<><label>Confirm password<input type="password" required minLength="8" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Enter it again"/></label><PasswordRequirements password={password}/></>}{status&&<div className="auth-status">{status}</div>}<button className="save" disabled={busy}>{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</button></form>{mode==='signin'&&<button className="forgot-password" onClick={()=>{clearForm();setFlow('recovery-request')}}>Forgot your password?</button>}<p className="auth-privacy">Accounts are optional. Without one, counters stay only in this browser.</p></>
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal auth-modal"><div className="modal-head"><div><span>OPTIONAL ACCOUNT</span><h2>{title}</h2></div><button onClick={onClose}><X/></button></div>{content}</div></div>
}

function PasswordRequirements({password}) { const checks=passwordChecks(password); return <div className="password-requirements"><span className={checks.length?'met':''}>8+ characters</span><span className={checks.lower?'met':''}>Lowercase</span><span className={checks.upper?'met':''}>Uppercase</span><span className={checks.digit?'met':''}>Number</span><span className={checks.symbol?'met':''}>Symbol</span></div> }
function TokenField({token,setToken}) { return <label>Verification code<input className="auth-code-input" required inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e=>setToken(e.target.value.replace(/\D/g,''))} placeholder="Enter your code" autoFocus/></label> }
function BackButton({onClick}) { return <div className="auth-code-actions"><button type="button" onClick={onClick}>Back</button></div> }

function StatsModal({history, counters, superItems, resets, onResetStat, onResetAll, onClose}) {
  const since = key => history.filter(item=>item.time>(resets[key]||0))
  const net = since('net').reduce((sum,item)=>sum+item.to-item.from,0)
  const distance = since('distance').reduce((sum,item)=>sum+Math.abs(item.to-item.from),0)
  const increments = since('increments').filter(item=>item.kind==='increment').length
  const decrements = since('decrements').filter(item=>item.kind==='decrement').length
  const resetCount = since('resets').filter(item=>item.kind==='reset').length
  const counts = since('active').reduce((map,item)=>({...map,[item.name]:(map[item.name]||0)+1}),{})
  const mostActive = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]
  const resettable = (key, children, className='') => <button type="button" className={className} title="Click to reset" onClick={()=>onResetStat(key)}>{children}</button>
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal utility-modal stats-modal"><div className="modal-head"><div><span>THIS SESSION</span><h2>Counting stats</h2></div><button onClick={onClose}><X/></button></div><SuperZoneContent zone="stats" items={superItems} counters={counters} history={history}/><div className="stats-grid">{resettable('actions',<><span>Session actions</span><strong>{since('actions').length}</strong></>)}{resettable('net',<><span>Net movement</span><strong>{net>0?'+':''}{net}</strong></>)}{resettable('distance',<><span>Total distance</span><strong>{distance}</strong></>)}{resettable('active',<><span>Most active</span><strong className="text-stat">{mostActive?.[0]||'—'}</strong><small>{mostActive?`${mostActive[1]} actions`:'No activity yet'}</small></>)}</div><div className="stats-breakdown">{resettable('increments',<><Plus/> Increments <b>{increments}</b></>)}{resettable('decrements',<><Minus/> Decrements <b>{decrements}</b></>)}{resettable('resets',<><RotateCcw/> Resets <b>{resetCount}</b></>)}</div><div className="modal-footer"><button className="cancel" disabled={!history.length} onClick={onResetAll}>Reset all stats</button><button className="save" onClick={onClose}>Done</button></div></div></div>
}

function EmbedBuilder({counter, onClose}) {
  const [options, setOptions] = useState({watermark:true, compact:false, reset:true, settings:false, theme:'auto'})
  const [copied, setCopied] = useState(false)
  const set = key => setOptions(o=>({...o,[key]:!o[key]}))
  const params = new URLSearchParams({data:encodeCounter(counter), compact:String(options.compact), watermark:String(options.watermark), reset:String(options.reset), settings:String(options.settings), theme:options.theme})
  const height = options.compact ? 210 : 310
  const code = `<iframe src="${EMBED_ORIGIN}/embed?${params}" width="100%" height="${height}" frameborder="0" title="${counter.name} tally counter"></iframe>`
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),1500) } catch {} }
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal embed-modal">
    <div className="modal-head"><div><span>EMBED COUNTER</span><h2>Make it fit anywhere</h2></div><button onClick={onClose}><X/></button></div>
    <div className="embed-layout"><div className="embed-options">
      <div className="embed-switches">{[['watermark','Powered by Tally'],['compact','Compact size'],['reset','Show reset'],['settings','Show settings']].map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" checked={options[key]} onChange={()=>set(key)}/><i></i></label>)}</div>
      <label className="embed-theme">Embed theme<select value={options.theme} onChange={e=>setOptions(o=>({...o,theme:e.target.value}))}><option value="auto">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label className="code-label">Embed code<div className="code-box"><code>{code}</code><button onClick={copy}>{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy'}</button></div></label>
    </div><div className="preview-wrap"><span>LIVE PREVIEW</span><EmbedPreview counter={counter} options={options}/></div></div>
  </div></div>
}

function EmbedPreview({counter:c, options}) {
  return <div className={`embed-preview ${options.compact?'compact':''} theme-${options.theme}`} style={{'--accent':c.color}}>
    <div className="embed-preview-head"><span>{c.name}</span>{options.settings&&<Settings2/>}</div>
    <strong>{c.value.toLocaleString()}</strong>
    {!options.compact&&<small>{getGoals(c).length ? `${getGoals(c).filter(g=>c.goalDirection==='less'?c.value<=g:c.value>=g).length} of ${getGoals(c).length} goals` : 'Ready to count'}</small>}
    <div className="embed-controls"><button><Minus/> {c.minusStep}</button><button><Plus/> {c.plusStep}</button></div>
    <div className="embed-bottom">{options.reset?<button><RotateCcw/> Reset</button>:<span></span>}{options.watermark&&<b><span className="brand-mark"><span></span><span></span><span></span><span></span></span>Powered by Tally</b>}</div>
  </div>
}

function EmbeddedCounter({initial, params}) {
  const [counter, setCounter] = useState(initial)
  const [details, setDetails] = useState(false)
  const compact = params.get('compact') === 'true'
  const watermark = params.get('watermark') !== 'false'
  const showReset = params.get('reset') !== 'false'
  const showSettings = params.get('settings') === 'true'
  const embedTheme = params.get('theme') || 'auto'
  const change = amount => setCounter(c => ({...c, value:Math.max(c.min ?? -Infinity, Math.min(c.max ?? Infinity, c.value + amount))}))
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const dark = embedTheme === 'dark' || (embedTheme === 'auto' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    applyTheme()
    if (embedTheme === 'auto') media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [embedTheme])
  return <main className="embed-page"><div className={`embed-preview real-embed ${compact?'compact':''}`} style={{'--accent':counter.color}}>
    <div className="embed-preview-head"><span>{counter.name}</span>{showSettings&&<button onClick={()=>setDetails(x=>!x)} title="Counter details"><Settings2/></button>}</div>
    <strong>{counter.value.toLocaleString()}</strong>
    {!compact&&<small>{getGoals(counter).length ? `${getGoals(counter).filter(g=>counter.goalDirection==='less'?counter.value<=g:counter.value>=g).length} of ${getGoals(counter).length} goals complete` : 'Ready to count'}</small>}
    {details&&<div className="embed-details"><span>− step <b>{counter.minusStep}</b></span><span>+ step <b>{counter.plusStep}</b></span><span>Range <b>{counter.min ?? '∞'} → {counter.max ?? '∞'}</b></span></div>}
    <div className="embed-controls"><button disabled={counter.min!=null&&counter.value<=counter.min} onClick={()=>change(-counter.minusStep)}><Minus/> {counter.minusStep}</button><button disabled={counter.max!=null&&counter.value>=counter.max} onClick={()=>change(counter.plusStep)}><Plus/> {counter.plusStep}</button></div>
    <div className="embed-bottom">{showReset?<button onClick={()=>setCounter(c=>({...c,value:c.start}))}><RotateCcw/> Reset</button>:<span></span>}{watermark&&<b><span className="brand-mark"><span></span><span></span><span></span><span></span></span>Powered by Tally</b>}</div>
  </div></main>
}

function NotFound() {
  const home = import.meta.env.BASE_URL
  return <main className="not-found"><div className="not-found-code">404</div><div className="eyebrow"><Hash/> Lost count</div><h1>This page doesn't<br/><em>add up.</em></h1><p>The address may be incorrect, or the page may have moved.</p><a href={home}>Back to my counters</a></main>
}

createRoot(document.getElementById('root')).render(<App />)
