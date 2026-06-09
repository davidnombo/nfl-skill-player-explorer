const $=id=>document.getElementById(id);
const state={manifest:null,rows:[],filtered:[],visible:[],cols:[],loaded:false};
const defaultCols=['yr','wk','date','name','pos','team','opp','payd','patd','car','ruyd','rutd','tgt','rec','reyd','retd','ppr'];
const labels={yr:'season',wk:'week',date:'gameday',name:'player',pos:'position',team:'team',opp:'opponent',payd:'passing_yards',patd:'passing_tds',int:'interceptions',car:'carries',ruyd:'rushing_yards',rutd:'rushing_tds',tgt:'targets',rec:'receptions',reyd:'receiving_yards',retd:'receiving_tds',tsh:'target_share',aysh:'air_yards_share',wopr:'wopr',ppr:'ppr_points'};
const numCols=new Set(['yr','wk','payd','patd','int','car','ruyd','rutd','tgt','rec','reyd','retd','tsh','aysh','wopr','ppr']);
function val(r,c){return r[state.cols.indexOf(c)]} function fmt(v){return v==null?'':v}
async function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
async function init(){
 state.manifest=await fetch('data/manifest.json').then(r=>r.json()); state.cols=state.manifest.columns;
 $('statsBox').innerHTML=`<strong>${state.manifest.rows.toLocaleString()}</strong> player-game rows<br><strong>2015–2024</strong> regular seasons<br><strong>QB/RB/WR/TE</strong> only`;
 state.manifest.years.slice().reverse().forEach(y=>$('season').insertAdjacentHTML('beforeend',`<option>${y}</option>`));
 state.manifest.positions.forEach(p=>$('position').insertAdjacentHTML('beforeend',`<option>${p}</option>`));
 state.manifest.teams.forEach(t=>$('team').insertAdjacentHTML('beforeend',`<option>${t}</option>`));
 const picker=$('columnPicker'); state.cols.forEach(c=>picker.insertAdjacentHTML('beforeend',`<label><input type="checkbox" value="${c}" ${defaultCols.includes(c)?'checked':''}> ${labels[c]||c}</label>`)); picker.addEventListener('change',render);
 $('apply').addEventListener('click',apply); $('csvBtn').addEventListener('click',downloadCsv); ['sortBy','sortDir'].forEach(id=>$(id).addEventListener('change',apply));
 await loadAllData(); apply();
}
async function loadAllData(){
 if(state.loaded) return; $('resultMeta').textContent='Loading compressed data behind the scenes…';
 if(!window.pako) await loadScript('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js');
 let b64=''; for(let i=0;i<state.manifest.chunk_count;i++){const name=String(i).padStart(3,'0'); b64+=await fetch(`${state.manifest.chunk_prefix}${name}`).then(r=>r.text());}
 const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const csv=pako.ungzip(bin,{to:'string'}); parseCSV(csv); state.loaded=true;
}
function parseCSV(text){
 const lines=text.trim().split(/\r?\n/); const header=parseLine(lines[0]); state.cols=header; state.rows=[];
 for(let i=1;i<lines.length;i++){const arr=parseLine(lines[i]); state.rows.push(arr.map((v,j)=>numCols.has(header[j])&&v!==''?Number(v):v));}
}
function parseLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i]; if(q){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}else{if(ch==='"')q=true;else if(ch===','){out.push(cur);cur='';}else cur+=ch;}} out.push(cur); return out;}
async function apply(){await loadAllData(); const season=$('season').value,pos=$('position').value,team=$('team').value,player=$('player').value.trim().toLowerCase(),minPpr=parseFloat($('minPpr').value); const sortBy=$('sortBy').value,dir=$('sortDir').value;
 let rows=state.rows.filter(r=>{if(season!=='all'&&val(r,'yr')!=season)return false;if(pos&&val(r,'pos')!==pos)return false;if(team&&val(r,'team')!==team)return false;if(player&&!String(val(r,'name')).toLowerCase().includes(player))return false;if(!Number.isNaN(minPpr)&&Number(val(r,'ppr')||0)<minPpr)return false;return true;});
 rows.sort((a,b)=>{let av=val(a,sortBy),bv=val(b,sortBy); if(numCols.has(sortBy)){av=Number(av||0);bv=Number(bv||0)} return (av>bv?1:av<bv?-1:0)*(dir==='asc'?1:-1)}); state.filtered=rows; state.visible=rows.slice(0,500); render();}
function checkedCols(){return [...document.querySelectorAll('#columnPicker input:checked')].map(x=>x.value)} function render(){renderSummary();renderTable()}
function renderSummary(){const rows=state.filtered,n=rows.length,sum=c=>rows.reduce((a,r)=>a+Number(val(r,c)||0),0),avg=c=>n?sum(c)/n:0,players=new Set(rows.map(r=>val(r,'name'))),top=rows[0]; $('summaryCards').innerHTML=`<div class="card"><span>Rows matched</span><strong>${n.toLocaleString()}</strong></div><div class="card"><span>Players</span><strong>${players.size.toLocaleString()}</strong></div><div class="card"><span>Avg PPR</span><strong>${avg('ppr').toFixed(1)}</strong></div><div class="card"><span>Top row</span><strong>${top?fmt(val(top,'name')):'—'}</strong></div>`; $('resultMeta').textContent=`Showing first ${state.visible.length.toLocaleString()} of ${n.toLocaleString()} matching rows. Click a column header to sort.`;}
function renderTable(){const cols=checkedCols(),table=$('results'); if(!state.visible.length){table.innerHTML='<tr><td>No rows found.</td></tr>';return;} table.innerHTML=`<thead><tr>${cols.map(c=>`<th data-col="${c}">${labels[c]||c}</th>`).join('')}</tr></thead><tbody>${state.visible.map(r=>`<tr>${cols.map(c=>`<td>${fmt(val(r,c))}</td>`).join('')}</tr>`).join('')}</tbody>`; table.querySelectorAll('th').forEach(th=>th.onclick=()=>{$('sortBy').value=th.dataset.col;if(!$('sortBy').querySelector(`option[value="${th.dataset.col}"]`))$('sortBy').insertAdjacentHTML('beforeend',`<option value="${th.dataset.col}">${labels[th.dataset.col]||th.dataset.col}</option>`);apply();});}
function downloadCsv(){const cols=checkedCols(),lines=[cols.map(c=>labels[c]||c).join(',')]; for(const r of state.visible){lines.push(cols.map(c=>JSON.stringify(fmt(val(r,c)))).join(','));} const blob=new Blob([lines.join('\n')],{type:'text/csv'}),a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='nfl_skill_visible_rows.csv'; a.click(); URL.revokeObjectURL(a.href)}
init();