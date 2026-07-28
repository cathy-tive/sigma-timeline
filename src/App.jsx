import { useEffect, useMemo, useRef } from 'react'
import { client, useConfig, usePaginatedElementData } from '@sigmacomputing/plugin'
import { DEMO_EVENTS } from './demoData.js'

const PAGE_SIZE = 25000

// ===== shared icon system (shape + color + icon_key from data) =====
const GLYPH = {
  'thermo-up':'<path d="M13 4v10.2a3.6 3.6 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M19 9V3M16.5 5.5 19 3l2.5 2.5"/>',
  'thermo-dn':'<path d="M13 4v10.2a3.6 3.6 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M19 3v6M16.5 6.5 19 9l2.5-2.5"/>',
  'bolt':'<path d="M13 2 4 14h7l-1 8 10-12h-7z"/>',
  'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  'route':'<path d="M5 19V11a4 4 0 0 1 4-4h7"/><path d="M13 4l4 3-4 3"/>',
  'snow':'<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/>',
  'scissors':'<circle cx="6" cy="7" r="2.2"/><circle cx="6" cy="17" r="2.2"/><path d="M8 8.5 20 17M8 15.5 20 7"/>',
  'bell':'<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10.2 21a2 2 0 0 0 3.6 0"/>',
  'handoff':'<path d="m16 3 4 4-4 4M20 7H5M8 21l-4-4 4-4M4 17h15"/>',
  'load':'<path d="M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8"/>',
  'unload':'<path d="M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8"/>',
  'anchor':'<circle cx="12" cy="5" r="3"/><path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/>',
}
const MODE_EMOJI = { Ocean:'🚢', Air:'✈️', Road:'🚚', Rail:'🚆' }
const gsvg = (key,size)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="stroke:#fff;fill:none;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round">${GLYPH[key]||''}</svg>`
const ANCHOR_BADGE='<div style="position:absolute;right:-8px;top:-7px;width:18px;height:18px;border-radius:50%;background:#fff;border:1.5px solid #586176;display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1">&#9875;</div>'
function markerHtml(e, size){
  size=size||26; const color=e.color||'#586176'; const shape=e.shape||'circle'
  if(shape==='bare') return `<span style="font-size:${size-2}px;line-height:1">${MODE_EMOJI[e.legMode]||'🧭'}</span>`
  if(shape==='pin'){ const w=size,h=Math.round(size*1.29),missed=e.iconKey==='pin-missed',num=e.wpNum!=null?e.wpNum:''
    const slash=missed?'<path d="M4 4 L30 40" stroke="#fff" stroke-width="4" stroke-linecap="round"/>':''; const anchor=e.container?ANCHOR_BADGE:''
    return `<div style="position:relative;width:${w}px;height:${h}px;filter:drop-shadow(0 1px 2px rgba(20,30,60,.35))"><svg viewBox="0 0 34 44" width="${w}" height="${h}"><path d="M17 43C17 43 32 25 32 15A15 15 0 1 0 2 15C2 25 17 43 17 43Z" fill="${color}" stroke="#fff" stroke-width="2.5"/>${slash}</svg><div style="position:absolute;top:${Math.round(h*0.14)}px;left:0;width:${w}px;text-align:center;font-weight:800;font-size:${Math.round(size*0.44)}px;color:${missed?'#1a2233':'#fff'}">${num}</div>${anchor}</div>` }
  if(shape==='octagon') return `<div style="width:${size}px;height:${size}px"><svg viewBox="0 0 34 34" width="${size}" height="${size}"><path d="M10 2H24L32 10V24L24 32H10L2 24V10Z" fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg></div>`
  if(shape==='triangle') return `<div style="position:relative;width:${size}px;height:${size}px"><svg viewBox="0 0 34 34" width="${size}" height="${size}"><path d="M17 3.5 32.5 31H1.5Z" fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-top:${Math.round(size*0.2)}px">${gsvg(e.iconKey,Math.round(size*0.42))}</span></div>`
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(20,30,60,.3);display:flex;align-items:center;justify-content:center;background:${color}">${gsvg(e.iconKey,Math.round(size*0.56))}</div>`
}

const BASE_CONFIG=[
  { name:'events', type:'element' },
  { name:'eventId', type:'column', source:'events', allowMultiple:false },
  { name:'parentId', type:'column', source:'events', allowMultiple:false },
  { name:'eventType', type:'column', source:'events', allowMultiple:false },
  { name:'order', type:'column', source:'events', allowMultiple:false },
  { name:'eventEnd', type:'column', source:'events', allowMultiple:false },
  { name:'status', type:'column', source:'events', allowMultiple:false },
  { name:'label', type:'column', source:'events', allowMultiple:false },
  { name:'Style (from data)', type:'group' },
  { name:'shape', type:'column', source:'events', allowMultiple:false },
  { name:'color', type:'column', source:'events', allowMultiple:false },
  { name:'iconKey', type:'column', source:'events', allowMultiple:false },
  { name:'Attributes', type:'group' },
  { name:'legMode', type:'column', source:'events', allowMultiple:false },
  { name:'legNumber', type:'column', source:'events', allowMultiple:false },
  { name:'waypointNumber', type:'column', source:'events', allowMultiple:false },
  { name:'isContainerPort', type:'column', source:'events', allowMultiple:false },
  { name:'durationSec', type:'column', source:'events', allowMultiple:false },
  { name:'Header', type:'group' },
  { name:'title', type:'text', placeholder:'Timeline header (defaults to "Event timeline")' },
]
client.config.configureEditorPanel(BASE_CONFIG)

const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const toNum=(v)=>{if(v==null||v==='')return null;const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null}
const truthy=(v)=>v===true||v==='true'||v===1||v==='1'
function labelOf(e){ const t=e.type,s=e.status||''
  if(t==='waypoint'||t==='failed_waypoint'){ if(/^Shipment origin/i.test(s))return'Shipment origin'; if(/not reached/i.test(s))return'Destination — not reached'; if(/^Shipment destination/i.test(s))return'Shipment destination'; return e.wpNum?('Waypoint '+e.wpNum):'Waypoint' }
  if(t==='travel')return'In transit — Leg '+(e.legNumber ?? ''); return e.label||t }
function fmt(t){ if(!t)return''; const d=new Date(String(t).replace(' ','T')); if(Number.isNaN(d.getTime()))return esc(String(t)); return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) }
function durTxt(sec){ if(sec==null)return''; const h=sec/3600; return h>=1?' · dwell '+h.toFixed(0)+' hr':' · dwell '+Math.round(sec/60)+' min' }
function whenText(e){
  if(e.type==='waypoint')return '<b>Arrived</b> '+fmt(e.order)+(e.end?'&nbsp;&nbsp;·&nbsp;&nbsp;<b>Departed</b> '+fmt(e.end)+durTxt(e.dur):'')
  if(e.type==='failed_waypoint')return 'Expected here — not reached'+(e.order?' (nearest pass '+fmt(e.order)+')':'')
  if(e.end)return fmt(e.order)+' – '+fmt(e.end)+(e.dur!=null?' · '+(e.dur/3600).toFixed(0)+' hr':''); return fmt(e.order) }
function rowHtml(e){
  const mode=e.type==='travel'&&e.legMode?`<span class="badge-mode">${esc(e.legMode)}</span>`:''
  return `<div class="row"><div class="ico">${markerHtml(e,26)}</div><div class="body"><div class="lbl">${esc(labelOf(e))}${mode}</div><div class="st">${esc(e.status||'')}</div><div class="tm">${whenText(e)}</div></div></div>`
}

function usePagedElementData(configId){
  const [data,loadMore]=usePaginatedElementData(configId)
  const requestedRef=useRef(-1)
  const count=useMemo(()=>{const k=data?Object.keys(data)[0]:null;return k&&data[k]?data[k].length:0},[data])
  useEffect(()=>{requestedRef.current=-1},[configId])
  useEffect(()=>{ if(!configId)return; if(count>requestedRef.current&&count%PAGE_SIZE===0){requestedRef.current=count;loadMore()} },[configId,count,data,loadMore])
  return data
}

export default function App(){
  const config=useConfig()
  const data=usePagedElementData(config.events)
  const isDemo=typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('demo')

  const { rows, error }=useMemo(()=>{
    if(isDemo&&!config.events){
      return { rows: DEMO_EVENTS.map(r=>({ id:r.EVENT_ID, parent:r.PARENT_EVENT_ID, type:r.EVENT_TYPE, order:r.EVENT_TIME, end:r.EVENT_END,
        status:r.STATUS, label:r.DISPLAY_LABEL, legMode:r.LEG_MODE, legNumber:r.LEG_NUMBER, wpNum:r.WAYPOINT_NUMBER,
        container:!!r.IS_CONTAINER_PORT, color:r.COLOR, shape:r.SHAPE, iconKey:r.ICON_KEY, dur:r.DURATION_SEC })), error:null }
    }
    if(!config.events) return { rows:[], error:'Select an events table in the panel.' }
    if(!config.eventType) return { rows:[], error:'Choose the event type column.' }
    const col=(id)=>id?data?.[id]:null
    const et=col(config.eventType); if(!et) return { rows:[], error:'Loading data…' }
    const id=col(config.eventId),parent=col(config.parentId),ord=col(config.order),end=col(config.eventEnd),status=col(config.status),
      label=col(config.label),mode=col(config.legMode),legn=col(config.legNumber),wp=col(config.waypointNumber),cont=col(config.isContainerPort),
      color=col(config.color),shape=col(config.shape),ik=col(config.iconKey),dur=col(config.durationSec)
    const out=[]
    for(let i=0;i<et.length;i++){
      out.push({ id:id?id[i]:i, parent:parent?parent[i]:null, type:et[i]?String(et[i]):null, order:ord?ord[i]:i, end:end?end[i]:null,
        status:status?status[i]:'', label:label?label[i]:null, legMode:mode?mode[i]:null, legNumber:legn?legn[i]:null,
        wpNum:wp?toNum(wp[i]):null, container:cont?truthy(cont[i]):false, color:color?color[i]:null,
        shape:shape?String(shape[i]||''):null, iconKey:ik?String(ik[i]||''):null, dur:dur?toNum(dur[i]):null })
    }
    return { rows:out, error:out.length?null:'No rows.' }
  },[config,data,isDemo])

  const html=useMemo(()=>{
    if(!rows.length) return ''
    const byId=new Map(rows.map(e=>[String(e.id),e])); const kids=new Map()
    for(const e of rows){ if(e.parent!=null&&byId.has(String(e.parent))){ const k=String(e.parent); if(!kids.has(k))kids.set(k,[]); kids.get(k).push(e) } }
    const cmp=(a,b)=>(a.order>b.order?1:a.order<b.order?-1:0)
    const top=rows.filter(e=>e.parent==null||!byId.has(String(e.parent))).sort((a,b)=>cmp(a,b)||(a.type==='travel'?1:0))
    let out=`<h2>${esc(config.title||'Event timeline')}</h2>`
    for(const e of top){ out+=rowHtml(e); const ch=(kids.get(String(e.id))||[]).slice().sort(cmp); if(ch.length) out+='<div class="indent">'+ch.map(rowHtml).join('')+'</div>' }
    return out
  },[rows,config.title])

  return (<div className="tl">{ error ? <div className="plugin-message">{error}</div> : <div dangerouslySetInnerHTML={{__html:html}} /> }</div>)
}
