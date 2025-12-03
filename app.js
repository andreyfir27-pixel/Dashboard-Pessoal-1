// ---------- IndexedDB helper (robusto) ----------
const DB_NAME = 'tudo_em_ordem_db';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains('users')) {
        _db.createObjectStore('users', { keyPath: 'username' });
      }
      if (!_db.objectStoreNames.contains('data')) {
        _db.createObjectStore('data', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => { console.error('IndexedDB open error:', e); reject(e); };
  });
}

function dbPut(storeName, value) {
  return new Promise(async (resolve, reject) => {
    try {
      await openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const rq = store.put(value);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = (err) => { console.error('dbPut error', err); reject(err); };
    } catch (err) {
      console.error('dbPut openDB error', err);
      reject(err);
    }
  });
}

function dbGet(storeName, key) {
  return new Promise(async (resolve, reject) => {
    try {
      await openDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const rq = store.get(key);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = (err) => { console.error('dbGet error', err); reject(err); };
    } catch (err) {
      console.error('dbGet openDB error', err);
      reject(err);
    }
  });
}

// ---------- Signup / Login (simples e seguro para client-only) ----------
async function signup() {
  try {
    const uEl = document.getElementById('loginUser') || document.getElementById('username');
    const pEl = document.getElementById('loginPass') || document.getElementById('password');
    const username = (uEl && uEl.value || '').trim();
    const password = (pEl && pEl.value || '');

    if (!username || !password) {
      showLoginMsg('Preencha usuário e senha');
      return;
    }

    await openDB();

    const existing = await dbGet('users', username);
    if (existing) {
      showLoginMsg('Usuário já existe');
      return;
    }

    const userObj = { username, password };
    await dbPut('users', userObj);

    await dbPut('data', { id: 'ui_state', user: username });

    document.getElementById('userName').innerText = username;
    showLoginMsg('Conta criada. Logado.');
    setTimeout(()=> document.getElementById('loginModal')?.classList.remove('show'), 600);
  } catch (err) {
    console.error('signup error', err);
    showLoginMsg('Erro ao criar conta (ver console).');
  }
}

async function login() {
  try {
    const uEl = document.getElementById('loginUser') || document.getElementById('username');
    const pEl = document.getElementById('loginPass') || document.getElementById('password');
    const username = (uEl && uEl.value || '').trim();
    const password = (pEl && pEl.value || '');

    if (!username || !password) {
      showLoginMsg('Preencha usuário e senha');
      return;
    }

    await openDB();
    const user = await dbGet('users', username);
    if (!user) {
      showLoginMsg('Usuário não encontrado');
      return;
    }
    if (user.password !== password) {
      showLoginMsg('Senha incorreta');
      return;
    }

    await dbPut('data', { id: 'ui_state', user: username });

    document.getElementById('userName').innerText = username;
    showLoginMsg('Logado com sucesso');
    setTimeout(()=> document.getElementById('loginModal')?.classList.remove('show'), 500);
  } catch (err) {
    console.error('login error', err);
    showLoginMsg('Erro ao logar (ver console).');
  }
}

function showLoginMsg(msg){
  const el = document.getElementById('loginMsg');
  if (el) el.innerText = msg;
  console.log('AUTH:', msg);
  setTimeout(()=>{ if (el) el.innerText = ''; }, 3000);
}

// Example listener binding (ajuste conforme seu HTML)
document.getElementById('signupBtn')?.addEventListener('click', signup);
document.getElementById('loginBtn')?.addEventListener('click', login);
document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
  await openDB();
  await dbPut('data', { id: 'ui_state', user: null });
  document.getElementById('userName').innerText = 'Convidado';
  document.getElementById('loginModal')?.classList.add('show');
});
