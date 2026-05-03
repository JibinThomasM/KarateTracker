export interface Student {
  id?: number;
  dojo_id: number;
  name: string;
  belt_rank: string;
  phone: string;
  whatsapp_number: string;
  join_date: string;
  is_active: number; // 1 = active, 0 = inactive
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
