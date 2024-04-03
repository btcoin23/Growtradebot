import { ASSOCIATED_TOKEN_PROGRAM_ID, AccountLayout, ExtensionType, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getExtensionData, getExtensionTypes, getMetadataPointerState, getMint } from "@solana/spl-token";
import { COMMITMENT_LEVEL, connection } from "../config";
import { Metaplex } from "@metaplex-foundation/js";
import { PublicKey } from "@solana/web3.js";
import redisClient from "./redis";
import { getPrice } from "../utils";
import { BirdEyeAPIService, TokenOverviewDataType, TokenSecurityInfoDataType } from "./birdeye.api.service";
const knownMints = [
  {
    mint: "FPymkKgpg1sLFbVao4JMk4ip8xb8C8uKqfMdARMobHaw",
    tokenName: "GrowSol",
    tokenSymbol: "$GRW",
  },
  {
    mint: "HKYX2jvwkdjbkbSdirAiQHqTCPQa3jD2DVRkAFHgFXXT",
    tokenName: "Print Protocol",
    tokenSymbol: "$PRINT",
  },

]

export const TokenService = {
  getMintInfo: async (mint: string) => {
    try {
      // await redisClient.expire(mint, 0);
      const redisdata = await redisClient.get(mint);
      if (redisdata) {
        console.log("redis", Date.now());
        return JSON.parse(redisdata);
      }
      const overview = await BirdEyeAPIService.getTokenOverview(mint);
      const secureinfo = await BirdEyeAPIService.getTokenSecurity(mint);
      const resdata = {
        overview,
        secureinfo
      } as {
        overview: TokenOverviewDataType,
        secureinfo: TokenSecurityInfoDataType
      }
      if (!resdata.overview.address) {
        await redisClient.set(mint, "NONE")
        await redisClient.expire(mint, 86400);
        return null;
      }

      await redisClient.set(mint, JSON.stringify(resdata));
      return resdata;
    } catch (e) {
      return null;
    }
  },
  fetchSecurityInfo: async (mint: PublicKey) => {
    try {
      const key = `${mint}_security`;
      await redisClient.expire(key, 0);
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);

      let mintInfo: any;
      let token2022 = false;
      // spltoken and token2022
      try {
        mintInfo = await getMint(
          connection,
          mint
        );
      } catch (error) {
        token2022 = true;
        mintInfo = await getMint(
          connection,
          mint,
          COMMITMENT_LEVEL,
          TOKEN_2022_PROGRAM_ID
        )
      }
      const mintdata = {
        token2022,
        address: mintInfo.address.toBase58(),
        mintAuthority: mintInfo.mintAuthority,
        supply: mintInfo.supply.toString(),
        decimals: mintInfo.decimals,
        isInitialized: mintInfo.isInitialized,
        freezeAuthority: mintInfo.freezeAuthority,
      }
      await redisClient.set(key, JSON.stringify(mintdata));
      if (mintInfo.freezeAuthority || mintInfo.freezeAuthority) {
        await redisClient.expire(key, 60);
      } else {
        await redisClient.expire(key, 24 * 3600);
      }
      return mintInfo;
    } catch (error) {
      console.log(error);
      return null;
    }
  },
  fetchMetadataInfo: async (mint: PublicKey) => {
    try {
      const filteredMints = knownMints.filter((item) => item.mint === mint.toBase58());
      if (filteredMints && filteredMints.length > 0) {
        const filteredMint = filteredMints[0];
        return {
          tokenName: filteredMint.tokenName,
          tokenSymbol: filteredMint.tokenSymbol,
          website: "",
          twitter: "",
          telegram: ""
        }
      }
      const key = `${mint}_metadata`;
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
      const metaplex = Metaplex.make(connection);

      const mintAddress = new PublicKey(mint);

      let tokenName: any;
      let tokenSymbol: any;
      let website: any;
      let twitter: any;
      let telegram: any;

      const metadataAccount = metaplex
        .nfts()
        .pdas()
        .metadata({ mint: mintAddress });

      const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

      if (metadataAccountInfo && mintAddress) {
        const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
        tokenName = token.name;
        tokenSymbol = token.symbol;

        if (token.json && token.json.extensions) {
          website = (token.json.extensions as any).website ?? "";
          twitter = (token.json.extensions as any).twitter ?? "";
          telegram = (token.json.extensions as any).twitter ?? "";
        }
      }
      await redisClient.set(key, JSON.stringify({
        tokenName,
        tokenSymbol,
        website,
        twitter,
        telegram
      }))
      return {
        tokenName,
        tokenSymbol,
        website,
        twitter,
        telegram
      }
    } catch (e) {
      return {
        tokenName: "",
        tokenSymbol: "",
        website: "",
        twitter: "",
        telegram: ""
      }
    }
  },
  getSPLBalance: async (mint: string, owner: string, isToken2022: boolean, isLive: boolean = false) => {
    let tokenBalance = 0;
    try {
      const key = `${owner}${mint}_balance`;
      const data = await redisClient.get(key);
      if (data && !isLive) return Number(data);
      const ata = getAssociatedTokenAddressSync(
        new PublicKey(mint),
        new PublicKey(owner),
        true,
        isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      const balance = await connection.getTokenAccountBalance(ata);
      if (balance.value.uiAmount) {
        tokenBalance = balance.value.uiAmount;
        await redisClient.set(key, tokenBalance);
        await redisClient.expire(key, 10);
      }
    } catch (e) {
      tokenBalance = 0;
    }
    return tokenBalance;
  },
  getSOLBalance: async (owner: string, isLive: boolean = false) => {
    let solBalance = 0;
    try {
      const key = `${owner}_solbalance`;
      const data = await redisClient.get(key);
      if (data && !isLive) return Number(data);
      const sol = await connection.getBalance(new PublicKey(owner));

      if (sol) {
        solBalance = sol / 10 ** 9;
        await redisClient.set(key, solBalance);
        await redisClient.expire(key, 30);
      }
    } catch (e) {
      solBalance = 0;
    }
    return solBalance;
  },
  getSOLPrice: async () => {
    return getPrice(NATIVE_MINT.toBase58());
  },
  getSPLPrice: async (mint: string) => {
    return getPrice(mint);
  }
}