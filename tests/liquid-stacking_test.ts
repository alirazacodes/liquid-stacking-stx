import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types,
} from "https://deno.land/x/clarinet@v1.4.0/index.ts";
import { assertEquals } from "https://deno.land/std@0.170.0/testing/asserts.ts";

const ERR_STACK_INSUFFICIENT_FUNDS = 1;
const ERR_UNSTACK_INSUFFICIENT_STACKED = 2;
const ERR_USER_NOT_FOUND = 3;

Clarinet.test({
  name: "Ensure that user initialization works",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;

    let block = chain.mineBlock([
      Tx.contractCall("liquid-stacking", "init-user", [], wallet1.address),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(ok ${wallet1.address})`);
  },
});

Clarinet.test({
  name: "Ensure that stacking works when the user has sufficient funds",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;

    // First, initialize the user
    let block = chain.mineBlock([
      Tx.contractCall("liquid-stacking", "init-user", [], wallet1.address),
    ]);
    assertEquals(block.receipts[0].result, `(ok ${wallet1.address})`);

    // Then, the user tries to stack 1000 STX.
    block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "stack",
        [types.uint(1000)],
        wallet1.address
      ),
    ]);

    // Check that the transaction was successful.
    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, "(ok u1000)");
  },
});

Clarinet.test({
  name: "Ensure that stacking fails when the user does not have sufficient funds",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;
    let wallet1InitialBalance = wallet1.balance; // Get initial balance of wallet1

    // First, initialize the user
    let block = chain.mineBlock([
      Tx.contractCall("liquid-stacking", "init-user", [], wallet1.address),
    ]);
    assertEquals(block.receipts[0].result, `(ok ${wallet1.address})`);

    // The user tries to stack more STX than they have.
    block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "stack",
        // Try to stack more than the initial balance of the wallet
        [types.uint(wallet1InitialBalance + 1000000)], // Assuming the balance is in microSTX
        wallet1.address
      ),
    ]);

    // Check that the transaction failed with the expected error.
    assertEquals(block.receipts.length, 1);
    assertEquals(
      block.receipts[0].result,
      `(err u${ERR_STACK_INSUFFICIENT_FUNDS})`
    );
  },
});

Clarinet.test({
  name: "Ensure that unstacking works when the user has sufficient stacked STX",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;

    // First, initialize the user and stack some STX
    let block = chain.mineBlock([
      Tx.contractCall("liquid-stacking", "init-user", [], wallet1.address),
      Tx.contractCall(
        "liquid-stacking",
        "stack",
        [types.uint(1000)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, `(ok ${wallet1.address})`);
    assertEquals(block.receipts[1].result, "(ok u1000)");

    // The user tries to unstack 500 STX.
    block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "unstack",
        [types.uint(500)],
        wallet1.address
      ),
    ]);

    // Check that the transaction was successful.
    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, "(ok u500)");
  },
});

Clarinet.test({
  name: "Ensure that unstacking fails when the user does not have enough stacked STX",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;

    // First, initialize the user and stack some STX
    let block = chain.mineBlock([
      Tx.contractCall("liquid-stacking", "init-user", [], wallet1.address),
      Tx.contractCall(
        "liquid-stacking",
        "stack",
        [types.uint(500)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, `(ok ${wallet1.address})`);
    assertEquals(block.receipts[1].result, "(ok u500)");

    // The user tries to unstack more STX than they have stacked.
    block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "unstack",
        [types.uint(1000000000)],
        wallet1.address
      ),
    ]);

    // Check that the transaction failed with the expected error.
    assertEquals(block.receipts.length, 1);
    assertEquals(
      block.receipts[0].result,
      `(err u${ERR_UNSTACK_INSUFFICIENT_STACKED})`
    );
  },
});

Clarinet.test({
  name: "Ensure that get-stack-info returns the correct information",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet1 = accounts.get("wallet_1")!;

    // First, initialize the user
    let block = chain.mineBlock([
      Tx.contractCall("liquid-stacking", "init-user", [], wallet1.address),
    ]);
    assertEquals(block.receipts[0].result, `(ok ${wallet1.address})`);

    // Then, stack some STX
    block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "stack",
        [types.uint(500)],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, "(ok u500)");

    // Get the user's stack info.
    block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "get-stack-info",
        [types.principal(wallet1.address)],
        wallet1.address
      ),
    ]);

    // Check that the transaction was successful and returned the correct data.
    assertEquals(block.receipts.length, 1);
    let stackInfo = block.receipts[0].result.expectOk().expectTuple();

    // Parse the returned value to an integer
    let stackedAmount = parseInt(stackInfo["stacked"].substring(1));

    // Check that the returned information is correct.
    assertEquals(stackedAmount, 500);
  },
});

Clarinet.test({
  name: "Ensure that get-stack-info fails when the user is not found",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet2 = accounts.get("wallet_2")!;
    // Ensure that wallet_2 is not initialized as a user
    let block = chain.mineBlock([
      Tx.contractCall(
        "liquid-stacking",
        "get-stack-info",
        [types.principal(wallet2.address)],
        wallet2.address
      ),
    ]);

    // Check that the transaction failed with the expected error.
    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(err u${ERR_USER_NOT_FOUND})`);
  },
});
