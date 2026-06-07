"use client";

import { useEffect, useRef, useCallback, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Color, GameStatus, AIDifficulty, AI_DIFFICULTY_CONFIG } from "@/lib/game/types";
import { useGameStore } from "@/hooks/useGame";
import { useAI, type AIRequestResult } from "@/hooks/useAI";
import Board, { HintArrow } from "@/components/board/Board";
import EvalBar from "@/components/ui/EvalBar";
import { Undo2, RotateCcw, Brain, ArrowLeft, GraduationCap, Swords, Lightbulb } from "lucide-react";
import { encodeMove } from "@/lib/game/notation";
import { cloneBoard, getPieceAt } from "@/lib/game/board";
import { isMateScore, mateInMoves } from "@/lib/ai/search";

function LocalGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "human"; // "human" | "ai"
  const difficulty =
    (searchParams.get("difficulty") as AIDifficulty) ?? AIDifficulty.Medium;
  const isAIMode = mode === "ai";
  const difficultyConfig =
    AI_DIFFICULTY_CONFIG[difficulty] ?? AI_DIFFICULTY_CONFIG[AIDifficulty.Medium];

  const {
    board,
    currentTurn,
    moveHistory,
    status,
    isInCheck,
    selectedPos,
    legalMoves,
    selectPiece,
    applyAIMove,
    newGame,
  } = useGameStore();

  const { isThinking, lastResult, requestMove, clearCache, isHintLoading, lastHint, requestHint, clearHint } = useAI();

  // ── Learning mode state ──────────────────────────────────────
  const [learningMode, setLearningMode] = useState(false);
  // Score from Red's perspective: positive = Red advantage
  const [currentEvalScore, setCurrentEvalScore] = useState(0);
  const [lastScoreChange, setLastScoreChange] = useState(0);
  // Track per-move scores for display alongside move history
  const [moveScores, setMoveScores] = useState<Map<number, { score: number; change: number }>>(new Map());
  const prevEvalScoreRef = useRef(0);
  const prevMoveCountRef = useRef(0);

  // ── Mate distance state (絕殺提示) ────────────────────────────
  // Positive = Red is mating, Negative = Red is being mated
  // 0 = no mate detected
  const [mateDistance, setMateDistance] = useState(0);

  // ── Hint arrows state ────────────────────────────────────────
  const [hintArrows, setHintArrows] = useState<HintArrow[]>([]);

  // ── Reset game on mount ──────────────────────────────────────
  // Zustand store persists across navigations; ensure a fresh
  // board whenever the page mounts (e.g. "Start Game" from menu).
  useEffect(() => {
    useGameStore.getState().newGame();
  }, []);

  // ── Win animation state ──────────────────────────────────────
  const [showWinOverlay, setShowWinOverlay] = useState(false);

  // Trigger win animation when game ends
  useEffect(() => {
    if (status !== GameStatus.Playing) {
      const timer = setTimeout(() => setShowWinOverlay(true), 300);
      return () => clearTimeout(timer);
    }
    setShowWinOverlay(false);
  }, [status]);

  // ── AI move logic ────────────────────────────────────────────
  // Track which move number the AI has already processed.
  // Using a number ref (instead of boolean) is robust against
  // React Strict Mode double-fires and stale closure issues.
  const lastAIProcessedMoveRef = useRef(-1);
  // Prevent concurrent AI requests
  const aiInFlightRef = useRef(false);

  // Reset AI tracker when mode/difficulty changes (or on mount)
  useEffect(() => {
    lastAIProcessedMoveRef.current = -1;
    aiInFlightRef.current = false;
  }, [isAIMode, difficulty]);

  // Main AI effect: triggers when it becomes Black's turn
  useEffect(() => {
    // Only act in AI mode while the game is live and it's Black's turn
    if (!isAIMode) return;
    if (status !== GameStatus.Playing) return;
    if (currentTurn !== Color.Black) return;

    const moveCount = moveHistory.length;

    // Already processed this position
    if (moveCount <= lastAIProcessedMoveRef.current) return;
    // Already in flight
    if (aiInFlightRef.current) return;

    aiInFlightRef.current = true;
    lastAIProcessedMoveRef.current = moveCount;

    // Snapshot the board for the AI request — the current board
    // from getState() is always the freshest.
    const currentBoard = useGameStore.getState().board;

    // Retry counter: prevent infinite retry loops
    let retries = 0;
    const MAX_RETRIES = 3;

    const doAIMove = async () => {
      while (retries < MAX_RETRIES) {
        try {
          const result = await requestMove(currentBoard, Color.Black, moveCount, {
            skillLevel: difficultyConfig.skillLevel,
            moveTime: difficultyConfig.moveTime,
            depth: difficultyConfig.depth,
          });

          if (result?.move) {
            const move = result.move;
            console.log(
              "[ai] Got move from API: from=(" +
                move.from.row + "," + move.from.col +
                ") to=(" + move.to.row + "," + move.to.col +
                ") captured=" + (move.captured ? move.captured.color + "/" + move.captured.type : "none") +
                " score=" + result.score
            );

            // Verify the store hasn't moved on (e.g. user hit undo / new game)
            const state = useGameStore.getState();
            if (
              state.currentTurn !== Color.Black ||
              state.status !== GameStatus.Playing
            ) {
              console.log("[ai] Store state changed (turn=" + state.currentTurn + " status=" + state.status + "), aborting");
              return; // finally block handles cleanup
            }

            // Directly apply the engine-validated move
            const applied = state.applyAIMove(move);
            if (applied) {
              console.log("[ai] Move applied successfully: (" + move.from.row + "," + move.from.col + ") -> (" + move.to.row + "," + move.to.col + ")");

              // ── Learning mode: capture Pikafish evaluation ──
              // Pikafish score is from Black's (side-to-move) perspective.
              // Negate for Red's perspective (human plays Red).
              const redScore = -result.score;
              const prevScore = prevEvalScoreRef.current;
              const change = redScore - prevScore;

              setCurrentEvalScore(redScore);
              setLastScoreChange(change);
              prevEvalScoreRef.current = redScore;

              // ── Mate detection ──
              if (isMateScore(redScore)) {
                const moves = mateInMoves(redScore);
                // redScore negative = Red being mated
                setMateDistance(redScore > 0 ? moves : -moves);
              } else {
                setMateDistance(0);
              }

              // Store per-move score (use the move count after apply = moveCount + 1)
              const moveIdx = moveCount + 1;
              setMoveScores((prev) => {
                const next = new Map(prev);
                next.set(moveIdx, { score: redScore, change });
                return next;
              });
              prevMoveCountRef.current = moveIdx;

              return; // success
            }

            // applyAIMove returned false — should not happen with lenient guard
            console.error("[ai] applyAIMove returned false unexpectedly, retrying... (" + (retries + 1) + "/" + MAX_RETRIES + ")");
            retries++;
            if (retries < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 500));
            }
            continue;
          }

          // No move returned — engine might have been busy; retry
          console.warn("[ai] No move returned from engine (result=" + JSON.stringify(result) + "), retrying... (" + (retries + 1) + "/" + MAX_RETRIES + ")");
          retries++;
          if (retries < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch (err) {
          console.error("[ai] Error during AI move:", err);
          retries++;
          if (retries < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      // All retries exhausted — DO NOT reset the tracker to avoid
      // an infinite re-fire loop.  The game stays on Black's turn
      // and the user can use Undo or New Game to recover.
      console.error("[ai] All retries exhausted — AI cannot move. Use Undo or New Game.");
      // Keep lastAIProcessedMoveRef at moveCount so the effect won't re-fire
    };

    doAIMove().finally(() => {
      aiInFlightRef.current = false;
    });
    // Deliberately exclude `board` from deps — moveHistory.length is the
    // canonical signal that a new move was made.  `board` changes identity
    // on every store update and would cause spurious re-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIMode, currentTurn, status, moveHistory.length, difficultyConfig]);

  // ── HvH Learning mode: evaluate position after each move ─────
  const hvhEvalInFlightRef = useRef(false);

  useEffect(() => {
    if (isAIMode) return;
    if (!learningMode) return;
    if (status !== GameStatus.Playing) return;
    if (moveHistory.length === 0) return;
    if (hvhEvalInFlightRef.current) return;

    const moveCount = moveHistory.length;
    hvhEvalInFlightRef.current = true;

    const doEval = async () => {
      try {
        const currentBoard = useGameStore.getState().board;
        const result = await requestHint(currentBoard, currentTurn, moveCount, 1000);
        if (result?.hints && result.hints.length > 0) {
          // Engine score is from side-to-move perspective.
          // Convert to Red's perspective for EvalBar.
          const engineScore = result.hints[0].score;
          const redScore = currentTurn === Color.Black ? -engineScore : engineScore;
          const prevScore = prevEvalScoreRef.current;
          const change = redScore - prevScore;

          setCurrentEvalScore(redScore);
          setLastScoreChange(change);
          prevEvalScoreRef.current = redScore;

          if (isMateScore(redScore)) {
            const moves = mateInMoves(redScore);
            setMateDistance(redScore > 0 ? moves : -moves);
          } else {
            setMateDistance(0);
          }

          setMoveScores((prev) => {
            const next = new Map(prev);
            next.set(moveCount, { score: redScore, change });
            return next;
          });
          prevMoveCountRef.current = moveCount;
        }
      } catch (err) {
        console.error("[hvh-eval] Error evaluating position:", err);
      } finally {
        hvhEvalInFlightRef.current = false;
      }
    };

    doEval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIMode, learningMode, status, moveHistory.length, currentTurn]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleNewGame = useCallback(() => {
    lastAIProcessedMoveRef.current = -1;
    aiInFlightRef.current = false;
    clearCache();
    clearHint();
    setHintArrows([]);
    newGame();
    // Reset learning mode state
    setCurrentEvalScore(0);
    setLastScoreChange(0);
    setMoveScores(new Map());
    setMateDistance(0);
    prevEvalScoreRef.current = 0;
    prevMoveCountRef.current = 0;
  }, [newGame, clearCache, clearHint]);

  const handleUndo = useCallback(() => {
    if (moveHistory.length === 0) return;

    if (isAIMode && moveHistory.length >= 2) {
      // Undo both AI and human moves atomically via direct store calls.
      // Zustand's getState() always returns the latest synchronous state,
      // so two back-to-back undos work correctly.
      const store = useGameStore.getState();
      store.undoMove();
      store.undoMove();
      lastAIProcessedMoveRef.current = Math.max(
        0,
        lastAIProcessedMoveRef.current - 2
      );

      // Revert learning mode: remove last AI move's score entry
      setMoveScores((prev) => {
        const next = new Map(prev);
        // The AI move was at index = prevMoveCountRef.current
        next.delete(prevMoveCountRef.current);
        // Find the previous AI score to restore eval bar
        const keys = Array.from(next.keys()).sort((a, b) => b - a);
        if (keys.length > 0) {
          const prevEntry = next.get(keys[0])!;
          setCurrentEvalScore(prevEntry.score);
          setLastScoreChange(0);
          setMateDistance(isMateScore(prevEntry.score) ? (prevEntry.score > 0 ? mateInMoves(prevEntry.score) : -mateInMoves(prevEntry.score)) : 0);
          prevEvalScoreRef.current = prevEntry.score;
          prevMoveCountRef.current = keys[0];
        } else {
          setCurrentEvalScore(0);
          setLastScoreChange(0);
          setMateDistance(0);
          prevEvalScoreRef.current = 0;
          prevMoveCountRef.current = 0;
        }
        return next;
      });
    } else {
      useGameStore.getState().undoMove();
      lastAIProcessedMoveRef.current = Math.max(
        0,
        lastAIProcessedMoveRef.current - 1
      );

      // HvH learning mode: remove last move's score entry and restore previous
      if (learningMode) {
        setMoveScores((prev) => {
          const next = new Map(prev);
          next.delete(prevMoveCountRef.current);
          const keys = Array.from(next.keys()).sort((a, b) => b - a);
          if (keys.length > 0) {
            const prevEntry = next.get(keys[0])!;
            setCurrentEvalScore(prevEntry.score);
            setLastScoreChange(0);
            setMateDistance(isMateScore(prevEntry.score) ? (prevEntry.score > 0 ? mateInMoves(prevEntry.score) : -mateInMoves(prevEntry.score)) : 0);
            prevEvalScoreRef.current = prevEntry.score;
            prevMoveCountRef.current = keys[0];
          } else {
            setCurrentEvalScore(0);
            setLastScoreChange(0);
            setMateDistance(0);
            prevEvalScoreRef.current = 0;
            prevMoveCountRef.current = 0;
          }
          return next;
        });
      }
    }
    aiInFlightRef.current = false;
    hvhEvalInFlightRef.current = false;
  }, [isAIMode, moveHistory.length, learningMode]);

  const handleBack = useCallback(() => {
    clearCache();
    router.push("/");
  }, [clearCache, router]);

  // In AI mode, only allow clicking when it's Red's turn (human)
  const handleCellClick = useCallback(
    (pos: { row: number; col: number }) => {
      if (status !== GameStatus.Playing) return;
      if (isAIMode && currentTurn !== Color.Red) return;
      if (isThinking) return;
      selectPiece(pos);
    },
    [status, isAIMode, currentTurn, isThinking, selectPiece]
  );

  // ── Hint handler ──────────────────────────────────────────────
  const handleHint = useCallback(async () => {
    if (isHintLoading) return;
    if (status !== GameStatus.Playing) return;

    const currentBoard = useGameStore.getState().board;
    const moveCount = moveHistory.length;

    const result = await requestHint(currentBoard, currentTurn, moveCount);
    if (result?.hints) {
      const arrows: HintArrow[] = result.hints
        .filter((h) => h.move !== null)
        .map((h) => ({
          from: h.move!.from,
          to: h.move!.to,
          score: h.score,
          rank: h.rank,
        }));
      setHintArrows(arrows);
    }
  }, [isHintLoading, status, currentTurn, moveHistory.length, requestHint]);

  // Clear hints when a move is made
  useEffect(() => {
    setHintArrows([]);
  }, [moveHistory.length]);

  // ── Display helpers ──────────────────────────────────────────
  // Derived state for AI activity: combines React state + ref for effect logic,
  // but only uses React state (isThinking) for rendering so UI always updates.
  const aiActive = isThinking;

  const statusText = () => {
    if (aiActive) {
      return (
        <span className="flex items-center gap-2">
          <Brain size={18} className="animate-pulse text-amber-400" />
          AI is thinking...
        </span>
      );
    }
    switch (status) {
      case GameStatus.RedWins:
        return isAIMode ? "🏆 You Win!" : "🏆 Red Wins!";
      case GameStatus.BlackWins:
        return isAIMode ? "💀 AI Wins!" : "🏆 Black Wins!";
      case GameStatus.Stalemate:
        return "🤝 Stalemate!";
      default:
        return isInCheck
          ? `${currentTurn === Color.Red ? "Red" : "Black"}'s turn — CHECK!`
          : isAIMode
            ? currentTurn === Color.Red
              ? "Your turn (Red)"
              : "AI is thinking... (Black)"
            : `${currentTurn === Color.Red ? "Red" : "Black"}'s turn`;
    }
  };

  const isGameOver = status !== GameStatus.Playing;

  // ── Chinese notation for move history ───────────────────────
  // Reconstruct the piece that made each move by working
  // backwards from the current board state.
  const moveNotations = useMemo(() => {
    const notations: { notation: string; color: Color; captured: boolean }[] = [];
    if (moveHistory.length === 0) return notations;

    // Clone the current board and undo moves in reverse
    const simBoard = cloneBoard(board);

    for (let i = moveHistory.length - 1; i >= 0; i--) {
      const move = moveHistory[i];
      const piece = getPieceAt(simBoard, move.to);

      // Undo the move to get board state before this move
      simBoard[move.to.row][move.to.col] = move.captured;
      simBoard[move.from.row][move.from.col] = piece;

      if (piece) {
        // simBoard is now the state BEFORE this move
        notations.unshift({
          notation: encodeMove(move, piece, simBoard),
          color: piece.color,
          captured: move.captured !== null,
        });
      }
    }
    return notations;
  }, [board, moveHistory]);

  // ── Mate warning helper ─────────────────────────────────────
  const mateWarning = mateDistance !== 0 ? (
    <div className={`text-sm font-bold px-3 py-1 rounded-full animate-pulse ${
      mateDistance > 0
        ? "bg-red-500/20 text-red-400 border border-red-500/40"
        : "bg-stone-500/20 text-stone-300 border border-stone-500/40"
    }`}>
      <Swords size={14} className="inline mr-1" />
      {mateDistance > 0
        ? `絕殺！${mateDistance}步殺`
        : `絕殺！${-mateDistance}步殺`}
    </div>
  ) : null;

  // ── Render ───────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-stone-900 relative">
      {/* Back button — top left */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 flex items-center gap-1 px-3 py-2 rounded-lg bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200 transition text-sm"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <h1 className="text-3xl font-bold text-amber-400 mb-2">
        BokChess{" "}
        <span className="text-lg text-stone-400">
          — {isAIMode ? `vs AI (${difficultyConfig.label})` : "Local Game"}
        </span>
      </h1>

      {/* Learning Mode Toggle */}
      <button
        onClick={() => setLearningMode((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 mb-2 rounded-full text-xs font-semibold transition ${
          learningMode
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            : "bg-stone-800 text-stone-400 border border-stone-700 hover:border-stone-500"
        }`}
      >
        <GraduationCap size={14} />
        Learning Mode {learningMode ? "ON" : "OFF"}
      </button>

      {/* Status + Mate Warning */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`text-lg font-semibold px-4 py-1 rounded-full transition-colors duration-300 ${
            isGameOver
              ? "bg-amber-500/20 text-amber-400"
              : isInCheck
                ? "bg-red-500/20 text-red-400"
                : "bg-stone-700 text-stone-300"
          }`}
        >
          {statusText()}
        </div>
        {mateWarning}
      </div>

      {/* Board + Controls + Eval Bar + Move History */}
      <div className="flex items-start gap-3">
        {/* ── Action buttons — left side, icon-only ──────── */}
        <div className="flex flex-col gap-2 flex-shrink-0 pt-2">
          {/* Hint button — only in learning mode, for the current player */}
          {learningMode && (
            <button
              onClick={handleHint}
              disabled={
                isHintLoading ||
                aiActive ||
                status !== GameStatus.Playing
              }
              className="p-2 rounded-lg bg-violet-700 text-violet-200 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title={`Hint — top 3 suggestions for ${currentTurn === Color.Red ? "Red" : "Black"}`}
            >
              <Lightbulb
                size={20}
                className={isHintLoading ? "animate-pulse" : ""}
              />
            </button>
          )}
          <button
            onClick={handleUndo}
            disabled={moveHistory.length === 0 || aiActive}
            className="p-2 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title={isAIMode ? "Undo (both moves)" : "Undo"}
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={handleNewGame}
            disabled={aiActive}
            className="p-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="New Game"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        {/* Evaluation Bar — left side, in learning mode */}
        {learningMode && (
          <div className="flex-shrink-0 pt-2">
            <EvalBar
              score={currentEvalScore}
              scoreChange={lastScoreChange}
              showChange={moveHistory.length > 0}
            />
          </div>
        )}

        {/* Board */}
        <div className="rounded-xl overflow-hidden border-2 border-stone-600 relative">
          <Board
            board={board}
            selectedPos={selectedPos}
            legalMoves={legalMoves}
            onCellClick={handleCellClick}
            hintArrows={hintArrows}
          />

        {/* Win overlay — slides in from bottom */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-all duration-700 ease-out pointer-events-none ${
            showWinOverlay
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          {status === GameStatus.RedWins && (
            <div className="text-center animate-bounce-in">
              <span className="text-5xl block mb-2 drop-shadow-lg">
                {isAIMode ? "🎉" : "🏆"}
              </span>
              <span className="text-3xl font-extrabold text-amber-300 drop-shadow-md">
                {isAIMode ? "You Win!" : "Red Wins!"}
              </span>
            </div>
          )}
          {status === GameStatus.BlackWins && (
            <div className="text-center animate-bounce-in">
              <span className="text-5xl block mb-2 drop-shadow-lg">
                {isAIMode ? "💀" : "🏆"}
              </span>
              <span className="text-3xl font-extrabold text-stone-200 drop-shadow-md">
                {isAIMode ? "AI Wins!" : "Black Wins!"}
              </span>
            </div>
          )}
          {status === GameStatus.Stalemate && (
            <div className="text-center animate-bounce-in">
              <span className="text-5xl block mb-2 drop-shadow-lg">🤝</span>
              <span className="text-3xl font-extrabold text-stone-300 drop-shadow-md">
                Stalemate!
              </span>
            </div>
          )}
        </div>
        </div>
        {/* End Board wrapper */}

        {/* ── Move History — right side ──────────────────── */}
        {moveNotations.length > 0 && (
          <div className="flex-shrink-0 w-44">
            <h3 className="text-stone-400 text-sm mb-1">
              棋譜
              {learningMode && <span className="text-amber-400 ml-1">📊</span>}
            </h3>
            <div className="bg-stone-800 rounded-lg p-2 max-h-[602px] overflow-y-auto text-sm text-stone-300">
              {moveNotations.map((item, i) => {
                const moveNum = i + 1;
                const roundNum = Math.floor(i / 2) + 1;
                // In learning mode, show score for AI (Black) moves
                const scoreEntry = learningMode ? moveScores.get(moveNum) : undefined;
                const isBlackMove = i % 2 === 1;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1 py-0.5 ${
                      i % 2 === 0 ? "" : "pl-3"
                    }`}
                  >
                    {/* Round number for Red moves */}
                    {i % 2 === 0 && (
                      <span className="text-stone-500 text-xs w-5 flex-shrink-0">
                        {roundNum}.
                      </span>
                    )}
                    {i % 2 === 1 && (
                      <span className="text-stone-600 text-xs w-5 flex-shrink-0" />
                    )}
                    {/* Notation */}
                    <span
                      className={`${
                        item.color === Color.Red
                          ? "text-red-400"
                          : "text-stone-300"
                      } ${item.captured ? "font-bold" : ""}`}
                    >
                      {item.notation}
                    </span>
                    {/* Captured indicator */}
                    {item.captured && (
                      <span className="text-amber-400 text-xs">×</span>
                    )}
                    {/* Score in learning mode for Black moves */}
                    {isBlackMove && scoreEntry && (
                      <span
                        className={`text-[10px] font-mono ml-auto ${
                          scoreEntry.score > 30
                            ? "text-red-400"
                            : scoreEntry.score < -30
                              ? "text-stone-300"
                              : "text-stone-500"
                        }`}
                        title={`評分: ${(scoreEntry.score / 100).toFixed(1)} 分`}
                      >
                        {(scoreEntry.score / 100).toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* End Move History */}
      </div>
      {/* End flex container (Board + EvalBar + MoveHistory) */}

      {/* AI Info */}
      {isAIMode && lastResult && (
        <div className="text-xs text-stone-500 mt-2">
          AI depth: {lastResult.depthReached} • nodes:{" "}
          {lastResult.nodesSearched.toLocaleString()}
          {lastResult.fromBook ? " (opening book)" : ""}
        </div>
      )}

      {/* Footer */}
      <p className="text-stone-600 text-xs mt-6">
        {isAIMode
          ? "You play Red • AI plays Black • Red always moves first"
          : "Red always moves first • Click a piece to select, then click destination"}
      </p>
    </main>
  );
}

export default function LocalGamePage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-stone-900">
        <div className="text-amber-400 text-xl">Loading...</div>
      </main>
    }>
      <LocalGameContent />
    </Suspense>
  );
}
