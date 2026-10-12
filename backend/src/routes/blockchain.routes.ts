import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getProvider, isChainReachable } from "../blockchain/provider";
import { isDeployed, loadDeployment } from "../blockchain/contracts";

const router = Router();
router.use(authenticate);

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const reachable = await isChainReachable();
    const deployed = isDeployed();
    let blockNumber: number | null = null;
    let chainId: string | null = null;
    if (reachable) {
      blockNumber = await getProvider().getBlockNumber();
      chainId = (await getProvider().getNetwork()).chainId.toString();
    }
    res.json({
      reachable,
      deployed,
      blockNumber,
      chainId,
      network: "hardhat-local",
      contracts: deployed ? loadDeployment().contracts : null,
    });
  })
);

router.get(
  "/events",
  asyncHandler(async (req, res) => {
    const { willId, txHash, address, eventType, page = "1", pageSize = "25" } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (willId) where.willId = willId;
    if (txHash) where.txHash = { contains: txHash, mode: "insensitive" };
    if (eventType) where.eventType = eventType;
    if (address) {
      where.OR = [
        { fromAddress: { equals: address, mode: "insensitive" } },
        { toAddress: { equals: address, mode: "insensitive" } },
      ];
    }

    const take = Math.min(Number(pageSize) || 25, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [total, events] = await Promise.all([
      prisma.blockchainTransaction.count({ where }),
      prisma.blockchainTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: { will: { select: { id: true, title: true } } },
      }),
    ]);

    res.json({ total, page: Number(page) || 1, pageSize: take, events });
  })
);

router.get(
  "/tx/:hash",
  asyncHandler(async (req, res) => {
    const record = await prisma.blockchainTransaction.findUnique({ where: { txHash: req.params.hash } });
    let chainDetail = null;
    if (await isChainReachable()) {
      const [tx, receipt] = await Promise.all([
        getProvider().getTransaction(req.params.hash),
        getProvider().getTransactionReceipt(req.params.hash),
      ]);
      chainDetail = { tx, receipt };
    }
    res.json({ record, chainDetail });
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ transactions: [], wills: [] });

    const [transactions, wills] = await Promise.all([
      prisma.blockchainTransaction.findMany({
        where: {
          OR: [
            { txHash: { contains: q, mode: "insensitive" } },
            { fromAddress: { contains: q, mode: "insensitive" } },
            { toAddress: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
      prisma.will.findMany({
        where: { OR: [{ id: q }, { onChainId: q }, { title: { contains: q, mode: "insensitive" } }] },
        take: 10,
      }),
    ]);

    res.json({ transactions, wills });
  })
);

/**
 * DLT NETWORK VISUALIZATION — conceptual demonstration only.
 *
 * BlockWill runs against a single local Hardhat node, as is standard for
 * development/demo blockchain projects. The "nodes" below are role-labeled
 * views onto that one chain's canonical state (not independent physical
 * nodes) used to teach the distributed-ledger concept: every participant
 * — testator, authority, executor, witness, beneficiary — observes the
 * exact same block height and transaction history, which is the property
 * DLT is meant to guarantee. This is explicitly labeled in the UI.
 */
router.get(
  "/dlt-network",
  asyncHandler(async (_req, res) => {
    const reachable = await isChainReachable();
    const blockNumber = reachable ? await getProvider().getBlockNumber() : null;
    const block = reachable && blockNumber !== null ? await getProvider().getBlock(blockNumber) : null;

    const nodes = ["Testator Node", "Legal Authority Node", "Executor Node", "Witness Node", "Beneficiary Node"].map(
      (label, i) => ({
        id: `node-${i + 1}`,
        label,
        blockNumber,
        blockHash: block?.hash ?? null,
        synced: reachable,
      })
    );

    res.json({
      reachable,
      blockNumber,
      blockHash: block?.hash ?? null,
      timestamp: block?.timestamp ?? null,
      nodes,
      disclaimer:
        "DLT Network Visualization — conceptual demonstration of distributed-ledger synchronization on a single local Hardhat chain, not independent physical nodes.",
    });
  })
);

export default router;
