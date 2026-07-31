import { useEffect, useMemo, useRef } from 'react'
import { client, useConfig, usePaginatedElementData } from '@sigmacomputing/plugin'
import { DEMO_EVENTS } from './demoData.js'

const PAGE_SIZE = 25000
const BUILD = import.meta.env.VITE_BUILD_STAMP || 'local'
console.info('[shipment timeline] build', BUILD)   // no on-screen label; check the console

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
const DEF_SHAPE={waypoint:'pin',failed_waypoint:'pin',travel:'bare','unplanned stop':'octagon',temp_out_of_range:'triangle',temp_back_in_range:'triangle',alert:'triangle',carrier_change:'circle',loading:'circle',unloading:'circle',arrive:'circle',depart:'circle'}
const DEF_COLOR={waypoint:'#2563eb',failed_waypoint:'#94a3b8',travel:null,'unplanned stop':'#d97706',temp_out_of_range:'#dc2626',temp_back_in_range:'#0d9488',alert:'#dc2626',carrier_change:'#7c3aed',loading:'#16a34a',unloading:'#16a34a',arrive:'#586176',depart:'#586176'}
const DEF_ICON={waypoint:'pin',failed_waypoint:'pin-missed',travel:'transit','unplanned stop':'stop',temp_out_of_range:'thermo-up',temp_back_in_range:'thermo-dn',alert:'bell',carrier_change:'handoff',loading:'load',unloading:'unload',arrive:'anchor',depart:'anchor'}
function markerHtml(e, size){
  size=size||30; const type=e.type; const shape=e.shape||DEF_SHAPE[type]||'circle'; const color=e.color||DEF_COLOR[type]||'#586176'; const iconKey=e.iconKey||DEF_ICON[type]||'bell'
  if(shape==='bare') return `<span style="font-size:${size-2}px;line-height:1">${MODE_EMOJI[e.legMode]||'🧭'}</span>`
  if(shape==='pin'){ const w=size,h=Math.round(size*1.29),missed=iconKey==='pin-missed',num=e.wpNum!=null?e.wpNum:''
    const slash=missed?'<path d="M4 4 L30 40" stroke="#fff" stroke-width="4" stroke-linecap="round"/>':''; const anchor=e.container?ANCHOR_BADGE:''
    return `<div style="position:relative;width:${w}px;height:${h}px;filter:drop-shadow(0 1px 2px rgba(20,30,60,.35))"><svg viewBox="0 0 34 44" width="${w}" height="${h}"><path d="M17 43C17 43 32 25 32 15A15 15 0 1 0 2 15C2 25 17 43 17 43Z" fill="${color}" stroke="#fff" stroke-width="2.5"/>${slash}</svg><div style="position:absolute;top:${Math.round(h*0.14)}px;left:0;width:${w}px;text-align:center;font-weight:800;font-size:${Math.round(size*0.5)}px;text-shadow:0 1px 1px rgba(0,0,0,.4);color:${missed?'#1a2233':'#fff'}">${num}</div>${anchor}</div>` }
  if(shape==='octagon') return `<div style="width:${size}px;height:${size}px"><svg viewBox="0 0 34 34" width="${size}" height="${size}"><path d="M10 2H24L32 10V24L24 32H10L2 24V10Z" fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg></div>`
  if(shape==='triangle') return `<div style="position:relative;width:${size}px;height:${size}px"><svg viewBox="0 0 34 34" width="${size}" height="${size}"><path d="M17 3.5 32.5 31H1.5Z" fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-top:${Math.round(size*0.24)}px">${gsvg(iconKey,Math.round(size*0.44))}</span></div>`
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(20,30,60,.3);display:flex;align-items:center;justify-content:center;background:${color}">${gsvg(iconKey,Math.round(size*0.56))}</div>`
}

const BASE_CONFIG=[
  { name:'events', type:'element' },
  { name:'eventType', type:'column', source:'events', allowMultiple:false, label:'Event type' },
  { name:'order', type:'column', source:'events', allowMultiple:false, label:'Event time' },
  { name:'eventEnd', type:'column', source:'events', allowMultiple:false, label:'Event end' },
  { name:'status', type:'column', source:'events', allowMultiple:false, label:'Status' },
  { name:'label', type:'column', source:'events', allowMultiple:false, label:'Event label' },
  { name:'eventId', type:'column', source:'events', allowMultiple:false, label:'Event id' },
  { name:'parentId', type:'column', source:'events', allowMultiple:false, label:'Parent event id' },
  { name:'waypointNumber', type:'column', source:'events', allowMultiple:false, label:'Waypoint number' },
  { name:'legMode', type:'column', source:'events', allowMultiple:false, label:'Leg mode' },
  { name:'legNumber', type:'column', source:'events', allowMultiple:false, label:'Leg number' },
  { name:'isContainerPort', type:'column', source:'events', allowMultiple:false, label:'Container port' },
  { name:'durationSec', type:'column', source:'events', allowMultiple:false, label:'Duration (sec)' },
  { name:'arrivalSource', type:'column', source:'events', allowMultiple:false, label:'Arrival source' },
  { name:'departureSource', type:'column', source:'events', allowMultiple:false, label:'Departure source' },
  { name:'iconKey', type:'column', source:'events', allowMultiple:false, label:'Icon key' },
  { name:'shape', type:'column', source:'events', allowMultiple:false, label:'Shape' },
  { name:'color', type:'column', source:'events', allowMultiple:false, label:'Color' },
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
function fmt(t){ if(t==null||t==='')return''; let d; const n=typeof t==='number'?t:Number(t); if(Number.isFinite(n)&&!/[-:T]/.test(String(t))){ d=new Date(n>1e12?n:n>1e9?n*1000:n); } else { d=new Date(String(t).replace(' ','T')); } if(Number.isNaN(d.getTime()))return esc(String(t)); return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) }
// one duration formatter: seconds -> min under an hour, hr above (1 decimal under 10 hr)
function durStr(sec){ if(sec==null)return''; if(sec<60)return Math.max(1,Math.round(sec))+' sec'; if(sec<3600)return Math.round(sec/60)+' min'; const h=sec/3600; return (h<10?h.toFixed(1):h.toFixed(0))+' hr' }
// Provenance: say so when a boundary time came from the carrier's container gate feed
// (rare but strong evidence). Tracker-derived times are the default and stay unlabelled.
function srcTag(src){ return src==='container' ? ' <span class="src">(container gate)</span>' : '' }
function durTxt(sec){ return sec==null?'':' · dwell '+durStr(sec) }
function whenText(e){
  if(e.type==='waypoint')return '<b>Arrived</b> '+fmt(e.order)+srcTag(e.arrSrc)
    +(e.end?'&nbsp;&nbsp;·&nbsp;&nbsp;<b>Departed</b> '+fmt(e.end)+srcTag(e.depSrc)+durTxt(e.dur):'')
  if(e.type==='failed_waypoint')return 'Expected here — not reached'+(e.order?' (nearest pass '+fmt(e.order)+')':'')
  if(e.end)return fmt(e.order)+' – '+fmt(e.end)+(e.dur!=null?' · '+durStr(e.dur):''); return fmt(e.order) }
function rowHtml(e){
  const mode=e.type==='travel'&&e.legMode?`<span class="badge-mode">${esc(e.legMode)}</span>`:''
  return `<div class="row"><div class="ico">${markerHtml(e,30)}</div><div class="body"><div class="lbl">${esc(labelOf(e))}${mode}</div><div class="st">${esc(e.status||'')}</div><div class="tm">${whenText(e)}</div></div></div>`
}
// One-line roll-up of what happened during a span, shown at the top level (collapsed);
// the peak temperature is worth calling out inline since it's the headline of an excursion.
function summarize(ch){
  const n={}; for(const e of ch) n[e.type]=(n[e.type]||0)+1
  const chips=[]
  const add=(c,one,many)=>{ if(c) chips.push(`<span class="chip">${c} ${c===1?one:many}</span>`) }
  add(n['unplanned stop'],'stop','stops')
  if(n['temp_out_of_range']){
    let peak=null; for(const e of ch){ if(e.type==='temp_out_of_range'){ const m=/peaked\s+(-?[\d.]+)/i.exec(e.status||''); if(m) peak=Math.max(peak??-1e9, parseFloat(m[1])) } }
    const c=n['temp_out_of_range']
    chips.push(`<span class="chip chip-warn">${c} temp excursion${c===1?'':'s'}${peak!=null?` · peak ${Math.round(peak*10)/10}°`:''}</span>`)
  }
  add(n['alert'],'alert','alerts')
  add(n['carrier_change'],'carrier change','carrier changes')
  add((n['loading']||0)+(n['unloading']||0),'cargo event','cargo events')
  return chips.length ? `<div class="summary-chips">${chips.join('')}</div>` : ''
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
        container:!!r.IS_CONTAINER_PORT, color:r.COLOR, shape:r.SHAPE, iconKey:r.ICON_KEY, dur:r.DURATION_SEC,
        arrSrc:r.ARRIVAL_SOURCE, depSrc:r.DEPARTURE_SOURCE })), error:null }
    }
    if(!config.events) return { rows:[], error:'Select an events table in the panel.' }
    if(!config.eventType) return { rows:[], error:'Choose the event type column.' }
    const col=(id)=>id?data?.[id]:null
    const et=col(config.eventType); if(!et) return { rows:[], error:'Loading data…' }
    const id=col(config.eventId),parent=col(config.parentId),ord=col(config.order),end=col(config.eventEnd),status=col(config.status),
      label=col(config.label),mode=col(config.legMode),legn=col(config.legNumber),wp=col(config.waypointNumber),cont=col(config.isContainerPort),
      color=col(config.color),shape=col(config.shape),ik=col(config.iconKey),dur=col(config.durationSec),
      asrc=col(config.arrivalSource),dsrc=col(config.departureSource)
    const out=[]
    for(let i=0;i<et.length;i++){
      out.push({ id:id?id[i]:i, parent:parent?parent[i]:null, type:et[i]?String(et[i]):null, order:ord?ord[i]:i, end:end?end[i]:null,
        status:status?status[i]:'', label:label?label[i]:null, legMode:mode?mode[i]:null, legNumber:legn?legn[i]:null,
        wpNum:wp?toNum(wp[i]):null, container:cont?truthy(cont[i]):false, color:color?color[i]:null,
        arrSrc:asrc?asrc[i]:null, depSrc:dsrc?dsrc[i]:null,
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
    for(const e of top){
      const ch=(kids.get(String(e.id))||[]).slice().sort(cmp)
      if(ch.length){
        // span with nested events -> collapsible; summary (with child roll-up) is the top level
        out+='<details class="span"><summary>'+rowHtml(e)+summarize(ch)+'</summary>'
            +'<div class="indent">'+ch.map(rowHtml).join('')+'</div></details>'
      } else {
        out+=rowHtml(e)
      }
    }
    return out
  },[rows,config.title])

  return (<div className="tl">{ error ? <div className="plugin-message">{error}</div> : <div dangerouslySetInnerHTML={{__html:html}} /> }</div>)
}
