import AsyncStorage from "@react-native-async-storage/async-storage";
import { Paths, File as FSFile } from "expo-file-system/next";
import { clonePublicUrl } from "@/services/githubService";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

export interface Project {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
  gitRepo?: string;
  gitProvider?: "github" | "gitlab";
  language?: string;
  combinedWith?: string[];
  checkpoints?: ProjectCheckpoint[];
  tasks?: ProjectTask[];
  folder?: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isOpen?: boolean;
  isDirty?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "gemini" | "deepseek" | "mistral" | "groq" | "openrouter" | "perplexity" | "xai" | "cortesia" | "custom";
  apiKey: string;
  baseUrl?: string;
  model?: string;
  isActive: boolean;
}

export interface GitConfig {
  provider: "github" | "gitlab";
  token: string;
  username: string;
  email?: string;
  instanceUrl?: string;
}

export interface DBConfig {
  provider: "neon" | "postgres" | "sqlite" | "supabase" | "mysql" | "mongodb" | "turso" | "redis" | "firebase" | "planetscale" | "railway";
  connectionString: string;
  name: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  history: TerminalLine[];
}

export interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "info";
  content: string;
  timestamp: string;
}

export interface ProjectCheckpoint {
  id: string;
  label: string;
  createdAt: string;
  files: ProjectFile[];
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: "pendente" | "em_progresso" | "concluido";
  priority: "baixa" | "media" | "alta";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AIMemoryEntry {
  id: string;
  content: string;
  createdAt: string;
  category: "usuario" | "projeto" | "preferencia" | "geral";
}

export interface AppSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  theme: "dark" | "darker" | "monokai" | "dracula";
  showLineNumbers: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  systemPrompt: string;
  customServerUrl: string;
  geminiDirectKey: string;
  termuxPort: number;
  expoAccount: string;
  easProjectSlug: string;
  /** Servidor habilitado (Termux/VPS). Desligado por padrão — app funciona sem servidor. */
  serverEnabled: boolean;
}

interface AppContextType {
  projects: Project[];
  activeProject: Project | null;
  activeFile: ProjectFile | null;
  aiProviders: AIProvider[];
  gitConfigs: GitConfig[];
  dbConfigs: DBConfig[];
  terminalSessions: TerminalSession[];
  activeTerminal: string | null;
  settings: AppSettings;
  aiMemory: AIMemoryEntry[];
  addMemoryEntry: (entry: Omit<AIMemoryEntry, "id" | "createdAt">) => void;
  removeMemoryEntry: (id: string) => void;
  clearMemory: () => void;
  setActiveProject: (project: Project | null) => void;
  setActiveFile: (file: ProjectFile | null) => void;
  createProject: (name: string, description?: string) => Project;
  deleteProject: (id: string) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  combineProjects: (projectIds: string[], newName: string) => Project;
  createFile: (projectId: string, name: string, content?: string) => ProjectFile;
  createFiles: (projectId: string, files: Array<{ path: string; content: string }>) => ProjectFile[];
  updateFile: (projectId: string, fileId: string, content: string) => void;
  deleteFile: (projectId: string, fileId: string) => void;
  renameFile: (projectId: string, fileId: string, newName: string) => void;
  addAIProvider: (provider: Omit<AIProvider, "id">) => void;
  updateAIProvider: (id: string, data: Partial<AIProvider>) => void;
  removeAIProvider: (id: string) => void;
  setActiveAIProvider: (id: string) => void;
  getActiveAIProvider: () => AIProvider | null;
  addGitConfig: (config: GitConfig) => void;
  updateGitConfig: (provider: string, data: Partial<GitConfig>) => void;
  removeGitConfig: (provider: string) => void;
  addDBConfig: (config: DBConfig) => void;
  removeDBConfig: (name: string) => void;
  addTerminalSession: (name?: string) => TerminalSession;
  removeTerminalSession: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  addTerminalLine: (sessionId: string, line: Omit<TerminalLine, "id" | "timestamp">) => void;
  clearTerminal: (sessionId: string) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  importGitRepo: (url: string, token: string, provider: "github" | "gitlab", onProgress?: (cur: number, total: number, phase: string) => void) => Promise<Project>;
  pushToGit: (projectId: string, repoUrl: string, token: string, branch?: string, onProgress?: (cur: number, total: number, phase: string) => void) => Promise<{ pushed: number; errors: number }>;
  saveCheckpoint: (projectId: string, label?: string) => ProjectCheckpoint;
  restoreCheckpoint: (projectId: string, checkpointId: string) => void;
  deleteCheckpoint: (projectId: string, checkpointId: string) => void;
  addTask: (projectId: string, task: Omit<ProjectTask, "id" | "createdAt" | "updatedAt">) => ProjectTask;
  updateTask: (projectId: string, taskId: string, data: Partial<ProjectTask>) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  reorderTasks: (projectId: string, tasks: ProjectTask[]) => void;
  pendingTerminalCommand: string | null;
  queueTerminalCommand: (cmd: string) => void;
  clearTerminalCommand: () => void;
}

const defaultSettings: AppSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  theme: "dark",
  showLineNumbers: true,
  autoSave: true,
  autoSaveInterval: 3000,
  systemPrompt: "",
  customServerUrl: "",
  geminiDirectKey: "",
  termuxPort: 8080,
  expoAccount: "maikon1",
  easProjectSlug: "app-ide",
  serverEnabled: false,
};

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  PROJECTS: "@devmobile/projects",
  AI_PROVIDERS: "@devmobile/ai_providers",
  GIT_CONFIGS: "@devmobile/git_configs",
  DB_CONFIGS: "@devmobile/db_configs",
  SETTINGS: "@devmobile/settings",
  AI_MEMORY: "@devmobile/ai_memory",
  ACTIVE_PROJECT_ID: "@devmobile/active_project_id",
  ACTIVE_FILE_ID: "@devmobile/active_file_id",
};

// Chave legada do AsyncStorage (para migração de dados antigos)
function filesKey(projectId: string) {
  return `@devmobile/files_${projectId}`;
}

// Caminho no sistema de arquivos local para os arquivos de um projeto (sem limite de tamanho)
function projectFilesPath(projectId: string): FSFile {
  return new FSFile(Paths.document, `dm_project_${projectId}.json`);
}

// Salva os arquivos de um projeto no sistema de arquivos local (sem limite de 6MB)
async function persistProjectFiles(projectId: string, files: ProjectFile[]): Promise<void> {
  try {
    projectFilesPath(projectId).write(JSON.stringify(files));
  } catch {
    // fallback: AsyncStorage (compatibilidade com dispositivos mais antigos)
    try {
      await AsyncStorage.setItem(filesKey(projectId), JSON.stringify(files));
    } catch {}
  }
}

// Carrega os arquivos de um projeto do sistema de arquivos (com migração automática do AsyncStorage)
async function readProjectFiles(projectId: string): Promise<ProjectFile[]> {
  // Tenta o sistema de arquivos primeiro (nova versão, sem limite)
  try {
    const f = projectFilesPath(projectId);
    if (f.exists) {
      const text = await f.text();
      const parsed = JSON.parse(text) as ProjectFile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // Migração: lê do AsyncStorage (versão antiga) e move para FileSystem
  try {
    const raw = await AsyncStorage.getItem(filesKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectFile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migra para FileSystem e remove do AsyncStorage
        try {
          projectFilesPath(projectId).write(raw);
          AsyncStorage.removeItem(filesKey(projectId)).catch(() => {});
        } catch {}
        return parsed;
      }
    }
  } catch {}
  return [];
}

// Remove os arquivos de um projeto do FileSystem e do AsyncStorage
async function deleteProjectFiles(projectId: string): Promise<void> {
  try { projectFilesPath(projectId).delete(); } catch {}
  AsyncStorage.removeItem(filesKey(projectId)).catch(() => {});
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    dockerfile: "dockerfile",
    toml: "toml",
    xml: "xml",
    php: "php",
    vue: "vue",
    svelte: "svelte",
  };
  return map[ext || ""] || "plaintext";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [activeFile, setActiveFileState] = useState<ProjectFile | null>(null);
  const [aiProviders, setAIProviders] = useState<AIProvider[]>([]);
  const [gitConfigs, setGitConfigs] = useState<GitConfig[]>([]);
  const [dbConfigs, setDBConfigs] = useState<DBConfig[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [activeTerminal, setActiveTerminalState] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [aiMemory, setAIMemory] = useState<AIMemoryEntry[]>([]);
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<string | null>(null);
  const projectsRef = useRef<Project[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        const all = projectsRef.current;
        const meta = all.map((p) => ({ ...p, files: [] as ProjectFile[] }));
        AsyncStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(meta)).catch(() => {});
        all.forEach((p) => {
          if (p.files.length > 0) persistProjectFiles(p.id, p.files).catch(() => {});
        });
      }
    });
    return () => sub.remove();
  }, []);

  async function loadData() {
    const safeGet = async <T,>(key: string): Promise<T | null> => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch { return null; }
    };

    const [p, ai, git, db, s, mem, savedProjectId, savedFileId] = await Promise.all([
      safeGet<Project[]>(STORAGE_KEYS.PROJECTS),
      safeGet<AIProvider[]>(STORAGE_KEYS.AI_PROVIDERS),
      safeGet<GitConfig[]>(STORAGE_KEYS.GIT_CONFIGS),
      safeGet<DBConfig[]>(STORAGE_KEYS.DB_CONFIGS),
      safeGet<AppSettings>(STORAGE_KEYS.SETTINGS),
      safeGet<AIMemoryEntry[]>(STORAGE_KEYS.AI_MEMORY),
      safeGet<string>(STORAGE_KEYS.ACTIVE_PROJECT_ID),
      safeGet<string>(STORAGE_KEYS.ACTIVE_FILE_ID),
    ]);

    if (p && Array.isArray(p)) {
      // Carrega arquivos de cada projeto do FileSystem (sem limite de tamanho)
      // Migra automaticamente do AsyncStorage se necessário
      const projectsWithFiles: Project[] = await Promise.all(
        p.map(async (proj) => {
          const files = await readProjectFiles(proj.id);
          return { ...proj, files };
        })
      );
      setProjects(projectsWithFiles);
      // Restaura projeto e arquivo ativos da última sessão
      if (savedProjectId) {
        const savedProject = projectsWithFiles.find((proj) => proj.id === savedProjectId);
        if (savedProject) {
          setActiveProjectState(savedProject);
          if (savedFileId) {
            const savedFile = savedProject.files.find((f) => f.id === savedFileId);
            if (savedFile) setActiveFileState(savedFile);
          }
        }
      }
    }

    const CORTESIA_DEFAULT: AIProvider = {
      id: "cortesia-default",
      name: "Gemini (Gratuito)",
      type: "cortesia",
      apiKey: "",
      isActive: true,
    };
    if (ai && Array.isArray(ai) && ai.length > 0) {
      // garante que o provedor cortesia sempre existe
      const hasCortesia = ai.some((p) => p.type === "cortesia");
      setAIProviders(hasCortesia ? ai : [CORTESIA_DEFAULT, ...ai]);
    } else {
      setAIProviders([CORTESIA_DEFAULT]);
    }

    if (git && Array.isArray(git)) setGitConfigs(git);
    if (db && Array.isArray(db)) setDBConfigs(db);
    if (s && typeof s === "object") setSettings({ ...defaultSettings, ...s });
    if (mem && Array.isArray(mem)) setAIMemory(mem);
  }

  // Salva metadados dos projetos (SEM arquivos — arquivos vão para FileSystem via persistProjectFiles)
  // NUNCA salva arquivos aqui para evitar race condition com saveProjectFiles
  async function save(key: string, data: unknown) {
    try {
      if (key === STORAGE_KEYS.PROJECTS) {
        const projects = data as Project[];
        // Salva APENAS metadados — arquivos são salvos separadamente via saveProjectFiles
        const meta = projects.map((p) => ({ ...p, files: [] as ProjectFile[] }));
        await AsyncStorage.setItem(key, JSON.stringify(meta));
      } else {
        await AsyncStorage.setItem(key, JSON.stringify(data));
      }
    } catch {}
  }

  // Salva arquivos de um projeto usando FileSystem (sem limite de tamanho)
  async function saveProjectFiles(projectId: string, files: ProjectFile[]) {
    await persistProjectFiles(projectId, files);
  }

  const setActiveProject = useCallback((project: Project | null) => {
    setActiveFileState(null);
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE_ID).catch(() => {});

    if (!project) {
      setActiveProjectState(null);
      AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID).catch(() => {});
      return;
    }

    // Define o projeto imediatamente para que a UI responda rápido
    setActiveProjectState(project);
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, project.id).catch(() => {});

    // Se o projeto chegou sem arquivos, recarrega do FileSystem
    // (migração de sessão antiga ou race condition na inicialização)
    if (project.files.length === 0) {
      readProjectFiles(project.id).then((files) => {
        if (files.length > 0) {
          setActiveProjectState((prev) =>
            prev?.id === project.id ? { ...prev, files } : prev
          );
        }
      });
    }
  }, []);

  const setActiveFile = useCallback((file: ProjectFile | null) => {
    setActiveFileState(file);
    if (file) {
      AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_FILE_ID, file.id).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_FILE_ID).catch(() => {});
    }
  }, []);

  const createProject = useCallback(
    (name: string, description = ""): Project => {
      const project: Project = {
        id: generateId(),
        name,
        description,
        files: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => {
        const next = [...prev, project];
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      return project;
    },
    []
  );

  const deleteProject = useCallback((id: string) => {
    // Remove arquivos do FileSystem e AsyncStorage (legado)
    deleteProjectFiles(id);
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      save(STORAGE_KEYS.PROJECTS, next);
      return next;
    });
    setActiveProjectState((prev) => (prev?.id === id ? null : prev));
  }, []);

  const updateProject = useCallback((id: string, data: Partial<Project>) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
      );
      save(STORAGE_KEYS.PROJECTS, next);
      return next;
    });
    setActiveProjectState((prev) =>
      prev?.id === id ? { ...prev, ...data, updatedAt: new Date().toISOString() } : prev
    );
  }, []);

  const combineProjects = useCallback(
    (projectIds: string[], newName: string): Project => {
      const toMerge = projects.filter((p) => projectIds.includes(p.id));
      const allFiles: ProjectFile[] = [];
      toMerge.forEach((p) => {
        p.files.forEach((f) => {
          allFiles.push({ ...f, id: generateId() });
        });
      });
      const combined: Project = {
        id: generateId(),
        name: newName,
        description: `Combined from: ${toMerge.map((p) => p.name).join(", ")}`,
        files: allFiles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        combinedWith: projectIds,
      };
      setProjects((prev) => {
        const next = [...prev, combined];
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      return combined;
    },
    [projects]
  );

  const createFile = useCallback(
    (projectId: string, name: string, content = ""): ProjectFile => {
      const cleanPath = name.replace(/\\/g, "/").replace(/^\/+/, "");
      const baseName = cleanPath.includes("/") ? cleanPath.split("/").pop()! : cleanPath;
      const file: ProjectFile = {
        id: generateId(),
        name: baseName,
        path: cleanPath,
        content,
        language: detectLanguage(baseName),
      };
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? { ...p, files: [...p.files, file], updatedAt: new Date().toISOString() }
            : p
        );
        const proj = next.find((p) => p.id === projectId);
        if (proj) saveProjectFiles(projectId, proj.files);
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) =>
        prev?.id === projectId
          ? { ...prev, files: [...prev.files, file], updatedAt: new Date().toISOString() }
          : prev
      );
      return file;
    },
    []
  );

  const createFiles = useCallback(
    (projectId: string, incoming: Array<{ path: string; content: string }>): ProjectFile[] => {
      const newFiles: ProjectFile[] = incoming.map(({ path: rawPath, content }) => {
        const cleanPath = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
        const baseName = cleanPath.includes("/") ? cleanPath.split("/").pop()! : cleanPath;
        return {
          id: generateId(),
          name: baseName,
          path: cleanPath,
          content,
          language: detectLanguage(baseName),
        };
      });
      setProjects((prev) => {
        const next = prev.map((p) => {
          if (p.id !== projectId) return p;
          const existingPaths = new Set(p.files.map((f) => f.path));
          const toAdd = newFiles.filter((f) => !existingPaths.has(f.path));
          const merged = [...p.files, ...toAdd];
          return { ...p, files: merged, updatedAt: new Date().toISOString() };
        });
        const proj = next.find((p) => p.id === projectId);
        if (proj) saveProjectFiles(projectId, proj.files);
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) => {
        if (!prev || prev.id !== projectId) return prev;
        const existingPaths = new Set(prev.files.map((f) => f.path));
        const toAdd = newFiles.filter((f) => !existingPaths.has(f.path));
        return { ...prev, files: [...prev.files, ...toAdd], updatedAt: new Date().toISOString() };
      });
      return newFiles;
    },
    []
  );

  const updateFile = useCallback(
    (projectId: string, fileId: string, content: string) => {
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                files: p.files.map((f) =>
                  f.id === fileId ? { ...f, content, isDirty: false } : f
                ),
                updatedAt: new Date().toISOString(),
              }
            : p
        );
        // Salva só os arquivos do projeto afetado — rápido mesmo com 5.000 arquivos
        const proj = next.find((p) => p.id === projectId);
        if (proj) saveProjectFiles(projectId, proj.files);
        return next;
      });
      setActiveProjectState((prev) =>
        prev?.id === projectId
          ? {
              ...prev,
              files: prev.files.map((f) =>
                f.id === fileId ? { ...f, content, isDirty: false } : f
              ),
            }
          : prev
      );
      setActiveFileState((prev) =>
        prev?.id === fileId ? { ...prev, content, isDirty: false } : prev
      );
    },
    []
  );

  const deleteFile = useCallback((projectId: string, fileId: string) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              files: p.files.filter((f) => f.id !== fileId),
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      const proj = next.find((p) => p.id === projectId);
      if (proj) saveProjectFiles(projectId, proj.files);
      save(STORAGE_KEYS.PROJECTS, next);
      return next;
    });
    setActiveProjectState((prev) =>
      prev?.id === projectId
        ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) }
        : prev
    );
    setActiveFileState((prev) => (prev?.id === fileId ? null : prev));
  }, []);

  const renameFile = useCallback(
    (projectId: string, fileId: string, newName: string) => {
      setProjects((prev) => {
        const next = prev.map((p) => {
          if (p.id !== projectId) return p;
          const files = p.files.map((f) => {
            if (f.id !== fileId) return f;
            const oldPath = f.path || f.name;
            const parentDir = oldPath.includes("/") ? oldPath.split("/").slice(0, -1).join("/") : "";
            const newPath = parentDir ? `${parentDir}/${newName}` : newName;
            return { ...f, name: newName, path: newPath, language: detectLanguage(newName) };
          });
          return { ...p, files, updatedAt: new Date().toISOString() };
        });
        const proj = next.find((p) => p.id === projectId);
        if (proj) saveProjectFiles(projectId, proj.files);
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
    },
    []
  );

  const addAIProvider = useCallback((provider: Omit<AIProvider, "id">) => {
    const newP: AIProvider = { ...provider, id: generateId() };
    setAIProviders((prev) => {
      const next = [...prev, newP];
      save(STORAGE_KEYS.AI_PROVIDERS, next);
      return next;
    });
  }, []);

  const updateAIProvider = useCallback(
    (id: string, data: Partial<AIProvider>) => {
      setAIProviders((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
        save(STORAGE_KEYS.AI_PROVIDERS, next);
        return next;
      });
    },
    []
  );

  const removeAIProvider = useCallback((id: string) => {
    setAIProviders((prev) => {
      const next = prev.filter((p) => p.id !== id);
      save(STORAGE_KEYS.AI_PROVIDERS, next);
      return next;
    });
  }, []);

  const setActiveAIProvider = useCallback((id: string) => {
    setAIProviders((prev) => {
      const next = prev.map((p) => ({ ...p, isActive: p.id === id }));
      save(STORAGE_KEYS.AI_PROVIDERS, next);
      return next;
    });
  }, []);

  const getActiveAIProvider = useCallback((): AIProvider | null => {
    return aiProviders.find((p) => p.isActive) ?? null;
  }, [aiProviders]);

  const addGitConfig = useCallback((config: GitConfig) => {
    setGitConfigs((prev) => {
      const next = [...prev.filter((g) => g.provider !== config.provider), config];
      save(STORAGE_KEYS.GIT_CONFIGS, next);
      return next;
    });
  }, []);

  const updateGitConfig = useCallback(
    (provider: string, data: Partial<GitConfig>) => {
      setGitConfigs((prev) => {
        const next = prev.map((g) => (g.provider === provider ? { ...g, ...data } : g));
        save(STORAGE_KEYS.GIT_CONFIGS, next);
        return next;
      });
    },
    []
  );

  const removeGitConfig = useCallback((provider: string) => {
    setGitConfigs((prev) => {
      const next = prev.filter((g) => g.provider !== provider);
      save(STORAGE_KEYS.GIT_CONFIGS, next);
      return next;
    });
  }, []);

  const addDBConfig = useCallback((config: DBConfig) => {
    setDBConfigs((prev) => {
      const next = [...prev, config];
      save(STORAGE_KEYS.DB_CONFIGS, next);
      return next;
    });
  }, []);

  const removeDBConfig = useCallback((name: string) => {
    setDBConfigs((prev) => {
      const next = prev.filter((d) => d.name !== name);
      save(STORAGE_KEYS.DB_CONFIGS, next);
      return next;
    });
  }, []);

  const addTerminalSession = useCallback((name?: string): TerminalSession => {
    const session: TerminalSession = {
      id: generateId(),
      name: name || `Terminal ${Date.now()}`,
      history: [],
    };
    setTerminalSessions((prev) => [...prev, session]);
    setActiveTerminalState(session.id);
    return session;
  }, []);

  const removeTerminalSession = useCallback((id: string) => {
    setTerminalSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveTerminalState((prev) => (prev === id ? null : prev));
  }, []);

  const setActiveTerminal = useCallback((id: string | null) => {
    setActiveTerminalState(id);
  }, []);

  const addTerminalLine = useCallback(
    (sessionId: string, line: Omit<TerminalLine, "id" | "timestamp">) => {
      const fullLine: TerminalLine = {
        ...line,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      setTerminalSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, history: [...s.history, fullLine] }
            : s
        )
      );
    },
    []
  );

  const clearTerminal = useCallback((sessionId: string) => {
    setTerminalSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, history: [] } : s))
    );
  }, []);

  const updateSettings = useCallback((s: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      save(STORAGE_KEYS.SETTINGS, next);
      return next;
    });
  }, []);

  const importGitRepo = useCallback(
    async (url: string, token: string, provider: "github" | "gitlab", onProgress?: (cur: number, total: number, phase: string) => void): Promise<Project> => {
      const clean = url.trim().replace(/\.git$/, "");
      let repoName = clean.split("/").pop() || "repo";
      let files: ProjectFile[] = [];

      if (provider === "github") {
        // Usa zipball — 1 requisição, suporta 38.000+ arquivos sem rate limit
        const result = await clonePublicUrl(url.trim(), token || undefined, onProgress);
        repoName = result.repoName.split("/").pop() || result.repoName;
        files = result.files.map((f) => ({
          id: generateId(),
          name: f.path.split("/").pop() || f.path,
          path: f.path,
          content: f.content,
          language: detectLanguage(f.path.split("/").pop() || f.path),
        }));
      } else if (provider === "gitlab") {
        const match = clean.match(/gitlab\.com\/([^?#]+)/);
        if (match && token) {
          const projectPath = encodeURIComponent(match[1]);
          const headers: Record<string, string> = {
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json",
          };
          // Busca todos os arquivos com paginação (sem limite)
          let allItems: { type: string; path: string }[] = [];
          let page = 1;
          while (true) {
            const treeRes = await fetch(
              `https://gitlab.com/api/v4/projects/${projectPath}/repository/tree?recursive=true&per_page=100&page=${page}`,
              { headers }
            );
            if (!treeRes.ok) break;
            const batch = await treeRes.json() as { type: string; path: string }[];
            if (!batch || batch.length === 0) break;
            allItems = allItems.concat(batch);
            if (batch.length < 100) break;
            page++;
          }
          if (allItems.length > 0) {
            const blobs = allItems.filter((i) => i.type === "blob");
            for (const item of blobs) {
              try {
                const fr = await fetch(
                  `https://gitlab.com/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(item.path)}/raw`,
                  { headers }
                );
                if (fr.ok) {
                  const content = await fr.text();
                  const ext = item.path.split(".").pop() || "";
                  files.push({
                    id: generateId(),
                    name: item.path.split("/").pop() || item.path,
                    path: item.path,
                    content,
                    language: ext || "plaintext",
                  });
                }
              } catch {}
            }
          }
        }
      }

      if (files.length === 0) {
        throw new Error("Nenhum arquivo foi importado. Verifique se o repositório é público ou se o token tem permissão de acesso.");
      }

      const projectId = generateId();

      const project: Project = {
        id: projectId,
        name: repoName,
        description: `Importado de ${provider}: ${url}`,
        files,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        gitRepo: url,
        gitProvider: provider,
      };

      // Coloca o projeto no estado IMEDIATAMENTE — UI aparece na hora
      // sem esperar o disco. Salvamento no disco vai em segundo plano.
      setProjects((prev) => {
        const next = [...prev, project];
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });

      // Salva no disco em segundo plano — não bloqueia a UI
      persistProjectFiles(projectId, files).catch(() => {
        // fallback: tenta AsyncStorage
        try {
          AsyncStorage.setItem(filesKey(projectId), JSON.stringify(files)).catch(() => {});
        } catch {}
      });

      return project;
    },
    []
  );

  const pushToGit = useCallback(
    async (
      projectId: string,
      repoUrl: string,
      token: string,
      branch = "main",
      onProgress?: (cur: number, total: number, phase: string) => void
    ): Promise<{ pushed: number; errors: number }> => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Projeto não encontrado");

      const clean = repoUrl.trim().replace(/\.git$/, "");
      const isGitLab = clean.includes("gitlab.com");

      const ghHeaders = (contentType = true): Record<string, string> => ({
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(contentType ? { "Content-Type": "application/json" } : {}),
      });

      const validFiles = project.files.filter((f) => {
        const p = f.path || f.name;
        return p && !p.endsWith(".gitkeep") && f.content !== undefined;
      });
      const total = validFiles.length;

      if (!isGitLab) {
        // ── GitHub: Git Trees API ─────────────────────────────────────────────
        // Abordagem em LOTE: 1 commit para todos os arquivos, não 1 PUT por arquivo
        const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error("URL do GitHub inválida. Formato: https://github.com/usuario/repositorio");
        const [, owner, repo] = match;
        const api = `https://api.github.com/repos/${owner}/${repo}`;

        // Passo 1: obter SHA do último commit do branch
        onProgress?.(0, total, "Conectando ao repositório...");
        const refRes = await fetch(`${api}/git/ref/heads/${branch}`, { headers: ghHeaders() });
        if (!refRes.ok) {
          // Branch não existe — tentar criar a partir do commit raiz
          if (refRes.status === 404) throw new Error(`Branch "${branch}" não existe. Crie-o no GitHub primeiro ou use "main".`);
          const e = await refRes.json().catch(() => ({}));
          throw new Error((e as any)?.message || `Erro ao acessar o repositório (${refRes.status})`);
        }
        const refData = await refRes.json();
        const latestCommitSha: string = refData.object.sha;

        // Passo 2: criar blobs em lotes de 10 (evita rate limit)
        const CHUNK = 10;
        const treeNodes: Array<{ path: string; mode: string; type: string; sha: string }> = [];
        let done = 0;
        let errors = 0;

        for (let i = 0; i < validFiles.length; i += CHUNK) {
          const chunk = validFiles.slice(i, i + CHUNK);
          const results = await Promise.allSettled(
            chunk.map(async (f) => {
              const filePath = (f.path || f.name).replace(/^\//, "");
              const isB64 = f.content.startsWith("data:");
              let blobContent: string;
              let encoding: string;
              if (isB64) {
                blobContent = f.content.split(",")[1] || "";
                encoding = "base64";
              } else {
                blobContent = f.content;
                encoding = "utf-8";
              }
              const blobRes = await fetch(`${api}/git/blobs`, {
                method: "POST",
                headers: ghHeaders(),
                body: JSON.stringify({ content: blobContent, encoding }),
              });
              if (!blobRes.ok) throw new Error(`blob fail: ${filePath}`);
              const blobData = await blobRes.json();
              return { path: filePath, mode: "100644", type: "blob", sha: blobData.sha };
            })
          );
          for (const r of results) {
            if (r.status === "fulfilled") treeNodes.push(r.value as any);
            else errors++;
          }
          done += chunk.length;
          onProgress?.(done, total, `Criando blobs ${done}/${total}...`);
        }

        if (treeNodes.length === 0) throw new Error("Nenhum arquivo pôde ser enviado.");

        // Passo 3: criar uma única árvore com todos os arquivos
        onProgress?.(total, total, "Criando commit...");
        const treeRes = await fetch(`${api}/git/trees`, {
          method: "POST",
          headers: ghHeaders(),
          body: JSON.stringify({ base_tree: latestCommitSha, tree: treeNodes }),
        });
        if (!treeRes.ok) {
          const e = await treeRes.json().catch(() => ({}));
          throw new Error((e as any)?.message || "Falha ao criar árvore de arquivos");
        }
        const treeData = await treeRes.json();

        // Passo 4: criar commit
        const now = new Date().toLocaleString("pt-BR");
        const commitRes = await fetch(`${api}/git/commits`, {
          method: "POST",
          headers: ghHeaders(),
          body: JSON.stringify({
            message: `DevMobile: ${treeNodes.length} arquivo(s) — ${now}`,
            tree: treeData.sha,
            parents: [latestCommitSha],
          }),
        });
        if (!commitRes.ok) {
          const e = await commitRes.json().catch(() => ({}));
          throw new Error((e as any)?.message || "Falha ao criar commit");
        }
        const commitData = await commitRes.json();

        // Passo 5: atualizar branch
        const updateRes = await fetch(`${api}/git/refs/heads/${branch}`, {
          method: "PATCH",
          headers: ghHeaders(),
          body: JSON.stringify({ sha: commitData.sha }),
        });
        if (!updateRes.ok) {
          const e = await updateRes.json().catch(() => ({}));
          throw new Error((e as any)?.message || "Falha ao atualizar branch");
        }

        // Salva gitRepo no projeto
        setProjects((prev) => {
          const next = prev.map((p) =>
            p.id === projectId ? { ...p, gitRepo: repoUrl, updatedAt: new Date().toISOString() } : p
          );
          save(STORAGE_KEYS.PROJECTS, next);
          return next;
        });

        return { pushed: treeNodes.length, errors };

      } else {
        // ── GitLab: Commits API (batch) ────────────────────────────────────────
        const match = clean.match(/gitlab\.com\/([^?#]+)/);
        if (!match) throw new Error("URL do GitLab inválida. Formato: https://gitlab.com/usuario/repositorio");
        const projectPath = encodeURIComponent(match[1]);
        const api = `https://gitlab.com/api/v4/projects/${projectPath}`;
        const glHeaders = { "PRIVATE-TOKEN": token, "Content-Type": "application/json" };

        onProgress?.(0, total, "Conectando ao GitLab...");

        // Verifica arquivos existentes para decidir create vs update
        const actions: Array<Record<string, string>> = [];
        let done = 0;
        const CHUNK = 20;

        for (let i = 0; i < validFiles.length; i += CHUNK) {
          const chunk = validFiles.slice(i, i + CHUNK);
          await Promise.allSettled(
            chunk.map(async (f) => {
              const filePath = (f.path || f.name).replace(/^\//, "");
              const checkRes = await fetch(`${api}/repository/files/${encodeURIComponent(filePath)}?ref=${branch}`, {
                headers: { "PRIVATE-TOKEN": token },
              });
              actions.push({
                action: checkRes.ok ? "update" : "create",
                file_path: filePath,
                content: f.content,
                encoding: f.content.startsWith("data:") ? "base64" : "text",
              });
            })
          );
          done += chunk.length;
          onProgress?.(done, total, `Verificando ${done}/${total}...`);
        }

        onProgress?.(total, total, "Criando commit...");
        const now = new Date().toLocaleString("pt-BR");
        const commitRes = await fetch(`${api}/repository/commits`, {
          method: "POST",
          headers: glHeaders,
          body: JSON.stringify({
            branch,
            commit_message: `DevMobile: ${actions.length} arquivo(s) — ${now}`,
            actions,
          }),
        });
        if (!commitRes.ok) {
          const e = await commitRes.json().catch(() => ({}));
          throw new Error((e as any)?.message || `Falha ao criar commit GitLab (${commitRes.status})`);
        }

        setProjects((prev) => {
          const next = prev.map((p) =>
            p.id === projectId ? { ...p, gitRepo: repoUrl, updatedAt: new Date().toISOString() } : p
          );
          save(STORAGE_KEYS.PROJECTS, next);
          return next;
        });

        return { pushed: actions.length, errors: 0 };
      }
    },
    [projects]
  );

  const saveCheckpoint = useCallback(
    (projectId: string, label?: string): ProjectCheckpoint => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Projeto não encontrado");
      const checkpoint: ProjectCheckpoint = {
        id: generateId(),
        label: label || `Checkpoint ${new Date().toLocaleString("pt-BR")}`,
        createdAt: new Date().toISOString(),
        files: project.files.map((f) => ({ ...f })),
      };
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? { ...p, checkpoints: [...(p.checkpoints || []).slice(-9), checkpoint] }
            : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      return checkpoint;
    },
    [projects]
  );

  const restoreCheckpoint = useCallback(
    (projectId: string, checkpointId: string) => {
      setProjects((prev) => {
        const project = prev.find((p) => p.id === projectId);
        const checkpoint = project?.checkpoints?.find((c) => c.id === checkpointId);
        if (!project || !checkpoint) return prev;
        const next = prev.map((p) =>
          p.id === projectId
            ? { ...p, files: checkpoint.files.map((f) => ({ ...f })), updatedAt: new Date().toISOString() }
            : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) => {
        if (!prev || prev.id !== projectId) return prev;
        const checkpoint = prev.checkpoints?.find((c) => c.id === checkpointId);
        if (!checkpoint) return prev;
        return { ...prev, files: checkpoint.files.map((f) => ({ ...f })) };
      });
      setActiveFileState(null);
    },
    []
  );

  const deleteCheckpoint = useCallback(
    (projectId: string, checkpointId: string) => {
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? { ...p, checkpoints: (p.checkpoints || []).filter((c) => c.id !== checkpointId) }
            : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
    },
    []
  );

  // ── TASKI — Task management ────────────────────────────────────────────
  const addTask = useCallback(
    (projectId: string, taskData: Omit<ProjectTask, "id" | "createdAt" | "updatedAt">): ProjectTask => {
      const task: ProjectTask = {
        ...taskData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId ? { ...p, tasks: [...(p.tasks || []), task] } : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) =>
        prev?.id === projectId ? { ...prev, tasks: [...(prev.tasks || []), task] } : prev
      );
      return task;
    },
    []
  );

  const updateTask = useCallback(
    (projectId: string, taskId: string, data: Partial<ProjectTask>) => {
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tasks: (p.tasks || []).map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        ...data,
                        updatedAt: new Date().toISOString(),
                        completedAt:
                          data.status === "concluido" && t.status !== "concluido"
                            ? new Date().toISOString()
                            : data.status !== "concluido"
                            ? undefined
                            : t.completedAt,
                      }
                    : t
                ),
              }
            : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) =>
        prev?.id === projectId
          ? {
              ...prev,
              tasks: (prev.tasks || []).map((t) =>
                t.id === taskId ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
              ),
            }
          : prev
      );
    },
    []
  );

  const deleteTask = useCallback(
    (projectId: string, taskId: string) => {
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? { ...p, tasks: (p.tasks || []).filter((t) => t.id !== taskId) }
            : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) =>
        prev?.id === projectId
          ? { ...prev, tasks: (prev.tasks || []).filter((t) => t.id !== taskId) }
          : prev
      );
    },
    []
  );

  const reorderTasks = useCallback(
    (projectId: string, newTasks: ProjectTask[]) => {
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === projectId ? { ...p, tasks: newTasks } : p
        );
        save(STORAGE_KEYS.PROJECTS, next);
        return next;
      });
      setActiveProjectState((prev) =>
        prev?.id === projectId ? { ...prev, tasks: newTasks } : prev
      );
    },
    []
  );

  const addMemoryEntry = useCallback(
    (entry: Omit<AIMemoryEntry, "id" | "createdAt">) => {
      setAIMemory((prev) => {
        const newEntry: AIMemoryEntry = {
          ...entry,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        const next = [...prev, newEntry].slice(-500);
        save(STORAGE_KEYS.AI_MEMORY, next);
        return next;
      });
    },
    []
  );

  const removeMemoryEntry = useCallback((id: string) => {
    setAIMemory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(STORAGE_KEYS.AI_MEMORY, next);
      return next;
    });
  }, []);

  const clearMemory = useCallback(() => {
    setAIMemory([]);
    save(STORAGE_KEYS.AI_MEMORY, []);
  }, []);

  const queueTerminalCommand = useCallback((cmd: string) => {
    setPendingTerminalCommand(cmd);
  }, []);

  const clearTerminalCommand = useCallback(() => {
    setPendingTerminalCommand(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        projects,
        activeProject,
        activeFile,
        aiProviders,
        gitConfigs,
        dbConfigs,
        terminalSessions,
        activeTerminal,
        settings,
        aiMemory,
        addMemoryEntry,
        removeMemoryEntry,
        clearMemory,
        setActiveProject,
        setActiveFile,
        createProject,
        deleteProject,
        updateProject,
        combineProjects,
        createFile,
        createFiles,
        updateFile,
        deleteFile,
        renameFile,
        addAIProvider,
        updateAIProvider,
        removeAIProvider,
        setActiveAIProvider,
        getActiveAIProvider,
        addGitConfig,
        updateGitConfig,
        removeGitConfig,
        addDBConfig,
        removeDBConfig,
        addTerminalSession,
        removeTerminalSession,
        setActiveTerminal,
        addTerminalLine,
        clearTerminal,
        updateSettings,
        importGitRepo,
        pushToGit,
        saveCheckpoint,
        restoreCheckpoint,
        deleteCheckpoint,
        addTask,
        updateTask,
        deleteTask,
        reorderTasks,
        pendingTerminalCommand,
        queueTerminalCommand,
        clearTerminalCommand,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
