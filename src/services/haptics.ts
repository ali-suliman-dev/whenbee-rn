// Canonical impl lives in src/lib/haptics.ts so UI primitives can import it
// without crossing the services/db boundary. Re-exported here for store/feature
// code that reaches haptics through the services layer.
export { haptics } from '@/src/lib/haptics';
