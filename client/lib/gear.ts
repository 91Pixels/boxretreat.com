export interface GearItem {
  id: string;
  name: string;
  pricePerDay: number;
  icon: string;
  description: string;
}

export const GEAR_ITEMS: GearItem[] = [
  {
    id: 'surfboard',
    name: 'Surfboard',
    pricePerDay: 35,
    icon: 'bi-tsunami',
    description: 'Foam longboard, ideal for beginners and intermediates.',
  },
  {
    id: 'snorkel',
    name: 'Snorkel Set',
    pricePerDay: 15,
    icon: 'bi-water',
    description: 'Full-face mask + snorkel + fins.',
  },
  {
    id: 'kayak',
    name: 'Kayak',
    pricePerDay: 45,
    icon: 'bi-water',
    description: 'Single sit-on-top kayak with paddle.',
  },
  {
    id: 'gopro',
    name: 'GoPro Hero',
    pricePerDay: 25,
    icon: 'bi-camera-fill',
    description: 'GoPro Hero 12 Black + waterproof case + mounts.',
  },
  {
    id: 'bike',
    name: 'Bike',
    pricePerDay: 20,
    icon: 'bi-bicycle',
    description: 'Beach cruiser bicycle with helmet.',
  },
  {
    id: 'beach-set',
    name: 'Beach Set',
    pricePerDay: 18,
    icon: 'bi-umbrella-fill',
    description: 'Umbrella + 2 chairs + cooler bag.',
  },
];

export function getGearItem(id: string): GearItem | undefined {
  return GEAR_ITEMS.find(g => g.id === id);
}
