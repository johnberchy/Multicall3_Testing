const { ethers } = require("ethers");
const fs = require("fs");

// Fill these in with your own keys
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/alch_O4-ZTL6oHla33YKUvlVX7";
const PRIVATE_KEY = "76bc14d1f9e510160a238cc6a73cd8939fe085e693bc124a063921cda0398297"; // testnet only, never mainnet

async function main() {
  const build = JSON.parse(fs.readFileSync("compiled-artifacts-configurable.json", "utf8"));
  const mc3 = build.contracts["Multicall3.sol"]["Multicall3"];
  const poc = build.contracts["ValueLockPoCConfigurable.sol"]["ValueLockPoCConfigurable"];

  //  Sanity check: confirm we're using the 2-argument run(), not the old 0-argument one 
  const pocIface = new ethers.Interface(poc.abi);
  const expectedRunSelector = ethers.id("run(uint256,uint256)").slice(0, 10);
  const actualRunFragment = poc.abi.find((f) => f.type === "function" && f.name === "run");
  const actualRunSelector = pocIface.getFunction("run").selector;
  console.log("Expected run() selector:", expectedRunSelector);
  console.log("Actual run() selector in this ABI:", actualRunSelector);
  if (actualRunSelector !== expectedRunSelector) {
    throw new Error(
      "ABI mismatch! This is not the 2-argument run(uint256,uint256) from ValueLockPoCConfigurable. " +
      "Check you're reading compiled-artifacts-configurable.json, not the old compiled-artifacts.json."
    );
  }
  console.log("✓ Confirmed: using the correct configurable run(uint256,uint256)\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);
  const startBalance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(startBalance), "ETH");
  if (startBalance < ethers.parseEther("0.03")) {
    console.warn("  Warning: you may not have enough Sepolia ETH for deploy + call. Get more from a faucet.");
  }

  //  Deploy Multicall3 
  console.log("\nDeploying Multicall3...");
  const Mc3Factory = new ethers.ContractFactory(mc3.abi, mc3.evm.bytecode.object, wallet);
  const mc3Contract = await Mc3Factory.deploy();
  await mc3Contract.waitForDeployment();
  const mc3Addr = await mc3Contract.getAddress();
  console.log("✓ Multicall3 deployed:", mc3Addr);
  console.log("  https://sepolia.etherscan.io/address/" + mc3Addr);

  // Deploy PoC
  console.log("\nDeploying ValueLockPoCConfigurable...");
  const PocFactory = new ethers.ContractFactory(poc.abi, poc.evm.bytecode.object, wallet);
  const pocContract = await PocFactory.deploy(mc3Addr);
  await pocContract.waitForDeployment();
  const pocAddr = await pocContract.getAddress();
  console.log("✓ PoC deployed:", pocAddr);
  console.log("  https://sepolia.etherscan.io/address/" + pocAddr);

  // Post-deploy verification: confirm the on-chain bytecode actually has the 2-arg selector
  const onChainCode = await provider.getCode(pocAddr);
  if (!onChainCode.includes(expectedRunSelector.slice(2))) {
    throw new Error("Deployed bytecode does NOT contain the expected run(uint256,uint256) selector. Stopping before spending more gas.");
  }
  console.log(" Confirmed on-chain bytecode contains the expected selector\n");

  // --- Call run() with small, testnet-realistic amounts ---
  const failingAmount = ethers.parseEther("0.01");
  const succeedingAmount = ethers.parseEther("0.01");
  const totalValue = failingAmount + succeedingAmount;

  console.log(`Calling run(${ethers.formatEther(failingAmount)} ETH, ${ethers.formatEther(succeedingAmount)} ETH) with value ${ethers.formatEther(totalValue)} ETH...`);

  const mc3Before = await provider.getBalance(mc3Addr);

  const tx = await pocContract.run(failingAmount, succeedingAmount, { value: totalValue });
  console.log("Tx sent:", tx.hash);
  console.log("  https://sepolia.etherscan.io/tx/" + tx.hash);

  const receipt = await tx.wait();
  console.log("\nTx status:", receipt.status, receipt.status === 1 ? "(success)" : "(REVERTED)");

  const mc3After = await provider.getBalance(mc3Addr);
  const trapped = mc3After - mc3Before;

  console.log("\nMulticall3 balance change:", ethers.formatEther(trapped), "ETH (expect", ethers.formatEther(failingAmount), "ETH)");

  if (receipt.status === 1 && trapped === failingAmount) {
    console.log("\n CONFIRMED on Sepolia: value got trapped in Multicall3 exactly as predicted.");
  } else if (receipt.status !== 1) {
    console.log("\n Transaction reverted — check the tx link above on Etherscan for the revert reason.");
  } else {
    console.log("\n  Unexpected result — trapped amount doesn't match prediction, investigate.");
  }
}

main().catch((err) => {
  console.error("\nSCRIPT ERROR:", err.shortMessage || err.message || err);
  process.exit(1);
});
