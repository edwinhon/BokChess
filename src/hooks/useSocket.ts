"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Board, Color, Position, Move, GameStatus } from "@/lib/game/types";

interface GameUpdate {
  board: Board;
  currentTurn: Color;
  status: GameStatus;
  moveHistory: Move[];
  players: { name: string; color: Color }[];
}

interface UseSocketResult {
  socket: Socket | null;
  connected: boolean;
  roomId: string | null;
  playerColor: Color | null;
  gameState: GameUpdate | null;
  opponentName: string | null;
  error: string | null;
  createRoom: (playerName: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  makeMove: (from: Position, to: Position) => void;
  resign: () => void;
  offerDraw: () => void;
  respondDraw: (accept: boolean) => void;
}

export function useSocket(): UseSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [gameState, setGameState] = useState<GameUpdate | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("room_created", (data: { roomId: string; playerColor: string; gameState: GameUpdate }) => {
      setRoomId(data.roomId);
      setPlayerColor(data.playerColor as Color);
      setGameState(data.gameState);
    });

    socket.on("game_started", (data: { players: { name: string; color: Color }[]; gameState: GameUpdate }) => {
      setGameState(data.gameState);
      const opponent = data.players.find((p) => p.color !== playerColor);
      if (opponent) setOpponentName(opponent.name);
    });

    socket.on("game_update", (data: GameUpdate) => {
      setGameState(data);
    });

    socket.on("player_left", () => {
      setError("Opponent disconnected");
    });

    socket.on("draw_offered", () => {
      // Handled by UI state
    });

    socket.on("error", (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback((playerName: string) => {
    socketRef.current?.emit("create_room", { playerName });
  }, []);

  const joinRoom = useCallback((roomId: string, playerName: string) => {
    socketRef.current?.emit("join_room", { roomId, playerName });
  }, []);

  const makeMove = useCallback((from: Position, to: Position) => {
    if (!roomId) return;
    socketRef.current?.emit("make_move", { roomId, from, to });
  }, [roomId]);

  const resign = useCallback(() => {
    if (!roomId) return;
    socketRef.current?.emit("resign", { roomId });
  }, [roomId]);

  const offerDraw = useCallback(() => {
    if (!roomId) return;
    socketRef.current?.emit("draw_offer", { roomId });
  }, [roomId]);

  const respondDraw = useCallback((accept: boolean) => {
    if (!roomId) return;
    socketRef.current?.emit("draw_response", { roomId, accept });
  }, [roomId]);

  return {
    socket: socketRef.current,
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
    respondDraw,
  };
}
