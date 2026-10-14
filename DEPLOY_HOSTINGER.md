# 🚀 Deploy Hostinger VPS

## 1️⃣ Conectar ao VPS

```bash
ssh ssh root@72.60.138.94
```

## 2️⃣ Instalar Dependências

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Instalar Chromium (para Puppeteer)
apt install -y chromium-browser

# Instalar PM2
npm install -g pm2

# Instalar Git
apt install -y git
```

## 3️⃣ Clonar Repositório

```bash
cd /var/www
git clone https://github.com/DevFalcon22/Zion-Assessoria.git
cd Zion-Assessoria/backend
```

## 4️⃣ Configurar Ambiente

```bash
# Instalar dependências
npm install

# Criar .env
cat > .env << 'EOF'
PORT=5000
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EOF
```

## 5️⃣ Iniciar com PM2

```bash
pm2 start src/server.js --name zion-backend
pm2 save
pm2 startup
```

## 6️⃣ Nginx (Proxy Reverso)

```bash
apt install -y nginx

cat > /etc/nginx/sites-available/zion << 'EOF'
server {
    listen 80;
    server_name 72.60.138.94;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeout para Puppeteer
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
EOF

ln -s /etc/nginx/sites-available/zion /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 7️⃣ SSL (Opcional - Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d zionassessoria.cloud
```

## 8️⃣ Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 9️⃣ Atualizar Frontend (Vercel)

No arquivo `frontend/pages/api/consulta-bachillerato.js`:

```javascript
const BACKEND_URL = process.env.BACKEND_URL || 'http://SEU_IP_HOSTINGER';
```

Fazer push e deploy automático no Vercel.

## ✅ Verificar

```bash
pm2 status
pm2 logs zion-backend
curl http://localhost:5000
```

---

**Vantagens Hostinger VPS:**
- ✅ 2GB+ RAM (Puppeteer funciona perfeitamente)
- ✅ CPU dedicada (mais rápido)
- ✅ SSD NVMe (I/O rápido)
- ✅ Sem timeout de 60s (diferente do Vercel)
- ✅ Custo fixo mensal
