"use client";

import { useState } from "react";
import { Color, GameStatus, Position } from "@/lib/game/types";
import { useSocket } from "@/hooks/useSocket";
import Board from "@/components/board/Board";

export default function OnlineGamePage() {
  const {
    connected,
    roomId,
    playerColor,
    gameState,
    opponentName,
    error,
    createRoom,
    joinRoom,
    makeMove,
    resign,
    offerDraw,
  } = useSocket();

  const [playerName, setPlayerName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [mode, setMode] = useState<"menu" | "lobby" | "playing">("menu");
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);

  const handleCreate = () => {
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
    setMode("lobby");
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinRoomId.trim()) return;
    joinRoom(joinRoomId.trim().toUpperCase(), playerName.trim());
  };

  const handleCellClick = (pos: Position) => {
    if (!gameState || gameState.status !== GameStatus.Playing) return;
    if (playerColor !== gameState.currentTurn) return;

    if (selectedPos) {
      makeMove(selectedPos, pos);
      setSelectedPos(null);
    } else if (
      gameState.board[pos.row][pos.col]?.color === playerColor
    ) {
      setSelectedPos(pos);
    }
  };

  const statusText = () => {
    if (!gameState) return "";
    switch (gameState.status) {
      case GameStatus.RedWins: return "🏆 Red Wins!";
      case GameStatus.BlackWins: return "🏆 Black Wins!";
      case GameStatus.Stalemate: return "🤝 Draw!";
      default:
        const check = false; // simplified
        return gameState.currentTurn === playerColor
          ? "Your turn" : `${opponentName || "Opponent"}'s turn`;
    }
  };

  // Menu / Lobby
  if (mode === "menu") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <h1 className="text-4xl font-bold text-amber-400 mb-8">Play Online</h1>
        <div className="flex flex-col gap-6 w-80">
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="px-4 py-2 rounded-lg bg-stone-800 text-white border border-stone-600 focus:border-amber-500 outline-none"
          />
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition"
          >
            Create New Game
          </button>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-stone-700" />
            <span className="text-stone-500 text-sm">or join</span>
            <div className="flex-1 h-px bg-stone-700" />
          </div>
          <input
            type="text"
            placeholder="Room code (e.g. ABC123)"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
            className="px-4 py-2 rounded-lg bg-stone-800 text-white border border-stone-600 focus:border-amber-500 outline-none uppercase"
            maxLength={6}
          />
          <button
            onClick={handleJoin}
            className="px-4 py-2 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 transition"
          >
            Join Game
          </button>
        </div>
        <p className={`text-sm mt-4 ${connected ? "text-green-500" : "text-red-500"}`}>
          {connected ? "✓ Connected" : " connecting..."}
        </p>
      </main>
    );
  }

  // Lobby (waiting for opponent)
  if (mode === "lobby") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-stone-950">
        <h1 className="text-3xl font-bold text-amber-400 mb-4">Waiting for Opponent</h1>
        <p className="text-stone-400 text-lg mb-2">Room Code: <span className="text-amber-300 font-bold text-2xl">{roomId}</span></p>
        <p className="text-stone-500 text-sm">Share this code with a friend to join</p>
        <button
          onClick={() => setMode("playing")}
          className="mt-6 px-4 py-2 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 transition"
        >
          Start Playing
        </button>
      </main>
    );
  }

  // Playing
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-stone-900">
      <h1 className="text-3xl font-bold text-amber-400 mb-2">BokChess Online</h1>
      {error && <p className="text-red-400 mb-2">{error}</p>}
      <div className="text-lg font-semibold mb-3 px-4 py-1 rounded-full bg-stone-700 text-stone-300">
        {statusText()}
      </div>
      {gameState && (
        <div className="rounded-xl overflow-hidden border-2 border-stone-600">
          <Board
            board={gameState.board}
            flipped={playerColor === Color.Black}
            selectedPos={selectedPos}
            onCellClick={handleCellClick}
          />
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <button onClick={resign} className="px-4 py-2 rounded-lg bg-red-700 text-white hover:bg-red-600 transition">
          Resign
        </button>
        <button onClick={offerDraw} className="px-4 py-2 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 transition">
          Offer Draw
        </button>
      </div>
    </main>
  );
}
