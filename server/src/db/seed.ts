import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { SOURCE_TICKETS_DIR, SEED_UPLOADS_DIR } from '../config.js';
import { saveDb } from './jsonDb.js';
import type { Db, Ticket, Partner, ColourVariant, TicketStatus } from '../types/index.js';

interface SeedTicketSpec {
  folder: string; // e.g. "Ticket 1"
  seedSlug: string; // e.g. "ticket-1"
  style: string;
  productNumber: string;
  priority: Ticket['priority'];
  status: TicketStatus;
  notes?: string;
  variants: Array<{
    name: string;
    type: ColourVariant['type'];
    pantone?: string;
    referenceImageFile?: string; // filename inside the ticket folder
  }>;
}

const SEED_PARTNER_NAMES = ['PrintHaus Studio', 'ColourWorks Ltd', 'Studio Palette'];

const SEED_TICKETS: SeedTicketSpec[] = [
  {
    folder: 'Ticket 1',
    seedSlug: 'ticket-1',
    style: '15377489',
    productNumber: '5081878',
    priority: 'Medium',
    status: 'Pending',
    notes: 'Keep clipping path for all pictures (but only 1 clipping path).',
    variants: [
      { name: 'Granita', type: 'solid', pantone: 'Granita' },
      {
        name: 'Fuchsia Fedora / Block Libre',
        type: 'aop',
        referenceImageFile: 'Block Libre.jpg',
      },
    ],
  },
  {
    folder: 'Ticket 2',
    seedSlug: 'ticket-2',
    style: '15377486',
    productNumber: '5078866',
    priority: 'High',
    status: 'Sent',
    notes: 'Keep clipping path for all pictures (but only 1 clipping path).',
    variants: [
      {
        name: 'Night Sky / White Dots (not black)',
        type: 'aop',
        referenceImageFile: 'DOTS CLOUD DANCER.jpg',
      },
      { name: 'Hedge Green', type: 'solid', pantone: 'Hedge Green' },
      { name: 'Navy Blazer', type: 'solid', pantone: 'Navy Blazer' },
    ],
  },
  {
    folder: 'Ticket 3',
    seedSlug: 'ticket-3',
    style: '15377488',
    productNumber: '5078869',
    priority: 'High',
    status: 'Completed',
    notes: 'Keep clipping path for all pictures (but only 1 clipping path).',
    variants: [
      { name: 'Hedge Green', type: 'solid', pantone: 'Hedge Green' },
      { name: 'Navy Blazer', type: 'solid', pantone: 'Navy Blazer' },
      {
        name: 'Night Sky / White Dots (not black)',
        type: 'aop',
        referenceImageFile: 'DOTS CLOUD DANCER.jpg',
      },
    ],
  },
  {
    folder: 'Ticket 4',
    seedSlug: 'ticket-4',
    style: '15377522',
    productNumber: '5081887',
    priority: 'Low',
    status: 'Pending',
    notes: 'Keep clipping path for all pictures (but only 1 clipping path).',
    variants: [
      { name: 'Granita', type: 'solid', pantone: 'Granita' },
      {
        name: 'Fuchsia Fedora / Block Libre',
        type: 'aop',
        referenceImageFile: 'Block Libre.jpg',
      },
    ],
  },
];

function copyTicketAssets(spec: SeedTicketSpec): {
  front: string;
  back: string;
  detail: string;
  referenceImages: Record<string, string>;
} {
  const sourceDir = path.join(SOURCE_TICKETS_DIR, spec.folder);
  const destDir = path.join(SEED_UPLOADS_DIR, spec.seedSlug);
  fs.mkdirSync(destDir, { recursive: true });

  const baseName = `${spec.style}_${spec.productNumber}`;
  const angleFiles = {
    front: `${baseName}_001.jpg`,
    back: `${baseName}_002.jpg`,
    detail: `${baseName}_007.jpg`,
  };

  const urls: Record<string, string> = {};
  for (const [key, filename] of Object.entries(angleFiles)) {
    fs.copyFileSync(path.join(sourceDir, filename), path.join(destDir, filename));
    urls[key] = `/uploads/seed/${spec.seedSlug}/${encodeURIComponent(filename)}`;
  }

  const referenceImages: Record<string, string> = {};
  for (const variant of spec.variants) {
    if (!variant.referenceImageFile) continue;
    if (referenceImages[variant.referenceImageFile]) continue;
    fs.copyFileSync(
      path.join(sourceDir, variant.referenceImageFile),
      path.join(destDir, variant.referenceImageFile),
    );
    referenceImages[variant.referenceImageFile] =
      `/uploads/seed/${spec.seedSlug}/${encodeURIComponent(variant.referenceImageFile)}`;
  }

  return {
    front: urls.front,
    back: urls.back,
    detail: urls.detail,
    referenceImages,
  };
}

export function buildSeedDb(): Db {
  const partners: Partner[] = SEED_PARTNER_NAMES.map((name) => ({ id: nanoid(), name }));

  const tickets: Ticket[] = SEED_TICKETS.map((spec, index) => {
    const assets = copyTicketAssets(spec);
    const now = new Date().toISOString();
    const partner = partners[index % partners.length];

    const colourVariants: ColourVariant[] = spec.variants.map((v) => ({
      id: nanoid(),
      name: v.name,
      type: v.type,
      pantone: v.pantone,
      referenceImagePath: v.referenceImageFile ? assets.referenceImages[v.referenceImageFile] : undefined,
      decision: 'pending',
    }));

    const ticket: Ticket = {
      id: nanoid(),
      photoId: `${spec.style}_${spec.productNumber}`,
      style: spec.style,
      productNumber: spec.productNumber,
      basePhotos: { front: assets.front, back: assets.back, detail: assets.detail },
      colourVariants,
      priority: spec.priority,
      partnerId: partner.id,
      status: spec.status,
      createdBy: 'Operator',
      createdAt: now,
      updatedAt: now,
      notes: spec.notes,
    };

    if (spec.status === 'Sent') {
      ticket.partnerReceipt = { sentAt: now, receiptStatus: 'Pending' };
    } else if (spec.status === 'In Progress') {
      ticket.partnerReceipt = { sentAt: now, acknowledgedAt: now, receiptStatus: 'Acknowledged' };
    } else if (spec.status === 'Completed') {
      ticket.partnerReceipt = { sentAt: now, acknowledgedAt: now, receiptStatus: 'Received' };
    }

    return ticket;
  });

  return { tickets, partners, approvedPhotos: [] };
}

export async function seedIfMissing(): Promise<void> {
  const db = buildSeedDb();
  await saveDb(db);
}

// Allow `npm run seed` to force a fresh reseed.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  seedIfMissing().then(() => {
    console.log('Seed complete.');
  });
}
