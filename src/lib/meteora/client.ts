import { Connection, Commitment } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

let _client: DynamicBondingCurveClient | null = null;

/**
 * Returns a singleton DynamicBondingCurveClient.
 *
 * The SDK constructor signature is:
 *   new DynamicBondingCurveClient(connection, commitment)
 *
 * The client exposes sub-services:
 *   client.pool     – PoolService    (createPool, swap, swapQuote, etc.)
 *   client.creator  – CreatorService (claimCreatorTradingFee, etc.)
 *   client.state    – StateService   (getPool, getPoolConfig, etc.)
 *   client.partner  – PartnerService
 *   client.migration – MigrationService
 */
export function getDbcClient(
  connection: Connection,
  commitment: Commitment = 'confirmed'
): DynamicBondingCurveClient {
  if (!_client) {
    _client = new DynamicBondingCurveClient(connection, commitment);
  }
  return _client;
}
