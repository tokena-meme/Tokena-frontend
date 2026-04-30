import { createHash } from 'crypto';

function getDiscriminator(name: string): Buffer {
    return createHash('sha256').update(`account:${name}`).digest().slice(0, 8);
}

console.log('Pool discriminator:', getDiscriminator('Pool').toString('hex'));
console.log('VirtualPool discriminator:', getDiscriminator('VirtualPool').toString('hex'));
