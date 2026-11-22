export interface MatrixSheet {
  id: string;
  title: string;
  columns: string[];
  rows: string[][];
}

export interface Matrix {
  title: string;
  description: string;
  counts: { dimensions: number; verificationPoints: number };
  sheets: MatrixSheet[];
}

export interface AnnexCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
}

export type DocumentBlock =
  | { kind: 'heading'; text: string; level?: 2 | 3 | 4 }
  | { kind: 'paragraph'; text: string; segments?: { text: string; deleted?: boolean }[] }
  | { kind: 'table'; rows: { cells: AnnexCell[]; header?: boolean }[] };

export interface Document {
  id: string;
  title: string;
  description: string;
  blocks: DocumentBlock[];
}

export type Material =
  | { type: 'matrix'; data: Matrix }
  | { type: 'document'; data: Document };
