<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  deleteCategory,
  deleteDrink,
  deleteIngredient,
  deleteMenu,
  deleteMeal,
  deleteSide,
  getCategories,
  getDrinks,
  getIngredients,
  getMeals,
  getMenus,
  getSides,
  updateCategory,
  updateDrink,
  updateIngredient,
  updateMenu,
  updateMeal,
  updateSide,
} from '../api.js';

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
const kategoriak = ref([]);
const hozzavalok = ref([]);
const keszetelek = ref([]); // Meals
const koretek = ref([]); // Sides
const uditok = ref([]); // Drinks

const isLoading = ref(false);
const loadError = ref('');

const actionError = ref('');
const actionSuccess = ref('');

const showEditModal = ref(false);
const editType = ref('');
const editForm = ref({});
const saving = ref(false);

function clearFeedback() {
  actionError.value = '';
  actionSuccess.value = '';
}

function normalizeAvailable(value) {
  return value === 1 || value === true;
}

function getMealCategoryId(meal) {
  return (
    meal?.kategoria_id ??
    meal?.kategoriaId ??
    meal?.kategoriaID ??
    meal?.kategoria?.id ??
    meal?.kategoria ??
    null
  );
}

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
  clearFeedback();

  const results = await Promise.allSettled([
    getMenus(),
    getCategories(),
    getIngredients(),
    getMeals(),
    getSides(),
    getDrinks(),
  ]);
  const [menusRes, categoriesRes, ingredientsRes, mealsRes, sidesRes, drinksRes] = results;

  if (menusRes.status === 'fulfilled') {
    menukRaw.value = Array.isArray(menusRes.value) ? menusRes.value : [];
  } else {
    menukRaw.value = [];
    loadError.value = menusRes.reason instanceof Error ? menusRes.reason.message : 'Failed to load menus';
  }

  if (categoriesRes.status === 'fulfilled') {
    kategoriak.value = Array.isArray(categoriesRes.value) ? categoriesRes.value : [];
  } else {
    kategoriak.value = [];
    loadError.value = loadError.value || (categoriesRes.reason instanceof Error ? categoriesRes.reason.message : 'Failed to load categories');
  }

  if (ingredientsRes.status === 'fulfilled') {
    hozzavalok.value = Array.isArray(ingredientsRes.value) ? ingredientsRes.value : [];
  } else {
    hozzavalok.value = [];
    loadError.value = loadError.value || (ingredientsRes.reason instanceof Error ? ingredientsRes.reason.message : 'Failed to load ingredients');
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

function setTab(tab) {
  activeTab.value = tab;
}

const editModalTitle = computed(() => {
  if (editType.value === 'ingredient') return 'Hozzávaló szerkesztése';
  if (editType.value === 'category') return 'Kategória szerkesztése';
  if (editType.value === 'menu') return 'Menü szerkesztése';
  if (editType.value === 'meal') return 'Készétel szerkesztése';
  if (editType.value === 'side') return 'Köret szerkesztése';
  if (editType.value === 'drink') return 'Üdítő szerkesztése';
  return 'Szerkesztés';
});

function openEditModal(type, item) {
  clearFeedback();
  editType.value = type;

  if (type === 'ingredient') {
    editForm.value = {
      id: item?.id,
      nev: String(item?.hozzavaloNev ?? item?.hozzavalo_nev ?? ''),
    };
  } else if (type === 'category') {
    editForm.value = {
      id: item?.id,
      nev: String(item?.nev ?? item?.name ?? ''),
    };
  } else if (type === 'meal') {
    editForm.value = {
      id: item?.id,
      nev: String(item?.nev ?? ''),
      leiras: String(item?.leiras ?? ''),
      elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
      kategoraId: getMealCategoryId(item) ?? '',
      kepBase64: '',
    };
  } else if (type === 'side') {
    editForm.value = {
      id: item?.id,
      nev: String(item?.nev ?? ''),
      leiras: String(item?.leiras ?? ''),
      elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
      kepBase64: '',
    };
  } else if (type === 'drink') {
    editForm.value = {
      id: item?.id,
      nev: String(item?.nev ?? ''),
      elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
      kepBase64: '',
    };
  } else if (type === 'menu') {
    editForm.value = {
      id: item?.id,
      menuNev: String(item?.menu_nev ?? item?.menuNev ?? ''),
      keszetelId: item?.keszetel_id ?? item?.keszetelId ?? '',
      koretId: item?.koret_id ?? item?.koretId ?? '',
      uditoId: item?.udito_id == null ? '' : item?.udito_id,
      elerheto: normalizeAvailable(item?.elerheto) ? 1 : 0,
      kepBase64: '',
    };
  } else {
    editForm.value = { ...item };
  }

  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editType.value = '';
  editForm.value = {};
  clearFeedback();
}

async function saveEdit() {
  clearFeedback();
  saving.value = true;

  try {
    const id = editForm.value?.id;
    if (!id && id !== 0) {
      actionError.value = 'Missing id.';
      return;
    }

    if (editType.value === 'ingredient') {
      const nev = String(editForm.value?.nev ?? '').trim();
      if (!nev) {
        actionError.value = 'Név kötelező.';
        return;
      }
      const res = await updateIngredient({ id, nev });
      if (!res.ok) throw new Error(res.message || 'Failed to update ingredient');
      actionSuccess.value = 'Hozzávaló frissítve.';
    } else if (editType.value === 'category') {
      const nev = String(editForm.value?.nev ?? '').trim();
      if (!nev) {
        actionError.value = 'Név kötelező.';
        return;
      }
      const res = await updateCategory({ id, nev });
      if (!res.ok) throw new Error(res.message || 'Failed to update category');
      actionSuccess.value = 'Kategória frissítve.';
    } else if (editType.value === 'meal') {
      const nev = String(editForm.value?.nev ?? '').trim();
      const leiras = String(editForm.value?.leiras ?? '').trim();
      const elerheto = String(editForm.value?.elerheto ?? '0') === '1' ? 1 : 0;
      const kategoraId = String(editForm.value?.kategoraId ?? '').trim();
      const kepBase64 = String(editForm.value?.kepBase64 ?? '');

      if (!nev) {
        actionError.value = 'Név kötelező.';
        return;
      }
      if (!kategoraId) {
        actionError.value = 'Kategória kötelező.';
        return;
      }

      const res = await updateMeal({ id, nev, leiras, elerheto, kategoraId, kepBase64 });
      if (!res.ok) throw new Error(res.message || 'Failed to update meal');
      actionSuccess.value = 'Készétel frissítve.';
    } else if (editType.value === 'side') {
      const nev = String(editForm.value?.nev ?? '').trim();
      const leiras = String(editForm.value?.leiras ?? '').trim();
      const elerheto = String(editForm.value?.elerheto ?? '0') === '1' ? 1 : 0;
      const kepBase64 = String(editForm.value?.kepBase64 ?? '');

      if (!nev) {
        actionError.value = 'Név kötelező.';
        return;
      }

      const res = await updateSide({ id, nev, leiras, elerheto, kepBase64 });
      if (!res.ok) throw new Error(res.message || 'Failed to update side');
      actionSuccess.value = 'Köret frissítve.';
    } else if (editType.value === 'drink') {
      const nev = String(editForm.value?.nev ?? '').trim();
      const elerheto = String(editForm.value?.elerheto ?? '0') === '1' ? 1 : 0;
      const kepBase64 = String(editForm.value?.kepBase64 ?? '');

      if (!nev) {
        actionError.value = 'Név kötelező.';
        return;
      }

      const res = await updateDrink({ id, nev, elerheto, kepBase64 });
      if (!res.ok) throw new Error(res.message || 'Failed to update drink');
      actionSuccess.value = 'Üdítő frissítve.';
    } else if (editType.value === 'menu') {
      const menuNev = String(editForm.value?.menuNev ?? '').trim();
      const keszetelId = String(editForm.value?.keszetelId ?? '').trim();
      const koretId = String(editForm.value?.koretId ?? '').trim();
      const uditoIdRaw = editForm.value?.uditoId;
      const uditoId = String(uditoIdRaw ?? '').trim() === '' ? null : uditoIdRaw;
      const elerheto = String(editForm.value?.elerheto ?? '0') === '1' ? 1 : 0;
      const kepBase64 = String(editForm.value?.kepBase64 ?? '');

      if (!menuNev) {
        actionError.value = 'Menü név kötelező.';
        return;
      }
      if (!keszetelId) {
        actionError.value = 'Készétel kötelező.';
        return;
      }
      if (!koretId) {
        actionError.value = 'Köret kötelező.';
        return;
      }

      const res = await updateMenu({ id, menuNev, keszetelId, koretId, uditoId, elerheto, kepBase64 });
      if (!res.ok) throw new Error(res.message || 'Failed to update menu');
      actionSuccess.value = 'Menü frissítve.';
    }

    showEditModal.value = false;
    await loadAdminData();
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

async function handleDelete(type, item) {
  clearFeedback();
  const id = item?.id;
  if (!confirm('Biztosan törlöd?')) return;

  try {
    if (type === 'ingredient') {
      const res = await deleteIngredient(id);
      if (!res.ok) throw new Error(res.message || 'Failed to delete ingredient');
      actionSuccess.value = 'Hozzávaló törölve.';
    } else if (type === 'category') {
      const res = await deleteCategory(id);
      if (!res.ok) throw new Error(res.message || 'Failed to delete category');
      actionSuccess.value = 'Kategória törölve.';
    } else if (type === 'meal') {
      const res = await deleteMeal(id);
      if (!res.ok) throw new Error(res.message || 'Failed to delete meal');
      actionSuccess.value = 'Készétel törölve.';
    } else if (type === 'side') {
      const res = await deleteSide(id);
      if (!res.ok) throw new Error(res.message || 'Failed to delete side');
      actionSuccess.value = 'Köret törölve.';
    } else if (type === 'menu') {
      const res = await deleteMenu(id);
      if (!res.ok) throw new Error(res.message || 'Failed to delete menu');
      actionSuccess.value = 'Menü törölve.';
    } else if (type === 'drink') {
      const res = await deleteDrink(id);
      if (!res.ok) throw new Error(res.message || 'Failed to delete drink');
      actionSuccess.value = 'Üdítő törölve.';
    }

    await loadAdminData();
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Delete failed';
  }
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
        :class="['tab-button', { 'tab-active': activeTab === 'kategoriak' }]"
        @click="setTab('kategoriak')"
      >
        Kategóriák
      </button>
      <button 
        :class="['tab-button', { 'tab-active': activeTab === 'hozzavalok' }]"
        @click="setTab('hozzavalok')"
      >
        Hozzávalók
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
    </div>

    <!-- Content Area -->
    <div class="admin-content">
      <div v-if="isLoading" class="mb-4 rounded-lg bg-white/90 p-3 text-sm font-medium text-gray-800">
        Adatok betöltése...
      </div>

      <div v-else-if="loadError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
        {{ loadError }}
      </div>

		<div v-if="actionError" class="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
			{{ actionError }}
		</div>
		<div v-if="actionSuccess" class="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
			{{ actionSuccess }}
		</div>

      <!-- Menuk Tab -->
      <div v-if="activeTab === 'menuk'" class="tab-content">
        <div class="content-header">
          <h2 class="content-title">Menük Kezelése</h2>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Menü Név</th>
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
					<button class="btn-edit" @click="openEditModal('menu', menu)">Szerkeszt</button>
					<button class="btn-delete" @click="handleDelete('menu', menu)">Töröl</button>
				</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    <!-- Kategoriak Tab -->
    <div v-if="activeTab === 'kategoriak'" class="tab-content">
      <div class="content-header">
        <h2 class="content-title">Kategóriák Kezelése</h2>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Név</th>
              <th>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="kat in kategoriak" :key="kat.id">
              <td>{{ kat.id }}</td>
              <td class="font-semibold">{{ kat.nev }}</td>
              <td class="actions">
                <button class="btn-edit" @click="openEditModal('category', kat)">Szerkeszt</button>
                <button class="btn-delete" @click="handleDelete('category', kat)">Töröl</button>
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
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Név</th>
              <th>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hoz in hozzavalok" :key="hoz.id">
              <td>{{ hoz.id }}</td>
              <td class="font-semibold">{{ hoz.hozzavaloNev }}</td>
              <td class="actions">
                <button class="btn-edit" @click="openEditModal('ingredient', hoz)">Szerkeszt</button>
                <button class="btn-delete" @click="handleDelete('ingredient', hoz)">Töröl</button>
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
					<button class="btn-edit" @click="openEditModal('meal', keszetel)">Szerkeszt</button>
					<button class="btn-delete" @click="handleDelete('meal', keszetel)">Töröl</button>
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
					<button class="btn-edit" @click="openEditModal('side', koret)">Szerkeszt</button>
					<button class="btn-delete" @click="handleDelete('side', koret)">Töröl</button>
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
					<button class="btn-edit" @click="openEditModal('drink', udito)">Szerkeszt</button>
					<button class="btn-delete" @click="handleDelete('drink', udito)">Töröl</button>
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
        <h3 class="modal-title">{{ editModalTitle }}</h3>
        <button class="modal-close" @click="closeEditModal">×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">ID</label>
          <input v-model="editForm.id" type="text" class="form-input" disabled />
        </div>

        <div v-if="editType !== 'menu'" class="form-group">
          <label class="form-label">Név</label>
          <input v-model="editForm.nev" type="text" class="form-input" />
        </div>

        <div v-if="editType === 'menu'" class="form-group">
          <label class="form-label">Menü név</label>
          <input v-model="editForm.menuNev" type="text" class="form-input" />
        </div>

        <div v-if="editType === 'meal' || editType === 'side'" class="form-group">
          <label class="form-label">Leírás</label>
          <textarea v-model="editForm.leiras" class="form-input" rows="3" />
        </div>

        <div v-if="editType === 'meal' || editType === 'side' || editType === 'drink' || editType === 'menu'" class="form-group">
          <label class="form-label">Elérhető</label>
          <select v-model="editForm.elerheto" class="form-input">
            <option :value="1">Igen</option>
            <option :value="0">Nem</option>
          </select>
        </div>

        <div v-if="editType === 'meal'" class="form-group">
          <label class="form-label">Kategória</label>
          <select v-model="editForm.kategoraId" class="form-input">
            <option value="">Válassz kategóriát</option>
            <option v-for="k in kategoriak" :key="k.id" :value="k.id">{{ k.nev }}</option>
          </select>
        </div>

        <div v-if="editType === 'menu'" class="form-group">
          <label class="form-label">Készétel</label>
          <select v-model="editForm.keszetelId" class="form-input">
            <option value="">Válassz készételt</option>
            <option v-for="m in keszetelek" :key="m.id" :value="m.id">{{ m.nev }}</option>
          </select>
        </div>

        <div v-if="editType === 'menu'" class="form-group">
          <label class="form-label">Köret</label>
          <select v-model="editForm.koretId" class="form-input">
            <option value="">Válassz köretet</option>
            <option v-for="k in koretek" :key="k.id" :value="k.id">{{ k.nev }}</option>
          </select>
        </div>

        <div v-if="editType === 'menu'" class="form-group">
          <label class="form-label">Üdítő</label>
          <select v-model="editForm.uditoId" class="form-input">
            <option value="">Nincs ital</option>
            <option v-for="u in uditok" :key="u.id" :value="u.id">{{ u.nev }}</option>
          </select>
          <div class="help-text">A “Nincs ital” (NULL) az alapértelmezett.</div>
        </div>

        <div v-if="editType === 'meal' || editType === 'side' || editType === 'drink' || editType === 'menu'" class="form-group">
          <label class="form-label">Kép (base64)</label>
          <textarea
            v-model="editForm.kepBase64"
            class="form-input"
            rows="4"
            placeholder="data:image/png;base64,.... (optional)"
          />
          <div class="help-text">Ha üresen hagyod, üres kep mezőt küldünk (mint a curl -F 'kep=').</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" :disabled="saving" @click="closeEditModal">Mégse</button>
        <button class="btn-save" :disabled="saving" @click="saveEdit">{{ saving ? 'Mentés…' : 'Mentés' }}</button>
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

  .data-table {
    font-size: 0.875rem;
  }

  .data-table th,
  .data-table td {
    padding: 12px 8px;
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
  max-width: 720px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
}

.modal-title {
  font-size: 1.25rem;
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
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
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

.help-text {
  margin-top: 6px;
  font-size: 0.75rem;
  color: #6b7280;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 2px solid #e5e7eb;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 10px 18px;
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

.btn-save {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}
</style>
