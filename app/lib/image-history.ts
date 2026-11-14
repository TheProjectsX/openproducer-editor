export type ImageHistory<T> = {
  source: unknown;
  current: T | null;
  undo: T[];
  redo: T[];
};

export function createImageHistory<T>(): ImageHistory<T> {
  return { source: null, current: null, undo: [], redo: [] };
}

export function recordImageEdit<T>(history: ImageHistory<T>, source: unknown, snapshot: T): boolean {
  if (history.source !== source || history.current === null) {
    history.source = source; history.current = snapshot; history.undo = []; history.redo = [];
    return true;
  }
  if (JSON.stringify(history.current) === JSON.stringify(snapshot)) return false;
  history.undo = [...history.undo.slice(-99), history.current];
  history.redo = [];
  history.current = snapshot;
  return true;
}

export function undoImageEdit<T>(history: ImageHistory<T>): T | null {
  const previous = history.undo.pop();
  if (!previous || history.current === null) return null;
  history.redo.push(history.current);
  history.current = previous;
  return previous;
}

export function redoImageEdit<T>(history: ImageHistory<T>): T | null {
  const next = history.redo.pop();
  if (!next || history.current === null) return null;
  history.undo.push(history.current);
  history.current = next;
  return next;
}
