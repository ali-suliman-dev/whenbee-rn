import { ensureNotificationPermission } from '@/src/services/timerNotifications';

const mockReq = jest.fn(async () => ({ granted: true }));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('@/src/lib/isExpoGo', () => ({ isExpoGo: false }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: (...args: Parameters<typeof mockReq>) => mockReq(...args),
}));

beforeEach(() => mockReq.mockClear());

it('requests provisional quietly when asked', async () => {
  await ensureNotificationPermission({ provisional: true });
  expect(mockReq).toHaveBeenCalledWith({ ios: { allowProvisional: true } });
});

it('requests full permission by default', async () => {
  await ensureNotificationPermission();
  expect(mockReq).toHaveBeenCalledWith();
});
