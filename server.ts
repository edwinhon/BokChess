import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { GameManager } from "./src/server/gameManager";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // ─── Socket.io ──────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const gameManager = new GameManager();

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Create a new game room
    socket.on("create_room", (data: { playerName: string }) => {
      const room = gameManager.createRoom(socket.id, data.playerName);
      socket.join(room.id);
      socket.emit("room_created", {
        roomId: room.id,
        playerColor: "red",
        gameState: room.getGameState(),
      });
      console.log(`[room] created: ${room.id} by ${data.playerName}`);
    });

    // Join an existing game room
    socket.on("join_room", (data: { roomId: string; playerName: string }) => {
      const room = gameManager.joinRoom(data.roomId, socket.id, data.playerName);
      if (!room) {
        socket.emit("error", { message: "Room not found or full" });
        return;
      }
      socket.join(data.roomId);
      // Notify both players
      io.to(data.roomId).emit("game_started", {
        players: room.players,
        gameState: room.getGameState(),
      });
      console.log(`[room] ${data.playerName} joined ${data.roomId}`);
    });

    // Make a move
    socket.on("make_move", (data: { roomId: string; from: { row: number; col: number }; to: { row: number; col: number } }) => {
      const room = gameManager.getRoom(data.roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      const result = room.tryMove(socket.id, data.from, data.to);
      if (!result.success) {
        socket.emit("error", { message: result.error });
        return;
      }
      io.to(data.roomId).emit("game_update", room.getGameState());
    });

    // Resign
    socket.on("resign", (data: { roomId: string }) => {
      const room = gameManager.getRoom(data.roomId);
      if (room) {
        room.resign(socket.id);
        io.to(data.roomId).emit("game_update", room.getGameState());
      }
    });

    // Draw offer
    socket.on("draw_offer", (data: { roomId: string }) => {
      socket.to(data.roomId).emit("draw_offered", { from: socket.id });
    });

    socket.on("draw_response", (data: { roomId: string; accept: boolean }) => {
      const room = gameManager.getRoom(data.roomId);
      if (!room) return;
      if (data.accept) {
        room.draw();
        io.to(data.roomId).emit("game_update", room.getGameState());
      } else {
        socket.to(data.roomId).emit("draw_declined");
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      const room = gameManager.handleDisconnect(socket.id);
      if (room) {
        io.to(room.id).emit("player_left", { playerId: socket.id });
        io.to(room.id).emit("game_update", room.getGameState());
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> BokChess server ready on http://${hostname}:${port}`);
  });
});
