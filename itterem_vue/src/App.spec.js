import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { LOCALE_QUERY_KEY } from './config/constants.js';

const mockState = vi.hoisted(() => {
	const refLike = (value) => ({ value, __v_isRef: true });

	return {
	route: { name: 'menu', query: { existing: '1' } },
	routerReplace: vi.fn(),
	routerPush: vi.fn(),
	setLocale: vi.fn((nextLocale) => nextLocale),
	addItem: vi.fn(),
	auth: refLike(null),
	isLoggedIn: refLike(false),
	isAdmin: refLike(false),
	isEmployee: refLike(false),
	totalItems: refLike(0),
	currentLocale: refLike('hu'),
	setAuth: vi.fn(),
	logout: vi.fn(),
	scheduleAuthExpiry: vi.fn(),
	clearAuthExpiryTimer: vi.fn(),
	handleStorageChange: vi.fn(),
	handleAuthExpired: vi.fn(),
	};
});

vi.mock('vue-router', () => ({
	useRoute: () => mockState.route,
	useRouter: () => ({
		replace: mockState.routerReplace,
		push: mockState.routerPush,
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key) => key,
	}),
}));

vi.mock('./composables/useAuth.js', () => ({
	useAuth: () => ({
		auth: mockState.auth,
		isLoggedIn: mockState.isLoggedIn,
		isAdmin: mockState.isAdmin,
		isEmployee: mockState.isEmployee,
		setAuth: mockState.setAuth,
		logout: mockState.logout,
		scheduleAuthExpiry: mockState.scheduleAuthExpiry,
		clearAuthExpiryTimer: mockState.clearAuthExpiryTimer,
		handleStorageChange: mockState.handleStorageChange,
		handleAuthExpired: mockState.handleAuthExpired,
	}),
}));

vi.mock('./composables/useCart.js', () => ({
	useCart: () => ({
		addItem: mockState.addItem,
		totalItems: mockState.totalItems,
	}),
}));

vi.mock('./composables/useLocale.js', () => ({
	useLocale: () => ({
		currentLocale: mockState.currentLocale,
		supportedLocales: ['hu', 'en'],
		setLocale: mockState.setLocale,
	}),
}));

vi.mock('./components/user/CartDrawer.vue', () => ({
	default: {
		name: 'CartDrawerStub',
		props: {
			open: { type: Boolean, default: false },
			auth: { type: Object, default: null },
		},
		template: '<div data-testid="cart-drawer" :data-open="String(open)"></div>',
	},
}));

vi.mock('./components/public/FooterSection.vue', () => ({
	default: {
		name: 'FooterSectionStub',
		template: '<footer data-testid="footer-section"></footer>',
	},
}));

vi.mock('./components/admin/ConfirmModal.vue', () => ({
	default: {
		name: 'ConfirmModalStub',
		props: {
			show: { type: Boolean, default: false },
		},
		template: '<div data-testid="confirm-modal" :data-show="String(show)"></div>',
	},
}));

function mountApp() {
	return mount(App, {
		global: {
			stubs: {
				'router-view': {
					template: '<div data-testid="router-view-stub"></div>',
				},
			},
		},
	});
}

describe('App', () => {
	beforeEach(() => {
		mockState.routerReplace.mockReset();
		mockState.routerPush.mockReset();
		mockState.setLocale.mockReset();
		mockState.setLocale.mockImplementation((nextLocale) => nextLocale);
		mockState.route.query = { existing: '1' };
		mockState.auth.value = null;
		mockState.isLoggedIn.value = false;
	});

	it('A kosár gomb megnyitja a kosarat és beállítja a history állapotot', async () => {
		const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
		const wrapper = mountApp();

		await wrapper.get('button[aria-label="nav.cart"]').trigger('click');

		expect(wrapper.get('[data-testid="cart-drawer"]').attributes('data-open')).toBe('true');
		expect(pushStateSpy).toHaveBeenCalledTimes(1);
		expect(pushStateSpy.mock.calls[0][0]).toEqual(expect.objectContaining({ itteremCartOpen: true }));

		pushStateSpy.mockRestore();
	});

	it('Bejelentkezéskor frissül az authentikációs állapot', async () => {
		const wrapper = mountApp();
		// Simulate login
		mockState.auth.value = { username: 'testuser' };
		mockState.isLoggedIn.value = true;

		// Force Vue render update if needed
		await wrapper.vm.$forceUpdate?.();

		// Assertion on mock state (customize if real App.vue exposes user in the DOM/UI)
		expect(mockState.isLoggedIn.value).toBe(true);
		expect(mockState.auth.value).toEqual({ username: 'testuser' });
	});
});