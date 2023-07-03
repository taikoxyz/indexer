import { BigNumber, Contract, ethers, providers } from "ethers";
import { SepoliaProvider, TaikoProvider } from "./providers/index";
import { readFile, writeFile } from "fs";
import request, { gql } from "graphql-request";

import Metadata from "./models/Metadata.model";
import { TaikoBridgeL1 } from "./contracts";
import Task from "./models/Task.model";
import { connectDB } from "./config/db";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import schedule from "node-schedule";

//import
dotenv.config();

const PORT = process.env.PORT || 3001;

async function updateLatestBlockSynced(id: string, latestBlockSynced: string) {
  const metadata = await Metadata.findOne({ id: id });
  if (metadata) {
    metadata.latestBlockSynced = latestBlockSynced;
    await metadata.save();
  } else {
    // Create new metadata
    const newMetadata = new Metadata({
      id: id,
      latestBlockSynced: latestBlockSynced,
    });
    await newMetadata.save();
  }
  console.log(`Updated ${id} latestBlockSynced to ${latestBlockSynced}`);
}

async function getLatestBlockSynced(id: string): Promise<number> {
  const metadata = await Metadata.findOne({ id: id });
  let latestBlock;
  if (metadata) {
    latestBlock = Number(metadata.latestBlockSynced);
  } else {
    latestBlock = 0;
  }
  console.log(`Latest block synced for ${id} is ${latestBlock}`);
  return latestBlock;
}

async function addUserToTaskCompleted(taskId: string, user: string) {
  let task = await Task.findOneAndUpdate(
    {
      taskId: taskId,
      address: user,
    },
    {
      taskId: taskId,
      address: user,
    },
    { upsert: true }
  );
}

async function addUsersToTaskCompleted(taskId: string, users: string[]) {
  if (users.length > 0) {
    for (let user of users) {
      let task = await Task.findOneAndUpdate(
        {
          taskId: taskId,
          address: user,
        },
        {
          taskId: taskId,
          address: user,
        },
        { upsert: true }
      );
    }
    console.log("added", users.length, "addresses");
  }
}

async function addTask(taskId: string, description: string) {
  const newTask = new Task({ taskId, description });
  await newTask.save();
}

async function syncL1BridgeTask() {
  let latestBlockSynced = await getLatestBlockSynced("sepolia_l1_bridge");
  let latestBlock = await SepoliaProvider.getBlockNumber();
  // Do until latestBlockSynced = latestBlock

  while (latestBlockSynced < latestBlock) {
    let latestBlockSynced = await getLatestBlockSynced("sepolia_l1_bridge");
    const TAIKO_BRIDGE_L1_START_BLOCK = 3610815;

    const fromBlock =
      TAIKO_BRIDGE_L1_START_BLOCK > latestBlockSynced
        ? TAIKO_BRIDGE_L1_START_BLOCK
        : latestBlockSynced;
    const toBlock =
      latestBlock > fromBlock + 2000 ? fromBlock + 2000 : latestBlock;

    let filter = {
      fromBlock: fromBlock,
      toBlock: toBlock,
      ...TaikoBridgeL1.filters.MessageSent(null, null),
    };
    const logs = await SepoliaProvider.getLogs(filter);

    if (logs.length > 0) {
      console.log(`Adding ${logs.length} users to task 1...`);
      for (let log of logs) {
        let abiCoder = ethers.utils.defaultAbiCoder;
        let decoded = abiCoder.decode(
          [
            // "bytes32 msgHash",
            "tuple(uint256 id, address sender, uint256 srcChainId, uint256 destChainId, address owner, address to, address refundAddress, uint256 depositValue, uint256 callValue, uint256 processingFee, uint256 gasLimit, bytes data, string memo) message",
          ],
          log.data
        );
        let sender = decoded.message.sender;
        let depositValue = decoded.message.depositValue;
        if (depositValue.gt(BigNumber.from("0"))) {
          console.log(
            "SENDER: ",
            decoded.message.sender,
            "DEPOSIT VALUE: ",
            ethers.utils.formatEther(decoded.message.depositValue)
          );
          await addUserToTaskCompleted("1", sender);
        }
      }
    } else {
      console.log(`No logs found between ${fromBlock} and ${toBlock}`);
    }

    // Set latest block synced to latest block
    await updateLatestBlockSynced("sepolia_l1_bridge", toBlock.toString());
  }
}

async function syncL2SwapTask() {
  let latestBlockSynced = await getLatestBlockSynced("taiko_l2_swap");
  let latestBlock = await TaikoProvider.getBlockNumber();
  // Do until latestBlockSynced = latestBlock

  while (latestBlockSynced < latestBlock) {
    let latestBlockSynced = await getLatestBlockSynced("sepolia_l1_bridge");
    const TAIKO_BRIDGE_L1_START_BLOCK = 3610815;

    const fromBlock =
      TAIKO_BRIDGE_L1_START_BLOCK > latestBlockSynced
        ? TAIKO_BRIDGE_L1_START_BLOCK
        : latestBlockSynced;
    const toBlock =
      latestBlock > fromBlock + 2000 ? fromBlock + 2000 : latestBlock;

    let filter = {
      fromBlock: fromBlock,
      toBlock: toBlock,
      ...TaikoBridgeL1.filters.MessageSent(null, null),
    };
    const logs = await SepoliaProvider.getLogs(filter);

    if (logs.length > 0) {
      console.log(`Adding ${logs.length} users to task 1...`);
      for (let log of logs) {
        let abiCoder = ethers.utils.defaultAbiCoder;
        let decoded = abiCoder.decode(
          [
            // "bytes32 msgHash",
            "tuple(uint256 id, address sender, uint256 srcChainId, uint256 destChainId, address owner, address to, address refundAddress, uint256 depositValue, uint256 callValue, uint256 processingFee, uint256 gasLimit, bytes data, string memo) message",
          ],
          log.data
        );
        let sender = decoded.message.sender;
        let depositValue = decoded.message.depositValue;
        if (depositValue.gt(BigNumber.from("0"))) {
          console.log(
            "SENDER: ",
            decoded.message.sender,
            "DEPOSIT VALUE: ",
            ethers.utils.formatEther(decoded.message.depositValue)
          );
          await addUserToTaskCompleted("1", sender);
        }
      }
    } else {
      console.log(`No logs found between ${fromBlock} and ${toBlock}`);
    }

    // Set latest block synced to latest block
    await updateLatestBlockSynced("sepolia_l1_bridge", toBlock.toString());
  }
}

async function main() {
  // Schedule a job every second
  // schedule.scheduleJob("* * * * * *", async () => {
  //   console.log(`Running job...`);
  // });

  const app = express();
  await connectDB();

  await initialize();

  app.listen(PORT, () => {
    console.log(`Server started on port `);
  });

  // Filter Bridge Transactions on L1
  await syncL1BridgeTask();
}

// console.log("🚀 | main | decoded:", sender, depositValue);

// let events = await getContractEvents(
//   TaikoBridgeL1,
//   3610815,
//   3610815 + 2000,
//   2000,
//   ["MessageSent"]
// );

main()
  .then(() => console.log("Done"))
  .catch((error) => console.error(error.stack));
