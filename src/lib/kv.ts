import { Storage } from 'expo-sqlite/kv-store';
export const kv = {
  set: (key: string, value: string) => Storage.setItemSync(key, value),
  getString: (key: string): string | null => Storage.getItemSync(key),
  delete: (key: string) => Storage.removeItemSync(key),
};
export const zustandKv = {
  getItem: (name: string) => Storage.getItemSync(name),
  setItem: (name: string, value: string) => Storage.setItemSync(name, value),
  removeItem: (name: string) => Storage.removeItemSync(name),
};
