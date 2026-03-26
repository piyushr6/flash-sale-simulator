# ⚡ Flash Sale Order Simulator

### DevOps Demo — Docker · Kubernetes · Redis · MySQL · Jenkins CI/CD

```
GitHub → Jenkins → Docker Build → Kubernetes Deploy
Browser → Order API (×3 pods) → Redis Queue → Worker (×2 pods) → MySQL
```

---

## 📁 Project Structure

```
flash-sale/
├── Jenkinsfile                ← CI/CD pipeline (6 stages)
├── docker-compose.yml         ← All services wired together
├── nginx-lb.conf              ← Nginx load balancer for API pods
├── setup-jenkins.ps1          ← One-click Jenkins setup for Windows
│
├── frontend/
│   ├── index.html             ← Amazon-style UI + built-in live dashboard
│   ├── Dockerfile
│   └── nginx.conf
│
├── order-api/
│   ├── server.js              ← POST /order + /stats + /logs endpoints
│   ├── package.json
│   └── Dockerfile
│
├── worker/
│   ├── worker.js              ← Redis BLPOP → MySQL INSERT
│   ├── package.json
│   └── Dockerfile
│
├── k8s/
│   ├── configmap.yaml
│   ├── redis.yaml             ← Redis + Redis Commander
│   ├── mysql.yaml             ← MySQL + Secret + PVC + phpMyAdmin
│   ├── order-api.yaml         ← 3 replicas + NodePort :30000
│   ├── worker.yaml            ← 2 replicas
│   └── frontend.yaml          ← NodePort :30080
│
└── jenkins/
    ├── Dockerfile             ← Jenkins LTS + Docker CLI + kubectl
    └── plugins.txt            ← Pre-installed plugins
```

---

## 🖥️ PART 1 — One-Time Machine Setup (Windows + PowerShell)

Do these once. Skip anything already installed.

---

### Step 1 · Install WSL2

**Why?** Docker Desktop on Windows needs WSL2 as its Linux kernel. Without it, Linux containers cannot run.

```powershell
# Run PowerShell AS ADMINISTRATOR
wsl --install
# Restart Windows when prompted
```

---

### Step 2 · Install Docker Desktop

**Why?** Docker Desktop is the container runtime that everything depends on.

1. Download: https://www.docker.com/products/docker-desktop/
2. Install and open Docker Desktop
3. **Settings → Resources → WSL Integration** → enable your WSL2 distro
4. **Settings → Resources → Advanced** → Memory: **6 GB**, CPUs: **3**
5. Click **Apply & Restart**

```powershell
# Verify — must show both Client and Server, no errors
docker version
```

---

### Step 3 · Install Chocolatey

**Why?** Chocolatey is the Windows package manager for installing kubectl and minikube.

```powershell
# Run PowerShell AS ADMINISTRATOR
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Close and reopen PowerShell after this completes
```

---

### Step 4 · Install kubectl

**Why?** `kubectl` is the CLI to deploy apps, watch pods, and stream logs from Kubernetes.

```powershell
choco install kubernetes-cli -y
kubectl version --client
```

---

### Step 5 · Install Minikube

**Why?** Minikube runs a single-node Kubernetes cluster locally inside Docker Desktop. No cloud needed.

```powershell
choco install minikube -y
```

---

### Step 6 · Start Minikube

```powershell
minikube start --driver=docker --cpus=3 --memory=5500mb
# Success message: Done! kubectl is now configured to use "minikube"
```

---

### Step 7 · Verify everything works

```powershell
docker --version
# Docker version 26.x.x

kubectl get nodes
# NAME       STATUS   ROLES           AGE
# minikube   Ready    control-plane   ...

minikube status
# minikube: Running  /  kubelet: Running  /  apiserver: Running
```

All three must succeed before continuing.

---

## 🐳 PART 2 — Run with Docker Compose (Recommended for Demo)

This is the easiest path. One command starts everything.

### The only command you need

```powershell
cd flash-sale
docker compose up --build --scale order-api=3 --scale worker=2
```

Wait about **30 seconds** for MySQL to initialise. You will see this line when everything is ready:

```
flash-worker-1  | [WORKER][worker-1] ✅ Table "orders" ready
```

---

### Browser tabs to open

Open each in a **separate browser tab**. No terminal commands needed to monitor anything.

| Tab                | URL                          | What you see                                 |
| ------------------ | ---------------------------- | -------------------------------------------- |
| **1 · Frontend**   | http://localhost:8080        | Countdown → button → full live dashboard     |
| **2 · Redis UI**   | http://localhost:8081        | `orders` queue filling and draining live     |
| **3 · phpMyAdmin** | http://localhost:8082        | Rows appearing in real time                  |
| **4 · API Health** | http://localhost:3000/health | Pod name + timestamp JSON                    |
| **5 · API Stats**  | http://localhost:3000/stats  | Full JSON: queue depth, DB count, containers |
| **6 · Jenkins**    | http://localhost:8090        | CI/CD pipeline (after Jenkins setup)         |

> **Tip for presentations:** Open all 6 tabs before the audience arrives. Use Tab 1 as your main screen. Switch to Tabs 2 and 3 during the demo to show the queue and database updating in real time.

---

### What the frontend dashboard shows automatically (no terminal)

The frontend polls the API every **1.5 seconds** and updates all panels on its own:

| Panel               | Updates             | Shows                                     |
| ------------------- | ------------------- | ----------------------------------------- |
| Live Request Log    | Instant per request | Pod name + message per order              |
| Pods Seen           | Instant             | All 3 pod names as they respond           |
| Redis Queue gauge   | Every 1.5 sec       | Current queue depth + bar                 |
| MySQL table         | Every 1.5 sec       | Total rows + count per API pod            |
| Docker Containers   | Every 1.5 sec       | All `flash-*` containers + running status |
| System Flow diagram | Instant             | Animates as each pipeline stage activates |

---

### Stop everything

```powershell
# Stop all containers
docker compose down

# Stop AND wipe MySQL data (clean reset for next demo)
docker compose down -v
```

---

## ☸️ PART 3 — Run with Kubernetes (Full K8s Demo)

Use this to demonstrate Kubernetes-specific features: pod scheduling, self-healing, rolling updates.

### Step 1 · Point Docker at Minikube's daemon

**Why?** Minikube has its own internal Docker daemon. You must build images inside it, otherwise Kubernetes cannot find them.

```powershell
minikube docker-env | Invoke-Expression
```

> ⚠️ Run this in **every new PowerShell terminal** that will run `docker build`. It resets when you close the terminal.

Verify it worked:

```powershell
docker info | Select-String "Name"
# Must show:  Name: minikube
```

### Step 2 · Set the API URL in the frontend

```powershell
minikube ip
# Example: 192.168.49.2
```

Open `frontend/index.html` and find this line near the bottom:

```js
const API_URL = window.API_URL || "http://localhost:3000";
```

Change it to your Minikube IP:

```js
const API_URL = window.API_URL || "http://192.168.49.2:30000";
```

### Step 3 · Build all images

```powershell
docker build -t order-api:latest ./order-api
docker build -t worker:latest    ./worker
docker build -t frontend:latest  ./frontend
```

### Step 4 · Deploy to Kubernetes

```powershell
kubectl apply -f k8s/
kubectl get pods -w
```

Wait until every pod shows `1/1 Running`. MySQL is slowest (~40 sec).

### Step 5 · Open browser tabs (Kubernetes URLs)

```powershell
minikube ip
# Use that IP below — example uses 192.168.49.2
```

| Tab                | URL                        | What you see        |
| ------------------ | -------------------------- | ------------------- |
| **1 · Frontend**   | http://\<IP\>:30080        | Full live dashboard |
| **2 · Redis UI**   | http://\<IP\>:30081        | Queue live          |
| **3 · phpMyAdmin** | http://\<IP\>:30082        | DB rows live        |
| **4 · API Health** | http://\<IP\>:30000/health | Pod name JSON       |
| **5 · Jenkins**    | http://localhost:8090      | CI/CD pipeline      |

Or use `minikube service` to auto-open:

```powershell
minikube service frontend-service
minikube service redis-commander-service
minikube service phpmyadmin-service
```

---

## 🔧 PART 4 — Jenkins CI/CD Setup

Automates: **code change → build → deploy → smoke test**

### Step 1 · Run the setup script

```powershell
cd flash-sale
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup-jenkins.ps1
```

This builds a custom Jenkins image (Docker CLI + kubectl pre-installed), starts it on port **8090**, and prints the admin password. Takes 3–5 minutes on first run.

### Step 2 · Log in

Open: http://localhost:8090

```powershell
# Get the admin password
docker exec jenkins-flash cat /var/jenkins_home/secrets/initialAdminPassword
```

Click **"Install suggested plugins"** when prompted.

### Step 3 · Verify Docker and kubectl work inside Jenkins

```powershell
docker exec -it jenkins-flash bash
# Inside the container:
docker version        # must show a version, no error
kubectl get nodes     # must show minikube   Ready
exit
```

If `kubectl get nodes` fails with "connection refused", see the Troubleshooting section.

### Step 4 · Create the pipeline job

1. Click **New Item** → name it `flash-sale-pipeline` → choose **Pipeline** → OK
2. Scroll to **Pipeline** section
3. Set **Definition** to `Pipeline script from SCM`
   - SCM: `Git`
   - Repository URL: `https://github.com/YOUR_USER/flash-sale.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Click **Save** → **Build Now**

**For local demo (no GitHub):** set Definition to `Pipeline script` and paste the `Jenkinsfile` contents directly.

### What the Jenkinsfile pipeline does

| Stage                | Action                                                             |
| -------------------- | ------------------------------------------------------------------ |
| Clone Repository     | Verifies all Dockerfiles are present                               |
| Build Docker Images  | `docker build` × 3 into Minikube's daemon                          |
| Verify Kubernetes    | `kubectl get nodes` — confirms cluster reachable                   |
| Deploy to Kubernetes | `kubectl apply -f k8s/` + `rollout restart` + waits for completion |
| Smoke Test           | Hits `/health` up to 5 times, confirms HTTP 200                    |
| Print Access URLs    | Prints all service URLs in a summary box                           |

---

## 🎬 PART 5 — Live Demo Script

### Before the audience arrives

```powershell
# Confirm Docker is running
docker ps

# Confirm all services are up
docker compose ps

# Confirm the frontend loads
start http://localhost:8080
```

Pre-open these browser tabs and arrange them:

| Tab                 | URL                   |
| ------------------- | --------------------- |
| 1 — Main screen     | http://localhost:8080 |
| 2 — Redis Commander | http://localhost:8081 |
| 3 — phpMyAdmin      | http://localhost:8082 |
| 4 — Jenkins         | http://localhost:8090 |

In phpMyAdmin: navigate to `flashsale` database → `orders` table → click **Browse** so you can hit F5 to refresh live during the demo.

---

### Demo flow — what to say at each step

**[Tab 1 — countdown running]**

> "We're simulating a flash sale. 500 users are about to compete to buy a product at the same time. Behind this page are 3 API pods load-balanced by Kubernetes, 2 worker pods pulling from a Redis queue, and a MySQL database — all running in containers."

---

**[Countdown reaches 0 — red LIVE badge appears, orange button shows]**

> "Sale is live. When I click this button, 500 HTTP POST requests fire from the browser simultaneously."

---

**[Click the orange button]**

> "500 requests — right now."

---

**[Stay on Tab 1 — point to the Live Request Log panel]**

> "Every line in this log is one API response. Look at the pod name column — you're seeing three different names: order-api-1, order-api-2, order-api-3. That's Kubernetes round-robin load balancing. No single pod handles everything. The 'Pods seen' counter at the top confirms all three are active."

---

**[Stay on Tab 1 — point to the Redis Queue panel]**

> "The queue depth jumped to hundreds instantly. The API didn't write directly to MySQL — it pushed to Redis and returned immediately. That's the buffering pattern. Redis absorbed the entire traffic spike in milliseconds."

---

**[Switch to Tab 2 — Redis Commander]**

> "Here in Redis Commander you can see the `orders` list. Watch the length counter — it shot up fast and is now counting back down as the workers drain it."

---

**[Back to Tab 1 — point to the MySQL panel]**

> "Without opening a terminal — the MySQL row count right here is updating every 1.5 seconds. The workers are inserting steadily, not all at once. The table below it shows exactly how many orders each API pod handled — proving the load was distributed."

---

**[Switch to Tab 3 — phpMyAdmin, press F5]**

> "In phpMyAdmin you can see the actual rows. Each one records the product, the timestamp, the API pod that received the request, and the worker pod that inserted the record. The entire journey of each order is in the database."

---

**[Back to Tab 1 — point to the Docker Containers panel]**

> "All containers are still running. No crashes. This panel polls Docker automatically — completely without a terminal."

---

**[Switch to Tab 4 — Jenkins]**

> "And this is the CI/CD pipeline. Every time code is pushed to GitHub, Jenkins builds all three Docker images, deploys them to Kubernetes, runs a smoke test, and gives you the access URLs. Fully automated. That's the DevOps loop — write code, push, it's live."

---

### Reset between demo runs

```powershell
# Wipe the orders table
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale -e "TRUNCATE TABLE orders;"

# Clear the Redis queue
docker exec flash-redis redis-cli del orders
```

Then reload the browser tab at http://localhost:8080 — the countdown resets automatically.

---

## 🔧 PART 6 — Troubleshooting

### MySQL takes too long / worker crashes on startup

MySQL takes 30–45 seconds to initialise on first run. Workers retry automatically with a delay. Wait 60 seconds — the loop resolves itself. Check with:

```powershell
docker compose logs worker
# Should see: Retrying in 3s...  then  ✅ Table "orders" ready
```

### All requests fail (network error in log panel)

API is not reachable. Check:

```powershell
# Confirm nginx and order-api are running
docker compose ps

# Test the API directly
curl http://localhost:3000/health
# Should return: {"status":"ok","pod":"..."}
```

If using Kubernetes, the frontend API URL needs updating — see Part 3 Step 2.

### Redis Commander shows blank / cannot connect

```powershell
docker compose restart redis-commander
```

### phpMyAdmin shows "cannot connect to MySQL"

MySQL is still starting. Wait 30 seconds, then refresh the phpMyAdmin tab.

### Docker Containers panel on frontend shows "Docker socket not available"

The API container needs the Docker socket mounted. This is already in `docker-compose.yml`. If you edited the compose file, restore this under `order-api`:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Then restart: `docker compose up -d --no-build`

### "ImagePullBackOff" on Kubernetes pods

You built images into your local Docker daemon, not Minikube's. Fix:

```powershell
minikube docker-env | Invoke-Expression
docker build -t order-api:latest ./order-api
docker build -t worker:latest    ./worker
docker build -t frontend:latest  ./frontend
kubectl rollout restart deployment/order-api deployment/worker deployment/frontend
```

### Jenkins — kubectl fails with "connection refused"

The kubeconfig uses `127.0.0.1` which inside the Jenkins container refers to itself, not Minikube. Fix:

```powershell
# Get Minikube's actual container IP
$ip = docker inspect minikube --format "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"
Write-Host "Replace server address with: $ip"

# Open kubeconfig in notepad
notepad "$env:USERPROFILE\.kube\config"
# Change:  server: https://127.0.0.1:<PORT>
# To:      server: https://<IP-ABOVE>:<PORT>
# Keep the port the same

# Restart Jenkins
docker restart jenkins-flash
```

### Jenkins — Docker socket permission denied

```powershell
# Check the GID of the docker socket on your host
docker run --rm alpine stat -c "%g" /var/run/docker.sock
# Common: 0, 999, or 1001

# Edit setup-jenkins.ps1 and change --group-add 999 to match your GID
# Then re-run the script
.\setup-jenkins.ps1
```

### Full reset — start completely clean

```powershell
docker compose down -v          # stop everything + delete MySQL volume
docker compose up --build --scale order-api=3 --scale worker=2
```

---

## 🛠️ PART 7 — Useful Commands

### Docker Compose

```powershell
# Start
docker compose up --build --scale order-api=3 --scale worker=2

# Status
docker compose ps

# Logs for a specific service
docker compose logs -f order-api
docker compose logs -f worker

# Stop (keep data)
docker compose down

# Stop + wipe MySQL volume
docker compose down -v

# Reset DB and queue (without restarting containers)
docker exec flash-mysql mysql -uflashuser -pflashpass flashsale -e "TRUNCATE TABLE orders;"
docker exec flash-redis redis-cli del orders
```

### Kubernetes

```powershell
kubectl get pods                                     # list all pods
kubectl get pods -w                                  # watch live
kubectl describe pod <pod-name>                      # full detail + events
kubectl delete pod <pod-name>                        # force restart (demo: show self-healing)
kubectl scale deployment/worker --replicas=5         # scale live during demo
kubectl logs -f deployment/order-api --prefix=true   # all API pod logs
kubectl logs -f deployment/worker    --prefix=true   # all worker logs
kubectl rollout restart deployment/order-api         # rolling restart
```

### MySQL (Kubernetes)

```powershell
# Row count
kubectl exec deployment/mysql -- mysql -uflashuser -pflashpass flashsale -e "SELECT COUNT(*) FROM orders;"

# Distribution by API pod (proof of load balancing)
kubectl exec deployment/mysql -- mysql -uflashuser -pflashpass flashsale -e "SELECT server, COUNT(*) total FROM orders GROUP BY server ORDER BY total DESC;"

# Clear for next run
kubectl exec deployment/mysql -- mysql -uflashuser -pflashpass flashsale -e "TRUNCATE TABLE orders;"
```

### Redis (Kubernetes)

```powershell
kubectl exec deployment/redis -- redis-cli llen orders    # queue depth
kubectl exec deployment/redis -- redis-cli del orders     # clear queue
```

---

## 🏗️ PART 8 — Architecture

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                     CI/CD Pipeline                               │
  │   Code push → Jenkins :8090 → docker build → kubectl apply      │
  └──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │              Docker Compose / Kubernetes Cluster                 │
  │                                                                  │
  │   Browser (500 req) ──→ frontend :8080 / :30080                  │
  │                               │                                  │
  │                    nginx load balancer :3000                     │
  │                    ┌──────┬──────┬──────┐                       │
  │                 Pod-1  Pod-2  Pod-3   ← 3 replicas              │
  │                 (order-api:3000 each)                            │
  │                    └──────┴──┬───┘                              │
  │                              │  rPush("orders")                 │
  │                         redis :6379                             │
  │                         List: "orders"                          │
  │                              │  BLPOP                           │
  │                 ┌────────────┴────────────┐                     │
  │             Worker-1               Worker-2  ← 2 replicas       │
  │                 └────────────┬────────────┘                     │
  │                              │  INSERT                          │
  │                         mysql :3306                             │
  │                         flashsale.orders                        │
  │                                                                  │
  │   Monitoring (no terminal needed):                               │
  │     frontend dashboard :8080   ← polls /stats every 1.5s        │
  │     redis-commander    :8081   ← direct Redis UI                 │
  │     phpmyadmin         :8082   ← direct MySQL UI                 │
  └──────────────────────────────────────────────────────────────────┘
```

### Concepts demonstrated

| Concept                    | Where to see it                                        |
| -------------------------- | ------------------------------------------------------ |
| **Load Balancing**         | Frontend log pod column — 3 pod names rotating         |
| **Queue Buffering**        | Redis queue spikes then drains steadily                |
| **Competing Consumers**    | MySQL table — orders split across 2 workers            |
| **DB Write Smoothing**     | MySQL gets steady inserts, not a 500-row spike         |
| **Self-Healing**           | Kubernetes: delete a pod → it restarts automatically   |
| **Horizontal Scaling**     | `kubectl scale deployment/worker --replicas=5`         |
| **CI/CD Pipeline**         | Jenkins stages: clone → build → deploy → smoke test    |
| **Infrastructure as Code** | Everything declarative in `k8s/*.yaml` + `Jenkinsfile` |
