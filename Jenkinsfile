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
                '''
            }
        }

        stage('Build Containers') {
            steps {
                echo '━━━ Stage 2: Building Docker images ━━━'
                sh '''
                    cd ${WORKSPACE}
                    docker-compose build order-api worker frontend nginx
                    echo "✅ All images built"
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
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo '━━━ Stage 5: Health check ━━━'
                sh '''
                    echo "Waiting 25s for all services to initialise..."
                    sleep 25

                    echo ""
                    echo "Container status:"
                    docker-compose ps

                    echo ""
                    echo "Checking each required container is running..."

                    for container in flash-nginx flash-mysql flash-redis flash-frontend; do
                        STATE=$(docker inspect --format="{{.State.Running}}" $container 2>/dev/null || echo "false")
                        if [ "$STATE" = "true" ]; then
                            echo "✅ $container is running"
                        else
                            echo "❌ $container is NOT running"
                            exit 1
                        fi
                    done

                    echo ""
                    echo "Checking API pods are running..."
                    API_COUNT=$(docker ps --filter "name=flash-sale-order-api" --filter "status=running" -q | wc -l)
                    echo "API pods running: $API_COUNT"
                    if [ "$API_COUNT" -ge "1" ]; then
                        echo "✅ API pods OK"
                    else
                        echo "❌ No API pods running"
                        exit 1
                    fi

                    echo ""
                    echo "Checking Redis responds..."
                    docker exec flash-redis redis-cli ping
                    echo "✅ Redis OK"

                    echo ""
                    echo "Checking MySQL responds..."
                    docker exec flash-mysql mysqladmin ping -h localhost -u flashuser -pflashpass --silent
                    echo "✅ MySQL OK"

                    echo ""
                    echo "Checking API health via one of the API containers directly..."
                    API_CONTAINER=$(docker ps --filter "name=flash-sale-order-api" --filter "status=running" -q | head -1)
                    RESPONSE=$(docker exec $API_CONTAINER wget -qO- http://localhost:3000/health 2>/dev/null || echo "")
                    echo "API response: $RESPONSE"
                    if echo "$RESPONSE" | grep -q "ok"; then
                        echo "✅ API health check passed"
                    else
                        echo "❌ API health check failed"
                        exit 1
                    fi
                '''
            }
        }

        stage('Success') {
            steps {
                echo '━━━ Stage 6: Deployment complete ━━━'
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
            echo '❌ Pipeline failed'
            sh 'docker-compose logs --tail=10 || true'
        }
        always {
            echo 'Pipeline finished.'
        }
    }
}
