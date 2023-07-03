import "dotenv/config";

import { ethers } from "ethers";

export const SepoliaProvider = new ethers.providers.JsonRpcProvider(
  process.env.SEPOLIA_RPC
);

export const TaikoProvider = new ethers.providers.JsonRpcProvider(
  process.env.TAIKO_RPC
);
