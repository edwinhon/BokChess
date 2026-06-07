import { Board, Color, Position, Move, GameStatus, oppositeColor } from "@/lib/game/types";
import { createInitialBoard, getPieceAt } from "@/lib/game/board";
import { applyMove } from "@/lib/game/moves";
import { isMoveLegal, isCheckmate, isStalemate } from "@/lib/game/rules";

interface PlayerInfo {
  id: string;
  name: string;
  color: Color;
}

interface GameStateData {
  board: Board;
  currentTurn: Color;
  status: GameStatus;
  moveHistory: Move[];
  players: { name: string; color: Color }[];
}

class GameRoom {
  id: string;
  players: PlayerInfo[] = [];
  board: Board;
  currentTurn: Color = Color.Red;
  moveHistory: Move[] = [];
  status: GameStatus = GameStatus.Playing;
  createdAt: number;

  constructor(id: string, hostId: string, hostName: string) {
    this.id = id;
    this.players = [{ id: hostId, name: hostName, color: Color.Red }];
    this.board = createInitialBoard();
    this.createdAt = Date.now();
  }

  addPlayer(id: string, name: string): boolean {
    if (this.players.length >= 2) return false;
    this.players.push({ id, name, color: Color.Black });
    return true;
  }

  getPlayerById(id: string): PlayerInfo | undefined {
    return this.players.find((p) => p.id === id);
  }

  getGameState(): GameStateData {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      status: this.status,
      moveHistory: this.moveHistory,
      players: this.players.map((p) => ({ name: p.name, color: p.color })),
    };
  }

  tryMove(playerId: string, from: Position, to: Position): { success: boolean; error?: string } {
    const player = this.getPlayerById(playerId);
    if (!player) return { success: false, error: "Not a player in this room" };
    if (this.status !== GameStatus.Playing) return { success: false, error: "Game is over" };
    if (player.color !== this.currentTurn) return { success: false, error: "Not your turn" };
    if (!isMoveLegal(this.board, from, to, this.currentTurn)) return { success: false, error: "Illegal move" };

    const captured = getPieceAt(this.board, to);
    const move: Move = { from: { ...from }, to: { ...to }, captured: captured ? { ...captured } : null };

    applyMove(this.board, move);
    this.moveHistory.push(move);
    this.currentTurn = oppositeColor(this.currentTurn);

    if (isCheckmate(this.board, this.currentTurn)) {
      this.status = this.currentTurn === Color.Red ? GameStatus.BlackWins : GameStatus.RedWins;
    } else if (isStalemate(this.board, this.currentTurn)) {
      this.status = GameStatus.Stalemate;
    }
    return { success: true };
  }

  resign(playerId: string): boolean {
    const player = this.getPlayerById(playerId);
    if (!player) return false;
    this.status = player.color === Color.Red ? GameStatus.BlackWins : GameStatus.RedWins;
    return true;
  }

  draw(): void {
    this.status = GameStatus.Stalemate;
  }
}

function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export class GameManager {
  private rooms = new Map<string, GameRoom>();
  private playerRooms = new Map<string, string>();

  createRoom(playerId: string, playerName: string): GameRoom {
    const id = generateRoomId();
    const room = new GameRoom(id, playerId, playerName);
    this.rooms.set(id, room);
    this.playerRooms.set(playerId, id);
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (!room.addPlayer(playerId, playerName)) return null;
    this.playerRooms.set(playerId, roomId);
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  handleDisconnect(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.resign(playerId);
    return room;
  }
}
