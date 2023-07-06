import mongoose from "mongoose";

const Task = new mongoose.Schema({
  taskId: { type: String, required: true }, // Task ID
  address: { type: String }, // Address that completed the task
  value: { type: Number }, // Value of the task
});

export default mongoose.model("task", Task);
