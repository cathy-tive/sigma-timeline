# Shipment Timeline — Timeline Plugin (Sigma)

A custom [Sigma](https://sigmacomputing.com) plugin that renders a shipment's
`TL_TIMELINE_EVENTS` as a **hierarchical event timeline**: waypoints and transit
legs at the top level, with their nested events (temp excursions, unplanned
stops, carrier changes, loads) indented beneath. Companion to the map plugin
(`sigma-route-map`); shares the same icon set and colors.

- Numbered origin/destination waypoints ("Shipment origin" / "Shipment
  destination", or "not reached"), with **Arrived / Departed / dwell** times.
- Transit legs labeled "In transit — Leg N" with a mode symbol (ship/plane/
  truck/train) and mode badge.
- Temp out = red, temp back = blue; carrier change, loaded, stops each iconed.
- Nesting comes from `parent_event_id`; ordering from `event_time`.

Built with React + Vite + `@sigmacomputing/plugin` (no map deps).

## Preview standalone

```bash
npm install
npm run dev
```

Open `http://localhost:3002/?demo=1` — a **synthetic sample shipment**
(`src/demoData.js` — fabricated, no real data), no Sigma connection needed.

## Wiring it up in Sigma

Point **events** at `SCRATCH.CSLESNICK.TL_TIMELINE_EVENTS` (one shipment) and map:

| Panel field | Column |
|---|---|
| `eventId` | `event_id` |
| `parentId` | `parent_event_id` |
| `eventType` | `event_type` |
| `order` | `event_time` |
| `eventEnd` | `event_end` |
| `status` | `status` |
| `label` | `display_label` |
| `legMode` / `legNumber` | `leg_mode` / `leg_number` |
| `waypointNumber` | `waypoint_number` |
| `color` | `color` |
| `durationSec` | `duration_sec` |

Editor panel is declared once at load (never write config at runtime → Sigma
reloads the element → loop). Deploy mirrors the sibling plugins.
