let io;

export const initIO = (server) => {
  if (io) return io; // already initialized
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*", // change to your frontend URL in production
      methods: ["GET", "POST"]
    }
  });
  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
