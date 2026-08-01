import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Plus, Minus, Settings2, RotateCcw, Trash2, X, Check, Target, Hash, Sparkles, Moon, Sun, Code2, Copy, BarChart3, Download, Upload, User, Cloud, LogOut } from 'lucide-react'
import './styles.css'
import { supabase, supabaseConfigured } from './supabase'

const COLORS = ['#ef6a47', '#2f7e70', '#4e65a8', '#d59c2e', '#9b5f85', '#63705b']
const EMBED_ORIGIN = 'https://your-tally-domain.example'
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

function App() {
  const [counters, setCounters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tally-counters')) || [] } catch { return [] }
  })
  const [editing, setEditing] = useState(null)
  const [embedding, setEmbedding] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('tally-theme') || 'light')
  const [history, setHistory] = useState([])
  const [menu, setMenu] = useState(null)
  const [statResets, setStatResets] = useState({})
  const [session,setSession] = useState(null)
  const [authOpen,setAuthOpen] = useState(false)
  const [syncReady,setSyncReady] = useState(false)
  const [syncStatus,setSyncStatus] = useState('Local only')
  const [syncConflict,setSyncConflict] = useState(null)
  const [authNotice,setAuthNotice] = useState('')
  const [preferences, setPreferences] = useState(() => {
    const defaults = {density:'comfortable', columns:'auto', numberSize:'standard', showBounds:true, animations:true, defaultColor:COLORS[0]}
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
  useEffect(() => localStorage.setItem('tally-preferences', JSON.stringify(preferences)), [preferences])
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
      const {data,error} = await supabase.from('user_data').select('counters,preferences').eq('user_id',session.user.id).maybeSingle()
      if (cancelled) return
      if (error) { if (await validateRemoteUser() !== false) setSyncStatus('Sync error'); return }
      if (data) {
        const deviceCounters = counters.map(sanitize)
        const cloudCounters = Array.isArray(data.counters) ? data.counters.map(sanitize) : []
        const countersDiffer = !countersEqual(deviceCounters,cloudCounters)
        if (deviceCounters.length && cloudCounters.length && countersDiffer) {
          setSyncConflict({deviceCounters,cloudCounters,cloudPreferences:data.preferences})
          setSyncStatus('Choose sync data')
          return
        }
        if (cloudCounters.length) {
          setCounters(cloudCounters)
          if (data.preferences) setPreferences(current=>({...current,...data.preferences}))
        } else if (deviceCounters.length) {
          const {error:saveError} = await supabase.from('user_data').upsert({user_id:session.user.id,counters:deviceCounters,preferences,updated_at:new Date().toISOString()},{onConflict:'user_id'})
          if (saveError) { if (await validateRemoteUser() !== false) setSyncStatus('Sync error'); return }
        }
      } else {
        const {error:saveError} = await supabase.from('user_data').insert({user_id:session.user.id,counters,preferences})
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
      const {error}=await supabase.from('user_data').upsert({user_id:session.user.id,counters,preferences,updated_at:new Date().toISOString()},{onConflict:'user_id'})
      if (error) {
        if (await validateRemoteUser() !== false) setSyncStatus('Sync error')
      } else setSyncStatus('Synced')
    },700)
    return ()=>clearTimeout(timer)
  },[counters,preferences,session?.user?.id,syncReady])
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
  const reset = id => {
    const counter = counters.find(c=>c.id===id)
    if (counter) setValue(id, counter.start, 'reset')
  }
  const importBackup = data => {
    if (!data || !Array.isArray(data.counters) || !data.counters.length) throw new Error('This file does not contain any counters.')
    if (data.counters.some(counter => !counter || typeof counter !== 'object' || typeof counter.name !== 'string')) throw new Error('The backup contains invalid counter data.')
    const imported = data.counters.map((counter,index) => sanitize({...counter,id:counter.id ?? `${Date.now()}-${index}`}))
    if (!confirm(`Replace your ${counters.length} current counter${counters.length===1?'':'s'} with ${imported.length} imported counter${imported.length===1?'':'s'}?`)) return false
    setCounters(imported)
    setHistory([])
    return true
  }
  const save = draft => {
    const clean = sanitize(draft)
    setCounters(items => items.some(c => c.id === clean.id) ? items.map(c => c.id === clean.id ? clean : c) : [...items, clean])
    setEditing(null)
  }
  const edit = counter => setEditing({...counter, goals: getGoals(counter), goalDirection: counter.goalDirection || (counter.goal < counter.start ? 'less' : 'more')})
  const create = () => setEditing({ id: Date.now(), name: '', value: 0, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: 'more', min: '', max: '', color: preferences.defaultColor })

  if (currentPath === '/') return <LandingPage theme={theme}/>

  return <div className={`app-shell density-${preferences.density} numbers-${preferences.numberSize} ${preferences.animations?'':'no-animations'}`} data-theme={theme}>
    <header>
      <a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark"><span></span><span></span><span></span><span></span></span>TALLY</a>
      <div className="header-actions"><button className={`account-button ${session?'signed-in':''}`} onClick={()=>setAuthOpen(true)} title={session?.user?.email||'Sign in'}>{session?<Cloud/>:<User/>}<span>{session?syncStatus:'Sign in'}</span></button><button className="header-tool" onClick={()=>setMenu('stats')}><BarChart3/> <span>Stats</span></button><button className="header-tool" onClick={()=>setMenu('settings')}><Settings2/> <span>Settings</span></button><button className="theme-toggle" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label={`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon/>:<Sun/>}</button><button className="add-top" onClick={create}><Plus size={18}/> New counter</button></div>
    </header>
    {authNotice&&<div className="session-notice" role="alert"><div><strong>Account access ended</strong><span>{authNotice}</span></div><button onClick={()=>setAuthNotice('')} aria-label="Dismiss message"><X/></button></div>}

    <main>
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
          {counters.map((counter, index) => <CounterCard key={counter.id} counter={counter} index={index} showBounds={preferences.showBounds} onChange={change} onEdit={() => edit(counter)} onEmbed={() => setEmbedding(counter)} onDelete={() => setCounters(x => x.filter(c => c.id !== counter.id))} onReset={() => reset(counter.id)}/>) }
          <button className="new-card" onClick={create}><span><Plus/></span><strong>Add another counter</strong><small>Start tracking something new</small></button>
        </div>
      </section>
    </main>
    <footer><span>Built for the little things that add up.</span><div><span>{session?'Saved on this device and synced to the cloud':'Saved automatically on this device'}</span><a href="https://github.com/supersnug/tally-counter" target="_blank" rel="noreferrer">View on GitHub</a></div></footer>
    {editing && <Editor draft={editing} setDraft={setEditing} onClose={() => setEditing(null)} onSave={save}/>} 
    {embedding && <EmbedBuilder counter={embedding} onClose={()=>setEmbedding(null)}/>} 
    {menu==='settings'&&<AppSettings counters={counters} preferences={preferences} onPreferences={setPreferences} onImport={importBackup} onClose={()=>setMenu(null)}/>} 
    {menu==='stats'&&<StatsModal history={history} resets={statResets} onResetStat={key=>setStatResets(r=>({...r,[key]:Date.now()}))} onResetAll={()=>{setHistory([]);setStatResets({})}} onClose={()=>setMenu(null)}/>} 
    {authOpen&&<AuthModal session={session} configured={supabaseConfigured} syncStatus={syncStatus} onDeleted={()=>{setCounters([]);localStorage.removeItem('tally-counters');setAuthOpen(false)}} onClose={()=>setAuthOpen(false)}/>} 
    {syncConflict&&<SyncConflictModal deviceCount={syncConflict.deviceCounters.length} cloudCount={syncConflict.cloudCounters.length} onChoose={resolveSyncConflict}/>}
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
    {editing&&<Editor draft={editing} setDraft={setEditing} onClose={()=>setEditing(null)} onSave={save}/>} 
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

function CounterCard({counter:c, index, showBounds, onChange, onEdit, onEmbed, onDelete, onReset}) {
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
  return <article className="counter-card" style={{'--accent': c.color, '--delay': `${index * 60}ms`}}>
    <div className="card-top"><span className="counter-index">{String(index+1).padStart(2,'0')}</span><div className="card-actions"><button onClick={onEmbed} title="Embed"><Code2/></button><button onClick={onReset} title="Reset"><RotateCcw/></button><button onClick={onEdit} title="Settings"><Settings2/></button><button onClick={onDelete} title="Delete"><Trash2/></button></div></div>
    <h3>{c.name}</h3>
    <div className="number">{c.value.toLocaleString()}</div>
    {hasGoal ? <div className={`goal direction-${direction} ${complete ? 'complete':''}`}>
      <div className="goal-label"><span>{complete ? <><Check/> All goals complete</> : <><Target/> Next: {nextGoal.toLocaleString()} or {direction}</>}</span><div className="progress-detail" tabIndex="0"><b>{Math.round(nextProgress)}%</b><div className="progress-tooltip"><span>To next goal<strong>{Math.round(nextProgress)}%</strong></span><span>To final goal<strong>{Math.round(finalProgress)}%</strong></span>{maximumProgress != null && <span>To maximum<strong>{Math.round(maximumProgress)}%</strong></span>}</div></div></div>
      <div className={`track sliced direction-${direction}`}>{goals.map((goal, i) => {
        const from = i > 0 ? goals[i - 1] : c.start
        const fill = reached(goal) ? 100 : (i === activeIndex ? boundedProgress(directedProgress(visualValue, from, goal)) : 0)
        return <span key={goal} className={reached(goal) ? 'reached' : ''} title={`Goal ${i + 1}: ${goal}`}><em style={{width:`${fill}%`}} onTransitionEnd={continueProgressAnimation}></em><i>{goal}</i></span>
      })}</div>
    </div> : <div className="no-goal"><Hash/> No goal set</div>}
    <div className="controls">
      <button className="count-button negative" disabled={atMin} onClick={() => onChange(c.id, -c.minusStep)}><Minus/><span>−{c.minusStep}</span></button>
      <button className="count-button positive" disabled={atMax} onClick={() => onChange(c.id, c.plusStep)}><Plus/><span>+{c.plusStep}</span></button>
    </div>
    {showBounds&&<div className="bounds"><span>{c.min == null ? 'No minimum' : `Min ${c.min}`}{atMin && ' · reached'}</span><span>{c.max == null ? 'No maximum' : `Max ${c.max}`}{atMax && ' · reached'}</span></div>}
  </article>
}

function Editor({draft, setDraft, onClose, onSave}) {
  const field = (key, value) => setDraft(d => ({...d, [key]:value}))
  const [goalInput, setGoalInput] = useState('')
  const addGoal = () => {
    const goal = Number(goalInput)
    if (!Number.isFinite(goal) || goalInput.trim() === '') return
    field('goals', [...new Set([...(draft.goals || []), goal])])
    setGoalInput('')
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={e => {e.preventDefault(); onSave(draft)}}>
      <div className="modal-head"><div><span>COUNTER SETTINGS</span><h2>{draft.name ? 'Fine-tune your tally' : 'Create a new counter'}</h2></div><button type="button" onClick={onClose}><X/></button></div>
      <label className="wide">Counter name<input autoFocus value={draft.name} onChange={e=>field('name',e.target.value)} placeholder="e.g. Water glasses"/></label>
      <div className="form-grid">
        <label>Starting value<input type="number" value={draft.start} onChange={e=>field('start',e.target.value)}/></label>
        <label>Exact value<input type="number" value={draft.value} onChange={e=>field('value',e.target.value)}/></label>
        <label>Positive step<input type="number" min="0.000001" step="any" value={draft.plusStep} onChange={e=>field('plusStep',e.target.value)}/></label>
        <label>Negative step<input type="number" min="0.000001" step="any" value={draft.minusStep} onChange={e=>field('minusStep',e.target.value)}/></label>
      </div>
      <label className="jump-select">Jump to saved value<select value="" onChange={e=>{if(e.target.value!=='')field('value',Number(e.target.value))}}><option value="">Choose a value…</option>{[draft.start,draft.min,draft.max,...getGoals(draft)].filter((v,i,a)=>v!==''&&v!=null&&a.indexOf(v)===i).map(value=><option value={value} key={value}>{value===draft.start?'Start':getGoals(draft).includes(Number(value))?'Goal':value===draft.min?'Minimum':'Maximum'} · {value}</option>)}</select></label>
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
      <div className="modal-footer"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button className="save"><Check/> Save counter</button></div>
    </form>
  </div>
}

function AppSettings({counters, preferences, onPreferences, onImport, onClose}) {
  const [status,setStatus] = useState('')
  const [section,setSection] = useState('customize')
  const preference = (key,value) => onPreferences(current=>({...current,[key]:value}))
  const exportData = () => {
    const blob = new Blob([JSON.stringify({exportedAt:new Date().toISOString(),counters},null,2)],{type:'application/json'})
    const link = document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='tally-backup.json'; link.click(); URL.revokeObjectURL(link.href)
  }
  const importData = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (onImport(data)) setStatus('Backup imported successfully.')
    } catch (error) { setStatus(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message) }
    finally { event.target.value='' }
  }
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal utility-modal settings-modal"><div className="modal-head"><div><span>APP SETTINGS</span><h2>Make Tally yours</h2></div><button onClick={onClose}><X/></button></div><nav className="settings-tabs"><button className={section==='customize'?'active':''} onClick={()=>setSection('customize')}>Customize</button><button className={section==='backup'?'active':''} onClick={()=>setSection('backup')}>Backup & transfer</button></nav>
  {section==='backup'?<div className="settings-section"><p className="utility-intro">Move your counters between browsers or keep an offline backup. Importing replaces the counters currently on this device.</p><div className="backup-actions"><button onClick={exportData}><Download/><span><b>Export backup</b><small>Download all counters as JSON</small></span></button><label><Upload/><span><b>Import backup</b><small>Restore counters from a JSON file</small></span><input type="file" accept="application/json,.json" onChange={importData}/></label></div>{status&&<div className="utility-status">{status}</div>}</div>:
  <div className="settings-section customize-settings">
    <SettingChoice label="Card spacing" description="Choose how much room each counter uses." value={preferences.density} options={[['comfortable','Comfortable'],['compact','Compact']]} onChange={value=>preference('density',value)}/>
    <SettingChoice label="Grid columns" description="Control the dashboard layout on larger screens." value={preferences.columns} options={[['auto','Automatic'],['2','Two'],['3','Three']]} onChange={value=>preference('columns',value)}/>
    <SettingChoice label="Number size" description="Increase the main count for easier reading." value={preferences.numberSize} options={[['standard','Standard'],['large','Large']]} onChange={value=>preference('numberSize',value)}/>
    <div className="setting-row"><div><b>Counter details</b><small>Show minimum and maximum labels on cards.</small></div><button className={`setting-switch ${preferences.showBounds?'active':''}`} onClick={()=>preference('showBounds',!preferences.showBounds)}><i></i></button></div>
    <div className="setting-row"><div><b>Animations</b><small>Animate cards and progress changes.</small></div><button className={`setting-switch ${preferences.animations?'active':''}`} onClick={()=>preference('animations',!preferences.animations)}><i></i></button></div>
    <div className="setting-row"><div><b>Default counter color</b><small>Used when creating a new counter.</small></div><input className="default-color" type="color" value={preferences.defaultColor} onChange={e=>preference('defaultColor',e.target.value)}/></div>
  </div>}</div></div>
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

function StatsModal({history, resets, onResetStat, onResetAll, onClose}) {
  const since = key => history.filter(item=>item.time>(resets[key]||0))
  const net = since('net').reduce((sum,item)=>sum+item.to-item.from,0)
  const distance = since('distance').reduce((sum,item)=>sum+Math.abs(item.to-item.from),0)
  const increments = since('increments').filter(item=>item.kind==='increment').length
  const decrements = since('decrements').filter(item=>item.kind==='decrement').length
  const resetCount = since('resets').filter(item=>item.kind==='reset').length
  const counts = since('active').reduce((map,item)=>({...map,[item.name]:(map[item.name]||0)+1}),{})
  const mostActive = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]
  const resettable = (key, children, className='') => <button type="button" className={className} title="Click to reset" onClick={()=>onResetStat(key)}>{children}</button>
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal utility-modal stats-modal"><div className="modal-head"><div><span>THIS SESSION</span><h2>Counting stats</h2></div><button onClick={onClose}><X/></button></div><div className="stats-grid">{resettable('actions',<><span>Session actions</span><strong>{since('actions').length}</strong></>)}{resettable('net',<><span>Net movement</span><strong>{net>0?'+':''}{net}</strong></>)}{resettable('distance',<><span>Total distance</span><strong>{distance}</strong></>)}{resettable('active',<><span>Most active</span><strong className="text-stat">{mostActive?.[0]||'—'}</strong><small>{mostActive?`${mostActive[1]} actions`:'No activity yet'}</small></>)}</div><div className="stats-breakdown">{resettable('increments',<><Plus/> Increments <b>{increments}</b></>)}{resettable('decrements',<><Minus/> Decrements <b>{decrements}</b></>)}{resettable('resets',<><RotateCcw/> Resets <b>{resetCount}</b></>)}</div><div className="modal-footer"><button className="cancel" disabled={!history.length} onClick={onResetAll}>Reset all stats</button><button className="save" onClick={onClose}>Done</button></div></div></div>
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
