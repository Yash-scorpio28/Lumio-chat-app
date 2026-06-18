const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema(
{
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
    },

    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },

    text: String,

    image: String,
},
{ timestamps: true }
);

module.exports = mongoose.model(
    "GroupMessage",
    groupMessageSchema
);