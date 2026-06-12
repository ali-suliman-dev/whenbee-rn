import Constants, { ExecutionEnvironment } from 'expo-constants';
export function computeIsExpoGo(env: string | undefined): boolean {
  return env === ExecutionEnvironment.StoreClient;
}
export const isExpoGo = computeIsExpoGo(Constants.executionEnvironment);
