# Deep Dive: The "Time-of-Check to Time-of-Use" (TOCTOU) Race Condition

This document provides a detailed technical explanation of the race condition (also known as a "Double-Spending Bug") found in the AegisVault Account Service.

## The Flawed Code

In `services/account-service/src/controllers/account.controller.js`, inside the `executeTransfer` function, the code handles fund transfers using a Prisma transaction. However, the logic looks like this:

```javascript
// Step 1: TIME OF CHECK
// Read the sender's account from the database
const sender = await tx.account.findFirst({ ... });

// In Node.js Memory: Check if the balance is sufficient
const senderBalance = Number(sender.balance);
if (senderBalance < transferAmount) {
  throw new Error('Insufficient funds');
}

// ... some other code ...

// Step 2: TIME OF USE
// Update the database to deduct the money
await tx.account.update({
  where: { id: sender.id },
  data: {
    balance: { decrement: transferAmount }
  }
});
```

## Technical Explanation: Why this is a Race Condition

A race condition occurs when a system attempts to perform two or more operations at the same time, but because of the nature of the device or system, the operations must be done in the proper sequence to be done correctly. 

In this case, the flaw is assuming that the balance read in Step 1 will remain the same until Step 2 is executed. Prisma's `findFirst` inside a `$transaction` **does not lock the database row** in PostgreSQL by default. It simply reads the current value.

### The Attack Scenario
Imagine a user has `LKR 1,000` in their account. They write a script to send two HTTP requests to transfer `LKR 1,000` to a friend at the exact same millisecond.

1. **Request A** hits `findFirst` and reads the balance as `1,000`.
2. **Request B** hits `findFirst` (while Request A is still processing) and also reads the balance as `1,000`.
3. **Request A** hits the `if (1000 < 1000)` check in memory. It passes.
4. **Request B** hits the `if (1000 < 1000)` check in memory. It passes.
5. **Request A** hits the database and runs `{ decrement: 1000 }`. The DB balance drops to `0`.
6. **Request B** hits the database and runs `{ decrement: 1000 }`. The DB balance drops to `-1,000`.

## The Result (Impact in a Hackathon/Production)

This is a critical security vulnerability known as **Double Spending**. A user has successfully transferred `LKR 2,000` while only possessing `LKR 1,000`. 

If judges or security testers in a hackathon write a simple Python script to barrage the `/transfer` endpoint with 10 concurrent requests, the system will process all of them, driving the user's account deep into negative balances and artificially creating money out of thin air on the recipient's end.

## The Fix (Conditional Atomic Update)

To fix a TOCTOU bug safely without breaking other parts of the system, we must use a **Conditional Atomic Update**.

While another option is "Row-Level Locking" using Raw SQL (`SELECT ... FOR UPDATE`), that approach is highly dangerous in a microservice setup because it frequently causes **Database Deadlocks**. If two users send money to each other at the exact same millisecond, the database locks will freeze, and the requests will crash.

Instead, we use Prisma's `updateMany` to atomically check the balance *at the exact moment of the update*, completely avoiding deadlocks and race conditions.

```javascript
const updatedSender = await tx.account.updateMany({
  where: { 
    id: sender.id, 
    balance: { gte: transferAmount } // Atomically check AT update time
  },
  data: {
    balance: { decrement: transferAmount }
  }
});

// If the count is 0, the balance changed between read and write, or was too low
if (updatedSender.count === 0) {
    throw new Error('Insufficient funds (Balance changed during transaction)');
}
```
