export interface Student {
  id?: string;
  dojoId: string;
  name: string;
  beltRank: string;
  phone: string;
  whatsappNumber: string;
  joinDate: string;
  isActive: boolean;
  feePlanId?: string;
}

export const BELT_RANKS = [
  'White',
  'Yellow',
  'Orange',
  'Green',
  'Blue',
  'Purple',
  'Brown4',
  'Brown3',
  'Brown2',
  'Brown1',
  'Black'
];
