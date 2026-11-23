# Apresenta.ai · CRA-SP

Portal público de materiais da Gerência de Inovação e Desenvolvimento Profissional. A página dá acesso aos sites oficiais, às matrizes de acompanhamento e às quatro minutas de resolução do PDP.

## Rodar o portal

```sh
npm ci
npm run dev
npm run lint
npm run build
```

O build gera o site estático em `dist/`. A página inicial é a visualização pública.

## Montar uma playlist

1. Adicione `?editar-playlist=1#videoaulas-pdp` ao endereço do portal e selecione **Montar playlist**.
2. Informe o título e o link de cada vídeo. O player aceita links HTTPS do YouTube, Vimeo, Panda Video e arquivos MP4 ou WebM.
3. Ordene os vídeos e use **Copiar link** para compartilhar a seleção com os espectadores.

A edição salva o rascunho no navegador. **Baixar JSON** guarda uma cópia que pode ser importada em outro navegador. Para definir a playlist exibida na página inicial, salve esse JSON como `public/playlist.json` e publique uma nova versão do portal.

As amostras de IA para Administradores usam `previewSeconds: 300`. O portal encerra o player nesse ponto da reprodução. Para restringir também a mídia disponível no endereço da Panda Video, publique nesta lista embeds de clipes recortados.

## Atualizar os materiais

- `src/data/matrices.json` contém as dimensões, notas e pontos de verificação consultados na página de cada matriz.
- `src/data/documents.json` contém o texto e as tabelas dos anexos exibidos nas páginas das quatro minutas.
- `src/App.tsx` contém os links institucionais de cada produto.
