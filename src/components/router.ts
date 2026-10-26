import { useEffect, useState } from 'react';

export interface Route {
  name: 'sim' | 'dashboard' | 'register' | 'issue' | 'actions' | 'learning' | 'video';
  param?: string;
}

export const parseHash = (hash: string): Route => {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const name = parts[0] as Route['name'];
  if (name === 'issue' && parts[1]) return { name, param: decodeURIComponent(parts[1]) };
  if (['dashboard', 'register', 'actions', 'learning', 'sim', 'video'].includes(name)) return { name };
  return { name: 'sim' };
};

export const useRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
};

export const issueHref = (id: string): string => `#/issue/${encodeURIComponent(id)}`;
