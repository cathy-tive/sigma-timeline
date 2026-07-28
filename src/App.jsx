import { useEffect, useMemo, useRef, useState } from 'react'
import {
  client,
  useConfig,
  useElementColumns,
  usePaginatedElementData,
} from '@sigmacomputing/plugin'
import { DEMO_EVENTS } from './demoData.js'

const PAGE_SIZE = 25000

// lucide-style line-icon paths
const G = {
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  thermometer: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  stop: '<path d="M7.3 2.6h9.4L21.4 7.3v9.4L16.7 21.4H7.3L2.6 16.7V7.3z"/>',
  handoff: '<path d="m16 3 4 4-4 4M20 7H5M8 21l-4-4 4-4M4 17h15"/>',
  load: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
}
const MODE_EMOJI = { Ocean: '🚢', Air: '✈️', Road: '🚚', Rail: '🚆' }
const TOKEN = { red: 'var(--red)', blue: 'var(--blue)' }

const BASE_CONFIG = [
  { name: 'events', type: 'element' },
  { name: 'eventId', type: 'column', source: 'events', allowMultiple: false },
  { name: 'parentId', type: 'column', source: 'events', allowMultiple: false },
  { name: 'eventType', type: 'column', source: 'events', allowMultiple: false },
  { name: 'order', type: 'column', source: 'events', allowMultiple: false },
  { name: 'eventEnd', type: 'column', source: 'events', allowMultiple: false },
  { name: 'status', type: 'column', source: 'events', allowMultiple: false },
  { name: 'label', type: 'column', source: 'events', allowMultiple: false },
  { name: 'Attributes', type: 'group' },
  { name: 'legMode', type: 'column', source: 'events', allowMultiple: false },
  { name: 'legNumber', type: 'column', source: 'events', allowMultiple: false },
  { name: 'waypointNumber', type: 'column', source: 'events', allowMultiple: false },
  { name: 'color', type: 'column', source: 'events', allowMultiple: false },
  { name: 'durationSec', type: 'column', source: 'events', allowMultiple: false },
  { name: 'Header', type: 'group' },
  { name: 'title', type: 'text', placeholder: 'Timeline header (defaults to "Event timeline")' },
]
client.config.configureEditorPanel(BASE_CONFIG)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
const svg = (glyph, fill) => `<svg viewBox="0 0 24 24" class="${fill ? 'fillwhite' : ''}">${glyph}</svg>`

function visual(e) {
  const t = e.type
  if (t === 'waypoint') return { bg: 'var(--reached)', glyph: G.pin, fill: true }
  if (t === 'failed_waypoint') return { bg: 'var(--missed)', glyph: G.pin, fill: true }
  if (t === 'travel') return { bg: 'transparent', emoji: MODE_EMOJI[e.legMode] || '🧭', bare: true }
  if (t === 'unplanned stop') return { bg: 'var(--amber)', glyph: G.stop, fill: true }
  if (t === 'carrier_change') return { bg: 'var(--purple)', glyph: G.handoff }
  if (t === 'loading' || t === 'unloading') return { bg: 'var(--green)', glyph: G.load }
  if (t === 'alert') return { bg: 'var(--red)', glyph: G.alert, fill: true }
  if (t && t.startsWith('temp')) return { bg: TOKEN[e.color] || 'var(--slate)', glyph: G.thermometer }
  return { bg: 'var(--slate)', glyph: G.pin, fill: true }
}
function labelOf(e) {
  const t = e.type, s = e.status || ''
  if (t === 'waypoint' || t === 'failed_waypoint') {
    if (/^Shipment origin/i.test(s)) return 'Shipment origin'
    if (/not reached/i.test(s)) return 'Destination — not reached'
    if (/^Shipment destination/i.test(s)) return 'Shipment destination'
    return e.wpNum ? 'Waypoint ' + e.wpNum : 'Waypoint'
  }
  if (t === 'travel') return 'In transit — Leg ' + (e.legNumber ?? '')
  return e.label || t
}
function fmt(t) {
  if (!t) return ''
  const d = new Date(String(t).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(t)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function durTxt(sec) {
  if (sec == null) return ''
  const h = sec / 3600
  return h >= 1 ? ' · dwell ' + h.toFixed(0) + ' hr' : ' · dwell ' + Math.round(sec / 60) + ' min'
}
function whenText(e) {
  if (e.type === 'waypoint')
    return '<b>Arrived</b> ' + fmt(e.order) + (e.end ? '&nbsp;&nbsp;·&nbsp;&nbsp;<b>Departed</b> ' + fmt(e.end) + durTxt(e.dur) : '')
  if (e.type === 'failed_waypoint')
    return 'Expected here — not reached' + (e.order ? ' (nearest pass ' + fmt(e.order) + ')' : '')
  if (e.end) return fmt(e.order) + ' – ' + fmt(e.end) + (e.dur != null ? ' · ' + (e.dur / 3600).toFixed(0) + ' hr' : '')
  return fmt(e.order)
}
function rowHtml(e) {
  const v = visual(e)
  const inner = v.emoji ? `<span style="font-size:${v.bare ? 22 : 14}px;line-height:1">${v.emoji}</span>` : svg(v.glyph, v.fill)
  const badge = e.wpNum ? `<span style="position:absolute;left:8px;top:-6px;background:var(--ink);color:#fff;border-radius:50%;width:15px;height:15px;font-size:9.5px;display:flex;align-items:center;justify-content:center;font-weight:700">${e.wpNum}</span>` : ''
  const mode = e.type === 'travel' && e.legMode ? `<span class="badge-mode">${esc(e.legMode)}</span>` : ''
  return `<div class="row"><div class="ico ${v.fill ? 'fillwhite' : ''}" style="background:${v.bg};position:relative">${inner}${badge}</div>` +
    `<div class="body"><div class="lbl">${esc(labelOf(e))}${mode}</div><div class="st">${esc(e.status || '')}</div><div class="tm">${whenText(e)}</div></div></div>`
}

function usePagedElementData(configId) {
  const [data, loadMore] = usePaginatedElementData(configId)
  const requestedRef = useRef(-1)
  const count = useMemo(() => {
    const k = data ? Object.keys(data)[0] : null
    return k && data[k] ? data[k].length : 0
  }, [data])
  useEffect(() => { requestedRef.current = -1 }, [configId])
  useEffect(() => {
    if (!configId) return
    if (count > requestedRef.current && count % PAGE_SIZE === 0) { requestedRef.current = count; loadMore() }
  }, [configId, count, data, loadMore])
  return data
}

export default function App() {
  const config = useConfig()
  const data = usePagedElementData(config.events)
  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

  const { rows, error } = useMemo(() => {
    if (isDemo && !config.events) {
      return {
        rows: DEMO_EVENTS.map((r) => ({
          id: r.EVENT_ID, parent: r.PARENT_EVENT_ID, type: r.EVENT_TYPE, order: r.EVENT_TIME,
          end: r.EVENT_END, status: r.STATUS, label: r.DISPLAY_LABEL, legMode: r.LEG_MODE,
          legNumber: r.LEG_NUMBER, wpNum: r.WAYPOINT_NUMBER, color: r.COLOR, dur: r.DURATION_SEC,
        })),
        error: null,
      }
    }
    if (!config.events) return { rows: [], error: 'Select an events table in the panel.' }
    if (!config.eventType) return { rows: [], error: 'Choose the event type column.' }
    const col = (id) => (id ? data?.[id] : null)
    const et = col(config.eventType)
    if (!et) return { rows: [], error: 'Loading data…' }
    const id = col(config.eventId), parent = col(config.parentId), ord = col(config.order)
    const end = col(config.eventEnd), status = col(config.status), label = col(config.label)
    const mode = col(config.legMode), legn = col(config.legNumber), wp = col(config.waypointNumber)
    const color = col(config.color), dur = col(config.durationSec)
    const out = []
    for (let i = 0; i < et.length; i++) {
      out.push({
        id: id ? id[i] : i, parent: parent ? parent[i] : null, type: et[i] ? String(et[i]) : null,
        order: ord ? ord[i] : i, end: end ? end[i] : null, status: status ? status[i] : '',
        label: label ? label[i] : null, legMode: mode ? mode[i] : null, legNumber: legn ? legn[i] : null,
        wpNum: wp ? toNum(wp[i]) : null, color: color ? color[i] : null, dur: dur ? toNum(dur[i]) : null,
      })
    }
    return { rows: out, error: out.length ? null : 'No rows.' }
  }, [config, data, isDemo])

  const html = useMemo(() => {
    if (!rows.length) return ''
    const byId = new Map(rows.map((e) => [String(e.id), e]))
    const kids = new Map()
    for (const e of rows) {
      if (e.parent != null && byId.has(String(e.parent))) {
        const k = String(e.parent)
        if (!kids.has(k)) kids.set(k, [])
        kids.get(k).push(e)
      }
    }
    const cmp = (a, b) => (a.order > b.order ? 1 : a.order < b.order ? -1 : 0)
    const top = rows
      .filter((e) => e.parent == null || !byId.has(String(e.parent)))
      .sort((a, b) => cmp(a, b) || (a.type === 'travel' ? 1 : 0))
    const title = esc(config.title || 'Event timeline')
    let out = `<h2>${title}</h2>`
    for (const e of top) {
      out += rowHtml(e)
      const ch = (kids.get(String(e.id)) || []).slice().sort(cmp)
      if (ch.length) out += '<div class="indent">' + ch.map(rowHtml).join('') + '</div>'
    }
    return out
  }, [rows, config.title])

  return (
    <div className="tl">
      {error ? <div className="plugin-message">{error}</div> : <div dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  )
}
