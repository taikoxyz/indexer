import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const Stats = new Schema({
  id: String,
  value: { type: Number, default: 0, required: true },
});

// Compile model from schema
export default mongoose.model("stats", Stats);
