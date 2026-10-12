/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_CHAIN_NAME: string;
  readonly VITE_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ethereum?: import("ethers").Eip1193Provider & {
    isMetaMask?: boolean;
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
  };
  // Legacy MetaMask builds (pre-EIP-1193) inject this instead of `window.ethereum`.
  web3?: {
    currentProvider?: {
      sendAsync?: (payload: unknown, callback: (err: unknown, response: unknown) => void) => void;
      send?: (payload: unknown, callback: (err: unknown, response: unknown) => void) => void;
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  };
}
