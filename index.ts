import type { Cell, Script, CellDep, Address } from "@ckb-lumos/lumos"
import { config, hd, Indexer, RPC, BI, helpers } from "@ckb-lumos/lumos"
import { bytes, Uint128 } from "@ckb-lumos/lumos/codec"
import { createDefaultLockWallet } from "./helper";
import { number } from '@ckb-lumos/codec';
import * as fs from 'fs';
import { promisify } from 'util';
import { createSpore, predefinedSporeConfigs, createCluster } from "@spore-sdk/core";
import { unpackToRawSporeData, unpackToRawClusterData } from "@spore-sdk/core";

// to work with the testnet
config.initializeConfig(config.TESTNET)
const lumosConfig = config.TESTNET;
//const netURL = "http://localhost:8114";
const netURL = "https://testnet.ckb.dev";
// indexer for cell provider
const indexer = new Indexer(netURL);
// rpc to interact with the CKB node
const rpc = new RPC(netURL);

const rootKey = "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6"; // Account 0 key on local node - use your testnet key here

async function createSporeCluster(privkey: string, name: string, description: string, scriptURI: string): Promise<{ txHash: string, outputIndex: number, sporeId: string }> {
  const wallet = createDefaultLockWallet(privkey);
  const blake160 = hd.key.privateKeyToBlake160(privkey);

  console.log("blake160: ", blake160);
  console.log("address: ", wallet.address);

  const config = predefinedSporeConfigs.Testnet;
  const Secp256k1Blake160 = config.lumos.SCRIPTS.SECP256K1_BLAKE160!;

  const ownerLock: Script = {
    codeHash: Secp256k1Blake160.CODE_HASH,
    hashType: Secp256k1Blake160.HASH_TYPE,
    args: blake160,
  };
  const ownerLockAddress: string = helpers.encodeToAddress(ownerLock, {
    config: config.lumos,
  });

  // If minCkb == undefined, there is no cost for referencing your cluster
  // If minCkb >= 0, each transaction that references the cluster requires a minimum capacity cost of 10^minCkb
  const minCkb: number | undefined = 0;
  const minimalCkb = minCkb !== void 0
    ? bytes.hexify(number.Uint8.pack(minCkb as number))
    : '';

  const AnyoneCanPay = config.lumos.SCRIPTS.ANYONE_CAN_PAY!;

  // ACP script doesn't seem to work like this
  const acpLock: Script = {
    codeHash: AnyoneCanPay.CODE_HASH,
    hashType: AnyoneCanPay.HASH_TYPE,
    args: `${blake160}${minimalCkb.slice(2)}`,
  };

  let { txSkeleton, outputIndex } = await createCluster({
    data: {
      name: name,
      description: description,
      scriptURI: scriptURI,
    },
    //toLock: acpLock,
    toLock: wallet.lock,
    fromInfos: [ownerLockAddress],
  });

  const txHash = await wallet.signAndSendTransaction(txSkeleton);
  const sporeId = txSkeleton.get("outputs").get(outputIndex)!.cellOutput.type!.args;
  console.log(`Spore created at transaction: ${txHash}`);
  console.log(
    `Spore ID: ${sporeId}`
  );
  return { txHash, outputIndex, sporeId };
}

export async function showSporeContent(txHash: string, index = 0) {
  const indexHex = "0x" + index.toString(16);
  const { cell } = await rpc.getLiveCell({ txHash, index: indexHex }, true);
  if (cell == null) {
    return alert("cell not found, please retry later");
  }
  const data = cell.data.content;
  const msg = unpackToRawSporeData(data);
  console.log("spore data: ", msg);
  return msg;
}

export async function showSporeClusterContent(txHash: string, index = 0) {
  const indexHex = "0x" + index.toString(16);
  const { cell } = await rpc.getLiveCell({ txHash, index: indexHex }, true);
  if (cell == null) {
    return alert("cell not found, please retry later");
  }
  const data = cell.data.content;
  const msg = unpackToRawClusterData(data);
  const name = msg.name;
  const description = msg.description;
  const scriptURI = msg.scriptURI;
  console.log("spore data: ", name, description, scriptURI);
  return { name, description, scriptURI };
}


export async function createSporeDOBCluster(privkey: string, sporeId: string, content: Uint8Array): Promise<{ txHash: string, outputIndex: number }> {
  const wallet = createDefaultLockWallet(privkey);

  const { txSkeleton, outputIndex } = await createSpore({
    data: {
      contentType: "image/jpeg",
      content,
      clusterId: sporeId,
    },
    toLock: wallet.lock,
    fromInfos: [wallet.address],
    //config: SPORE_CONFIG,
  });

  const txHash = await wallet.signAndSendTransaction(txSkeleton);
  console.log(`Spore created at transaction: ${txHash}`);
  console.log(
    `Spore ID: ${txSkeleton.get("outputs").get(outputIndex)!.cellOutput.type!.args
    }`
  );
  return { txHash, outputIndex };
}

async function mintFullSpore(): Promise<string> {
  const clusterName = "MY NFT Collection";
  const description = "This is a description of my NFT collection";
  const scriptURI = "ipfs://QmthisisanIPFShashlocation"; //TODO: scriptURI should point to a Spore with the TokenScript as payload

  const { txHash, outputIndex, sporeId } = await createSporeCluster(rootKey, clusterName, description, scriptURI);
  const txHashCluster = txHash;

  console.log(`Creating Spore Cluster at ${txHashCluster} ... ${sporeId}`);
  // Pause execution until cell is written
  await waitForCell(txHashCluster, outputIndex);

  //now create the spore
  const fileContent = await readLocalFile("circuit.jpg");
  const { txHash: sporeTx, outputIndex: sporeOutputIndex } = await createSporeDOBCluster(rootKey, sporeId, fileContent); // Do I use SporeId from the cluster TX?

  console.log(`Spore NFT created at transaction: ${sporeTx}`);

  if (netURL.startsWith("https://testnet.ckb.dev")) {
    console.log(`https://pudge.explorer.nervos.org/transaction/${sporeTx}`);
  }

  return txHashCluster;
}

async function readSporeCluster(txHash: string) {
  const res = await showSporeClusterContent(txHash, 0);
  if (!res) return;
  console.log(`${res.name}, ${res.description}, ${res.scriptURI}`);
}

//const txClusterHash = await mintFullSpore();
//await readSporeCluster(txClusterHash);
//NFT TX: 0x730e9b8031c2588d004ffd548643290a703b4ae9dda708594a78fcddac0b6816
await readSporeCluster("0x2c3d22ee5554c06e31b67a7bdf51d300c0280453ca94b77d3e3594b060c1c89d");


//Utils
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const readFileAsync = promisify(fs.readFile);

async function readLocalFile(filename: string): Promise<Uint8Array> {
  try {
    const content = await readFileAsync(filename);
    return new Uint8Array(content);
  } catch (error) {
    //@ts-ignore
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

async function waitForCell(txHash: string, index = 0): Promise<boolean> {
  const indexHex = "0x" + index.toString(16);
  var found = false;
  var maxLoops = 50;

  while (!found && maxLoops > 0) {
    maxLoops--;
    const { cell } = await rpc.getLiveCell({ txHash, index: indexHex }, true);
    if (cell != null) {
      found = true;
    } else {
      console.log('.');
    }
    await sleep(2500);
  }

  return found;
}