import { useContext } from 'react';
import { SessionContext } from '@/context/SessionContext';

/** The current user, fetched once by {@link SessionProvider} and shared. */
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return context;
}
