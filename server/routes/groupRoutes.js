const express = require("express");
const router = express.Router();
const Group = require("../../models/Group");

/* CREATE GROUP */
router.post("/create-group", async (req, res) => {
  try {
    const { name, creatorId } = req.body;

    if (!name || !creatorId) {
      return res.status(400).json({
        message: "Missing fields",
      });
    }

    const existingGroup =
      await Group.findOne({ name });

    if (existingGroup) {
      return res.status(400).json({
        message: "Group already exists",
      });
    }

    const newGroup = new Group({
      name,
      members: [creatorId],
    });

    await newGroup.save();

    res.json(newGroup);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

/* GET GROUPS FOR USER */
router.get("/groups/:userId", async (req, res) => {
  try {
    const groups = await Group.find({
      members: req.params.userId,
    });

    res.json(groups);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;