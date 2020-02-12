# FAQ

## Fraud Proof Protocol

The initial version of NutBerry used an interactive verification game (solEVM-enforcer) as fraud proving mechanism.
It became clear that this is not practicable for a side-chain because the nature of verification games is interactive, time bound and most importantly there can be any number of disputes happening at the same time and that becomes a real problem regarding root-chain congestion.

Version 2, Gated Computing, this is non-interactive and a dispute only needs to be done once for a NutBerry-Block.
As a side effect, this also removes a lot of system complexity.
Though, at the time of writing, the Gated Computing model is not implemented to full extent.
That means that any single transaction still needs to fit into a single root-chain transaction.
This may not be a problem yet, because most applications don’t benefit from this.
If NutBerry takes off and if developers need more resources inside a single transaction, then this will be revisited again.

## State-Root Commitments

Indeed, there are no state-roots yet, though this was planned from the beginning.
At the moment, all state is stored on the root-chain bridge contract. That was the fastest way to a working prototype.
Turns out, that this could be even used in production, because due to the nature of most applications, storage slots are mostly updated.
That makes that actually still feasible to run in production.
NutBerry will, of course, use state-roots in the future, as they also have the nice property that any number of non-finalized blocks can be finalized (collapsed/rolled up) inside a single transaction.

## Contract Restrictions

Any single transaction must still be verifiable on the root-chain via Gated Computing (that adds overhead, but not much).
What can be verifiable on the root-chain is, of course, a moving/dynamic target.
The Bridge contract will provide helper functions to help clients implementations to find this out.

* Static-calls to precompiles are allowed.
* Calls to other contracts are not supported *yet*, except for the common ERC20/ERC721 calls:
  * balanceOf()
  * approve()
  * allowance()
  * transfer()
  * transferFrom()
  * ownerOf()
  * getApproved()

Additionally the following opcodes are not supported:

* 0x31 BALANCE
* 0x3a GASPRICE
* 0x3c EXTCODECOPY
* 0x3f EXTCODEHASH
* 0x40 BLOCKHASH
* 0x41 COINBASE
* 0x42 TIMESTAMP
* 0x43 NUMBER
* 0x44 DIFFICULTY
* 0x45 GASLIMIT
* 0x46 CHAINID
* 0x47 SELFBALANCE
* 0xf0 CREATE
* 0xf2 CALLCODE
* 0xf4 DELEGATECALL
* 0xf5 CREATE2
* 0xff SELFDESTRUCT

*BLOCKHASH and/or NUMBER is planned to be supported in the future.*

## Gated Computing

Sadly, I have no more resources right now, except for the cryptic Solidity/Yul implementation. 😂
In a nutshell, the current Gated Computing model does:

1. Copy the root-chain bytecode of the target contract.
2. Analyse the bytecode and overwrite any unsupported opcodes.
3. Overwrite control-flow handlers and XXXcall opcodes, so that we can safely delegate those calls.
4. Deploy the modified bytecode.
5. Call into the modified bytecode inside the context of the Bridge.
6. And the last step (that is not implemented yet) is to destroy the contract again. 😁

## Instant Transactions?

No channel components. I think of three security models that developers/users can choose from.

* Slow, (the final finality 🤣), finality once the block is finalized on the bridge.
* Timely, developer produces a block and waits until it is submitted on the root-chain.
  * And re-validates the transactions if there are any other blocks submitted before him - in the meantime.
  * Checks for Double spend attacks, if any transactions have a different outcome now and so on.
* Instant, developers’s node verifies the transaction and if valid assumes honest user and developer sees the transaction as already final.
  * This option is fine for low-value transactions / outcomes.
  * But the transaction could be invalid later if any malicious users submits another transaction with the same nonce before him. (That renders the transaction the developer node received invalid)

## Permission-less

NutBerry is permission-less and without any governance.

Withdrawing tokens works via doing a transfer()/transferFrom() with a side-chain transaction to `address(0)`.
Once this block with that transaction is finalized, the user can call the Bridge on the root-chain and finally transfer the tokens back into his/her control.
By the way, smart contracts on the side-chain can also exit tokens and the corresponding contract on the root-chain can withdraw them. ✊

## Chain Security

Developers should be encouraged to run a node to keep the network secure.
Technically, the whole NutBerry-node can also run inside the browser/dApp itself,
that means developers have also the option to embed the NutBerry node inside the application and using a PubSub like endpoint to exchange transactions,
thus makes it possible that every user can secure the chain as a opt-in feature for example.

In any case, developers using the chain have to factor the root-chain transaction costs in,
NutBerry provides no gas fee framework, it’s up to the developers/users to find a sustainable way,
this can be as simple as collecting fees inside smart contracts on the side-chain.

## Block Producers

A block producer has to provide a bond for every proposed block.
The size of the bond is going to be dynamic, probably going to depends on the root-chain block gas limit.
That bond serves to reduce the costs of finalizing or disputing that block by any party.
Anyone who finalises and/or challenges the block gets reimbursed, but always less than the actual costs to de-motivate grieving attacks.

The bad scenario with this mechanism is that individual block producers can be attacked by always running a dispute against a given block.

The good thing about it:

* It’s simple and has low complexity.
* Block producers can estimate the worst-case costs.
* Any leftovers can be claimed by the proposer after the block is finalized.
