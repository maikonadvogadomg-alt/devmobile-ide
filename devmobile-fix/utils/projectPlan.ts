import type { Project, ProjectFile } from "@/context/AppContext";

interface FileNode {
  name: string;
  path: string;
  language: string;
  size: number;
  lines: number;
}

interface ApiRoute {
  method: string;
  path: string;
  file: string;
}

interface ProjectPlan {
  name: string;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  tree: string;
  apiRoutes: ApiRoute[];
  entryPoints: string[];
  suggestions: string[];
  markdown: string;
}

const LANG_COLORS: Record<string, string> = {
  typescript: "🔷", javascript: "🟡", python: "🐍", html: "🟠",
  css: "💜", json: "📋", markdown: "📝", sql: "🗄️",
  bash: "🖥️", go: "🐹", rust: "🦀", java: "☕",
  plaintext: "📄", default: "📄",
};

function buildTree(files: ProjectFile[]): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const lines: string[] = [];
  for (const f of sorted) {
    const emoji = LANG_COLORS[f.language] || LANG_COLORS.default;
    lines.push(`${emoji} ${f.name}`);
  }
  return lines.join("\n");
}

function detectApiRoutes(files: ProjectFile[]): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const routePatterns = [
    { regex: /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi, isExpress: true },
    { regex: /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi, isExpress: false },
    { regex: /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi, isExpress: true },
    { regex: /fetch\s*\(\s*['"`](\/[^'"`]+)['"`]/gi, isExpress: false },
  ];

  for (const file of files) {
    if (!["javascript", "typescript", "python"].includes(file.language)) continue;
    for (const { regex } of routePatterns) {
      let match;
      const r = new RegExp(regex.source, regex.flags);
      while ((match = r.exec(file.content)) !== null) {
        routes.push({
          method: match[1]?.toUpperCase() || "GET",
          path: match[2] || match[1],
          file: file.name,
        });
      }
    }
  }
  return routes.slice(0, 20);
}

function detectEntryPoints(files: ProjectFile[]): string[] {
  const entries: string[] = [];
  const entryNames = [
    "index.ts", "index.js", "main.ts", "main.js", "main.py",
    "app.ts", "app.js", "server.ts", "server.js", "index.html",
  ];
  for (const name of entryNames) {
    if (files.some((f) => f.name === name)) {
      entries.push(name);
    }
  }
  return entries;
}

function generateSuggestions(files: ProjectFile[], routes: ApiRoute[]): string[] {
  const suggestions: string[] = [];
  const hasReadme = files.some((f) => f.name.toLowerCase() === "readme.md");
  const hasGitignore = files.some((f) => f.name === ".gitignore");
  const hasPackageJson = files.some((f) => f.name === "package.json");
  const hasTests = files.some((f) => f.name.includes(".test.") || f.name.includes(".spec."));
  const hasEnv = files.some((f) => f.name === ".env" || f.name === ".env.example");

  if (!hasReadme) suggestions.push("📝 Adicionar README.md com instruções do projeto");
  if (!hasGitignore) suggestions.push("🚫 Adicionar .gitignore para evitar commits desnecessários");
  if (!hasTests) suggestions.push("🧪 Criar testes automatizados para as funcionalidades principais");
  if (!hasEnv && hasPackageJson) suggestions.push("🔐 Criar .env.example para variáveis de ambiente");
  if (routes.length > 5) suggestions.push("📖 Documentar as rotas de API com exemplos de uso");
  if (files.length > 20) suggestions.push("📁 Organizar arquivos em subpastas por funcionalidade");
  if (files.some((f) => f.language === "javascript" && files.some((g) => g.language === "typescript"))) {
    suggestions.push("🔷 Migrar arquivos .js para TypeScript para maior segurança de tipos");
  }
  if (suggestions.length === 0) suggestions.push("✅ Projeto bem estruturado! Continue assim.");
  return suggestions;
}

export function generateProjectPlan(project: Project): ProjectPlan {
  const files = project.files;
  const languages: Record<string, number> = {};
  let totalLines = 0;

  for (const f of files) {
    const lines = f.content.split("\n").length;
    totalLines += lines;
    languages[f.language] = (languages[f.language] || 0) + 1;
  }

  const tree = buildTree(files);
  const apiRoutes = detectApiRoutes(files);
  const entryPoints = detectEntryPoints(files);
  const suggestions = generateSuggestions(files, apiRoutes);

  const langSummary = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${LANG_COLORS[lang] || "📄"} ${lang}: ${count} arquivo${count !== 1 ? "s" : ""}`)
    .join("\n");

  const routesSummary = apiRoutes.length > 0
    ? apiRoutes.map((r) => `  \`${r.method} ${r.path}\` — ${r.file}`).join("\n")
    : "  Nenhuma rota detectada";

  const entryPointsSummary = entryPoints.length > 0
    ? entryPoints.map((e) => `  • ${e}`).join("\n")
    : "  Nenhum ponto de entrada detectado";

  const suggestionsSummary = suggestions.map((s) => `  ${s}`).join("\n");

  const markdown = `# 📋 Plano do Projeto: ${project.name}

**Gerado em:** ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}

---

## 📊 Visão Geral

| Item | Valor |
|------|-------|
| Total de arquivos | ${files.length} |
| Total de linhas | ${totalLines.toLocaleString()} |
| Linguagens | ${Object.keys(languages).length} |
| Rotas de API | ${apiRoutes.length} |

---

## 🌳 Árvore de Arquivos

\`\`\`
${tree}
\`\`\`

---

## 🗣️ Linguagens

${langSummary}

---

## 🚀 Pontos de Entrada

${entryPointsSummary}

---

## 🔌 Rotas de API Detectadas

${routesSummary}

---

## 💡 Sugestões de Melhoria

${suggestionsSummary}

---

## 📖 Descrição

${project.description || "Sem descrição."}

---

*Gerado pelo DevMobile IDE*
`;

  return {
    name: project.name,
    totalFiles: files.length,
    totalLines,
    languages,
    tree,
    apiRoutes,
    entryPoints,
    suggestions,
    markdown,
  };
}
