require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const streamifier = require("streamifier");
const { Server } = require("socket.io");

const User = require("./models/User");
const Message = require("./models/Message");
const Group = require("./models/Group");
const cloudinary = require("./cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
        MULTER
========================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage,
});

/* =========================
        HTTP SERVER
========================= */

const server = http.createServer(app);

/* =========================
        SOCKET IO
========================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* =========================
        MONGODB
========================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected 😤🔥");
  })
  .catch((err) => {
    console.log(err);
  });

/* =========================
      ONLINE USERS
========================= */

let onlineUsers = {};

/* =========================
      SOCKET CONNECTION
========================= */

io.on("connection", (socket) => {
  console.log("NEW SOCKET:", socket.id);

  socket.on("join_chat", (username) => {
  if (!username) return;

  const cleanUsername =
    username.trim();

  onlineUsers[cleanUsername] =
    socket.id;

  console.log(
    "ONLINE USERS:",
    Object.keys(onlineUsers)
  );

  io.emit(
    "online_users",
    Object.keys(onlineUsers)
  );
});
  socket.on("send_message", async (data) => {
    try {
      const newMessage = new Message({
  text: data.text || "",
  image: data.image || "",
  sender: data.sender,
  receiver: data.receiver,
  time: data.time,
  status: "delivered",
});
socket.on(
  "mark_seen",
  async (messageId) => {
    console.log("MARK SEEN:", messageId);

    try {
      const updatedMessage =
        await Message.findByIdAndUpdate(
          messageId,
          {
            status: "seen",
          },
          { new: true }
        );

      console.log(
        "UPDATED:",
        updatedMessage
      );

      io.emit(
        "message_seen",
        updatedMessage
      );
    } catch (err) {
      console.log(err);
    }
  }
);

      await newMessage.save();

      io.emit("receive_message", newMessage);
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("typing", (data) => {
    const receiverSocketId =
      onlineUsers[data.receiver];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit(
        "show_typing",
        data
      );
    }
  });

  socket.on("disconnect", () => {
    for (const user in onlineUsers) {
      if (
        onlineUsers[user] === socket.id
      ) {
        delete onlineUsers[user];
      }
    }

    io.emit(
      "online_users",
      Object.keys(onlineUsers)
    );
  });
});

/* =========================
        IMAGE UPLOAD
========================= */

app.post(
  "/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      const streamUpload = () => {
        return new Promise(
          (resolve, reject) => {
            const stream =
              cloudinary.uploader.upload_stream(
                {
                  folder: "lumio_chat",
                },
                (error, result) => {
                  if (result) resolve(result);
                  else reject(error);
                }
              );

            streamifier
              .createReadStream(
                req.file.buffer
              )
              .pipe(stream);
          }
        );
      };

      const result =
        await streamUpload();

      res.json({
        imageUrl: result.secure_url,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        message: "Upload failed",
      });
    }
  }
);

/* =========================
        PROFILE UPLOAD
========================= */

app.put(
  "/upload-profile",
  upload.single("image"),
  async (req, res) => {
    try {
      const streamUpload = () => {
        return new Promise(
          (resolve, reject) => {
            const stream =
              cloudinary.uploader.upload_stream(
                {
                  folder: "lumio_profiles",
                },
                (error, result) => {
                  if (result) resolve(result);
                  else reject(error);
                }
              );

            streamifier
              .createReadStream(
                req.file.buffer
              )
              .pipe(stream);
          }
        );
      };

      const result =
        await streamUpload();

      const updatedUser =
        await User.findOneAndUpdate(
          {
            username:
              req.body.username,
          },
          {
            profilePic:
              result.secure_url,
          },
          { new: true }
        );

      res.json(updatedUser);
    } catch (err) {
      console.log(err);
      res.status(500).json({
        message:
          "Profile upload failed",
      });
    }
  }
);

/* =========================
            SIGNUP
========================= */

app.post("/signup", async (req, res) => {
  try {
    const { username, password } =
      req.body;

    const existingUser =
      await User.findOne({
        username,
      });

    if (existingUser) {
      return res.status(400).json({
        message:
          "User already exists",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
    });

    await newUser.save();

    res.json({
      username: newUser.username,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

/* =========================
            LOGIN
========================= */

app.post("/login", async (req, res) => {
  try {
    const { username, password } =
      req.body;

    const user =
      await User.findOne({
        username,
      });

    if (!user) {
      return res.status(400).json({
        message:
          "User not found",
      });
    }

    const validPassword =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!validPassword) {
      return res.status(400).json({
        message:
          "Invalid password",
      });
    }

    res.json({
      username: user.username,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

/* =========================
            USERS
========================= */

app.get("/users", async (req, res) => {
  try {
    const users =
      await User.find({});
    res.json(users);
  } catch (err) {
    console.log(err);
  }
});

/* =========================
          MESSAGES
========================= */

app.get("/messages", async (req, res) => {
  try {
    const messages =
      await Message.find().sort({
        _id: 1,
      });

    res.json(messages);
  } catch (err) {
    console.log(err);
  }
});

/* =========================
        CREATE GROUP
========================= */

app.post(
  "/create-group",
  async (req, res) => {
    try {
      const {
        name,
        members,
        createdBy,
      } = req.body;

      const newGroup = new Group({
        name,
        members,
        createdBy,
      });

      await newGroup.save();

      res.json(newGroup);
    } catch (err) {
      console.log(err);
    }
  }
);

/* =========================
        GET GROUPS
========================= */

app.get(
  "/groups/:username",
  async (req, res) => {
    try {
      const groups =
        await Group.find({
          members:
            req.params.username,
        });

      res.json(groups);
    } catch (err) {
      console.log(err);
    }
  }
);

/* =========================
        ADD MEMBER
========================= */

app.put(
  "/groups/add-member",
  async (req, res) => {
    try {
      const { groupId, username } =
        req.body;

      const group =
        await Group.findById(groupId);

      if (
        !group.members.includes(
          username
        )
      ) {
        group.members.push(
          username
        );
      }

      await group.save();

      res.json(group);
    } catch (err) {
      console.log(err);
    }
  }
);

/* =========================
      REMOVE MEMBER
========================= */

app.put(
  "/groups/remove-member",
  async (req, res) => {
    try {
      const { groupId, username } =
        req.body;

      const group =
        await Group.findById(groupId);

      console.log(
        "Creator:",
        group.createdBy
      );
      console.log(
        "Trying to remove:",
        username
      );

      if (
        group.createdBy.trim() ===
        username.trim()
      ) {
        return res.status(400).json({
          message:
            "Creator cannot be removed",
        });
      }

      group.members =
        group.members.filter(
          (member) =>
            member.trim() !==
            username.trim()
        );

      await group.save();

      res.json(group);
    } catch (err) {
      console.log(err);
    }
  }
);

/* =========================
        LEAVE GROUP
========================= */

app.put(
  "/groups/leave",
  async (req, res) => {
    try {
      const { groupId, username } =
        req.body;

      const group =
        await Group.findById(groupId);

      group.members =
        group.members.filter(
          (member) =>
            member !== username
        );

      await group.save();

      res.json({
        message:
          "Left group successfully",
      });
    } catch (err) {
      console.log(err);
    }
  }
);

/* =========================
        START SERVER
========================= */

const PORT =
  process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});