import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { BrowserProvider } from "ethers";
import { useToast } from "./ToastContext";
import { getInjectedProvider, hasInjectedProvider } from "@/lib/injectedProvider";

interface WalletContextValue {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  switching: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const EXPECTED_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 31337);
const EXPECTED_CHAIN_ID_HEX = `0x${EXPECTED_CHAIN_ID.toString(16)}`;
const EXPECTED_RPC_URL = import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8545";
const EXPECTED_CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME ?? "Hardhat Local";

export function WalletProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);

  const connect = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) {
      push("No injected wallet detected. Install MetaMask (or a legacy web3-injecting wallet), then reload this page.", "error");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const provider = new BrowserProvider(injected);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts?.[0]) {
        push("MetaMask returned no accounts. Make sure your wallet is unlocked.", "error");
        return;
      }
      const network = await provider.getNetwork();
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
        push(
          `Connected, but MetaMask is on chain ${network.chainId}, not the Hardhat Local network (chain ${EXPECTED_CHAIN_ID}). Add/switch to it in MetaMask — see Settings for instructions.`,
          "info"
        );
      } else {
        push("Wallet connected.", "success");
      }
    } catch (err: unknown) {
      const code = (err as { code?: number | string })?.code;
      if (code === 4001 || code === "ACTION_REJECTED") {
        push("Connection request was rejected in MetaMask.", "error");
      } else if (code === -32002) {
        push("MetaMask already has a pending connection request — open the MetaMask extension to approve or dismiss it.", "error");
      } else {
        const message = err instanceof Error ? err.message : "Failed to connect wallet.";
        push(message, "error");
      }
    } finally {
      setConnecting(false);
    }
  }, [push]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) {
      push("No injected wallet detected.", "error");
      return;
    }
    setSwitching(true);
    try {
      await injected.request?.({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EXPECTED_CHAIN_ID_HEX }],
      });
      push(`Switched to ${EXPECTED_CHAIN_NAME}.`, "success");
    } catch (err: unknown) {
      const code = (err as { code?: number | string })?.code;
      if (code === 4902) {
        // Chain not yet added to MetaMask — add it, then switch.
        try {
          await injected.request?.({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: EXPECTED_CHAIN_ID_HEX,
                chainName: EXPECTED_CHAIN_NAME,
                rpcUrls: [EXPECTED_RPC_URL],
                nativeCurrency: { name: "Hardhat ETH", symbol: "ETH", decimals: 18 },
              },
            ],
          });
          push(`Added and switched to ${EXPECTED_CHAIN_NAME}.`, "success");
        } catch (addErr: unknown) {
          const addCode = (addErr as { code?: number | string })?.code;
          if (addCode === 4001 || addCode === "ACTION_REJECTED") {
            push("Network add request was rejected in MetaMask.", "error");
          } else {
            push(addErr instanceof Error ? addErr.message : "Failed to add the network to MetaMask.", "error");
          }
        }
      } else if (code === 4001 || code === "ACTION_REJECTED") {
        push("Network switch was rejected in MetaMask.", "error");
      } else {
        push(err instanceof Error ? err.message : "Failed to switch network.", "error");
      }
    } finally {
      setSwitching(false);
    }
  }, [push]);

  useEffect(() => {
    const injected = getInjectedProvider();
    if (!injected?.on) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts?.[0] ?? null);
    };
    const handleChainChanged = (...args: unknown[]) => {
      setChainId(Number(args[0] as string));
    };
    injected.on("accountsChanged", handleAccountsChanged);
    injected.on("chainChanged", handleChainChanged);
    return () => {
      injected.removeListener?.("accountsChanged", handleAccountsChanged);
      injected.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const value = useMemo(
    () => ({
      address,
      chainId,
      connecting,
      switching,
      isCorrectNetwork: chainId === null ? true : chainId === EXPECTED_CHAIN_ID,
      connect,
      disconnect,
      switchNetwork,
    }),
    [address, chainId, connecting, switching, connect, disconnect, switchNetwork]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
