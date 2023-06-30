import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const Metadata = new Schema({
  id: String,
  latestBlockSynced: String,
});

// Compile model from schema
export default mongoose.model("metadata", Metadata);
