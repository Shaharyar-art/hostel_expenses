
/* Mera Expense - App Logic (localStorage + PWA friendly)
   Author: ChatGPT for a single-paste perfect build
*/

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

// DOM refs
const form = $("#expenseForm");
const idInput = $("#expenseId");
const amountInput = $("#amount");
const categoryInput = $("#category");
const noteInput = $("#note");
const dateInput = $("#date");
const listSection = $("#listSection");
const emptyState = $("#emptyState");

const searchInput = $("#searchInput");
const dateFilter = $("#dateFilter");
const categoryFilter = $("#categoryFilter");
const clearFiltersBtn = $("#clearFilters");

const statToday = $("#statToday");
const statWeek = $("#statWeek");
const statMonth = $("#statMonth");
const statAll = $("#statAll");

const exportPdfBtn = $("#exportPdfBtn");
const exportCsvBtn = $("#exportCsvBtn");

const installBtn = $("#installBtn");
const installBadge = $("#installBadge");

let deferredPrompt = null;

// Helpers
const todayStr = () => new Date().toISOString().slice(0,10);
const toINR = (n) => "₹" + (Number(n)||0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const uid = () => crypto.randomUUID();

// Storage
const STORAGE_KEY = "mera.expenses.v1";
function loadExpenses(){
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch(e){
    console.warn("Failed to parse storage", e);
    return [];
  }
}
function saveExpenses(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
let expenses = loadExpenses();

// Init defaults
dateInput.value = todayStr();

// Install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
  installBadge.classList.remove("hidden");
});
installBtn.addEventListener('click', async () => {
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

// Form submit
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = idInput.value || uid();
  const payload = {
    id,
    amount: Number(amountInput.value),
    category: categoryInput.value || "Other",
    note: noteInput.value?.trim() || "",
    date: dateInput.value || todayStr(),
    time: new Date().toISOString()
  };
  if(!payload.amount || payload.amount <= 0){
    alert("Please enter a valid amount.");
    return;
  }
  if(idInput.value){
    expenses = expenses.map(x => x.id === id ? {...payload} : x);
  } else {
    expenses.unshift(payload);
  }
  saveExpenses(expenses);
  form.reset();
  dateInput.value = todayStr();
  idInput.value = "";
  render();
});

$("#resetBtn").addEventListener('click', ()=>{
  form.reset();
  dateInput.value = todayStr();
  idInput.value = "";
});

// Filters + search
[searchInput, dateFilter, categoryFilter].forEach(el => {
  el.addEventListener('input', render);
});
clearFiltersBtn.addEventListener('click', ()=>{
  searchInput.value = "";
  dateFilter.value = "";
  categoryFilter.value = "";
  render();
});

// CRUD actions from list
function onEdit(id){
  const item = expenses.find(x => x.id === id);
  if(!item) return;
  idInput.value = item.id;
  amountInput.value = item.amount;
  categoryInput.value = item.category;
  noteInput.value = item.note;
  dateInput.value = item.date;
  window.scrollTo({top:0, behavior:"smooth"});
}
function onDelete(id){
  if(!confirm("Delete this entry?")) return;
  expenses = expenses.filter(x => x.id !== id);
  saveExpenses(expenses);
  render();
}

// Filtering logic
function applyFilters(data){
  const q = searchInput.value.trim().toLowerCase();
  const d = dateFilter.value;
  const c = categoryFilter.value;
  return data.filter(x => {
    const okQ = !q || (x.note?.toLowerCase().includes(q) || x.category?.toLowerCase().includes(q));
    const okD = !d || x.date === d;
    const okC = !c || x.category === c;
    return okQ && okD && okC;
  });
}

// Group by date for list rendering
function groupByDate(data){
  const map = new Map();
  data.forEach(x => {
    if(!map.has(x.date)) map.set(x.date, []);
    map.get(x.date).push(x);
  });
  return Array.from(map.entries()).sort((a,b)=> b[0].localeCompare(a[0])); // newest date first
}

// Stats
function calcStats(data){
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sun
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let sumToday=0, sumWeek=0, sumMonth=0, sumAll=0;
  data.forEach(x => {
    const dx = new Date(x.date + "T00:00:00");
    const amt = Number(x.amount)||0;
    sumAll += amt;
    if(dx >= startOfDay) sumToday += amt;
    if(dx >= startOfWeek) sumWeek += amt;
    if(dx >= startOfMonth) sumMonth += amt;
  });
  statToday.textContent = toINR(sumToday);
  statWeek.textContent  = toINR(sumWeek);
  statMonth.textContent = toINR(sumMonth);
  statAll.textContent   = toINR(sumAll);
}

// Render list
function render(){
  const filtered = applyFilters(expenses);
  calcStats(expenses);
  listSection.innerHTML = "";
  if(filtered.length === 0){
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  const groups = groupByDate(filtered);
  groups.forEach(([date, items]) => {
    const total = items.reduce((a,b)=>a+Number(b.amount||0),0);
    const header = document.createElement("div");
    header.className = "group-header";
    header.textContent = `${date} • ${toINR(total)}`;
    listSection.appendChild(header);
    items.forEach(item => {
      const el = document.createElement("div");
      el.className = "expense-item";
      el.innerHTML = `
        <div class="flex-1">
          <div class="font-semibold">${item.category} • <span class="expense-amount">${toINR(item.amount)}</span></div>
          <div class="expense-note">${item.note || ""}</div>
          <div class="expense-meta">Saved: ${new Date(item.time).toLocaleString()}</div>
        </div>
        <div class="actions flex flex-col gap-2">
          <button onclick="onEdit('${item.id}')">Edit</button>
          <button onclick="onDelete('${item.id}')">Delete</button>
        </div>
      `;
      listSection.appendChild(el);
    });
  });
}
window.onEdit = onEdit;
window.onDelete = onDelete;

// Export CSV
exportCsvBtn.addEventListener('click', ()=>{
  const rows = [["id","date","amount","category","note","time"]];
  applyFilters(expenses).forEach(x=>{
    rows.push([x.id, x.date, x.amount, x.category, (x.note||"").replace(/"/g,'""'), x.time]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v)}"`).join(",")).join("\\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// Export PDF (current filtered view, A4 portrait)
exportPdfBtn.addEventListener('click', async ()=>{
  const data = applyFilters(expenses);
  if(data.length === 0){
    alert("Nothing to export for current filters.");
    return;
  }
  // jsPDF via UMD
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF){
    alert("PDF library failed to load. Try again after network is available once; app will cache it for offline use.");
    return;
  }
  const doc = new jsPDF({unit:"pt", format:"a4", compress:true});
  const title = "Mera Expense — Export";
  const now = new Date().toLocaleString();
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.text(`Generated: ${now}`, 40, 58);

  const body = data.map(x => [x.date, x.category, Number(x.amount), x.note || ""]);
  const total = data.reduce((a,b)=>a+Number(b.amount||0),0);

  doc.autoTable({
    startY: 80,
    head: [["Date","Category","Amount (₹)","Note"]],
    body,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [17,24,39] },
    columnStyles: { 2: { halign: "right" } },
    didDrawPage: (d) => {
      // Footer
      const pageSize = doc.internal.pageSize;
      doc.setFontSize(9);
      doc.text(`Total: ₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}`, pageSize.getWidth()-160, pageSize.getHeight()-20);
      doc.text("Mera Expense", 40, pageSize.getHeight()-20);
    }
  });
  doc.save("expenses.pdf");
});

// Initial render
render();
