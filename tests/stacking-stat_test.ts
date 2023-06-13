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
    let wallet1 = accounts.get("wallet_1")!;
    let wallet2 = accounts.get("wallet_2")!;

    // Try adding a strategy with a non-owner account
    let block = chain.mineBlock([
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
      "(ok (tuple (active true) (allocation u100)))"
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
    assertEquals(block.receipts[0].result, "(ok true)");

    // Add to the pool with user 2
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "add-to-pool",
        [types.uint(500), types.uint(2), types.uint(1)],
        wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok u500)");

    // Check the total pooled stx
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-total-pooled-stx",
        [],
        wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "u500");

    // Remove from the pool with user 2
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "remove-from-pool",
        [types.uint(200), types.uint(2)],
        wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result);

    // Check the total pooled stx after removal
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-total-pooled-stx",
        [],
        wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "u300");

    // Check the user details after removal
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "get-user-details",
        [types.uint(2)],
        wallet2.address
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

    // Try changing ownership with a non-owner account
    let block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy-owner",
        [wallet2.address],
        wallet2.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(err u1)"); // ERR_NOT_AUTHORIZED

    // Change ownership with the owner account
    block = chain.mineBlock([
      Tx.contractCall(
        "stacking-stat",
        "set-strategy-owner",
        [wallet2.address],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");
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
