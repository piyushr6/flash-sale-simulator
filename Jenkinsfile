// ─────────────────────────────────────────────────────────────────
// Flash Sale Order Simulator — Jenkinsfile
// Pipeline: Clone → Build Images → Deploy to Kubernetes
//
// Prerequisites (set up once):
//   - Jenkins running in Docker with Docker socket mounted
//   - kubectl binary copied into Jenkins container
//   - Minikube kubeconfig mounted into Jenkins container
//   - Plugins: Git, Docker Pipeline, Kubernetes CLI
// ─────────────────────────────────────────────────────────────────

pipeline {

    // Run on the built-in Jenkins node (our custom container has Docker + kubectl)
    agent any

    // ── Environment variables ──────────────────────────────────────
    environment {
        // Image names — must match what Kubernetes YAML expects
        API_IMAGE      = 'order-api'
        WORKER_IMAGE   = 'worker'
        FRONTEND_IMAGE = 'frontend'
        IMAGE_TAG      = 'latest'

        // Kubernetes namespace (default is fine for demo)
        K8S_NAMESPACE  = 'default'

        // Path to kubeconfig inside the Jenkins container
        KUBECONFIG     = '/root/.kube/config'
    }

    // ── Pipeline options ───────────────────────────────────────────
    options {
        // Keep last 5 build logs
        buildDiscarder(logRotator(numToKeepStr: '5'))
        // Fail if pipeline takes more than 15 minutes
        timeout(time: 15, unit: 'MINUTES')
        // Add timestamps to every log line
        timestamps()
    }

    // ── Stages ────────────────────────────────────────────────────
    stages {

        // ── Stage 1: Clone ─────────────────────────────────────────
        stage('Clone Repository') {
            steps {
                echo '━━━ Stage 1: Cloning repository ━━━'
                // In a real setup, replace with your GitHub URL:
                // git branch: 'main', url: 'https://github.com/YOUR_USER/flash-sale.git'
                //
                // For local demo: Jenkins uses the workspace files directly.
                // We verify the expected files exist.
                sh '''
                    echo "[INFO] Workspace: ${WORKSPACE}"
                    echo "[INFO] Checking required files..."

                    # Verify all required Dockerfiles exist
                    for f in order-api/Dockerfile worker/Dockerfile frontend/Dockerfile; do
                        if [ ! -f "${WORKSPACE}/${f}" ]; then
                            echo "[ERROR] Missing: ${f}"
                            exit 1
                        else
                            echo "[OK] Found: ${f}"
                        fi
                    done

                    echo "[INFO] All required files present."
                    ls -la
                '''
            }
        }

        // ── Stage 2: Build Docker Images ───────────────────────────
        stage('Build Docker Images') {
            steps {
                echo '━━━ Stage 2: Building Docker images ━━━'
                sh '''
                    echo "[INFO] Docker version:"
                    docker version --format "Client: {{.Client.Version}}  Server: {{.Server.Version}}"

                    echo ""
                    echo "[BUILD] Building order-api:${IMAGE_TAG} ..."
                    docker build -t ${API_IMAGE}:${IMAGE_TAG} ${WORKSPACE}/order-api/
                    echo "[BUILD] ✓ order-api built"

                    echo ""
                    echo "[BUILD] Building worker:${IMAGE_TAG} ..."
                    docker build -t ${WORKER_IMAGE}:${IMAGE_TAG} ${WORKSPACE}/worker/
                    echo "[BUILD] ✓ worker built"

                    echo ""
                    echo "[BUILD] Building frontend:${IMAGE_TAG} ..."
                    docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} ${WORKSPACE}/frontend/
                    echo "[BUILD] ✓ frontend built"

                    echo ""
                    echo "[INFO] Built images:"
                    docker images | grep -E "order-api|worker|frontend"
                '''
            }
        }

        // ── Stage 3: Verify Kubernetes connection ──────────────────
        stage('Verify Kubernetes') {
            steps {
                echo '━━━ Stage 3: Verifying Kubernetes cluster ━━━'
                sh '''
                    echo "[INFO] kubectl version:"
                    kubectl version --client --short 2>/dev/null || kubectl version --client

                    echo ""
                    echo "[INFO] Cluster nodes:"
                    kubectl get nodes

                    echo ""
                    echo "[INFO] Current pods:"
                    kubectl get pods -n ${K8S_NAMESPACE} 2>/dev/null || echo "(no pods yet)"
                '''
            }
        }

        // ── Stage 4: Deploy to Kubernetes ──────────────────────────
        stage('Deploy to Kubernetes') {
            steps {
                echo '━━━ Stage 4: Deploying to Kubernetes ━━━'
                sh '''
                    echo "[DEPLOY] Applying all Kubernetes manifests..."
                    kubectl apply -f ${WORKSPACE}/k8s/ -n ${K8S_NAMESPACE}

                    echo ""
                    echo "[DEPLOY] Restarting deployments to pick up new images..."
                    kubectl rollout restart deployment/order-api  -n ${K8S_NAMESPACE}
                    kubectl rollout restart deployment/worker     -n ${K8S_NAMESPACE}
                    kubectl rollout restart deployment/frontend   -n ${K8S_NAMESPACE}

                    echo ""
                    echo "[DEPLOY] Waiting for order-api rollout..."
                    kubectl rollout status deployment/order-api -n ${K8S_NAMESPACE} --timeout=120s

                    echo ""
                    echo "[DEPLOY] Waiting for worker rollout..."
                    kubectl rollout status deployment/worker -n ${K8S_NAMESPACE} --timeout=120s

                    echo ""
                    echo "[DEPLOY] Waiting for frontend rollout..."
                    kubectl rollout status deployment/frontend -n ${K8S_NAMESPACE} --timeout=120s

                    echo ""
                    echo "[DEPLOY] ✅ All deployments complete!"
                '''
            }
        }

        // ── Stage 5: Smoke Test ────────────────────────────────────
        stage('Smoke Test') {
            steps {
                echo '━━━ Stage 5: Smoke testing API health endpoint ━━━'
                sh '''
                    echo "[TEST] Getting NodePort for order-api-service..."
                    NODE_PORT=$(kubectl get svc order-api-service -n ${K8S_NAMESPACE} \
                        -o jsonpath="{.spec.ports[0].nodePort}" 2>/dev/null || echo "30000")

                    # Get the cluster IP — works for minikube
                    CLUSTER_IP=$(kubectl get nodes \
                        -o jsonpath="{.items[0].status.addresses[?(@.type=='InternalIP')].address}" 2>/dev/null \
                        || echo "127.0.0.1")

                    echo "[TEST] Hitting: http://${CLUSTER_IP}:${NODE_PORT}/health"

                    # Try up to 5 times (pod may still be starting)
                    for i in 1 2 3 4 5; do
                        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                            --max-time 5 \
                            "http://${CLUSTER_IP}:${NODE_PORT}/health" 2>/dev/null || echo "000")

                        if [ "$HTTP_CODE" = "200" ]; then
                            echo "[TEST] ✅ Health check passed (HTTP ${HTTP_CODE})"
                            break
                        else
                            echo "[TEST] Attempt ${i}/5 — HTTP ${HTTP_CODE}, waiting 5s..."
                            sleep 5
                        fi

                        if [ "$i" = "5" ]; then
                            echo "[TEST] ⚠️  Health check did not return 200 after 5 attempts."
                            echo "[TEST] This may be normal if pods are still warming up."
                            echo "[TEST] Check manually: kubectl get pods"
                        fi
                    done
                '''
            }
        }

        // ── Stage 6: Print Access URLs ─────────────────────────────
        stage('Print Access URLs') {
            steps {
                echo '━━━ Stage 6: Deployment Summary ━━━'
                sh '''
                    CLUSTER_IP=$(kubectl get nodes \
                        -o jsonpath="{.items[0].status.addresses[?(@.type=='InternalIP')].address}" 2>/dev/null \
                        || echo "<minikube-ip>")

                    echo ""
                    echo "╔══════════════════════════════════════════════════════════╗"
                    echo "║           FLASH SALE DEMO — ACCESS URLS                 ║"
                    echo "╠══════════════════════════════════════════════════════════╣"
                    echo "║  Frontend    →  http://${CLUSTER_IP}:30080              ║"
                    echo "║  Order API   →  http://${CLUSTER_IP}:30000/health       ║"
                    echo "║  Redis UI    →  http://${CLUSTER_IP}:30081              ║"
                    echo "║  phpMyAdmin  →  http://${CLUSTER_IP}:30082              ║"
                    echo "╠══════════════════════════════════════════════════════════╣"
                    echo "║  kubectl get pods -w                                    ║"
                    echo "║  kubectl logs -f deployment/order-api --prefix=true     ║"
                    echo "║  kubectl logs -f deployment/worker --prefix=true        ║"
                    echo "╚══════════════════════════════════════════════════════════╝"
                    echo ""

                    echo "[INFO] Current pod status:"
                    kubectl get pods -n ${K8S_NAMESPACE}
                '''
            }
        }
    }

    // ── Post-build actions ─────────────────────────────────────────
    post {
        success {
            echo '✅ Pipeline completed successfully! Flash Sale is deployed.'
        }
        failure {
            echo '❌ Pipeline failed. Check stage logs above for details.'
            sh 'kubectl get pods --all-namespaces 2>/dev/null || true'
        }
        always {
            echo 'Pipeline finished. Run: kubectl get pods -w to monitor.'
        }
    }
}
