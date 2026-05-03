# ⚡ Flash Sale Order Simulator

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=flat&logo=node.js&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat&logo=mysql&logoColor=white)
![Jenkins](https://img.shields.io/badge/Jenkins-CI%2FCD-D24939?style=flat&logo=jenkins&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-Load%20Balancer-009639?style=flat&logo=nginx&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)

> A production-style DevOps demo that simulates 500 concurrent users hitting a flash sale at the same time — and shows exactly how a distributed system handles it in real time.

---

## 📖 Overview

Flash Sale Order Simulator is a **hands-on DevOps demonstration project** built to show how real e-commerce systems handle massive traffic spikes. When a flash sale starts, 500 simultaneous HTTP requests fire from the browser. The system processes them through a load-balanced API layer, buffers them in a Redis queue, and drains them steadily into MySQL — all while a live dashboard shows every moving part without opening a terminal.

### Why this project exists

Most DevOps tutorials show you individual tools in isolation. This project shows them **working together under real load**:

- You can *see* load balancing happen — three different pod names appear in the request log
- You can *see* queue buffering — Redis depth spikes to 400+ then drains to 0
- You can *see* database writes smoothing out — steady inserts instead of a 500-row spike
- You can *see* the CI/CD pipeline that deployed it all — one git push triggers everything

It is designed to be demoed live to an audience with multiple browser tabs open simultaneously.

---

## ✨ Features

### Application

- ⚡ Simulates 500 concurrent order requests with one button click
- 🛒 Amazon-style product page UI (Sony WH-1000XM5 flash sale)
- 📊 Built-in live dashboard — Redis queue depth, MySQL row count, Docker container status, system flow diagram — all auto-updating every 1.5 seconds
- 📋 Live request log with pod name per entry — visually proves load balancing
- 🔄 Auto-scrolling log with pause/resume toggle
- 🔗 One-click buttons to open Redis Commander, phpMyAdmin, Jenkins, API health

### Backend

- `POST /order` — receives orders and pushes to Redis queue instantly
- `GET /stats` — returns Redis depth + MySQL counts + Docker container list in one call
- `GET /logs` — returns rolling in-memory API logs
- `GET /health` — pod name + timestamp for health checks

### Infrastructure

- 🐳 **Docker Compose** — entire stack starts with one command
- ⚖️ **Nginx load balancer** — distributes requests across 3 API replicas
- 🗄️ **Redis queue** — absorbs traffic spikes, decouples API from database
- 👷 **Competing consumers** — 2 worker pods race to drain the queue
- 💾 **MySQL persistence** — data survives container restarts via Docker volume
- 🔁 **Jenkins CI/CD** — 6-stage pipeline triggered by git push
- 📡 **Docker socket API** — frontend shows live container status without any terminal

### Monitoring (all browser-based, no terminal)

- Redis Commander at `:8081`
- phpMyAdmin at `:8082`
- Jenkins pipeline at `:8090`
- Live frontend dashboard at `:8080`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML, CSS, JavaScript (Vanilla) — served by Nginx |
| **API** | Node.js 18, Express, CORS |
| **Queue** | Redis 7 |
| **Database** | MySQL 8.0 |
| **Worker** | Node.js 18 (redis + mysql2) |
| **Load Balancer** | Nginx Alpine |
| **Containerisation** | Docker, Docker Compose |
| **CI/CD** | Jenkins LTS (Docker container) |
| **Version Control** | Git + GitHub |
| **OS** | Ubuntu (WSL2 on Windows) |

---

## 📁 Directory Structure

```
flash-sale/
├── Jenkinsfile                  ← 6-stage CI/CD pipeline
├── docker-compose.yml           ← All 9 services wired together
├── nginx-lb.conf                ← Nginx upstream load balancer config
├── setup-jenkins.ps1            ← One-click Jenkins setup (Windows/WSL)
│
├── frontend/
│   ├── index.html               ← Full UI + live dashboard (single file)
│   ├── Dockerfile               ← nginx:alpine serving static HTML
│   └── nginx.conf               ← CORS-enabled nginx config
│
├── order-api/
│   ├── server.js                ← Express API: /order /stats /logs /health
│   ├── package.json             ← express, redis, cors, mysql2
│   └── Dockerfile               ← node:18-alpine
│
├── worker/
│   ├── worker.js                ← BLPOP from Redis → INSERT into MySQL
│   ├── package.json             ← redis, mysql2
│   └── Dockerfile               ← node:18-alpine
│
├── nginx/
│   ├── Dockerfile               ← Builds nginx with config baked in
│   └── nginx-lb.conf            ← Upstream config for 3 API containers
│
├── jenkins/
│   ├── Dockerfile               ← Jenkins LTS + Docker CLI + kubectl
│   └── plugins.txt              ← Pre-installed plugins list
│
└── k8s/                         ← Kubernetes manifests (optional path)
    ├── configmap.yaml
    ├── redis.yaml
    ├── mysql.yaml
    ├── order-api.yaml
    ├── worker.yaml
    └── frontend.yaml
```

---

## 🖥️ Setup Guide

### Prerequisites — what you need installed once

| Tool | Purpose | Required |
|---|---|---|
| Windows 10/11 | Host OS | ✅ |
| WSL2 (Ubuntu) | Linux environment on Windows | ✅ |
| Docker Desktop | Container runtime | ✅ |
| Git | Version control | ✅ |
| VS Code | Editor (recommended) | Optional |

---

### Step 1 · Install WSL2

WSL2 gives you a real Ubuntu Linux terminal on Windows. Docker Desktop uses it as its backend.

```powershell
# Run PowerShell AS ADMINISTRATOR
wsl --install
```

Restart Windows when prompted. After restart, Ubuntu will finish installing and ask you to create a Linux username and password.

> **Verify:** Open Start menu → search `Ubuntu` → should open a terminal showing `username@DESKTOP:~$`

---

### Step 2 · Install Docker Desktop

1. Download from <https://www.docker.com/products/docker-desktop/>
2. Install and launch Docker Desktop
3. Go to **Settings → Resources → WSL Integration** → toggle on your Ubuntu distro
4. Go to **Settings → Resources → Advanced** → set Memory: **6 GB**, CPUs: **3**
5. Click **Apply & Restart**

```bash
# Verify in your Ubuntu (WSL) terminal
docker version
# Must show both Client and Server versions — no errors
```

---

### Step 3 · Install Git in WSL

```bash
# In your Ubuntu (WSL) terminal
sudo apt update && sudo apt install -y git

git --version
# git version 2.x.x
```

Configure your identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

---

### Step 4 · Clone the repository

```bash
# In your Ubuntu (WSL) terminal
cd ~
git clone https://github.com/piyushr6/flash-sale-simulator.git
cd flash-sale-simulator
ls
# Should show: Jenkinsfile  docker-compose.yml  frontend/  order-api/  worker/  ...
```

---

### Step 5 · Set up Jenkins

Jenkins runs as a Docker container. Run this once:

```bash
# In your Ubuntu (WSL) terminal — from the project folder
docker run -d \
  --name jenkins \
  --restart unless-stopped \
  -p 8090:8080 \
  -p 50000:50000 \
  -v jenkins-data:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts-jdk17
```

Install Docker CLI inside Jenkins (run once):

```bash
docker exec -it --user root jenkins bash
# Inside the container:
apt-get update -y && apt-get install -y docker.io curl
chmod 666 /var/run/docker.sock
exit
```

Install Docker Compose inside Jenkins (run once):

```bash
docker exec -it --user root jenkins bash
# Inside the container:
curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker-compose version
exit
```

Verify both work inside Jenkins:

```bash
docker exec jenkins docker version        # must show version
docker exec jenkins docker-compose version # must show version
```

---

### Step 6 · Log in to Jenkins

```bash
# Get your admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open **<http://localhost:8090>** in your browser. Paste the password. Click **Install suggested plugins**. Create your admin account.

---

### Step 7 · Add GitHub credentials to Jenkins

1. Open <http://localhost:8090> → **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**
2. Fill in:
   - Kind: `Username with password`
   - Username: your GitHub username
   - Password: your GitHub Personal Access Token (from <https://github.com/settings/tokens> — needs `repo` scope)
   - ID: `github-creds`
3. Click **Save**

---

### Step 8 · Create the pipeline job

1. Click **New Item** → name: `flash-sale-pipeline` → select **Pipeline** → OK
2. Under **Build Triggers** → tick **Poll SCM** → schedule: `H/2 * * * *`
3. Under **Pipeline**:
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: `https://github.com/piyushr6/flash-sale-simulator.git`
   - Credentials: `github-creds`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Click **Save**

---

## 🚀 Running the Project

### Terminal rule — always use WSL

Every command in this project runs from the **Ubuntu (WSL) terminal**, not Windows PowerShell.

| ✅ Correct | ❌ Wrong |
|---|---|
| `piyush@DESKTOP:~/flash-sale$` | `PS C:\Users\Piyush>` |

Open Ubuntu from Start menu or open it in VS Code: `Ctrl+Shift+P` → **Terminal: Select Default Profile** → **Ubuntu**.

---

### Start everything

**Terminal 1 — start Jenkins (if not already running):**

```bash
docker start jenkins
# Wait 15 seconds
docker ps | grep jenkins   # should show Up
```

**Terminal 1 — start the flash sale stack:**

```bash
cd ~/flash-sale-simulator
docker-compose up --scale order-api=3 --scale worker=2
```

Leave this terminal running — it shows live container logs. Wait for this line before opening browser tabs:

```
worker-1  | [WORKER] ✅ Table "orders" ready
```

This confirms MySQL, Redis, and the workers are all connected and ready.

---

### Open browser tabs

Open all of these **before** starting your demo:

| Tab | URL | What you see |
|-----|-----|--------------|
| **1 · Main demo** | <http://localhost:8080> | Product page, countdown, dashboard |
| **2 · Redis UI** | <http://localhost:8081> | Queue depth live |
| **3 · phpMyAdmin** | <http://localhost:8082> | Orders table live |
| **4 · API Health** | <http://localhost:3000/health> | Pod name JSON |
| **5 · Jenkins** | <http://localhost:8090> | CI/CD pipeline |

> **phpMyAdmin tip:** Log in → click `flashsale` → click `orders` → click **Browse**. Leave it here so you can hit **F5** to refresh rows during the demo.

---

### Verify everything is working

Open a second WSL terminal and run:

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","pod":"...","time":"..."}
```

If that returns — you're ready.

---

### Run the demo

1. Switch to Tab 1 (<http://localhost:8080>)
2. Watch the 10-second countdown
3. When the orange **"Simulate 500 Orders Now"** button appears — click it
4. Watch all panels update live

---

### Stop everything

```bash
# Stop the flash sale stack (keep MySQL data)
docker-compose down

# Stop Jenkins
docker stop jenkins

# Verify nothing running
docker ps
```

---

### Stop and wipe all data (clean slate)

```bash
docker-compose down -v    # -v removes MySQL volume
docker stop jenkins
docker ps                 # should be empty
```

---

### Reset between demo runs (without restarting)

```bash
# Clear the orders table
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale -e "TRUNCATE TABLE orders;"

# Clear the Redis queue
docker exec flash-redis redis-cli del orders
```

Then reload <http://localhost:8080> — the countdown resets automatically.

---

## 🔁 CI/CD Pipeline

Every `git push` to the `main` branch automatically triggers the Jenkins pipeline.

### Pipeline stages

| Stage | What happens |
|---|---|
| **1 · Git Pull** | Jenkins checks out latest code, prints branch and commit |
| **2 · Build Containers** | `docker-compose build` for order-api, worker, frontend, nginx |
| **3 · Stop Old Stack** | `docker-compose down` — clean shutdown of previous containers |
| **4 · Start New Stack** | `docker-compose up -d` with 3 API replicas + 2 workers |
| **5 · Health Check** | Verifies Redis ping, MySQL ping, and API pod response |
| **6 · Success** | Prints all access URLs in a summary box |

### Trigger a deployment

```bash
# Make any change, then:
cd ~/flash-sale-simulator
git add .
git commit -m "your change description"
git push origin main
# Jenkins picks it up within 2 minutes and runs all 6 stages
```

### View pipeline in Jenkins

Open <http://localhost:8090> → `flash-sale-pipeline` → click the latest build number → **Console Output** to watch it live.

---

## 🎬 Demo Script

### What to say at each step

**[Countdown running — 10 to 0]**
> "We're simulating a flash sale. 500 users are about to try to buy a product simultaneously. Behind this page: 3 API pods behind a load balancer, a Redis queue, 2 worker pods, and a MySQL database — all running in Docker containers on this machine."

**[Click the button]**
> "500 HTTP POST requests are firing right now — simultaneously from the browser."

**[Point to Live Request Log]**
> "Every line is one API response. Notice the pod name column — three different names rotating. That's load balancing. Kubernetes distributes requests round-robin across all 3 pods automatically."

**[Point to Redis Queue gauge]**
> "The queue depth jumped to 400+ instantly. The API doesn't write to MySQL — it pushes to Redis and returns in ~1ms. Redis absorbed the entire spike."

**[Switch to Redis Commander tab]**
> "The `orders` list in Redis. It filled up fast and is now draining as the workers process it."

**[Back to frontend — point to MySQL panel]**
> "MySQL row count — updating every 1.5 seconds, no terminal. The workers are inserting steadily. The table shows how many orders each API pod handled — load is distributed evenly."

**[Switch to phpMyAdmin — press F5]**
> "Actual rows in the database. Each row has the product, timestamp, which API pod received it, and which worker inserted it. Full traceability."

**[Switch to Jenkins]**
> "This pipeline deployed everything you just saw. One git push — Jenkins built the images, stopped the old containers, started new ones, ran health checks, and printed the URLs. Zero manual steps. That's CI/CD."

---

## 🏗️ Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                     CI/CD Pipeline                          │
  │   git push → Jenkins :8090 → docker build → compose up     │
  └─────────────────────────────────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                  Docker Compose Stack                       │
  │                                                             │
  │  Browser ──→ flash-frontend :8080 (nginx static)           │
  │                    │                                        │
  │             flash-nginx :3000 (load balancer)               │
  │          ┌──────────┼──────────┐                           │
  │     api-1:3000  api-2:3000  api-3:3000   ← 3 replicas      │
  │          └──────────┼──────────┘                           │
  │                     │  rPush("orders")                      │
  │              flash-redis :6379                              │
  │              List: "orders"                                 │
  │                     │  BLPOP                                │
  │          ┌──────────┴──────────┐                           │
  │      worker-1              worker-2   ← 2 replicas          │
  │          └──────────┬──────────┘                           │
  │                     │  INSERT                               │
  │              flash-mysql :3306                              │
  │              flashsale.orders                               │
  │                                                             │
  │  Monitoring:                                                │
  │    flash-redis-ui  :8081  (Redis Commander)                 │
  │    flash-phpmyadmin :8082 (phpMyAdmin)                      │
  │    jenkins          :8090 (CI/CD)                           │
  └─────────────────────────────────────────────────────────────┘
```

### DevOps concepts demonstrated

| Concept | Where you see it |
|---|---|
| **Containerisation** | Every service runs in its own Docker container |
| **Load Balancing** | 3 API pod names rotating in the request log |
| **Queue Buffering** | Redis absorbs 500 requests, releases them steadily |
| **Competing Consumers** | 2 workers race to drain the same Redis queue |
| **DB Write Smoothing** | MySQL gets controlled inserts, not a simultaneous spike |
| **Service Discovery** | Containers communicate by name (`redis`, `mysql`, `order-api`) |
| **Health Checks** | Docker healthcheck on MySQL, Redis, and API containers |
| **CI/CD Pipeline** | Jenkins 6-stage pipeline on every git push |
| **Infrastructure as Code** | Everything reproducible from `docker-compose.yml` + `Jenkinsfile` |
| **Observability** | Live dashboard, Redis UI, phpMyAdmin — no terminal needed |

---

## 🧰 Useful Commands

### Daily workflow

```bash
# Start everything
cd ~/flash-sale-simulator
docker start jenkins
docker-compose up --scale order-api=3 --scale worker=2

# Stop everything (keep data)
docker-compose down && docker stop jenkins

# Stop and wipe data
docker-compose down -v && docker stop jenkins
```

### Checking status

```bash
docker-compose ps                    # all container states
docker-compose logs -f order-api     # API logs live
docker-compose logs -f worker        # worker logs live
docker ps                            # all running containers
```

### Database

```bash
# Count total orders
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale \
  -e "SELECT COUNT(*) FROM orders;"

# Orders per API pod (proves load balancing)
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale \
  -e "SELECT server, COUNT(*) total FROM orders GROUP BY server ORDER BY total DESC;"

# Orders per worker
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale \
  -e "SELECT worker, COUNT(*) total FROM orders GROUP BY worker;"

# Wipe all orders
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale \
  -e "TRUNCATE TABLE orders;"
```

### Redis

```bash
docker exec flash-redis redis-cli llen orders    # queue depth
docker exec flash-redis redis-cli del orders     # clear queue
docker exec -it flash-redis redis-cli            # interactive shell
```

### Jenkins

```bash
docker start jenkins                             # start Jenkins
docker stop jenkins                              # stop Jenkins
docker restart jenkins                           # restart Jenkins
docker logs jenkins                              # Jenkins startup logs
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

---

## 🔧 Troubleshooting

### "fatal: detected dubious ownership" when running git

You are in the wrong terminal — Windows PowerShell instead of WSL.

**Fix:** Open Ubuntu from the Start menu. Run all commands from the WSL terminal where the prompt shows `username@DESKTOP:~$`

---

### MySQL takes too long to start / worker keeps restarting

MySQL takes 30–45 seconds on first run. Workers auto-retry with a delay — this resolves itself.

```bash
docker-compose logs worker
# Wait until you see:  ✅ Table "orders" ready
```

---

### All 500 requests fail with network error

The API is not reachable. Check:

```bash
docker-compose ps                        # all containers running?
curl http://localhost:3000/health        # API responding?
docker-compose logs nginx                # nginx errors?
```

---

### Redis Commander shows blank page

```bash
docker-compose restart redis-commander
```

---

### phpMyAdmin shows "cannot connect to MySQL"

MySQL is still initialising. Wait 30 seconds and refresh.

---

### Docker Containers panel shows "Docker socket not available"

The Docker socket must be mounted into the API container. Check `docker-compose.yml` has this under `order-api`:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Restart after fixing:

```bash
docker-compose up -d --no-build
```

---

### Jenkins pipeline fails at health check

The stack is almost certainly running fine. Check manually:

```bash
curl http://localhost:3000/health
docker-compose ps
```

If the stack is up and the API responds — trigger a new build in Jenkins. The health check verifies containers directly.

---

### Jenkins cannot connect to Docker (permission denied)

```bash
# Fix socket permissions inside Jenkins
docker exec -it --user root jenkins bash
chmod 666 /var/run/docker.sock
exit
```

---

### Port already in use on startup

```bash
# Find what is using a port (example: 3000)
sudo lsof -i :3000

# Kill it or change the port in docker-compose.yml
```

---

### Full reset — completely clean start

```bash
docker-compose down -v                    # stop stack + wipe volumes
docker stop jenkins                       # stop Jenkins
docker ps                                 # verify empty
cd ~/flash-sale-simulator
docker-compose up --scale order-api=3 --scale worker=2
```

---

## 🌱 Environment Variables

All environment variables are set directly in `docker-compose.yml`. For reference:

```env
# MySQL
MYSQL_ROOT_PASSWORD=rootpass
MYSQL_DATABASE=flashsale
MYSQL_USER=flashuser
MYSQL_PASSWORD=flashpass

# Redis
REDIS_URL=redis://redis:6379

# Order API
PORT=3000
MYSQL_HOST=mysql
MYSQL_USER=flashuser
MYSQL_PASS=flashpass
MYSQL_DB=flashsale

# Worker
MYSQL_PORT=3306
```

No `.env` file is required. Everything is wired through Docker Compose service names.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test with `docker-compose up --scale order-api=3 --scale worker=2`
5. Commit: `git commit -m "Add your feature"`
6. Push: `git push origin feature/your-feature`
7. Open a Pull Request

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 👤 Author

**Piyush** — [@piyushr6](https://github.com/piyushr6)

Built as a live DevOps demonstration project showcasing containerisation, message queues, load balancing, and CI/CD pipelines in a realistic e-commerce scenario.
