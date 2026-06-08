import { spawn, ChildProcess } from "child_process";
import path from "path";
import { boardToFen, parsePikafishMove } from "@/lib/ai/fen";
import { Board, Color, Move } from "@/lib/game/types";

// ─── Types ─────────────────────────────────────────────────────

export interface PikafishConfig {
  binaryPath?: string;
  skillLevel?: number;   // 0–20 (0=weakest, 20=full)
  moveTime?: number;      // ms
  depth?: number;         // plies (overrides moveTime)
  hashSize?: number;      // MB, default 64
  threads?: number;       // default 1
}

export interface PikafishResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  pv: string[];
  fromBook: boolean;
}

export interface MultiPVEntry {
  move: Move | null;
  score: number;
  depth: number;
  pv: string[];
  multipv: number; // 1=best, 2=second, 3=third
}

export interface MultiPVResult {
  entries: MultiPVEntry[];
  bestMove: Move | null;
  nodes: number;
  timeMs: number;
}

// ─── Queued command ────────────────────────────────────────────

interface QCmd {
  line: string;
  resolve: (s: string) => void;
  reject: (e: Error) => void;
  marker: string | null;   // "bestmove"|"uciok"|"readyok"|null→settle
  settleMs: number;
  accum: string;
  lastDataAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

// ─── Engine ────────────────────────────────────────────────────

class PikafishEngine {
  private proc: ChildProcess | null = null;
  private ready = false;
  private booting: Promise<void> | null = null;
  private queue: QCmd[] = [];
  private active: QCmd | null = null;
  private bin: string;
  private _nnueDir: string = "";
  private _searchId = 0;

  constructor() {
    this.bin = process.env.PIKAFISH_PATH ?? "pikafish";
  }

  // ── Debug logging ────────────────────────────────────────────

  /** Log a debug line with ISO timestamp and consistent prefix for easy filtering. */
  private _d(label: string, msg: string): void {
    const ts = new Date().toISOString();
    console.log("[pikafish:" + label + "] [" + ts + "] " + msg);
  }

  /** Log raw engine output lines — printed via process.stdout.write
   *  to avoid extra formatting that console.log adds. */
  private _logRaw(chunk: string): void {
    const ts = new Date().toISOString();
    // Split into lines and prefix each one
    const lines = chunk.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        process.stdout.write("[pikafish:uci] [" + ts + "] " + trimmed + "\n");
      }
    }
  }

  // ── Public ───────────────────────────────────────────────────

  async search(board: Board, color: Color, cfg: PikafishConfig = {}): Promise<PikafishResult> {
    await this._ensure();

    this._searchId++;
    const sid = this._searchId;
    const sl = cfg.skillLevel ?? 20;
    const hash = cfg.hashSize ?? 64;
    const th = cfg.threads ?? 1;
    const mt = cfg.moveTime ?? 3000;

    this._d("search", "=== SEARCH #" + sid + " START ===");
    this._d("search", "color=" + color + " skillLevel=" + sl + " hash=" + hash + "MB threads=" + th + " moveTime=" + mt + "ms" + (cfg.depth ? " depth=" + cfg.depth : ""));

    await this._cmd("setoption name Skill Level value " + sl, null, 150);
    await this._cmd("setoption name Hash value " + hash, null, 150);
    await this._cmd("setoption name Threads value " + th, null, 150);

    const fen = boardToFen(board, color);
    this._d("search", "FEN: " + fen);

    await this._cmd("position fen " + fen, null, 150);

    const go = cfg.depth ? "go depth " + cfg.depth : "go movetime " + mt;
    const safetyMs = mt + 10000;
    this._d("search", "GO cmd: " + go + " (safety timeout=" + safetyMs + "ms)");

    const out = await this._cmd(go, "bestmove", 0, safetyMs);

    const result = this._parse(out, board, sid);

    // Structured summary log — easy to grep and analyze
    this._d("result", "=== SEARCH #" + sid + " RESULT ===");
    this._d("result",
      "bestmove=" + (result.move
        ? "(" + result.move.from.row + "," + result.move.from.col + ")->(" + result.move.to.row + "," + result.move.to.col + ")"
        : "null") +
      " score=" + result.score +
      " depth=" + result.depth +
      " nodes=" + result.nodes +
      " time=" + result.timeMs + "ms" +
      " pv=[" + result.pv.join(",") + "]"
    );
    this._d("search", "=== SEARCH #" + sid + " END ===");

    return result;
  }

  /**
   * MultiPV search: returns the top 3 best moves with individual scores.
   * Sets MultiPV=3 before searching and resets to 1 afterwards.
   */
  async searchMultiPV(
    board: Board,
    color: Color,
    cfg: PikafishConfig = {}
  ): Promise<MultiPVResult> {
    await this._ensure();

    this._searchId++;
    const sid = this._searchId;
    const sl = cfg.skillLevel ?? 20;
    const hash = cfg.hashSize ?? 64;
    const th = cfg.threads ?? 1;
    const mt = cfg.moveTime ?? 3000;

    this._d("search", "=== MULTIPV SEARCH #" + sid + " START ===");
    this._d("search", "color=" + color + " skillLevel=" + sl + " moveTime=" + mt + "ms");

    await this._cmd("setoption name Skill Level value " + sl, null, 150);
    await this._cmd("setoption name Hash value " + hash, null, 150);
    await this._cmd("setoption name Threads value " + th, null, 150);
    await this._cmd("setoption name MultiPV value 3", null, 150);

    const fen = boardToFen(board, color);
    this._d("search", "FEN: " + fen);
    await this._cmd("position fen " + fen, null, 150);

    const go = cfg.depth ? "go depth " + cfg.depth : "go movetime " + mt;
    const safetyMs = mt + 10000;
    this._d("search", "GO cmd: " + go + " (safety timeout=" + safetyMs + "ms)");

    const out = await this._cmd(go, "bestmove", 0, safetyMs);

    // Reset MultiPV back to 1 after search
    await this._cmd("setoption name MultiPV value 1", null, 150);

    const result = this._parseMultiPV(out, board, sid);
    this._d("result", "=== MULTIPV SEARCH #" + sid + " RESULT: " + result.entries.length + " entries, best=" + (result.bestMove ? "(" + result.bestMove.from.row + "," + result.bestMove.from.col + ")->(" + result.bestMove.to.row + "," + result.bestMove.to.col + ")" : "null"));
    this._d("search", "=== MULTIPV SEARCH #" + sid + " END ===");

    return result;
  }

  /**
   * Analyze a position at a fixed depth and return the evaluation score.
   * Used for game review to assess each move.
   */
  async analyze(
    board: Board,
    color: Color,
    depth: number = 12
  ): Promise<{ score: number; bestMove: Move | null; depth: number; pv: string[] }> {
    await this._ensure();

    this._searchId++;
    const sid = this._searchId;

    this._d("analyze", "=== ANALYZE #" + sid + " depth=" + depth + " color=" + color + " ===");

    await this._cmd("setoption name Hash value 64", null, 150);
    await this._cmd("setoption name Threads value 1", null, 150);

    const fen = boardToFen(board, color);
    await this._cmd("position fen " + fen, null, 150);

    const go = "go depth " + depth;
    const safetyMs = 30000; // 30s timeout
    const out = await this._cmd(go, "bestmove", 0, safetyMs);

    const result = this._parse(out, board, sid);
    this._d("analyze", "=== ANALYZE #" + sid + " score=" + result.score + " depth=" + result.depth + " ===");

    return {
      score: result.score,
      bestMove: result.move,
      depth: result.depth,
      pv: result.pv,
    };
  }

  async newGame(): Promise<void> {
    if (!this.proc || !this.ready) return;
    await this._cmd("ucinewgame", null, 150);
  }

  async probe(): Promise<boolean> {
    try { await this._ensure(); return true; } catch { return false; }
  }

  async quit(): Promise<void> {
    if (this.proc) {
      try { await this._cmd("quit", null, 100); } catch { /* ok */ }
      this.proc.kill();
      this.proc = null;
    }
    this.ready = false;
    this.booting = null;
    this.queue = [];
    this.active = null;
  }

  // ── Private: command queue ───────────────────────────────────

  private _cmd(line: string, marker: string | null, settleMs: number, timeoutMs = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd: QCmd = { line, resolve, reject, marker, settleMs, accum: "", lastDataAt: 0, timer: null };
      this.queue.push(cmd);
      // Safety timeout: reject if command never resolves
      if (timeoutMs > 0) {
        const safety = setTimeout(() => {
          if (this.active === cmd) {
            this._d("err", "TIMEOUT waiting for '" + line.slice(0, 40) + "'");
            this._done(new Error("Pikafish timeout on: " + line.slice(0, 40)));
          }
        }, timeoutMs);
        // Don't leak the timer — wrap resolve/reject
        const origResolve = cmd.resolve;
        const origReject = cmd.reject;
        cmd.resolve = (s: string) => { clearTimeout(safety); origResolve(s); };
        cmd.reject = (e: Error) => { clearTimeout(safety); origReject(e); };
      }
      this._pump();
    });
  }

  private _pump(): void {
    if (this.active) return;
    const next = this.queue.shift();
    if (!next) return;

    this.active = next;

    if (!this.proc?.stdin) {
      this._done(new Error("Engine not running"));
      return;
    }

    this._d("cmd", "> " + next.line.slice(0, 80));
    try {
      this.proc.stdin.write(next.line + "\n");
    } catch (err: unknown) {
      this._d("err", "stdin write error: " + (err instanceof Error ? err.message : String(err)));
      this._done(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (next.marker === null && next.settleMs > 0) {
      this._armSettle(next);
    }
  }

  private _armSettle(cmd: QCmd): void {
    const check = () => {
      if (this.active !== cmd) return;
      const elapsed = Date.now() - (cmd.lastDataAt || Date.now());
      if (elapsed >= cmd.settleMs) {
        this._done(null, cmd.accum);
      } else {
        cmd.timer = setTimeout(check, cmd.settleMs - elapsed + 20);
      }
    };
    cmd.lastDataAt = Date.now();
    cmd.timer = setTimeout(check, cmd.settleMs + 20);
  }

  private _onData(chunk: string): void {
    // Always log raw UCI output for analysis
    this._logRaw(chunk);

    if (!this.active) return;
    this.active.accum += chunk;
    this.active.lastDataAt = Date.now();

    if (this.active.marker && this.active.accum.includes(this.active.marker)) {
      this._d("cmd", "marker '" + this.active.marker + "' found, resolving");
      this._done(null, this.active.accum);
    }
  }

  private _done(err?: Error | null, result?: string): void {
    if (!this.active) return;
    const cmd = this.active;
    this.active = null;
    if (cmd.timer) clearTimeout(cmd.timer);
    const cmdShort = cmd.line.slice(0, 50);
    if (err) {
      this._d("err", "FAILED cmd='" + cmdShort + "' err=" + err.message);
    } else {
      this._d("cmd", "OK cmd='" + cmdShort + "' accum=" + (result?.length ?? 0) + " chars");
    }
    if (err) cmd.reject(err);
    else cmd.resolve(result ?? cmd.accum);
    this._pump();
  }

  // ── Private: lifecycle ───────────────────────────────────────

  private async _ensure(): Promise<void> {
    if (this.ready && this.proc && !this.proc.killed) return;
    if (this.booting) { await this.booting; if (this.ready) return; }
    this.booting = this._boot();
    await this.booting;
  }

  private async _boot(): Promise<void> {
    if (this.proc) { this.proc.kill(); this.proc = null; }

    // Resolve absolute path; set cwd to the Pikafish root so it finds pikafish.nnue
    const absBin = path.resolve(this.bin);
    const nnueDir = path.dirname(path.dirname(absBin)); // up from Windows/ → Pikafish root
    this._nnueDir = nnueDir;

    this.proc = spawn(absBin, [], { stdio: ["pipe", "pipe", "pipe"], cwd: nnueDir });
    this.ready = false;
    this.queue = [];
    this.active = null;

    this.proc.stdout?.on("data", (buf: Buffer) => this._onData(buf.toString()));
    this.proc.stderr?.on("data", (buf: Buffer) => this._d("stderr", buf.toString().trim()));

    this.proc.on("error", (err) => {
      this._d("err", "process error: " + err.message);
      this.ready = false;
      this._done(err);
    });

    this.proc.on("close", (code) => {
      this._d("lifecycle", "exit code=" + code);
      this.ready = false;
      this.proc = null;
      if (this.active) this._done(new Error("Pikafish closed (code " + code + ")"));
    });

    this._d("lifecycle", "booting engine at " + absBin + " (cwd=" + nnueDir + ")");
    await this._cmd("uci", "uciok", 0);

    // Must set EvalFile BEFORE isready — Pikafish loads the NNUE during isready
    const nnuePath = path.join(nnueDir, "pikafish.nnue");
    this._d("lifecycle", "setting EvalFile=" + nnuePath);
    await this._cmd("setoption name EvalFile value " + nnuePath, null, 150);

    await this._cmd("isready", "readyok", 0);
    this._d("lifecycle", "engine ready");
    this.ready = true;
  }

  // ── Private: parse ───────────────────────────────────────────

  private _parse(output: string, board: Board, sid: number): PikafishResult {
    const lines = output.split("\n").map(l => l.trim());
    let best = "";
    let score = 0, depth = 0, nodes = 0, timeMs = 0;
    const pv: string[] = [];
    let infoLineCount = 0;

    for (const line of lines) {
      if (line.startsWith("bestmove")) best = line.split(/\s+/)[1] ?? "";

      // Also match mate scores: "score mate N"
      const mCp = line.match(
        /^info\s+depth\s+(\d+).*?\bscore\s+cp\s+(-?\d+).*?\bnodes\s+(\d+).*?\btime\s+(\d+).*?\bpv\s+(.+)$/
      );
      if (mCp) {
        infoLineCount++;
        depth = +mCp[1]; score = +mCp[2]; nodes = +mCp[3]; timeMs = +mCp[4];
        pv.length = 0;
        pv.push(...mCp[5].split(/\s+/).filter(Boolean));
        // Log the last (deepest) info line for each depth reached
        this._d("info", "depth=" + depth + " cp=" + score + " nodes=" + nodes + " time=" + timeMs + "ms pv=[" + pv.join(",") + "]");
        continue;
      }

      // Match mate scores
      const mMate = line.match(
        /^info\s+depth\s+(\d+).*?\bscore\s+mate\s+(-?\d+).*?\bnodes\s+(\d+).*?\btime\s+(\d+).*?\bpv\s+(.+)$/
      );
      if (mMate) {
        infoLineCount++;
        depth = +mMate[1];
        const matePly = +mMate[2]; // positive = engine mates, negative = engine mated
        // Encode as 99999 - abs(matePly), negated for the losing side
        if (matePly > 0) {
          score = 99_999 - matePly;
        } else {
          score = -(99_999 - Math.abs(matePly));
        }
        nodes = +mMate[3]; timeMs = +mMate[4];
        pv.length = 0;
        pv.push(...mMate[5].split(/\s+/).filter(Boolean));
        this._d("info", "depth=" + depth + " mate=" + mMate[2] + " (encoded=" + score + ") nodes=" + nodes + " time=" + timeMs + "ms pv=[" + pv.join(",") + "]");
      }
    }

    this._d("parse", "total info lines: " + infoLineCount + ", final depth=" + depth + " score=" + score);

    let move: Move | null = null;
    if (best && best !== "(none)") {
      const p = parsePikafishMove(best);
      if (p) {
        const cap = board[p.to.row]?.[p.to.col] ?? null;
        move = { from: p.from, to: p.to, captured: cap ? { type: cap.type, color: cap.color } : null };
        this._d("parse", "bestmove=" + best + " -> (" + p.from.row + "," + p.from.col + ")->(" + p.to.row + "," + p.to.col + ") captured=" + (cap ? cap.type : "none"));
      } else {
        this._d("parse", "WARN: parsePikafishMove returned null for bestmove=" + best);
      }
    } else {
      this._d("parse", "WARN: no valid bestmove found (best='" + best + "')");
    }

    return { move, score, depth, nodes, timeMs, pv, fromBook: false };
  }

  private _parseMultiPV(output: string, board: Board, sid: number): MultiPVResult {
    const lines = output.split("\n").map(l => l.trim());
    let best = "";
    let nodes = 0;
    let timeMs = 0;

    // Collect info lines grouped by multipv
    const byPV = new Map<number, { score: number; depth: number; pv: string[] }>();

    for (const line of lines) {
      if (line.startsWith("bestmove")) {
        best = line.split(/\s+/)[1] ?? "";
        continue;
      }

      // Match multipv info lines: "info depth N seldepth N multipv N score cp N ... pv ..."
      const mMultiPV = line.match(
        /^info\s+depth\s+(\d+).*?\bmultipv\s+(\d+)\s+score\s+(cp|mate)\s+(-?\d+).*?\bnodes\s+(\d+).*?\btime\s+(\d+).*?\bpv\s+(.+)$/
      );
      if (mMultiPV) {
        const mpv = +mMultiPV[2];
        let score: number;
        if (mMultiPV[3] === "mate") {
          const matePly = +mMultiPV[4];
          score = matePly > 0 ? 99_999 - matePly : -(99_999 - Math.abs(matePly));
        } else {
          score = +mMultiPV[4];
        }
        const depth = +mMultiPV[1];
        nodes = +mMultiPV[5];
        timeMs = +mMultiPV[6];
        const pv = mMultiPV[7].split(/\s+/).filter(Boolean);

        byPV.set(mpv, { score, depth, pv });
        this._d("info", "multipv=" + mpv + " depth=" + depth + " score=" + score + " nodes=" + nodes + " time=" + timeMs + "ms pv=[" + pv.join(",") + "]");
        continue;
      }

      // Fallback: non-multipv info lines (engine may send both)
      const mCp = line.match(
        /^info\s+depth\s+(\d+).*?\bscore\s+cp\s+(-?\d+).*?\bnodes\s+(\d+).*?\btime\s+(\d+).*?\bpv\s+(.+)$/
      );
      if (mCp && !byPV.has(1)) {
        byPV.set(1, { score: +mCp[2], depth: +mCp[1], pv: mCp[5].split(/\s+/).filter(Boolean) });
        nodes = +mCp[3];
        timeMs = +mCp[4];
      }
    }

    // Build entries sorted by multipv
    const entries: MultiPVEntry[] = [];
    for (const [mpv, info] of [...byPV.entries()].sort((a, b) => a[0] - b[0])) {
      const pvMoves = info.pv;
      let move: Move | null = null;
      if (pvMoves.length > 0) {
        const p = parsePikafishMove(pvMoves[0]);
        if (p) {
          const cap = board[p.to.row]?.[p.to.col] ?? null;
          move = { from: p.from, to: p.to, captured: cap ? { type: cap.type, color: cap.color } : null };
        }
      }
      entries.push({
        move,
        score: info.score,
        depth: info.depth,
        pv: pvMoves,
        multipv: mpv,
      });
    }

    // Parse bestmove
    let bestMove: Move | null = null;
    if (best && best !== "(none)") {
      const p = parsePikafishMove(best);
      if (p) {
        const cap = board[p.to.row]?.[p.to.col] ?? null;
        bestMove = { from: p.from, to: p.to, captured: cap ? { type: cap.type, color: cap.color } : null };
      }
    }

    return { entries, bestMove, nodes, timeMs };
  }
}

// ─── Singleton ─────────────────────────────────────────────────

let instance: PikafishEngine | null = null;

export function getPikafishEngine(): PikafishEngine {
  if (!instance) instance = new PikafishEngine();
  return instance;
}

export { PikafishEngine };
