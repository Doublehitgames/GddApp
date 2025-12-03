# Sistema de Upload de Imagens

## Como funciona

O sistema permite fazer upload de imagens diretamente no editor WYSIWYG das seções.

### Recursos:
- ✅ Upload através do botão "image" na toolbar do editor
- ✅ Suporte para: JPG, PNG, GIF, WebP
- ✅ Tamanho máximo: 5MB por imagem
- ✅ Imagens organizadas por projeto em `public/uploads/[projectId]/`
- ✅ URLs públicas automáticas: `/uploads/[projectId]/[filename]`
- ✅ Renderização automática no preview Markdown

### Como usar:

1. Abra uma seção e clique em "Editar no preview"
2. Clique no botão 📷 "image" na toolbar
3. Escolha:
   - **Upload arquivo**: Selecione uma imagem do seu computador
   - **URL**: Cole um link de imagem externa
4. A imagem será inserida automaticamente no Markdown: `![alt](/uploads/projectId/filename.png)`
5. Clique em "Salvar" para persistir

### Estrutura de pastas:

```
public/
  uploads/
    [projectId-1]/
      123456-screenshot.png
      123457-diagram.jpg
    [projectId-2]/
      ...
```

### Limitações:

- As imagens não são versionadas no Git (estão no `.gitignore`)
- Para deploy em produção, considere migrar para CDN (Cloudinary, AWS S3, etc.)
- LocalStorage não armazena as imagens, apenas as referências (URLs)

### API Endpoint:

**POST** `/api/upload`

Body (FormData):
- `image`: File (blob)
- `projectId`: string

Response:
```json
{
  "success": true,
  "url": "/uploads/projectId/timestamp-filename.png",
  "filename": "timestamp-filename.png"
}
```
