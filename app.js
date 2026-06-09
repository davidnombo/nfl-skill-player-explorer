const $=id=>document.getElementById(id);
const state={manifest:null,rows:[],filtered:[],visible:[],cols:[],loadedYears:new Set()};
const defaultCols=['season','week','gameday','player_display_name','position','team','opponent_team','passing_yards','passing_tds','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds','fantasy_points_ppr'];
const numCols=new Set(['season','week','passing_yards','passing_tds','passing_interceptions','carries','rushing_yards','rushing_tds','targets','receptions','receiving_yards','receiving_tds','target_share','air_yards_share','wopr','fantasy_points_ppr']);
function val(r,c){return r[state.cols.indexOf(c)]}
function fmt(v){return v==null?'':v}
async function init(){
 state.manifest=await fetch('data/manifest.json').then(r=>r.json()); state.cols=state.manifest.columns;
 $('statsBox').innerHTML=`<strong>${state.manifest.total_rows.toLocaleString()}</strong> player-game rows<br><strong>2015–2024</strong> regular seasons<br><strong>QB/RB/WR/TE</strong> only`;
 state.manifest.years.slice().reverse().forEach(y=>$('season').insertAdjacentHTML('beforeend',`<option>${y}</option>`));
 state.manifest.positions.forEach(p=>$('position').insertAdjacentHTML('beforeend',`<option>${p}</option>`));
 state.manifest.teams.forEach(t=>$('team').insertAdjacentHTML('beforeend',`<option>${t}</option>`));
 const picker=$('columnPicker');
 state.cols.forEach(c=>picker.insertAdjacentHTML('beforeend',`<label><input type="checkbox" value="${c}" ${defaultCols.includes(c)?'checked':''}> ${c}</label>`));
 picker.addEventListener('change',render);
 ['apply','csvBtn'].forEach(id=>$(id).addEventListener('click',id==='apply'?apply:downloadCsv));
 ['sortBy','sortDir'].forEach(id=>$(id).addEventListener('change',apply));
 await loadYears([2024]); apply();
}
async function loadYears(years){
 for(const y of years){ if(state.loadedYears.has(y)) continue; const data=await fetch(`data/weekly_${y}.json`).then(r=>r.json()); state.rows.push(...data); state.loadedYears.add(y); }
}
async function ensureSelectionLoaded(){
 const s=$('season').value;
 if(s==='all') await loadYears(state.manifest.years); else await loadYears([Number(s)]);
}
async function apply(){
 await ensureSelectionLoaded();
 const season=$('season').value,pos=$('position').value,team=$('team').value,player=$('player').value.trim().toLowerCase(),minPpr=parseFloat($('minPpr').value);
 const sortBy=$('sortBy').value, dir=$('sortDir').value;
 let rows=state.rows.filter(r=>{
  if(season!=='all'&&val(r,'season')!=season) return false;
  if(pos&&val(r,'position')!==pos) return false;
  if(team&&val(r,'team')!==team) return false;
  if(player&&!String(val(r,'player_display_name')).toLowerCase().includes(player)) return false;
  if(!Number.isNaN(minPpr)&&Number(val(r,'fantasy_points_ppr')||0)<minPpr) return false;
  return true;
 });
 rows.sort((a,b)=>{let av=val(a,sortBy),bv=val(b,sortBy); if(numCols.has(sortBy)){av=Number(av||0);bv=Number(bv||0)} return (av>bv?1:av<bv?-1:0)*(dir==='asc'?1:-1)});
 state.filtered=rows; state.visible=rows.slice(0,500); render();
}
function checkedCols(){return [...document.querySelectorAll('#columnPicker input:checked')].map(x=>x.value)}
function render(){renderSummary(); renderTable();}
function renderSummary(){
 const rows=state.filtered; const n=rows.length; const sum=c=>rows.reduce((a,r)=>a+Number(val(r,c)||0),0); const avg=c=>n?sum(c)/n:0;
 const players=new Set(rows.map(r=>val(r,'player_display_name'))); const top=rows[0];
 $('summaryCards').innerHTML=`<div class="card"><span>Rows matched</span><strong>${n.toLocaleString()}</strong></div><div class="card"><span>Players</span><strong>${players.size.toLocaleString()}</strong></div><div class="card"><span>Avg PPR</span><strong>${avg('fantasy_points_ppr').toFixed(1)}</strong></div><div class="card"><span>Top row</span><strong>${top?fmt(val(top,'player_display_name')):'—'}</strong></div>`;
 $('resultMeta').textContent=`Showing first ${state.visible.length.toLocaleString()} of ${n.toLocaleString()} matching rows. Click a column header to sort.`;
}
function renderTable(){
 const cols=checkedCols(); const table=$('results'); if(!state.visible.length){table.innerHTML='<tr><td>No rows found.</td></tr>';return;}
 table.innerHTML=`<thead><tr>${cols.map(c=>`<th data-col="${c}">${c}</th>`).join('')}</tr></thead><tbody>${state.visible.map(r=>`<tr>${cols.map(c=>`<td>${fmt(val(r,c))}</td>`).join('')}</tr>`).join('')}</tbody>`;
 table.querySelectorAll('th').forEach(th=>th.onclick=()=>{$('sortBy').value=th.dataset.col;if(!$('sortBy').querySelector(`option[value="${th.dataset.col}"]`)) $('sortBy').insertAdjacentHTML('beforeend',`<option value="${th.dataset.col}">${th.dataset.col}</option>`);apply();});
}
function downloadCsv(){
 const cols=checkedCols(); const lines=[cols.join(',')];
 for(const r of state.visible){lines.push(cols.map(c=>JSON.stringify(fmt(val(r,c)))).join(','));}
 const blob=new Blob([lines.join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='nfl_skill_visible_rows.csv'; a.click(); URL.revokeObjectURL(a.href);
}
init();