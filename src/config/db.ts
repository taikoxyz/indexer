import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
let MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

const DB_USERNAME = process.env.DB_ADMIN;
const DB_PASSWORD = process.env.DB_ADMIN_PWD;

export const connectDB = async () => {
  let options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    dbName: "Galaxe",
  };
  // MONGODB_URI = `mongodb://${DB_USERNAME}:${DB_PASSWORD}@localhost:27017/?authMechanism=DEFAULT`;
  MONGODB_URI = `mongodb://admin:changeit@localhost:27017/?authMechanism=DEFAULT`;

  // if (process.env.NODE_ENV === "test") {
  //   console.log("LOCAL DB...");
  // } else if (process.env.NODE_ENV == "dev") {
  //   console.log(`DEV DB...(${DB_NAME_DEV})`);
  //   MONGODB_URI = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@${DB_DOMAIN}/${DB_NAME_DEV}`;
  // } else if (process.env.NODE_ENV == "prod") {
  //   console.log(`PROD DB...(${DB_NAME_PROD})`);
  //   MONGODB_URI = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@${DB_DOMAIN}/${DB_NAME_PROD}`;
  // } else {
  //   console.log("ENV NOT SET!");
  //   process.exit(1);
  // }

  try {
    await mongoose.connect(MONGODB_URI, options);
    console.log("Connected!");
  } catch (error) {
    console.log(`Failed to Connect!`);
    process.exit(1);
  }
};
