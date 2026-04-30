import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const connection = new Connection('https://solana-rpc.publicnode.com');
const programId = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
const disc = Buffer.from('f19a6d0411b16dbc', 'hex');

async function main() {
  try {
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(disc) } }
      ],
      dataSlice: { offset: 0, length: 100 }
    });
    console.log(`Found ${accounts.length} accounts with Pool discriminator`);

    if (accounts.length > 0) {
      const data = accounts[0].account.data;
      console.log(`First account data (hex): ${data.toString('hex')}`);
      const creator = new PublicKey(data.slice(8, 40));
      console.log(`Assumed creator: ${creator.toBase58()}`);
    }
  } catch (e) {
    console.error(e);
  }
}

main();
