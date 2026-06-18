const mongoose = require("mongoose");

const MessageSchema =
  new mongoose.Schema({
    text: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    sender: {
      type: String,
      required: true,
    },

    receiver: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      default: "sent", // sent → delivered → seen
    },

    seenBy: {
      type: [String],
      default: [],
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    pinned: {
      type: Boolean,
      default: false,
    },

    deleted: {
      type: Boolean,
      default: false,
    },

    voice: {
      type: String,
      default: "",
    },
  });

module.exports = mongoose.model(
  "Message",
  MessageSchema
);