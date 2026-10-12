import { useEffect, useState } from 'react';
import { teams } from './teams';
import type { Snapshot, TeamState } from './types';
const allowed = new Set(['active', 'sleeping', 'waiting', 'unknown']);
export function parseSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.teams) || typeof data.serverTime !== 'string') return null;
  const safe: TeamState[] = [];
  for (const raw of data.teams) {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (!teams.some(t => t.id === row.teamId) || typeof row.state !== 'string' || !allowed.has(row.state) || (row.updatedAt !== null && (typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt)))) || typeof row.source !== 'string') return null;
    safe.push({ teamId: row.teamId as string, state: row.state as TeamState['state'], updatedAt: row.updatedAt as string | null, source: row.source.slice(0, 24) });
  }
  return { teams: safe, serverTime: data.serverTime };
}
export function useActivity() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let alive = true;
    let streamAuthoritative = false;
    const controller = new AbortController();
    function receive(value: unknown) {
      const parsed = parseSnapshot(value);
      if (!alive || !parsed) return false;
      setSnapshot(parsed);
      setConnected(true);
      return true;
    }
    fetch('/api/state', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('Bridge unavailable'); return r.json(); }).then(value => {
      // The initial request can finish after a newer stream snapshot or error.
      // Once the stream reports its state, only it may change this connection.
      if (!streamAuthoritative) receive(value);
    }).catch(() => {
      // This one-shot request may fail after the stream has already connected.
      // Let stream errors report disconnection without discarding healthy SSE.
    });
    const stream = new EventSource('/api/events');
    stream.addEventListener('state', event => {
      try { if (receive(JSON.parse((event as MessageEvent).data))) streamAuthoritative = true; }
      catch { /* Ignore malformed bridge events. */ }
    });
    stream.onerror = () => { streamAuthoritative = true; if (alive) setConnected(false); };
    return () => { alive = false; controller.abort(); stream.close(); };
  }, []);
  return { snapshot, connected };
}
