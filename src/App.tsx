import { useEffect, useRef } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, FileText, Globe2, GraduationCap,
  Leaf, Play, Table2, Workflow,
} from 'lucide-react';
import { DocumentReader } from './DocumentReader';
import { MatrixReader } from './MatrixReader';
import type { Document, Matrix, Material } from './materialTypes';
import { mountPlaylist } from './playlist';
import './playlist.css';
import './media.css';
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
    ],
  },
] as const;

type ProductId = typeof products[number]['id'];
const matrices: Record<ProductId, Matrix> = matrixData;
const documents = documentData as Document[];

function materialAtLocation(): Material | undefined {
  const query = new URLSearchParams(window.location.search);
  const matrix = products.find(({ id }) => id === query.get('matriz'));
  if (matrix) return { type: 'matrix', data: matrices[matrix.id] };
  const data = documents.find(({ id }) => id === query.get('documento'));
  if (data) return { type: 'document', data };
}

function MaterialPage({ material }: { material: Material }) {
  const isDocument = material.type === 'document';
  const backSection = isDocument ? '#documentos' : '#materiais';
  const { title, description } = material.data;

  return (
    <main className="reading-page" id="leitura" tabIndex={-1}>
      <header className="reading-header">
        <div className="shell reading-shell">
          <a className="reading-back" href={import.meta.env.BASE_URL + backSection}>
            <ArrowLeft size={18} aria-hidden="true" />
            {isDocument ? 'Voltar às minutas' : 'Voltar aos materiais'}
          </a>
          {isDocument && <p className="reading-type">Minuta de resolução</p>}
          <h1>{title}</h1>
          {!isDocument && <p className="reading-summary">{description}</p>}
        </div>
      </header>
      <div className="shell reading-shell reading-content">
        {material.type === 'matrix' ? <MatrixReader data={material.data} /> : <DocumentReader data={material.data} />}
      </div>
    </main>
  );
}

function PlaylistSection() {
  const pdp = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pdp.current) return;
    const editor = new URLSearchParams(window.location.search).get('editar-playlist') === '1';
    return mountPlaylist(pdp.current, { editor, playlistUrl: import.meta.env.BASE_URL + 'playlist.json' });
  }, []);
  return (
    <section className="shell section playlist-section" id="videoaulas" aria-labelledby="videoaulas-titulo">
      <h2 className="section-title" id="videoaulas-titulo">Videoaulas</h2>
      <section className="media-collection" id="videoaulas-pdp" aria-label="Programa de Desenvolvimento Profissional">
        <p className="media-context">Programa de Desenvolvimento Profissional</p>
        <div ref={pdp} />
      </section>
    </section>
  );
}

export default function App() {
  const material = materialAtLocation();
  const materialTitle = material?.data.title;
  useEffect(() => {
    if (materialTitle) {
      document.title = materialTitle + ' | Apresenta.ai';
      return;
    }
    const section = window.location.hash.slice(1);
    if (['materiais', 'documentos', 'videoaulas', 'videoaulas-pdp'].includes(section)) {
      document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [materialTitle]);

  return (
    <>
      <a className="skip-link" href={material ? '#leitura' : '#materiais'}>
        {material ? 'Pular para a leitura' : 'Pular para os materiais'}
      </a>
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

      {material ? <MaterialPage material={material} /> : <main>
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
                    {links.map((link, index) => (
                      <li key={link.url}>
                        <a className={index === 0 ? 'resource resource-primary' : 'resource'}
                          href={link.url} target="_blank" rel="noopener noreferrer"
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
                      <>
                        <li>
                          <a className="resource" href="#documentos">
                            <FileText className="resource-icon" size={18} aria-hidden="true" />
                            <span><strong>Minutas de resolução</strong></span>
                            <ArrowDown size={16} aria-hidden="true" />
                          </a>
                        </li>
                        <li>
                          <a className="resource" href="#videoaulas-pdp">
                            <Play className="resource-icon" size={18} aria-hidden="true" />
                            <span><strong>Amostras da trilha de IA</strong></span>
                            <ArrowDown size={16} aria-hidden="true" />
                          </a>
                        </li>
                      </>
                    )}
                    <li className="matrix-resource-item">
                      <a className="resource matrix-resource" href={`?matriz=${id}`}
                        aria-label={`Matriz de acompanhamento de ${title}`}>
                        <Table2 className="resource-icon" size={18} aria-hidden="true" />
                        <span>
                          <strong>Matriz de acompanhamento</strong>
                          <small>{counts.dimensions} dimensões · {counts.verificationPoints} pontos de verificação</small>
                        </span>
                        <ArrowRight size={16} aria-hidden="true" />
                      </a>
                    </li>
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
                <a className="resource document-resource" href={`?documento=${id}`}>
                  <span className="document-icon"><FileText size={20} aria-hidden="true" /></span>
                  <strong>{title}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <PlaylistSection />
      </main>}

      <footer className="footer">
        <div className="shell footer-content">
          <span>CRA-SP · Inovação e Desenvolvimento Profissional</span>
          <a href="https://www.crasp.gov.br/" target="_blank" rel="noopener noreferrer">
            Site do CRA-SP <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </>
  );
}
