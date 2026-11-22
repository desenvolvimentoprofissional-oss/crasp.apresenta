import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { Document, DocumentBlock } from './materialTypes';
import './document-reader.css';

const desktopIndex = '(min-width: 54rem)';

function searchKey(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

type Chapter = { id: string; name: string; title: string };
type HeadingBlock = Extract<DocumentBlock, { kind: 'heading' }>;
type ParagraphBlock = Extract<DocumentBlock, { kind: 'paragraph' }>;
type TableBlock = Extract<DocumentBlock, { kind: 'table' }>;

function headingLevel(block: HeadingBlock) {
  if (block.level) return block.level;
  const key = searchKey(block.text);
  if (/^subsecao\b/.test(key)) return 4;
  if (/^(secao|clausula)\b/.test(key)) return 3;
  return 2;
}

function chapter(text: string, id: string): Chapter | undefined {
  const [name, ...rest] = text.split('\n');
  if (!/^(capitulo|anexo)\b/.test(searchKey(name))) return;
  return { id, name, title: rest.join('\n') };
}

function documentTargets(data: Document) {
  return data.blocks.reduce<{ ids: string[]; chapters: Chapter[] }>((result, block, index) => {
    let id = `${data.id}-trecho-${index + 1}`;
    if (block.kind === 'heading') {
      const entry = chapter(block.text, id);
      if (entry) {
        id = `${data.id}-${searchKey(entry.name).replace(/[^a-z0-9]+/g, '-')}`;
        result.chapters.push({ ...entry, id });
      }
    }
    result.ids.push(id);
    return result;
  }, { ids: [], chapters: [] });
}

function DocumentIndex({ entries }: { entries: Chapter[] }) {
  const [open, setOpen] = useState(() => window.matchMedia(desktopIndex).matches);
  useEffect(() => {
    const media = window.matchMedia(desktopIndex);
    const sync = () => setOpen(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <aside className="document-reader__index">
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Sumário <ChevronDown size={16} aria-hidden="true" /></summary>
        <nav aria-label="Sumário da minuta">
          <ul>
            {entries.map(({ id, name, title }) => (
              <li key={id}>
                <a href={`#${id}`} onClick={() => {
                  if (!window.matchMedia(desktopIndex).matches) setOpen(false);
                }}>
                  <span>{name}</span>
                  {title && <span>{title}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </details>
    </aside>
  );
}

function SearchBar({ query, update, next, previous, resultIndex, count }: {
  query: string;
  update: (value: string) => void;
  next: () => void;
  previous: () => void;
  resultIndex: number;
  count: number;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (count > 1) next();
  }

  return (
    <form className="document-reader__toolbar" role="search" onSubmit={submit}>
      <label className="document-reader__search">
        <Search size={18} aria-hidden="true" />
        <span className="document-reader__sr">Pesquisar na minuta</span>
        <input type="search" value={query} placeholder="Pesquisar na minuta" autoComplete="off"
          onChange={(event) => update(event.target.value)} />
      </label>
      {query.trim() && (
        <div className="document-reader__results">
          <span role="status">{count ? `Resultado ${resultIndex + 1} de ${count}` : 'Nenhum trecho encontrado.'}</span>
          {count > 1 && (
            <>
              <button type="button" aria-label="Resultado anterior" onClick={previous}>
                <ChevronUp size={18} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Próximo resultado" onClick={next}>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}

function DocumentHeading({ block, id, current }: { block: HeadingBlock; id: string; current: boolean }) {
  const level = headingLevel(block);
  const Component = level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
  const entry = chapter(block.text, id);
  const heading = searchKey(block.text);
  const kind = entry ? 'chapter' : /^(secao|subsecao|clausula)\b/.test(heading) ? 'section' : 'formal';
  return (
    <Component className={`document-reader__heading document-reader__heading--${kind}`}
      id={id} tabIndex={-1} data-document-result={current || undefined}>
      {entry?.title ? <><span>{entry.name}</span>{'\n'}<strong>{entry.title}</strong></> : block.text}
    </Component>
  );
}

function DocumentParagraph({ block, id, current }: { block: ParagraphBlock; id: string; current: boolean }) {
  const prefix = block.text.match(/^(Art\.\s*\d+[º°.]?|§\s*\d+[º°.]?|Parágrafo único\.)/i)?.[0];
  const kind = prefix ? (prefix.startsWith('Art.') ? 'article' : 'paragraph')
    : /^[IVXLCDM]+\s*[–-]\s/.test(block.text) ? 'item' : 'body';
  return (
    <p className={`document-reader__paragraph document-reader__paragraph--${kind}`}
      id={id} data-document-result={current || undefined}>
      {block.segments ? block.segments.map(({ text, deleted }, index) =>
        deleted ? <del key={index}>{text}</del> : <span key={index}>{text}</span>) :
        prefix ? <><strong>{prefix}</strong>{block.text.slice(prefix.length)}</> : block.text}
    </p>
  );
}

const rowId = (tableId: string, index: number) => `${tableId}-linha-${index + 1}`;

function AnnexTable({ block, id, label, current }: {
  block: TableBlock;
  id: string;
  label: string;
  current?: string;
}) {
  const tableCaption = `${id}-legenda`;
  const firstBody = block.rows.findIndex(({ header }) => !header);
  const headerCount = firstBody < 0 ? block.rows.length : firstBody;
  const renderRow = (row: TableBlock['rows'][number], index: number, header: boolean) => {
    const rowAnchor = rowId(id, index);
    return (
      <tr key={index} id={rowAnchor} data-document-result={current === rowAnchor || undefined}>
        {row.cells.map(({ text, colSpan, rowSpan }, cellIndex) => {
          const Cell = header || cellIndex === 0 ? 'th' : 'td';
          return <Cell key={cellIndex} colSpan={colSpan} rowSpan={rowSpan}
            scope={header ? 'col' : cellIndex === 0 ? 'row' : undefined}>{text}</Cell>;
        })}
      </tr>
    );
  };
  return (
    <div className="document-reader__table" role="region" aria-labelledby={tableCaption} tabIndex={0}>
      <table>
        <caption id={tableCaption} className="document-reader__sr">{label}</caption>
        {headerCount > 0 && <thead>{block.rows.slice(0, headerCount).map((row, index) => renderRow(row, index, true))}</thead>}
        <tbody>{block.rows.slice(headerCount).map((row, index) => renderRow(row, headerCount + index, false))}</tbody>
      </table>
    </div>
  );
}

function findMatches(data: Document, ids: string[], query: string) {
  if (!query) return [];
  return data.blocks.flatMap((block, index) => {
    const id = ids[index];
    if (block.kind !== 'table') return searchKey(block.text).includes(query) ? [id] : [];
    return block.rows.flatMap(({ cells }, rowIndex) =>
      searchKey(cells.map(({ text }) => text).join(' ')).includes(query) ? [rowId(id, rowIndex)] : [],
    );
  });
}

function renderBody(data: Document, ids: string[], current?: string) {
  let section = data.title;
  return data.blocks.map((block, index) => {
    const id = ids[index];
    if (block.kind === 'heading') {
      section = block.text.replace(/\s+/g, ' ');
      return <DocumentHeading key={id} block={block} id={id} current={current === id} />;
    }
    if (block.kind === 'table') {
      return <AnnexTable key={id} block={block} id={id} label={section} current={current} />;
    }
    return <DocumentParagraph key={id} block={block} id={id} current={current === id} />;
  });
}

export function DocumentReader({ data }: { data: Document }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { ids, chapters } = useMemo(() => documentTargets(data), [data]);
  const normalized = searchKey(query);
  const results = useMemo(() => findMatches(data, ids, normalized), [data, ids, normalized]);
  const target = results[active];

  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'start' });
  }, [target]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (ids.includes(hash)) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
  }, [ids]);

  return (
    <div className="document-reader">
      <SearchBar query={query} update={(value) => { setQuery(value); setActive(0); }}
        count={results.length} resultIndex={active}
        previous={() => setActive((index) => (index - 1 + results.length) % results.length)}
        next={() => setActive((index) => (index + 1) % results.length)} />
      <div className={chapters.length ? 'document-reader__layout' : 'document-reader__layout document-reader__layout--single'}>
        {chapters.length > 0 && <DocumentIndex entries={chapters} />}
        <article className="document-reader__article" aria-label="Texto da minuta">
          {renderBody(data, ids, target)}
        </article>
      </div>
    </div>
  );
}
