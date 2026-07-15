import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface LogEntry {
  tool: string;
  type: 'session_start' | 'session_end' | 'prompt';
  timestamp: string;
  text?: string;
}

const LOG_PATH = resolve(__dirname, '../docs/dev-log.jsonl');
const OUT_PATH = resolve(__dirname, '../public/stats.json');

// Source-code line count, not project size — asset files (images, audio,
// fonts) dwarf the code in byte count and would make "how much was written"
// meaningless, so only text source extensions are walked and counted.
const CODE_ROOTS = ['src', 'scripts'];
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function countLinesOfCode(root: string): { files: number; lines: number } {
  let files = 0;
  let lines = 0;

  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (CODE_EXTENSIONS.has(extname(entry))) {
        files += 1;
        lines += readFileSync(full, 'utf-8').split('\n').length;
      }
    }
  };

  walk(resolve(__dirname, '..', root));
  return { files, lines };
}

function aggregateCode(): { files: number; lines: number } {
  return CODE_ROOTS.reduce(
    (acc, root) => {
      const r = countLinesOfCode(root);
      return { files: acc.files + r.files, lines: acc.lines + r.lines };
    },
    { files: 0, lines: 0 },
  );
}

function readEntries(): LogEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogEntry);
}

function aggregate(entries: LogEntry[]) {
  // Claude Code's "Stop" hook (logged as session_end) fires at the end of
  // every turn, not just when the session truly ends — so a session can
  // produce many session_end lines per session_start. We track the latest
  // end seen and only fold it into hours once a new session_start (or EOF)
  // closes the window, rather than pairing the first start with the first end.
  const byTool: Record<string, { hours: number; prompts: number; pendingStart?: number; lastEnd?: number }> = {};

  const closeSession = (bucket: { hours: number; pendingStart?: number; lastEnd?: number }) => {
    if (bucket.pendingStart !== undefined && bucket.lastEnd !== undefined) {
      bucket.hours += (bucket.lastEnd - bucket.pendingStart) / 3_600_000;
    }
    bucket.pendingStart = undefined;
    bucket.lastEnd = undefined;
  };

  for (const entry of entries) {
    if (!byTool[entry.tool]) byTool[entry.tool] = { hours: 0, prompts: 0 };
    const bucket = byTool[entry.tool];
    const t = new Date(entry.timestamp).getTime();

    if (entry.type === 'session_start') {
      closeSession(bucket);
      bucket.pendingStart = t;
    } else if (entry.type === 'session_end' && bucket.pendingStart !== undefined) {
      bucket.lastEnd = t;
    } else if (entry.type === 'prompt') {
      bucket.prompts += 1;
    }
  }

  for (const bucket of Object.values(byTool)) closeSession(bucket);

  const cleaned: Record<string, { hours: number; prompts: number }> = {};
  let totalHours = 0;
  let totalPrompts = 0;
  for (const [tool, { hours, prompts }] of Object.entries(byTool)) {
    cleaned[tool] = { hours: Math.round(hours * 100) / 100, prompts };
    totalHours += hours;
    totalPrompts += prompts;
  }

  const code = aggregateCode();

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalPrompts,
    byTool: cleaned,
    codeFiles: code.files,
    codeLines: code.lines,
    lastUpdated: new Date().toISOString(),
  };
}

const stats = aggregate(readEntries());
mkdirSync(resolve(__dirname, '../public'), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(stats, null, 2));
console.log(`Wrote ${OUT_PATH}`);
console.log(stats);
