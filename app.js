
const CONFIG = {
    API_BASE : 'https://dummyjson.com',
    API_TODOS: '/todos',
    API_ADD_TODO: '/todos/add',
    PAGE_SIZE:10,
    RANDOM_DATE_WINDOW_DAYS:30,
    LOCAL_STORAGE_KEY:'todoAppTodos_v1',
};

let allTodos = [];
let filteredTodos =[];
let currentPage =1;

const alertContainer = document.getElementById('alert-container');
const loadingE1 = document.getElementById('loading');
const tbody = document.getElementById('todosTbody');
const paginationEl = document.getElementById('pagination');
const paginationInfo = document.getElementById('pagination-info');

// Filters Control
const searchInput = document.getElementById('searchInput');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');


//Add form controls
const addTodoForm = document.getElementById('add-todo-form');
const newTodoText = document.getElementById('newTodoText');
const newTodoDate = document.getElementById('newTodoDate');
const newTodoCompleted = document.getElementById('newTodoCompleted');

//utilities
function todayISO(){
    const d= new Date();
    return d.toISOString().slice(0,10); 
}

function randomPastDateISO(daysBack = 30){
    const now = Date.now();
    const offset = Math.floor(Math.random()*daysBack); 
    const d = new Date(now-offset*24*60*60*1000);
    return d.toISOString().slice(0,10);
}

function showAlert(message, type='info', timeoutMs=4000){
    const id=`alert-${Date.now()}`;
    const div = document.createElement('div');
    div.id=id;
    div.className=`alert alert-${type} alert-dismissible fade show`;
    div.role='alert';
    div.innerHTML = `\n ${message}\n   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>\n `;
    alertContainer.appendChild(div);
    if(timeoutMs){
        setTimeout(()=>{
            const el = document.getElementById(id);
            if(el)  new bootstrap.Alert(el).close();
        },timeoutMs);
    }
}

function setLoading(isLoading){
    loadingE1.hidden = !isLoading;
}

function saveLocal(todos){
    try{
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY,JSON.stringify(todos));
    }
    catch(err){
        console.warn('localStorage save failed',err);
    }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('localStorage load failed', err);
    return null;
  }
}

function generateLocalId(){
    return `local-${Date.now()}-${Math.floor(Math.random()*1000)}`;
}

// API Layer
async function apiFetchTodos({limit=0, skip=0}={}){
    const params = new URLSearchParams();
    if(limit !== undefined){
        params.append('limit',limit);
    }
    if(skip){
        params.append('skip',skip);
    }
    const url = `${CONFIG.API_BASE}${CONFIG.API_TODOS}?${params.toString()}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Failed to fetch todos: ${res.status}`);
    const data = await res.json();
    if(Array.isArray(data)){
        return data;
    }
    return data.todos || [];
}

async function apiAddTodo({todo,completed=false,userId=1}){
    const url=`${CONFIG.API_BASE}${CONFIG.API_ADD_TODO}`;
    const res = await fetch(url, {
        method:'POST',
        headers: {'Content-Type' : 'application/json'},
        body:JSON.stringify({todo,completed,userId})
    });
    if(!res.ok) throw new Error(`Failed to add todo: ${res.status}`);
    const data = await res.json();
    return data;
}

async function apiToggleComplete(id,completed){
    const url = `${CONFIG.API_BASE}${CONFIG.API_TODOS}/${id}`;
    try{
        const res = await fetch(url, {
            method : 'PUT',
            headers: {'Content-Type':'application/json'},
            body:JSON.stringify({completed}),
        });
        if (!res.ok) throw new Error(`Failed to update todo ${id}`);
        return await res.json();
    }
    catch (err) {
        console.warn('apiToggleComplete error (ignored for local state)', err);
        return null;
    }
}




function enrichTodosWithCreatedAt(todos) {
  return todos.map(t => ({
    ...t,
    createdAt: t.createdAt || randomPastDateISO(CONFIG.RANDOM_DATE_WINDOW_DAYS),
  }));
}

function mergeTodos(existing, incoming) {
  const map = new Map();
  existing.forEach(t => map.set(String(t.id), t));
  incoming.forEach(t => map.set(String(t.id), t));
  return Array.from(map.values());
}

function applyFilters() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const from = fromDateInput.value ? new Date(fromDateInput.value) : null;
  const to = toDateInput.value ? new Date(toDateInput.value) : null;

  filteredTodos = allTodos.filter(t => {
    if (searchTerm && !String(t.todo).toLowerCase().includes(searchTerm)) {
      return false;
    }
    
    if ((from || to) && t.createdAt) {
    const created = new Date(t.createdAt);
    if (from && created < from) return false;
    if (to) {
        const toPlus = new Date(to);
        toPlus.setDate(toPlus.getDate() + 1); 
        if (created >= toPlus) return false;
    }
    }
    return true;
  });

  currentPage = 1; 
  render();
}

function getPagedTodos() {
  const start = (currentPage - 1) * CONFIG.PAGE_SIZE;
  const end = start + CONFIG.PAGE_SIZE;
  return filteredTodos.slice(start, end);
}

// Rendering
function render() {
  renderTable();
  renderPagination();
}

function renderTable() {
  tbody.innerHTML = '';
  const pageItems = getPagedTodos();
  if (!pageItems.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'text-center text-muted py-4';
    td.textContent = 'No todos found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    paginationInfo.textContent = '';
    return;
  }

  pageItems.forEach((t, idx) => {
    const tr = document.createElement('tr');

    // #
    const tdIdx = document.createElement('td');
    tdIdx.textContent = (currentPage - 1) * CONFIG.PAGE_SIZE + idx + 1;
    tr.appendChild(tdIdx);

    // Task
    const tdTask = document.createElement('td');
    tdTask.textContent = t.todo;
    if (t.completed) tdTask.classList.add('todo-completed');
    tr.appendChild(tdTask);

    // Created
    const tdDate = document.createElement('td');
    tdDate.textContent = t.createdAt || '';
    tr.appendChild(tdDate);

    // Completed checkbox
    const tdComp = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'form-check-input';
    chk.checked = !!t.completed;
    chk.addEventListener('change', () => onToggleComplete(t.id, chk.checked));
    tdComp.appendChild(chk);
    tr.appendChild(tdComp);

    // User
    const tdUser = document.createElement('td');
    tdUser.textContent = t.userId ?? '';
    tr.appendChild(tdUser);

    // Actions
    const tdActions = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-sm btn-outline-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => onDeleteLocal(t.id));
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  // Pagination info
  const total = filteredTodos.length;
  const start = (currentPage - 1) * CONFIG.PAGE_SIZE + 1;
  const end = Math.min(start + CONFIG.PAGE_SIZE - 1, total);
  paginationInfo.textContent = `Showing ${start}-${end} of ${total}`;
}

function renderPagination() {
  paginationEl.innerHTML = '';
  const total = filteredTodos.length;
  const totalPages = Math.ceil(total / CONFIG.PAGE_SIZE) || 1;

  const createPageItem = (label, page, disabled = false, active = false) => {
    const li = document.createElement('li');
    li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = label;
    a.addEventListener('click', e => {
      e.preventDefault();
      if (!disabled && currentPage !== page) {
        currentPage = page;
        render();
      }
    });
    li.appendChild(a);
    return li;
  };

  paginationEl.appendChild(createPageItem('«', Math.max(1, currentPage - 1), currentPage === 1));

  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - windowSize + 1);
  }
  for (let p = start; p <= end; p++) {
    paginationEl.appendChild(createPageItem(String(p), p, false, p === currentPage));
  }

  paginationEl.appendChild(createPageItem('»', Math.min(totalPages, currentPage + 1), currentPage === totalPages));
}

function onToggleComplete(id, completed) {
  const idx = allTodos.findIndex(t => String(t.id) === String(id));
  if (idx >= 0) {
    allTodos[idx].completed = completed;
    saveLocal(allTodos);
  }
  applyFilters(); 
  apiToggleComplete(id, completed);
}

function onDeleteLocal(id) {
  allTodos = allTodos.filter(t => String(t.id) !== String(id));
  saveLocal(allTodos);
  applyFilters();
  showAlert('Todo removed (local only).', 'warning');
}

async function onAddTodoSubmit(e) {
  e.preventDefault();
  const text = newTodoText.value.trim();
  const date = newTodoDate.value;
  const completed = newTodoCompleted.value === 'true';
  if (!text || !date) {
    showAlert('Task and date are required.', 'danger');
    return;
  }

  const localId = generateLocalId();
  let newTodo = {
    id: localId,
    todo: text,
    completed,
    userId: 1, 
    createdAt: date,
  };

  try {
    const apiResp = await apiAddTodo({ todo: text, completed, userId: 1 });
    newTodo = { ...apiResp, createdAt: date };
    showAlert('Todo added (API simulated).', 'success');
  } catch (err) {
    console.error(err);
    showAlert('API add failed — saved locally.', 'warning');
  }

  allTodos.unshift(newTodo); 
  saveLocal(allTodos);
  applyFilters();
  addTodoForm.reset();
  newTodoDate.value = todayISO(); 
}

function onClearFilters() {
  searchInput.value = '';
  fromDateInput.value = '';
  toDateInput.value = '';
  applyFilters();
}

async function init() {
  newTodoDate.value = todayISO();

  const local = loadLocal();
  if (Array.isArray(local) && local.length) {
    allTodos = local;
    filteredTodos = [...allTodos];
    render();
  }

  setLoading(true);
  try {
    const apiTodos = await apiFetchTodos({ limit: 150, skip: 0 });
    let enriched = enrichTodosWithCreatedAt(apiTodos);

    if (Array.isArray(local) && local.length) {
      enriched = mergeTodos(enriched, local);
    }

    allTodos = enriched;
    saveLocal(allTodos);
    filteredTodos = [...allTodos];
    render();
    showAlert('Todos synced from API.', 'success');
  } catch (err) {
    console.error(err);
    if (!allTodos.length) {
      showAlert('Failed to fetch todos from API.', 'danger', 8000);
    } else {
      showAlert('Using cached todos (API fetch failed).', 'warning');
    }
  } finally {
    setLoading(false);
  }
}

addTodoForm.addEventListener('submit', onAddTodoSubmit);
searchInput.addEventListener('input', applyFilters);
fromDateInput.addEventListener('change', applyFilters);
toDateInput.addEventListener('change', applyFilters);
clearFiltersBtn.addEventListener('click', onClearFilters);


// Start
init();



