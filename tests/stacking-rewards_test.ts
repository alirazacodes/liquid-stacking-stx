import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
} from "https://deno.land/x/clarinet@v1.4.0/index.ts";
import { assertEquals } from "https://deno.land/std@0.170.0/testing/asserts.ts";

Clarinet.test({
  name: "Ensure that users can stack STX",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Stack some STX
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(100)],
        user.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Ensure that users can't stack more STX than the contract allows",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Try to stack more STX than the contract allows
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(201)],
        user.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(err u5)");
  },
});

Clarinet.test({
  name: "Ensure that users can unstack STX",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Stack some STX
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(100)],
        user.address
      ),
      // Unstack some STX
      Tx.contractCall(
        "stacking-rewards",
        "unstack-stx",
        [types.uint(50)],
        user.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");
    assertEquals(block.receipts[1].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Ensure that users can't unstack more STX than they have stacked",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Try to unstack more STX than the user has stacked
      Tx.contractCall(
        "stacking-rewards",
        "unstack-stx",
        [types.uint(100)],
        user.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(err u4)");
  },
});

Clarinet.test({
  name: "Ensure that only the contract owner can convert rewards",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let contractOwner = accounts.get("deployer");
    let nonOwner = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Attempt to convert rewards as non-owner
      Tx.contractCall(
        "stacking-rewards",
        "convert-rewards",
        [types.uint(1000)],
        nonOwner.address
      ),
      // Attempt to convert rewards as owner
      Tx.contractCall(
        "stacking-rewards",
        "convert-rewards",
        [types.uint(1000)],
        contractOwner.address
      ),
    ]);
    // The first transaction should have failed, and the second should have succeeded
    assertEquals(block.receipts[0].result, "(err u1)");
    assertEquals(block.receipts[1].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Ensure that users can withdraw their rewards",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user = accounts.get("wallet_1");
    let contractOwner = accounts.get("deployer");
    let block = chain.mineBlock([
      // Stack some STX
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(100)],
        user.address
      ),
      // Convert some rewards
      Tx.contractCall(
        "stacking-rewards",
        "convert-rewards",
        [types.uint(1000)],
        contractOwner.address
      ),
      // Withdraw rewards
      Tx.contractCall("stacking-rewards", "withdraw-rewards", [], user.address),
    ]);
    assertEquals(block.receipts[0].result, "(ok true)");
    assertEquals(block.receipts[1].result, "(ok true)");
    assertEquals(block.receipts[2].result, "(ok u1000)");
  },
});

Clarinet.test({
  name: "Ensure that only the contract owner can distribute rewards",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let contractOwner = accounts.get("deployer");
    let nonOwner = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Attempt to distribute rewards as non-owner
      Tx.contractCall(
        "stacking-rewards",
        "distribute-rewards",
        [],
        nonOwner.address
      ),
      // Attempt to distribute rewards as owner
      Tx.contractCall(
        "stacking-rewards",
        "distribute-rewards",
        [],
        contractOwner.address
      ),
    ]);
    // The first transaction should have failed, and the second should have succeeded
    assertEquals(block.receipts[0].result, "(err u1)");
    assertEquals(block.receipts[1].result, "(ok true)");
  },
});

Clarinet.test({
  name: "Ensure that the user details are correctly returned",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user = accounts.get("wallet_1");
    let block = chain.mineBlock([
      // Stack some STX
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(100)],
        user.address
      ),
    ]);
    let call = Tx.contractCall(
      "stacking-rewards",
      "get-user-details",
      [types.principal(user.address)],
      user.address
    );
    let receipt = await chain.callReadOnlyFn(call);
    assertEquals(
      receipt.result,
      '(ok (some {"stacked-stx": u100, "sbtc-rewards": u0}))'
    );
  },
});

Clarinet.test({
  name: "Ensure that the total stacked STX and rewards are correctly returned",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let user1 = accounts.get("wallet_1");
    let user2 = accounts.get("wallet_2");
    let contractOwner = accounts.get("deployer");
    let block = chain.mineBlock([
      // User1 and User2 stack some STX
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(100)],
        user1.address
      ),
      Tx.contractCall(
        "stacking-rewards",
        "stack-stx",
        [types.uint(200)],
        user2.address
      ),
      // Convert some rewards
      Tx.contractCall(
        "stacking-rewards",
        "convert-rewards",
        [types.uint(1000)],
        contractOwner.address
      ),
    ]);
    let call = Tx.contractCall(
      "stacking-rewards",
      "get-total-stacked-stx-and-rewards",
      [],
      user1.address
    );
    let receipt = await chain.callReadOnlyFn(call);
    assertEquals(
      receipt.result,
      '(ok {"total-stacked-stx": u300, "total-sbtc-rewards": u1000})'
    );
  },
});
