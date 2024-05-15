import bs58 from "bs58";
import axios from "axios";
import { JITO_UUID } from "../config";

type Region = "ams" | "default" | "ger" | "ny" | "tokyo";

// Region => Endpoint
export const endpoints = {
  "ams": "https://amsterdam.mainnet.block-engine.jito.wtf",
  "default": "https://mainnet.block-engine.jito.wtf",
  "ger": "https://frankfurt.mainnet.block-engine.jito.wtf",
  "ny": "https://ny.mainnet.block-engine.jito.wtf",
  "tokyo": "https://tokyo.mainnet.block-engine.jito.wtf",
}

export const tipAccounts = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
]

export class JitoBundleService {
  endpoint: string;
  tipAccount: string;

  constructor(_region: Region) {
    this.endpoint = endpoints[_region];
    this.tipAccount = tipAccounts[0];
  }

  async sendTransaction(serializedTransaction: Uint8Array) {
    const encodedTx = bs58.encode(serializedTransaction);
    const jitoURL = `${this.endpoint}/api/v1/transactions`; // ?uuid=${JITO_UUID}
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [encodedTx],
    };

    try {
      const response = await axios.post(jitoURL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data.result;
    } catch (error) {
      console.error("Error:", error);
      throw new Error("cannot send!");
    }
  }
}