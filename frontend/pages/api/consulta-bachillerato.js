// API Route Proxy para evitar Mixed Content
// Faz proxy das requisições HTTPS do frontend para HTTP do backend

export default async function handler(req, res) {
  // Apenas aceitar método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

  console.log('Proxy: Conectando ao backend:', BACKEND_URL);

  try {
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

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : { message: await response.text() };

    if (!response.ok) {
      return res.status(response.status).json({
        status: 'ERROR',
        error: 'Erro ao consultar o backend',
        message: data?.message || data?.error || 'Falha ao consultar o MEC',
        details: data
      });
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro no proxy:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        status: 'ERROR',
        error: 'Timeout ao consultar bachillerato',
        message: 'A consulta demorou muito tempo. Tente novamente.'
      });
    }

    return res.status(500).json({
      status: 'ERROR',
      error: 'Erro ao conectar com o backend',
      message: error.message,
      details: error.toString()
    });
  }
}
