import { Board, Color, Move, PieceType, oppositeColor } from "@/lib/game/types";
import { cloneBoard, getPieceAt } from "@/lib/game/board";
import { applyMove } from "@/lib/game/moves";
import { getAllLegalMoves, isInCheck, isCheckmate, isStalemate } from "@/lib/game/rules";
import { evaluate } from "./evaluate";
import { computeHash } from "./zobrist";
import { transpositionTable } from "./transposition";

export interface SearchResult {
  move: Move | null;
  score: number;
  nodesSearched: number;
  depthReached: number;
}

/**
 * Check if a score represents a forced mate.
 * Mate scores are encoded as: MATE_SCORE ± ply
 * where MATE_SCORE = 99_999.
 */
const MATE_THRESHOLD = 99_000;

export function isMateScore(score: number): boolean {
  return Math.abs(score) >= MATE_THRESHOLD;
}

/**
 * Get the number of plies to mate from a mate score.
 * Returns 0 if the score is not a mate score.
 *
 * Score encoding: 99_999 - ply for the winning side,
 *                 -(99_999 - ply) for the losing side.
 * The ply counts from the current position to mate.
 */
export function mateDistance(score: number): number {
  if (!isMateScore(score)) return 0;
  return 99_999 - Math.abs(score);
}

/**
 * Get mate-in-N (number of full moves, not plies).
 * e.g. mate in 1 full move = mate in 1 ply (the current side)
 */
export function mateInMoves(score: number): number {
  const plies = mateDistance(score);
  // Convert plies to full moves (ceiling division by 2)
  // A ply of 1 means mate on the very next half-move = mate in 1
  return Math.ceil(plies / 2);
}

interface SearchConfig {
  maxDepth: number;
  timeLimitMs: number;
}

// Killer moves heuristic (2 slots per depth)
const killerMoves: Map<number, [Move | null, Move | null]> = new Map();

// History heuristic table
const historyTable: Map<string, number> = new Map();
const MAX_HISTORY = 1 << 20;

function historyKey(move: Move): string {
  return `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
}

function recordHistory(move: Move, depth: number): void {
  const key = historyKey(move);
  const val = (historyTable.get(key) ?? 0) + depth * depth;
  historyTable.set(key, val);
  if (historyTable.size > MAX_HISTORY) historyTable.clear();
}

function getHistoryScore(move: Move): number {
  return historyTable.get(historyKey(move)) ?? 0;
}

// ─── Move ordering ─────────────────────────────────────────────

function scoreMove(move: Move, ply: number, hashMove: Move | null): number {
  // Hash move (from transposition table) gets highest priority
  if (
    hashMove &&
    move.from.row === hashMove.from.row &&
    move.from.col === hashMove.from.col &&
    move.to.row === hashMove.to.row &&
    move.to.col === hashMove.to.col
  ) {
    return 1_000_000;
  }

  // MVV-LVA: Most Valuable Victim — Least Valuable Attacker
  let score = 0;
  if (move.captured) {
    score += pieceOrder(move.captured.type) * 1_000;
  }

  // Killer moves get a bonus
  const killers = killerMoves.get(ply);
  if (killers) {
    if (killers[0] && movesEqual(move, killers[0])) score += 900;
    else if (killers[1] && movesEqual(move, killers[1])) score += 800;
  }

  // History heuristic
  score += Math.min(getHistoryScore(move), 500);

  return score;
}

function pieceOrder(type: PieceType): number {
  const order: Record<PieceType, number> = {
    [PieceType.General]: 0,
    [PieceType.Soldier]: 1,
    [PieceType.Advisor]: 2,
    [PieceType.Elephant]: 3,
    [PieceType.Horse]: 4,
    [PieceType.Cannon]: 5,
    [PieceType.Chariot]: 6,
  };
  return order[type] ?? 0;
}

function movesEqual(a: Move, b: Move): boolean {
  return (
    a.from.row === b.from.row &&
    a.from.col === b.from.col &&
    a.to.row === b.to.row &&
    a.to.col === b.to.col
  );
}

function recordKiller(move: Move, ply: number): void {
  const killers = killerMoves.get(ply) ?? [null, null];
  if (!killers[0] || !movesEqual(move, killers[0])) {
    killers[1] = killers[0];
    killers[0] = move;
  }
  killerMoves.set(ply, killers as [Move | null, Move | null]);
}

// ─── Quiescence Search ─────────────────────────────────────────

const MAX_QUIESCE_DEPTH = 8; // Prevent runaway capture sequences

function quiesce(
  board: Board,
  alpha: number,
  beta: number,
  color: Color,
  nodes: { count: number },
  qDepth: number = 0,
  startTime: number = 0,
  timeLimitMs: number = Infinity
): number {
  // Time check: abort if over time limit
  if (nodes.count % 256 === 0 && startTime > 0 && Date.now() - startTime > timeLimitMs) {
    return color === Color.Red ? evaluate(board) : -evaluate(board);
  }

  // Max depth guard
  if (qDepth >= MAX_QUIESCE_DEPTH) {
    return color === Color.Red ? evaluate(board) : -evaluate(board);
  }

  nodes.count++;

  const standPat = color === Color.Red ? evaluate(board) : -evaluate(board);

  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  // Only search capture moves in quiescence
  const allMoves = getAllLegalMoves(board, color);
  const captures = allMoves.filter((m) => m.captured !== null);

  if (captures.length > 0) {
    captures.sort((a, b) => {
      const aVal = pieceOrder(a.captured!.type);
      const bVal = pieceOrder(b.captured!.type);
      return bVal - aVal;
    });
  }

  for (const move of captures) {
    const newBoard = cloneBoard(board);
    applyMove(newBoard, move);

    const score = -quiesce(
      newBoard, -beta, -alpha, oppositeColor(color),
      nodes, qDepth + 1, startTime, timeLimitMs
    );

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// ─── Principal Variation Search ─────────────────────────────────

function alphaBeta(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  color: Color,
  ply: number,
  nodes: { count: number },
  startTime: number,
  timeLimitMs: number,
  hashMove: Move | null
): number {
  // Time check
  if (nodes.count % 1024 === 0 && Date.now() - startTime > timeLimitMs) {
    return evaluate(board) * (color === Color.Red ? 1 : -1);
  }

  // Transposition table lookup
  const hash = computeHash(board);
  const ttEntry = transpositionTable.get(hash);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === "exact") return ttEntry.value;
    if (ttEntry.flag === "lower" && ttEntry.value >= beta) return ttEntry.value;
    if (ttEntry.flag === "upper" && ttEntry.value <= alpha) return ttEntry.value;
  }

  // Checkmate / Stalemate
  if (isCheckmate(board, color)) {
    return -99999 + ply; // prefer faster mates
  }
  if (isStalemate(board, color)) {
    return -99998; // stalemate is a loss in Chinese Chess
  }

  if (depth <= 0) {
    return quiesce(board, alpha, beta, color, nodes, 0, startTime, timeLimitMs);
  }

  nodes.count++;

  const moves = getAllLegalMoves(board, color);
  if (moves.length === 0) {
    return isInCheck(board, color) ? -99999 + ply : -99998;
  }

  // Move ordering
  moves.sort((a, b) => scoreMove(b, ply, hashMove) - scoreMove(a, ply, hashMove));

  let bestScore = -Infinity;
  let bestMove: Move | null = null;
  let flag: "exact" | "lower" | "upper" = "upper";

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const newBoard = cloneBoard(board);
    applyMove(newBoard, move);

    let score: number;

    if (i === 0) {
      // First move: full window search
      score = -alphaBeta(
        newBoard,
        depth - 1,
        -beta,
        -alpha,
        oppositeColor(color),
        ply + 1,
        nodes,
        startTime,
        timeLimitMs,
        null
      );
    } else {
      // Late Move Reduction: reduce depth for later moves
      let reduction = 0;
      if (depth >= 3 && i >= 4 && !move.captured) {
        reduction = 1;
        if (depth >= 5 && i >= 8) reduction = 2;
      }

      // Null window search
      score = -alphaBeta(
        newBoard,
        depth - 1 - reduction,
        -alpha - 1,
        -alpha,
        oppositeColor(color),
        ply + 1,
        nodes,
        startTime,
        timeLimitMs,
        null
      );

      // If null window search raises alpha, do full re-search
      if (reduction > 0 && score > alpha) {
        score = -alphaBeta(
          newBoard,
          depth - 1,
          -beta,
          -alpha,
          oppositeColor(color),
          ply + 1,
          nodes,
          startTime,
          timeLimitMs,
          null
        );
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (score >= beta) {
      // Beta cutoff
      if (!move.captured) {
        recordKiller(move, ply);
        recordHistory(move, depth);
      }
      flag = "lower";
      break;
    }

    if (score > alpha) {
      alpha = score;
      flag = "exact";
    }
  }

  // Store in transposition table
  if (bestMove) {
    transpositionTable.set({
      hash,
      depth,
      value: bestScore,
      flag,
      bestMove: {
        fromRow: bestMove.from.row,
        fromCol: bestMove.from.col,
        toRow: bestMove.to.row,
        toCol: bestMove.to.col,
      },
    });
  }

  return bestScore;
}

// ─── Iterative Deepening ───────────────────────────────────────

export function search(
  board: Board,
  color: Color,
  config: SearchConfig = { maxDepth: 6, timeLimitMs: 3000 }
): SearchResult {
  const startTime = Date.now();
  const nodes = { count: 0 };
  let bestMove: Move | null = null;
  let bestScore = 0;
  let depthReached = 0;

  // Get all root moves and order them
  const rootMoves = getAllLegalMoves(board, color);
  if (rootMoves.length === 0) {
    return { move: null, score: 0, nodesSearched: 0, depthReached: 0 };
  }

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    let alpha = -Infinity;
    const beta = Infinity;
    let currentBestMove: Move | null = null;
    let currentBestScore = -Infinity;

    // Sort root moves by previous iteration's best move first
    if (bestMove) {
      rootMoves.sort((a, b) => {
        if (movesEqual(a, bestMove!)) return -1;
        if (movesEqual(b, bestMove!)) return 1;
        return 0;
      });
    }

    for (const move of rootMoves) {
      const newBoard = cloneBoard(board);
      applyMove(newBoard, move);

      const score = -alphaBeta(
        newBoard,
        depth - 1,
        -beta,
        -alpha,
        oppositeColor(color),
        1,
        nodes,
        startTime,
        config.timeLimitMs,
        null
      );

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBestMove = move;
      }

      if (score > alpha) {
        alpha = score;
      }
    }

    // Check if we ran out of time
    if (Date.now() - startTime > config.timeLimitMs && depth > 1) {
      break;
    }

    if (currentBestMove) {
      bestMove = currentBestMove;
      bestScore = currentBestScore;
      depthReached = depth;
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    nodesSearched: nodes.count,
    depthReached,
  };
}
