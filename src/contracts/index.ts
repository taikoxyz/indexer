import { SepoliaProvider, TaikoProvider } from "../providers";

import { ethers } from "ethers";

// Taiko Bridge Sepolia instance
export const TaikoBridgeL1 = new ethers.Contract(
  "0x7D992599E1B8b4508Ba6E2Ba97893b4C36C23A28",
  require("../abi/TaikoBridgeL1.json"),
  SepoliaProvider
);

export const TaikoBridgeL2 = new ethers.Contract(
  "0x1000777700000000000000000000000000000004",
  require("../abi/TaikoBridgeL2.json"),
  TaikoProvider
);

export const TaikoSwap = new ethers.Contract(
  "",
  require("../abi/TaikoSwap.json"),
  TaikoProvider
);
