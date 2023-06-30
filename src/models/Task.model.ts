import mongoose from "mongoose";

const Task = new mongoose.Schema({
  taskId: String,
  description: String,
  completedAddresses: [String],
});

export default mongoose.model("task", Task);
