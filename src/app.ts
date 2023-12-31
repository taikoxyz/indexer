import { BigNumber, Contract, ethers, providers, utils } from "ethers";
import { SepoliaProvider, TaikoProvider } from "./providers/index";
import { TaikoBridgeL1, TaikoSwap } from "./contracts";
import { readFile, writeFile } from "fs";
import request, { gql } from "graphql-request";

import Metadata from "./models/Metadata.model";
import Stats from "./models/Stats.model";
import Task from "./models/Task.model";
import axios from "axios";
import { connectDB } from "./config/db";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import schedule from "node-schedule";

//import
dotenv.config();

const PORT = process.env.PORT || 3001;
const BLOCK_RANGE = 1000; // Sync this number of blocks at a time

// Sleep
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Chunk Array
export const chunkArray = (myArray: any[], chunk_size: number): any[][] => {
  var index = 0;
  var arrayLength = myArray.length;
  var tempArray: any[][] = [];
  var myChunk: any[] = [];

  for (index = 0; index < arrayLength; index += chunk_size) {
    myChunk = myArray.slice(index, index + chunk_size);
    // Do something if you want with the group
    tempArray.push(myChunk);
  }

  return tempArray;
};

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
  console.log(`${id} => block ${latestBlockSynced}`);
}

async function getLatestBlockSynced(id: string): Promise<number> {
  const metadata = await Metadata.findOne({ id: id });
  let latestBlock;
  if (metadata) {
    latestBlock = Number(metadata.latestBlockSynced);
  } else {
    latestBlock = 0;
  }
  console.log(`${id} @ block ${latestBlock}`);
  return latestBlock;
}

async function addUserToTaskCompleted(taskId: string, user: string, value: number = 0) {
  let task = await Task.findOneAndUpdate(
    {
      taskId: taskId,
      address: user,
    },
    {
      taskId: taskId,
      address: user,
      $inc: { ["value"]: value }
    },
    { upsert: true }
  );
}


// TASK 1
async function syncL1BridgeTask() {

  while (true) {
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
        latestBlock > fromBlock + BLOCK_RANGE ? fromBlock + BLOCK_RANGE - 1 : latestBlock;

      console.log("[task_1] Syncing", fromBlock, "-", toBlock)

      let filter = {
        fromBlock: fromBlock,
        toBlock: toBlock,
        ...TaikoBridgeL1.filters.MessageSent(null, null),
      };
      const logs = await SepoliaProvider.getLogs(filter);

      if (logs.length > 0) {
        console.log(`[task_1] Adding ${logs.length} users`);
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

            // Add user to Task Completed
            await addUserToTaskCompleted("1", sender, decoded.message.depositValue);

            // Add to bridge stats
            await addL1BridgeVolume(decoded.message.depositValue)
          }
        }
      } else {
        console.log(`[task_1] No logs found`);
      }
      // Set latest block synced to latest block
      await updateLatestBlockSynced("sepolia_l1_bridge", (toBlock + 1).toString());
    }
    console.log(`[task_1] Caught up with latest block & waiting for 10 seconds`);
    // Sleep 10 seconds
    await sleep(10000);
  }
}

// TASK 2
async function syncL2SwapTask() {

  while (true) {
    let latestBlockSynced = await getLatestBlockSynced("taiko_l2_swap");
    let latestBlock = await TaikoProvider.getBlockNumber();
    // Do until latestBlockSynced = latestBlock

    while (latestBlockSynced < latestBlock) {
      let latestBlockSynced = await getLatestBlockSynced("taiko_l2_swap");
      const TAIKO_SWAP_L2_START_BLOCK = 6908;

      const fromBlock =
        TAIKO_SWAP_L2_START_BLOCK > latestBlockSynced
          ? TAIKO_SWAP_L2_START_BLOCK
          : latestBlockSynced;
      const toBlock =
        latestBlock > fromBlock + BLOCK_RANGE ? fromBlock + BLOCK_RANGE - 1 : latestBlock;

      console.log("[task_2] Syncing", fromBlock, "-", toBlock)

      let filter = {
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: [
          "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822" // Swap Event
        ]

      };

      const logs = await TaikoProvider.getLogs(filter);


      if (logs.length > 0) {
        console.log(`[task_2] Adding ${logs.length} users`);
        for (let log of logs) {
          // Convert bytes32 to address
          const address = ethers.utils.getAddress('0x' + log.topics[2].slice(26));

          // Used for decoding amount swapped
          // let abiCoder = ethers.utils.defaultAbiCoder;
          // try {
          //   let decoded = abiCoder.decode(
          //     [
          //       "uint amount0In",
          //       "uint amount1In",
          //       "uint amount0Out",
          //       "uint amount1Out",
          //     ],
          //     log.data
          //   );
          //   console.log(decoded);
          // } catch (e) {
          // }

          // Add user to Task Completed
          // Currently user can swap ANY token to complete this task
          await addUserToTaskCompleted("2", address);
        }
      } else {
        console.log(`[task_2] No logs found`);
      }

      // Set latest block synced to latest block
      await updateLatestBlockSynced("taiko_l2_swap", (toBlock + 1).toString());
    }
    console.log(`[task_2] Caught up with latest block & waiting for 10 seconds`);
    // Sleep 10 seconds
    await sleep(10000);
  }
}

// TASK 3
async function syncL1BlockProved() {

  while (true) {
    let latestBlockSynced = await getLatestBlockSynced("taiko_block_proved");
    let latestBlock = await SepoliaProvider.getBlockNumber();

    while (latestBlockSynced < latestBlock) {
      let latestBlockSynced = await getLatestBlockSynced("taiko_block_proved");
      const TAIKO_L1_START_BLOCK = 3610815;

      const fromBlock =
        TAIKO_L1_START_BLOCK > latestBlockSynced
          ? TAIKO_L1_START_BLOCK
          : latestBlockSynced;
      const toBlock =
        latestBlock > fromBlock + BLOCK_RANGE ? fromBlock + BLOCK_RANGE - 1 : latestBlock;

      console.log("[task_3] Syncing", fromBlock, "-", toBlock)

      let filter = {
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: ["0x2295930c498c7b1f60143439a63dd1d24bbb730f08ff6ed383b490ba2c1cafa4"] // Block Proved Topic Hash

      };

      const logs = await SepoliaProvider.getLogs(filter);

      if (logs.length > 0) {
        console.log(`[task_3] Adding ${logs.length} users`);
        await addBlockProved(logs.length);
      } else {
        console.log(`[task_3] No logs found`);
      }

      // Set latest block synced to latest block
      await updateLatestBlockSynced("taiko_block_proved", toBlock.toString());
    }

    console.log(`[task_3] Caught up with latest block & waiting for 10 seconds`);
    // Sleep 10 seconds
    await sleep(10000);
  }

}

// TASK 4
async function syncL1BlockProposed() {

  while (true) {

    let latestBlockSynced = await getLatestBlockSynced("taiko_block_proposed");
    let latestBlock = await SepoliaProvider.getBlockNumber();

    while (latestBlockSynced < latestBlock) {
      let latestBlockSynced = await getLatestBlockSynced("taiko_block_proposed");
      const TAIKO_L1_START_BLOCK = 3610815;

      const fromBlock =
        TAIKO_L1_START_BLOCK > latestBlockSynced
          ? TAIKO_L1_START_BLOCK
          : latestBlockSynced;
      const toBlock =
        latestBlock > fromBlock + BLOCK_RANGE ? fromBlock + BLOCK_RANGE - 1 : latestBlock;

      console.log("[task_4] Syncing", fromBlock, "-", toBlock)

      let filter = {
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: ["0x555304f14500c230922dd951cfdbb74012005afbcd7350b4b9fd27dc12d710fe"] // Block Proposed Topic Hash

      };

      const logs = await SepoliaProvider.getLogs(filter);

      if (logs.length > 0) {
        console.log(`[task_4] Adding ${logs.length} users`);


        await addBlockProposed(logs.length);
      } else {
        console.log(`[task_4] No logs found`);
      }

      // Set latest block synced to latest block
      await updateLatestBlockSynced("taiko_block_proposed", toBlock.toString());
    }
  }
}

async function main() {


  const app = express();
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });

  // Create endpoints
  app.get("/api/user-proposed-block", async (req, res) => {
    let results = await axios.get(`https://eventindexer.test.taiko.xyz/events?address=${req.query.address}&event=BlockProposed`)
    return res.json({
      data: {
        is_ok: results.data.items.length > 0
      }
    })
  });

  app.get("/api/user-proved-block", async (req, res) => {
    let results = await axios.get(`https://eventindexer.test.taiko.xyz/events?address=${req.query.address}&event=BlockProven`)
    return res.json({
      data: {
        is_ok: results.data.items.length > 0
      }
    })
  });

  app.get("/api/user-swapped-on-taiko", async (req, res) => {
    console.log(req.query.address)
    let results = await Task.findOne({ taskId: "2", address: req.query.address });
    return res.json({
      data: {
        is_ok: results !== null
      }
    })
  });

  app.get("/api/user-bridged", async (req, res) => {
    console.log(req.query.address)
    let results = await Task.findOne({ taskId: "1", address: req.query.address });
    return res.json({
      data: {
        is_ok: results !== null
      }
    })
  });


  await Promise.all([syncL1BridgeTask(), syncL2SwapTask(), syncL1BlockProved(), syncL1BlockProposed()])

}

main()
  .then(() => console.log("Done"))
  .catch((error) => console.error(error.stack));

async function addL1BridgeVolume(depositValue: any) {
  await Stats.findOneAndUpdate(
    { id: "l1_bridge_volume" }, // Criteria to find the document
    { id: "l1_bridge_volume", $inc: { ["value"]: depositValue } }, // The update operation to add the value to the existing field
    { new: true, upsert: true } // Optional: Return the modified document instead of the original one
  )
}

async function addBlockProved(value: number) {
  await Stats.findOneAndUpdate(
    { id: "l1_block_proved" }, // Criteria to find the document
    { id: "l1_block_proved", $inc: { ["value"]: value } }, // The update operation to add the value to the existing field
    { new: true, upsert: true } // Optional: Return the modified document instead of the original one
  )
}

async function addBlockProposed(value: number = 1) {
  await Stats.findOneAndUpdate(
    { id: "l1_block_proposed" }, // Criteria to find the document
    { id: "l1_block_proposed", $inc: { ["value"]: value } }, // The update operation to add the value to the existing field
    { new: true, upsert: true } // Optional: Return the modified document instead of the original one
  )
}
async function addL2BridgeVolume(depositValue: any) {

  // Get L2Volume from Stats

  // If L2Volume does not exist, create

  // Add depositValue to value

  // Save
}
/**
 * This function will update the list of whitelisted addresses
 * for a particular task
 */
function updateGalaxe(task_id: any, whitelistedIds: any[]) {

  // Initialize Galaxe

  // Call Galaxe Update function

}
