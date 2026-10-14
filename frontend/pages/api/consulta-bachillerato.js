// API Route Proxy para evitar Mixed Content
// Faz proxy das requisições HTTPS do frontend para HTTP do backend

export default async function handler(req, res) {
  // Apenas aceitar método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Backend Oracle Cloud (IP fixo como fallback)
  const BACKEND_URL = process.env.BACKEND_URL || 'http://72.60.138.94:5000';
  
  console.log('Proxy: Conectando ao backend:', BACKEND_URL);

  try {
    // Fazer requisição ao backend Oracle Cloud com timeout de 55 segundos
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(`${BACKEND_URL}/api/consulta-bachillerato`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();

    // Retornar a resposta do backend
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro no proxy:', error);
    
    if (error.name === 'AbortError') {
      return res.status(504).json({ 
        error: 'Timeout ao consultar bachillerato',
        message: 'A consulta demorou muito tempo. Tente novamente.'
      });
    }
    
    res.status(500).json({ 
      error: 'Erro ao conectar com o backend',
      message: error.message,
      details: error.toString()
    });
  }
}
