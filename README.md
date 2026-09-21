# Multicall3_Testing

##REPORT ON ARC TESTNET 

##ISSUE:
USER-SUPPLIED USDC/ETH ARE LOST AND PERMANTLY TRAPPED IN THE Multicall3 CONTRACT WITH NO RECOVERY MECHANISM IN FUNCTION "aggregate3Value()" #L88-125

SEVERNTY:HIGH


##SUMMARY: Functions like aggregate,tryaggregate etc are marked payable purely for gas optimization. When a user double sends the native token for gas(USDC)the first transaction reverts back according to the contract logic but the second transaction is stuck forever in the the Multicall3 contract

##VULNERABILTY DETAILS:At #L  Multicall3.aggregate3Value()` allows a caller to batch several calls, each carrying its own native-value transfer, with a per-call `allowFailure` flag. When a call has `allowFailure = true`, carries a nonzero `value`, and that call **fails** (e.g., the target has no `receive()`/`fallback()`), the attempted value transfer is atomically reverted by the EVM — but execution of the *outer* transaction continues, and the final validation check only verifies that `msg.value` equals the *sum of all attempted values*, not the sum of *successfully delivered* values. The result: that value is never delivered anywhere, is never refunded, and permanently increases Multicall3's own contract balance. The transaction reports success. There is no event, no revert, and no recovery mechanism (Multicall3 holds no state and has no withdrawal function).

##PROOF OF CONCEPT(POC): This is a contract logic and it doesn't change, it's third-party, MIT-licensed infrastructure (`github.com/mds1/multicall`) that gets deployed at the same deterministic address on most EVM-compatible chains. I made use the sepolia instead of arc while testing,the explorer is down or something and its verifiable on the sepolia eth explorer, below are details and contract address and transactions that are verifiable on the explorer

Deployer: 0x4f6734EeC17748975F92a7ea43B9c9385A087D52
Balance: 0.047321775379236887 ETH

The Deployed Multicall3 Contract...
✓ Multicall3 deployed: 0x183F049eF1b1aF20371982f28Bf75E395Bb8e753
  https://sepolia.etherscan.io/address/0x183F049eF1b1aF20371982f28Bf75E395Bb8e753

Deploying ValueLockPoCConfigurable...
✓ PoC deployed: 0xcDE8750f858b6191e5DA07d24ea0a91e4267607D
  https://sepolia.etherscan.io/address/0xcDE8750f858b6191e5DA07d24ea0a91e4267607D
✓ Confirmed on-chain bytecode contains the expected selector

Calling run(0.01 ETH, 0.01 ETH) with value 0.02 ETH...
Tx sent: 0x9458b21274adb91ea23ba5a10b4b1221e052e4f15868bfa464007c450c6c6fe4
  https://sepolia.etherscan.io/tx/0x9458b21274adb91ea23ba5a10b4b1221e052e4f15868bfa464007c450c6c6fe4

Tx status: 1 (success)

Multicall3 balance change: 0.01 ETH (expect 0.01 ETH)

NOTE: I actually ran this so you can see that the contract 0x183F049eF1b1aF20371982f28Bf75E395Bb8e753(Multicall3 deployed)
 holds 0.01 ETH that can't be reverted back and its locked forever because there's no recovery mechanism

the transaction hash;
0x9458b21274adb91ea23ba5a10b4b1221e052e4f15868bfa464007c450c6c6fe4(this is the failed txn)
0x9458b21274adb91ea23ba5a10b4b1221e052e4f15868bfa464007c450c6c6fe4(this is the successful txn)

##STEPS TO REPRODUCE USING THE BASH TERMINAL

``bash
mkdir multicall3-sepolia && cd multicall3-sepolia
npm init -y
npm install ethers 
```

COPY IN THESE THREE FILES; Multicall3-official_1.sol,compiled-artifacts-configurable.json,valueLockPoCConfigurable (2).sol
 FROM MY GITHUB REPO: https://github.com/johnberchy/Multicall3_Testing.git

Your folder should look like this 
multicall3-sepolia-v2/
├── compiled-artifacts-configurable.json
├──  Multicall3-official_1.sol
├── valueLockPoCConfigurable (2).sol
├── package.json
└── node_modules/

CREATE ANOTHER FOLDER INSIDE THE FIRST FOLDER
mkdir multicall3-sepolia-v2 && cd multicall3-sepolia-v2
npm init -y
npm install ethers

COPY IN deploy-and-run.cjs and compiled-artifacts-configurable.json
 FROM MY GITHUB REPO: https://github.com/johnberchy/Multicall3_Testing.git

Your folder should look like this
multicall3-sepolia-v2/
├── compiled-artifacts-configurable.json
├── deploy-and-run.cjs
└── package.json

OPEN deploy-and-run.cjs and edit to your own actual private key with faucet inside and RPC_URL

const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/alch_O4-ZTL6oHla33YKUvlVX7";
const PRIVATE_KEY = "76bc14d1f9e510160a238cc6a73cd8939fe085e693bc124a063921cda0398297";

THEN RUN 

node deploy-and-run.cjs


##IMPACT:  Permanent loss of user funds with no mitigation or recovery path.


##RECOMMENDED FIX:
Create a second function that doesn't accept value

THANK YOU AND I HOPE TO HEAR FROM YOU GUYS SOON

 


 
