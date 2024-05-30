const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const PORT = 3000;
const usersCollectionName = "users";
const chatsCollectionName = "chats";

function generateUniqueId() {
  return uuidv4();
}

function socketProvider(app, db) {
  const server = http.createServer(app);
  const io = new Server(server);

  const usersCollection = db.collection(usersCollectionName);
  const chatsCollection = db.collection(chatsCollectionName);

  // WebSocket connection handler
  io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("join", async ({ email, url, name, birth }) => {
      socket.email = email;
      // Check if the user exists
      let user = await usersCollection.findOne({ email: email });

      if (!user) {
        // Create a new user if it doesn't exist
        await usersCollection.insertOne({
          email: email,
          url,
          name,
          birth,
          chats: [],
        });
        user = await usersCollection.findOne({ email: email });
      }

      if (user && user.chats) {
        for (const chatId of user.chats) {
          socket.join(chatId);
        }
        // Fetch detailed chat information
        const responseChats = await chatsCollection
          .find({ chatId: { $in: user.chats } })
          .toArray();
        socket.emit("chats", responseChats);
      } else {
        socket.emit("chats", []);
      }
    });

    // Join a chat room
    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`User joined room: ${room}`);
    });

    // Handle sending messages
    socket.on("sendMessage", async (message) => {
      const { chatId, sender, recipient, content } = message;
      const newMessage = {
        sender,
        content,
        timestamp: new Date(),
      };

      let currentChatId = chatId;

      if (!currentChatId) {
        // Check if a chat already exists between sender and recipient
        const existingChat = await chatsCollection.findOne({
          emails: { $all: [sender, recipient] },
        });

        if (existingChat) {
          currentChatId = existingChat.chatId;
        } else {
          currentChatId = generateUniqueId();
          // Create a new chat
          await chatsCollection.insertOne({
            emails: [sender, recipient],
            chatId: currentChatId,
            messages: [newMessage],
          });

          // Add chat to both sender and recipient
          await usersCollection.updateOne(
            { email: sender },
            { $addToSet: { chats: currentChatId } },
            { upsert: true },
          );
          await usersCollection.updateOne(
            { email: recipient },
            { $addToSet: { chats: currentChatId } },
            { upsert: true },
          );

          // Join both users to the new chat room
          const senderSocket = Array.from(io.sockets.sockets.values()).find(
            (s) => s.email === sender,
          );
          const recipientSocket = Array.from(io.sockets.sockets.values()).find(
            (s) => s.email === recipient,
          );
          if (senderSocket) senderSocket.join(currentChatId);
          if (recipientSocket) recipientSocket.join(currentChatId);

          // Notify both users to update their chat lists
          const senderUser = await usersCollection.findOne({ email: sender });
          const recipientUser = await usersCollection.findOne({
            email: recipient,
          });

          const senderChats = await chatsCollection
            .find({ chatId: { $in: senderUser.chats } })
            .toArray();
          const recipientChats = await chatsCollection
            .find({ chatId: { $in: recipientUser.chats } })
            .toArray();

          if (senderSocket) senderSocket.emit("chats", senderChats);
          if (recipientSocket) recipientSocket.emit("chats", recipientChats);

          io.to(currentChatId).emit("newMessage", newMessage);

          return;
        }
      }

      // Add new message to the existing chat
      await chatsCollection.updateOne(
        { chatId: currentChatId },
        { $push: { messages: { $each: [newMessage], $position: 0 } } },
      );

      // Broadcast the message to other users in the chat room
      io.to(currentChatId).emit("newMessage", {
        message: newMessage,
        chatId: currentChatId,
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = { socketProvider };
