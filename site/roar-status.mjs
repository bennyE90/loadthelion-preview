import {eventEnd,ACTIVATION} from './roar-calendar.mjs';
// Presentation only: time passing never changes verified balances, boost or ranks.
export function snapshotStatus(snapshot,state,now=Math.floor(Date.now()/1000)){
 if(!snapshot)return {mode:'EVENT TIMER · TEST',text:'Verified snapshot unavailable · no points or movement data displayed',delayed:true};
 const end=eventEnd(snapshot.eventStart),closed=now>=end;
 const age=Math.max(0,now-snapshot.snapshotTimestamp),minutes=Math.floor(age/60);
 const source=state==='saved'?'Saved backup':state==='retained'?'Update unavailable · last verified snapshot':age>1800?'Update delayed · last verified snapshot':'Verified snapshot';
 const pending=closed?' · Event closed · final results pending verification':'';
 return {
  mode:closed?'CLOSED · RESULTS PENDING':snapshot.eventStart<ACTIVATION?'ULTON TEST · WEEKLY UTC':'ULTON TEST · CALENDAR UTC',
  text:'ULTON TEST · '+source+' · Block '+snapshot.snapshotBlock.toLocaleString('en-US')+' · '+new Date(snapshot.snapshotTimestamp*1000).toISOString().replace('T',' ').replace('.000Z',' UTC')+' · Snapshot age '+minutes+' min'+pending,
  delayed:age>1800||state==='saved'||state==='retained'||closed
 };
}
