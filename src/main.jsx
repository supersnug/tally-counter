import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Plus, Minus, Settings2, RotateCcw, Trash2, X, Check, Target, Hash, Sparkles, Moon, Sun, Code2, Copy, BarChart3, Download, Upload } from 'lucide-react'
import './styles.css'

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

function App() {
  const [counters, setCounters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tally-counters')) || starter } catch { return starter }
  })
  const [editing, setEditing] = useState(null)
  const [embedding, setEmbedding] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('tally-theme') || 'light')
  const [history, setHistory] = useState([])
  const [menu, setMenu] = useState(null)
  const [statResets, setStatResets] = useState({})
  const [preferences, setPreferences] = useState(() => {
    const defaults = {density:'comfortable', columns:'auto', numberSize:'standard', showBounds:true, animations:true, defaultColor:COLORS[0]}
    try { return {...defaults,...JSON.parse(localStorage.getItem('tally-preferences'))} } catch { return defaults }
  })

  useEffect(() => localStorage.setItem('tally-counters', JSON.stringify(counters)), [counters])
  useEffect(() => localStorage.setItem('tally-preferences', JSON.stringify(preferences)), [preferences])
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const isEmbedPage = location.pathname.replace(/\/$/, '').endsWith('/embed') || query.has('embedData')
    if (isEmbedPage) return
    localStorage.setItem('tally-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const route = new URLSearchParams(location.search)
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const relativePath = basePath && location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length)
    : location.pathname
  const currentPath = `/${relativePath}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  if (currentPath === '/embed' || route.has('embedData')) {
    const embeddedCounter = decodeCounter(route.get('data') || route.get('embedData'))
    return embeddedCounter ? <EmbeddedCounter initial={embeddedCounter} params={route}/> : <div className="embed-error"><Hash/><h1>Counter not found</h1><p>This embed link is missing its counter data.</p></div>
  }
  if (currentPath !== '/') return <NotFound/>

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

  return <div className={`app-shell density-${preferences.density} numbers-${preferences.numberSize} ${preferences.animations?'':'no-animations'}`} data-theme={theme}>
    <header>
      <a className="brand" href="#"><span className="brand-mark"><span></span><span></span><span></span><span></span></span>TALLY</a>
      <div className="header-actions"><button className="header-tool" onClick={()=>setMenu('stats')}><BarChart3/> <span>Stats</span></button><button className="header-tool" onClick={()=>setMenu('settings')}><Settings2/> <span>Settings</span></button><button className="theme-toggle" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label={`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon/>:<Sun/>}</button><button className="add-top" onClick={create}><Plus size={18}/> New counter</button></div>
    </header>

    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> Your everyday counting space</div>
        <h1>Keep count.<br/><em>Stay on track.</em></h1>
        <p>Highly customizable counters for everything that matters—from daily habits to live inventory.</p>
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
    <footer><span>Built for the little things that add up.</span><div><span>Saved automatically on this device</span><a href="https://github.com/supersnug/tally-counter" target="_blank" rel="noreferrer">View on GitHub</a></div></footer>
    {editing && <Editor draft={editing} setDraft={setEditing} onClose={() => setEditing(null)} onSave={save}/>} 
    {embedding && <EmbedBuilder counter={embedding} onClose={()=>setEmbedding(null)}/>} 
    {menu==='settings'&&<AppSettings counters={counters} preferences={preferences} onPreferences={setPreferences} onImport={importBackup} onClose={()=>setMenu(null)}/>} 
    {menu==='stats'&&<StatsModal history={history} resets={statResets} onResetStat={key=>setStatResets(r=>({...r,[key]:Date.now()}))} onResetAll={()=>{setHistory([]);setStatResets({})}} onClose={()=>setMenu(null)}/>} 
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
  const direction = c.goalDirection || (c.goal < c.start ? 'less' : 'more')
  const complete = isComplete(c)
  const hasGoal = goals.length > 0
  const reached = goal => direction === 'less' ? c.value <= goal : c.value >= goal
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
  const nextProgress = nextGoal == null ? 100 : directedProgress(c.value, activeOrigin, nextGoal)
  const finalProgress = directedProgress(c.value, c.start, goals.at(-1))
  const maximumProgress = c.max == null || c.max === c.start ? null : ((c.value - c.start) / (c.max - c.start)) * 100
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
        const fill = reached(goal) ? 100 : (i === activeIndex ? boundedProgress(directedProgress(c.value, from, goal)) : 0)
        return <span key={goal} className={reached(goal) ? 'reached' : ''} title={`Goal ${i + 1}: ${goal}`}><em style={{width:`${fill}%`}}></em><i>{goal}</i></span>
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
