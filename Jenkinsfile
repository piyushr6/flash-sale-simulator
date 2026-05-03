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
                    echo "Waiting 20s for all services to be ready..."
                    sleep 20

                    echo "Checking containers are running..."
                    docker-compose ps

                    echo ""
                    echo "Checking API response via nginx..."
                    RESPONSE=$(docker exec flash-nginx wget -qO- http://localhost/health 2>&1 || echo "FAILED")
                    echo "API response: $RESPONSE"

                    if echo "$RESPONSE" | grep -q "status"; then
                        echo "✅ API health check passed"
                    else
                        echo "❌ API did not respond correctly"
                        echo "Response was: $RESPONSE"
                        docker-compose logs order-api --tail=10
                        exit 1
                    fi

                    echo ""
                    echo "Checking Redis..."
                    docker exec flash-redis redis-cli ping
                    echo "✅ Redis OK"

                    echo ""
                    echo "Checking MySQL..."
                    docker exec flash-mysql mysqladmin ping -h localhost -u flashuser -pflashpass --silent
                    echo "✅ MySQL OK"
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
