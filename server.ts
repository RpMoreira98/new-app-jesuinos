import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// Se o seu código usa caminhos com __dirname em ESM:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ... Suas rotas da API aqui (Ex: app.get('/api/agendamentos', ...)) ...

// SERVIR O FRONT-END COM SEGURANÇA EM PRODUÇÃO
if (process.env.NODE_ENV === "production") {
  // Serve os arquivos estáticos gerados pelo build do Vite
  app.use(express.static(path.join(__dirname, "../dist/public")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/public/index.html"));
  });
} else {
  // AMBIENTE DE DESENVOLVIMENTO (Roda o Vite dinamicamente)
  // Certifique-se de que qualquer menção ao vite.createServer() esteja estritamente aqui dentro!
  console.log("Rodando em modo de desenvolvimento...");
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
