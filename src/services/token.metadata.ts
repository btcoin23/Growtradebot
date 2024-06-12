import { ASSOCIATED_TOKEN_PROGRAM_ID, AccountLayout, ExtensionType, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getExtensionData, getExtensionTypes, getMetadataPointerState, getMint } from "@solana/spl-token";
import { COMMITMENT_LEVEL, MAINNET_RPC, connection } from "../config";
import { Metaplex, Metadata } from "@metaplex-foundation/js";
import { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";
import redisClient from "./redis";
import { formatNumber, getPrice } from "../utils";
import { BirdEyeAPIService, TokenOverviewDataType, TokenSecurityInfoDataType } from "./birdeye.api.service";
import { min } from "bn.js";
export interface ITokenAccountInfo {
  mint: string,
  amount: number,
  name: string,
  symbol: string
}
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
      const overview = await TokenService.getTokenOverview(mint);
      if (!overview) return null;

      const secureinfo = await TokenService.getTokenSecurity(mint);
      const resdata = {
        overview,
        secureinfo
      } as {
        overview: TokenOverviewDataType,
        secureinfo: TokenSecurityInfoDataType
      }

      return resdata;
    } catch (e) {
      return null;
    }
  },
  getTokenSecurity: async (mint: string) => {
    const key = `${mint}_security`;
    const redisdata = await redisClient.get(key);
    if (redisdata) {
      return JSON.parse(redisdata);
    }
    const secureinfo = await BirdEyeAPIService.getTokenSecurity(mint);
    await redisClient.set(key, JSON.stringify(secureinfo))
    await redisClient.expire(key, 30);
    return secureinfo;
  },
  getTokenOverview: async (mint: string) => {
    const key = `${mint}_overview`;
    const redisdata = await redisClient.get(key);
    if (redisdata) {
      return JSON.parse(redisdata);
    }

    const overview = await BirdEyeAPIService.getTokenOverview(mint) as TokenOverviewDataType;
    if (!overview || !overview.address) {
      return null;
    }

    await redisClient.set(key, JSON.stringify(overview))
    await redisClient.expire(key, 10);
    return overview;
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
        address: mintInfo.address.toString(),
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
      const filteredMints = knownMints.filter((item) => item.mint === mint.toString());
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

      if (metadataAccountInfo) {
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
  fetchSimpleMetaData: async (mint: PublicKey) => {
    try {
      const metaPlex = new Metaplex(connection);
      const metadata = await metaPlex
        .nfts()
        .findByMint({ mintAddress: mint })
      const tokenName = metadata.name;
      const tokenSymbol = metadata.symbol;
      return {
        name: tokenName,
        symbol: tokenSymbol,
      };
    } catch (e) {
      return {
        name: "",
        symbol: "",
      };
    }
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
        await redisClient.expire(key, 10);
      }
    } catch (e) {
      solBalance = 0;
    }
    return solBalance;
  },
  getSOLPrice: async () => {
    return getPrice(NATIVE_MINT.toString());
  },
  getSPLPrice: async (mint: string) => {
    return getPrice(mint);
  },
  getTokenAccounts: async (wallet: string): Promise<Array<ITokenAccountInfo>> => {
    try {
      const key = `${wallet}_tokenaccounts`;
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);

      const results: Array<ITokenAccountInfo> = await getaccounts(wallet);

      await redisClient.set(key, JSON.stringify(results));
      await redisClient.expire(key, 30);
      return results;
    } catch (e) { return [] }
  },
}

const getaccounts = async (owner: string) => {
  const results: Array<ITokenAccountInfo> = [];
  const response = await fetch(MAINNET_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getTokenAccounts",
      id: "helius-test",
      params: {
        page: 1,
        limit: 100,
        "displayOptions": {
          "showZeroBalance": false,
        },
        owner: owner,
      },
    }),
  });
  const data = await response.json();

  if (!data.result) {
    console.error("No result in the response", data);
    return [];
  }

  for (const account of data.result.token_accounts as Array<ITokenAccountInfo>) {
    const { mint, amount } = account;
    const { name, symbol } = await TokenService.fetchSimpleMetaData(new PublicKey(mint))
    results.push({ mint, amount, name, symbol })
  }
  return results;
}