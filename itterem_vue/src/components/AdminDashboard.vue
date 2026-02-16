<script setup>
import { computed, onMounted, ref } from 'vue';
import { getDrinks, getMeals, getMenus, getSides } from '../api.js';

// Props from parent
const props = defineProps({
  onBack: {
    type: Function,
    default: undefined,
  },
  onLogout: {
    type: Function,
    default: undefined,
  },
});

// Data (loaded from API)
const activeTab = ref('menuk');

const menukRaw = ref([]);
const keszetelek = ref([]); // Meals
const koretek = ref([]); // Sides
const uditok = ref([]); // Drinks

const isLoading = ref(false);
const loadError = ref('');

function getMenuMealId(menu) {
  return menu?.keszetel_id ?? menu?.keszetelId ?? menu?.keszetelID ?? menu?.keszetel?.id ?? null;
}

function getMenuSideId(menu) {
  return menu?.koret_id ?? menu?.koretId ?? menu?.koretID ?? menu?.koret?.id ?? null;
}

function getMenuDrinkId(menu) {
  return menu?.udito_id ?? menu?.uditoId ?? menu?.uditoID ?? menu?.udito?.id ?? null;
}

const mealsById = computed(() => new Map((keszetelek.value || []).map((m) => [String(m.id), m])));
const sidesById = computed(() => new Map((koretek.value || []).map((s) => [String(s.id), s])));
const drinksById = computed(() => new Map((uditok.value || []).map((d) => [String(d.id), d])));

const menuk = computed(() => {
  return (menukRaw.value || []).map((menu) => {
    const keszetel_id = getMenuMealId(menu);
    const koret_id = getMenuSideId(menu);
    const udito_id = getMenuDrinkId(menu);

    const meal = keszetel_id != null ? mealsById.value.get(String(keszetel_id)) : null;
    const side = koret_id != null ? sidesById.value.get(String(koret_id)) : null;
    const drink = udito_id != null ? drinksById.value.get(String(udito_id)) : null;

    return {
      ...menu,
      keszetel_id,
      koret_id,
      udito_id,
      keszetel: meal?.nev ?? (keszetel_id != null ? String(keszetel_id) : '-'),
      koret: side?.nev ?? (koret_id != null ? String(koret_id) : '-'),
      udito: drink?.nev ?? (udito_id != null ? String(udito_id) : '-'),
    };
  });
});

async function loadAdminData() {
  isLoading.value = true;
  loadError.value = '';

  const results = await Promise.allSettled([getMenus(), getMeals(), getSides(), getDrinks()]);
  const [menusRes, mealsRes, sidesRes, drinksRes] = results;

  if (menusRes.status === 'fulfilled') {
    menukRaw.value = Array.isArray(menusRes.value) ? menusRes.value : [];
  } else {
    menukRaw.value = [];
    loadError.value = menusRes.reason instanceof Error ? menusRes.reason.message : 'Failed to load menus';
  }

  if (mealsRes.status === 'fulfilled') {
    keszetelek.value = Array.isArray(mealsRes.value) ? mealsRes.value : [];
  } else {
    keszetelek.value = [];
    loadError.value = loadError.value || (mealsRes.reason instanceof Error ? mealsRes.reason.message : 'Failed to load meals');
  }

  if (sidesRes.status === 'fulfilled') {
    koretek.value = Array.isArray(sidesRes.value) ? sidesRes.value : [];
  } else {
    koretek.value = [];
    loadError.value = loadError.value || (sidesRes.reason instanceof Error ? sidesRes.reason.message : 'Failed to load sides');
  }

  if (drinksRes.status === 'fulfilled') {
    uditok.value = Array.isArray(drinksRes.value) ? drinksRes.value : [];
  } else {
    uditok.value = [];
    loadError.value = loadError.value || (drinksRes.reason instanceof Error ? drinksRes.reason.message : 'Failed to load drinks');
  }

  isLoading.value = false;
}

onMounted(() => {
  loadAdminData();
});

const hozzavalok = ref([
  { id: 1, hozzavalo_nev: 'Hamburger hus' },
  { id: 2, hozzavalo_nev: 'Hamburger puffancs' },
  { id: 3, hozzavalo_nev: 'Spegetti tészta' },
  { id: 4, hozzavalo_nev: 'Spagetti hús' }
]);

const users = ref([
  { id: 9, teljes_nev: 'Teszt Felhasználó', email: 'teszt1@teszt.hu', telefonszam: '+36 30 1234567', jogosultsag: 1, aktiv: 1 }
]);

const jogok = ref([
  { id: 1, szint: 0, nev: 'Felhasználó', leiras: 'Bejelentkezett felhasználó, alap jog' },
  { id: 2, szint: 1, nev: 'Felhasználó', leiras: 'Alap jogosultság' }
]);

// Edit modal state
const showEditModal = ref(false);
const editingItem = ref(null);
const editForm = ref({});

function setTab(tab) {
  activeTab.value = tab;
}

function openEditModal(item, type) {
  editingItem.value = { ...item, type };
  editForm.value = { ...item };
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingItem.value = null;
  editForm.value = {};
}

function saveEdit() {
  // This will be implemented later with actual API calls
  console.log('Saving:', editForm.value);
  closeEditModal();
}
</script>

<template>
  <div class="admin-container">
    <!-- Header -->
    <div class="admin-header">
      <div class="header-content">
        <div>
          <h1 class="admin-title">Itterem Admin Panel</h1>
          <div class="admin-subtitle">Restaurant Management System</div>
        </div>
        <div class="header-actions">
          <button class="btn-back" @click="props.onBack">
            ← Vissza
          </button>
          <button class="btn-back" @click="loadAdminData">
            ↻ Frissítés
          </button>
          <button class="btn-logout" @click="props.onLogout">
            Kilépés
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="admin-tabs">
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'menuk' }]"
        @click="setTab('menuk')"
      >
        Menük
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'keszetelek' }]"
        @click="setTab('keszetelek')"
      >
        Készételek
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'koretek' }]"
        @click="setTab('koretek')"
      >
        Köretek
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'uditok' }]"
        @click="setTab('uditok')"
      >
        Üdítők
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'hozzavalok' }]"
        @click="setTab('hozzavalok')"
      >
        Hozzávalók
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'users' }]"
        @click="setTab('users')"
      >
        Felhasználók
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'jogok' }]"
        @click="setTab('jogok')"
      >
        Jogosultságok
      </button>
    </div>

    <!-- Content Area -->
    <div class="admin-content">
      <div v-if="isLoading" class="mb-4 rounded-lg bg-white/90 p-3 text-sm font-medium text-gray-800">
        Adatok betöltése...
      </div>

      <div v-else-if="loadError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
        {{ loadError }}
      </div>

      <!-- Menuk Tab -->
      <div v-if="activeTab === 'menuk'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Menük Kezelése</h2>
          <button class="btn-add">+ Új Menü</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Menú Név</th>
                <th>Készétel</th>
                <th>Köret</th>
                <th>Üdítő</th>
                <th>Elérhető</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="menu in menuk" :key="menu.id">
                <td>{{ menu.id }}</td>
                <td class="font-semibold">{{ menu.menu_nev }}</td>
                <td>{{ menu.keszetel }}</td>
                <td>{{ menu.koret }}</td>
                <td>{{ menu.udito }}</td>
                <td>
                  <span :class="['status-badge', menu.elerheto ? 'status-active' : 'status-inactive']">
                    {{ menu.elerheto ? 'Igen' : 'Nem' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-edit" @click="openEditModal(menu, 'menu')">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Keszetelek Tab -->
      <div v-if="activeTab === 'keszetelek'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Készételek Kezelése</h2>
          <button class="btn-add">+ Új Készétel</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Név</th>
                <th>Leírás</th>
                <th>Elérhető</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="keszetel in keszetelek" :key="keszetel.id">
                <td>{{ keszetel.id }}</td>
                <td class="font-semibold">{{ keszetel.nev }}</td>
                <td>{{ keszetel.leiras }}</td>
                <td>
                  <span :class="['status-badge', keszetel.elerheto ? 'status-active' : 'status-inactive']">
                    {{ keszetel.elerheto ? 'Igen' : 'Nem' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-edit">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Koretek Tab -->
      <div v-if="activeTab === 'koretek'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Köretek Kezelése</h2>
          <button class="btn-add">+ Új Köret</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Név</th>
                <th>Leírás</th>
                <th>Elérhető</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="koret in koretek" :key="koret.id">
                <td>{{ koret.id }}</td>
                <td class="font-semibold">{{ koret.nev }}</td>
                <td>{{ koret.leiras || '-' }}</td>
                <td>
                  <span :class="['status-badge', koret.elerheto ? 'status-active' : 'status-inactive']">
                    {{ koret.elerheto ? 'Igen' : 'Nem' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-edit">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Uditok Tab -->
      <div v-if="activeTab === 'uditok'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Üdítők Kezelése</h2>
          <button class="btn-add">+ Új Üdítő</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Név</th>
                <th>Elérhető</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="udito in uditok" :key="udito.id">
                <td>{{ udito.id }}</td>
                <td class="font-semibold">{{ udito.nev }}</td>
                <td>
                  <span :class="['status-badge', udito.elerheto ? 'status-active' : 'status-inactive']">
                    {{ udito.elerheto ? 'Igen' : 'Nem' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-edit">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Hozzavalok Tab -->
      <div v-if="activeTab === 'hozzavalok'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Hozzávalók Kezelése</h2>
          <button class="btn-add">+ Új Hozzávaló</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Hozzávaló Név</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hozzavalo in hozzavalok" :key="hozzavalo.id">
                <td>{{ hozzavalo.id }}</td>
                <td class="font-semibold">{{ hozzavalo.hozzavalo_nev }}</td>
                <td class="actions">
                  <button class="btn-edit">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Felhasználók Kezelése</h2>
          <button class="btn-add">+ Új Felhasználó</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Teljes Név</th>
                <th>Email</th>
                <th>Telefonszám</th>
                <th>Jogosultság</th>
                <th>Aktív</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.id }}</td>
                <td class="font-semibold">{{ user.teljes_nev }}</td>
                <td>{{ user.email }}</td>
                <td>{{ user.telefonszam }}</td>
                <td>
                  <span class="badge-jogosultsag">
                    Szint {{ user.jogosultsag }}
                  </span>
                </td>
                <td>
                  <span :class="['status-badge', user.aktiv ? 'status-active' : 'status-inactive']">
                    {{ user.aktiv ? 'Igen' : 'Nem' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-edit">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Jogok Tab -->
      <div v-if="activeTab === 'jogok'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Jogosultságok Kezelése</h2>
          <button class="btn-add">+ Új Jogosultság</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Szint</th>
                <th>Név</th>
                <th>Leírás</th>
                <th>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="jog in jogok" :key="jog.id">
                <td>{{ jog.id }}</td>
                <td>
                  <span class="badge-level">{{ jog.szint }}</span>
                </td>
                <td class="font-semibold">{{ jog.nev }}</td>
                <td>{{ jog.leiras }}</td>
                <td class="actions">
                  <button class="btn-edit">Szerkeszt</button>
                  <button class="btn-delete">Töröl</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Menü Szerkesztése</h3>
          <button class="modal-close" @click="closeEditModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">ID</label>
            <input v-model="editForm.id" type="text" class="form-input" disabled />
          </div>

          <div class="form-group">
            <label class="form-label">Menú Név</label>
            <input v-model="editForm.menu_nev" type="text" class="form-input" placeholder="Menü neve" />
          </div>

          <div class="form-group">
            <label class="form-label">Készétel</label>
            <select v-model="editForm.keszetel_id" class="form-input">
              <option :value="null">Válassz készételt</option>
              <option v-for="k in keszetelek" :key="k.id" :value="k.id">{{ k.nev }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Köret</label>
            <select v-model="editForm.koret_id" class="form-input">
              <option :value="null">Válassz köretet</option>
              <option v-for="k in koretek" :key="k.id" :value="k.id">{{ k.nev }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Üdítő</label>
            <select v-model="editForm.udito_id" class="form-input">
              <option :value="null">Válassz üdítőt</option>
              <option v-for="u in uditok" :key="u.id" :value="u.id">{{ u.nev }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Elérhető</label>
            <div class="form-checkbox-group">
              <input v-model="editForm.elerheto" type="checkbox" :true-value="1" :false-value="0" class="form-checkbox" id="elerheto" />
              <label for="elerheto" class="form-checkbox-label">Elérhető a menüben</label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="closeEditModal">Mégse</button>
          <button class="btn-save" @click="saveEdit">Mentés</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.admin-header {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-back,
.btn-logout {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-back {
  background: #e0e7ff;
  color: #4338ca;
}

.btn-back:hover {
  background: #c7d2fe;
  transform: translateY(-1px);
}

.btn-logout {
  background: #fee2e2;
  color: #991b1b;
}

.btn-logout:hover {
  background: #fecaca;
  transform: translateY(-1px);
}

.admin-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.admin-subtitle {
  font-size: 1rem;
  color: #6b7280;
}

.admin-tabs {
  display: flex;
  gap: 8px;
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  overflow-x: auto;
  flex-wrap: wrap;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #4b5563;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-button:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.tab-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.admin-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 30px;
  min-height: 500px;
}

.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e5e7eb;
}

.content-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.btn-add {
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.data-table thead {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.data-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.data-table td {
  padding: 16px;
  color: #374151;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-active {
  background: #d1fae5;
  color: #065f46;
}

.status-inactive {
  background: #fee2e2;
  color: #991b1b;
}

.badge-jogosultsag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  background: #dbeafe;
  color: #1e40af;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-level {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn-edit,
.btn-delete {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit {
  background: #dbeafe;
  color: #1e40af;
}

.btn-edit:hover {
  background: #bfdbfe;
  transform: translateY(-1px);
}

.btn-delete {
  background: #fee2e2;
  color: #991b1b;
}

.btn-delete:hover {
  background: #fecaca;
  transform: translateY(-1px);
}

.font-semibold {
  font-weight: 600;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .admin-container {
    padding: 10px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
  }

  .btn-back,
  .btn-logout {
    flex: 1;
  }

  .admin-title {
    font-size: 1.875rem;
  }

  .admin-tabs {
    flex-wrap: wrap;
  }

  .tab-button {
    padding: 10px 16px;
    font-size: 0.875rem;
  }

  .content-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .btn-add {
    width: 100%;
  }

  .data-table {
    font-size: 0.875rem;
  }

  .data-table th,
  .data-table td {
    padding: 12px 8px;
  }

  .actions {
    flex-direction: column;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 2px solid #e5e7eb;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 1.5rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e5e7eb;
  color: #374151;
  transform: scale(1.1);
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #1f2937;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-checkbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
}

.form-checkbox:checked {
  background: #667eea;
  border-color: #667eea;
}

.form-checkbox-label {
  font-size: 0.875rem;
  color: #4b5563;
  cursor: pointer;
  user-select: none;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 24px;
  border-top: 2px solid #e5e7eb;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.btn-cancel:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.btn-save {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

@media (max-width: 768px) {
  .modal-content {
    max-height: 95vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn-cancel,
  .btn-save {
    width: 100%;
  }
}
</style>
