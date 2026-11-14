import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { useEffect, useRef, useState } from "react";

import type { Route } from "./+types/root";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const siteUrl = import.meta.env.VITE_SITE_URL?.replace(/\/$/, "");
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4e5fd0" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {siteUrl && <link rel="canonical" href={`${siteUrl}${location.pathname}`} />}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const applyUpdateRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    const timers = new Set<number>();
    const discoverWaitingWorker = () => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
          waitingWorkerRef.current = registration.waiting;
          setUpdateReady(true);
        }
      }, 0);
      timers.add(timer);
    };
    const onUpdateFound = () => {
      const installing = registration?.installing;
      installing?.addEventListener("statechange", () => { if (installing.state === "installed") discoverWaitingWorker(); });
    };
    const onControllerChange = () => {
      if (applyUpdateRef.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.register("/sw.js").then((nextRegistration) => {
      if (disposed) return;
      registration = nextRegistration;
      registration.addEventListener("updatefound", onUpdateFound);
      discoverWaitingWorker();
    }).catch((error: unknown) => {
      console.error("Local Studio could not register its offline worker.", error);
    });
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  function applyUpdate() {
    const worker = waitingWorkerRef.current;
    if (!worker || applyingUpdate) return;
    applyUpdateRef.current = true; setApplyingUpdate(true);
    worker.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => { if (applyUpdateRef.current) window.location.reload(); }, 4_000);
  }

  return <>
    {updateReady && <aside className="update-banner" role="status"><span>A Local Studio update is ready. Save or finish active edits before reloading.</span><button type="button" disabled={applyingUpdate} onClick={applyUpdate}>{applyingUpdate ? "Applying update…" : "Reload to update"}</button></aside>}
    <Outlet />
  </>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
