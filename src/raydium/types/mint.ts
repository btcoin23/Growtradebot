import { struct, u32, u8 } from '@solana/buffer-layout';
import { bool, publicKey, u64 } from '@solana/buffer-layout-utils';
import { Commitment, Connection, PublicKey } from '@solana/web3.js';

/** Information about a mint */
export interface Mint {
    /** Address of the mint */
    address: PublicKey;
    /**
     * Optional authority used to mint new tokens. The mint authority may only be provided during mint creation.
     * If no mint authority is present then the mint has a fixed supply and no further tokens may be minted.
     */
    mintAuthority: PublicKey | null;
    /** Total supply of tokens */
    supply: bigint;
    /** Number of base 10 digits to the right of the decimal place */
    decimals: number;
    /** Is this mint initialized */
    isInitialized: boolean;
    /** Optional authority to freeze token accounts */
    freezeAuthority: PublicKey | null;
}

/** Mint as stored by the program */
export interface RawMint {
    mintAuthorityOption: 1 | 0;
    mintAuthority: PublicKey;
    supply: bigint;
    decimals: number;
    isInitialized: boolean;
    freezeAuthorityOption: 1 | 0;
    freezeAuthority: PublicKey;
}

/** Buffer layout for de/serializing a mint */
export const MintLayout = struct<RawMint>([
    u32('mintAuthorityOption'),
    publicKey('mintAuthority'),
    u64('supply'),
    u8('decimals'),
    bool('isInitialized'),
    u32('freezeAuthorityOption'),
    publicKey('freezeAuthority'),
]);

/** Mint as stored by the program */
export interface TokenAccount {
    uiAmount: bigint;
}
/** Buffer layout for de/serializing a mint */
export const TokenAccountLayout = struct<TokenAccount>([
    u64('uiAmount'),
]);

export interface MintExtention {
    extension: string, // transferFeeConfig,
    state: {
        newerTransferFee: {
            epoch: number, // 580,
            maximumFee: number, //  2328306436538696000,
            transferFeeBasisPoints: number, // 800
        },
        olderTransferFee: {
            epoch: number, // 580,
            maximumFee: number, // 2328306436538696000,
            transferFeeBasisPoints: number, // 800
        },
        transferFeeConfigAuthority: string,
        withdrawWithheldAuthority: string,
        withheldAmount: number, // 284998271699445
    }
}

export interface MintParsedInfo {
    decimals: number,
    freezeAuthority: string | null,
    isInitialized: Boolean,
    mintAuthority: string | null,
    supply: string,
    extension?: MintExtention[],
}
export interface MintParsed {
    info: MintParsedInfo,
    type: string, // 'mint'
}
export interface MintData {
    program: string; // 'spl-token', 'spl-token-2022'
    parsed: MintParsed,
    space: number,
}