pipeline {

    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'flash-sale'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '5'))
        timeout(time: 10, unit: 'MINUTES')
        timestamps()
    }

    stages {

        stage('Git Pull') {
            steps {
                echo '━━━ Stage 1: Code checkout ━━━'
                sh '''
                    echo "Branch:  $(git rev-parse --abbrev-ref HEAD)"
                    echo "Commit:  $(git rev-parse --short HEAD)"
                    echo "Message: $(git log -1 --pretty=%B)"
                    ls -la
                '''
            }
        }

        stage('Build Containers') {
            steps {
                echo '━━━ Stage 2: Building Docker images ━━━'
                sh '''
                    cd ${WORKSPACE}
                    echo "Docker:         $(docker --version)"
                    echo "Docker Compose: $(docker-compose --version)"
                    docker-compose build order-api worker frontend nginx
                    echo "✅ All images built"
                    docker images | grep -E "order-api|worker|frontend|flash-nginx" || true
                '''
            }
        }

        stage('Stop Old Stack') {
            steps {
                echo '━━━ Stage 3: Stopping old containers ━━━'
                sh '''
                    cd ${WORKSPACE}
                    docker-compose down --remove-orphans || true
                    echo "✅ Old stack stopped"
                '''
            }
        }

        stage('Start New Stack') {
            steps {
                echo '━━━ Stage 4: Starting containers ━━━'
                sh '''
                    cd ${WORKSPACE}
                    docker-compose up -d \
                        --scale order-api=3 \
                        --scale worker=2
                    echo "✅ Stack started"
                    docker-compose ps
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo '━━━ Stage 5: Health check ━━━'
                sh '''
                    echo "Waiting 25s for services to be ready..."
                    sleep 25

                    # Use docker exec to check health from inside the network
                    # This avoids the localhost issue with Jenkins container networking
                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        STATUS=$(docker exec flash-nginx \
                            wget -qO- http://localhost/health 2>/dev/null \
                            | grep -c '"status":"ok"' || echo "0")

                        if [ "$STATUS" = "1" ]; then
                            echo "✅ API health check passed"
                            break
                        fi

                        echo "Attempt $i/10 — not ready yet — retrying in 5s..."
                        sleep 5

                        if [ "$i" = "10" ]; then
                            echo "❌ Health check failed after 10 attempts"
                            docker-compose logs order-api --tail=20
                            exit 1
                        fi
                    done
                '''
            }
        }

        stage('Success') {
            steps {
                echo '━━━ Stage 6: Deployment summary ━━━'
                sh '''
                    echo ""
                    echo "╔══════════════════════════════════════════════╗"
                    echo "║        FLASH SALE — LIVE                     ║"
                    echo "╠══════════════════════════════════════════════╣"
                    echo "║  Frontend    →  http://localhost:8080        ║"
                    echo "║  API Health  →  http://localhost:3000/health ║"
                    echo "║  Redis UI    →  http://localhost:8081        ║"
                    echo "║  phpMyAdmin  →  http://localhost:8082        ║"
                    echo "║  Jenkins     →  http://localhost:8090        ║"
                    echo "╚══════════════════════════════════════════════╝"
                    echo ""
                    docker-compose ps
                '''
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline complete — open http://localhost:8080'
        }
        failure {
            echo '❌ Pipeline failed — check stage logs above'
            sh 'docker-compose logs --tail=20 || true'
        }
        always {
            echo 'Pipeline finished.'
        }
    }
}
