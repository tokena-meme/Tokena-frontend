import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://solana-rpc.publicnode.com');
const programId = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');

async function main() {
  const accounts = await connection.getProgramAccounts(programId, {
    dataSlice: { offset: 0, length: 0 }
  });
  console.log(`Found ${accounts.length} accounts`);

  // Get first account data to see size
  if (accounts.length > 0) {
    const info = await connection.getAccountInfo(accounts[0].pubkey);
    console.log(`Account size: ${info?.data.length}`);
    console.log(`Account data (hex): ${info?.data.toString('hex').slice(0, 100)}`);
  }
}

main();
