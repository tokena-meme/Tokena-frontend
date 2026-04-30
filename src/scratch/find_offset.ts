import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const connection = new Connection('https://solana-rpc.publicnode.com');

async function main() {
  const { data } = await supabase
    .from('launches')
    .select('dbc_pool_address, creator_wallet')
    .not('dbc_pool_address', 'is', null)
    .limit(1);

  if (data && data.length > 0) {
    const pool = data[0].dbc_pool_address;
    const creator = data[0].creator_wallet;
    console.log(`Analyzing pool: ${pool}, Creator: ${creator}`);

    const info = await connection.getAccountInfo(new PublicKey(pool));
    if (info) {
      console.log(`Size: ${info.data.length}`);
      console.log(`Data (hex): ${info.data.toString('hex')}`);

      const creatorHex = new PublicKey(creator).toBuffer().toString('hex');
      const offset = info.data.toString('hex').indexOf(creatorHex) / 2;
      console.log(`Creator found at offset: ${offset}`);
    }
  } else {
    console.log('No pools found in DB');
  }
}

main();
