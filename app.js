// --- IndexedDB wrapper (simple) ---
const DB_NAME = 'tudo_em_ordem_db';
const DB_VERSION = 1;
let db;
function openDB(){ return new Promise((resolve,reject)=>{
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = (e)=>{
    db = e.target.result;
    if(!db.objectStoreNames.contains('users')) db.createObjectStore('users',{keyPath:'username'});
    if(!db.objectStoreNames.contains('data')) db.createObjectStore('data',{keyPath:'id'});
  };
  req.onsuccess = (e)=>{ db = e.target.result; resolve(db); };
  req.onerror = (e)=> reject(e);
}); }
function dbPut(store, val){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); const s=tx.objectStore(store); const rq=s.put(val); rq.onsuccess=()=>res(true); rq.onerror=()=>rej(false); })}
function dbGet(store, key){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readonly'); const s=tx.objectStore(store); const rq=s.get(key); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(null); })}
function dbAll(store){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readonly'); const s=tx.objectStore(store); const arr=[]; const cur=s.openCursor(); cur.onsuccess=(e)=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue(); } else res(arr); } cur.onerror=()=>rej([]); })}

// --- App logic ---
(async function init(){
  await openDB();
  setupUI();
  loadInitialData();
})();

function setupUI(){
  // tabs
  document.querySelectorAll('.sidebar nav button').forEach(btn=>btn.addEventListener('click',e=>{
    document.querySelectorAll('.sidebar nav button').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    const id = e.target.getAttribute('data-tab');
    document.querySelectorAll('.tabcontent').forEach(t=>t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }));

  // theme toggle
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click',()=>{
    document.body.classList.toggle('dark');
    saveState();
  });

  // export/import buttons
  document.getElementById('exportBtn').addEventListener('click',exportData);
  document.getElementById('importBtn').addEventListener('click',()=>document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change',handleImport);

  // finance inputs save
  ['receitaInput','despesaInput','dividaInput','investInput'].forEach(id=>{
    const el=document.getElementById(id);
    el.addEventListener('change',saveFinance);
  });

  document.getElementById('addMonth').addEventListener('click',()=>{ addOrcRow('Novo',0,0,0,0); saveMonths(); });
  document.getElementById('clearMonths').addEventListener('click',clearMonths);

  // habits add and urgencies
  document.getElementById('addUrg').addEventListener('click',addUrgencia);

  // market add
  document.getElementById('addItemBtn').addEventListener('click',addMarketItem);

  // login/signup
  document.getElementById('loginBtn').addEventListener('click',login);
  document.getElementById('signupBtn').addEventListener('click',signup);
  document.getElementById('logoutBtn').addEventListener('click',logout);
}

// --- Data loading ---
async function loadInitialData(){
  // load UI state
  const state = await dbGet('data','ui_state') || { id:'ui_state', dark:false };
  if(state.dark) document.body.classList.add('dark');
  if(state.user) document.getElementById('userName').innerText = state.user;
  // load finances
  const fin = await dbGet('data','financas') || { id:'financas', receita:6000, despesa:5200, divida:23800, invest:13000 };
  document.getElementById('receitaInput').value = fin.receita;
  document.getElementById('despesaInput').value = fin.despesa;
  document.getElementById('dividaInput').value = fin.divida;
  document.getElementById('investInput').value = fin.invest;
  renderOrcamentoMensal();
  // load months
  const months = (await dbGet('data','orcMonths')) || { id:'orcMonths', rows:[['Janeiro',13000,7500,3690,850],['Fevereiro',14000,7981,4521,650],['Março',15000,7347,5724,900]] };
  months.rows.forEach(r=>addOrcRow(...r));
  updateTotals();

  // load habits default
  const habits = (await dbGet('data','habits')) || { id:'habits', rows: generateDefaultHabits() };
  renderHabits(habits.rows);

  // load market default
  const market = (await dbGet('data','market')) || { id:'market', items: defaultMarket() };
  renderMarket(market.items);

  // load menu week and workouts
  const menu = (await dbGet('data','menu')) || { id:'menu', week: defaultMenu() };
  renderMenu(menu.week);
  const workouts = (await dbGet('data','workouts')) || { id:'workouts', days: defaultWorkouts() };
  renderWorkouts(workouts.days);

  // urgencias
  const urg = (await dbGet('data','urgs')) || { id:'urgs', list:[] };
  renderUrg(urg.list);

  // hide login if user exists
  const users = await dbAll('users');
  if(users.length && users[0].username){ document.getElementById('loginModal').classList.remove('show'); }
  document.getElementById('app').classList.remove('loading');
}

// --- Helpers and renderers ---
function generateDefaultHabits(){
  return ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map(d=>({day:d,acordar:false,dev:false,ex:false,ler:false,agua:false}));
}
function defaultMarket(){ return [
  {cat:'Hortifrutti', name:'Cebola'}, {cat:'Hortifrutti', name:'Batata'}, {cat:'Açougue', name:'Carne moída'},
  {cat:'Laticínios', name:'Leite'}, {cat:'Mercearia', name:'Arroz'}
]; }
function defaultMenu(){ return [
  {day:'Segunda', cafe:'Omelete', almoço:'Frango grelhado'}, {day:'Terça', cafe:'Tapioca', almoço:'Peixe'}, {day:'Quarta', cafe:'Pão integral', almoço:'Salada'},
  {day:'Quinta', cafe:'Smoothie', almoço:'Massa leve'}, {day:'Sexta', cafe:'Iogurte', almoço:'Prato livre'}, {day:'Sábado', cafe:'Panqueca', almoço:'Família'}, {day:'Domingo', cafe:'Torradas', almoço:'Assado'}
]; }
function defaultWorkouts(){ return [
  {day:'Segunda', title:'Quadríceps e Posterior', exercises:[{name:'Leg Press',sets:'4x10'},{name:'Extensora',sets:'3x12'}]},
  {day:'Terça', title:'Costas & Bíceps', exercises:[{name:'Remada',sets:'4x8'},{name:'Puxada',sets:'4x10'}]},
  {day:'Quarta', title:'Ombros & Tríceps', exercises:[{name:'Desenvolvimento',sets:'4x8'},{name:'Elevação lateral',sets:'3x12'}]}
]; }

function renderMarket(items){
  const grid = document.getElementById('marketGrid');
  grid.innerHTML='';
  const cats = {};
  items.forEach(it=>{ cats[it.cat]=cats[it.cat]||[]; cats[it.cat].push(it); });
  for(const cat in cats){
    const card = document.createElement('div'); card.className='card category animate-up';
    card.innerHTML = <h4>${cat}</h4> + cats[cat].map(i=><label><input type="checkbox" data-item="${i.name}"> ${i.name}</label>).join('');
    grid.appendChild(card);
  }
  dbPut('data', {id:'market', items});
}

function addMarketItem(){
  const txt = document.getElementById('newItemTxt').value.trim();
  const cat = document.getElementById('newItemCat').value;
  if(!txt) return;
  dbAll('data').then(async()=>{
    const m = await dbGet('data','market') || {id:'market', items: defaultMarket()};
    m.items.push({cat, name:txt});
    dbPut('data', m);
    renderMarket(m.items);
    document.getElementById('newItemTxt').value='';
  });
}

function renderMenu(week){
  const wrap = document.getElementById('menuWeek'); wrap.innerHTML='';
  week.forEach(d=>{
    const el = document.createElement('div'); el.className='day-card animate-up yellow';
    el.innerHTML = <h4>${d.day}</h4><p><strong>Café:</strong> ${d.cafe}</p><p><strong>Almoço:</strong> ${d.almoço}</p>;
    wrap.appendChild(el);
  });
  dbPut('data', {id:'menu', week});
}

function renderWorkouts(days){
  const grid = document.getElementById('workoutGrid'); grid.innerHTML='';
  days.forEach(d=>{
    const card = document.createElement('div'); card.className='card category animate-up';
    card.innerHTML = <h4>${d.day} — ${d.title}</h4> + d.exercises.map(e=><label><input type="checkbox" data-ex="${e.name}"> ${e.name} — ${e.sets}</label>).join('');
    grid.appendChild(card);
  });
  dbPut('data', {id:'workouts', days});
}

function renderHabits(rows){
  const body = document.getElementById('habitsBody'); body.innerHTML='';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.day}</td>
      <td><input type="checkbox" data-key="${r.day}-acordar"${r.acordar? ' checked':''}></td>
      <td><input type="checkbox" data-key="${r.day}-dev"${r.dev? ' checked':''}></td>
      <td><input type="checkbox" data-key="${r.day}-ex"${r.ex? ' checked':''}></td>
      <td><input type="checkbox" data-key="${r.day}-ler"${r.ler? ' checked':''}></td>
      <td><input type="checkbox" data-key="${r.day}-agua"${r.agua? ' checked':''}></td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('#habitsBody input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{ saveHabits(); });
  });
  dbPut('data', {id:'habits', rows});
}

function saveHabits(){
  const rows = Array.from(document.querySelectorAll('#habitsBody tr')).map(tr=>{
    const day = tr.cells[0].innerText;
    return {
      day,
      acordar: tr.querySelector('[data-key$="acordar"]').checked,
      dev: tr.querySelector('[data-key$="dev"]').checked,
      ex: tr.querySelector('[data-key$="ex"]').checked,
      ler: tr.querySelector('[data-key$="ler"]').checked,
      agua: tr.querySelector('[data-key$="agua"]').checked
    };
  });
  dbPut('data', {id:'habits', rows});
}

function renderUrg(list){
  const ul = document.getElementById('urgenciasList'); ul.innerHTML='';
  list.forEach((u,i)=>{
    const li = document.createElement('li'); li.innerHTML = <span>${u}</span><button data-i="${i}">X</button>;
    ul.appendChild(li);
    li.querySelector('button').addEventListener('click',()=>{ list.splice(i,1); dbPut('data',{id:'urgs', list}); renderUrg(list); });
  });
}

function addUrgencia(){
  const txt = document.getElementById('urgenciaTxt').value.trim();
  if(!txt) return;
  dbGet('data','urgs').then(d=>{
    const list = (d && d.list) ? d.list : [];
    list.push(txt);
    dbPut('data',{id:'urgs', list});
    renderUrg(list);
    document.getElementById('urgenciaTxt').value='';
  });
}

// --- Orçamento table functions ---
const orcBody = document.querySelector('#orcamentoTable tbody');
function addOrcRow(mes,rec,fix,varc,div){
  const tr = document.createElement('tr');
  tr.innerHTML = <td contenteditable>${mes}</td><td contenteditable class="num">${rec}</td><td contenteditable class="num">${fix}</td><td contenteditable class="num">${varc}</td><td contenteditable class="num">${div}</td><td class="balanco">0</td>;
  orcBody.appendChild(tr);
  tr.querySelectorAll('[contenteditable]').forEach(cell=>cell.addEventListener('input',()=>{ updateTotals(); saveMonths(); }));
  updateTotals();
  return tr;
}

function updateTotals(){
  const rows = Array.from(orcBody.querySelectorAll('tr'));
  let sumRec=0,sumFix=0,sumVar=0,sumDiv=0,sumBal=0;
  rows.forEach(r=>{
    const rec = parseFloat(r.cells[1].innerText)||0;
    const fix = parseFloat(r.cells[2].innerText)||0;
    const vari = parseFloat(r.cells[3].innerText)||0;
    const div = parseFloat(r.cells[4].innerText)||0;
    const bal = rec - (fix+vari+div);
    r.querySelector('.balanco').innerText = bal.toFixed(2);
    sumRec+=rec; sumFix+=fix; sumVar+=vari; sumDiv+=div; sumBal+=bal;
  });
  document.getElementById('sumReceitas').innerText = sumRec.toFixed(2);
  document.getElementById('sumFixos').innerText = sumFix.toFixed(2);
  document.getElementById('sumVariaveis').innerText = sumVar.toFixed(2);
  document.getElementById('sumDividas').innerText = sumDiv.toFixed(2);
  document.getElementById('sumBalanco').innerText = sumBal.toFixed(2);
  const recVal = parseFloat(document.getElementById('receitaInput').value)||0;
  const despVal = parseFloat(document.getElementById('despesaInput').value)||0;
  const perc = Math.max(0, Math.min(100, ((recVal-despVal)/recVal)*100 || 0));
  document.getElementById('saldoBar').style.width = perc + '%';
}

function saveMonths(){
  const rows = Array.from(orcBody.querySelectorAll('tr')).map(r=>[r.cells[0].innerText,parseFloat(r.cells[1].innerText)||0,parseFloat(r.cells[2].innerText)||0,parseFloat(r.cells[3].innerText)||0,parseFloat(r.cells[4].innerText)||0]);
  dbPut('data',{id:'orcMonths', rows});
}

function clearMonths(){
  orcBody.innerHTML=''; saveMonths(); updateTotals();
}

function saveFinance(){
  const fin = { id:'financas', receita: +document.getElementById('receitaInput').value ||0, despesa:+document.getElementById('despesaInput').value||0, divida:+document.getElementById('dividaInput').value||0, invest:+document.getElementById('investInput').value||0 };
  dbPut('data', fin).then(()=>{ renderOrcamentoMensal(); updateTotals(); });
}

function renderOrcamentoMensal(){
  const f = document.getElementById('orcamentoMensalList');
  dbGet('data','financas').then(fin=>{
    const rec = fin ? fin.receita : 0;
    const desp = fin ? fin.despesa : 0;
    const inv = fin ? fin.invest : 0;
    const div = fin ? fin.divida : 0;
    f.innerHTML = <p>Receita: R$ ${rec.toFixed(2)}</p><p>Despesa: R$ ${desp.toFixed(2)}</p><p>Investir: R$ ${inv.toFixed(2)}</p><p>Dívidas: R$ ${div.toFixed(2)}</p><p>Saldo: R$ ${(rec-desp).toFixed(2)}</p>;
  });
}

// --- Export / Import ---
async function exportData(){
  const keys = ['financas','orcMonths','habits','market','menu','workouts','urgs','ui_state'];
  const out = {};
  for(const k of keys){
    out[k] = await dbGet('data',k) || null;
  }
  const blob = new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tudo_em_ordem_export.json'; a.click();
}

function handleImport(e){
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      for(const k in parsed){
        if(parsed[k]) await dbPut('data', Object.assign({id:k}, parsed[k]) );
      }
      location.reload();
    }catch(err){ alert('Arquivo inválido'); }
  };
  reader.readAsText(f);
}

// --- Auth (very simple) ---
async function signup(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if(!u||!p){ showLoginMsg('Preencha usuário e senha'); return; }
  const existing = await dbGet('users',u);
  if(existing){ showLoginMsg('Usuário já existe'); return; }
  await dbPut('users', {username:u, password:p});
  await dbPut('data', {id:'ui_state', dark: document.body.classList.contains('dark'), user:u});
  document.getElementById('userName').innerText = u;
  showLoginMsg('Conta criada. Logando...');
  setTimeout(()=>{ document.getElementById('loginModal').classList.remove('show'); },700);
}

async function login(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const user = await dbGet('users',u);
  if(!user || user.password !== p){ showLoginMsg('Usuário/senha inválidos'); return; }
  await dbPut('data', {id:'ui_state', dark: document.body.classList.contains('dark'), user:u});
  document.getElementById('userName').innerText = u;
  showLoginMsg('Logado com sucesso');
  setTimeout(()=>{ document.getElementById('loginModal').classList.remove('show'); },700);
}

function logout(){ dbPut('data',{id:'ui_state', dark:false, user:null}).then(()=>{ document.getElementById('loginModal').classList.add('show'); document.getElementById('userName').innerText='Convidado'; }); }

function showLoginMsg(msg){ const el = document.getElementById('loginMsg'); el.innerText = msg; setTimeout(()=>el.innerText='',2500); }

// --- Save UI state on unload ---
window.addEventListener('beforeunload', ()=>{
  saveFinance();
  saveMonths();
  saveHabits();
  dbPut('data',{id:'ui_state', dark: document.body.classList.contains('dark'), user: document.getElementById('userName').innerText});
});
