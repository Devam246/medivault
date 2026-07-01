import Web3 from "web3";
import fs from "fs/promises";
import { getPrivateKey } from "../config/env.js";
let blockchainContext = null;
//comment

async function loadAbi() {
  if (process.env.CONTRACT_ABI_JSON) {
    return JSON.parse(process.env.CONTRACT_ABI_JSON);
  }

  if (process.env.CONTRACT_ABI_PATH) {
    const abiRaw = await fs.readFile(process.env.CONTRACT_ABI_PATH, "utf-8");
    return JSON.parse(abiRaw);
  }

  throw new Error("Missing contract ABI. Set CONTRACT_ABI_JSON or CONTRACT_ABI_PATH in .env");
}
export async function addRecordToBlockchain(fileHash) {
  const { contract, account } = await initializeBlockchain();

  console.log(`[Blockchain] Using contract address: ${contract.options.address}`);

  // Read count() BEFORE transaction
  let beforeCount = null;
  try {
    beforeCount = await contract.methods.count().call();
    console.log(`[Blockchain] count() BEFORE transaction: ${beforeCount}`);
  } catch (err) {
    console.error(`[Blockchain] Error reading count() before transaction:`, err);
  }

  console.log(`[Blockchain] Sending addRecord for file hash: ${fileHash}`);
  console.log(`[Blockchain] From wallet address: ${account.address}`);

  let receipt;
  try {
    receipt = await contract.methods.addRecord(fileHash).send({
      from: account.address
    });
    console.log(`[Blockchain] Transaction mined! Hash: ${receipt.transactionHash}, Block: ${receipt.blockNumber}`);
  } catch (err) {
    console.error(`[Blockchain] Error in addRecord transaction:`, err);
    throw err;
  }

  // Read count() AFTER transaction
  let afterCount = null;
  try {
    afterCount = await contract.methods.count().call();
    console.log(`[Blockchain] count() AFTER transaction: ${afterCount}`);
  } catch (err) {
    console.error(`[Blockchain] Error reading count() after transaction:`, err);
  }

  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    owner: account.address,
    beforeCount: beforeCount?.toString(),
    afterCount: afterCount?.toString()
  };
}

async function initializeBlockchain() {
  if (blockchainContext) {
    return blockchainContext;
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = getPrivateKey();
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    throw new Error("Missing blockchain config. Required: SEPOLIA_RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS");
  }

  const normalizedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const abi = await loadAbi();


  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  const account = web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;

  const contract = new web3.eth.Contract(abi, contractAddress);

  blockchainContext = {
    web3,
    contract,
    account
  };

  return blockchainContext;
}


