import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import './material-dialog.css';

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

export interface DocumentBlock {
  kind: 'heading' | 'paragraph';
  text: string;
  segments?: { text: string; deleted?: boolean }[];
}

export interface Document {
  id: string;
  title: string;
  description: string;
  blocks: DocumentBlock[];
}

export type Material =
  | { type: 'matrix'; data: Matrix }
  | { type: 'document'; data: Document };

function searchText(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

function MaterialSearch({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="material-search">
      <Search size={18} aria-hidden="true" />
      <span className="material-dialog__sr">{label}</span>
      <input
        type="search"
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </label>
  );
}

function SheetTable({ sheet, query }: { sheet: MatrixSheet; query: string }) {
  const tableId = useId();
  const normalized = searchText(query);
  const rows = useMemo(() => {
    const words = normalized.split(/\s+/).filter(Boolean);
    return sheet.rows.map((cells, index) => ({ cells, index })).filter(({ cells }) => {
      if (!words.length) return true;
      const content = searchText(cells.join(' '));
      return words.every((word) => content.includes(word));
    });
  }, [sheet.rows, normalized]);

  return (
    <>
      <div className="material-dialog__results" id={tableId} role="status">
        {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
      </div>
      {rows.length ? (
        <div className="material-dialog__table-scroll" tabIndex={0} role="region" aria-label={sheet.title}
          aria-describedby={tableId}>
          <table>
            <caption className="material-dialog__sr">{sheet.title}</caption>
            <thead>
              <tr>{sheet.columns.map((column, index) => <th scope="col" key={index}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(({ cells, index }) => (
                <tr key={index}>
                  {sheet.columns.map((_, column) => <td key={column}>{cells[column] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="material-dialog__empty">{normalized ? 'Nenhum registro encontrado.' : 'Aba sem registros.'}</p>}
    </>
  );
}

function MatrixReader({ data }: { data: Matrix }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.min(active, data.sheets.length - 1);

  function switchTab(index: number) {
    setActive(index);
    setQuery('');
  }

  function keyOnTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = data.sheets.length;
    const keys: Record<string, number> = {
      ArrowLeft: (index - 1 + count) % count,
      ArrowRight: (index + 1) % count,
      Home: 0,
      End: count - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    switchTab(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="material-dialog__matrix">
      <div className="material-dialog__matrix-tools">
        <dl className="material-dialog__counts">
          <div>
            <dt>Dimensões</dt><dd>{data.counts.dimensions}</dd>
          </div>
          <div>
            <dt>Pontos de verificação</dt><dd>{data.counts.verificationPoints}</dd>
          </div>
        </dl>
        {data.sheets.length > 0 && (
          <div className="material-dialog__tabs" role="tablist" aria-label="Abas da matriz">
            {data.sheets.map((sheet, index) => (
              <button
                key={sheet.id}
                ref={(node) => { tabs.current[index] = node; }}
                id={`${id}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                aria-controls={`${id}-sheet-${index}`}
                tabIndex={activeIndex === index ? 0 : -1}
                onKeyDown={(event) => keyOnTab(event, index)}
                onClick={() => { if (activeIndex !== index) switchTab(index); }}
              >{sheet.title}</button>
            ))}
          </div>
        )}
      </div>
      {data.sheets.map((sheet, index) => (
        <section className="material-dialog__sheet" key={sheet.id}
          role="tabpanel" id={`${id}-sheet-${index}`} aria-labelledby={`${id}-tab-${index}`}
          hidden={activeIndex !== index}>
          {activeIndex === index && (
            <>
              <MaterialSearch label="Pesquisar nesta aba" value={query} onChange={setQuery} />
              <SheetTable sheet={sheet} query={query} />
            </>
          )}
        </section>
      ))}
      {data.sheets.length === 0 && <p className="material-dialog__empty">Matriz sem abas para consulta.</p>}
    </div>
  );
}

function DocumentReader({ data }: { data: Document }) {
  const [query, setQuery] = useState('');
  const [resultIndex, setResultIndex] = useState(0);
  const blocks = useRef<Array<HTMLElement | null>>([]);
  const normalized = searchText(query);
  const matches = useMemo(() => normalized
    ? data.blocks.flatMap(({ text }, index) => searchText(text).includes(normalized) ? [index] : [])
    : [], [data.blocks, normalized]);
  const visibleResult = matches[resultIndex];

  useEffect(() => {
    if (visibleResult !== undefined) blocks.current[visibleResult]?.scrollIntoView({ block: 'start' });
  }, [visibleResult, normalized]);

  return (
    <div className="material-dialog__document">
      <div className="material-dialog__document-tools">
        <MaterialSearch label="Pesquisar na minuta" value={query} onChange={(value) => {
          setQuery(value);
          setResultIndex(0);
        }} />
        {normalized && (
          <div className="material-dialog__document-results">
            <span role="status">{matches.length ? `Resultado ${resultIndex + 1} de ${matches.length}`
              : 'Nenhum trecho encontrado.'}</span>
            {matches.length > 1 && (
              <>
                <button type="button" aria-label="Resultado anterior" onClick={() =>
                  setResultIndex((index) => (index - 1 + matches.length) % matches.length)}>
                  <ChevronUp size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-label="Próximo resultado" onClick={() =>
                  setResultIndex((index) => (index + 1) % matches.length)}>
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <article tabIndex={0} aria-label="Texto da minuta" className="material-dialog__document-scroll">
        {data.blocks.map((block, index) => {
          const Tag = block.kind === 'heading' ? 'h3' : 'p';
          return (
            <Tag key={index} ref={(node) => { blocks.current[index] = node; }}
              data-current-result={visibleResult === index || undefined}>
              {block.segments ? block.segments.map((segment, segmentIndex) => segment.deleted
                ? <del key={segmentIndex}>{segment.text}</del>
                : <span key={segmentIndex}>{segment.text}</span>) : block.text}
            </Tag>
          );
        })}
      </article>
    </div>
  );
}

export function MaterialDialog({ material, onClose }: { material: Material; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const description = material.type === 'document'
    ? material.data.description.replace(/^Minuta de resolução normativa\.\s*/i, '')
    : material.data.description;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => { if (element.open) element.close(); };
  }, []);

  return (
    <dialog ref={dialog} className="material-dialog" aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        onClose();
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="material-dialog__header">
        <div>
          {material.type === 'document' && <span className="material-dialog__status">Minuta</span>}
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{material.data.title}</h2>
          {description && <p id={`${id}-description`}>{description}</p>}
        </div>
        <button type="button" className="material-dialog__close" aria-label="Fechar material" onClick={onClose}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      {material.type === 'matrix'
        ? <MatrixReader key={material.data.title} data={material.data} />
        : <DocumentReader key={material.data.id} data={material.data} />}
    </dialog>
  );
}

export default MaterialDialog;
