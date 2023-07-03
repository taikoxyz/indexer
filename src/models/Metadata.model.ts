import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const Metadata = new Schema({
  id: String,
  latestBlockSynced: { type: String, default: "0", required: true },
});

// Compile model from schema
export default mongoose.model("metadata", Metadata);
