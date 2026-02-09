# --- ETAPA 1: Construcción del Frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
# Copiar archivos de dependencias primero para aprovechar el cache de Docker
COPY frontend/package*.json ./
RUN npm install
# Copiar el resto del código y compilar
COPY frontend/ ./
RUN npm run build

# --- ETAPA 2: Construcción del Backend (Java) ---
FROM maven:3-eclipse-temurin-17-alpine AS backend-build
WORKDIR /app/backend
# Copiar el pom.xml y descargar dependencias
COPY backend/pom.xml ./
RUN mvn dependency:go-offline
# Copiar el código fuente y compilar el .jar omitiendo tests para acelerar el despliegue
COPY backend/src ./src
RUN mvn clean package -DskipTests

# --- ETAPA 3: Imagen Final de Producción ---
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copiar el JAR generado desde la etapa de backend-build
# Nota: Verifica que el nombre del jar coincida con tu pom.xml (rutas-ods-backend-0.0.1-SNAPSHOT.jar)
COPY --from=backend-build /app/backend/target/*.jar app.jar

# Exponer el puerto que Render usará (por defecto 8080 en Spring)
EXPOSE 8080

# Variable de entorno para asegurar que Spring use el puerto asignado por Render
ENV PORT=8080

# Comando para ejecutar la aplicación
ENTRYPOINT ["java", "-jar", "app.jar"]