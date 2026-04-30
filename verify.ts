import { buildCurveWithMarketCap } from '@meteora-ag/dynamic-bonding-curve-sdk';

for (let mcap = 100; mcap < 200; mcap += 1) {
  const curve = buildCurveWithMarketCap({
    token: { tokenType: 1, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenUpdateAuthority: 0, totalTokenSupply: 1000000000, leftover: 0 },
    fee: { baseFeeParams: { baseFeeMode: 1, feeSchedulerParam: { startingFeeBps: 100, endingFeeBps: 100, numberOfPeriod: 0, totalDuration: 0 } }, dynamicFeeEnabled: false, collectFeeMode: 1, creatorTradingFeePercentage: 0, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
    migration: { migrationOption: 1, migrationFeeOption: 1, migrationFee: { feePercentage: 1, creatorFeePercentage: 0 }, migratedPoolFee: { collectFeeMode: 0, dynamicFee: 0, poolFeeBps: 0 } },
    liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 100, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
    lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, cliffUnlockTime: 0, vestingPeriodDuration: 0, creatorPermanentLockedLiquidityPercentage: 0 },
    initialMarketCap: 10,
    migrationMarketCap: mcap
  });

  const raised = Number(curve.migrationQuoteThreshold.toString()) / 1e9;
  if (raised >= 30) {
    console.log(`Found: migrationMarketCap = ${mcap} gives raised = ${raised}`);
    break;
  }
}
