const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

const router = express.Router();

/* SIGNUP */
router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

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
      await bcrypt.hash(
        password,
        10
      );

    const newUser =
      new User({
        username,
        password:
          hashedPassword,
      });

    await newUser.save();

    res.json({
      username:
        newUser.username,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message:
        "Server error",
    });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
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
          "Wrong password",
      });
    }

    res.json({
      username:
        user.username,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message:
        "Server error",
    });
  }
});

/* GET USERS */
router.get("/users", async (req, res) => {
  try {
    const users =
      await User.find({});

    res.json(users);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message:
        "Server error",
    });
  }
});

module.exports = router;