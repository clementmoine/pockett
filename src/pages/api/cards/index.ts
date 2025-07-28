import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import type { Prisma, Country, CardType } from "@prisma/client";

const prisma = new PrismaClient();

interface CreateCardRequest {
  name: string;
  code: string;
  logo?: string;
  color: string;
  type: CardType;
  country?: Country;
  providerId?: string;
}

interface UpdateCardRequest {
  name?: string;
  code?: string;
  logo?: string;
  color?: string;
  type?: CardType;
  country?: Country;
  providerId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    switch (req.method) {
      case "GET":
        return await handleGet(req, res);
      case "POST":
        return await handlePost(req, res);
      case "PUT":
        return await handlePut(req, res);
      case "DELETE":
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Cards API error:", error);
    return res.status(500).json({
      error: `Internal server error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/cards?userId=xxx&country=FR
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { country, providerId } = req.query;

  const whereClause: Prisma.CardWhereInput = {};

  // Filter by country if provided
  if (country && typeof country === "string") {
    whereClause.country = country as Country;
  }

  // Filter by provider if provided
  if (providerId && typeof providerId === "string") {
    whereClause.providerId = providerId;
  }

  const cards = await prisma.card.findMany({
    where: whereClause,
    include: {
      provider: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json(cards);
}

// POST /api/cards
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const {
    name,
    code,
    logo,
    color,
    type,
    country,
    providerId,
  }: CreateCardRequest = req.body;

  if (!name || !code || !color || !type) {
    return res.status(400).json({
      error: "Missing required fields: name, code, color, type",
    });
  }

  // Check the provider exists if providerId is provided
  if (providerId) {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      return res.status(400).json({ error: "Provider not found" });
    }
  }

  // Validate provider exists if providerId is being updated
  if ("providerId" in req.body) {
    if (providerId !== null) {
      const provider = await prisma.provider.findUnique({
        where: { id: providerId },
      });
      if (!provider) {
        return res.status(400).json({ error: "Provider not found" });
      }
    }
  }

  const card = await prisma.card.create({
    data: {
      name,
      code,
      logo: logo || null,
      color,
      type,
      country: country || null,
      providerId: providerId || null,
    },
    include: {
      provider: true,
    },
  });

  return res.status(201).json(card);
}

// PUT /api/cards?id=xxx
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const {
    name,
    code,
    logo,
    color,
    type,
    country,
    providerId,
  }: UpdateCardRequest = req.body;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid card id" });
  }

  // Check if card exists
  const existingCard = await prisma.card.findUnique({
    where: { id: id },
  });

  if (!existingCard) {
    return res.status(404).json({ error: "Card not found" });
  }

  // Validate provider exists if providerId is being updated
  if ("providerId" in req.body) {
    if (providerId !== null) {
      const provider = await prisma.provider.findUnique({
        where: { id: providerId },
      });
      if (!provider) {
        return res.status(400).json({ error: "Provider not found" });
      }
    }
  }

  const updatedCard = await prisma.card.update({
    where: { id: id },
    data: {
      ...(name && { name: name }),
      ...(code && { code: code }),
      ...(logo !== undefined && { logo: logo }),
      ...(color && { color: color }),
      ...(type && { type: type }),
      ...(country !== undefined && { country: country }),
      ...(providerId !== undefined && {
        providerId: providerId,
      }),
    },
    include: {
      provider: true,
    },
  });

  return res.status(200).json(updatedCard);
}

// DELETE /api/cards?id=xxx
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (process.env.NODE_ENV === "development" && !id) {
    await prisma.card.deleteMany({});
    return res.status(204).end();
  }

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid card id" });
  }

  const existingCard = await prisma.card.findUnique({
    where: { id },
  });

  if (!existingCard) {
    return res.status(404).json({ error: "Card not found" });
  }

  await prisma.card.delete({
    where: { id },
  });

  return res.status(204).end();
}
