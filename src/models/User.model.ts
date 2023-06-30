import mongoose from "mongoose";

const User = new mongoose.Schema({
  address: String,
});

// Remember to change for each Project
export default mongoose.model("user", User);
