import { ASSOCIATED_TOKEN_PROGRAM_ID, AccountLayout, ExtensionType, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getExtensionData, getExtensionTypes, getMetadataPointerState, getMint } from "@solana/spl-token";
import { COMMITMENT_LEVEL, MAINNET_RPC, connection } from "../config";
import { Metaplex } from "@metaplex-foundation/js";
import { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";
import redisClient from "./redis";
import { formatNumber, getPrice } from "../utils";
import { BirdEyeAPIService, TokenOverviewDataType, TokenSecurityInfoDataType } from "./birdeye.api.service";

export interface ITokenAccountInfo {
  address: string,
  mint: string,
  owner: string,
  amount: number,
  decimals: number,
  delegated_amount: number,
  frozen: boolean,
  symbol?: string,
  price: number,
  transferFeeEnable?: boolean,
  transferFeeData?: {
    withdraw_withheld_authority: string,
    transfer_fee_config_authority: string,
    older_transfer_fee: {
      epoch: number,
      maximum_fee: number,
      transfer_fee_basis_points: number
    },
    newer_transfer_fee: {
      epoch: number,
      maximum_fee: number,
      transfer_fee_basis_points: number
    },
    fee_withdrawable: boolean,
    fee_editable: boolean,
    current_transfer_fee: {
      epoch: number,
      maximum_fee: number,
      transfer_fee_basis_points: number
    },
    withheld_amount?: boolean,
    withheld_amount_ratio: number
  },
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
    await redisClient.expire(key, 86400);
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
    await redisClient.expire(key, 30);
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
  }
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
    const tokeninfo = await TokenService.getMintInfo(mint);
    if (!tokeninfo) {
      results.push(account);
    } else {
      const symbol = tokeninfo.overview.symbol;
      const decimals = tokeninfo.overview.decimals;
      if (decimals && amount) {
        const balance = amount / (10 ** decimals);
        const temp = account;
        temp.symbol = symbol;
        temp.amount = balance;
        temp.decimals = decimals;
        temp.price = tokeninfo.overview.price;
        temp.transferFeeEnable = tokeninfo.secureinfo.transferFeeEnable;
        temp.transferFeeData = tokeninfo.secureinfo.transferFeeData;
        results.push(temp);
      } else {
        results.push({ symbol, ...account });
      }
    }

  }
  return results;
}