# Build with a cached dependency layer before copying the application sources.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package \
    && set -- target/*.jar \
    && for jar in "$@"; do case "$jar" in *-plain.jar) ;; *) cp "$jar" target/app.jar ;; esac; done \
    && test -s target/app.jar

FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser
COPY --from=build --chown=appuser:appuser /workspace/target/app.jar /app/app.jar
USER appuser
EXPOSE 8080

# Keep heap below the 512 MB service limit to leave room for metaspace and native memory.
# SerialGC uses less memory and CPU than parallel collectors in this small container.
# Stop tiered compilation early to reduce startup work on the 0.1 CPU service.
# Smaller thread stacks reduce native memory use as request threads are created.
# Exit clearly on OOM so the platform can restart the unhealthy container.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
