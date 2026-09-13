import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini client initialization
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Maps Grounding Endpoint using gemini-3.5-flash with googleMaps tool
  app.post("/api/maps-grounding", async (req, res) => {
    try {
      const { query, latitude, longitude } = req.body;
      const lat = typeof latitude === 'number' ? latitude : -10.2450;
      const lng = typeof longitude === 'number' ? longitude : -48.3250;

      const prompt = `Você é o Radar da Cultura Urbana e Periférica de Palmas (Tocantins). Forneça informações reais, precisas e atualizadas de locais sobre arte de rua, murais de grafite, praças, pistas de skate, feiras populares e centros culturais em Palmas (como Taquaralto, Aureny III, Morada do Sol, Taquari, Espaço Cultural e Praça dos Girassóis) usando o Google Maps. Consulta: ${query || "Pontos de arte urbana, skate e cultura em Palmas"}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      res.json({
        text: response.text || "Nenhuma recomendação retornada.",
        groundingChunks: groundingChunks
      });
    } catch (error: any) {
      console.error("Maps grounding error:", error);
      res.status(500).json({ 
        error: error?.message || "Erro ao consultar dados do Google Maps",
        text: "Não foi possível conectar ao Radar Google Maps neste momento."
      });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
