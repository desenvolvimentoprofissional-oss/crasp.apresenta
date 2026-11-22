import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Matrix, MatrixSheet } from './materialTypes';
import './matrix-reader.css';

function searchText(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

const dimensionId = (row: readonly string[]) => JSON.stringify(row.slice(0, 3));

interface Dimension {
  id: string;
  number: string;
  group: string;
  title: string;
  fields: { label: string; value: string }[];
  points: { number: string; text: string }[];
  search: string;
}

function readDimensions(sheet?: MatrixSheet, verification?: MatrixSheet): Dimension[] {
  const byDimension = new Map<string, Dimension['points']>();
  for (const row of verification?.rows ?? []) {
    const key = dimensionId(row);
    const points = byDimension.get(key) ?? [];
    points.push({ number: row[3], text: row[4] });
    byDimension.set(key, points);
  }
  return (sheet?.rows ?? []).map((row) => {
    const [number, group, title] = row;
    const id = dimensionId(row);
    const points = byDimension.get(id) ?? [];
    const fields = row.slice(3).flatMap((value, index) => {
      const label = sheet?.columns[index + 3];
      return label && value.trim() ? [{ label, value }] : [];
    });
    const search = searchText([...row, ...points.map(({ text }) => text)].join(' '));
    return { id, number, group, title, fields, points, search };
  });
}

function groupDimensions(dimensions: readonly Dimension[]) {
  const groups = new Map<string, Dimension[]>();
  for (const dimension of dimensions) {
    const group = groups.get(dimension.group) ?? [];
    group.push(dimension);
    groups.set(dimension.group, group);
  }
  return [...groups];
}

function DimensionIndex({ dimensions, active, target, onSelect }: {
  dimensions: Dimension[];
  active: Dimension;
  target: string;
  onSelect: (id: string, focus?: boolean) => void;
}) {
  const groups = groupDimensions(dimensions);
  return (
    <>
      <nav className="matrix-reader__index" aria-label="Dimensões da matriz">
        <h2>Dimensões</h2>
        {groups.map(([group, entries]) => (
          <div className="matrix-reader__index-group" key={group}>
            {group && <p>{group}</p>}
            <ol className="matrix-reader__index-list">
              {entries.map(({ id, title, number }) => (
                <li key={id}>
                  <button type="button" aria-current={id === active.id ? 'true' : undefined}
                    aria-controls={target} onClick={() => onSelect(id)}>
                    <span className="matrix-reader__index-number">{number}.</span>
                    <span>{title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </nav>
      <label className="matrix-reader__select">
        <span id={`${target}-label`}>Dimensão</span>
        <select aria-labelledby={`${target}-label`} aria-controls={target} value={active.id}
          onChange={(event) => onSelect(event.target.value, false)}>
          {groups.map(([group, entries]) => (
            <optgroup key={group} label={group}>
              {entries.map(({ id, title, number }) => <option key={id} value={id}>{number}. {title}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}

export function MatrixReader({ data }: { data: Matrix }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusPending = useRef(false);
  const dimensions = useMemo(() => readDimensions(
    data.sheets.find(({ id }) => id === 'matriz'),
    data.sheets.find(({ id }) => id === 'pontos-de-verificacao'),
  ), [data.sheets]);
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const matches = dimensions.filter(({ search }) => terms.every((term) => search.includes(term)));
  const notes = (data.sheets.find(({ id }) => id === 'notas')?.rows ?? []).filter((row) => {
    const content = searchText(row.join(' '));
    return terms.every((term) => content.includes(term));
  });
  const found = matches.findIndex(({ id }) => id === selected);
  const index = Math.max(found, 0);
  const dimension = matches[index];
  const activeId = dimension?.id;

  function focusDimension() {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function selectDimension(next: string, focus = true) {
    if (activeId === next) {
      if (focus) focusDimension();
      return;
    }
    focusPending.current = focus;
    setSelected(next);
  }
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    focusDimension();
  }, [activeId]);

  return (
    <section className="matrix-reader" aria-label="Leitura da matriz">
      <div className="matrix-reader__toolbar">
        <label className="matrix-reader__search">
          <Search size={19} aria-hidden="true" />
          <span className="matrix-reader__sr">Pesquisar na matriz</span>
          <input type="search" placeholder="Pesquisar na matriz" value={query}
            onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
        </label>
        <dl className="matrix-reader__counts">
          <div><dt>dimensões</dt><dd>{data.counts.dimensions}</dd></div>
          <div><dt>pontos de verificação</dt><dd>{data.counts.verificationPoints}</dd></div>
        </dl>
        {notes.length > 0 && <a className="matrix-reader__notes-link" href={`#${id}-notes`}>
          Notas de leitura <ArrowDown size={15} aria-hidden="true" />
        </a>}
      </div>
      {terms.length > 0 && <p className="matrix-reader__results" role="status">
        {matches.length} {matches.length === 1 ? 'dimensão encontrada' : 'dimensões encontradas'}
        {notes.length > 0 && <> · {notes.length} {notes.length === 1 ? 'nota' : 'notas'}</>}
      </p>}
      {dimension && <div className="matrix-reader__layout">
        <DimensionIndex dimensions={matches} active={dimension} target={`${id}-dimension`} onSelect={selectDimension} />
        <div className="matrix-reader__content">
          <article className="matrix-reader__dimension" id={`${id}-dimension`}
            data-dimension-number={dimension.number} aria-labelledby={`${id}-heading`}>
            <header className="matrix-reader__dimension-header">
              <p>{dimension.group}</p>
              <h2 id={`${id}-heading`} ref={heading} tabIndex={-1}>{dimension.number}. {dimension.title}</h2>
            </header>
            <dl className="matrix-reader__fields">
              {dimension.fields.map(({ label, value }) => <div key={label}>
                <dt>{label}</dt><dd>{value}</dd>
              </div>)}
            </dl>
            {dimension.points.length > 0 && <section className="matrix-reader__points" aria-labelledby={`${id}-points`}>
              <h3 id={`${id}-points`}>Pontos de verificação</h3>
              <ol>
                {dimension.points.map(({ number, text }) => <li key={number} value={Number(number)}>{text}</li>)}
              </ol>
            </section>}
          </article>
          {matches.length > 1 && <nav className="matrix-reader__pager" aria-label="Navegar pelas dimensões">
            <button type="button" disabled={index === 0} onClick={() => selectDimension(matches[index - 1].id)}>
              <ChevronLeft size={18} aria-hidden="true" /> Anterior
            </button>
            <span>{index + 1} de {matches.length}</span>
            <button type="button" disabled={index === matches.length - 1} onClick={() => selectDimension(matches[index + 1].id)}>
              Próxima <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>}
        </div>
      </div>}
      {!dimension && notes.length === 0 && <p className="matrix-reader__empty">Nenhum resultado encontrado.</p>}
      {notes.length > 0 && <section className="matrix-reader__notes" id={`${id}-notes`} tabIndex={-1}
        aria-labelledby={`${id}-notes-title`}>
        <h2 id={`${id}-notes-title`}>Notas de leitura</h2>
        <dl>
          {notes.map(([label, text]) => <div key={label}>
            <dt>{label}</dt><dd>{text}</dd>
          </div>)}
        </dl>
      </section>}
    </section>
  );
}
