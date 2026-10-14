const fs = require('fs');
const path = require('path');
const { consultarMEC } = require("../services/mecAxiosService");
const { fallbackMEC } = require("../services/mecPuppeteerFallback");
const { gerarPDFCustomizado } = require('../services/pdfCustomService');

// cache simples
const cache = new Map();
const TTL = 5 * 60 * 1000;

async function gerarPDF(req, res) {
  try {
    const { bachillerato, fechaNacimiento, html } = req.body || {};

    if (!bachillerato) {
      return res.status(400).json({
        status: 'ERROR',
        error: 'Documento obrigatório'
      });
    }

    const dir = path.join(__dirname, '../../prints');
    fs.mkdirSync(dir, { recursive: true });

    const nomeArquivo = `bachillerato_${bachillerato}_${Date.now()}.pdf`;
    const caminhoArquivo = path.join(dir, nomeArquivo);

    let pdfBuffer;

    if (html) {
      const { gerarPDFBachillerato } = require('../services/pdfService');
      pdfBuffer = await gerarPDFBachillerato(bachillerato, fechaNacimiento, html);
    } else {
      pdfBuffer = await gerarPDFCustomizado({
        documento: bachillerato,
        fechaNacimiento: fechaNacimiento || '',
        mensagem: 'Consulta de validación de bachillerato realizada por Zion Assessoria.'
      });
    }

    fs.writeFileSync(caminhoArquivo, pdfBuffer);

    return res.json({
      status: 'OK',
      filename: nomeArquivo,
      pdfUrl: `/prints/${nomeArquivo}`,
      pdfBase64: pdfBuffer.toString('base64')
    });
  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error.message);
    return res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
}

async function consultarBachillerato(req, res) {
  try {
    const { bachillerato, fechaNacimiento } = req.body || {};

    if (!bachillerato) {
      return res.status(400).json({
        status: "ERROR",
        error: "Documento obrigatório"
      });
    }

    const key = `${bachillerato}_${fechaNacimiento || ""}`;

    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < TTL) {
      return res.json({
        ...cached.data,
        cache: true
      });
    }

    let resultado;

    try {
      console.log("📤 Enviando para MEC...");
      resultado = await consultarMEC(bachillerato, fechaNacimiento);
      console.log("📥 RESPOSTA MEC OK");
    } catch (error) {
      console.log("⚠️ Axios falhou, usando Puppeteer...");

      try {
        resultado = await fallbackMEC(bachillerato, fechaNacimiento);
      } catch (fallbackError) {
        console.error("❌ Axios e Puppeteer falharam:", fallbackError.message);

        return res.status(200).json({
          status: "ERROR",
          encontrado: false,
          bachillerato,
          mensagem: "Não foi possível completar a consulta no sistema do MEC neste momento. Verifique os dados e tente novamente.",
          timestamp: new Date().toISOString(),
          error: fallbackError.message
        });
      }
    }

    cache.set(key, {
      time: Date.now(),
      data: resultado
    });

    return res.json(resultado);

  } catch (error) {
    console.error("❌ ERRO DETALHADO:");
    console.error(error.message);

    return res.status(200).json({
      status: "ERROR",
      encontrado: false,
      bachillerato: req.body?.bachillerato || "",
      mensagem: "Não foi possível completar a consulta. Tente novamente em alguns instantes.",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

module.exports = {
  consultarBachillerato,
  gerarPDF
};
