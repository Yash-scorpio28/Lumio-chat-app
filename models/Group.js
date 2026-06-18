const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({

    name: String,
    members: [String],
    createdBy: String,
  });

  module.exports = mongoose.model(
"Group", 
groupSchema
  );

  