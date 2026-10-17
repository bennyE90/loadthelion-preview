(()=>{'use strict';
const root=document.getElementById('roar-rows'),more=document.getElementById('roar-show-more'),count=document.getElementById('roar-count');
let visible=10;
for(let i=1;i<=100;i++){
 const row=document.createElement('div');row.className='rank-row'+(i<=10?' top-ten':'')+(i<=3?' top-three':'');
 const rank=document.createElement('span');rank.className='rank '+(i===1?'gold':i===2?'silver':i===3?'bronze':'red');rank.textContent='#'+String(i).padStart(3,'0');
 const wallet=document.createElement('span');wallet.className='roar-name';wallet.textContent='Awaiting launch';const hint=document.createElement('span');hint.className='roar-address';hint.textContent='Reserved position';wallet.append(hint);
 row.append(rank,wallet);
 for(const cls of ['roar-amount','roar-value','roar-chance']){const cell=document.createElement('span');cell.className=cls;cell.textContent='—';row.append(cell)}
 root.append(row);
}
function show(){[...root.children].forEach((row,i)=>{row.hidden=i>=visible});count.textContent='Showing '+Math.min(visible,100)+' of 100 reserved positions · No live ranking';more.hidden=visible>=100;more.textContent='SHOW MORE · NEXT 10'}
more.addEventListener('click',()=>{visible=Math.min(100,visible+10);show()});show();
})();
