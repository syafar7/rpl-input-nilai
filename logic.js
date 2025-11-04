// logic.js (type=module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// init firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const colNilai = collection(db, 'nilai_mahasiswa');

// DOM elements
const form = document.getElementById('nilaiForm');
const nimInput = document.getElementById('nim');
const namaInput = document.getElementById('nama');
const mkInput = document.getElementById('mata_kuliah');
const nilaiInput = document.getElementById('nilai');

const tbody = document.getElementById('tbodyNilai');
const recordsCount = document.getElementById('recordsCount');
const formMsg = document.getElementById('formMsg');
const searchInput = document.getElementById('searchInput');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');

let currentSnapshot = []; // cache untuk export & search

// validasi sederhana
function validate() {
  const nim = nimInput.value.trim();
  const nama = namaInput.value.trim();
  const mk = mkInput.value.trim();
  const nilai = nilaiInput.value.trim();

  if (!nim || !nama || !mk || nilai === '') {
    return { ok: false, msg: 'Semua field wajib diisi.' };
  }
  const n = Number(nilai);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    return { ok: false, msg: 'Nilai harus angka antara 0 - 100.' };
  }
  return { ok: true };
}

// tampilkan pesan di form
function showFormMsg(text, type='success') {
  formMsg.innerHTML = `<div class="alert alert-${type} py-1">${text}</div>`;
  setTimeout(()=> formMsg.innerHTML = '', 3000);
}

// simpan data ke Firestore
async function saveData(e) {
  e.preventDefault();
  const v = validate();
  if (!v.ok) {
    showFormMsg(v.msg, 'danger');
    return;
  }

  const doc = {
    nim: nimInput.value.trim(),
    nama: namaInput.value.trim(),
    mata_kuliah: mkInput.value.trim(),
    nilai: Number(nilaiInput.value.trim()),
    created_at: serverTimestamp()
  };

  try {
    await addDoc(colNilai, doc);
    showFormMsg('Data berhasil disimpan ✅', 'success');
    form.reset();
  } catch (err) {
    console.error(err);
    showFormMsg('Gagal menyimpan data. Cek console.', 'danger');
  }
}

// render rows
function renderRows(docs) {
  tbody.innerHTML = '';
  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada data</td></tr>`;
    recordsCount.textContent = '0 record';
    return;
  }
  docs.forEach(d => {
    const date = d.created_at && d.created_at.toDate ? d.created_at.toDate() : (d.created_at || null);
    const dateStr = date ? new Date(date).toLocaleString('id-ID') : '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(d.nim)}</td>
      <td>${escapeHtml(d.nama)}</td>
      <td>${escapeHtml(d.mata_kuliah)}</td>
      <td class="text-end">${d.nilai}</td>
      <td class="text-nowrap">${dateStr}</td>
    `;
    tbody.appendChild(tr);
  });
  recordsCount.textContent = `${docs.length} record`;
}

// helper escape
function escapeHtml(s) {
  if (typeof s !== 'string') return s;
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

// realtime listener: ambil data ordered by created_at desc
const q = query(colNilai, orderBy('created_at','desc'));
onSnapshot(q, snapshot => {
  const arr = [];
  snapshot.forEach(doc => {
    arr.push({ id: doc.id, ...doc.data() });
  });
  currentSnapshot = arr;
  applySearchAndRender();
}, err => {
  console.error('Listener error:', err);
  showFormMsg('Gagal terhubung ke Firestore. Periksa konfigurasi.', 'danger');
});

// cari & render
function applySearchAndRender() {
  const keyword = (searchInput.value || '').trim().toLowerCase();
  if (!keyword) {
    renderRows(currentSnapshot);
    return;
  }
  const filtered = currentSnapshot.filter(d => {
    return (d.nim && d.nim.toString().toLowerCase().includes(keyword)) ||
           (d.nama && d.nama.toLowerCase().includes(keyword)) ||
           (d.mata_kuliah && d.mata_kuliah.toLowerCase().includes(keyword));
  });
  renderRows(filtered);
}

// export CSV
function exportCSV() {
  if (!currentSnapshot.length) {
    showFormMsg('Tidak ada data untuk diexport', 'danger');
    return;
  }
  // build csv
  const cols = ['nim','nama','mata_kuliah','nilai','created_at'];
  const rows = currentSnapshot.map(d => {
    const date = d.created_at && d.created_at.toDate ? d.created_at.toDate().toISOString() : (d.created_at || '');
    return [d.nim, d.nama, d.mata_kuliah, d.nilai, date];
  });
  const csv = [cols.join(','), ...rows.map(r => r.map(cell => `"${(cell||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nilai_mahasiswa.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// events
form.addEventListener('submit', saveData);
searchInput.addEventListener('input', applySearchAndRender);
btnExport.addEventListener('click', exportCSV);
btnClear.addEventListener('click', ()=> form.reset());
