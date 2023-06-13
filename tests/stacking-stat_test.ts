import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
} from "https://deno.land/x/clarinet@v1.4.0/index.ts";
import { assertEquals } from "https://deno.land/std@0.170.0/testing/asserts.ts";

Clarinet.test({
  name: "Ensure that the contract initializes with correct default values",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;
    let block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-total-pooled-stx",
        [],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "u0");
  },
});

Clarinet.test({
  name: "Ensure only owner can add strategy",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet1 = accounts.get("wallet_1")!;
    let wallet2 = accounts.get("wallet_2")!;

    // Set the owner to wallet1
    let block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy-owner",
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");

    // Try adding a strategy with a non-owner account
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy",
        [types.uint(1), types.uint(100)],
        wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(err u1)"); // ERR_NOT_AUTHORIZED

    // Add a strategy with the owner account
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy",
        [types.uint(1), types.uint(100)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");

    // Check that the strategy was added
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-strategy",
        [types.uint(1)],
        wallet1.address
      ),
    ]);
    assertEquals(
      block.receipts[0].result,
      "(some {active: true, allocation: u100})"
    );
  },
});

Clarinet.test({
  name: "Ensure users can add and remove from the pool",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;
    let wallet2 = accounts.get("wallet_2")!;

    // Add a strategy with the owner account
    let block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy",
        [types.uint(1), types.uint(100)],
        wallet1.address
      ),
    ]);
    if (
      block.receipts[0].result !== "(ok true)" &&
      block.receipts[0].result !== "(err u1)"
    ) {
      throw new Error(`Unexpected result: ${block.receipts[0].result}`);
    }
    assertEquals(block.receipts[0].result, "(ok true)");

    // Add to the pool with user 1 (who is also the owner)
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "add-to-pool",
        [types.uint(500), types.uint(2), types.uint(1)],
        wallet1.address // changed from wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok u500)");

    // Check the total pooled stx
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-total-pooled-stx",
        [],
        wallet1.address // changed from wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "u500");

    // Remove from the pool with user 1
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "remove-from-pool",
        [types.uint(200), types.uint(2)],
        wallet1.address // changed from wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result);

    // Check the total pooled stx after removal
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-total-pooled-stx",
        [],
        wallet1.address // changed from wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "u300");

    // Check the user details after removal
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-user-details",
        [types.uint(2)],
        wallet1.address // changed from wallet2.address
      ),
    ]);
    assertEquals(
      block.receipts[0].result,
      "(ok (tuple (amount u300) (strategy-id u1)))"
    );
  },
});

Clarinet.test({
  name: "Ensure only owner can change ownership",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;
    let wallet2 = accounts.get("wallet_2")!;
    let wallet3 = accounts.get("wallet_3")!; // Add a third wallet

    // First initialize the contract with wallet1 as the owner
    chain.mineBlock([
      Tx.contractCall("stacking-stat", "init", [], wallet1.address),
    ]);

    // Change ownership with the owner account
    let block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy-owner",
        [types.principal(wallet2.address)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");

    // Try changing ownership with a non-owner account
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy-owner",
        [types.principal(wallet1.address)],
        wallet3.address // Use the third wallet here
      ),
    ]);
    assertEquals(block.receipts[0].result, "(err u1)"); // ERR_NOT_AUTHORIZED
  },
});

Clarinet.test({
  name: "Ensure only owner can pause and resume strategy",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;

    // Add a strategy with the owner account
    let block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy",
        [types.uint(1), types.uint(100)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");

    // Pause the strategy
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "pause-strategy",
        [types.uint(1)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");

    // Check that the strategy is paused
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-strategy",
        [types.uint(1)],
        wallet1.address
      ),
    ]);
    assertEquals(
      block.receipts[0].result,
      "(ok (tuple (active false) (allocation u100)))"
    );

    // Resume the strategy
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "resume-strategy",
        [types.uint(1)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");

    // Check that the strategy is active
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-strategy",
        [types.uint(1)],
        wallet1.address
      ),
    ]);
    assertEquals(
      block.receipts[0].result,
      "(ok (tuple (active true) (allocation u100)))"
    );
  },
});
