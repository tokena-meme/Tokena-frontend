import { supabase } from '../supabase/client';

const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
const FUNCTION_NAME = "upload-to-ipfs";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface TokenMetadata {
  name:         string;
  symbol:       string;
  description:  string;
  image:        string;          // IPFS URL of the uploaded image
  external_url?: string;         // project website
  attributes?:  MetadataAttribute[];
  properties?:  MetadataProperties;
  extensions?:  TokenExtensions;
}

export interface MetadataAttribute {
  trait_type: string;
  value:      string;
}

export interface MetadataProperties {
  files: Array<{ uri: string; type: string }>;
  category: string;              // "image"
  creators?: Array<{ address: string; share: number }>;
}

export interface TokenExtensions {
  twitter?:  string;
  telegram?: string;
  website?:  string;
  discord?:  string;
  coingeckoId?: string;
}

export interface UploadImageResult {
  ipfsHash: string;
  ipfsUrl:  string;             // ipfs://HASH
  httpUrl:  string;             // https://gateway.pinata.cloud/ipfs/HASH
}

export interface UploadMetadataResult {
  ipfsHash:    string;
  metadataUri: string;          // ipfs://HASH — pass this to createPool()
  httpUrl:     string;          // https gateway URL for previewing
}

// ─── IMAGE UPLOAD ────────────────────────────────────────────────────────────

/**
 * Upload token logo to Pinata IPFS.
 * Accepts File (from <input type="file">) or Blob.
 * Returns both the ipfs:// URI and the https gateway URL.
 */
export async function uploadTokenImage(
  file:        File | Blob,
  tokenSymbol: string,
  onProgress?: (pct: number) => void
): Promise<UploadImageResult> {
  const MAX_SIZE_MB = 10;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Image must be under ${MAX_SIZE_MB}MB`);
  }

  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Image must be PNG, JPG, GIF, or WEBP");
  }

  const form = new FormData();
  form.append("file", file, `${tokenSymbol.toLowerCase()}-logo.${getExt(file.type)}`);
  form.append(
    "pinataMetadata",
    JSON.stringify({
      name:     `tokena-${tokenSymbol.toLowerCase()}-logo`,
      keyvalues: { platform: "tokena", type: "token-logo", symbol: tokenSymbol },
    })
  );
  form.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1 })
  );

  const ipfsHash = await uploadFile(form);

  return {
    ipfsHash,
    ipfsUrl:  `ipfs://${ipfsHash}`,
    httpUrl:  `${GATEWAY}/ipfs/${ipfsHash}`,
  };
}

async function uploadFile(form: FormData): Promise<string> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: form,
  });

  if (error) {
    throw new Error(`IPFS upload failed: ${error.message}`);
  }

  if (!data?.IpfsHash) {
    throw new Error(`IPFS upload failed: Invalid response from storage service`);
  }

  return data.IpfsHash;
}

// ─── METADATA UPLOAD ─────────────────────────────────────────────────────────

export async function uploadTokenMetadata(params: {
  name:        string;
  symbol:      string;
  description: string;
  imageIpfsUrl:string;
  website?:    string;
  twitter?:    string;
  telegram?:   string;
  discord?:    string;
  creatorWallet: string;
}): Promise<UploadMetadataResult> {
  const {
    name, symbol, description, imageIpfsUrl,
    website, twitter, telegram, discord, creatorWallet,
  } = params;

  const metadata: TokenMetadata = {
    name,
    symbol,
    description,
    image: imageIpfsUrl,
    external_url: website ?? "",
    attributes: [
      { trait_type: "Platform",  value: "Tokena"  },
      { trait_type: "Chain",     value: "Solana"  },
      { trait_type: "Supply",    value: "1,000,000,000" },
    ],
    properties: {
      files: [
        { uri: imageIpfsUrl, type: "image/png" },
      ],
      category: "image",
      creators: [
        { address: creatorWallet, share: 100 },
      ],
    },
    extensions: {
      ...(website  && { website  }),
      ...(twitter  && { twitter  }),
      ...(telegram && { telegram }),
      ...(discord  && { discord  }),
    },
  };

  if (metadata.extensions && Object.keys(metadata.extensions).length === 0) {
    delete metadata.extensions;
  }

  const body = {
    pinataContent:  metadata,
    pinataMetadata: {
      name:      `tokena-${symbol.toLowerCase()}-metadata`,
      keyvalues: { platform: "tokena", type: "token-metadata", symbol },
    },
    pinataOptions: { cidVersion: 1 },
  };

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: body,
  });

  if (error) {
    throw new Error(`IPFS metadata upload failed: ${error.message}`);
  }

  if (!data?.IpfsHash) {
    throw new Error(`IPFS metadata upload failed: Invalid response from storage service`);
  }

  const ipfsHash = data.IpfsHash;

  return {
    ipfsHash,
    metadataUri: `ipfs://${ipfsHash}`,
    httpUrl:     `${GATEWAY}/ipfs/${ipfsHash}`,
  };
}

// ─── FULL LAUNCH UPLOAD FLOW ─────────────────────────────────────────────────

export async function uploadLaunchAssets(params: {
  imageFile:     File;
  name:          string;
  symbol:        string;
  description:   string;
  website?:      string;
  twitter?:      string;
  telegram?:     string;
  discord?:      string;
  creatorWallet: string;
  onImageProgress?:    (pct: number) => void;
  onMetadataUpload?:   () => void;
}): Promise<{
  imageHttpUrl:  string;
  imageIpfsUrl:  string;
  metadataUri:   string;
  metadataHttpUrl: string;
}> {
  const {
    imageFile, name, symbol, description,
    website, twitter, telegram, discord,
    creatorWallet,
    onImageProgress, onMetadataUpload,
  } = params;

  const image = await uploadTokenImage(imageFile, symbol, onImageProgress);

  onMetadataUpload?.();
  const meta = await uploadTokenMetadata({
    name, symbol, description,
    imageIpfsUrl: image.ipfsUrl,
    website, twitter, telegram, discord,
    creatorWallet,
  });

  return {
    imageHttpUrl:    image.httpUrl,
    imageIpfsUrl:    image.ipfsUrl,
    metadataUri:     meta.metadataUri,
    metadataHttpUrl: meta.httpUrl,
  };
}

// ─── UTILS ──────────────────────────────────────────────────────────────────

function getExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png":  "png",
    "image/jpeg": "jpg",
    "image/gif":  "gif",
    "image/webp": "webp",
  };
  return map[mimeType] ?? "png";
}

export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  
  // Use a reliable public gateway for reads to completely bypass 403 Forbidden errors 
  // caused by strict Pinata Access Controls on the dedicated gateway.
  const READ_GATEWAY = "https://gateway.pinata.cloud";

  if (uri.startsWith("ipfs://"))
    return `${READ_GATEWAY}/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("/ipfs/"))
    return `${READ_GATEWAY}${uri}`;
    
  // Aggressively catch any pre-existing or hardcoded restricted mypinata gateways 
  // explicitly overwriting them with the public read gateway permanently!
  if (uri.startsWith("http")) {
    if (uri.includes(".mypinata.cloud/ipfs/")) {
      const hash = uri.split("/ipfs/")[1];
      return `${READ_GATEWAY}/ipfs/${hash}`;
    }
    return uri;
  }
  
  return `${READ_GATEWAY}/ipfs/${uri}`;
}

export async function verifyIpfsHash(hash: string): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY}/ipfs/${hash}`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
