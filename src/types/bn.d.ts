declare module 'bn.js' {
    import { Buffer } from 'buffer';

    class BN {
        constructor(number: number | string | number[] | Buffer | BN, base?: number | 'hex', endian?: 'le' | 'be');
        static isBN(b: any): b is BN;
        static min(left: BN, right: BN): BN;
        static max(left: BN, right: BN): BN;

        toNumber(): number;
        toString(base?: number | 'hex', length?: number): string;
        toBuffer(endian?: 'le' | 'be', length?: number): Buffer;
        toArray(endian?: 'le' | 'be', length?: number): number[];
        
        add(b: BN): BN;
        sub(b: BN): BN;
        mul(b: BN): BN;
        div(b: BN): BN;
        mod(b: BN): BN;
        cmp(b: BN): number;
        eq(b: BN): boolean;
        lt(b: BN): boolean;
        lte(b: BN): boolean;
        gt(b: BN): boolean;
        gte(b: BN): boolean;
    }

    export default BN;
}
