import { useEffect, useState, type ReactNode } from 'react';

interface RouteProps {
  path: string;
  children: ReactNode;
}

interface RouterProps {
  children: ReactNode;
}

const normalizePath = (path: string) => (path === '/index.html' ? '/' : path);

export function Router({ children }: RouterProps) {
  const [currentPath, setCurrentPath] = useState(normalizePath(window.location.pathname));

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', handleLocationChange);

    window.addEventListener('navigate', handleLocationChange as EventListener);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('navigate', handleLocationChange as EventListener);
    };
  }, []);

  const matchedRoute = findMatchingRoute(children, currentPath);

  return <>{matchedRoute}</>;
}

export function Route({ path: _path, children }: RouteProps) {
  return <>{children}</>;
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('navigate'));
}

function findMatchingRoute(children: ReactNode, currentPath: string): ReactNode {
  let matchedRoute: ReactNode = null;

  const childArray = Array.isArray(children) ? children : [children];

  for (const child of childArray) {
    if (!child || typeof child !== 'object' || !('type' in child)) continue;
    
    const props = (child as any).props;
    if (!props?.path) continue;

    if (props.path === currentPath) {
      matchedRoute = props.children;
      break;
    }

    if (props.path.endsWith('*')) {
      const basePath = props.path.slice(0, -1);
      if (currentPath.startsWith(basePath)) {
        matchedRoute = props.children;
        break;
      }
    }
  }

  return matchedRoute;
}
