import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BookOpen, FileText, Globe2, GraduationCap,
  Leaf, Play, Table2, Workflow,
} from 'lucide-react';
import { MaterialDialog, type Material } from './MaterialDialog';
import { mountPlaylist } from './playlist';
import './playlist.css';
import matrixData from './data/matrices.json';
import documentData from './data/documents.json';

const products = [
  {
    id: 'asg-ods',
    title: 'Componente Curricular de ASG e ODS',
    description: 'ASG e ODS na formação em Administração e Gestão.',
    icon: Leaf,
    links: [
      { label: 'Site oficial', url: 'https://asg.ods.crasp.org.br/' },
      { label: 'Os seis módulos', url: 'https://asg.ods.crasp.org.br/trilha' },
      { label: 'Manifesto Público', url: 'https://asg.ods.crasp.org.br/chancela' },
      { label: 'Manifestação de interesse', url: 'https://asg.ods.crasp.org.br/registro-interesse' },
    ],
  },
  {
    id: 'educa',
    title: 'CRA-SP Educa',
    description: 'Cursos gratuitos e oportunidades de estágio e aprendizagem.',
    icon: GraduationCap,
    links: [
      { label: 'Site oficial', url: 'https://craspeduca.crasp.org.br/' },
      { label: 'Catálogo de cursos', url: 'https://craspeduca.crasp.org.br/login?next=%2Fcatalogo%2Fcursos', detail: 'Acesso pela conta no Educa' },
      { label: 'Catálogo de vagas', url: 'https://craspeduca.crasp.org.br/login?next=%2Fcatalogo%2Fvagas', detail: 'Acesso pela conta no Educa' },
    ],
  },
  {
    id: 'pdp',
    title: 'Programa de Desenvolvimento Profissional',
    description: 'Distinção profissional, trilhas, pós-graduação e certificações de mercado.',
    icon: Workflow,
    links: [
      { label: 'Site oficial', url: 'https://desenvolvimento.profissional.crasp.org.br/' },
      { label: 'Ambiente de aprendizagem', url: 'https://desenvolvimento.profissional.crasp.org.br/login', detail: 'Área do participante' },
    ],
  },
] as const;

type ProductId = typeof products[number]['id'];
type DocumentData = Extract<Material, { type: 'document' }>['data'];
type MatrixData = Extract<Material, { type: 'matrix' }>['data'];
const matrices: Record<ProductId, MatrixData> = matrixData;
const documents = documentData as DocumentData[];

type Selection = { type: 'matrix'; id: ProductId } | { type: 'document'; id: string };

function locationSelection(): Selection | undefined {
  const query = new URLSearchParams(window.location.search);
  const matrix = products.find(({ id }) => id === query.get('matriz'));
  if (matrix) return { type: 'matrix', id: matrix.id };
  const document = documents.find(({ id }) => id === query.get('documento'));
  if (document) return { type: 'document', id: document.id };
}

function materialFor(selection?: Selection): Material | undefined {
  if (!selection) return;
  if (selection.type === 'matrix') return { type: 'matrix', data: matrices[selection.id] };
  const data = documents.find(({ id }) => id === selection.id);
  if (data) return { type: 'document', data };
}

function updateLocation(selection?: Selection) {
  const url = new URL(window.location.href);
  url.searchParams.delete('matriz');
  url.searchParams.delete('documento');
  if (selection) {
    url.searchParams.set(selection.type === 'matrix' ? 'matriz' : 'documento', selection.id);
    window.history.pushState(null, '', url);
  } else {
    window.history.replaceState(null, '', url);
  }
}

function PlaylistSection() {
  const playlist = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playlist.current) return;
    const editor = new URLSearchParams(window.location.search).get('editar-playlist') === '1';
    return mountPlaylist(playlist.current, { editor, playlistUrl: import.meta.env.BASE_URL + 'playlist.json' });
  }, []);
  return (
    <section className="shell section playlist-section" id="videoaulas" aria-labelledby="videoaulas-titulo">
      <h2 className="section-title" id="videoaulas-titulo">Playlist de videoaulas</h2>
      <div ref={playlist} />
    </section>
  );
}

export default function App() {
  const [selection, setSelection] = useState(locationSelection);
  const opener = useRef<HTMLElement | null>(null);
  const material = materialFor(selection);
  useEffect(() => {
    const sync = () => setSelection(locationSelection());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    if (!selection && opener.current) {
      opener.current.focus({ preventScroll: true });
      opener.current = null;
    }
  }, [selection]);

  function openMaterial(next: Selection, trigger: HTMLElement) {
    opener.current = trigger;
    updateLocation(next);
    setSelection(next);
  }

  function closeMaterial() {
    updateLocation();
    setSelection(undefined);
  }

  return (
    <>
      <a className="skip-link" href="#materiais">Pular para os materiais</a>
      <header className="masthead">
        <div className="shell masthead-content">
          <a className="institution" href="https://www.crasp.gov.br/" target="_blank" rel="noopener noreferrer">
            <img src={import.meta.env.BASE_URL + 'brand/crasp.svg'} alt="CRA-SP" width="762" height="557" />
            <span>Conselho Regional de Administração de São Paulo</span>
          </a>
          <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="Apresenta.ai, início">
            apresenta<span>.ai</span>
          </a>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="portal-titulo">
          <div className="shell hero-layout">
            <div className="hero-intro">
              <h1 id="portal-titulo">Inovação e<br />Desenvolvimento<br />Profissional</h1>
              <p>Materiais da apresentação executiva para consulta.</p>
            </div>
            <div className="hero-panel">
              <h2>Acesso aos materiais</h2>
              <p>Consulte os sites oficiais, as minutas de resolução e as matrizes de acompanhamento.</p>
              <a className="hero-button hero-button-primary" href="#materiais">
                <BookOpen aria-hidden="true" size={20} />
                Consultar materiais
                <ArrowDown aria-hidden="true" size={17} />
              </a>
              <a className="hero-button" href="#videoaulas">
                <Play aria-hidden="true" size={19} />
                Videoaulas
                <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>
          </div>
        </section>

        <section className="shell section" id="materiais" aria-labelledby="materiais-titulo">
          <h2 className="section-title" id="materiais-titulo">Materiais por produto</h2>
          <div className="product-grid">
            {products.map(({ id, title, description, icon: Icon, links }) => {
              const { counts } = matrices[id];
              return (
                <article className="product-card" key={id} aria-labelledby={id + '-titulo'}>
                  <div className="product-intro">
                    <div className="product-icon"><Icon size={25} strokeWidth={1.75} aria-hidden="true" /></div>
                    <h3 id={id + '-titulo'}>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <ul className="resource-list">
                    <li>
                      <button className="resource resource-primary" type="button"
                        aria-label={`Matriz de acompanhamento de ${title}`}
                        onClick={(event) => openMaterial({ type: 'matrix', id }, event.currentTarget)}>
                        <Table2 className="resource-icon" size={18} aria-hidden="true" />
                        <span>
                          <strong>Matriz de acompanhamento</strong>
                          <small>{counts.dimensions} dimensões · {counts.verificationPoints} pontos de verificação</small>
                        </span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                    {links.map((link) => (
                      <li key={link.url}>
                        <a className="resource" href={link.url} target="_blank" rel="noopener noreferrer"
                          aria-label={link.label === 'Site oficial' ? `Site oficial — ${title}` : undefined}>
                          <Globe2 className="resource-icon" size={18} aria-hidden="true" />
                          <span>
                            <strong>{link.label}</strong>
                            {'detail' in link && <small>{link.detail}</small>}
                          </span>
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                    {id === 'pdp' && (
                      <li>
                        <a className="resource" href="#documentos">
                          <FileText className="resource-icon" size={18} aria-hidden="true" />
                          <span><strong>Minutas de resolução</strong></span>
                          <ArrowDown size={16} aria-hidden="true" />
                        </a>
                      </li>
                    )}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="shell section documents-section" id="documentos" aria-labelledby="documentos-titulo">
          <h2 className="section-title" id="documentos-titulo">Minutas de resolução do PDP</h2>
          <ul className="document-grid">
            {documents.map(({ id, title }) => (
              <li key={id}>
                <button className="resource document-resource" type="button"
                  onClick={(event) => openMaterial({ type: 'document', id }, event.currentTarget)}>
                  <span className="document-icon"><FileText size={20} aria-hidden="true" /></span>
                  <strong>{title}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <PlaylistSection />
      </main>

      <footer className="footer">
        <div className="shell footer-content">
          <span>CRA-SP · Inovação e Desenvolvimento Profissional</span>
          <a href="https://www.crasp.gov.br/" target="_blank" rel="noopener noreferrer">
            Site do CRA-SP <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </footer>

      {material && <MaterialDialog key={selection?.type + ':' + selection?.id} material={material} onClose={closeMaterial} />}
    </>
  );
}
