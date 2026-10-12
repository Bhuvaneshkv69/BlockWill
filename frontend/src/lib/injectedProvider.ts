import type { Eip1193Provider } from "ethers";

// Pre-EIP-1193 MetaMask builds (e.g. the "MetaMask Legacy Web3" line by
// danfinlay/rekmarks) only inject `window.web3.currentProvider`, exposing a
// callback-style `sendAsync`/`send` instead of the modern `.request` method
// that ethers' BrowserProvider requires. This adapts either shape to one
// interface so the rest of the app only ever deals with `.request`.
type LegacyRpcCallback = (err: unknown, response: { result?: unknown; error?: unknown }) => void;

interface LegacyProvider {
  sendAsync?: (payload: unknown, callback: LegacyRpcCallback) => void;
  send?: (payload: unknown, callback: LegacyRpcCallback) => void;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
}

export type InjectedProvider = Eip1193Provider & {
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
};

let nextRequestId = 1;

function wrapLegacyProvider(legacy: LegacyProvider): InjectedProvider {
  const call = legacy.sendAsync?.bind(legacy) ?? legacy.send?.bind(legacy);
  return {
    request: ({ method, params }: { method: string; params?: unknown[] }) =>
      new Promise((resolve, reject) => {
        if (!call) {
          reject(new Error("Injected legacy web3 provider does not support sendAsync/send."));
          return;
        }
        call({ jsonrpc: "2.0", id: nextRequestId++, method, params: params ?? [] }, (err, response) => {
          if (err) reject(err);
          else if (response?.error) reject(response.error);
          else resolve(response?.result);
        });
      }),
    on: legacy.on?.bind(legacy),
    removeListener: legacy.removeListener?.bind(legacy),
  };
}

function getWindowWallets() {
  return window as unknown as {
    ethereum?: InjectedProvider;
    web3?: { currentProvider?: LegacyProvider };
  };
}

export function hasInjectedProvider(): boolean {
  const w = getWindowWallets();
  return Boolean(w.ethereum || w.web3?.currentProvider);
}

export function getInjectedProvider(): InjectedProvider | null {
  const w = getWindowWallets();
  if (w.ethereum) return w.ethereum;
  if (w.web3?.currentProvider) return wrapLegacyProvider(w.web3.currentProvider);
  return null;
}
