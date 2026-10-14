const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * ⚠️ CONFIGURAÇÃO - AJUSTAR OS SELETORES CONFORME O SITE REAL
 * 
 * Acesse o site e use o DevTools (F12) para encontrar os seletores corretos:
 * - INPUT_SELECTOR: seletor do campo de input onde digita o bachillerato
 * - BUTTON_SELECTOR: seletor do botão que submete a consulta
 * - RESULT_SELECTOR: seletor do elemento que contém o resultado
 * - VALIDADO_TEXT: texto que indica que está validado (pode ser regex)
 */
const CONFIG = {
  URL: 'https://tramites.mec.gov.py/gestion_tramites/verificar_bachilleratos/',
  
  // ✅ SELETORES AJUSTADOS CONFORME O SITE REAL:
  INPUT_SELECTOR: '#form_buscar_documento_estudiante',     // Campo do documento do estudante
  INPUT_DATE_SELECTOR: '#form_buscar_fecha_nacimiento',     // Campo de data de nascimento
  BUTTON_SELECTOR: '.btn-primary',                          // Botão de buscar (alterado)
  RESULT_SELECTOR: '.panel.panel-success',                  // Painel de resultado (sucesso)
  ERROR_SELECTOR: '.panel.panel-danger',                    // Painel de erro
  
  // Textos que indicam validação (case insensitive)
  VALIDADO_KEYWORDS: ['es egresado de la institución', 'Datos del Egresado', 'egresado'],
  
  // Timeout em milissegundos - otimizado para Vercel Free (60s)
  TIMEOUT: 30000  // 30 segundos
};

/**
 * Função principal que consulta o bachillerato usando Puppeteer
 * @param {string} bachillerato - Número de documento do estudante
 * @param {string} fechaNacimiento - Data de nascimento (DD/MM/AAAA) - OPCIONAL
 * @returns {Object} Resultado da consulta com status e PDF se validado
 */
async function consultarBachilleratoMEC(bachillerato, fechaNacimiento = '') {
  let browser = null;
  
  try {
    console.log('🌐 Abrindo navegador...');
    
    // DEBUG: Mude para false para ver o navegador em ação
    const DEBUG_MODE = process.env.DEBUG_PUPPETEER === 'true';
    
    // Inicia o Puppeteer com configurações otimizadas para velocidade
    browser = await puppeteer.launch({
      headless: DEBUG_MODE ? false : 'new',
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
        '--single-process',
        '--disable-accelerated-2d-canvas',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-breakpad',
        '--disable-backing-store-limit',
        '--disable-ipc-flooding-protection',
        '--renderer-process-limit=1',
        '--js-flags="--max-old-space-size=256"'
      ],
      slowMo: DEBUG_MODE ? 100 : 0
    });

    const page = await browser.newPage();
    
    // Configurações da página
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Desabilitar imagens e CSS para carregar mais rápido
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if(['image', 'stylesheet', 'font'].includes(req.resourceType())){
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`🔗 Acessando: ${CONFIG.URL}`);
    await page.goto(CONFIG.URL, { 
      waitUntil: 'networkidle0',  // Aguarda rede ficar ociosa (0 conexões)
      timeout: CONFIG.TIMEOUT 
    });

    console.log('✍️ Preenchendo campos do formulário...');
    
    // Espera o campo de documento aparecer
    await page.waitForSelector(CONFIG.INPUT_SELECTOR, { timeout: CONFIG.TIMEOUT });
    
    // Limpa o campo e digita o número do documento
    await page.click(CONFIG.INPUT_SELECTOR, { clickCount: 3 }); // Seleciona tudo
    await page.type(CONFIG.INPUT_SELECTOR, bachillerato);

    // Se houver data de nascimento, preenche também
    if (fechaNacimiento && fechaNacimiento.trim() !== '') {
      console.log('📅 Preenchendo data de nascimento...');
      await page.waitForSelector(CONFIG.INPUT_DATE_SELECTOR, { timeout: CONFIG.TIMEOUT });
      await page.click(CONFIG.INPUT_DATE_SELECTOR, { clickCount: 3 });
      await page.type(CONFIG.INPUT_DATE_SELECTOR, fechaNacimiento);
      
      // Pressiona Enter para disparar a busca (alguns sites precisam disso)
      await page.keyboard.press('Enter');
      console.log('⌨️ Enter pressionado após preencher data');
    } else {
      // Se não tem data, pressiona Enter no campo do documento
      await page.click(CONFIG.INPUT_SELECTOR);
      await page.keyboard.press('Enter');
      console.log('⌨️ Enter pressionado após preencher documento');
    }

    // IMPORTANTE: Este site carrega automaticamente após Enter
    console.log('⏳ Aguardando resultado...');
    
    // Espera aparecer resultado (sucesso OU erro)
    try {
      await Promise.race([
        page.waitForSelector(CONFIG.RESULT_SELECTOR, { timeout: 8000, visible: true }),
        page.waitForSelector(CONFIG.ERROR_SELECTOR, { timeout: 8000, visible: true }),
        page.waitForSelector('.panel', { timeout: 8000, visible: true })
      ]);
      console.log('✅ Resultado encontrado!');
    } catch (err) {
      // Tenta pegar o HTML da página para debug
      const pageHTML = await page.evaluate(() => document.body.innerText);
      console.log('📄 Texto da página:', pageHTML.substring(0, 1000));
      
      throw new Error('Nenhum resultado apareceu após preencher os campos. Verifique os dados informados.');
    }

    // Tenta extrair o texto do resultado (sucesso ou erro)
    let resultadoTexto = '';
    
    // Primeiro tenta encontrar o painel de sucesso
    const successPanel = await page.$('.panel.panel-success, .panel-success');
    
    if (successPanel) {
      resultadoTexto = await page.evaluate(el => el.innerText, successPanel);
      console.log('📄 Resultado (SUCESSO) extraído:', resultadoTexto.substring(0, 200));
    } else {
      // Se não tem painel de sucesso, procura painel de erro
      const errorPanel = await page.$('.panel.panel-danger, .panel-danger, .alert-danger');
      
      if (errorPanel) {
        resultadoTexto = await page.evaluate(el => el.innerText, errorPanel);
        console.log('📄 Resultado (ERRO/AVISO) extraído:', resultadoTexto.substring(0, 200));
      } else {
        // Se não encontrou painéis específicos, pega qualquer div com classe panel
        const anyPanel = await page.$('.panel');
        
        if (anyPanel) {
          resultadoTexto = await page.evaluate(el => el.innerText, anyPanel);
          console.log('📄 Resultado (PAINEL GENÉRICO) extraído:', resultadoTexto.substring(0, 200));
        } else {
          // Última tentativa: pega o texto do corpo da página
          resultadoTexto = await page.evaluate(() => {
            // Procura por texto que contenha "egresado" ou "Datos"
            const body = document.body.innerText;
            if (body.includes('egresado') || body.includes('Datos del Egresado')) {
              return body;
            }
              return 'O documento submetido não está registrado no sistema de gestão acadêmica do MEC.';
          });
          console.log('📄 Resultado (BODY) extraído:', resultadoTexto.substring(0, 200));
        }
      }
    }

    // Verifica se está validado
    const isValidado = CONFIG.VALIDADO_KEYWORDS.some(keyword => 
      resultadoTexto.toUpperCase().includes(keyword.toUpperCase())
    );

    const status = isValidado ? 'VALIDADO' : 'NAO_VALIDADO';
    console.log(isValidado ? '✅ Bachillerato validado!' : '❌ Bachillerato não validado');

    // Captura o HTML completo da página para gerar PDF depois (sem nova navegação)
    const htmlCompleto = await page.content();
    console.log('💾 HTML capturado para PDF futuro');

    // Fecha o navegador
    await browser.close();

    // Se não validado, força mensagem personalizada
    let mensagemFinal = resultadoTexto.trim();
    if (!isValidado) {
      mensagemFinal = 'O documento submetido não está registrado no sistema de gestão acadêmica do MEC.';
    }

    // Retorna o resultado SEM PDF (PDF gerado em rota separada)
    return {
      status,
      mensagem: mensagemFinal,
      bachillerato,
      timestamp: new Date().toISOString(),
      htmlCompleto  // HTML para gerar PDF rapidamente depois
    };

  } catch (error) {
    console.error('❌ Erro no Puppeteer:', error);
    
    // Fecha o navegador em caso de erro
    if (browser) {
      await browser.close();
    }

    // Lança o erro com mais contexto
    throw new Error(`Falha na automação: ${error.message}`);
  }
}

module.exports = {
  consultarBachilleratoMEC
};
