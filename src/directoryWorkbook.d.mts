import type { Feature, SheetData } from 'write-excel-file/browser';
import type { SponsorRow } from './directoryClient';
export const directoryColumns: { key: keyof Omit<SponsorRow, 'id'>; label: string; width: number }[];
export function directorySheet(rows: SponsorRow[]): SheetData;
export function directoryAutoFilter(recordCount: number): Feature<File | Blob | ArrayBuffer>;
