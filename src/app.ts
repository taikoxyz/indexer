// import viem
import { readFile, writeFile } from "fs";
import request, { gql } from "graphql-request";

import Metadata from "./models/Metadata";
import { connectDB } from "./config/db";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { providers } from "ethers";
import schedule from "node-schedule";

//import
dotenv.config();

const TAIKO_RPC = process.env.TAIKO_RPC;
const PORT = process.env.PORT || 3001;

async function getTransactionsByAccount(
  provider: providers.Provider,
  contract: string,
  startBlockNumber: number,
  endBlockNumber: number,
  topic?: (string | string[])[]
): Promise<any[]> {
  const result = [];
  let blockDistanceLeft = endBlockNumber - startBlockNumber;
  let startB = startBlockNumber;
  let endB =
    blockDistanceLeft > 2000 ? startBlockNumber + 2000 : endBlockNumber;
  while (blockDistanceLeft > 0 && startB < endB) {
    console.log(
      "Searching for logs to contract within blocks " + startB + " and " + endB
    );
    const logs = await provider.getLogs({
      fromBlock: startB,
      toBlock: endB,
      address: contract,
      topics: topic,
    });
    result.push(...logs);
    blockDistanceLeft = blockDistanceLeft - (endB - startB);
    startB = endB + 1 > endBlockNumber ? endBlockNumber : endB + 1;
    endB = endB + 1 + 2000 > endBlockNumber ? endBlockNumber : endB + 1 + 2000;
  }
  return result;
}

async function main() {
  schedule.scheduleJob("* */1 * * *", async () => {
    console.log("Running job...");
  });

  // Schedule a job every second
  schedule.scheduleJob("* * * * * *", async () => {
    console.log("Running job...");
  });

  const app = express();
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
  let tx = await Metadata.findOneAndUpdate(
    { id: "0" },
    { id: "0", latestBlockSynced: "123" },
    { upsert: true }
  );
  console.log("🚀 | main | tx:", tx);
}

main()
  .then(() => console.log("Done"))
  .catch((error) => console.error(error.stack));
