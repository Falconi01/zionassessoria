const puppeteer = require('puppeteer-core');
const path = require('path');

/**
 * 📄 Serviço de geração de PDF usando Puppeteer
 * Usado apenas quando o usuário quer visualizar/baixar o PDF
 */

const CONFIG = {
  URL_BASE: 'https://tramites.mec.gov.py/gestion_tramites/verificar_bachilleratos/',
  TIMEOUT: 30000, // 30 segundos
  CHROME_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/microsoft-edge-stable'
};

// Cache temporário do HTML (evita refazer consulta)
const htmlCache = new Map();

/**
 * Gera PDF RÁPIDO a partir do HTML salvo (sem navegação)
 * @param {string} htmlContent - HTML completo da página
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function gerarPDFDoHTML(htmlContent) {
  let browser = null;
  
  try {
    console.log('📄 Gerando PDF a partir do HTML salvo (SEM navegação)...');
    
    // Remove textos indesejados do HTML antes de gerar o PDF
    const textosIndesejados = [
      'Ø=ÜÄ',
      'https://creativecommons.org/licenses/by/4.0/',
      '2025 - Aplicativo construído y mantenido por el MEC',
      'https://mec.gov.py',
      'Documento gerado em:',
      'Zion Assessoria'
    ];
    let htmlFiltrado = htmlContent;
<<<<<<< HEAD
    textosIndesejados.forEach(texto => {
      // Remove elementos HTML inteiros que contenham o texto indesejado
      const elementRegex = new RegExp(`<([a-zA-Z]+)[^>]*>[^<]*${texto}[^<]*<\/\\1>`, 'gi');
      htmlFiltrado = htmlFiltrado.replace(elementRegex, '');
      // Remove o texto isolado caso não esteja em um elemento
      const textRegex = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      htmlFiltrado = htmlFiltrado.replace(textRegex, '');
    });
=======
    // Remove apenas o elemento <footer> e <div id="footer"> do HTML
    htmlFiltrado = htmlFiltrado.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    htmlFiltrado = htmlFiltrado.replace(/<div[^>]*id=["']footer["'][^>]*>[\s\S]*?<\/div>/gi, '');
>>>>>>> a5fd090 (Primeiro commit)

    browser = await puppeteer.launch({
      executablePath: CONFIG.CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--single-process',
        '--disable-accelerated-2d-canvas',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-breakpad',
        '--disable-backing-store-limit',
        '--disable-ipc-flooding-protection',
        '--renderer-process-limit=1',
        '--js-flags="--max-old-space-size=128"'
      ]
    });

    const page = await browser.newPage();
    
    // Carrega HTML direto (SUPER RÁPIDO - sem navegação)
    await page.setContent(htmlFiltrado, { waitUntil: 'domcontentloaded' });
    console.log('✅ HTML carregado!');

    // Aplica CSS de impressão
    await page.emulateMediaType('print');

    // Gera PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div></div>',
      margin: { top: '15mm', right: '10mm', bottom: '20mm', left: '10mm' },
      scale: 0.9
    });

    await browser.close();
    
    console.log(`✅ PDF gerado (${(pdfBuffer.length / 1024).toFixed(2)} KB) em ~3-5 segundos!`);
    return pdfBuffer;
    
  } catch (error) {
    if (browser) await browser.close();
    throw new Error(`Falha ao gerar PDF: ${error.message}`);
  }
}

/**
 * Gera PDF da página de verificação do MEC-PY (MÉTODO ANTIGO - LENTO)
 * @param {string} documento - Número do documento
 * @param {string} fechaNacimiento - Data de nascimento (opcional)
 * @param {string} htmlSalvo - HTML já capturado (opcional, para evitar navegação)
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function gerarPDFBachillerato(documento, fechaNacimiento, htmlSalvo = null) {
  // Se já tem HTML salvo, usa método rápido
  if (htmlSalvo) {
    console.log('⚡ Usando HTML salvo - geração rápida!');
    return gerarPDFDoHTML(htmlSalvo);
  }
  
  // Caso contrário, faz consulta completa (LENTO)
  let browser = null;
  
  try {
    console.log(`📄 Gerando PDF para documento: ${documento}`);
    
    // Inicia navegador headless com args otimizados
    browser = await puppeteer.launch({
      executablePath: CONFIG.CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--dns-prefetch-disable',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    
    // Bloquear recursos pesados (mas permitir CSS para PDF)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if(['image', 'font'].includes(req.resourceType())){
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Configura viewport
    await page.setViewport({ 
      width: 1366, 
      height: 768 
    });

    // Navega para a página
    console.log('🌐 Acessando página do MEC...');
    await page.goto(CONFIG.URL_BASE, { 
      waitUntil: 'networkidle0',
      timeout: CONFIG.TIMEOUT 
    });

    // Preenche o formulário
    console.log('✍️ Preenchendo formulário...');
    
    await page.waitForSelector('#id_bachillerato', { timeout: CONFIG.TIMEOUT });
    await page.type('#id_bachillerato', documento);

    if (fechaNacimiento) {
      await page.waitForSelector('#id_fecha_nac', { timeout: CONFIG.TIMEOUT });
      await page.type('#id_fecha_nac', fechaNacimiento);
      
      // Pressiona Enter para submeter
      await page.keyboard.press('Enter');
      console.log('⏳ Aguardando resultado...');
      
      // Aguarda resultado aparecer (reduzido)
      await page.waitForTimeout(2000);
      
      // Verifica se resultado apareceu
      await Promise.race([
        page.waitForSelector('.panel.panel-success', { timeout: 8000, visible: true }),
        page.waitForSelector('.panel.panel-danger', { timeout: 8000, visible: true }),
        page.waitForSelector('.panel', { timeout: 8000, visible: true })
      ]);
      
      console.log('✅ Resultado carregado!');
    }

    // Aplica CSS de impressão
    console.log('🖨️ Aplicando estilo de impressão...');
    await page.emulateMediaType('print');

    // Gera PDF em memória
    console.log('📑 Gerando PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,  // Modo paisagem
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div></div>`,
      margin: {
        top: '15mm',
        right: '10mm',
        bottom: '20mm',
        left: '10mm'
      },
      scale: 0.9
    });

    console.log(`✅ PDF gerado com sucesso (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error.message);
    throw new Error(`Falha ao gerar PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  gerarPDFBachillerato
};
