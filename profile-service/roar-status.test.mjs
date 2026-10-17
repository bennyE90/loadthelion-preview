import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotStatus} from '../site/roar-status.mjs';
const start=1791763200,end=start+604800;
const snapshot={eventStart:start,snapshotTimestamp:end-120,snapshotBlock:100};
test('the last minutes remain open; the exact deadline awaits verified final results',()=>{
 assert.equal(snapshotStatus(snapshot,'live',end-1).mode,'ULTON TEST · WEEKLY UTC');
 for(const now of [end,end+1,end+86400]){
  const result=snapshotStatus(snapshot,'live',now);
  assert.equal(result.mode,'CLOSED · RESULTS PENDING');
  assert.match(result.text,/final results pending verification/);
 }
});
test('unchanged snapshots age without a new response and do not mutate scores',()=>{
 const snapshot={eventStart:start,snapshotTimestamp:start+100,snapshotBlock:100};
 const input=structuredClone(snapshot);
 assert.equal(snapshotStatus(snapshot,'unchanged',snapshot.snapshotTimestamp+1800).delayed,false);
 const result=snapshotStatus(snapshot,'unchanged',snapshot.snapshotTimestamp+1801);
 assert.match(result.text,/Update delayed/);assert.match(result.text,/Snapshot age 30 min/);
 assert.deepEqual(snapshot,input);
});
test('backup, retained and unavailable data cannot appear to be a fresh feed',()=>{
 assert.match(snapshotStatus(snapshot,'saved',end-1).text,/Saved backup/);
 assert.match(snapshotStatus(snapshot,'retained',end-1).text,/Update unavailable/);
 assert.match(snapshotStatus(null,'unavailable',end).text,/no points or movement data displayed/);
});
