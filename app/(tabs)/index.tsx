import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LibrarySearch from "@/components/LibrarySearch";
import ProjectPlanModal from "@/components/ProjectPlanModal";
import { useApp } from "@/context/AppContext";
import { useApiBase } from "@/hooks/useApiBase";
import { useColors } from "@/hooks/useColors";
import { exportZip, importTar, importZip } from "@/utils/zipUtils";
import type { Project } from "@/context/AppContext";
import { FEATURED_PROJECTS } from "@/data/featuredProjects";

const TEMPLATES: Record<string, { label: string; icon: string; files: { name: string; content: string }[] }> = {
  vazio: {
    label: "Vazio",
    icon: "box",
    files: [
      { name: "README.md", content: "# Novo Projeto\n\nDescreva seu projeto aqui.\n\n## Instalação\n```bash\nnpm install\n```\n\n## Uso\n```bash\nnpm start\n```\n" },
      { name: ".gitignore", content: "node_modules/\n.env\n.DS_Store\ndist/\nbuild/\n*.log\n" },
    ],
  },
  javascript: {
    label: "JavaScript",
    icon: "code",
    files: [
      { name: "index.js", content: `const fs = require('fs');
const path = require('path');

// Configuração
const config = {
  nome: 'Meu App',
  versao: '1.0.0',
  debug: process.env.NODE_ENV !== 'production',
};

// Utilitários
function formatarData(data = new Date()) {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Classe principal
class App {
  constructor(config) {
    this.config = config;
    this.dados = [];
    this.inicializado = false;
  }

  async inicializar() {
    console.log(\`[\${formatarData()}] Iniciando \${this.config.nome} v\${this.config.versao}\`);
    await sleep(100);
    this.inicializado = true;
    return this;
  }

  adicionar(item) {
    if (!this.inicializado) throw new Error('App não inicializado');
    const registro = { id: Date.now(), ...item, criadoEm: new Date().toISOString() };
    this.dados.push(registro);
    return registro;
  }

  buscar(id) {
    return this.dados.find(d => d.id === id) || null;
  }

  listar(filtro = {}) {
    return this.dados.filter(d =>
      Object.entries(filtro).every(([k, v]) => d[k] === v)
    );
  }

  remover(id) {
    const idx = this.dados.findIndex(d => d.id === id);
    if (idx === -1) return false;
    this.dados.splice(idx, 1);
    return true;
  }

  status() {
    return {
      nome: this.config.nome,
      versao: this.config.versao,
      totalRegistros: this.dados.length,
      inicializado: this.inicializado,
      dataAtual: formatarData(),
    };
  }
}

// Execução
async function main() {
  const app = await new App(config).inicializar();

  app.adicionar({ nome: 'Primeiro Item', tipo: 'exemplo' });
  app.adicionar({ nome: 'Segundo Item', tipo: 'exemplo' });
  app.adicionar({ nome: 'Item Especial', tipo: 'especial' });

  console.log('Todos:', app.listar());
  console.log('Exemplos:', app.listar({ tipo: 'exemplo' }));
  console.log('Status:', app.status());
}

main().catch(console.error);
` },
      { name: "package.json", content: '{\n  "name": "meu-projeto-js",\n  "version": "1.0.0",\n  "description": "Projeto JavaScript",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js",\n    "dev": "nodemon index.js",\n    "test": "node --test"\n  },\n  "dependencies": {},\n  "devDependencies": {\n    "nodemon": "^3.0.0"\n  }\n}\n' },
      { name: ".env", content: "NODE_ENV=development\nPORT=3000\n" },
      { name: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { name: "README.md", content: "# Meu Projeto JavaScript\n\n## Instalação\n```bash\nnpm install\n```\n\n## Executar\n```bash\nnpm start\n# ou em modo desenvolvimento:\nnpm run dev\n```\n" },
    ],
  },
  typescript: {
    label: "TypeScript",
    icon: "file-text",
    files: [
      { name: "src/index.ts", content: `import path from 'path';

// Tipos
interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: 'admin' | 'usuario' | 'visitante';
  criadoEm: Date;
}

interface RespostaAPI<T> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
  total?: number;
}

// Repositório genérico
class Repositorio<T extends { id: number }> {
  private items: T[] = [];
  private nextId = 1;

  criar(data: Omit<T, 'id'>): T {
    const item = { ...data, id: this.nextId++ } as T;
    this.items.push(item);
    return item;
  }

  buscarPorId(id: number): T | undefined {
    return this.items.find(i => i.id === id);
  }

  listarTodos(filtro?: Partial<T>): T[] {
    if (!filtro) return [...this.items];
    return this.items.filter(item =>
      Object.entries(filtro).every(([k, v]) => (item as Record<string, unknown>)[k] === v)
    );
  }

  atualizar(id: number, data: Partial<T>): T | null {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    this.items[idx] = { ...this.items[idx], ...data };
    return this.items[idx];
  }

  remover(id: number): boolean {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }
}

// Serviço de usuários
class ServicoUsuario {
  private repo = new Repositorio<Usuario>();

  criar(nome: string, email: string, papel: Usuario['papel'] = 'usuario'): RespostaAPI<Usuario> {
    if (!email.includes('@')) {
      return { sucesso: false, erro: 'Email inválido' };
    }
    const usuario = this.repo.criar({ nome, email, papel, criadoEm: new Date() });
    return { sucesso: true, dados: usuario };
  }

  buscar(id: number): RespostaAPI<Usuario> {
    const usuario = this.repo.buscarPorId(id);
    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado' };
    return { sucesso: true, dados: usuario };
  }

  listar(papel?: Usuario['papel']): RespostaAPI<Usuario[]> {
    const todos = papel ? this.repo.listarTodos({ papel } as Partial<Usuario>) : this.repo.listarTodos();
    return { sucesso: true, dados: todos, total: todos.length };
  }
}

// Main
async function main(): Promise<void> {
  const servico = new ServicoUsuario();

  console.log('=== Sistema de Usuários ===\\n');

  const r1 = servico.criar('João Silva', 'joao@email.com', 'admin');
  const r2 = servico.criar('Maria Souza', 'maria@email.com', 'usuario');
  const r3 = servico.criar('Carlos Lima', 'carlos@email.com', 'usuario');

  console.log('Criados:', [r1, r2, r3].map(r => r.dados?.nome));

  const lista = servico.listar();
  console.log('Total de usuários:', lista.total);
  console.log('Usuários:', lista.dados?.map(u => \`\${u.nome} (\${u.papel})\`));

  const buscado = servico.buscar(1);
  console.log('\\nUsuário ID 1:', buscado.dados);
}

main().catch(console.error);
` },
      { name: "tsconfig.json", content: '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "commonjs",\n    "lib": ["ES2022"],\n    "strict": true,\n    "esModuleInterop": true,\n    "skipLibCheck": true,\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "resolveJsonModule": true,\n    "declaration": true,\n    "sourceMap": true\n  },\n  "include": ["src/**/*"],\n  "exclude": ["node_modules", "dist"]\n}\n' },
      { name: "package.json", content: '{\n  "name": "meu-projeto-ts",\n  "version": "1.0.0",\n  "scripts": {\n    "build": "tsc",\n    "start": "node dist/index.js",\n    "dev": "ts-node src/index.ts",\n    "watch": "tsc --watch"\n  },\n  "dependencies": {},\n  "devDependencies": {\n    "typescript": "^5.3.0",\n    "ts-node": "^10.9.0",\n    "@types/node": "^20.0.0"\n  }\n}\n' },
      { name: ".gitignore", content: "node_modules/\ndist/\n.env\n*.log\n" },
    ],
  },
  python: {
    label: "Python",
    icon: "terminal",
    files: [
      { name: "main.py", content: `#!/usr/bin/env python3
"""API REST simples com Flask"""

from flask import Flask, jsonify, request, abort
from datetime import datetime
from typing import Optional
import os

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# "Banco" em memória
usuarios = []
proximo_id = 1

def gerar_id():
    global proximo_id
    id_atual = proximo_id
    proximo_id += 1
    return id_atual

def validar_email(email: str) -> bool:
    return '@' in email and '.' in email.split('@')[-1]

# Rotas
@app.route('/api/saude', methods=['GET'])
def saude():
    return jsonify({
        'status': 'ok',
        'versao': '1.0.0',
        'horario': datetime.now().isoformat()
    })

@app.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    papel = request.args.get('papel')
    resultado = [u for u in usuarios if not papel or u['papel'] == papel]
    return jsonify({'sucesso': True, 'dados': resultado, 'total': len(resultado)})

@app.route('/api/usuarios/<int:uid>', methods=['GET'])
def buscar_usuario(uid: int):
    usuario = next((u for u in usuarios if u['id'] == uid), None)
    if not usuario:
        abort(404, description='Usuário não encontrado')
    return jsonify({'sucesso': True, 'dados': usuario})

@app.route('/api/usuarios', methods=['POST'])
def criar_usuario():
    dados = request.get_json()
    if not dados or not dados.get('nome') or not dados.get('email'):
        abort(400, description='Nome e email são obrigatórios')
    if not validar_email(dados['email']):
        abort(400, description='Email inválido')
    usuario = {
        'id': gerar_id(),
        'nome': dados['nome'],
        'email': dados['email'],
        'papel': dados.get('papel', 'usuario'),
        'criado_em': datetime.now().isoformat(),
    }
    usuarios.append(usuario)
    return jsonify({'sucesso': True, 'dados': usuario}), 201

@app.route('/api/usuarios/<int:uid>', methods=['PUT'])
def atualizar_usuario(uid: int):
    usuario = next((u for u in usuarios if u['id'] == uid), None)
    if not usuario:
        abort(404, description='Usuário não encontrado')
    dados = request.get_json() or {}
    usuario.update({k: v for k, v in dados.items() if k in ['nome', 'email', 'papel']})
    return jsonify({'sucesso': True, 'dados': usuario})

@app.route('/api/usuarios/<int:uid>', methods=['DELETE'])
def remover_usuario(uid: int):
    global usuarios
    tam = len(usuarios)
    usuarios = [u for u in usuarios if u['id'] != uid]
    if len(usuarios) == tam:
        abort(404, description='Usuário não encontrado')
    return jsonify({'sucesso': True, 'mensagem': 'Usuário removido'})

@app.errorhandler(404)
def nao_encontrado(e):
    return jsonify({'sucesso': False, 'erro': str(e)}), 404

@app.errorhandler(400)
def requisicao_invalida(e):
    return jsonify({'sucesso': False, 'erro': str(e)}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    print(f'Servidor rodando em http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=debug)
` },
      { name: "requirements.txt", content: "flask==3.0.0\npython-dotenv==1.0.0\ngunicorn==21.2.0\n" },
      { name: ".env", content: "FLASK_ENV=development\nPORT=5000\nSECRET_KEY=troque-esta-chave\n" },
      { name: ".gitignore", content: "__pycache__/\n*.pyc\n*.pyo\n.env\nvenv/\n.venv/\n*.egg-info/\ndist/\nbuild/\n" },
      { name: "README.md", content: "# API Python Flask\n\n## Instalação\n```bash\npython -m venv venv\nsource venv/bin/activate  # Linux/Mac\nvenv\\Scripts\\activate     # Windows\npip install -r requirements.txt\n```\n\n## Executar\n```bash\npython main.py\n```\n\n## Endpoints\n- `GET /api/saude` — Status da API\n- `GET /api/usuarios` — Listar usuários\n- `POST /api/usuarios` — Criar usuário\n- `GET /api/usuarios/:id` — Buscar por ID\n- `PUT /api/usuarios/:id` — Atualizar\n- `DELETE /api/usuarios/:id` — Remover\n" },
    ],
  },
  html: {
    label: "HTML/CSS/JS",
    icon: "globe",
    files: [
      { name: "index.html", content: `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meu Site</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="header">
    <nav class="nav">
      <div class="logo">MeuSite</div>
      <ul class="nav-links">
        <li><a href="#inicio">Início</a></li>
        <li><a href="#sobre">Sobre</a></li>
        <li><a href="#contato">Contato</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section id="inicio" class="hero">
      <h1>Bem-vindo ao <span class="destaque">MeuSite</span></h1>
      <p>Uma solução moderna e responsiva para seu negócio.</p>
      <button class="btn-primary" onclick="scrollParaContato()">Fale Conosco</button>
    </section>

    <section id="sobre" class="sobre">
      <h2>Sobre Nós</h2>
      <div class="cards">
        <div class="card">
          <div class="card-icon">🚀</div>
          <h3>Rápido</h3>
          <p>Performance otimizada para melhor experiência.</p>
        </div>
        <div class="card">
          <div class="card-icon">🔒</div>
          <h3>Seguro</h3>
          <p>Dados protegidos com as melhores práticas.</p>
        </div>
        <div class="card">
          <div class="card-icon">📱</div>
          <h3>Responsivo</h3>
          <p>Funciona em qualquer dispositivo.</p>
        </div>
      </div>
    </section>

    <section id="contato" class="contato">
      <h2>Entre em Contato</h2>
      <form id="form-contato" onsubmit="enviarForm(event)">
        <div class="form-group">
          <label for="nome">Nome</label>
          <input type="text" id="nome" placeholder="Seu nome" required>
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" placeholder="seu@email.com" required>
        </div>
        <div class="form-group">
          <label for="mensagem">Mensagem</label>
          <textarea id="mensagem" rows="4" placeholder="Sua mensagem..." required></textarea>
        </div>
        <button type="submit" class="btn-primary">Enviar</button>
      </form>
      <div id="feedback" class="feedback hidden"></div>
    </section>
  </main>

  <footer class="footer">
    <p>&copy; 2024 MeuSite. Todos os direitos reservados.</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>
` },
      { name: "style.css", content: `* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --text: #1f2937;
  --text-muted: #6b7280;
  --bg: #ffffff;
  --bg-alt: #f9fafb;
  --border: #e5e7eb;
  --radius: 12px;
}

body { font-family: 'Segoe UI', sans-serif; color: var(--text); line-height: 1.6; }

.header { position: fixed; top: 0; width: 100%; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); z-index: 100; }
.nav { max-width: 1100px; margin: 0 auto; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
.logo { font-size: 1.3rem; font-weight: 700; color: var(--primary); }
.nav-links { list-style: none; display: flex; gap: 2rem; }
.nav-links a { text-decoration: none; color: var(--text-muted); font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: var(--primary); }

.hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 6rem 2rem 2rem; background: linear-gradient(135deg, #f0f0ff 0%, #fff 60%); }
.hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 1rem; }
.destaque { color: var(--primary); }
.hero p { font-size: 1.2rem; color: var(--text-muted); margin-bottom: 2rem; max-width: 500px; }

.btn-primary { background: var(--primary); color: #fff; border: none; padding: 0.9rem 2.2rem; border-radius: var(--radius); font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; }
.btn-primary:hover { background: var(--primary-dark); transform: translateY(-2px); }

.sobre { padding: 5rem 2rem; background: var(--bg-alt); }
.sobre h2, .contato h2 { text-align: center; font-size: 2rem; margin-bottom: 3rem; }
.cards { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
.card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; text-align: center; transition: transform 0.2s, box-shadow 0.2s; }
.card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
.card-icon { font-size: 2.5rem; margin-bottom: 1rem; }
.card h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.card p { color: var(--text-muted); font-size: 0.95rem; }

.contato { padding: 5rem 2rem; }
form { max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.2rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
label { font-weight: 600; font-size: 0.9rem; }
input, textarea { border: 1px solid var(--border); border-radius: 8px; padding: 0.8rem 1rem; font-size: 1rem; font-family: inherit; transition: border-color 0.2s; }
input:focus, textarea:focus { outline: none; border-color: var(--primary); }
textarea { resize: vertical; }

.feedback { max-width: 560px; margin: 1rem auto 0; padding: 1rem; border-radius: var(--radius); text-align: center; font-weight: 600; }
.feedback.sucesso { background: #d1fae5; color: #065f46; }
.feedback.erro { background: #fee2e2; color: #991b1b; }
.hidden { display: none; }

.footer { background: var(--text); color: #9ca3af; text-align: center; padding: 1.5rem; font-size: 0.9rem; }

@media (max-width: 640px) { .nav-links { display: none; } }
` },
      { name: "script.js", content: `// Smooth scroll para seções
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector(link.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
  });
});

function scrollParaContato() {
  document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
}

// Formulário de contato
function enviarForm(e) {
  e.preventDefault();
  const feedback = document.getElementById('feedback');
  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const mensagem = document.getElementById('mensagem').value;

  if (!nome || !email || !mensagem) {
    mostrarFeedback('Por favor, preencha todos os campos.', false);
    return;
  }

  // Simula envio
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  setTimeout(() => {
    mostrarFeedback(\`Mensagem enviada com sucesso, \${nome}! Entraremos em contato em breve.\`, true);
    e.target.reset();
    btn.textContent = 'Enviar';
    btn.disabled = false;
  }, 1500);
}

function mostrarFeedback(msg, sucesso) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = \`feedback \${sucesso ? 'sucesso' : 'erro'}\`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => { el.className = 'feedback hidden'; }, 5000);
}

// Animação de entrada ao rolar
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.style.opacity = '1';
  });
}, { threshold: 0.1 });

document.querySelectorAll('.card').forEach(el => {
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.5s ease';
  observer.observe(el);
});
` },
    ],
  },
  api_express: {
    label: "API Express",
    icon: "server",
    files: [
      { name: "server.js", content: `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições
app.use((req, res, next) => {
  console.log(\`[\${new Date().toLocaleTimeString('pt-BR')}] \${req.method} \${req.url}\`);
  next();
});

// Banco em memória
const db = {
  usuarios: [],
  nextId: 1,
};

// Helpers
function criarId() { return db.nextId++; }
function agora() { return new Date().toISOString(); }
function validar(obj, campos) {
  const faltando = campos.filter(c => !obj[c]);
  return faltando.length ? \`Campos obrigatórios: \${faltando.join(', ')}\` : null;
}

// === ROTAS ===

// Saúde
app.get('/api/saude', (req, res) => {
  res.json({ status: 'ok', versao: '1.0.0', timestamp: agora(), usuarios: db.usuarios.length });
});

// Listar usuários
app.get('/api/usuarios', (req, res) => {
  const { papel, busca } = req.query;
  let lista = [...db.usuarios];
  if (papel) lista = lista.filter(u => u.papel === papel);
  if (busca) lista = lista.filter(u =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );
  res.json({ sucesso: true, dados: lista, total: lista.length });
});

// Buscar por ID
app.get('/api/usuarios/:id', (req, res) => {
  const usuario = db.usuarios.find(u => u.id === +req.params.id);
  if (!usuario) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
  res.json({ sucesso: true, dados: usuario });
});

// Criar usuário
app.post('/api/usuarios', (req, res) => {
  const erro = validar(req.body, ['nome', 'email']);
  if (erro) return res.status(400).json({ sucesso: false, erro });
  if (!req.body.email.includes('@')) return res.status(400).json({ sucesso: false, erro: 'Email inválido' });
  const usuario = {
    id: criarId(),
    nome: req.body.nome,
    email: req.body.email.toLowerCase(),
    papel: req.body.papel || 'usuario',
    ativo: true,
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
  db.usuarios.push(usuario);
  res.status(201).json({ sucesso: true, dados: usuario });
});

// Atualizar
app.put('/api/usuarios/:id', (req, res) => {
  const idx = db.usuarios.findIndex(u => u.id === +req.params.id);
  if (idx === -1) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
  const campos = ['nome', 'email', 'papel', 'ativo'];
  campos.forEach(c => { if (req.body[c] !== undefined) db.usuarios[idx][c] = req.body[c]; });
  db.usuarios[idx].atualizadoEm = agora();
  res.json({ sucesso: true, dados: db.usuarios[idx] });
});

// Remover
app.delete('/api/usuarios/:id', (req, res) => {
  const idx = db.usuarios.findIndex(u => u.id === +req.params.id);
  if (idx === -1) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
  const removido = db.usuarios.splice(idx, 1)[0];
  res.json({ sucesso: true, mensagem: 'Usuário removido', dados: removido });
});

// 404
app.use((req, res) => {
  res.status(404).json({ sucesso: false, erro: \`Rota \${req.method} \${req.url} não encontrada\` });
});

// Iniciar
app.listen(PORT, () => {
  console.log(\`🚀 API rodando em http://localhost:\${PORT}\`);
  console.log(\`📋 Endpoints disponíveis:\`);
  console.log(\`   GET    /api/saude\`);
  console.log(\`   GET    /api/usuarios\`);
  console.log(\`   GET    /api/usuarios/:id\`);
  console.log(\`   POST   /api/usuarios\`);
  console.log(\`   PUT    /api/usuarios/:id\`);
  console.log(\`   DELETE /api/usuarios/:id\`);
});
` },
      { name: "package.json", content: '{\n  "name": "api-express",\n  "version": "1.0.0",\n  "description": "API REST com Node.js e Express",\n  "main": "server.js",\n  "scripts": {\n    "start": "node server.js",\n    "dev": "nodemon server.js"\n  },\n  "dependencies": {\n    "cors": "^2.8.5",\n    "dotenv": "^16.0.0",\n    "express": "^4.18.0"\n  },\n  "devDependencies": {\n    "nodemon": "^3.0.0"\n  }\n}\n' },
      { name: ".env", content: "PORT=3000\nNODE_ENV=development\nJWT_SECRET=troque-esta-chave-secreta\n" },
      { name: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
    ],
  },
  neon: {
    label: "Neon DB",
    icon: "database",
    files: [
      { name: "index.js", content: `const express = require('express');
const { neon } = require('@neondatabase/serverless');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão com Neon
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());

// Inicializar tabelas
async function inicializarBanco() {
  await sql\`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      email VARCHAR(200) UNIQUE NOT NULL,
      papel VARCHAR(50) DEFAULT 'usuario',
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  \`;
  await sql\`
    CREATE TABLE IF NOT EXISTS registros (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      titulo VARCHAR(300) NOT NULL,
      conteudo TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  \`;
  console.log('✅ Banco inicializado com sucesso');
}

// === ROTAS ===

app.get('/api/saude', async (req, res) => {
  try {
    const r = await sql\`SELECT NOW() as agora, version() as versao_pg\`;
    res.json({ status: 'ok', banco: 'Neon PostgreSQL', ...r[0] });
  } catch (e) {
    res.status(500).json({ status: 'erro', detalhe: e.message });
  }
});

// Listar usuários
app.get('/api/usuarios', async (req, res) => {
  try {
    const { papel, busca, pagina = 1, limite = 20 } = req.query;
    const offset = (pagina - 1) * limite;
    let usuarios;
    if (busca) {
      usuarios = await sql\`
        SELECT * FROM usuarios
        WHERE (nome ILIKE ${'$'}{('%' + busca + '%')} OR email ILIKE ${'$'}{('%' + busca + '%')})
        AND (${'$'}{papel} IS NULL OR papel = ${'$'}{papel})
        ORDER BY criado_em DESC LIMIT ${'$'}{limite} OFFSET ${'$'}{offset}
      \`;
    } else {
      usuarios = await sql\`
        SELECT * FROM usuarios
        WHERE (${'$'}{papel || null} IS NULL OR papel = ${'$'}{papel || null})
        ORDER BY criado_em DESC LIMIT ${'$'}{limite} OFFSET ${'$'}{offset}
      \`;
    }
    const [{ total }] = await sql\`SELECT COUNT(*) as total FROM usuarios\`;
    res.json({ sucesso: true, dados: usuarios, total: +total, pagina: +pagina });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// Buscar por ID
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const [usuario] = await sql\`SELECT * FROM usuarios WHERE id = ${'$'}{req.params.id}\`;
    if (!usuario) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
    const registros = await sql\`SELECT * FROM registros WHERE usuario_id = ${'$'}{req.params.id} ORDER BY criado_em DESC\`;
    res.json({ sucesso: true, dados: { ...usuario, registros } });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// Criar usuário
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nome, email, papel = 'usuario' } = req.body;
    if (!nome || !email) return res.status(400).json({ sucesso: false, erro: 'Nome e email obrigatórios' });
    const [usuario] = await sql\`
      INSERT INTO usuarios (nome, email, papel)
      VALUES (${'$'}{nome}, ${'$'}{email.toLowerCase()}, ${'$'}{papel})
      RETURNING *
    \`;
    res.status(201).json({ sucesso: true, dados: usuario });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Email já cadastrado' });
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// Atualizar
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { nome, email, papel, ativo } = req.body;
    const [usuario] = await sql\`
      UPDATE usuarios SET
        nome = COALESCE(${'$'}{nome}, nome),
        email = COALESCE(${'$'}{email}, email),
        papel = COALESCE(${'$'}{papel}, papel),
        ativo = COALESCE(${'$'}{ativo}, ativo),
        atualizado_em = NOW()
      WHERE id = ${'$'}{req.params.id}
      RETURNING *
    \`;
    if (!usuario) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
    res.json({ sucesso: true, dados: usuario });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// Remover
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const [removido] = await sql\`DELETE FROM usuarios WHERE id = ${'$'}{req.params.id} RETURNING *\`;
    if (!removido) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
    res.json({ sucesso: true, mensagem: 'Removido com sucesso', dados: removido });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// Iniciar
inicializarBanco().then(() => {
  app.listen(PORT, () => {
    console.log(\`🚀 API + Neon DB rodando em http://localhost:\${PORT}\`);
  });
}).catch(e => {
  console.error('❌ Erro ao conectar ao banco:', e.message);
  console.error('Verifique a variável DATABASE_URL no .env');
});
` },
      { name: "package.json", content: '{\n  "name": "api-neon-db",\n  "version": "1.0.0",\n  "description": "API REST com Node.js, Express e Neon PostgreSQL",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js",\n    "dev": "nodemon index.js"\n  },\n  "dependencies": {\n    "@neondatabase/serverless": "^0.9.0",\n    "cors": "^2.8.5",\n    "dotenv": "^16.0.0",\n    "express": "^4.18.0"\n  },\n  "devDependencies": {\n    "nodemon": "^3.0.0"\n  }\n}\n' },
      { name: ".env", content: "# Cole sua connection string do Neon aqui:\n# Acesse: console.neon.tech → seu projeto → Connection string\nDATABASE_URL=postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require\n\nPORT=3000\nNODE_ENV=development\n" },
      { name: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { name: "README.md", content: "# API com Neon DB (PostgreSQL)\n\n## Configuração do Neon\n\n1. Acesse [console.neon.tech](https://console.neon.tech)\n2. Crie um projeto\n3. Copie a **Connection string**\n4. Cole no arquivo `.env` em `DATABASE_URL=...`\n\n## Instalação\n```bash\nnpm install\n```\n\n## Executar\n```bash\nnpm run dev\n```\n\n## Endpoints\n| Método | Rota | Descrição |\n|--------|------|-----------|\n| GET | /api/saude | Status + versão do banco |\n| GET | /api/usuarios | Listar (suporte a busca e paginação) |\n| GET | /api/usuarios/:id | Buscar com registros |\n| POST | /api/usuarios | Criar usuário |\n| PUT | /api/usuarios/:id | Atualizar |\n| DELETE | /api/usuarios/:id | Remover |\n\n## Testar\n```bash\n# Criar usuário\ncurl -X POST http://localhost:3000/api/usuarios \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"nome\":\"João\",\"email\":\"joao@email.com\"}'\n\n# Listar\ncurl http://localhost:3000/api/usuarios\n```\n" },
    ],
  },
  react: {
    label: "React + Vite",
    icon: "zap",
    files: [
      { name: "index.html", content: '<!DOCTYPE html>\n<html lang="pt-br">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>React App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.jsx"></script>\n</body>\n</html>\n' },
      { name: "src/main.jsx", content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode><App /></React.StrictMode>\n);\n" },
      { name: "src/App.jsx", content: `import React, { useState, useEffect, useCallback } from 'react';

// Hook customizado para dados
function useLocalStorage(chave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try { return JSON.parse(localStorage.getItem(chave)) ?? valorInicial; }
    catch { return valorInicial; }
  });
  const salvar = useCallback(novoValor => {
    setValor(novoValor);
    localStorage.setItem(chave, JSON.stringify(novoValor));
  }, [chave]);
  return [valor, salvar];
}

// Componente de tarefa
function CartaoTarefa({ tarefa, onConcluir, onRemover }) {
  return (
    <div className={\`card \${tarefa.concluida ? 'concluida' : ''}\`}>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={tarefa.concluida}
          onChange={() => onConcluir(tarefa.id)}
        />
        <span className="texto">{tarefa.texto}</span>
      </label>
      <div className="card-footer">
        <span className="data">{new Date(tarefa.criadaEm).toLocaleDateString('pt-BR')}</span>
        <button onClick={() => onRemover(tarefa.id)} className="btn-remover">✕</button>
      </div>
    </div>
  );
}

// App principal
export default function App() {
  const [tarefas, setTarefas] = useLocalStorage('tarefas', []);
  const [input, setInput] = useState('');
  const [filtro, setFiltro] = useState('todas');

  const adicionar = () => {
    if (!input.trim()) return;
    setTarefas([...tarefas, {
      id: Date.now(),
      texto: input.trim(),
      concluida: false,
      criadaEm: new Date().toISOString(),
    }]);
    setInput('');
  };

  const concluir = id => setTarefas(tarefas.map(t => t.id === id ? { ...t, concluida: !t.concluida } : t));
  const remover = id => setTarefas(tarefas.filter(t => t.id !== id));
  const limparConcluidas = () => setTarefas(tarefas.filter(t => !t.concluida));

  const tarefasFiltradas = tarefas.filter(t =>
    filtro === 'todas' ? true : filtro === 'ativas' ? !t.concluida : t.concluida
  );
  const pendentes = tarefas.filter(t => !t.concluida).length;

  return (
    <div className="app">
      <header>
        <h1>📋 Minhas Tarefas</h1>
        <p>{pendentes} pendente{pendentes !== 1 ? 's' : ''} de {tarefas.length}</p>
      </header>

      <div className="input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adicionar()}
          placeholder="Nova tarefa..."
          autoFocus
        />
        <button onClick={adicionar} disabled={!input.trim()}>Adicionar</button>
      </div>

      <div className="filtros">
        {['todas', 'ativas', 'concluídas'].map(f => (
          <button key={f} onClick={() => setFiltro(f === 'concluídas' ? 'concluidas' : f)}
            className={filtro === (f === 'concluídas' ? 'concluidas' : f) ? 'ativo' : ''}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="lista">
        {tarefasFiltradas.length === 0
          ? <p className="vazio">Nenhuma tarefa aqui.</p>
          : tarefasFiltradas.map(t => (
              <CartaoTarefa key={t.id} tarefa={t} onConcluir={concluir} onRemover={remover} />
            ))
        }
      </div>

      {tarefas.some(t => t.concluida) && (
        <button onClick={limparConcluidas} className="btn-limpar">
          Limpar concluídas ({tarefas.filter(t => t.concluida).length})
        </button>
      )}
    </div>
  );
}
` },
      { name: "src/index.css", content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #f3f4f6; color: #1f2937; min-height: 100vh; }
.app { max-width: 600px; margin: 0 auto; padding: 2rem 1rem; }
header { text-align: center; margin-bottom: 2rem; }
header h1 { font-size: 2rem; margin-bottom: 0.3rem; }
header p { color: #6b7280; }
.input-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.input-row input { flex: 1; padding: 0.8rem 1rem; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: border-color 0.2s; }
.input-row input:focus { outline: none; border-color: #6366f1; }
.input-row button { padding: 0.8rem 1.5rem; background: #6366f1; color: #fff; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
.input-row button:hover:not(:disabled) { background: #4f46e5; }
.input-row button:disabled { opacity: 0.5; cursor: not-allowed; }
.filtros { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.filtros button { flex: 1; padding: 0.5rem; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; }
.filtros button.ativo { background: #6366f1; color: #fff; border-color: #6366f1; }
.lista { display: flex; flex-direction: column; gap: 0.7rem; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; transition: all 0.2s; }
.card.concluida { opacity: 0.6; }
.checkbox-label { display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; }
.checkbox-label input[type="checkbox"] { width: 18px; height: 18px; margin-top: 2px; accent-color: #6366f1; flex-shrink: 0; }
.texto { font-size: 1rem; line-height: 1.4; }
.concluida .texto { text-decoration: line-through; color: #9ca3af; }
.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f3f4f6; }
.data { font-size: 0.8rem; color: #9ca3af; }
.btn-remover { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 2px 6px; border-radius: 4px; }
.btn-remover:hover { background: #fee2e2; }
.vazio { text-align: center; color: #9ca3af; padding: 2rem; }
.btn-limpar { width: 100%; margin-top: 1rem; padding: 0.7rem; background: none; border: 1px solid #e5e7eb; border-radius: 8px; color: #6b7280; cursor: pointer; transition: all 0.2s; }
.btn-limpar:hover { background: #fee2e2; color: #ef4444; border-color: #ef4444; }
` },
      { name: "package.json", content: '{\n  "name": "react-vite-app",\n  "version": "0.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.3.0",\n    "react-dom": "^18.3.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.2.0",\n    "vite": "^5.0.0"\n  }\n}\n' },
      { name: "vite.config.js", content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n" },
    ],
  },
  flask_api: {
    label: "Flask API",
    icon: "activity",
    files: [
      { name: "app.py", content: `from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)

# ---- Banco de dados em memória (substitua por PostgreSQL/SQLite) ----
db = []
next_id = [1]

@app.route("/api/saude", methods=["GET"])
def saude():
    return jsonify({"status": "ok", "versao": "1.0.0"})

@app.route("/api/itens", methods=["GET"])
def listar():
    return jsonify(db)

@app.route("/api/itens", methods=["POST"])
def criar():
    dados = request.get_json()
    if not dados or "nome" not in dados:
        return jsonify({"erro": "Campo 'nome' obrigatório"}), 400
    item = {"id": next_id[0], **dados}
    next_id[0] += 1
    db.append(item)
    return jsonify(item), 201

@app.route("/api/itens/<int:item_id>", methods=["GET"])
def buscar(item_id):
    item = next((i for i in db if i["id"] == item_id), None)
    return jsonify(item) if item else (jsonify({"erro": "Não encontrado"}), 404)

@app.route("/api/itens/<int:item_id>", methods=["PUT"])
def atualizar(item_id):
    item = next((i for i in db if i["id"] == item_id), None)
    if not item:
        return jsonify({"erro": "Não encontrado"}), 404
    item.update(request.get_json())
    return jsonify(item)

@app.route("/api/itens/<int:item_id>", methods=["DELETE"])
def remover(item_id):
    global db
    db = [i for i in db if i["id"] != item_id]
    return jsonify({"ok": True})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
` },
      { name: "requirements.txt", content: "flask==3.0.0\nflask-cors==4.0.0\npython-dotenv==1.0.0\ngunicorn==21.2.0\n" },
      { name: ".env", content: "PORT=5000\nFLASK_ENV=development\nDATABASE_URL=postgresql://usuario:senha@host/banco\n" },
      { name: "README.md", content: "# API Flask\n\n## Instalar\n```bash\npip install -r requirements.txt\n```\n\n## Rodar\n```bash\npython app.py\n```\n\n## Endpoints\n- `GET /api/saude` — Status\n- `GET /api/itens` — Listar\n- `POST /api/itens` — Criar\n- `PUT /api/itens/:id` — Atualizar\n- `DELETE /api/itens/:id` — Remover\n" },
    ],
  },
  fastapi: {
    label: "FastAPI",
    icon: "zap",
    files: [
      { name: "main.py", content: `from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os

app = FastAPI(title="Minha API FastAPI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Modelos ----
class Item(BaseModel):
    nome: str
    descricao: Optional[str] = None
    preco: float = 0.0

class ItemResposta(Item):
    id: int

# ---- Banco em memória ----
db: List[ItemResposta] = []
contador = 0

@app.get("/")
def raiz():
    return {"mensagem": "API FastAPI rodando!", "docs": "/docs"}

@app.get("/api/itens", response_model=List[ItemResposta])
def listar_itens():
    return db

@app.post("/api/itens", response_model=ItemResposta, status_code=201)
def criar_item(item: Item):
    global contador
    contador += 1
    novo = ItemResposta(id=contador, **item.dict())
    db.append(novo)
    return novo

@app.get("/api/itens/{item_id}", response_model=ItemResposta)
def buscar_item(item_id: int):
    for item in db:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item não encontrado")

@app.delete("/api/itens/{item_id}")
def remover_item(item_id: int):
    global db
    db = [i for i in db if i.id != item_id]
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
` },
      { name: "requirements.txt", content: "fastapi==0.110.0\nuvicorn[standard]==0.27.0\npython-dotenv==1.0.0\npydantic==2.6.0\n" },
      { name: ".env", content: "PORT=8000\nDATABASE_URL=postgresql://usuario:senha@host/banco\n" },
      { name: "README.md", content: "# API FastAPI\n\n## Instalar\n```bash\npip install -r requirements.txt\n```\n\n## Rodar\n```bash\nuvicorn main:app --reload\n```\n\nDocumentação automática: `http://localhost:8000/docs`\n" },
    ],
  },
  telegram_bot: {
    label: "Bot Telegram",
    icon: "send",
    files: [
      { name: "bot.py", content: `import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# ---- Handlers ----
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        f"Olá, {update.effective_user.first_name}! 👋\\n\\n"
        "Eu sou seu bot assistente.\\n"
        "/ajuda — ver todos os comandos"
    )

async def ajuda(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📋 Comandos disponíveis:\\n"
        "/start — Iniciar\\n"
        "/ajuda — Esta mensagem\\n"
        "/info — Informações do chat"
    )

async def info(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    await update.message.reply_text(
        f"ℹ️ Info do chat:\\n"
        f"ID: {chat.id}\\n"
        f"Tipo: {chat.type}\\n"
        f"Título: {chat.title or 'N/A'}"
    )

async def mensagem(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    texto = update.message.text
    await update.message.reply_text(f"Você disse: {texto}\\n\\nUse /ajuda para ver comandos.")

def main():
    if not TOKEN:
        raise ValueError("Configure TELEGRAM_BOT_TOKEN no arquivo .env")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("ajuda", ajuda))
    app.add_handler(CommandHandler("info", info))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, mensagem))
    print("🤖 Bot iniciado! Pressione Ctrl+C para parar.")
    app.run_polling()

if __name__ == "__main__":
    main()
` },
      { name: "requirements.txt", content: "python-telegram-bot==20.8\npython-dotenv==1.0.0\n" },
      { name: ".env", content: "# Obtenha o token com @BotFather no Telegram\nTELEGRAM_BOT_TOKEN=seu-token-aqui\n" },
      { name: "README.md", content: "# Bot Telegram em Python\n\n## Configuração\n1. Crie um bot com @BotFather no Telegram\n2. Copie o token para o `.env`\n\n## Instalar\n```bash\npip install -r requirements.txt\n```\n\n## Rodar\n```bash\npython bot.py\n```\n" },
    ],
  },
  landing_page: {
    label: "Landing Page",
    icon: "layout",
    files: [
      { name: "index.html", content: `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minha Landing Page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --primario: #7c3aed; --texto: #1f2937; --fundo: #f9fafb; }
    body { font-family: 'Segoe UI', sans-serif; color: var(--texto); background: var(--fundo); }
    nav { background: #fff; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 10; }
    .logo { font-size: 1.4rem; font-weight: 800; color: var(--primario); }
    nav ul { list-style: none; display: flex; gap: 2rem; }
    nav a { text-decoration: none; color: var(--texto); font-weight: 500; }
    .hero { min-height: 90vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 4rem 2rem; background: linear-gradient(135deg, #ede9fe 0%, #f0fdf4 100%); }
    .hero h1 { font-size: clamp(2rem, 6vw, 4rem); font-weight: 900; color: var(--primario); margin-bottom: 1.5rem; line-height: 1.1; }
    .hero p { font-size: 1.2rem; color: #6b7280; max-width: 600px; margin: 0 auto 2.5rem; }
    .btn { display: inline-block; padding: 1rem 2.5rem; background: var(--primario); color: #fff; border-radius: 50px; font-weight: 700; font-size: 1.1rem; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; }
    .btn:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(124,58,237,0.4); }
    .features { padding: 5rem 2rem; max-width: 1100px; margin: 0 auto; }
    .features h2 { text-align: center; font-size: 2rem; font-weight: 800; margin-bottom: 3rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
    .card { background: #fff; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .card h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
    .card p { color: #6b7280; line-height: 1.6; }
    footer { background: #111827; color: #9ca3af; text-align: center; padding: 2rem; }
    footer a { color: var(--primario); text-decoration: none; }
  </style>
</head>
<body>
  <nav>
    <div class="logo">MeuProduto</div>
    <ul>
      <li><a href="#features">Recursos</a></li>
      <li><a href="#contato">Contato</a></li>
    </ul>
  </nav>
  <section class="hero">
    <div>
      <h1>A solução que você<br>sempre quis</h1>
      <p>Simplifique sua vida com nossa plataforma poderosa. Rápido, seguro e intuitivo.</p>
      <a href="#features" class="btn">Começar grátis →</a>
    </div>
  </section>
  <section class="features" id="features">
    <h2>Por que nos escolher?</h2>
    <div class="grid">
      <div class="card"><div class="icon">⚡</div><h3>Ultra Rápido</h3><p>Performance de ponta para você não perder tempo.</p></div>
      <div class="card"><div class="icon">🔒</div><h3>Seguro</h3><p>Seus dados protegidos com criptografia de nível militar.</p></div>
      <div class="card"><div class="icon">📱</div><h3>Responsivo</h3><p>Funciona perfeitamente em qualquer dispositivo.</p></div>
    </div>
  </section>
  <footer id="contato"><p>© 2025 MeuProduto. Feito com ❤️ no Brasil.</p></footer>
</body>
</html>
` },
    ],
  },
  cli_node: {
    label: "CLI Node.js",
    icon: "terminal",
    files: [
      { name: "cli.js", content: `#!/usr/bin/env node
'use strict';
const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const pkg = require('./package.json');

const program = new Command();

program
  .name('minha-cli')
  .description('Ferramenta de linha de comando em Node.js')
  .version(pkg.version);

// Comando: saudar
program
  .command('ola <nome>')
  .description('Sauda alguém pelo nome')
  .option('-m, --maiusculo', 'Exibe em maiúsculas')
  .action((nome, opts) => {
    const msg = opts.maiusculo ? nome.toUpperCase() : nome;
    console.log(chalk.green(\`Olá, \${msg}! 👋\`));
  });

// Comando: listar
program
  .command('listar')
  .description('Lista itens de exemplo')
  .option('-j, --json', 'Saída em JSON')
  .action(async (opts) => {
    const spinner = ora('Carregando...').start();
    await new Promise(r => setTimeout(r, 800));
    spinner.succeed('Feito!');
    const itens = [
      { id: 1, nome: 'Item A', status: 'ativo' },
      { id: 2, nome: 'Item B', status: 'inativo' },
      { id: 3, nome: 'Item C', status: 'ativo' },
    ];
    if (opts.json) {
      console.log(JSON.stringify(itens, null, 2));
    } else {
      itens.forEach(i =>
        console.log(\`  \${chalk.cyan(i.id)} \${chalk.bold(i.nome)} — \${i.status === 'ativo' ? chalk.green(i.status) : chalk.red(i.status)}\`)
      );
    }
  });

// Comando: info
program
  .command('info')
  .description('Mostra informações do sistema')
  .action(() => {
    console.log(chalk.bold('\\n📋 Informações do Sistema'));
    console.log(\`  Node.js : \${chalk.cyan(process.version)}\`);
    console.log(\`  Plataforma: \${chalk.cyan(process.platform)}\`);
    console.log(\`  Diretório : \${chalk.cyan(process.cwd())}\\n\`);
  });

program.parse(process.argv);
` },
      { name: "package.json", content: '{\n  "name": "minha-cli",\n  "version": "1.0.0",\n  "description": "CLI em Node.js",\n  "bin": { "minha-cli": "./cli.js" },\n  "scripts": { "start": "node cli.js", "dev": "node cli.js --help" },\n  "dependencies": { "commander": "^12.0.0", "chalk": "^4.1.2", "ora": "^5.4.1" }\n}\n' },
      { name: "README.md", content: "# CLI Node.js\n\n## Instalar dependências\n```bash\nnpm install\n```\n\n## Usar\n```bash\nnode cli.js ola Mundo\nnode cli.js listar\nnode cli.js listar --json\nnode cli.js info\n```\n" },
    ],
  },
  discord_bot: {
    label: "Bot Discord",
    icon: "message-circle",
    files: [
      { name: "bot.js", content: `const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ---- Slash Commands ----
const comandos = [
  new SlashCommandBuilder().setName('ping').setDescription('Verifica latência do bot'),
  new SlashCommandBuilder().setName('ola').setDescription('Sauda o usuário'),
  new SlashCommandBuilder().setName('info').setDescription('Info do servidor'),
].map(c => c.toJSON());

// Registrar comandos ao iniciar
client.once('ready', async () => {
  console.log(\`✅ Bot online: \${client.user.tag}\`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: comandos });
    console.log('📋 Slash commands registrados!');
  } catch (e) { console.error(e); }
});

// Handler de interações
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: \`🏓 Pong! Latência: \${client.ws.ping}ms\`, ephemeral: true });
  }
  if (interaction.commandName === 'ola') {
    const embed = new EmbedBuilder()
      .setColor('#7c3aed')
      .setTitle(\`Olá, \${interaction.user.displayName}! 👋\`)
      .setDescription('Bem-vindo ao servidor!')
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
  if (interaction.commandName === 'info') {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle(guild.name)
      .addFields(
        { name: 'Membros', value: String(guild.memberCount), inline: true },
        { name: 'Criado em', value: guild.createdAt.toLocaleDateString('pt-BR'), inline: true },
      );
    await interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
` },
      { name: "package.json", content: '{\n  "name": "discord-bot",\n  "version": "1.0.0",\n  "main": "bot.js",\n  "scripts": { "start": "node bot.js", "dev": "nodemon bot.js" },\n  "dependencies": { "discord.js": "^14.14.0", "dotenv": "^16.0.0" },\n  "devDependencies": { "nodemon": "^3.0.0" }\n}\n' },
      { name: ".env", content: "# Obtenha em discord.com/developers/applications\nDISCORD_TOKEN=seu-token-aqui\n" },
      { name: "README.md", content: "# Bot Discord em Node.js\n\n## Configuração\n1. Crie um app em discord.com/developers/applications\n2. Copie o token para o `.env`\n\n## Instalar\n```bash\nnpm install\n```\n\n## Rodar\n```bash\nnode bot.js\n```\n" },
    ],
  },
  vue_cdn: {
    label: "Vue.js CDN",
    icon: "triangle",
    files: [
      { name: "index.html", content: `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Vue.js</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f1f5f9; min-height: 100vh; padding: 2rem; }
    #app { max-width: 700px; margin: 0 auto; }
    h1 { color: #42b883; font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitulo { color: #6b7280; margin-bottom: 2rem; }
    .input-row { display: flex; gap: 10px; margin-bottom: 1.5rem; }
    input { flex: 1; padding: 0.75rem 1rem; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 1rem; outline: none; transition: border 0.2s; }
    input:focus { border-color: #42b883; }
    button { padding: 0.75rem 1.5rem; background: #42b883; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1rem; }
    button:hover { background: #35a46e; }
    .lista { display: flex; flex-direction: column; gap: 10px; }
    .item { background: #fff; border-radius: 12px; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .check { width: 22px; height: 22px; accent-color: #42b883; cursor: pointer; }
    .texto { flex: 1; font-size: 1rem; }
    .texto.feito { text-decoration: line-through; color: #9ca3af; }
    .del { background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1.2rem; padding: 0; }
    .contagem { text-align: center; color: #6b7280; margin-top: 1.5rem; font-size: 0.9rem; }
  </style>
</head>
<body>
<div id="app">
  <h1>✅ Lista de Tarefas</h1>
  <p class="subtitulo">Feito com Vue.js 3 (CDN)</p>
  <div class="input-row">
    <input v-model="nova" @keyup.enter="adicionar" placeholder="Nova tarefa..." />
    <button @click="adicionar">Adicionar</button>
  </div>
  <div class="lista">
    <div class="item" v-for="(t, i) in tarefas" :key="t.id">
      <input type="checkbox" class="check" v-model="t.feita" />
      <span class="texto" :class="{ feito: t.feita }">{{ t.texto }}</span>
      <button class="del" @click="remover(i)">🗑</button>
    </div>
    <p v-if="tarefas.length === 0" style="text-align:center;color:#9ca3af;padding:2rem;">Nenhuma tarefa. Adicione uma acima!</p>
  </div>
  <p class="contagem" v-if="tarefas.length > 0">{{ pendentes }} de {{ tarefas.length }} tarefas pendentes</p>
</div>
<script>
const { createApp } = Vue;
createApp({
  data() {
    return { nova: '', tarefas: [{ id: 1, texto: 'Aprender Vue.js 3', feita: false }, { id: 2, texto: 'Criar meu app', feita: false }] };
  },
  computed: { pendentes() { return this.tarefas.filter(t => !t.feita).length; } },
  methods: {
    adicionar() {
      const texto = this.nova.trim();
      if (!texto) return;
      this.tarefas.push({ id: Date.now(), texto, feita: false });
      this.nova = '';
    },
    remover(i) { this.tarefas.splice(i, 1); },
  }
}).mount('#app');
<\/script>
</body>
</html>
` },
    ],
  },
  shell: {
    label: "Shell Script",
    icon: "terminal",
    files: [
      { name: "script.sh", content: `#!/bin/bash
# Script de automação em Bash
set -euo pipefail

# Cores para output
VERDE='\\033[0;32m'
AMARELO='\\033[1;33m'
VERMELHO='\\033[0;31m'
SEM_COR='\\033[0m'

log() { echo -e "\${VERDE}[OK]\${SEM_COR} $1"; }
aviso() { echo -e "\${AMARELO}[AVISO]\${SEM_COR} $1"; }
erro() { echo -e "\${VERMELHO}[ERRO]\${SEM_COR} $1"; exit 1; }

# Verifica dependências
checar_deps() {
  local deps=("git" "node" "npm")
  for dep in "\${deps[@]}"; do
    command -v "$dep" &>/dev/null || erro "Dependência não encontrada: $dep"
    log "$dep: OK"
  done
}

# Backup de arquivos
fazer_backup() {
  local src="$1"
  local dest="backup_\$(date +%Y%m%d_%H%M%S)"
  [ -d "$src" ] || erro "Diretório não encontrado: $src"
  cp -r "$src" "$dest"
  log "Backup criado em: $dest"
}

# Menu interativo
menu() {
  echo "============================"
  echo " Menu Principal"
  echo "============================"
  echo "1) Verificar dependências"
  echo "2) Fazer backup"
  echo "3) Listar arquivos"
  echo "0) Sair"
  read -rp "Escolha: " opcao
  case $opcao in
    1) checar_deps ;;
    2) read -rp "Diretório para backup: " dir; fazer_backup "$dir" ;;
    3) ls -la ;;
    0) log "Saindo..."; exit 0 ;;
    *) aviso "Opção inválida" ;;
  esac
}

main() {
  log "Iniciando script..."
  while true; do menu; done
}

main "$@"
` },
      { name: "README.md", content: "# Shell Script\n\n## Executar\n```bash\nchmod +x script.sh\n./script.sh\n```\n" },
    ],
  },
  react_native: {
    label: "React Native",
    icon: "smartphone",
    files: [
      { name: "App.tsx", content: `import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, TextInput, Alert, StatusBar,
} from 'react-native';

interface Item {
  id: string;
  texto: string;
  feito: boolean;
}

export default function App() {
  const [itens, setItens] = useState<Item[]>([]);
  const [texto, setTexto] = useState('');

  const adicionar = () => {
    const t = texto.trim();
    if (!t) return;
    setItens(prev => [...prev, { id: Date.now().toString(), texto: t, feito: false }]);
    setTexto('');
  };

  const alternar = (id: string) =>
    setItens(prev => prev.map(i => i.id === id ? { ...i, feito: !i.feito } : i));

  const remover = (id: string) =>
    Alert.alert('Remover', 'Tem certeza?', [
      { text: 'Cancelar' },
      { text: 'Remover', style: 'destructive', onPress: () => setItens(prev => prev.filter(i => i.id !== id)) },
    ]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <Text style={styles.titulo}>📝 Lista de Tarefas</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Nova tarefa..."
          placeholderTextColor="#888"
          onSubmitEditing={adicionar}
        />
        <TouchableOpacity style={styles.btnAdd} onPress={adicionar}>
          <Text style={styles.btnAddTxt}>+</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={itens}
        keyExtractor={i => i.id}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma tarefa ainda!</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => alternar(item.id)} onLongPress={() => remover(item.id)}>
            <Text style={[styles.itemTxt, item.feito && styles.feito]}>{item.feito ? '✅' : '⬜'} {item.texto}</Text>
          </TouchableOpacity>
        )}
      />
      <Text style={styles.rodape}>Segure para remover • Toque para marcar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', paddingTop: 60, paddingHorizontal: 20 },
  titulo: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 24, textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#16213e', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: '#0f3460' },
  btnAdd: { backgroundColor: '#6366f1', width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnAddTxt: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  item: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#0f3460' },
  itemTxt: { color: '#e2e8f0', fontSize: 16 },
  feito: { textDecorationLine: 'line-through', color: '#64748b' },
  vazio: { color: '#64748b', textAlign: 'center', marginTop: 60, fontSize: 16 },
  rodape: { color: '#475569', textAlign: 'center', fontSize: 12, paddingVertical: 16 },
});
` },
      { name: "package.json", content: '{\n  "name": "meu-app-rn",\n  "version": "1.0.0",\n  "main": "node_modules/expo/AppEntry.js",\n  "scripts": {\n    "start": "expo start",\n    "android": "expo run:android",\n    "ios": "expo run:ios"\n  },\n  "dependencies": {\n    "expo": "~54.0.0",\n    "react": "18.3.2",\n    "react-native": "0.76.7"\n  }\n}\n' },
      { name: "app.json", content: '{\n  "expo": {\n    "name": "MeuApp",\n    "slug": "meu-app",\n    "version": "1.0.0",\n    "orientation": "portrait",\n    "userInterfaceStyle": "dark"\n  }\n}\n' },
    ],
  },
  pwa: {
    label: "PWA",
    icon: "globe",
    files: [
      { name: "index.html", content: `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, standalone">
  <meta name="theme-color" content="#6366f1">
  <meta name="description" content="Meu Progressive Web App">
  <link rel="manifest" href="manifest.json">
  <title>Meu PWA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 20px; padding: 40px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
    h1 { font-size: 2rem; margin-bottom: 10px; }
    p { color: #94a3b8; margin-bottom: 30px; }
    .status { background: #0f172a; border-radius: 12px; padding: 15px; margin-bottom: 20px; font-size: 0.9rem; color: #64748b; }
    .btn { background: #6366f1; color: #fff; border: none; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; }
    .btn:hover { background: #4f46e5; }
    .offline { display: none; background: #dc2626; color: #fff; padding: 10px; border-radius: 8px; margin-top: 15px; font-size: 0.9rem; }
    .online { display: none; background: #16a34a; color: #fff; padding: 10px; border-radius: 8px; margin-top: 15px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Meu PWA</h1>
    <p>Progressive Web App instalável</p>
    <div class="status" id="status">Verificando conexão...</div>
    <button class="btn" onclick="instalar()">📲 Instalar App</button>
    <div class="offline" id="offline">⚠️ Sem conexão — modo offline</div>
    <div class="online" id="online">✅ Conectado!</div>
  </div>
  <script>
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
    });
    async function instalar() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('status').textContent = outcome === 'accepted' ? 'App instalado!' : 'Instalação cancelada';
      } else {
        alert('Para instalar: menu do navegador → "Adicionar à tela inicial"');
      }
    }
    function atualizarStatus() {
      const online = navigator.onLine;
      document.getElementById('status').textContent = online ? '🟢 Online' : '🔴 Offline';
      document.getElementById('offline').style.display = online ? 'none' : 'block';
      document.getElementById('online').style.display = online ? 'block' : 'none';
    }
    window.addEventListener('online', atualizarStatus);
    window.addEventListener('offline', atualizarStatus);
    atualizarStatus();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => console.log('SW registrado'));
    }
  </script>
</body>
</html>
` },
      { name: "manifest.json", content: '{\n  "name": "Meu PWA",\n  "short_name": "MeuPWA",\n  "description": "Progressive Web App",\n  "start_url": "/",\n  "display": "standalone",\n  "background_color": "#0f172a",\n  "theme_color": "#6366f1",\n  "orientation": "portrait",\n  "icons": [\n    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },\n    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }\n  ]\n}\n' },
      { name: "sw.js", content: `const CACHE = 'meu-pwa-v1';
const ARQUIVOS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
` },
    ],
  },
  sql: {
    label: "SQL / Banco",
    icon: "database",
    files: [
      { name: "schema.sql", content: `-- Schema do banco de dados
-- Compatível com PostgreSQL, MySQL e SQLite

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  papel      VARCHAR(20)  NOT NULL DEFAULT 'usuario' CHECK (papel IN ('admin', 'usuario', 'visitante')),
  ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categorias (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS produtos (
  id           SERIAL PRIMARY KEY,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  nome         VARCHAR(200) NOT NULL,
  descricao    TEXT,
  preco        DECIMAL(10,2) NOT NULL CHECK (preco >= 0),
  estoque      INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'enviado', 'entregue', 'cancelado')),
  total       DECIMAL(10,2) NOT NULL DEFAULT 0,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS pedido_itens (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id  INTEGER REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unit  DECIMAL(10,2) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_produtos_cat     ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario  ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status   ON pedidos(status);
` },
      { name: "queries.sql", content: `-- Consultas úteis

-- Buscar todos os usuários ativos
SELECT id, nome, email, papel, criado_em FROM usuarios WHERE ativo = TRUE ORDER BY nome;

-- Produtos com estoque baixo (menos de 10)
SELECT p.nome, p.estoque, c.nome AS categoria
FROM produtos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.ativo = TRUE AND p.estoque < 10
ORDER BY p.estoque ASC;

-- Pedidos com total por usuário
SELECT u.nome, COUNT(p.id) AS total_pedidos, SUM(p.total) AS valor_total
FROM usuarios u
JOIN pedidos p ON p.usuario_id = u.id
GROUP BY u.id, u.nome
ORDER BY valor_total DESC;

-- Últimos 30 dias de vendas
SELECT DATE(criado_em) AS dia, COUNT(*) AS pedidos, SUM(total) AS receita
FROM pedidos
WHERE criado_em >= NOW() - INTERVAL '30 days' AND status = 'pago'
GROUP BY DATE(criado_em)
ORDER BY dia DESC;

-- Inserir dados de exemplo
INSERT INTO categorias (nome, descricao) VALUES
  ('Eletrônicos', 'Dispositivos e gadgets'),
  ('Livros', 'Livros físicos e digitais'),
  ('Roupas', 'Vestuário em geral');

INSERT INTO produtos (categoria_id, nome, preco, estoque) VALUES
  (1, 'Fone Bluetooth', 149.90, 50),
  (1, 'Carregador USB-C', 49.90, 100),
  (2, 'Clean Code', 89.90, 30),
  (3, 'Camiseta Básica', 59.90, 200);
` },
      { name: "README.md", content: "# Banco de Dados SQL\n\n## Executar\n```bash\n# PostgreSQL\npsql -U postgres -d meu_banco -f schema.sql\npsql -U postgres -d meu_banco -f queries.sql\n\n# SQLite\nsqlite3 banco.db < schema.sql\nsqlite3 banco.db < queries.sql\n```\n" },
    ],
  },

  manual: {
    label: "📖 Manual DevMobile",
    icon: "book-open",
    files: [
      { name: "MANUAL.md", content: `# 📖 Manual DevMobile v1.7.0

## ⚡ O que é o DevMobile?
IDE profissional para Android — editor Monaco (igual ao VS Code), terminal Linux real, IA (Jasmim), GitHub, banco de dados e plugins, tudo no celular.

---

## 🖥️ Terminal
- Toque na aba **Terminal** (ícone >\\_)
- Execute qualquer comando bash: \`node app.js\`, \`python3 script.py\`, \`npm install\`, etc.
- Botões ↑/↓ navegam o histórico de comandos
- Botão 🗑️ limpa o terminal

---

## 🤖 IA — Jasmim
- Toque no ícone 🤖 no editor
- Peça código, debug, explicações em português
- Funciona com: Gemini (grátis), GPT-4, Claude, e mais 8 modelos
- **Dica:** seja específico — "crie uma API Express com rota GET /usuarios"

---

## 🐙 GitHub — Clone e Push
1. Menu ☰ → **GitHub — Clonar / Enviar**
2. Para clonar: cole a URL do repositório
3. Para push: informe usuário, repositório e token
4. Token: github.com → Settings → Developer settings → Tokens

---

## 📦 Importar / Exportar
- **📄 Importar Arquivo:** ☰ → Importar Arquivo → qualquer .js .py .html .txt
- **📥 Importar ZIP:** ☰ → Importar ZIP → selecione o .zip
- **📤 Exportar ZIP:** ☰ → Exportar ZIP → salva no celular
- **ZIP do código-fonte:** https://SEU-SERVIDOR.com/api/termux/download

---

## 🔌 Instalar Linguagens e Ferramentas (Plugins)
1. Vá na aba **Plugins**
2. Escolha a linguagem ou ferramenta
3. Toque em **Instalar** → escolha a versão → Confirmar
4. O terminal executa o comando de instalação ao vivo

**Aba 📱 Android** — ferramentas específicas para Termux:
- Java (OpenJDK 21), Node.js, Python, Flutter/Dart, React Native CLI, ADB

---

## 📡 Modo Termux (offline total)
> Use o celular como servidor — zero dependência da internet

### Instalação (1 comando no Termux):
\`\`\`bash
pkg update && pkg install nodejs git curl -y
curl -fsSL https://SEU-SERVIDOR.com/api/termux/setup.sh | bash
\`\`\`

### Iniciar o servidor:
\`\`\`bash
bash ~/start-devmobile.sh
\`\`\`

### Conectar o DevMobile:
- Configurações ⚙️ → seção 📡 MODO TERMUX → **⚡ Ativar**
- URL vira: http://localhost:8080

### Uso diário:
1. Abra o Termux → \`bash ~/start-devmobile.sh\` → minimize
2. Abra o DevMobile → use normalmente offline

---

## 🗄️ Banco de Dados
- Menu ☰ → **Banco de Dados (Neon/Postgres)**
- Crie banco grátis em: neon.tech
- Cole a connection string → execute SQL direto no app

---

## 🌐 Preview HTML/Servidor
- **Preview HTML:** ☰ → Preview HTML — visualiza .html ao vivo
- **Preview Servidor:** ☰ → Preview Servidor — vê app Node.js/Python rodando

---

## ⏱️ Checkpoints (backup automático)
- ☰ → **Salvar Checkpoint** — cria snapshot do projeto
- ☰ → **Histórico de Checkpoints** — restaurar versão anterior
- Salve sempre antes de mudanças grandes!

---

## ❓ Problemas comuns

**Terminal diz "Servidor não configurado"**
→ Servidor pode estar iniciando. Aguarde 30s e tente novamente.
→ Ou abra o Termux e rode: bash ~/start-devmobile.sh

**Import deu erro**
→ Use ☰ → Importar Arquivo (para arquivos simples)
→ Se for ZIP, certifique que é um .zip válido

**GitHub clone parou**
→ Limite: 300 arquivos / 5MB por arquivo
→ Repositórios muito grandes: clone manual pelo terminal

---

*DevMobile v1.7.0 — Feito para funcionar no celular, offline, do seu jeito.*
` },
      { name: "TERMUX-SETUP.sh", content: `#!/bin/bash
# DevMobile — Instalação Termux (v1.7.0)
# Cole no Termux e execute

pkg update && pkg upgrade -y
pkg install nodejs git curl -y

echo "Baixando servidor DevMobile..."
curl -fsSL https://SEU-SERVIDOR.com/api/termux/setup.sh | bash

echo ""
echo "Para iniciar: bash ~/start-devmobile.sh"
echo "No DevMobile: Configurações → Modo Termux → Ativar"
` },
      { name: "ATALHOS.md", content: `# ⌨️ Atalhos e Dicas — DevMobile v1.7.0

## Menu ☰ (Menu Completo)
| Opção | O que faz |
|-------|-----------|
| 📄 Importar Arquivo | Importa qualquer .js .py .html .txt |
| 📥 Importar ZIP | Importa projeto compactado |
| 📤 Exportar ZIP | Exporta projeto atual |
| 🤖 Jasmim | Abre assistente IA |
| 🔗 GitHub | Clonar / enviar repositório |
| 📦 Instalar Biblioteca | npm install, pip install... |
| 🗄️ Banco de Dados | Conectar PostgreSQL/Neon |
| 📸 Checkpoint | Salvar ponto de restauração |
| 🌐 Preview HTML | Visualizar HTML ao vivo |
| ⬛ Terminal | Abrir terminal bash |
| 🗑️ Limpar Projeto | Apagar todos os arquivos |

## Barra do Editor
- **⚡** — barra de símbolos rápidos: {}, [], (), ;, etc.
- **🤖** — IA Jasmim (canto superior direito)
- **☰** — menu completo (canto superior esquerdo)
- **▶** — executar arquivo atual

## Terminal
- ↑ / ↓ — histórico de comandos
- 🗑️ — limpar tela
- Ctrl+C (botão no teclado) — cancelar processo

## Plugins — Aba 📱 Android
Para instalar Java, Node.js, Python, Flutter no celular via Termux:
→ Plugins → aba "📱 Android" → escolha → Instalar
` },
    ],
  },
};

// Gera avatar colorido igual ao SK Code Editor
const AVATAR_COLORS = ["#8b5cf6","#ef4444","#f97316","#22c55e","#3b82f6","#ec4899","#14b8a6","#a855f7","#06b6d4","#84cc16"];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function openInEditor(project: Project, editor: "vscode" | "stackblitz" | "gitpod", onPush: () => void) {
  const gitRepo = project.gitRepo;
  if (!gitRepo) {
    Alert.alert(
      "GitHub necessário",
      `Para abrir no ${editor === "vscode" ? "VS Code Web" : editor === "stackblitz" ? "StackBlitz" : "Gitpod"}, primeiro envie o projeto para o GitHub.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "📤 Enviar para GitHub", onPress: onPush },
      ]
    );
    return;
  }
  const match = gitRepo.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    Alert.alert("URL inválida", "Não foi possível identificar o repositório GitHub.");
    return;
  }
  const [, owner, repo] = match;
  const repoClean = repo.replace(/\.git$/, "");
  const urls: Record<string, string> = {
    vscode: `https://github.dev/${owner}/${repoClean}`,
    stackblitz: `https://stackblitz.com/github/${owner}/${repoClean}`,
    gitpod: `https://gitpod.io/#https://github.com/${owner}/${repoClean}`,
  };
  Linking.openURL(urls[editor]);
}

function ProjectCard({
  project,
  onPress,
  onDelete,
  onExport,
  onTerminal,
  onSync,
  onSelect,
  onRename,
  onPush,
  onBuildApk,
  onMoveToFolder,
  isSelected,
}: {
  project: Project;
  onPress: () => void;
  onDelete: () => void;
  onExport: () => void;
  onTerminal: () => void;
  onSync: () => void;
  onSelect: () => void;
  onRename: () => void;
  onPush: () => void;
  onBuildApk: () => void;
  onMoveToFolder: () => void;
  isSelected: boolean;
}) {
  const colors = useColors();
  const avatarColor = getAvatarColor(project.name);
  const initials = getInitials(project.name);
  const hasGit = !!project.gitRepo;

  const showMenu = () => {
    const fileCount = project.files.length.toLocaleString("pt-BR");
    Alert.alert(
      project.name,
      `${fileCount} arquivo${project.files.length !== 1 ? "s" : ""}${project.folder ? ` · 📁 ${project.folder}` : ""}`,
      [
        { text: "📂  Abrir no Editor", onPress },
        { text: "📡  Enviar para Terminal", onPress: onTerminal },
        { text: "↩️  Sincronizar do Terminal", onPress: onSync },
        { text: "🔨  Compilar APK", onPress: onBuildApk },
        { text: "📦  Exportar ZIP", onPress: onExport },
        { text: "📁  Mover para pasta", onPress: onMoveToFolder },
        { text: "✏️  Renomear", onPress: onRename },
        { text: "🔗  Selecionar para combinar", onPress: onSelect },
        { text: "📤  Enviar para GitHub", onPress: onPush },
        ...(hasGit ? [
          { text: "🌐  VS Code Web", onPress: () => openInEditor(project, "vscode", onPush) },
          { text: "⚡  StackBlitz", onPress: () => openInEditor(project, "stackblitz", onPush) },
          { text: "🟠  Gitpod", onPress: () => openInEditor(project, "gitpod", onPush) },
        ] : []),
        { text: "🗑️  Excluir", style: "destructive", onPress: onDelete },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showMenu();
      }}
      style={[styles.card, { backgroundColor: isSelected ? avatarColor + "22" : colors.card, borderColor: isSelected ? avatarColor : colors.border, borderWidth: isSelected ? 1.5 : 1 }]}
      activeOpacity={0.75}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Nome + meta */}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{project.name}</Text>
            {project.folder && (
              <View style={{ backgroundColor: "#6366f118", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: "#6366f130" }}>
                <Text style={{ color: "#a5b4fc", fontSize: 9, fontWeight: "700" }}>📁 {project.folder}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
            {new Date(project.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
            {" · "}
            {project.files.length.toLocaleString("pt-BR")} arq.
          </Text>
        </View>

        {/* Menu compacto */}
        <TouchableOpacity
          onPress={showMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginLeft: 4 }}
        >
          <Feather name="more-vertical" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const apiBase = useApiBase();
  const {
    projects,
    createProject,
    deleteProject,
    updateProject,
    setActiveProject,
    combineProjects,
    importGitRepo,
    pushToGit,
    gitConfigs,
    createFile,
    createFiles,
    activeProject,
    activeTerminal,
    settings,
  } = useApp();

  const [showNewModal, setShowNewModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showCombineModal, setShowCombineModal] = useState(false);
  const [showLibSearch, setShowLibSearch] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // Novo: abas + pesquisa + modo + Criar com IA
  const [activeTab, setActiveTab] = useState<"tudo" | "recente" | "criar">("tudo");
  const [showFeatured, setShowFeatured] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showCriarComIA, setShowCriarComIA] = useState(false);
  const [iaDesc, setIaDesc] = useState("");
  const [iaProjectName, setIaProjectName] = useState("");
  const [iaGenerating, setIaGenerating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [template, setTemplate] = useState("vazio");

  const [gitUrl, setGitUrl] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [gitProvider, setGitProvider] = useState<"github" | "gitlab">("github");

  const [combineName, setCombineName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ pct: number; phase: string } | null>(null);

  const [showApkModal, setShowApkModal] = useState(false);
  const [featuredImporting, setFeaturedImporting] = useState<string | null>(null);
  const [apkProject, setApkProject] = useState<Project | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerTarget, setFolderPickerTarget] = useState<Project | null>(null);
  const DEFAULT_FOLDERS = ["APK/Android", "Web/PWA", "Estudo", "Trabalho", "Testes"];
  const [showPushModal, setShowPushModal] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [pwaUrl, setPwaUrl] = useState("");
  const [pushProject, setPushProject] = useState<Project | null>(null);
  const [pushRepoUrl, setPushRepoUrl] = useState("");
  const [pushToken, setPushToken] = useState("");
  const [pushBranch, setPushBranch] = useState("main");
  const [pushing, setPushing] = useState(false);

  const topPadding = Platform.OS === "web" ? 14 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 70 : Math.max(insets.bottom, 16) + 70;

  const handleAddFeaturedProject = (fp: typeof FEATURED_PROJECTS[0]) => {
    const already = projects.find(p => p.name === fp.name);
    if (already) {
      Alert.alert(
        "Projeto já existe",
        `"${fp.name}" já está na sua lista. Quer abrir ele?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Abrir", onPress: () => { setActiveProject(already); router.navigate("/(tabs)/editor"); } },
        ]
      );
      return;
    }
    setFeaturedImporting(fp.id);
    const proj = createProject(fp.name, fp.description);
    createFiles(proj.id, fp.files.map(f => ({ path: f.path, content: f.content })));
    setActiveProject(proj);
    setFeaturedImporting(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "✅ Projeto adicionado!",
      `"${fp.name}" adicionado com ${fp.files.length} arquivos prontos.\n\nAbrir no editor agora?`,
      [
        { text: "Agora não", style: "cancel" },
        { text: "Abrir Editor", onPress: () => router.navigate("/(tabs)/editor") },
      ]
    );
  };

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    router.navigate("/(tabs)/editor");
  };

  const handleExportZip = async (project: Project) => {
    const ok = await exportZip(project);
    if (!ok) Alert.alert("Erro", "Não foi possível exportar o projeto.");
  };

  const handleSendToTerminal = async (project: Project) => {
    if (!apiBase) {
      Alert.alert(
        "Servidor offline",
        "O terminal do servidor não está disponível agora.\n\nUse 'Exportar ZIP' para levar os arquivos para outro local, ou configure o Termux no celular.",
        [{ text: "Exportar ZIP", onPress: () => handleExportZip(project) }, { text: "Cancelar", style: "cancel" }]
      );
      return;
    }
    setActiveProject(project);
    const sessionId = activeTerminal || "project-sync";
    try {
      const res = await fetch(`${apiBase}/api/terminal/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          files: project.files
            .filter((f) => !f.path?.endsWith(".gitkeep"))
            .map((f) => ({ path: f.path || f.name, content: f.content || "" })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "📡 Projeto no Terminal!",
        `"${project.name}" — ${data.count} arquivo(s) enviados.\n📁 Diretório: ${data.cwd}\n\nAbrindo terminal...`,
        [{ text: "Ir ao Terminal", onPress: () => router.navigate("/(tabs)/terminal") }]
      );
    } catch (e: any) {
      Alert.alert("Erro ao enviar", e?.message || "Falha ao conectar com o servidor.");
    }
  };

  const handleSyncFromTerminal = async (project: Project) => {
    if (!apiBase) {
      Alert.alert(
        "Servidor offline",
        "Sem servidor, use 'Importar ZIP' para receber arquivos.",
        [{ text: "Importar ZIP", onPress: handleImportZip }, { text: "Cancelar", style: "cancel" }]
      );
      return;
    }
    setActiveProject(project);
    const sessionId = activeTerminal || "project-sync";
    try {
      const res = await fetch(`${apiBase}/api/terminal/read?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { ok: boolean; cwd: string; files: Array<{ path: string; content: string }> } = await res.json();
      if (!data.files?.length) {
        Alert.alert(
          "Sem arquivos no terminal",
          "Nenhum arquivo encontrado no servidor.\n\nPrimeiro use '📡 Terminal' para enviar o projeto, edite no terminal, depois sincronize.",
          [{ text: "OK" }]
        );
        return;
      }
      createFiles(project.id, data.files);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("↩ Sincronizado!", `${data.files.length} arquivo(s) recebidos do terminal → "${project.name}".`);
    } catch (e: any) {
      Alert.alert("Erro ao sincronizar", e?.message || "Falha ao conectar com o servidor.");
    }
  };

  const handleImportZip = async () => {
    setShowActionsMenu(false);
    setImportProgress({ pct: 0, phase: "Aguardando seleção..." });
    try {
      const data = await importZip((cur, _total, phase) => {
        setImportProgress({ pct: cur, phase });
      });
      if (!data) { setImportProgress(null); return; }
      setImportProgress({ pct: 98, phase: `Salvando ${data.files.length.toLocaleString("pt-BR")} arquivos...` });
      const proj = createProject(data.name, data.description);
      const filesInput = data.files.map((f) => ({ path: f.path || f.name, content: f.content }));
      const createdFiles = createFiles(proj.id, filesInput);
      setActiveProject({ ...proj, files: createdFiles });
      setImportProgress(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Importado!", `"${data.name}" — ${data.files.length.toLocaleString("pt-BR")} arquivo(s) importados.`);
    } catch (err: any) {
      setImportProgress(null);
      Alert.alert("Erro ao importar ZIP", err?.message || String(err) || "Falha desconhecida ao ler o arquivo.");
    }
  };

  const handleImportTar = async () => {
    setShowActionsMenu(false);
    setImportProgress({ pct: 0, phase: "Aguardando seleção..." });
    try {
      const data = await importTar((cur, _total, phase) => {
        setImportProgress({ pct: cur, phase });
      });
      if (!data) { setImportProgress(null); return; }
      setImportProgress({ pct: 98, phase: `Salvando ${data.files.length.toLocaleString("pt-BR")} arquivos...` });
      const proj = createProject(data.name, data.description);
      const filesInput = data.files.map((f) => ({ path: f.path || f.name, content: f.content }));
      const createdFiles = createFiles(proj.id, filesInput);
      setActiveProject({ ...proj, files: createdFiles });
      setImportProgress(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Importado!", `"${data.name}" — ${data.files.length.toLocaleString("pt-BR")} arquivo(s) importados.`);
    } catch (err: any) {
      setImportProgress(null);
      Alert.alert("Erro ao importar TAR", err?.message || String(err));
    }
  };

  const handleCreateProject = () => {
    const autoName = newName.trim() || `Projeto ${projects.length + 1}`;
    const tmpl = TEMPLATES[template];
    const proj = createProject(autoName, newDesc.trim());
    const createdFiles = createFiles(proj.id, tmpl.files.map((f) => ({ path: f.name, content: f.content })));
    setActiveProject({ ...proj, files: createdFiles });
    setShowNewModal(false);
    setNewName("");
    setNewDesc("");
    setTemplate("vazio");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate("/(tabs)/editor");
  };

  const handleImportGit = async () => {
    if (!gitUrl.trim()) return;
    setImporting(true);
    setImportProgress({ pct: 0, phase: "Conectando ao repositório..." });
    try {
      const token = gitToken || gitConfigs.find((g) => g.provider === gitProvider)?.token || "";
      const proj = await importGitRepo(gitUrl.trim(), token, gitProvider, (cur, _total, phase) => {
        setImportProgress({ pct: cur, phase });
      });
      setImportProgress(null);
      setActiveProject(proj);
      setShowGitModal(false);
      setGitUrl("");
      setGitToken("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Importado!", `${proj.files.length.toLocaleString("pt-BR")} arquivo(s) importados de "${proj.name}".`);
      router.navigate("/(tabs)/editor");
    } catch (e: any) {
      setImportProgress(null);
      Alert.alert("Erro", e?.message || "Não foi possível importar o repositório.");
    } finally {
      setImporting(false);
    }
  };

  const [pushProgress, setPushProgress] = useState({ cur: 0, total: 0, phase: "" });

  const handlePushToGit = async () => {
    if (!pushProject || !pushRepoUrl.trim() || !pushToken.trim()) return;
    setPushing(true);
    setPushProgress({ cur: 0, total: pushProject.files?.length || 0, phase: "Iniciando..." });
    try {
      const result = await pushToGit(
        pushProject.id,
        pushRepoUrl.trim(),
        pushToken.trim(),
        pushBranch.trim() || "main",
        (cur, total, phase) => setPushProgress({ cur, total, phase })
      );
      setShowPushModal(false);
      setPushRepoUrl("");
      setPushToken("");
      setPushBranch("main");
      setPushProgress({ cur: 0, total: 0, phase: "" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "✅ Enviado!",
        `${result.pushed} arquivo(s) enviado(s) com sucesso!${result.errors > 0 ? `\n⚠️ ${result.errors} arquivo(s) com erro.` : ""}\n\nAbra o repositório no GitHub para confirmar.`
      );
    } catch (e: unknown) {
      Alert.alert("Erro ao enviar", e instanceof Error ? e.message : "Não foi possível enviar para o repositório.");
    } finally {
      setPushing(false);
    }
  };

  const handleCombine = () => {
    if (selectedProjects.length < 2 || !combineName.trim()) return;
    const combined = combineProjects(selectedProjects, combineName.trim());
    setActiveProject(combined);
    setSelectedProjects([]);
    setCombineName("");
    setShowCombineModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate("/(tabs)/editor");
  };

  const handleRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    updateProject(renameTarget.id, { name: renameValue.trim() });
    if (activeProject?.id === renameTarget.id) {
      setActiveProject({ ...activeProject, name: renameValue.trim() });
    }
    setRenameTarget(null);
    setRenameValue("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCriarComIA = async () => {
    if (!iaDesc.trim()) return;
    setIaGenerating(true);
    const nomeProjeto = iaProjectName.trim() || `Projeto IA ${projects.length + 1}`;
    try {
      const aiApiBase = apiBase ? `${apiBase}/api` : "http://localhost:8080/api";
      const response = await fetch(`${aiApiBase}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Crie um projeto completo chamado "${nomeProjeto}" com a seguinte descrição:\n\n${iaDesc}\n\nResponda APENAS com um JSON no formato:\n{\n  "files": [\n    {"name": "index.js", "content": "...código completo..."},\n    {"name": "package.json", "content": "..."},\n    {"name": "README.md", "content": "..."}\n  ]\n}\n\nIncluir pelo menos 3-5 arquivos funcionais. Não coloque nada fora do JSON.`,
            },
          ],
          model: "gemini-2.5-flash",
        }),
      });

      let fullText = "";
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.content) fullText += d.content;
            } catch {}
          }
        }
      }

      // Extrai o JSON da resposta
      const match = fullText.match(/\{[\s\S]*"files"[\s\S]*\}/);
      if (!match) throw new Error("IA não retornou JSON válido");
      const parsed = JSON.parse(match[0]);
      const filesData = parsed.files as Array<{ name: string; content: string }>;

      const proj = createProject(nomeProjeto, iaDesc.trim().slice(0, 100));
      const createdFiles = createFiles(proj.id, filesData.map((f) => ({ path: f.name, content: f.content })));
      setActiveProject({ ...proj, files: createdFiles });
      setShowCriarComIA(false);
      setIaDesc("");
      setIaProjectName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Projeto criado!", `"${nomeProjeto}" criado com ${filesData.length} arquivo(s) pela IA!`, [
        { text: "Abrir no Editor", onPress: () => router.navigate("/(tabs)/editor") },
        { text: "Ver depois", style: "cancel" },
      ]);
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao gerar projeto com IA.");
    } finally {
      setIaGenerating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Filtrar projetos por aba e busca
  const filteredProjects = (() => {
    let list = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    if (activeTab === "recente") list = list.slice(0, 5);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (folderFilter !== null) {
      list = list.filter((p) => (p.folder || null) === folderFilter);
    }
    return list;
  })();

  const allFolders = Array.from(new Set(projects.map((p) => p.folder).filter(Boolean))) as string[];

  const groupedProjects = (() => {
    if (folderFilter !== null || searchText.trim() || activeTab !== "tudo") return null;
    const groups: Record<string, Project[]> = {};
    const noFolder: Project[] = [];
    for (const p of filteredProjects) {
      if (p.folder) {
        groups[p.folder] = groups[p.folder] || [];
        groups[p.folder].push(p);
      } else {
        noFolder.push(p);
      }
    }
    return { groups, noFolder };
  })();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── HEADER SK CODE EDITOR ── */}
      <View style={[styles.skHeader, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* Logo + título */}
        <View style={styles.skHeaderLeft}>
          <View style={styles.skLogo}>
            <Text style={styles.skLogoText}>{"</>"}</Text>
          </View>
          <View>
            <Text style={[styles.skTitle, { color: colors.foreground }]}>DevMobile</Text>
            <Text style={[styles.skSubtitle, { color: colors.mutedForeground }]}>IDE no Celular</Text>
          </View>
        </View>

        {/* Botões direita */}
        <View style={styles.skHeaderRight}>
          {selectedProjects.length >= 2 && (
            <TouchableOpacity onPress={() => setShowCombineModal(true)} style={[styles.skBtn, { backgroundColor: "#7c3aed" }]}>
              <Feather name="layers" size={14} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowActionsMenu(true)}
            style={[styles.skBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Feather name="more-horizontal" size={15} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowNewModal(true)}
            style={[styles.skBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BARRA DE PESQUISA ── */}
      <View style={[styles.skSearchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.skSearchInput, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            style={[styles.skSearchText, { color: colors.foreground }]}
            placeholder="Pesquisar projetos..."
            placeholderTextColor={colors.mutedForeground}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Feather name="x" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── ABAS: TUDO / RECENTE / CRIAR ── */}
      <View style={[styles.skTabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["tudo", "recente", "criar"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.skTab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.skTabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === "tudo" ? "TUDO" : tab === "recente" ? "RECENTE" : "CRIAR"}
            </Text>
            {tab === "tudo" && projects.length > 0 && (
              <View style={[styles.skTabBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.skTabBadgeText}>{projects.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── BARRA DE PASTAS ── */}
      {activeTab === "tudo" && (projects.length > 0 || allFolders.length > 0) && (
        <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {/* Chips de filtro */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: folderFilter ? 4 : 8, gap: 6, flexDirection: "row" }}>
            <TouchableOpacity
              onPress={() => setFolderFilter(null)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: folderFilter === null ? colors.primary : "transparent", borderWidth: 1, borderColor: folderFilter === null ? colors.primary : colors.border }}
            >
              <Feather name="layers" size={10} color={folderFilter === null ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={{ color: folderFilter === null ? colors.primaryForeground : colors.mutedForeground, fontSize: 11, fontWeight: "700" }}>
                Tudo ({projects.length})
              </Text>
            </TouchableOpacity>
            {allFolders.map((folder) => {
              const count = projects.filter(p => p.folder === folder).length;
              const isActive = folderFilter === folder;
              return (
                <TouchableOpacity
                  key={folder}
                  onPress={() => { Haptics.selectionAsync(); setFolderFilter(isActive ? null : folder); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: isActive ? "#6366f1" : "transparent", borderWidth: 1, borderColor: isActive ? "#6366f1" : colors.border }}
                >
                  <Text style={{ fontSize: 9, lineHeight: 14 }}>📁</Text>
                  <Text style={{ color: isActive ? "#fff" : colors.mutedForeground, fontSize: 11, fontWeight: "700" }}>{folder}</Text>
                  <View style={{ backgroundColor: isActive ? "#ffffff30" : colors.border, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 0 }}>
                    <Text style={{ color: isActive ? "#fff" : colors.mutedForeground, fontSize: 9, fontWeight: "800" }}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => Alert.alert("Pastas", "Use o menu ⋮ de qualquer projeto → 'Mover para pasta' para criar e organizar pastas.")}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
            >
              <Feather name="folder-plus" size={10} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>+ Pasta</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Toolbar de ações para pasta selecionada */}
          {folderFilter && (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}>
              <Feather name="folder" size={12} color="#6366f1" />
              <Text style={{ color: "#a5b4fc", fontSize: 11, fontWeight: "700", flex: 1 }}>
                {folderFilter} · {projects.filter(p => p.folder === folderFilter).length} projeto{projects.filter(p => p.folder === folderFilter).length !== 1 ? "s" : ""}
              </Text>
              {[
                { icon: "code" as const, label: "Abrir 1°", color: "#007acc", action: () => {
                  const first = projects.find(p => p.folder === folderFilter);
                  if (first) { setActiveProject(first); router.push("/(tabs)/editor" as never); }
                }},
                { icon: "download" as const, label: "ZIP tudo", color: "#10b981", action: async () => {
                  const inFolder = projects.filter(p => p.folder === folderFilter);
                  for (const p of inFolder) await exportZip(p);
                  Alert.alert("Exportado!", `${inFolder.length} projeto(s) exportados como ZIP.`);
                }},
                { icon: "cpu" as const, label: "APK lote", color: "#8b5cf6", action: () => {
                  Alert.alert("APK em Lote", `Compilar todos os projetos da pasta "${folderFilter}"?\n\nUse o terminal: eas build --platform android`, [{ text: "OK" }]);
                }},
                { icon: "x" as const, label: "Limpar", color: colors.mutedForeground, action: () => setFolderFilter(null) },
              ].map((btn) => (
                <TouchableOpacity
                  key={btn.label}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); btn.action(); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: btn.color + "18", borderWidth: 1, borderColor: btn.color + "35" }}
                >
                  <Feather name={btn.icon} size={11} color={btn.color} />
                  <Text style={{ color: btn.color, fontSize: 10, fontWeight: "700" }}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── CONTEÚDO DAS ABAS ── */}
      {activeTab === "criar" ? (
        /* Aba CRIAR */
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPadding + 16 }}>
          {/* Criar com IA — destaque */}
          <TouchableOpacity
            onPress={() => setShowCriarComIA(true)}
            style={[styles.criarIACard, { backgroundColor: "#7c3aed" }]}
            activeOpacity={0.85}
          >
            <View style={styles.criarIAIcon}>
              <Feather name="cpu" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.criarIATitle}>Criar com IA</Text>
              <Text style={styles.criarIADesc}>Descreva o que quer criar e a IA gera o projeto completo</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#ffffff88" />
          </TouchableOpacity>

          {/* Opções de criação */}
          {[
            { icon: "file-plus", label: "Projeto em Branco", desc: "Começa do zero", action: () => { setTemplate("vazio"); setShowNewModal(true); } },
            { icon: "upload", label: "Importar ZIP", desc: "Carrega um arquivo .zip", action: handleImportZip },
            { icon: "archive", label: "Importar TAR / TAZ / TGZ", desc: "Carrega .tar.gz, .taz, .tgz", action: handleImportTar },
            { icon: "git-branch", label: "Git Clone", desc: "Clone do GitHub ou GitLab", action: () => setShowGitModal(true) },
            { icon: "package", label: "Buscar Biblioteca", desc: "npm / PyPI / etc.", action: () => setShowLibSearch(true) },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.action}
              style={[styles.criarOption, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <View style={[styles.criarOptionIcon, { backgroundColor: colors.secondary }]}>
                <Feather name={item.icon as never} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.criarOptionLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.criarOptionDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        /* Abas TUDO / RECENTE — lista de projetos */
        <>
          {selectedProjects.length > 0 && (
            <View style={[styles.selectBanner, { backgroundColor: colors.accent }]}>
              <Text style={styles.selectText}>
                {selectedProjects.length} selecionado{selectedProjects.length > 1 ? "s" : ""}
              </Text>
              <TouchableOpacity onPress={() => setSelectedProjects([])}>
                <Text style={styles.selectCancel}>Limpar</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={filteredProjects}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              activeTab === "tudo" ? (
                <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
                  <TouchableOpacity
                    onPress={() => setShowFeatured(v => !v)}
                    activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: showFeatured ? 10 : 4 }}
                  >
                    <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: "#6366f1" }} />
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700", letterSpacing: 0.5, flex: 1 }}>
                      PROJETOS PRONTOS
                    </Text>
                    <Feather name={showFeatured ? "chevron-up" : "chevron-down"} size={14} color="#6366f1" />
                  </TouchableOpacity>
                  {showFeatured && FEATURED_PROJECTS.map((fp) => {
                    const isAdded = projects.some(p => p.name === fp.name);
                    const isLoading = featuredImporting === fp.id;
                    return (
                      <View key={fp.id} style={{
                        backgroundColor: "#1a1040",
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: "#6366f144",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}>
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#6366f122", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 24 }}>{fp.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
                              {fp.name}
                            </Text>
                            {fp.badge && (
                              <View style={{ backgroundColor: "#6366f1", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{fp.badge}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 15 }} numberOfLines={2}>
                            {fp.description}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => isAdded
                            ? handleAddFeaturedProject(fp)
                            : handleAddFeaturedProject(fp)
                          }
                          disabled={isLoading}
                          style={{
                            backgroundColor: isAdded ? colors.secondary : "#6366f1",
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            alignItems: "center",
                            minWidth: 70,
                          }}
                        >
                          {isLoading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={{ color: isAdded ? colors.foreground : "#fff", fontSize: 12, fontWeight: "700" }}>
                                {isAdded ? "Abrir" : "+ Adicionar"}
                              </Text>
                          }
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {filteredProjects.length > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 8 }}>
                      <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: colors.primary }} />
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>
                        MEUS PROJETOS
                      </Text>
                    </View>
                  )}
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ProjectCard
                project={item}
                onPress={() => handleOpenProject(item)}
                onDelete={() =>
                  Alert.alert("Excluir projeto", `Excluir "${item.name}"?`, [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Excluir", style: "destructive", onPress: () => deleteProject(item.id) },
                  ])
                }
                onExport={() => handleExportZip(item)}
                onTerminal={() => handleSendToTerminal(item)}
                onSync={() => handleSyncFromTerminal(item)}
                onMoveToFolder={() => { setFolderPickerTarget(item); setShowFolderPicker(true); }}
                onSelect={() => toggleSelect(item.id)}
                onRename={() => { setRenameTarget(item); setRenameValue(item.name); }}
                onPush={() => {
                  setPushProject(item);
                  setPushRepoUrl(item.gitRepo || "");
                  setShowPushModal(true);
                }}
                onBuildApk={() => { setApkProject(item); setShowApkModal(true); }}
                isSelected={selectedProjects.includes(item.id)}
              />
            )}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            contentContainerStyle={{ paddingBottom: bottomPadding + 16, flexGrow: filteredProjects.length === 0 ? 1 : undefined }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="code" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum projeto ainda</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                  Vá para a aba CRIAR para começar um projeto novo
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab("criar")}
                  style={[styles.emptyBtn, { backgroundColor: colors.primary, flexDirection: "row", gap: 8 }]}
                >
                  <Feather name="plus" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Criar Projeto</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </>
      )}

      {/* ── MODAL: CRIAR COM IA ── */}
      <Modal visible={showCriarComIA} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.iaBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" }}>
                <Feather name="cpu" size={16} color="#fff" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Criar com IA</Text>
              <TouchableOpacity onPress={() => setShowCriarComIA(false)} style={{ marginLeft: "auto" }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[{ color: colors.mutedForeground, fontSize: 13, marginBottom: 6 }]}>Nome do Projeto (opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, marginBottom: 12 }]}
              placeholder={`Projeto IA ${projects.length + 1}`}
              placeholderTextColor={colors.mutedForeground}
              value={iaProjectName}
              onChangeText={setIaProjectName}
            />

            <Text style={[{ color: colors.mutedForeground, fontSize: 13, marginBottom: 6 }]}>Descreva o que você quer criar</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, height: 100, textAlignVertical: "top" }]}
              placeholder={"Ex: Uma API REST em Node.js com rotas de usuários e banco SQLite\nEx: Site pessoal em HTML/CSS com portfolio\nEx: Script Python para analisar CSV e gerar relatório"}
              placeholderTextColor={colors.mutedForeground}
              value={iaDesc}
              onChangeText={setIaDesc}
              multiline
              numberOfLines={4}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setShowCriarComIA(false)}
                style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCriarComIA}
                disabled={!iaDesc.trim() || iaGenerating}
                style={[styles.primaryBtn, { flex: 2, backgroundColor: iaDesc.trim() && !iaGenerating ? "#7c3aed" : colors.secondary }]}
              >
                {iaGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="cpu" size={14} color={iaDesc.trim() ? "#fff" : colors.mutedForeground} />
                )}
                <Text style={[styles.primaryBtnText, { color: iaDesc.trim() && !iaGenerating ? "#fff" : colors.mutedForeground }]}>
                  {iaGenerating ? "Gerando..." : "Criar com IA"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Renomear Projeto */}
      <Modal visible={!!renameTarget} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setRenameTarget(null)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.renameBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 12 }]}>
                ✏️  Renomear Projeto
              </Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.primary, backgroundColor: colors.secondary }]}
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Novo nome do projeto"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={handleRename}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setRenameTarget(null)}
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRename}
                  disabled={!renameValue.trim()}
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: renameValue.trim() ? colors.primary : colors.secondary }]}
                >
                  <Feather name="check" size={14} color={renameValue.trim() ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.primaryBtnText, { color: renameValue.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                    Salvar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Mover para Pasta */}
      <Modal visible={showFolderPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowFolderPicker(false); setFolderPickerTarget(null); }}>
          <TouchableOpacity activeOpacity={1} style={{ width: "100%" }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: colors.border, position: "absolute", bottom: 0, left: 0, right: 0 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 16 }} />
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
                📁 Mover para Pasta
              </Text>
              {folderPickerTarget && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 16 }}>
                  Projeto: <Text style={{ color: colors.foreground }}>{folderPickerTarget.name}</Text>
                  {folderPickerTarget.folder ? ` — pasta atual: ${folderPickerTarget.folder}` : " — sem pasta"}
                </Text>
              )}
              {/* Sem pasta */}
              <TouchableOpacity
                onPress={() => {
                  if (folderPickerTarget) updateProject(folderPickerTarget.id, { folder: undefined });
                  setShowFolderPicker(false); setFolderPickerTarget(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: !folderPickerTarget?.folder ? colors.primary + "22" : colors.secondary, marginBottom: 6, borderWidth: 1, borderColor: !folderPickerTarget?.folder ? colors.primary + "44" : colors.border }}
              >
                <Feather name="inbox" size={16} color={!folderPickerTarget?.folder ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: !folderPickerTarget?.folder ? colors.primary : colors.foreground, fontWeight: "600" }}>Sem pasta (raiz)</Text>
                {!folderPickerTarget?.folder && <Feather name="check" size={14} color={colors.primary} style={{ marginLeft: "auto" }} />}
              </TouchableOpacity>
              {/* Pastas existentes + padrões */}
              {Array.from(new Set([...allFolders, ...DEFAULT_FOLDERS])).map((folder) => (
                <TouchableOpacity
                  key={folder}
                  onPress={() => {
                    if (folderPickerTarget) updateProject(folderPickerTarget.id, { folder });
                    setShowFolderPicker(false); setFolderPickerTarget(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: folderPickerTarget?.folder === folder ? "#6366f122" : colors.secondary, marginBottom: 6, borderWidth: 1, borderColor: folderPickerTarget?.folder === folder ? "#6366f144" : colors.border }}
                >
                  <Text style={{ fontSize: 14 }}>📁</Text>
                  <Text style={{ color: folderPickerTarget?.folder === folder ? "#a5b4fc" : colors.foreground, fontWeight: "600", flex: 1 }}>{folder}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{projects.filter(p => p.folder === folder).length} proj.</Text>
                  {folderPickerTarget?.folder === folder && <Feather name="check" size={14} color="#a5b4fc" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  setShowFolderPicker(false);
                  if (Platform.OS === "ios") {
                    Alert.prompt("Nova Pasta", "Nome da nova pasta:", (name) => {
                      if (name?.trim() && folderPickerTarget) {
                        updateProject(folderPickerTarget.id, { folder: name.trim() });
                        setFolderPickerTarget(null);
                      }
                    });
                  } else {
                    Alert.alert("Nova Pasta", "Digite o nome da nova pasta e toque em Mover.", [
                      { text: "Cancelar", style: "cancel", onPress: () => setFolderPickerTarget(null) },
                      ...["APK/Android", "Web/PWA", "API/Backend", "Estudo", "Experimento", "Clientes", "Freelance"].map(name => ({
                        text: name,
                        onPress: () => {
                          if (folderPickerTarget) { updateProject(folderPickerTarget.id, { folder: name }); setFolderPickerTarget(null); }
                        },
                      })),
                    ]);
                  }
                }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", marginTop: 4 }}
              >
                <Feather name="folder-plus" size={15} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>Nova pasta personalizada</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Enviar para GitHub/GitLab */}
      <Modal visible={showPushModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={() => { setShowPushModal(false); setPushRepoUrl(""); setPushToken(""); }}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(24, insets.top + 12) }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              📤  Enviar para Repositório
            </Text>
            <TouchableOpacity onPress={() => { setShowPushModal(false); setPushRepoUrl(""); setPushToken(""); }}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {pushProject && (
              <View style={[styles.hintBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="folder" size={13} color={colors.primary} />
                <Text style={[styles.hintText, { color: colors.foreground, fontWeight: "600" }]}>
                  {pushProject.name}  ({pushProject.files?.length || 0} arquivo(s))
                </Text>
              </View>
            )}

            <View style={[styles.hintBox, { backgroundColor: colors.secondary, borderColor: colors.border, marginBottom: 14 }]}>
              <Feather name="info" size={13} color={colors.info} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Cole a URL do repositório e o token. Os arquivos do projeto serão enviados via API. O repositório precisa existir antes.
              </Text>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>URL do Repositório</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={pushRepoUrl}
              onChangeText={(t) => {
                setPushRepoUrl(t);
              }}
              placeholder="https://github.com/usuario/repositorio"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {pushRepoUrl.trim().length > 5 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Feather name="check-circle" size={12} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12 }}>
                  Detectado: {pushRepoUrl.includes("gitlab") ? "GitLab" : "GitHub"}
                </Text>
              </View>
            )}

            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Token de Acesso{" "}
              <Text style={{ fontSize: 11 }}>(obrigatório para enviar)</Text>
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={pushToken}
              onChangeText={setPushToken}
              placeholder={pushRepoUrl.includes("gitlab") ? "glpat-xxxxxxxxxxxx" : "ghp_xxxxxxxxxxxx"}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Branch</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={pushBranch}
              onChangeText={setPushBranch}
              placeholder="main"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 16, lineHeight: 16 }}>
              {pushRepoUrl.includes("gitlab")
                ? "Token GitLab: gitlab.com → Preferências → Access Tokens → Adicionar (escopo: api, write_repository)"
                : "Token GitHub: github.com → Settings → Developer settings → Personal access tokens → (escopos: repo, contents:write)"}
            </Text>

            {/* Progresso do push */}
            {pushing && (
              <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
                  {pushProgress.phase || "Enviando..."}
                </Text>
                <View style={{ backgroundColor: colors.muted, borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <View style={{
                    backgroundColor: "#059669",
                    height: 6,
                    borderRadius: 4,
                    width: pushProgress.total > 0
                      ? `${Math.round((pushProgress.cur / pushProgress.total) * 100)}%`
                      : "5%",
                  }} />
                </View>
                {pushProgress.total > 0 && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6 }}>
                    {pushProgress.cur} / {pushProgress.total} arquivos
                    {" · "}{Math.round((pushProgress.cur / pushProgress.total) * 100)}%
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={handlePushToGit}
              disabled={!pushRepoUrl.trim() || !pushToken.trim() || pushing}
              style={[styles.primaryBtn, {
                backgroundColor: pushRepoUrl.trim() && pushToken.trim() && !pushing ? "#059669" : colors.muted
              }]}
            >
              <Feather name="upload-cloud" size={16} color="#fff" />
              <Text style={[styles.primaryBtnText, { color: "#fff" }]}>
                {pushing ? "Enviando..." : "Enviar para o Repositório"}
              </Text>
            </TouchableOpacity>

            {/* Dica sobre o repositório */}
            <View style={{ backgroundColor: "#0c1a0c", borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#16a34a33" }}>
              <Text style={{ color: "#4ade80", fontSize: 12, fontWeight: "600", marginBottom: 4 }}>💡 Como funciona</Text>
              <Text style={{ color: "#86efac", fontSize: 12, lineHeight: 18 }}>
                {"Os arquivos vão todos em 1 commit (não arquivo por arquivo). Funciona com projetos grandes.\n\nApós enviar, abra no VS Code:\ncode.visualstudio.com → Clone Repository → cole a URL do repo"}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Menu de Ações */}
      <Modal visible={showActionsMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowActionsMenu(false)}
        >
          <View style={[styles.actionsMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.menuTitle, { color: colors.mutedForeground }]}>IMPORTAR</Text>
            {[
              { label: "Importar ZIP", icon: "upload", action: handleImportZip },
              { label: "Importar TAR/TAR.GZ", icon: "archive", action: handleImportTar },
              { label: "Clonar do GitHub", icon: "github", action: () => { setShowActionsMenu(false); setShowGitModal(true); } },
              { label: "Clonar do GitLab", icon: "git-branch", action: () => { setShowActionsMenu(false); setShowGitModal(true); } },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.action}
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
              >
                <Feather name={item.icon as never} size={16} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.menuTitle, { color: colors.mutedForeground, marginTop: 8 }]}>FERRAMENTAS</Text>
            <TouchableOpacity
              onPress={() => { setShowActionsMenu(false); setShowPwaModal(true); }}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
            >
              <Feather name="package" size={16} color="#f59e0b" />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Converter PWA em APK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Converter Site/PWA em APK */}
      <Modal visible={showPwaModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={() => { setShowPwaModal(false); setPwaUrl(""); }}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(24, insets.top + 12) }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>📦 Site → APK</Text>
            <TouchableOpacity onPress={() => { setShowPwaModal(false); setPwaUrl(""); }}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>

            {/* URL Input */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>URL do seu site</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 6 }]}
              value={pwaUrl}
              onChangeText={setPwaUrl}
              placeholder="https://meusite.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 16 }}>
              Cole a URL acima e escolha o serviço abaixo. Todos são gratuitos.
            </Text>

            {/* Opção 1: GoNative — funciona com QUALQUER site */}
            <View style={{ backgroundColor: "#1e3a5f", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#2563eb44" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <View style={{ backgroundColor: "#2563eb", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>RECOMENDADO</Text>
                </View>
                <Text style={{ color: "#93c5fd", fontSize: 15, fontWeight: "700" }}>GoNative.io</Text>
              </View>
              <Text style={{ color: "#bfdbfe", fontSize: 13, marginBottom: 12, lineHeight: 19 }}>
                Funciona com QUALQUER site — não precisa de manifest, service worker ou configuração especial. Só a URL.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: "#2563eb", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pwaUrl.trim() ? 1 : 0.5 }}
                disabled={!pwaUrl.trim()}
                onPress={() => {
                  const url = pwaUrl.trim().startsWith("http") ? pwaUrl.trim() : `https://${pwaUrl.trim()}`;
                  Linking.openURL(`https://gonative.io/app/create?url=${encodeURIComponent(url)}`);
                }}
              >
                <Feather name="external-link" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Abrir no GoNative →</Text>
              </TouchableOpacity>
              <Text style={{ color: "#93c5fd88", fontSize: 11, marginTop: 8, textAlign: "center" }}>
                Gratuito para 1 app · Baixa o APK direto
              </Text>
            </View>

            {/* Opção 2: AppMySite */}
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#7c3aed44" }}>
              <Text style={{ color: "#c4b5fd", fontSize: 15, fontWeight: "700", marginBottom: 6 }}>AppMySite</Text>
              <Text style={{ color: "#ddd6fe", fontSize: 13, marginBottom: 12, lineHeight: 19 }}>
                Interface simples, gera APK automaticamente. Funciona com WordPress, Wix, sites normais e PWAs.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: "#7c3aed", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pwaUrl.trim() ? 1 : 0.5 }}
                disabled={!pwaUrl.trim()}
                onPress={() => {
                  const url = pwaUrl.trim().startsWith("http") ? pwaUrl.trim() : `https://${pwaUrl.trim()}`;
                  Linking.openURL(`https://www.appmysite.com/?url=${encodeURIComponent(url)}`);
                }}
              >
                <Feather name="external-link" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Abrir no AppMySite →</Text>
              </TouchableOpacity>
            </View>

            {/* Opção 3: WebIntoApp */}
            <View style={{ backgroundColor: "#14290a", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#16a34a44" }}>
              <Text style={{ color: "#86efac", fontSize: 15, fontWeight: "700", marginBottom: 6 }}>WebIntoApp</Text>
              <Text style={{ color: "#bbf7d0", fontSize: 13, marginBottom: 12, lineHeight: 19 }}>
                O mais simples: só cole a URL e baixe o APK. Sem cadastro, sem configuração.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: "#16a34a", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pwaUrl.trim() ? 1 : 0.5 }}
                disabled={!pwaUrl.trim()}
                onPress={() => {
                  const url = pwaUrl.trim().startsWith("http") ? pwaUrl.trim() : `https://${pwaUrl.trim()}`;
                  Linking.openURL(`https://www.webintoapp.com/store/new?url=${encodeURIComponent(url)}`);
                }}
              >
                <Feather name="external-link" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Abrir no WebIntoApp →</Text>
              </TouchableOpacity>
            </View>

            {/* Opção 4: PWABuilder (requer manifest) */}
            <View style={{ backgroundColor: "#292929", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#555" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Text style={{ color: "#e5e7eb", fontSize: 15, fontWeight: "700" }}>PWABuilder</Text>
                <View style={{ backgroundColor: "#78350f", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: "#fbbf24", fontSize: 10, fontWeight: "700" }}>REQUER MANIFEST</Text>
                </View>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12, lineHeight: 19 }}>
                Oficial da Microsoft. Exige manifest.json e service worker — por isso pode dar erros. Só use se o site já for PWA completo.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: "#374151", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pwaUrl.trim() ? 1 : 0.5 }}
                disabled={!pwaUrl.trim()}
                onPress={() => {
                  const url = pwaUrl.trim().startsWith("http") ? pwaUrl.trim() : `https://${pwaUrl.trim()}`;
                  Linking.openURL(`https://www.pwabuilder.com/?site=${encodeURIComponent(url)}`);
                }}
              >
                <Feather name="external-link" size={16} color="#9ca3af" />
                <Text style={{ color: "#9ca3af", fontWeight: "600", fontSize: 14 }}>Abrir no PWABuilder</Text>
              </TouchableOpacity>
            </View>

            {/* Dica */}
            <View style={{ backgroundColor: "#0c1a0c", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#16a34a33" }}>
              <Text style={{ color: "#4ade80", fontSize: 13, fontWeight: "600", marginBottom: 6 }}>💡 Dica: qual escolher?</Text>
              <Text style={{ color: "#86efac", fontSize: 13, lineHeight: 20 }}>
                {"• Site normal/qualquer → GoNative ou WebIntoApp\n• WordPress/Wix → AppMySite\n• Já tem manifest.json → PWABuilder\n• Quer personalizar muito → GoNative (plano pago)"}
              </Text>
            </View>

          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Compilar APK */}
      <Modal visible={showApkModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={() => setShowApkModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(24, insets.top + 12) }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>🔨 Compilar APK</Text>
            <TouchableOpacity onPress={() => setShowApkModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>

            {/* Info do projeto */}
            {apkProject && (() => {
              const appJsonFile = apkProject.files.find(f => f.name === "app.json" || f.path === "app.json");
              let isExpo = false;
              let slug = "meu-app";
              let pkg = "com.meuapp";
              if (appJsonFile) {
                try {
                  const parsed = JSON.parse(appJsonFile.content);
                  if (parsed?.expo) {
                    isExpo = true;
                    slug = parsed.expo.slug || slug;
                    pkg = parsed.expo.android?.package || pkg;
                  }
                } catch {}
              }

              const termuxCmds = isExpo ? [
                "# 1. Instala Node.js no Termux",
                "pkg install nodejs",
                "",
                "# 2. Instala o EAS CLI",
                "npm install -g eas-cli",
                "",
                "# 3. Entra na pasta do projeto extraído",
                `cd ~/storage/downloads/${slug}`,
                "",
                "# 4. Instala as dependências",
                "npm install",
                "",
                "# 5. Faz login na sua conta Expo",
                "eas login",
                "",
                "# 6. Cria o projeto no EAS (só na primeira vez)",
                "eas init",
                "",
                "# 7. COMPILA O APK 🚀",
                "EAS_NO_VCS=1 eas build --platform android --profile preview",
              ] : [
                "pkg install nodejs",
                "npm install -g eas-cli",
                "eas login",
                "EAS_NO_VCS=1 eas build --platform android --profile preview",
              ];

              return (
                <>
                  {/* Cabeçalho do projeto */}
                  <View style={{ backgroundColor: isExpo ? "#1e3a5f" : colors.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: isExpo ? "#2563eb55" : colors.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {isExpo && <View style={{ backgroundColor: "#2563eb", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>EXPO / REACT NATIVE</Text>
                      </View>}
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{apkProject.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                      {apkProject.files.length} arquivo(s){isExpo ? ` · slug: ${slug} · pkg: ${pkg}` : ""}
                    </Text>
                  </View>

                  {/* Opção 1: EAS Build Nuvem */}
                  <TouchableOpacity
                    style={{ backgroundColor: "#0ea5e9", borderRadius: 12, padding: 16, marginBottom: 12 }}
                    onPress={() => Linking.openURL(`https://expo.dev/accounts/${settings.expoAccount || "maikon1"}/projects/${slug}/builds`)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <Feather name="cloud" size={20} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>EAS Build — Nuvem ☁️</Text>
                    </View>
                    <Text style={{ color: "#fff", fontSize: 13, opacity: 0.9 }}>
                      Abre o painel de builds do projeto{isExpo ? ` "${slug}"` : ""} no Expo.{"\n"}
                      Grátis para uso pessoal.
                    </Text>
                  </TouchableOpacity>

                  {/* Opção 2: Via Termux - Passo a Passo */}
                  <View style={{ backgroundColor: "#0c2010", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#16a34a55" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Feather name="terminal" size={20} color="#4ade80" />
                      <Text style={{ color: "#4ade80", fontSize: 15, fontWeight: "700" }}>Via Termux — Passo a Passo</Text>
                    </View>
                    <Text style={{ color: "#86efac", fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                      {isExpo
                        ? `Projeto Expo detectado! Extraia o ZIP na pasta Downloads com o nome "${slug}" e execute:`
                        : "Execute os comandos abaixo no Termux. Toque em cada comando para copiar:"}
                    </Text>
                    {termuxCmds.map((cmd, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (cmd && !cmd.startsWith("#")) {
                            Clipboard.setStringAsync(cmd);
                            Alert.alert("✅ Copiado!", `Comando copiado. Cole no Termux.`);
                          }
                        }}
                        activeOpacity={!cmd || cmd.startsWith("#") ? 1 : 0.7}
                      >
                        <Text style={{
                          color: !cmd ? "transparent" : cmd.startsWith("#") ? "#4ade8077" : "#bbf7d0",
                          fontFamily: "monospace",
                          fontSize: 12,
                          marginBottom: cmd ? 3 : 6,
                          backgroundColor: !cmd || cmd.startsWith("#") ? "transparent" : "#ffffff11",
                          paddingHorizontal: !cmd || cmd.startsWith("#") ? 0 : 8,
                          paddingVertical: !cmd || cmd.startsWith("#") ? 0 : 4,
                          borderRadius: 4,
                        }}>
                          {cmd || " "}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <Text style={{ color: "#4ade8077", fontSize: 11, marginTop: 8 }}>
                      Toque em qualquer comando para copiar
                    </Text>
                  </View>

                  {/* Opção 3: GitHub Actions */}
                  <TouchableOpacity
                    style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}
                    onPress={() => Linking.openURL("https://github.com/features/actions")}
                  >
                    <Feather name="git-branch" size={20} color={colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>GitHub Actions</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Compila automaticamente a cada push no repositório</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  {/* Opção 4: Site → APK */}
                  {!isExpo && (
                    <TouchableOpacity
                      style={{ backgroundColor: "#451a03", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#92400e55", flexDirection: "row", alignItems: "center", gap: 12 }}
                      onPress={() => { setShowApkModal(false); setTimeout(() => setShowPwaModal(true), 300); }}
                    >
                      <Feather name="package" size={20} color="#fbbf24" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#fbbf24", fontSize: 14, fontWeight: "600" }}>Site/PWA → APK</Text>
                        <Text style={{ color: "#fde68a", fontSize: 12 }}>Converta este projeto web em APK</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color="#fbbf24" />
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.secondary, marginTop: 8 }]}
              onPress={() => setShowApkModal(false)}
            >
              <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Novo Projeto */}
      <Modal visible={showNewModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={() => setShowNewModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(24, insets.top + 12) }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo Projeto</Text>
            <TouchableOpacity onPress={() => setShowNewModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Nome do projeto <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>(opcional — auto-gerado se vazio)</Text>
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={newName}
              onChangeText={setNewName}
              placeholder={`Projeto ${projects.length + 1}`}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Descrição do projeto"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Template</Text>
            <View style={styles.templateGrid}>
              {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setTemplate(key)}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: template === key ? colors.primary : colors.card,
                      borderColor: template === key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={tmpl.icon as never}
                    size={13}
                    color={template === key ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.templateLabel,
                      { color: template === key ? colors.primaryForeground : colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {tmpl.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={handleCreateProject}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus-circle" size={16} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                Criar Projeto
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Git Import */}
      <Modal visible={showGitModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={() => setShowGitModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(24, insets.top + 12) }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Importar do Git</Text>
            <TouchableOpacity onPress={() => setShowGitModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Dica visual */}
            <View style={[styles.hintBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="info" size={13} color={colors.info} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Cole a URL do repositório abaixo. GitHub e GitLab são detectados automaticamente.
              </Text>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>URL do Repositório</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={gitUrl}
              onChangeText={(text) => {
                setGitUrl(text);
                if (text.includes("gitlab")) setGitProvider("gitlab");
                else setGitProvider("github");
              }}
              placeholder="https://github.com/usuario/repositorio"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            {/* Detectado automaticamente */}
            {gitUrl.trim().length > 5 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Feather name="check-circle" size={12} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12 }}>
                  Detectado: {gitUrl.includes("gitlab") ? "GitLab" : "GitHub"}
                </Text>
              </View>
            )}

            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Token de Acesso{" "}
              <Text style={{ fontSize: 11 }}>(opcional — para repositórios privados)</Text>
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={gitToken}
              onChangeText={setGitToken}
              placeholder={gitProvider === "github" ? "ghp_xxxxxxxxxxxx" : "glpat-xxxxxxxxxxxx"}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 14, lineHeight: 16 }}>
              {gitProvider === "github"
                ? "Token GitHub: github.com → Settings → Developer settings → Personal access tokens → Generate new token (selecione 'repo')"
                : "Token GitLab: gitlab.com → Preferências → Access Tokens → Adicionar (escopo: read_repository)"}
            </Text>

            <TouchableOpacity
              onPress={handleImportGit}
              disabled={!gitUrl.trim() || importing}
              style={[styles.primaryBtn, { backgroundColor: gitUrl.trim() && !importing ? colors.primary : colors.muted }]}
            >
              <Feather name="download-cloud" size={16} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                {importing ? "Importando..." : "Importar Repositório"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Combinar */}
      <Modal visible={showCombineModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={() => setShowCombineModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: Math.max(24, insets.top + 12) }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Combinar Projetos</Text>
            <TouchableOpacity onPress={() => setShowCombineModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Combinando {selectedProjects.length} projetos em um novo
            </Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nome do projeto combinado</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={combineName}
              onChangeText={setCombineName}
              placeholder="Projeto Combinado"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleCombine}
              disabled={!combineName.trim()}
              style={[styles.primaryBtn, { backgroundColor: combineName.trim() ? colors.primary : colors.muted }]}
            >
              <Feather name="layers" size={16} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Combinar Projetos</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <LibrarySearch visible={showLibSearch} onClose={() => setShowLibSearch(false)} />
      <ProjectPlanModal visible={showPlan} onClose={() => setShowPlan(false)} />

      {/* ── OVERLAY DE PROGRESSO DE IMPORTAÇÃO ── */}
      {importProgress && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.88)",
          alignItems: "center", justifyContent: "center",
          zIndex: 9999,
        }}>
          <View style={{
            backgroundColor: "#161b22", borderRadius: 20, padding: 28,
            width: "88%", maxWidth: 380,
            borderWidth: 1, borderColor: "#30363d",
            alignItems: "center",
          }}>
            {/* Spinner */}
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#238636", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <ActivityIndicator size="large" color="#fff" />
            </View>

            {/* Título */}
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 10 }}>
              Importando projeto...
            </Text>

            {/* Fase / arquivo atual — já contém "X / Y arquivos" */}
            <View style={{ backgroundColor: "#0d1117", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, width: "100%", marginBottom: 16 }}>
              <Text style={{ color: "#58a6ff", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                {importProgress.phase}
              </Text>
            </View>

            {/* Barra de progresso */}
            <View style={{ width: "100%", height: 8, backgroundColor: "#21262d", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
              <View style={{
                width: `${Math.max(3, importProgress.pct)}%`,
                height: "100%",
                backgroundColor: importProgress.pct >= 95 ? "#3fb950" : "#238636",
                borderRadius: 6,
              }} />
            </View>

            <Text style={{ color: "#8b949e", fontSize: 11 }}>
              {importProgress.pct}% concluído · não feche o app
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  headerBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toolBar: {
    maxHeight: 44,
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  toolChipText: { fontSize: 12, fontWeight: "500" },
  selectBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  selectText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  selectCancel: { color: "#fff", fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  projectIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardGit: { fontSize: 11, marginTop: 1 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  cardMeta: { fontSize: 12, marginTop: 2 },
  cardDate: { fontSize: 11 },
  exportBtn: { padding: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  emptyActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  renameBox: {
    width: 300,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 8,
  },
  actionsMenu: {
    width: 280,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 8,
  },
  menuTitle: { fontSize: 10, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 6, letterSpacing: 1 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: { fontSize: 15 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 20, gap: 8, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: "600", marginTop: 8, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 4 },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  templateLabel: { fontSize: 12, fontWeight: "600" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  actionBtnText: { fontSize: 15, fontWeight: "700" },
  providerRow: { flexDirection: "row", gap: 10 },
  providerBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  providerText: { fontSize: 14, fontWeight: "500" },
  sectionDesc: { fontSize: 14, marginBottom: 8 },
  hintBox: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8, alignItems: "flex-start" },
  hintText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // ── SK Code Editor styles ──
  skHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  skLogo: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#007acc",
    alignItems: "center", justifyContent: "center",
  },
  skLogoText: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: -1 },
  skTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  skSubtitle: { fontSize: 11, marginTop: 1 },
  skHeaderRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  skBtn: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  skSearchBar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skSearchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skSearchText: { flex: 1, fontSize: 14, padding: 0 },

  skTabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  skTabText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  skTabBadge: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  skTabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // Card SK style (horizontal row)
  avatar: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  openBtn: { padding: 6 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 70 },

  // Aba CRIAR
  criarIACard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
  },
  criarIAIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  criarIATitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  criarIADesc: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  criarOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  criarOptionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  criarOptionLabel: { fontSize: 15, fontWeight: "600" },
  criarOptionDesc: { fontSize: 12, marginTop: 2 },

  // Modal Criar com IA
  iaBox: {
    width: "92%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
});
